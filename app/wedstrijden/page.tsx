import Link from 'next/link';
import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading, Notice, date, time } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { createMatchDuty,syncNevobo,testMatchNotifications } from '@/app/actions';
import { mailConfig } from '@/lib/nevobo/mail';
import { NEVOBO_PROGRAM_URL,canRegisterForMatch,statusLabels,type MatchStatus } from '@/lib/nevobo/types';
function safeSource(value:string|null|undefined) {
 if(!value) return null;
 try {const u=new URL(value);return u.protocol==='https:' && ['nevobo.nl','www.nevobo.nl','api.nevobo.nl','volleybal.nl','www.volleybal.nl'].includes(u.hostname)?u.href:null;}catch{return null;}
}
export default async function MatchesPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('matches'),params=await searchParams,manager=data.profile.role!=='member',now=new Date();
 const view=params.view==='history'?'history':params.view==='all'?'all':'upcoming';
 const matches=data.matches.filter(m=>{
  if(params.match && m.id!==params.match) return false;
  const past=m.status==='played'||Boolean(m.starts_at && new Date(m.starts_at)<=now);
  return view==='all'||(view==='history'?past:!past);
 });
 if(view==='history') matches.reverse();
 const pageCount=Math.max(1,Math.ceil(matches.length/50));
 const requested=Number.parseInt(params.page ?? '1',10);
 const page=Math.min(pageCount,Math.max(1,Number.isFinite(requested)?requested:1));
 const visible=matches.slice((page-1)*50,page*50);
 const pageUrl=(target:number)=>'/wedstrijden?'+new URLSearchParams({view,page:String(target),...(params.match?{match:params.match}:{})});
 const sync=data.syncState;
 const stale=sync?.last_success_at && now.getTime()-new Date(sync.last_success_at).getTime()>5*3600000;
 return <Shell data={data}><Heading title="Wedstrijden">{manager && <form action={syncNevobo}><SubmitButton className="button">Nu synchroniseren</SubmitButton></form>}{manager && <form action={testMatchNotifications}><SubmitButton className="button secondary" disabled={!mailConfig()}>Testmelding naar mij</SubmitButton></form>}<a href={NEVOBO_PROGRAM_URL} target="_blank" rel="noreferrer" className="button secondary">Nevobo-bron</a></Heading><Notice params={params}/>
  {manager && !mailConfig() && <p className="notice warning">Resend is nog niet ingesteld. Appmeldingen worden opgeslagen; vul de mailinstellingen in Vercel in om e-mails te verzenden.</p>}<div className="sync-meta">{sync?.last_success_at?<span>Laatste import: {date(sync.last_success_at)} · {time(sync.last_success_at)}</span>:<span>Nog niet gesynchroniseerd.</span>}</div>
  {(stale || (manager && sync?.last_error_code)) && <p className="notice warning" role="alert">De wedstrijdgegevens zijn mogelijk verouderd. De laatste automatische synchronisatie moet worden gecontroleerd.</p>}
  <div className="filter-bar"><div className="tabs"><Link href="/wedstrijden" className={view==='upcoming'?'selected':''}>Programma</Link><Link href="/wedstrijden?view=history" className={view==='history'?'selected':''}>Historie</Link>{params.match && <Link href="/wedstrijden">Selectie wissen</Link>}</div><span className="muted small">{matches.length} wedstrijden · Nederlandse tijd</span></div>
  <div className="table-wrap" role="region" aria-label="Wedstrijdprogramma" tabIndex={0}><table><thead><tr><th>Datum / tijd</th><th>Wedstrijd</th><th>Locatie</th><th>Status</th><th>Scheidsrechter</th></tr></thead><tbody>{visible.map(m=>{
   const source=safeSource(m.source_url),open=canRegisterForMatch(m,now),past=m.starts_at && new Date(m.starts_at)<=now;
   const status=m.cancelled?'cancelled':m.status ?? 'scheduled';
   const linked=m.referee_duties?.find(d=>d.kind==='referee' && !d.cancelled);
   return <tr key={m.id}><td>{m.starts_at?<><span>{date(m.starts_at)}</span><small>{time(m.starts_at)}</small></>:<span>Nog geen datum</span>}</td><td><strong>{m.home_team}</strong><small>tegen {m.away_team}</small><details className="match-detail"><summary>Wedstrijddetails</summary><dl>{m.match_code && <><dt>Wedstrijdcode</dt><dd>{m.match_code}</dd></>}{m.level && <><dt>Niveau / competitie</dt><dd>{m.level}</dd></>}{m.address && <><dt>Adres</dt><dd>{m.address}</dd></>}{m.postal_code && <><dt>Postcode</dt><dd>{m.postal_code}</dd></>}{m.city && <><dt>Plaats</dt><dd>{m.city}</dd></>}{m.court && <><dt>Veld</dt><dd>{m.court}</dd></>}</dl>{m.source_description && <p className="source-description">{m.source_description}</p>}{source && <a href={source} target="_blank" rel="noreferrer">Bekijk bij Nevobo</a>}</details></td>
   <td>{m.location || 'Niet vermeld'}{m.city && <small>{m.city}</small>}{m.court && <small>Veld {m.court}</small>}</td><td><span className="badge">{status==='scheduled' && past?'Afgelopen':statusLabels[status as MatchStatus] ?? 'Niet bevestigd'}</span></td>
   <td>{!open?<span className="muted">Inschrijving gesloten</span>:linked?<Link href={`/diensten?match=${encodeURIComponent(m.id)}`}>Fluitdienst bekijken</Link>:manager?<details className="match-detail"><summary>Fluitdienst aanmaken</summary><form action={createMatchDuty} className="stack-form match-duty-form"><input name="match_id" type="hidden" value={m.id}/><label>Punten<input name="points" type="number" min={0.25} step="0.25" required/></label><label>Geplande duur (minuten)<input name="minutes" type="number" min={15} max={480} required/></label><label>Vereiste bevoegdheid (0–10)<input name="level" type="number" min={0} max={10} required/></label><SubmitButton className="button">Fluitdienst aanmaken</SubmitButton></form></details>:<span className="muted">Geen clubdienst gekoppeld</span>}</td></tr>;
  })}</tbody></table>{!matches.length && <p className="empty-state">Geen wedstrijden in deze selectie.</p>}</div>{pageCount>1 && <nav className="pagination" aria-label="Wedstrijdpagina’s">{page>1 && <Link className="button secondary" href={pageUrl(page-1)}>Vorige</Link>}<span>Pagina {page} van {pageCount}</span>{page<pageCount && <Link className="button secondary" href={pageUrl(page+1)}>Volgende</Link>}</nav>}
 </Shell>;
}
