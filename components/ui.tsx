import { SubmitButton } from '@/components/submit-button';
import { type AppData,type DutyParticipant } from '@/lib/data';
import { type Duty, kindLabels, canWithdraw,overlaps } from '@/lib/domain';
import { enroll, changeEnrollment } from '@/app/actions';
import { canReferee,isRefereeLevel } from '@/lib/referee-levels';
export function Notice({ params }: { params: Record<string, string | string[] | undefined> }) {
  return <>{params.error && <p role="alert" className="notice error">{params.error}</p>}{params.success && <p role="status" className="notice success">{params.success}</p>}</>;
}
export function Heading({title,description,children}:{title:string;description?:string;children?:React.ReactNode}) {
  return <div className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="heading-actions">{children}</div>}</div>;
}
export const date = (v: string) => new Intl.DateTimeFormat('nl-NL',{ day:'numeric',month:'long',timeZone:'Europe/Amsterdam' }).format(new Date(v));
export const time = (v: string) => new Intl.DateTimeFormat('nl-NL',{ hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam' }).format(new Date(v));
export function PointsProgress({earned,planned,norm}:{earned:number;planned:number;norm:number}) {
  if(norm<=0) return <p className="field-help points-no-target">Geen puntenverplichting voor dit seizoen.</p>;
  const completed=Math.max(0,Math.min(100,earned/norm*100)),scheduled=Math.max(0,Math.min(100-completed,planned/norm*100));
  return <div className="points-progress"><div className="progress-caption"><span>Voortgang naar je doel</span><strong>{Math.round(completed)}%</strong></div><div className="progress-track" role="progressbar" aria-label="Behaalde punten" aria-valuemin={0} aria-valuemax={norm} aria-valuenow={Math.max(0,Math.min(norm,earned))} aria-valuetext={`${earned} van ${norm} punten behaald, ${planned} punten ingepland`}><span className="progress-earned" style={{width:`${completed}%`}}/><span className="progress-planned" style={{width:`${scheduled}%`}}/></div><div className="progress-legend"><span><i aria-hidden="true"/>Behaald</span><span><i aria-hidden="true"/>Ingepland</span></div></div>;
}
export function DutyCard({ duty: d, data, compact=false,participants }: { duty: Duty; data: AppData; compact?: boolean; participants?:DutyParticipant[] }) {
  const e = data.enrollments.find(e=>e.duty_id===d.id && e.member_id===data.profile.id && !e.revoked);
  const availability = data.availability.find(a=>a.duty_id===d.id);
  const count = Number(availability?.occupied ?? 0);
  const takeover = availability?.offered_ids.find(id=>id!==e?.id);
  const finished = new Date(d.ends_at) <= new Date();
  const started = new Date(d.starts_at) <= new Date();
  const closed=started || d.signup_closed;
  const eligible = d.kind==='referee'?canReferee(data.profile.referee_qualification,d.required_qualification):data.profile.referee_level>=d.required_level;
  const qualificationMessage=d.kind==='referee'?isRefereeLevel(d.required_qualification)?isRefereeLevel(data.profile.referee_qualification)?`Scheidsrechtersniveau ${d.required_qualification} vereist`:'Je scheidsrechtersniveau is nog niet ingesteld':'De beheerder moet het vereiste niveau instellen':'Neem contact op met de beheerder over je bevoegdheid';
  const ownTeam = data.memberships.find(m=>m.member_id===data.profile.id)?.team_id;
  const conflict=data.enrollments.some(e=>e.member_id===data.profile.id&&!e.revoked&&e.duty_id!==d.id&&data.duties.some(other=>other.id===e.duty_id&&!other.cancelled&&overlaps(d,other)));
  const teamAllowed = !d.assigned_team_id || d.assigned_team_id===ownTeam;
  return <article className={`duty-card ${compact?'compact':''}`} aria-labelledby={`duty-${d.id}`}>
    <div className="duty-main"><h3 id={`duty-${d.id}`}>{d.title}</h3><div className="duty-meta"><span className="badge">{kindLabels[d.kind]}</span>{d.kind==='referee' && <span>{isRefereeLevel(d.required_qualification)?`Niveau ${d.required_qualification}`:'Niveau nog niet ingesteld'}</span>}<span>{d.location}</span>{d.assigned_team_id && <span>{data.teams.find(t=>t.id===d.assigned_team_id)?.name ?? 'Teamdienst'}</span>}</div></div>
    <div className="duty-when"><span>{date(d.starts_at)}</span><small>{time(d.starts_at)}–{time(d.ends_at)}</small></div>
    <div className="duty-capacity"><span>{count} / {d.capacity}</span><small>plaatsen gevuld</small></div><div className="duty-points"><strong>{d.points}</strong><small>punten p.p.</small></div>
    <div className="duty-actions">{e?<><span className={`enrolled-label ${finished && !d.credit_blocked?'completed':''}`}>{d.credit_blocked?'Planning niet bevestigd':finished?'Punten behaald':e.offered?'Ter overname':'Ingepland'}</span>{!started && !d.cancelled && !compact && <form action={changeEnrollment}><input type="hidden" name="return_to" value="/mijn-diensten"/><input type="hidden" name="enrollment_id" value={e.id}/>{canWithdraw(e.created_at,d.starts_at) && <SubmitButton className="text-button" name="action" value="withdraw">Afmelden</SubmitButton>}<SubmitButton className="text-button" name="action" value={e.offered?'unoffer':'offer'}>{e.offered?'Aanbod intrekken':'Ter overname aanbieden'}</SubmitButton></form>}</>:<><span className="duty-availability">{d.cancelled?'Geannuleerd':closed?'Inschrijving gesloten':!ownTeam?'Je hebt nog geen teamindeling':!eligible?qualificationMessage:conflict?'Overlapt met een eigen dienst':!teamAllowed?'Gereserveerd voor een ander team':takeover?'Ter overname':count>=d.capacity?'Vol':`${Math.max(0,d.capacity-count)} beschikbaar`}</span>{!closed && !d.cancelled && <form action={enroll}><input type="hidden" name="return_to" value="/mijn-diensten"/><input type="hidden" name="duty_id" value={d.id}/>{takeover && <input type="hidden" name="takeover_id" value={takeover}/>}<SubmitButton className="button small-button" disabled={!ownTeam || conflict || !eligible || !teamAllowed || (!takeover && count>=d.capacity)}>{takeover?'Overnemen':'Inschrijven'}</SubmitButton></form>}</>}</div>
    {participants&&<p className="duty-participants">{participants.length?`Ingepland: ${participants.map(p=>`${p.first_name} ${p.last_name}`).join(', ')}`:count>0?'Deelnemers niet beschikbaar.':'Nog niemand ingepland.'}</p>}
    {e?.offered && (!finished || d.credit_blocked) && !compact && <p className="responsibility">Je blijft verantwoordelijk totdat iemand jouw dienst overneemt.</p>}
  </article>;
}
