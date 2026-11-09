import Link from 'next/link';
import { getData,memberProgress } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { SeasonSection } from '@/components/management/sections';
export default async function Management({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams;
 const members=data.profiles.filter(p=>p.role==='member'||data.memberships.some(m=>m.member_id===p.id));
 const unassigned=members.filter(p=>!data.memberships.some(m=>m.member_id===p.id)).length;
 const deficits=data.profiles.filter(p=>data.memberships.some(m=>m.member_id===p.id)&&memberProgress(data,p.id).toEarn>0).length;
 const future=data.duties.filter(d=>!d.cancelled&&!d.signup_closed&&new Date(d.starts_at)>new Date());
 const openPlaces=future.reduce((total,d)=>total+Math.max(0,d.capacity-data.enrollments.filter(e=>e.duty_id===d.id&&!e.revoked).length),0);
 const metrics=[['Leden',members.length],['Teams',data.teams.length],['Komende diensten',future.length],['Open plaatsen',openPlaces],['Onder de norm',deficits]] as const;
 const areas=[['/beheer/leden','Leden','Teamindeling, scheidsrechtersniveau en persoonlijke norm'],['/beheer/teams','Teams','Competitieniveaus en clubscheidsrechters'],['/beheer/planning','Planning','Diensten aanmaken, toewijzen en corrigeren'],['/beheer/wedstrijden','Wedstrijden','Nevobo-programma, fluitdiensten en wijzigingslog'],['/beheer/functies','Functies','Vrijwilligersfuncties en vaste punten'],['/beheer/rapportage','Rapportage','Punten, tekorten en CSV-export'],['/beheer/seizoenen','Seizoenen','Periodes, normen en actief seizoen'],['/beheer/instellingen','Instellingen','Huisstijl en wedstrijdkoppeling']];
 return <Shell data={data}><Heading title="Beheerdashboard"/><Notice params={params}/>
 <section className="points-summary" aria-labelledby="beheer-overzicht"><div className="section-heading"><h2 id="beheer-overzicht">{data.season?.name ?? 'Geen actief seizoen'}</h2><span className="muted">Huidige administratie</span></div><dl className="stats-grid">{metrics.map(([label,value])=><div className="stat-item" key={label}><dt>{label}</dt><dd>{data.season?value:'—'}</dd></div>)}</dl></section>
 <div className="admin-grid management-dashboard"><SeasonSection data={data}/><section className="panel management-attention"><h2>Opvolgen</h2>{data.season?<><Link href="/beheer/leden?team=none"><span>Leden zonder teamindeling</span><strong>{unassigned}</strong></Link><Link href="/beheer/planning"><span>Open plaatsen in komende diensten</span><strong>{openPlaces}</strong></Link><Link href="/beheer/rapportage?deficit=1"><span>Leden met nog te behalen punten</span><strong>{deficits}</strong></Link></>:<p className="muted">Activeer een seizoen om leden, teams en planning te beheren.</p>}</section></div>
 <section className="panel"><h2>Beheeronderdelen</h2><div className="management-links">{areas.map(([href,title,description])=><Link key={href} href={href}><span><strong>{title}</strong><small>{description}</small></span><span aria-hidden="true">→</span></Link>)}</div></section>
 </Shell>;
}
