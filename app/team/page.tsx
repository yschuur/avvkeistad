import { SubmitButton } from '@/components/submit-button';
import { redirect } from 'next/navigation';
import { getData, memberProgress } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading, date } from '@/components/ui';
import { enroll } from '@/app/actions';
export default async function TeamPage() {
  const data = await getData('team'); const management = data.profile.role!=='member';
  const teams = data.teams.filter(t=>management || data.memberships.some(m=>m.member_id===data.profile.id && m.captain && m.team_id===t.id));
  if(!management && !teams.length) redirect('/');
  return <Shell data={data}><Heading eyebrow="MET ELKAAR, VOOR ELKAAR" title="De inzet van jouw team" description="Bekijk de voortgang en verdeel teamdiensten onder je teamleden."/>{teams.map(t=>{const members=data.memberships.filter(m=>m.team_id===t.id);return <section key={t.id} className="panel"><h2>{t.name}</h2><div className="table-wrap"><table><thead><tr><th>Lid</th><th>Norm</th><th>Behaald</th><th>Ingepland</th><th>Nog te behalen</th></tr></thead><tbody>{members.map(m=>{const p=data.profiles.find(p=>p.id===m.member_id);const points=memberProgress(data,m.member_id);return <tr key={m.member_id}><td>{p?.first_name} {p?.last_name}{m.captain && <span className="captain-tag">Aanvoerder</span>}</td><td>{points.norm}</td><td>{points.earned}</td><td>{points.planned}</td><td>{points.toEarn}</td></tr>;})}</tbody></table></div><h3 className="subheading">Te verdelen teamdiensten</h3>{data.duties.filter(d=>d.assigned_team_id===t.id && !d.cancelled && new Date(d.starts_at)>new Date()).map(d=>{const count=data.availability.find(a=>a.duty_id===d.id)?.occupied ?? 0;return <form action={enroll} key={d.id} className="correction-row"><input name="duty_id" type="hidden" value={d.id}/><span><strong>{d.title}</strong><small>{date(d.starts_at)} · {count}/{d.capacity} gevuld</small></span><select name="member_id" required aria-label="Teamlid toewijzen" disabled={data.demo || count>=d.capacity}>{members.map(m=>{const p=data.profiles.find(p=>p.id===m.member_id);return <option key={m.member_id} value={m.member_id}>{p?.first_name} {p?.last_name}</option>;})}</select><SubmitButton className="button secondary" disabled={data.demo || count>=d.capacity}>Toewijzen</SubmitButton></form>;})}</section>;})}</Shell>;
}
