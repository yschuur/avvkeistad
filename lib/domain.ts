export type Role = 'admin' | 'manager' | 'member';
export type Duty = {
  id: string; title: string; kind: 'bar' | 'referee' | 'event' | 'lines' | 'other';
  starts_at: string; ends_at: string; points: number; capacity: number;
  location: string; required_level: number; assigned_team_id: string | null; slot_team_ids?:(string|null)[]|null;
  required_qualification?:string|null;cancelled: boolean; signup_closed?:boolean;credit_blocked?:boolean;match_id?:string|null;
};
export type Enrollment = { slot_number?:number|null; id: string; duty_id: string; member_id: string; created_at: string; offered: boolean; revoked: boolean; revoked_reason?:string|null };
export type Profile = { id: string; first_name: string; last_name: string; email: string; role: Role; referee_level: number; referee_qualification?:string|null; nevobo_code: string | null };
export function canWithdraw(joinedAt: string, startsAt: string, now = new Date()) {
  const elapsed = now.getTime() - new Date(joinedAt).getTime();
  return elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000 && now < new Date(startsAt);
}
export function overlaps(a: Pick<Duty, 'starts_at' | 'ends_at'>, b: Pick<Duty, 'starts_at' | 'ends_at'>) {
  return new Date(a.starts_at) < new Date(b.ends_at) && new Date(b.starts_at) < new Date(a.ends_at);
}
export function progress(norm: number, earned: number, planned: number) {
  return { norm, earned, planned, toPlan: Math.max(0, norm - earned - planned), toEarn: Math.max(0, norm - earned) };
}
export const kindLabels = { bar: 'Bardienst', referee: 'Fluitdienst', event: 'Evenement', lines: 'Vlaggen', other: 'Overige dienst' };
