import { redirect } from 'next/navigation';
import { configured, supabase } from './supabase/server';
import { progress, type Duty, type Profile, type Enrollment } from './domain';
export type Membership = { member_id: string; team_id: string; captain: boolean; norm_override: number | null };
export type Team = { id: string; name: string; age_class: string };
export type Match = { id: string; home_team: string; away_team: string; starts_at: string; location: string; level: string; club_referee: boolean };
export type Assignment = { id: string; member_id: string; points: number; title: string };
export async function getData() {
  if (!configured()) return demo();
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error: profileError } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (profileError || !profile) throw new Error('Je account heeft nog geen ledenprofiel. Neem contact op met de beheerder.');
  const { data: season, error } = await db.from('seasons').select('*').eq('active', true).maybeSingle();
  if (error) throw new Error('Het actieve seizoen kon niet worden geladen. Controleer de database-inrichting.');
  const seasonId = season?.id ?? '00000000-0000-0000-0000-000000000000';
  const results = await Promise.all([
    db.from('duties').select('*').eq('season_id', seasonId).order('starts_at'),
    db.from('enrollments').select('*'), db.from('teams').select('*').eq('season_id', seasonId),
    db.from('memberships').select('*').eq('season_id', seasonId), db.from('profiles').select('*').order('last_name'),
    db.from('function_assignments').select('*').eq('season_id', seasonId),
    db.from('matches').select('*').eq('season_id', seasonId).order('starts_at'),
    db.rpc('duty_availability'),
    db.from('function_definitions').select('*').eq('season_id',seasonId),
  ]);
  if (results.some(r => r.error)) throw new Error('Gegevens konden niet worden opgehaald. Controleer de migratie en toegangsrechten.');
  return { demo: false, profile: profile as Profile, season: season as Season | null,
    duties: results[0].data as Duty[], enrollments: results[1].data as Enrollment[], teams: results[2].data as Team[],
    memberships: results[3].data as Membership[], profiles: results[4].data as Profile[], assignments: results[5].data as Assignment[], matches: results[6].data as Match[], availability: results[7].data as { duty_id: string; occupied: number; offered_ids: string[] }[], functions: results[8].data as {title:string;points:number}[] };
}
type Season = { id: string; name: string; default_norm: number; youth_norm: number | null; senior_norm: number | null; starts_on: string; ends_on: string };
export type AppData = Awaited<ReturnType<typeof getData>>;
export function memberProgress(data: AppData, memberId: string) {
  const membership = data.memberships.find(m => m.member_id === memberId);
  const team = data.teams.find(t => t.id === membership?.team_id);
  const s = data.season;
  const norm = membership?.norm_override ?? (team?.age_class === 'youth' ? s?.youth_norm : s?.senior_norm) ?? s?.default_norm ?? 0;
  const owned = data.enrollments.filter(e => e.member_id === memberId && !e.revoked);
  let earned = data.assignments.filter(a => a.member_id === memberId).reduce((n, a) => n + Number(a.points), 0), planned = 0;
  for (const e of owned) {
    const d = data.duties.find(d => d.id === e.duty_id && !d.cancelled);
    if (!d) continue;
    if (new Date(d.ends_at) <= new Date()) earned += Number(d.points); else planned += Number(d.points);
  }
  return progress(Number(norm), earned, planned);
}
function demo() {
  const at = (days: number, h: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); d.setUTCHours(h, 0, 0, 0); return d.toISOString(); };
  const profile: Profile = { id: 'demo-member', first_name: 'Robin', last_name: 'van Dijk', email: 'robin@example.com', role: 'member', referee_level: 2, nevobo_code: 'DEMO123' };
  const duties: Duty[] = [
    { id: 'd1', title: 'Een gezellige avond achter de bar', kind: 'bar', starts_at: at(2, 17), ends_at: at(2, 19), points: 2, capacity: 3, location: 'Sporthal Midland · Clubhuis', required_level: 0, assigned_team_id: null, cancelled: false },
    { id: 'd2', title: 'Dames 3 – VV Utrecht DS 5', kind: 'referee', starts_at: at(4, 13), ends_at: at(4, 15), points: 2, capacity: 1, location: 'Sporthal Midland · Veld 2', required_level: 1, assigned_team_id: null, cancelled: false },
    { id: 'd3', title: 'Samen het clubtoernooi mogelijk maken', kind: 'event', starts_at: at(7, 9), ends_at: at(7, 13), points: 4, capacity: 6, location: 'Sporthal Midland', required_level: 0, assigned_team_id: null, cancelled: false },
    { id: 'd4', title: 'Bardienst met je team', kind: 'bar', starts_at: at(5, 18), ends_at: at(5, 22), points: 4, capacity: 2, location: 'Sporthal Midland · Clubhuis', required_level: 0, assigned_team_id: 't1', cancelled: false },
    { id: 'd5', title: 'Bardienst vorige week', kind: 'bar', starts_at: at(-7, 17), ends_at: at(-7, 21), points: 4, capacity: 2, location: 'Clubhuis', required_level: 0, assigned_team_id: null, cancelled: false },
  ];
  return { demo: true, profile, season: { id: 'demo-season', name: '2026 / 2027', default_norm: 20, youth_norm: 12, senior_norm: 20, starts_on: '2026-08-01', ends_on: '2027-07-31' } as Season,
    duties, enrollments: [{ id: 'e1', duty_id: 'd4', member_id: profile.id, created_at: at(-2, 10), offered: false, revoked: false }, { id: 'e2', duty_id: 'd5', member_id: profile.id, created_at: at(-9, 10), offered: false, revoked: false }, { id: 'e3', duty_id: 'd1', member_id: 'demo-other', created_at: at(-1, 10), offered: true, revoked: false }] as Enrollment[],
    teams: [{ id: 't1', name: 'Heren 3', age_class: 'senior' }], memberships: [{ member_id: profile.id, team_id: 't1', captain: true, norm_override: null }], profiles: [profile], assignments: [{ id:'f1',member_id: profile.id, points: 4, title: 'Jeugdtrainer' }], functions:[{title:'Jeugdtrainer',points:4}],
    matches: [{ id: 'm1', home_team: 'AVV Keistad Dames 3', away_team: 'VV Utrecht DS 5', starts_at: at(4, 13), location: 'Sporthal Midland', level: '2e klasse', club_referee: true }] as Match[], availability: duties.map(d => ({ duty_id: d.id, occupied: ['d1','d4','d5'].includes(d.id) ? 1 : 0, offered_ids: d.id==='d1' ? ['e3'] : [] })) };
}
