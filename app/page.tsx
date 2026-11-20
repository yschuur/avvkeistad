import Link from 'next/link';
import { Award,CalendarDays,Clock3,Plus,ArrowRight } from 'lucide-react';
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
 const groups=data.assignments.filter(a=>a.member_id===data.profile.id&&a.group_id).sort((a,b)=>a.title.localeCompare(b.title,'nl'));
 const groupPoints=groups.reduce((total,a)=>total+Number(a.points),0),formatPoints=(value:number)=>new Intl.NumberFormat('nl-NL',{maximumFractionDigits:2}).format(value);
 return <Shell data={data}><Heading title="Mijn overzicht"><Link href="/diensten" className="button"><Plus size={23} aria-hidden="true"/>Open diensten</Link></Heading><Notice params={params}/>
 <div className="dashboard-layout">
 <section className="dashboard-metrics" aria-label="Puntenoverzicht">
  <div className="dashboard-score"><div className="score-header"><h2><Award size={28} aria-hidden="true"/>Mijn punten</h2>{!known&&<span className="score-context">{data.season?'Nog geen teamindeling':'Geen actief seizoen'}</span>}</div><dl><dt className="sr-only">Behaald</dt><dd className="metric-number score-ratio">{known?<><span>{p.earned}</span><span className="metric-target">/{p.norm}</span><span className="metric-unit">punten</span></>:'—'}</dd></dl>{known&&<PointsProgress earned={p.earned} planned={p.planned} norm={p.norm}/>}</div>
  <div className="dashboard-metric"><h2><CalendarDays size={28} aria-hidden="true"/>Ingepland</h2><dl><dt className="sr-only">Ingepland</dt><dd className="metric-number">{known?p.planned:'—'}</dd></dl></div>
  <div className="dashboard-metric"><h2><Clock3 size={28} aria-hidden="true"/>Nog te behalen</h2><dl><dt className="sr-only">Nog te behalen</dt><dd className="metric-number">{known?p.toEarn:'—'}</dd></dl></div>
 </section>

 <section className="list-section dashboard-section"><div className="section-heading"><h2>Mijn volgende dienst</h2><Link href="/mijn-diensten">Mijn diensten <ArrowRight size={20} aria-hidden="true"/></Link></div><div className="duty-list">{own.length?own.slice(0,1).map(({duty})=><DutyCard key={duty.id} duty={duty} data={data} compact/>):<p className="empty-state">Je hebt geen komende diensten.</p>}</div><p className="small history-link"><Link href="/mijn-diensten?view=history">Afgelopen diensten bekijken</Link></p></section>
 <section className="list-section dashboard-section"><div className="section-heading"><h2>Open diensten voor mij</h2><Link href="/diensten">Alle open diensten <ArrowRight size={20} aria-hidden="true"/></Link></div><div className="duty-list">{available.length?available.slice(0,3).map(d=><DutyCard key={d.id} duty={d} data={data}/>):<p className="empty-state">Er zijn nu geen passende open diensten.</p>}</div></section>
 <section className="panel member-function-groups" aria-labelledby="my-function-groups-heading"><div className="section-heading"><h2 id="my-function-groups-heading">Mijn functiegroepen</h2>{data.season&&<span className="muted small">{data.season.name}</span>}</div>
 {groups.length?<><ul className="member-group-credits">{groups.map(group=><li key={group.id}><span>{group.title}</span><strong>{formatPoints(Number(group.points))} punten</strong></li>)}</ul><p className="member-group-total">Totaal ontvangen: <strong>{formatPoints(groupPoints)} punten</strong></p><p className="field-help">Deze punten zijn al opgenomen in Behaald.</p></>:<p className="muted small">{data.season?'Je bent dit seizoen niet ingedeeld in een functiegroep.':'Er is geen actief seizoen.'}</p>}
 </section>
 </div></Shell>;
}
