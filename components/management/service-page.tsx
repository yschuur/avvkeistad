import Link from 'next/link';
import { getData } from '@/lib/data';
import { getDutySettings } from '@/lib/duty-settings';
import { Shell } from '@/components/shell';
import { Heading,Notice,date,time } from '@/components/ui';
import { DutyCreateSection } from '@/components/management/sections';
export default async function ServicePage({kind,title,path,searchParams}:{kind:'bar'|'event'|'other';title:string;path:string;searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams,settings=await getDutySettings();
 const duties=data.duties.filter(d=>d.kind===kind||(kind==='other'&&d.kind==='lines'));
 return <Shell data={data}><Heading title={title}/><Notice params={params}/><p className="field-help">Kies zelf een naam voor de dienst. Punten worden berekend op basis van de duur: 1 uur = 1 punt per deelnemer.</p><DutyCreateSection data={data} refereePoints={settings.refereePoints} fixedKind={kind} returnTo={path}/><section className="panel"><h2>Aangemaakte {title.toLowerCase()}</h2>{duties.map(d=><div className="correction-row" key={d.id}><span><strong>{d.title}</strong><small>{date(d.starts_at)} · {time(d.starts_at)}–{time(d.ends_at)} · {d.location} · {d.cancelled?'Geannuleerd':`${d.points} punten p.p.`}</small></span><Link className="button secondary" href="/beheer/planning">Beheren in Planning</Link></div>)}{!duties.length&&<p className="empty-state">Nog geen diensten van dit type aangemaakt in dit seizoen.</p>}</section></Shell>;
}
