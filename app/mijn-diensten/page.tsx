import Link from 'next/link';
import { getData } from '@/lib/data';
import { ownDutyEntries } from '@/lib/member-duties';
import { kindLabels } from '@/lib/domain';
import { Shell } from '@/components/shell';
import { DutyCard,Heading,Notice,date,time } from '@/components/ui';
export default async function MyDuties({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('duties'),params=await searchParams,history=params.view==='history',now=new Date();
 const entries=ownDutyEntries(data).filter(({duty:d})=>(history?new Date(d.ends_at)<=now:new Date(d.ends_at)>now)&&(!params.match||d.match_id===params.match)&&(!params.kind||d.kind===params.kind)).sort((a,b)=>history?b.duty.starts_at.localeCompare(a.duty.starts_at):a.duty.starts_at.localeCompare(b.duty.starts_at));
 return <Shell data={data}><Heading title="Mijn diensten"><Link className="button secondary" href="/diensten">Open diensten</Link></Heading><Notice params={params}/><div className="filter-bar"><div className="tabs"><Link href="/mijn-diensten" className={!history?'selected':''} aria-current={!history?'page':undefined}>Komend</Link><Link href="/mijn-diensten?view=history" className={history?'selected':''} aria-current={history?'page':undefined}>Afgelopen</Link></div><span className="muted small">{data.season?.name ?? 'Geen actief seizoen'}</span></div>
 <section className="duty-list">{entries.map(({duty:d,enrollment:e})=>d.cancelled||e.revoked?<article className="duty-card own-duty-inactive" key={d.id}><div className="duty-main"><h3>{d.title}</h3><div className="duty-meta"><span className="badge">{kindLabels[d.kind]}</span><span>{d.location}</span></div></div><div className="duty-when">{date(d.starts_at)}<small>{time(d.starts_at)}–{time(d.ends_at)}</small></div><div className="duty-points"><strong>0</strong><small>punten</small></div><div className="duty-actions"><span>{d.cancelled?'Geannuleerd':'Inschrijving ingetrokken'}</span>{e.revoked_reason&&<small>{e.revoked_reason}</small>}</div></article>:<DutyCard key={d.id} duty={d} data={data}/>)}{!entries.length&&<p className="empty-state">{history?'Je hebt geen afgelopen diensten in dit seizoen.':'Je hebt geen komende diensten.'}</p>}</section></Shell>;
}
