import { planningMonth } from './planning';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { collectPages } from './pagination';
import { configured, supabase } from './supabase/server';
import { progress, type Duty, type Profile, type Enrollment } from './domain';
import type { Season } from './seasons';
import type { FunctionDefinition } from './functions';
export type Membership = { member_id: string; team_id: string; captain: boolean; norm_override: number | null };
export type Team = { id: string; name: string; age_class: string; competition_level?:string|null };
export type Match = { id:string;home_team:string;away_team:string;starts_at:string|null;location:string;level:string;club_referee:boolean;cancelled?:boolean;status?:string;address?:string|null;postal_code?:string|null;city?:string|null;court?:string|null;match_code?:string|null;source_url?:string|null;source_description?:string|null;referee_duties?:{id:string;kind:string;cancelled:boolean;points:number;assigned_team_id?:string|null}[] };
export type SyncState={last_started_at:string|null;last_success_at:string|null;last_error_code:string|null;feed_published_at:string|null;imported_count:number;updated_count:number};
export type Assignment = { id: string; member_id: string; points: number; title: string; definition_id?:string|null; group_id?:string|null };
export type DataView = 'dashboard' | 'duties' | 'team' | 'teams' | 'management' | 'report' | 'matches' | 'managed-matches' | 'planning' | 'settings' | 'notifications' | 'profile';
// React cache is request-scoped: never share member data across users or requests.
export const getData = cache(async (view: DataView = 'dashboard',requestedMonth?:string) => {
  if (!configured()) redirect('/login?error=' + encodeURIComponent('De applicatie is nog niet ingesteld. Neem contact op met de beheerder.'));
  const db = await supabase();
  // Verifies signature and expiry locally with cached public keys on asymmetric
  // projects. Supabase falls back to getUser for legacy symmetric signing keys.
  const { data: identity, error: identityError } = await db.auth.getClaims();
  if (identityError || !identity?.claims.sub) redirect('/login');
  const memberId = identity.claims.sub;
  const [profileResult, seasonResult] = await Promise.all([
    db.from('profiles').select('*').eq('id', memberId).single(),
    db.from('seasons').select('*').eq('active', true).maybeSingle(),
  ]);
  const profile = profileResult.data as Profile | null;
  if (profileResult.error || !profile) throw new Error('Je account heeft nog geen ledenprofiel. Neem contact op met de beheerder.');
  if (seasonResult.error) throw new Error('Het actieve seizoen kon niet worden geladen. Controleer de database-inrichting.');
  if ((view === 'management' || view === 'report' || view === 'settings' || view === 'teams' || view === 'managed-matches' || view==='planning') && profile.role === 'member') redirect('/');
  const season = seasonResult.data as Season | null;
  const seasonId = season?.id ?? '00000000-0000-0000-0000-000000000000';
  const teamView = ['team', 'teams', 'management', 'report','managed-matches','planning'].includes(view);
  const needDuties = view !== 'matches' && view !== 'settings' && view !== 'notifications' && view !== 'profile' && view !== 'teams';
  const month=view==='planning'?planningMonth(requestedMonth,season):null;
  const managedDuties=['management','managed-matches','planning'].includes(view);
  const needAssignments = ['dashboard', 'team', 'management', 'report'].includes(view);
  const empty = Promise.resolve({ data: [], error: null });
  let enrollmentQuery = db.from('enrollments').select('*, duties!inner(season_id)').eq('duties.season_id', seasonId);
  let membershipQuery = db.from('memberships').select('*').eq('season_id', seasonId);
  if (!teamView) {
    enrollmentQuery = enrollmentQuery.eq('member_id', memberId);
    membershipQuery = membershipQuery.eq('member_id', memberId);
  }
  let assignmentQuery = db.from('function_assignments').select('*',{count:'exact'}).eq('season_id', seasonId).order('id');
  if (!teamView) assignmentQuery = assignmentQuery.eq('member_id', memberId);
  const results = await Promise.all([
    managedDuties?collectPages<Duty>(async(from,to)=>{let q=db.from('duties').select('*',{count:'exact'}).eq('season_id',seasonId);if(month)q=q.lt('starts_at',month.end).gt('ends_at',month.start);const r=await q.order('starts_at').order('id').range(from,to);return {data:r.data as Duty[]|null,count:r.count,error:r.error};}):needDuties ? db.from('duties').select('*').eq('season_id', seasonId).order('starts_at') : empty,
    managedDuties?collectPages<Enrollment>(async(from,to)=>{let q=db.from('enrollments').select('*, duties!inner(season_id)',{count:'exact'}).eq('duties.season_id',seasonId);if(month)q=q.lt('duties.starts_at',month.end).gt('duties.ends_at',month.start);const r=await q.order('id').range(from,to);return {data:r.data as Enrollment[]|null,count:r.count,error:r.error};}):needDuties ? enrollmentQuery : empty,
    db.from('teams').select('*').eq('season_id', seasonId),
    (view==='teams'||managedDuties)?collectPages<Membership>(async(from,to)=>{const r=await db.from('memberships').select('*',{count:'exact'}).eq('season_id',seasonId).order('member_id').range(from,to);return {data:r.data as Membership[]|null,count:r.count,error:r.error};}):membershipQuery,
    (view==='teams'||managedDuties)?collectPages<Profile>(async(from,to)=>{const r=await db.from('profiles').select('*',{count:'exact'}).order('last_name').order('id').range(from,to);return {data:r.data as Profile[]|null,count:r.count,error:r.error};}):teamView ? db.from('profiles').select('*').order('last_name') : Promise.resolve({ data: [profile], error: null }),
    needAssignments ? collectPages<Assignment>(async(from,to)=>{const r=await assignmentQuery.range(from,to);return {data:r.data as Assignment[]|null,count:r.count,error:r.error};}).catch(()=>{throw new Error('Functietoekenningen konden niet volledig worden opgehaald. Probeer opnieuw.');}) : empty,
    ['management','planning','team'].includes(view)?collectPages<Match>(async(from,to)=>{const r=await db.from('matches').select('id,home_team,away_team,starts_at,status,cancelled,location,level,club_referee',{count:'exact'}).eq('season_id',seasonId).in('status',['scheduled','played']).eq('cancelled',false).order('starts_at').order('id').range(from,to);return {data:r.data as Match[]|null,count:r.count,error:r.error};}):['matches','managed-matches'].includes(view) ? collectPages<Match>(async(from,to)=>{const r=await db.from('matches').select('*, referee_duties:duties(id,kind,cancelled,points,assigned_team_id)',{count:'exact'}).eq('season_id',seasonId).order('starts_at',{nullsFirst:false}).order('id').range(from,to);return {data:r.data as Match[]|null,count:r.count,error:r.error};}) : empty,
    needDuties && view !== 'report' && view!=='planning' ? db.rpc('duty_availability') : empty,
    view === 'management' ? db.from('function_definitions').select('*').eq('season_id', seasonId) : empty,
    db.from('notifications').select('id',{count:'exact',head:true}).eq('member_id',memberId).is('read_at',null),
    ['matches','managed-matches'].includes(view) ? db.from('nevobo_sync_state').select('last_started_at,last_success_at,last_error_code,feed_published_at,imported_count,updated_count') : empty,
  ]);
  if (results.slice(0,9).some(r => r.error)) throw new Error('Gegevens konden niet worden opgehaald. Controleer de migratie en toegangsrechten.');
  return { profile, season,
    duties: results[0].data as Duty[], enrollments: results[1].data as Enrollment[], teams: results[2].data as Team[],
    memberships: results[3].data as Membership[], profiles: results[4].data as Profile[], assignments: results[5].data as Assignment[], matches: results[6].data as Match[], availability: results[7].data as { duty_id: string; occupied: number; offered_ids: string[] }[], functions: results[8].data as FunctionDefinition[], unreadNotifications:results[9].error?null:(results[9] as {count?:number|null}).count ?? null, syncState:results[10].error?null:(results[10].data?.[0] as SyncState|undefined) ?? null };
});

export type AppData = Awaited<ReturnType<typeof getData>>;
export type DutyParticipant={duty_id:string;first_name:string;last_name:string};
export async function getDutyParticipants():Promise<DutyParticipant[]|null> {
 const db=await supabase();
 try {
  return (await collectPages<DutyParticipant>(async(from,to)=>{
   const r=await db.rpc('duty_participants',{}, {count:'exact'}).order('duty_id').order('first_name').order('last_name').range(from,to);
   return {data:r.data as DutyParticipant[]|null,count:r.count,error:r.error};
  })).data;
 } catch {return null;}
}
export function memberProgress(data: AppData, memberId: string) {
  const membership = data.memberships.find(m => m.member_id === memberId);
  const team = data.teams.find(t => t.id === membership?.team_id);
  const s = data.season;
  const norm = membership?.norm_override ?? (team?.age_class === 'youth' ? s?.youth_norm : s?.senior_norm) ?? s?.default_norm ?? 0;
  const owned = data.enrollments.filter(e => e.member_id === memberId && !e.revoked);
  let earned = data.assignments.filter(a => a.member_id === memberId).reduce((n, a) => n + Number(a.points), 0), planned = 0;
  for (const e of owned) {
    const d = data.duties.find(d => d.id === e.duty_id && !d.cancelled);
    if (!d || d.credit_blocked) continue;
    if (new Date(d.ends_at) <= new Date()) earned += Number(d.points); else planned += Number(d.points);
  }
  return progress(Number(norm), earned, planned);
}
