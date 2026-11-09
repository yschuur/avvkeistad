import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getData } from '@/lib/data';
import { openMemberDuties } from '@/lib/member-duties';
import { Shell } from '@/components/shell';
import { DutyCard,Heading,Notice } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
export default async function Duties({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('duties'),params=await searchParams;
 if(params.view==='mine') {const query=new URLSearchParams();for(const key of ['match','kind','success','error']) if(params[key]) query.set(key,params[key]!);redirect('/mijn-diensten'+(query.size?'?'+query:''));}
 const duties=openMemberDuties(data).filter(d=>(!params.match||d.match_id===params.match)&&(!params.kind||d.kind===params.kind));
 return <Shell data={data}><Heading title="Open diensten"/><Notice params={params}/><div className="filter-bar"><p className="muted small">{duties.length} open diensten voor jou</p><form><label className="sr-only" htmlFor="member-duty-kind">Type dienst</label><select id="member-duty-kind" name="kind" defaultValue={params.kind ?? ''}><option value="">Alle soorten</option><option value="bar">Bardiensten</option><option value="referee">Fluitdiensten</option><option value="event">Evenementen</option><option value="lines">Vlaggen</option></select>{params.match&&<input name="match" type="hidden" value={params.match}/>}<SubmitButton className="button secondary">Filteren</SubmitButton></form></div>
 <section className="duty-list">{duties.map(d=><DutyCard key={d.id} duty={d} data={data}/>)}{!duties.length&&<p className="empty-state">Er zijn nu geen passende open diensten.</p>}</section><p className="muted small">Je ziet diensten die passen bij je team, planning en scheidsrechtersniveau. Je inschrijvingen staan bij <Link href="/mijn-diensten">Mijn diensten</Link>.</p></Shell>;
}
