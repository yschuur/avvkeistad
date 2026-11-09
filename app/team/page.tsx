import { redirect } from 'next/navigation';
import { getData,memberProgress } from '@/lib/data';
import { teamDutyCandidates } from '@/lib/member-duties';
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
  const duties=data.duties.filter(d=>d.assigned_team_id===t.id&&!d.cancelled&&!d.signup_closed&&new Date(d.starts_at)>new Date()&&(data.availability.find(a=>a.duty_id===d.id)?.occupied ?? 0)<d.capacity);
  return <section key={t.id} className="panel"><h2>{t.name}</h2><dl className="stats-grid member-stats team-points">{[['Behaald',scores.reduce((n,p)=>n+p.earned,0)],['Ingepland',scores.reduce((n,p)=>n+p.planned,0)],['Nog te behalen',scores.reduce((n,p)=>n+p.toEarn,0)]].map(([label,value])=><div className="stat-item" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  <div className="table-wrap" role="region" aria-label="Teampunten" tabIndex={0}><table><thead><tr><th>Lid</th><th className="numeric">Norm</th><th className="numeric">Behaald</th><th className="numeric">Ingepland</th><th className="numeric">Nog te behalen</th></tr></thead><tbody>{members.map(m=>{const p=data.profiles.find(p=>p.id===m.member_id),points=memberProgress(data,m.member_id);return <tr key={m.member_id}><td>{p?.first_name} {p?.last_name}{m.captain&&<span className="captain-tag">Aanvoerder</span>}</td><td className="numeric">{points.norm}</td><td className="numeric">{points.earned}</td><td className="numeric">{points.planned}</td><td className="numeric">{points.toEarn}</td></tr>;})}</tbody></table></div>
  <h3 className="subheading">Teamdiensten toewijzen</h3>{!duties.length&&<p className="empty-state">Geen openstaande teamdiensten.</p>}{duties.map(d=>{const candidates=teamDutyCandidates(data,d,t.id),count=data.availability.find(a=>a.duty_id===d.id)?.occupied ?? 0;return <form action={enroll} key={d.id} className="correction-row"><input name="duty_id" type="hidden" value={d.id}/><input name="return_to" type="hidden" value="/team"/><span><strong>{d.title}</strong><small>{date(d.starts_at)} · {time(d.starts_at)}–{time(d.ends_at)} · {d.location} · {count}/{d.capacity} gevuld</small>{d.kind==='referee'&&<small>Minimaal {d.required_qualification ?? 'nog in te stellen'}</small>}{!candidates.length&&<small>Geen beschikbaar teamlid met het juiste niveau.</small>}</span><select name="member_id" required aria-label="Teamlid toewijzen" disabled={!candidates.length}><option value="">Kies een teamlid</option>{candidates.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select><SubmitButton className="button secondary" disabled={!candidates.length}>Toewijzen</SubmitButton></form>;})}</section>;
 })}</Shell>;
}
