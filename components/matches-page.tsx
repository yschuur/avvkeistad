import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading, Notice, date, time } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { createMatchDuty,syncNevobo,testMatchNotifications } from '@/app/actions';
import { mailConfig } from '@/lib/nevobo/mail';
import { NEVOBO_PROGRAM_URL,canRegisterForMatch } from '@/lib/nevobo/types';
import { matchFilters,selectMatches,matchFilterUrl as filterUrl,displayMatchStatus,matchFilterStatusLabels,matchLocationValue,matchLocationLabel } from '@/lib/match-filters';
import { matchRefereeRequirement,clubRefereeRequired,keistadTeamKey } from '@/lib/competition-rules';
function safeSource(value:string|null|undefined) {
 if(!value) return null;
 try {const u=new URL(value);return u.protocol==='https:' && ['nevobo.nl','www.nevobo.nl','api.nevobo.nl','volleybal.nl','www.volleybal.nl'].includes(u.hostname)?u.href:null;}catch{return null;}
}
export default async function MatchesPage({searchParams,management=false}:{searchParams:Promise<Record<string,string|undefined>>;management?:boolean}) {
 const data=await getData('matches'),params=await searchParams,manager=management&&data.profile.role!=='member',emailConfigured=Boolean(mailConfig()),now=new Date();
 if(management&&data.profile.role==='member') redirect('/');
 const base=management?'/beheer/wedstrijden':'/wedstrijden';
 const matchFilterUrl=(filters:ReturnType<typeof matchFilters>,options:Parameters<typeof filterUrl>[1]={})=>filterUrl(filters,options,base);
 const filters=matchFilters(params),{view}=filters;
 const source=management?data.matches.filter(m=>keistadTeamKey(m.home_team)!==null):data.matches;
 const matches=selectMatches(source,filters,now);
 const teams=[...new Set(source.flatMap(m=>[m.home_team,m.away_team]))].sort((a,b)=>a.localeCompare(b,'nl',{numeric:true}));
 const locations=[...new Map(source.map(m=>[matchLocationValue(m),matchLocationLabel(m)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'nl'));
 const hasFilters=Boolean(filters.day||filters.team||filters.location||filters.status||filters.match);
 const pageCount=Math.max(1,Math.ceil(matches.length/50));
 const requested=Number.parseInt(params.page ?? '1',10);
 const page=Math.min(pageCount,Math.max(1,Number.isFinite(requested)?requested:1));
 const visible=matches.slice((page-1)*50,page*50);
 const pageUrl=(target:number)=>matchFilterUrl(filters,{page:target});
 const sync=data.syncState;
 const stale=sync?.last_success_at && now.getTime()-new Date(sync.last_success_at).getTime()>5*3600000;
 return <Shell data={data}><Heading title="Wedstrijden" description={management?'Thuiswedstrijden van AVV Keistad':undefined}>{manager && <Link className="button secondary" href={`${base}/log`}>Wijzigingslog</Link>}{manager && <form action={syncNevobo}><SubmitButton className="button">Nu synchroniseren</SubmitButton></form>}{manager && emailConfigured && <form action={testMatchNotifications}><SubmitButton className="button secondary">Testmelding naar mij</SubmitButton></form>}<a href={NEVOBO_PROGRAM_URL} target="_blank" rel="noreferrer" className="button secondary">Nevobo-bron</a></Heading><Notice params={params}/>
  <div className="sync-meta">{sync?.last_success_at?<span>Laatste import: {date(sync.last_success_at)} · {time(sync.last_success_at)}</span>:<span>Nog niet gesynchroniseerd.</span>}</div>
  {(stale || (manager && sync?.last_error_code)) && <p className="notice warning" role="alert">De wedstrijdgegevens zijn mogelijk verouderd. De laatste automatische synchronisatie moet worden gecontroleerd.</p>}
  <div className="filter-bar"><div className="tabs"><Link href={matchFilterUrl(filters,{view:'upcoming'})} className={view==='upcoming'?'selected':''} aria-current={view==='upcoming'?'page':undefined}>Programma</Link><Link href={matchFilterUrl(filters,{view:'history'})} className={view==='history'?'selected':''} aria-current={view==='history'?'page':undefined}>Historie</Link><Link href={matchFilterUrl(filters,{view:'all'})} className={view==='all'?'selected':''} aria-current={view==='all'?'page':undefined}>Alle wedstrijden</Link>{filters.match && <Link href={matchFilterUrl(filters,{clearMatch:true})}>Selectie wissen</Link>}</div><span className="muted small" role="status">{matches.length} {matches.length===1?'wedstrijd':'wedstrijden'} · Nederlandse tijd</span></div>
  <form method="get" action={base} className="match-filters" aria-label="Wedstrijden filteren" key={matchFilterUrl(filters)}>
   <input type="hidden" name="view" value={view}/>{filters.match && <input type="hidden" name="match" value={filters.match}/>}
   <div className="match-filter-field"><label htmlFor="match-filter-day">Dag</label><input id="match-filter-day" type="date" name="day" defaultValue={filters.day}/></div>
   <div className="match-filter-field"><label htmlFor="match-filter-team">Team</label><select id="match-filter-team" name="team" defaultValue={filters.team}><option value="">Alle teams</option>{filters.team && !teams.includes(filters.team) && <option value={filters.team}>{filters.team} (niet beschikbaar)</option>}{teams.map(team=><option key={team} value={team}>{team}</option>)}</select></div>
   <div className="match-filter-field"><label htmlFor="match-filter-location">Locatie</label><select id="match-filter-location" name="location" defaultValue={filters.location}><option value="">Alle locaties</option>{filters.location && !locations.some(([value])=>value===filters.location) && <option value={filters.location}>Locatie niet beschikbaar</option>}{locations.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
   <div className="match-filter-field"><label htmlFor="match-filter-status">Status</label><select id="match-filter-status" name="status" defaultValue={filters.status}><option value="">Alle statussen</option>{Object.entries(matchFilterStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
   <div className="match-filter-actions"><SubmitButton className="button secondary">Filteren</SubmitButton>{hasFilters && <Link className="button secondary" href={matchFilterUrl(matchFilters({view}))}>Filters wissen</Link>}</div>
  </form>
  <div className="table-wrap" role="region" aria-label="Wedstrijdprogramma" tabIndex={0}><table><thead><tr><th>Datum / tijd</th><th>Wedstrijd</th><th>Locatie</th><th>Status</th><th>Scheidsrechter</th></tr></thead><tbody>{visible.map(m=>{
   const source=safeSource(m.source_url),open=canRegisterForMatch(m,now),status=displayMatchStatus(m,now);
   const requirement=matchRefereeRequirement(m,data.teams);
   const linked=m.referee_duties?.find(d=>d.kind==='referee' && !d.cancelled);
   return <tr key={m.id}><td>{m.starts_at?<><span>{date(m.starts_at)}</span><small>{time(m.starts_at)}</small></>:<span>Nog geen datum</span>}</td><td><strong>{m.home_team}</strong><small>tegen {m.away_team}</small><details className="match-detail"><summary>Wedstrijddetails</summary><dl>{m.match_code && <><dt>Wedstrijdcode</dt><dd>{m.match_code}</dd></>}{m.level && <><dt>Niveau / competitie</dt><dd>{m.level}</dd></>}{m.address && <><dt>Adres</dt><dd>{m.address}</dd></>}{m.postal_code && <><dt>Postcode</dt><dd>{m.postal_code}</dd></>}{m.city && <><dt>Plaats</dt><dd>{m.city}</dd></>}{m.court && <><dt>Veld</dt><dd>{m.court}</dd></>}</dl>{m.source_description && <p className="source-description">{m.source_description}</p>}{source && <a href={source} target="_blank" rel="noreferrer">Bekijk bij Nevobo</a>}{manager && <p><Link href={`${base}/log?match=${encodeURIComponent(m.id)}`}>Wijzigingshistorie bekijken</Link></p>}</details></td>
   <td>{m.location || 'Niet vermeld'}{m.city && <small>{m.city}</small>}{m.court && <small>Veld {m.court}</small>}</td><td><span className="badge">{matchFilterStatusLabels[status]}</span></td>
   <td>{clubRefereeRequired(requirement)===false?<span className="muted">Geen clubscheidsrechter nodig</span>:!open?<span className="muted">Inschrijving gesloten</span>:linked?<Link href={`${manager?'/beheer/planning':'/diensten'}?match=${encodeURIComponent(m.id)}`}>Fluitdienst bekijken</Link>:manager?<details className="match-detail"><summary>Fluitdienst aanmaken</summary><form action={createMatchDuty} className="stack-form match-duty-form"><input name="match_id" type="hidden" value={m.id}/><label>Punten<input name="points" type="number" min={0.25} step="0.25" required/></label><label>Geplande duur (minuten)<input name="minutes" type="number" min={15} max={480} required/></label><p className="field-help">{requirement?`Vereist scheidsrechtersniveau: ${requirement} of hoger (automatisch).`:'Teamniveau ontbreekt. Controleer de teamlijst bij Beheer → Teams.'}</p><SubmitButton className="button" disabled={!requirement}>Fluitdienst aanmaken</SubmitButton></form></details>:<span className="muted">Geen clubdienst gekoppeld</span>}</td></tr>;
  })}</tbody></table>{!matches.length && <p className="empty-state">Geen wedstrijden in deze selectie.</p>}</div>{pageCount>1 && <nav className="pagination" aria-label="Wedstrijdpagina’s">{page>1 && <Link className="button secondary" href={pageUrl(page-1)}>Vorige</Link>}<span>Pagina {page} van {pageCount}</span>{page<pageCount && <Link className="button secondary" href={pageUrl(page+1)}>Volgende</Link>}</nav>}
 </Shell>;
}
