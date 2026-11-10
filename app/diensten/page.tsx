import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getData,getDutyParticipants } from '@/lib/data';
import { listedMemberDuties,groupDutiesByDay,dutyVacancy } from '@/lib/member-duties';
import { Shell } from '@/components/shell';
import { DutyCard,Heading,Notice } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
export default async function Duties({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('duties'),params=await searchParams;
 if(params.view==='mine') {const query=new URLSearchParams();for(const key of ['match','kind','success','error']) if(params[key]) query.set(key,params[key]!);redirect('/mijn-diensten'+(query.size?'?'+query:''));}
 const participants=await getDutyParticipants();
 const duties=listedMemberDuties(data).filter(d=>(!params.match||d.match_id===params.match)&&(!params.kind||d.kind===params.kind)&&(params.open!=='1'||dutyVacancy(data,d).open)&&(!params.team||(params.team==='open'?!d.assigned_team_id:d.assigned_team_id===params.team)));
 const days=groupDutiesByDay(duties);
 return <Shell data={data}><Heading title="Open diensten"/><Notice params={params}/>
 {participants===null&&<p className="notice">De namen van ingeplande leden konden niet worden geladen. Probeer opnieuw of neem contact op met de beheerder.</p>}
 <div className="filter-bar"><p className="muted small">{duties.length} komende {duties.length===1?'dienst':'diensten'} · {days.length} {days.length===1?'dag':'dagen'}</p><form className="member-duty-filters">
 <label htmlFor="member-duty-kind">Type dienst</label><select id="member-duty-kind" name="kind" defaultValue={params.kind ?? ''}><option value="">Alle soorten</option><option value="bar">Bardiensten</option><option value="referee">Fluitdiensten</option><option value="event">Evenementen</option><option value="other">Overige diensten</option></select>
 <label htmlFor="member-duty-team">Team</label><select id="member-duty-team" name="team" defaultValue={params.team ?? ''}><option value="">Alle teams</option><option value="open">Open voor alle teams</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
 <label className="checkbox-label"><input type="checkbox" name="open" value="1" defaultChecked={params.open==='1'}/>Alleen open diensten</label>
 {params.match&&<input name="match" type="hidden" value={params.match}/>}<SubmitButton className="button secondary">Filteren</SubmitButton><Link className="text-button" href="/diensten">Filters wissen</Link></form></div>
 <section className="day-duty-list" aria-label="Diensten per dag">{days.map(([day,entries])=><details key={day} className="duty-day"><summary><span>{new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Amsterdam'}).format(new Date(entries[0].starts_at))}</span><span className="muted small">{entries.length} {entries.length===1?'dienst':'diensten'} · {entries.reduce((n,d)=>{const vacancy=dutyVacancy(data,d);return n+(vacancy.open?vacancy.remaining:0);},0)} vrije plekken</span></summary><div className="duty-day-entries">{entries.map(d=><DutyCard key={d.id} duty={d} data={data} listView participants={participants?.filter(p=>p.duty_id===d.id)}/>)}</div></details>)}{!duties.length&&<p className="empty-state">Geen komende diensten in deze selectie.</p>}</section><p className="muted small">Open een datum om alle diensten van die dag te bekijken. Je kunt je inschrijven als je team, planning en scheidsrechtersniveau passen. Je eigen inschrijvingen staan bij <Link href="/mijn-diensten">Mijn diensten</Link>.</p></Shell>;
}
