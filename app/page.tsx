import { SubmitButton } from '@/components/submit-button';
import Link from 'next/link';
import { getData, memberProgress } from '@/lib/data';
import { Shell } from '@/components/shell';
import { DutyCard, Heading, Notice } from '@/components/ui';
import { setPassword } from './actions';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const data=await getData(),params=await searchParams,p=memberProgress(data,data.profile.id);
  const membership=data.memberships.find(m=>m.member_id===data.profile.id);
  const team=data.teams.find(t=>t.id===membership?.team_id);
  const own=data.duties.filter(d=>!d.cancelled && new Date(d.ends_at)>new Date() && data.enrollments.some(e=>e.duty_id===d.id && e.member_id===data.profile.id && !e.revoked));
  const available=data.duties.filter(d=>!d.cancelled && !d.signup_closed && new Date(d.starts_at)>new Date() && !own.includes(d)).slice(0,3);
  const known=Boolean(data.season && membership);
  const metrics=[['Norm',p.norm],['Behaald',p.earned],['Ingepland',p.planned],['Nog in te plannen',p.toPlan],['Nog te behalen',p.toEarn]] as const;
  return <Shell data={data}><Heading title="Mijn overzicht"><Link href="/diensten" className="button">Diensten bekijken</Link></Heading><Notice params={params}/>
    {params.password && <section className="panel"><h2>Wachtwoord instellen</h2><form action={setPassword} className="inline-form"><label>Nieuw wachtwoord (minimaal 12 tekens)<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password"/></label><SubmitButton className="button">Wachtwoord instellen</SubmitButton></form></section>}
    <section className="points-summary" aria-labelledby="points-heading"><div className="section-heading"><h2 id="points-heading">Punten dit seizoen</h2><span className="muted">{team?.name ?? (data.season?'Geen team gekoppeld':'Geen actief seizoen')}</span></div><dl className="stats-grid">{metrics.map(([label,value])=><div key={label} className="stat-item"><dt>{label}</dt><dd>{known?value:'—'}</dd></div>)}</dl>
      {known && p.norm>0 && <div className="progress-summary"><div className="progress-track" role="img" aria-label={`${p.earned} punten behaald, ${p.planned} ingepland van ${p.norm} vereist`}><span className="progress-earned" style={{width:`${Math.min(100,p.earned/p.norm*100)}%`}}/><span className="progress-planned" style={{width:`${Math.min(Math.max(0,100-p.earned/p.norm*100),p.planned/p.norm*100)}%`}}/></div><span className="progress-legend"><i/>Behaald <i/>Ingepland</span></div>}
    </section>
    <section className="list-section"><div className="section-heading"><h2>Mijn planning <span className="count">{own.length}</span></h2><Link href="/diensten?view=mine">Alles bekijken</Link></div><div className="duty-list">{own.length?own.slice(0,2).map(d=><DutyCard key={d.id} duty={d} data={data} compact/>):<p className="empty-state">Geen diensten ingepland.</p>}</div></section>
    <section className="list-section"><div className="section-heading"><h2>Beschikbare diensten</h2><Link href="/diensten">Alle diensten</Link></div><div className="duty-list">{available.length?available.map(d=><DutyCard key={d.id} duty={d} data={data}/>):<p className="empty-state">Geen beschikbare diensten.</p>}</div></section>
  </Shell>;
}
