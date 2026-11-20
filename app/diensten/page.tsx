import { InfoButton } from '@/components/info-button';
import { memberHelp } from '@/lib/member-help';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { memberDutyIndex } from '@/lib/duty-loading';
import { DutyDay } from '@/components/duty-day';
import { listedMemberDuties,groupDutiesByDay,dutyVacancy } from '@/lib/member-duties';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
export default async function Duties({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const params=await searchParams;
 if(params.view==='mine') {const query=new URLSearchParams();for(const key of ['match','kind','success','error']) if(params[key]) query.set(key,params[key]!);redirect('/mijn-diensten'+(query.size?'?'+query:''));}
 const filters={kind:params.kind,team:params.team,match:params.match,open:params.open};
 const data=await memberDutyIndex(filters);
 const duties=listedMemberDuties(data).filter(d=>(!params.match||d.match_id===params.match)&&(!params.kind||d.kind===params.kind)&&(params.open!=='1'||dutyVacancy(data,d).open));
 const days=groupDutiesByDay(duties);
 return <Shell data={data}><Heading title="Diensten"/><Notice params={params}/>
 <div className="filter-bar member-duty-filter-bar"><p className="muted small">{duties.length} komende {duties.length===1?'dienst':'diensten'} · {days.length} {days.length===1?'dag':'dagen'}</p><form className="member-duty-filters">
 <div className="member-duty-filter-field"><label htmlFor="member-duty-kind">Type dienst</label><select id="member-duty-kind" name="kind" defaultValue={params.kind ?? ''}><option value="">Alle soorten</option><option value="bar">Bardiensten</option><option value="referee">Fluitdiensten</option><option value="event">Evenementen</option><option value="other">Overige diensten</option></select></div>
 <div className="member-duty-filter-field"><div className="label-with-info"><label htmlFor="member-duty-team">Team</label><InfoButton topic="Teamfilter"><p>{memberHelp.teamFilter}</p></InfoButton></div><select id="member-duty-team" name="team" defaultValue={params.team ?? ''}><option value="">Alle teams</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
 <div className="member-duty-filter-actions"><label className="checkbox-label"><input type="checkbox" name="open" value="1" defaultChecked={params.open==='1'}/>Alleen open diensten</label>
 {params.match&&<input name="match" type="hidden" value={params.match}/>}<SubmitButton className="button secondary">Filteren</SubmitButton><Link className="text-button" href="/diensten">Filters wissen</Link></div></form></div>
 <section className="day-duty-list" aria-label="Diensten per dag">{days.map(([day,entries])=><DutyDay key={day+JSON.stringify(filters)} day={day} filters={filters} label={new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Amsterdam'}).format(new Date(entries[0].starts_at))} count={entries.length} vacancies={entries.reduce((n,d)=>{const vacancy=dutyVacancy(data,d);return n+(vacancy.open?vacancy.remaining:0);},0)}/>)}{!duties.length&&<p className="empty-state">Geen komende diensten in deze selectie.</p>}</section><p className="muted small">Open een datum om alle diensten van die dag te bekijken. Je kunt je inschrijven als je team, planning en scheidsrechtersniveau passen. Je eigen inschrijvingen staan bij <Link href="/mijn-diensten">Mijn diensten</Link>.</p></Shell>;
}
