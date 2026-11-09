import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getData,memberProgress } from '@/lib/data';
import { openMemberDuties,ownDutyEntries } from '@/lib/member-duties';
import { Shell } from '@/components/shell';
import { DutyCard,Heading,Notice,PointsProgress } from '@/components/ui';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData(),params=await searchParams;
 if(params.password) redirect('/profiel?password=1');
 const p=memberProgress(data,data.profile.id),now=new Date(),membership=data.memberships.find(m=>m.member_id===data.profile.id);
 const own=ownDutyEntries(data).filter(({duty:d,enrollment:e})=>!d.cancelled&&!e.revoked&&new Date(d.ends_at)>now).sort((a,b)=>a.duty.starts_at.localeCompare(b.duty.starts_at));
 const available=openMemberDuties(data,now),known=Boolean(data.season&&membership);
 const metrics=[['Behaald',p.earned],['Ingepland',p.planned],['Nog te behalen',p.toEarn]] as const;
 return <Shell data={data}><Heading title="Mijn overzicht"><Link href="/diensten" className="button">Open diensten</Link></Heading><Notice params={params}/>
 <section className="points-summary" aria-labelledby="points-heading"><div className="section-heading"><h2 id="points-heading">Mijn punten</h2><span className="muted">{known?`Doel: ${p.norm} punten`:data.season?'Nog geen teamindeling':'Geen actief seizoen'}</span></div><dl className="stats-grid member-stats">{metrics.map(([label,value])=><div key={label} className="stat-item"><dt>{label}</dt><dd>{known?value:'—'}</dd></div>)}</dl>{known&&<PointsProgress earned={p.earned} planned={p.planned} norm={p.norm}/>}</section>
 <section className="list-section"><div className="section-heading"><h2>Mijn volgende dienst</h2><Link href="/mijn-diensten">Mijn diensten</Link></div><div className="duty-list">{own.length?own.slice(0,1).map(({duty})=><DutyCard key={duty.id} duty={duty} data={data} compact/>):<p className="empty-state">Je hebt geen komende diensten.</p>}</div><p className="small history-link"><Link href="/mijn-diensten?view=history">Afgelopen diensten bekijken</Link></p></section>
 <section className="list-section"><div className="section-heading"><h2>Open diensten voor mij</h2><Link href="/diensten">Alle open diensten</Link></div><div className="duty-list">{available.length?available.slice(0,3).map(d=><DutyCard key={d.id} duty={d} data={data}/>):<p className="empty-state">Er zijn nu geen passende open diensten.</p>}</div></section>
 </Shell>;
}
