import { SubmitButton } from '@/components/submit-button';
import { MapPin, Clock3, Users, ArrowUpRight } from 'lucide-react';
import { type AppData } from '@/lib/data';
import { type Duty, kindLabels, canWithdraw } from '@/lib/domain';
import { enroll, changeEnrollment } from '@/app/actions';
export function Notice({ params }: { params: Record<string, string | string[] | undefined> }) {
  return <>{params.error && <p role="alert" className="notice error">{params.error}</p>}{params.success && <p role="status" className="notice success">{params.success}</p>}</>;
}
export function Heading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}
export const date = (v: string) => new Intl.DateTimeFormat('nl-NL',{ day:'numeric',month:'long',timeZone:'Europe/Amsterdam' }).format(new Date(v));
export const time = (v: string) => new Intl.DateTimeFormat('nl-NL',{ hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam' }).format(new Date(v));
export function DutyCard({ duty: d, data, compact=false }: { duty: Duty; data: AppData; compact?: boolean }) {
  const e = data.enrollments.find(e=>e.duty_id===d.id && e.member_id===data.profile.id && !e.revoked);
  const availability = data.availability.find(a=>a.duty_id===d.id);
  const count = Number(availability?.occupied ?? 0);
  const takeover = availability?.offered_ids.find(id=>id!==e?.id);
  const finished = new Date(d.ends_at) <= new Date();
  const started = new Date(d.starts_at) <= new Date();
  const eligible = data.profile.referee_level >= d.required_level;
  const ownTeam = data.memberships.find(m=>m.member_id===data.profile.id)?.team_id;
  const teamAllowed = !d.assigned_team_id || d.assigned_team_id===ownTeam;
  return <article className={`duty-card ${compact ? 'compact' : ''}`}><div className="duty-card-top"><span className={`badge ${d.kind}`}>{kindLabels[d.kind]}</span><span className="points">+{d.points} <small>punten</small></span></div>
    <h3>{d.title}</h3><div className="duty-details"><span><Clock3 size={15}/>{date(d.starts_at)} · {time(d.starts_at)}–{time(d.ends_at)}</span><span><MapPin size={15}/>{d.location}</span><span><Users size={15}/>{count} / {d.capacity} plaatsen gevuld{d.assigned_team_id && ' · teamdienst'}</span></div>
    <div className="card-bottom">{e ? <><span className="enrolled-label">{finished ? '✓ Punten behaald' : e.offered ? 'Ter overname aangeboden' : '✓ Jij staat ingepland'}</span>{!started && !d.cancelled && !compact && <form action={changeEnrollment}><input type="hidden" name="enrollment_id" value={e.id}/>{canWithdraw(e.created_at,d.starts_at) && <SubmitButton className="text-button" name="action" value="withdraw" disabled={data.demo}>Afmelden</SubmitButton>}<SubmitButton className="text-button" name="action" value={e.offered?'unoffer':'offer'} disabled={data.demo}>{e.offered ? 'Aanbod intrekken' : 'Ter overname aanbieden'}</SubmitButton></form>}</> : <><span className="muted small">{d.cancelled ? 'Geannuleerd' : started ? 'Inschrijving gesloten' : !eligible ? `Bevoegdheid niveau ${d.required_level} vereist` : !teamAllowed ? 'Gereserveerd voor een ander team' : takeover ? 'Iemand zoekt een vervanger' : `${Math.max(0,d.capacity-count)} ${d.capacity-count===1?'plek':'plekken'} beschikbaar`}</span>{!started && !d.cancelled && <form action={enroll}><input type="hidden" name="duty_id" value={d.id}/>{takeover && <input type="hidden" name="takeover_id" value={takeover}/>}<SubmitButton className="button small-button" disabled={data.demo || !eligible || !teamAllowed || (!takeover && count>=d.capacity)}>{takeover ? 'Overnemen' : 'Inschrijven'}<ArrowUpRight size={15}/></SubmitButton></form>}</>}</div>
    {e?.offered && !finished && !compact && <p className="responsibility">Je blijft verantwoordelijk totdat iemand jouw dienst overneemt.</p>}
  </article>;
}
