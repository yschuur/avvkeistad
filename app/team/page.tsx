import { teamSlotSummary } from '@/lib/duty-slots';
import { TableCell } from '@/components/responsive-table';
import { redirect } from 'next/navigation';
import { getData,memberProgress } from '@/lib/data';
import { teamDutyOptions } from '@/lib/member-duties';
import { refereeDescription } from '@/lib/referee-levels';
import { Shell } from '@/components/shell';
import { Heading,Notice,date,time } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { enroll } from '@/app/actions';
export default async function TeamPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('team'),params=await searchParams;
 const teams=data.teams.filter(t=>data.memberships.some(m=>m.member_id===data.profile.id&&m.captain&&m.team_id===t.id));
 if(!teams.length) redirect('/');
 return <Shell data={data}><Heading title="Mijn team"/><Notice params={params}/>{teams.map(t=>{
  const members=data.memberships.filter(m=>m.team_id===t.id),scores=members.map(m=>memberProgress(data,m.member_id));
  const duties=data.duties.filter(d=>!d.cancelled&&!d.signup_closed&&new Date(d.starts_at)>new Date()&&teamSlotSummary(d,t.id,data.availability.find(a=>a.duty_id===d.id),data.enrollments).remaining>0);
  return <section key={t.id} className="panel"><h2>{t.name}</h2><dl className="stats-grid member-stats team-points">{[['Behaald',scores.reduce((n,p)=>n+p.earned,0)],['Ingepland',scores.reduce((n,p)=>n+p.planned,0)],['Nog te behalen',scores.reduce((n,p)=>n+p.toEarn,0)]].map(([label,value])=><div className="stat-item" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  <p className="field-help team-mobile-label">Tik op een naam om de scheidsrechtersbevoegdheid te bekijken.</p><div className="table-wrap team-points-table" role="region" aria-label="Teampunten" tabIndex={0}><table role="table"><thead><tr role="row"><th>Lid</th><th className="team-qualification-column">Scheidsrechtersniveau</th><th className="numeric">Norm</th><th className="numeric">Behaald</th><th className="numeric" aria-label="Ingepland"><span className="team-desktop-label">Ingepland</span><span className="team-mobile-label" aria-hidden="true">Plan</span></th><th className="numeric" aria-label="Nog te behalen"><span className="team-desktop-label">Nog te behalen</span><span className="team-mobile-label" aria-hidden="true">Nog</span></th></tr></thead><tbody>{members.map(m=>{const p=data.profiles.find(p=>p.id===m.member_id),points=memberProgress(data,m.member_id);return <tr role="row" key={m.member_id}><TableCell label="Lid" data-featured="true"><span className="team-desktop-label">{p?.first_name} {p?.last_name}{m.captain&&<span className="captain-tag">Aanvoerder</span>}</span><details className="team-mobile-qualification"><summary tabIndex={0}>{p?.first_name} {p?.last_name}{m.captain&&<span className="captain-tag">Aanvoerder</span>}</summary><span>{refereeDescription(p?.referee_qualification)}</span></details></TableCell><TableCell label="Scheidsrechtersniveau" className="team-qualification-column">{refereeDescription(p?.referee_qualification)}</TableCell><TableCell label="Norm" className="numeric">{points.norm}</TableCell><TableCell label="Behaald" className="numeric">{points.earned}</TableCell><TableCell label="Ingepland" className="numeric">{points.planned}</TableCell><TableCell label="Nog te behalen" className="numeric">{points.toEarn}</TableCell></tr>;})}</tbody></table></div>
  <h3 className="subheading">Teamdiensten toewijzen</h3>{!duties.length&&<p className="empty-state">Geen openstaande teamdiensten.</p>}{duties.map(d=>{
   const options=teamDutyOptions(data,d,t.id),available=options.some(o=>!o.reason),summary=teamSlotSummary(d,t.id,data.availability.find(a=>a.duty_id===d.id),data.enrollments);
   return <article key={d.id} className="team-duty-block" aria-labelledby={`team-duty-heading-${d.id}`}><div className="section-heading"><h3 id={`team-duty-heading-${d.id}`}>{d.title}</h3><strong className="open-duty-count">{summary.remaining} {summary.remaining===1?'plek':'plekken'} nog toe te wijzen</strong></div>
    <p className="small muted">{date(d.starts_at)} · {time(d.starts_at)}–{time(d.ends_at)} · {d.location}</p>
    <p className="team-slot-summary">Voor {t.name}: <strong>{summary.total} {summary.total===1?'plek':'plekken'}</strong> · {summary.filled} ingevuld · {summary.remaining} open</p>
    {d.kind==='referee'&&<p className="field-help">Vereiste bevoegdheid: {refereeDescription(d.required_qualification)} of hoger</p>}
    <div className="team-slot-list">{summary.slots.map(slot=>{
     const enrollment=data.enrollments.find(e=>e.duty_id===d.id&&!e.revoked&&e.slot_number===slot.slot),member=data.profiles.find(p=>p.id===enrollment?.member_id),pickerId=`team-duty-${t.id}-${d.id}-${slot.slot}`;
     return slot.occupied?<div className="team-slot-filled" key={slot.slot}><strong>Plek {slot.slot}</strong><span>{member?`${member.first_name} ${member.last_name}`:'Ingevuld'}</span><span className="enrolled-label completed">Toegewezen</span></div>:<form action={enroll} key={slot.slot} className="correction-row team-duty-assignment">
      <input name="duty_id" type="hidden" value={d.id}/><input name="return_to" type="hidden" value="/team"/>{d.slot_team_ids!==undefined&&<input name="slot_number" type="hidden" value={slot.slot}/>}
      <span><strong>Plek {slot.slot}</strong><small>Nog geen teamlid toegewezen</small></span>
      <div className="team-duty-picker"><label htmlFor={pickerId}>{summary.total===1?'Teamlid toewijzen':`Teamlid voor plek ${slot.slot}`}</label><select id={pickerId} name="member_id" required disabled={!available}><option value="">Kies een teamlid</option>{options.map(({profile:p,reason})=><option key={p.id} value={p.id} disabled={Boolean(reason)}>{p.first_name} {p.last_name}{reason?` — ${reason}`:''}</option>)}</select></div>
      <SubmitButton className="button secondary" disabled={!available}>Toewijzen</SubmitButton>{!available&&<p className="field-help">Geen beschikbaar teamlid dat deze dienst mag uitvoeren.</p>}
     </form>;
    })}</div>
   </article>;
  })}</section>;
 })}</Shell>;
}
