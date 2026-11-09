'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { fromZonedTime } from 'date-fns-tz';
import { z } from 'zod';
import { configured, supabase } from '@/lib/supabase/server';
import { HEX_COLOR } from '@/lib/branding';
import { serviceClient,synchronizeMatches } from '@/lib/nevobo/service';
import { mailConfig,sendMatchEmail } from '@/lib/nevobo/mail';
import { loadNevoboProgram,syncErrorMessage } from '@/lib/nevobo/import-program';
import { competitionLevelSchema } from '@/lib/competition-rules';
import { refereeLevelSchema } from '@/lib/referee-levels';
import { loginError } from '@/lib/auth-errors';
import { seasonSchema, type SeasonValues, type SeasonFormState } from '@/lib/seasons';

const id = z.uuid();
const number = (v: FormDataEntryValue | null) => Number(v);
const optionalNumber = (v: FormDataEntryValue | null) => v === '' || v === null ? null : Number(v);
const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const manager = async () => {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Log eerst in.');
  const { data } = await db.from('profiles').select('role').eq('id', user.id).single();
  if (!data || !['admin', 'manager'].includes(data.role)) throw new Error('Geen beheerrechten.');
  return { db, role: data.role, user };
};
async function run(path: string, fn: () => Promise<void>) {
  if (!configured()) redirect(`${path}?error=${encodeURIComponent('De applicatie is nog niet ingesteld. Neem contact op met de beheerder.')}`);
  let error: string | null = null;
  try { await fn(); } catch (e) { error = e instanceof z.ZodError ? 'Controleer de ingevulde gegevens.' : e instanceof Error ? e.message : 'De actie is niet gelukt.'; }
  revalidatePath('/', 'layout');
  redirect(`${path}${path.includes('?')?'&':'?'}${error ? 'error=' + encodeURIComponent(error) : 'success=Opgeslagen'}`);
}
export async function login(f: FormData) {
  if (!configured()) redirect('/');
  const db = await supabase();
  // Passwords are exact strings; leading/trailing spaces may be intentional.
  const { error } = await db.auth.signInWithPassword({ email: text(f, 'email'), password: String(f.get('password') ?? '') });
  if (error) redirect('/login?error=' + encodeURIComponent(loginError(error)));
  redirect('/');
}
export async function requestPasswordReset(f: FormData) {
  if (!configured()) redirect('/login');
  const email = z.email().safeParse(text(f, 'email'));
  if (!email.success) redirect('/wachtwoord-vergeten?error=Vul%20een%20geldig%20e-mailadres%20in.');
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) redirect('/wachtwoord-vergeten?error=De%20herstellink%20is%20nog%20niet%20ingesteld.%20Neem%20contact%20op%20met%20de%20beheerder.');
  const db = await supabase();
  const { error } = await db.auth.resetPasswordForEmail(email.data, { redirectTo: `${site}/auth/confirm` });
  if (error) redirect('/wachtwoord-vergeten?error=' + encodeURIComponent(error.status === 429 ? 'Er zijn te veel aanvragen gedaan. Wacht even voordat je opnieuw probeert.' : 'De herstelmail kon niet worden aangevraagd. Probeer het straks opnieuw of controleer de e-mailinstellingen in Supabase.'));
  // Same response for existing and unknown email addresses.
  redirect('/wachtwoord-vergeten?success=' + encodeURIComponent('Als er een account bij dit e-mailadres hoort, ontvang je een herstelmail. Controleer ook je spammap.'));
}
export async function logout() { if (configured()) { const db = await supabase(); await db.auth.signOut(); } redirect('/login'); }
export async function setPassword(f: FormData) {
  await run('/', async () => {
    const password = z.string().min(12).max(128).parse(f.get('password'));
    const db = await supabase(); const { error } = await db.auth.updateUser({ password }); if (error) throw new Error('Wachtwoord instellen is niet gelukt.');
  });
}
export async function enroll(f: FormData) {
  await run(text(f,'return_to')==='/beheer/planning'?'/beheer/planning':'/diensten', async () => {
    const db = await supabase();
    const { error } = await db.rpc('enroll', { p_duty: id.parse(f.get('duty_id')), p_takeover: f.get('takeover_id') ? id.parse(f.get('takeover_id')) : null, p_member: f.get('member_id') ? id.parse(f.get('member_id')) : null });
    if (error) throw new Error(error.message);
  });
}
export async function changeEnrollment(f: FormData) {
  await run(text(f,'return_to')==='/beheer/planning'?'/beheer/planning':'/diensten', async () => {
    const db = await supabase();
    const { error } = await db.rpc('change_enrollment', { p_enrollment: id.parse(f.get('enrollment_id')), p_action: z.enum(['withdraw','offer','unoffer','revoke']).parse(f.get('action')), p_reason: text(f, 'reason') || null });
    if (error) throw new Error(error.message);
  });
}
export async function createDuty(f: FormData) {
  await run('/beheer/planning', async () => {
    const { db } = await manager();
    const start = fromZonedTime(text(f, 'start'), 'Europe/Amsterdam');
    const end = fromZonedTime(text(f, 'end'), 'Europe/Amsterdam');
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error('Controleer de begin- en eindtijd.');
    const { error } = await db.rpc('create_qualified_duty', {
      p_season: id.parse(f.get('season_id')), p_title: z.string().min(1).max(200).parse(text(f, 'title')),
      p_kind: z.enum(['bar','referee','event','lines']).parse(f.get('kind')), p_start: start.toISOString(), p_end: end.toISOString(),
      p_location: z.string().min(1).parse(text(f, 'location')), p_capacity: z.number().int().min(1).max(100).parse(number(f.get('capacity'))),
      p_points: z.number().positive().parse(number(f.get('points'))), p_qualification: f.get('kind')==='referee'?refereeLevelSchema.parse(text(f,'qualification')):null,
      p_team: f.get('team_id') ? id.parse(f.get('team_id')) : null, p_repeat: z.number().int().min(1).max(53).parse(number(f.get('repeat'))),
    });
    if (error) throw new Error(error.code==='PGRST202'?'Voer eerst migratie 005_referee_qualifications.sql uit in Supabase.':error.message);
  });
}
export async function saveSeason(_previous:SeasonFormState,f:FormData):Promise<SeasonFormState> {
  const parsed=seasonSchema.safeParse(Object.fromEntries(['name','start','end','norm','youth','senior'].map(key=>[key,text(f,key)])));
  if(!parsed.success) {
    const errors:SeasonFormState['errors']={};
    for(const issue of parsed.error.issues) {const key=issue.path[0] as keyof SeasonValues;if(!errors[key]) errors[key]=issue.message;}
    return {error:'Controleer de gemarkeerde velden. Je invoer is bewaard.',errors};
  }
  let saved:string;
  const editing=Boolean(f.get('season_id'));
  try {
    const {db}=await manager(),v=parsed.data;
    const {data,error}=await db.rpc('save_season',{
      p_season:editing?id.parse(f.get('season_id')):null,p_name:v.name,p_start:v.start,p_end:v.end,
      p_norm:v.norm,p_youth:v.youth,p_senior:v.senior,
      p_expected_updated_at:editing?z.iso.datetime({offset:true}).parse(f.get('updated_at')):null,
    });
    if(error) return {error:error.code==='PGRST202'?'Seizoenen opslaan is nog niet beschikbaar. Voer migratie 004_season_management.sql uit in Supabase.':error.message};
    saved=id.parse(data);
  }catch(error){return {error:error instanceof z.ZodError?'De opgeslagen versie van dit seizoen ontbreekt. Herlaad de pagina.':error instanceof Error?error.message:'Opslaan is niet gelukt. Je invoer is bewaard.'};}
  revalidatePath('/','layout');
  redirect('/beheer/seizoenen?season='+saved+'&success='+encodeURIComponent(editing?'Seizoen bijgewerkt.':'Seizoen aangemaakt.'));
}
export async function activateSeason(f:FormData) {
  let error:string|null=null;
  try {
    const {db}=await manager();
    const result=await db.rpc('activate_season',{p_season:id.parse(f.get('season_id')),p_expected_updated_at:z.iso.datetime({offset:true}).parse(f.get('updated_at'))});
    if(result.error) error=result.error.code==='PGRST202'?'Voer eerst migratie 004_season_management.sql uit in Supabase.':result.error.message;
  }catch(e){error=e instanceof z.ZodError?'Herlaad de pagina voordat je dit seizoen activeert.':e instanceof Error?e.message:'Activeren is niet gelukt.';}
  revalidatePath('/','layout');
  redirect('/beheer/seizoenen?'+(error?'error='+encodeURIComponent(error):'success='+encodeURIComponent('Actief seizoen gewijzigd.')));
}
export async function createTeam(f: FormData) {
  await run('/beheer/teams', async () => {
    const { db } = await manager(); const { error } = await db.rpc('create_team_with_level', { p_competition:competitionLevelSchema.parse(text(f,'competition')), p_season: id.parse(f.get('season_id')), p_name: z.string().min(1).parse(text(f, 'name')), p_age: z.enum(['youth','senior']).parse(f.get('age')) });
    if (error) throw new Error(error.code==='PGRST202'?'Voer eerst migratie 006_competition_referee_rules.sql uit in Supabase.':error.message);
  });
}
export async function updateMember(f: FormData) {
  const member=id.safeParse(f.get('member_id'));
  await run('/beheer/leden'+(member.success?'?member='+member.data:''), async () => {
    const { db } = await manager(); const { error } = await db.rpc('update_member_qualification', { p_member: id.parse(f.get('member_id')), p_season: id.parse(f.get('season_id')), p_team: id.parse(f.get('team_id')), p_captain: f.get('captain') === 'on', p_norm: z.number().min(0).nullable().parse(optionalNumber(f.get('norm'))), p_qualification: text(f,'qualification')?refereeLevelSchema.parse(text(f,'qualification')):null });
    if (error) throw new Error(error.code==='PGRST202'?'Voer eerst migratie 005_referee_qualifications.sql uit in Supabase.':error.message);
  });
}
export async function assignFunction(f: FormData) {
  await run('/beheer/functies', async () => {
    const { db } = await manager(); const { error } = await db.rpc('assign_function', { p_member: id.parse(f.get('member_id')), p_season: id.parse(f.get('season_id')), p_title: z.string().min(1).parse(text(f, 'title')), p_points: z.number().min(0).parse(number(f.get('points'))), p_start: text(f, 'start'), p_end: text(f, 'end') });
    if (error) throw new Error(error.message);
  });
}
export async function invite(f: FormData) {
  await run('/beheer/leden', async () => {
    const { role } = await manager();
    if (role !== 'admin') throw new Error('Alleen de admin mag accounts aanmaken.');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SITE_URL) throw new Error('Configureer eerst de server-sleutel en de site-URL.');
    const input = z.object({ first: z.string().min(1), last: z.string().min(1), email: z.email(), role: z.enum(['manager','member']), code: z.string(), team: z.string(), season: z.string() }).parse({ first: text(f,'first'), last: text(f,'last'), email: text(f,'email'), role: f.get('role'), code: text(f,'code'), team: text(f,'team_id'), season: text(f,'season_id') });
    if (input.role === 'member' && (!input.code || !input.team || !input.season)) throw new Error('Team, seizoen en Nevobo-code zijn verplicht voor leden.');
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    if(input.code) { const { data } = await service.from('profiles').select('id').eq('nevobo_code',input.code).maybeSingle(); if(data) throw new Error('Deze Nevobo-code is al in gebruik.'); }
    if (input.role==='member') {
      const { data } = await service.from('teams').select('id').eq('id',id.parse(input.team)).eq('season_id',id.parse(input.season)).maybeSingle();
      if(!data) throw new Error('Kies een team uit het actieve seizoen.');
    }
    const { data, error } = await service.auth.admin.inviteUserByEmail(input.email, { data: { first_name: input.first, last_name: input.last }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm` });
    if(error || !data.user) throw new Error('Uitnodigen mislukt. Controleer of het adres al bestaat en of e-mail is geconfigureerd.');
    const { error: profileError } = await service.from('profiles').update({ role: input.role, nevobo_code: input.code || null }).eq('id',data.user.id);
    const membership = input.role === 'member' ? await service.from('memberships').insert({ member_id:data.user.id,season_id:input.season,team_id:input.team }) : null;
    if(profileError || membership?.error) throw new Error('Account is aangemaakt, maar de profielinrichting is onvolledig. Controleer het lid in beheer voordat je opnieuw uitnodigt.');
  });
}
export async function cancelDuty(f: FormData) {
  await run('/beheer/planning', async () => {const {db}=await manager();const {error}=await db.rpc('cancel_duty',{p_duty:id.parse(f.get('duty_id'))});if(error) throw new Error(error.message);});
}
export async function saveFunction(f: FormData) {
  await run('/beheer/functies', async () => {const {db}=await manager();const {error}=await db.rpc('save_function',{p_season:id.parse(f.get('season_id')),p_title:z.string().min(1).parse(text(f,'title')),p_points:z.number().min(0).parse(number(f.get('points')))});if(error) throw new Error(error.message);});
}
export async function removeFunction(f: FormData) {
  await run('/beheer/functies', async () => {const {db}=await manager();const {error}=await db.rpc('remove_function',{p_assignment:id.parse(f.get('assignment_id'))});if(error) throw new Error(error.message);});
}

export async function saveBranding(f: FormData) {
  await run('/beheer/instellingen/huisstijl',async()=>{
    const {db}=await manager();
    const color=z.string().length(7).regex(HEX_COLOR);
    const primary=color.parse(text(f,'primaryColor')).toUpperCase();
    const secondary=color.parse(text(f,'secondaryColor')).toUpperCase();
    const {error}=await db.rpc('save_club_branding',{p_primary:primary,p_secondary:secondary});
    if(error) throw new Error('De kleuren konden niet worden opgeslagen. Controleer de huisstijlmigratie en je beheerrechten.');
    updateTag('club-branding');
  });
}

export async function markNotificationRead(f:FormData) {
 await run('/meldingen',async()=>{const db=await supabase();const {error}=await db.rpc('mark_notification_read',{p_notification:id.parse(f.get('notification_id'))});if(error) throw new Error('De melding kon niet worden bijgewerkt.');});
}
export async function createMatchDuty(f:FormData) {
 await run('/beheer/wedstrijden',async()=>{
  const {db}=await manager();const {error}=await db.rpc('create_automatic_match_duty',{
   p_match:id.parse(f.get('match_id')),p_points:z.number().positive().parse(number(f.get('points'))),
   p_minutes:z.number().int().min(15).max(480).parse(number(f.get('minutes'))),
  });if(error) throw new Error(error.code==='PGRST202'?'Voer eerst migratie 006_competition_referee_rules.sql uit in Supabase.':error.message);
 });
}

export async function syncNevobo() {
 await manager();
 let message='';let failed=false;
 try {
  const result=await synchronizeMatches(serviceClient(),loadNevoboProgram);
  if(result.status==='busy') message='Er loopt al een synchronisatie. Probeer het over enkele minuten opnieuw.';
  else {
   const counts=z.object({inserted:z.number(),updated:z.number(),skipped:z.number()}).parse(result.counts);
   message=`Import voltooid: ${counts.inserted} nieuw, ${counts.updated} gewijzigd, ${counts.skipped} buiten het actieve seizoen.`;
   if('error' in result.mail || ('failed' in result.mail && result.mail.failed>0)) message+=' Niet-verstuurde e-mails blijven in de verzendwachtrij.';
  }
 }catch(error){failed=true;message=syncErrorMessage(error instanceof Error?error.message:'');}
 revalidatePath('/', 'layout');
 redirect('/beheer/wedstrijden?'+(failed?'error=':'success=')+encodeURIComponent(message));
}

export async function testMatchNotifications() {
 await run('/beheer/wedstrijden',async()=>{
  const {user}=await manager();const config=mailConfig();
  if(!config) throw new Error('Stel eerst de Resend API-sleutel, het afzenderadres en de site-URL in.');
  const recipient=z.email().safeParse(user.email);if(!recipient.success) throw new Error('Je account heeft geen geldig e-mailadres.');
  const service=serviceClient();
  const {data,error}=await service.from('notifications').insert({member_id:user.id,title:'Testmelding wedstrijdkoppeling',body:'Dit is de door jou aangevraagde testmelding voor de wedstrijdkoppeling.'}).select('id,title,body').single();
  if(error || !data) throw new Error('De testmelding kon niet worden opgeslagen. Controleer migratie 003.');
  const result=await sendMatchEmail({outbox_id:'',claim:'',notification_id:data.id,recipient:recipient.data,subject:data.title,body:data.body},config);
  if(!result.sent) throw new Error('De testmelding staat in de app, maar de mail kon niet worden verstuurd. Controleer het geverifieerde afzenderdomein en de API-sleutel in Resend.');
 });
}

export async function setDutyQualification(f:FormData) {
 await run('/beheer/planning',async()=>{
  const {db}=await manager();const {error}=await db.rpc('set_duty_qualification',{p_duty:id.parse(f.get('duty_id')),p_qualification:refereeLevelSchema.parse(text(f,'qualification'))});
  if(error) throw new Error(error.code==='PGRST202'?'Voer eerst migratie 005_referee_qualifications.sql uit in Supabase.':error.message);
 });
}

export async function updateTeamCompetition(f:FormData) {
 await run('/beheer/teams',async()=>{
  const {db}=await manager();const {error}=await db.rpc('update_team_competition',{p_team:id.parse(f.get('team_id')),p_competition:competitionLevelSchema.parse(text(f,'competition'))});
  if(error) throw new Error(error.code==='PGRST202'?'Voer eerst migratie 006_competition_referee_rules.sql uit in Supabase.':error.message);
 });
}
