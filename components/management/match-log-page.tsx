import { FilterPanel } from '@/components/filter-panel';
import { TableCell } from '@/components/responsive-table';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getData,type SyncState } from '@/lib/data';
import { supabase } from '@/lib/supabase/server';
import { Shell } from '@/components/shell';
import { Heading } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { matchChanges,eventMatchName,matchEventLabels,logDate,matchLogUrl as logUrl,type MatchEvent } from '@/lib/match-history';
import { syncErrorMessage } from '@/lib/nevobo/import-program';

const matchLogUrl=(params:Record<string,string|undefined>,page=1)=>logUrl(params,page,'/beheer/wedstrijden/log');
export default async function MatchLog({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 // Both the page and the existing database policy require admin/manager rights.
 const data=await getData('settings'),params=await searchParams,db=await supabase();
 const requested=Number.parseInt(params.page ?? '1',10),page=Number.isFinite(requested)?Math.min(100000,Math.max(1,requested)):1;
 const kind=params.kind && Object.hasOwn(matchEventLabels,params.kind)?params.kind:'';
 const matchId=z.uuid().safeParse(params.match);
 let query=db.from('match_events').select('id,match_id,revision,kind,created_at,old_state,new_state,match:matches(home_team,away_team,match_code)',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false});
 if(kind) query=query.eq('kind',kind);
 if(matchId.success) query=query.eq('match_id',matchId.data);
 const [eventsResult,syncResult]=await Promise.all([
  query.range((page-1)*25,page*25-1),
  db.from('nevobo_sync_state').select('last_started_at,last_success_at,last_error_code,feed_published_at,imported_count,updated_count').limit(1),
 ]);
 const count=eventsResult.count ?? 0,pageCount=Math.max(1,Math.ceil(count/25));
 if(!eventsResult.error && page>pageCount) redirect(matchLogUrl(params,pageCount));
 const events=(eventsResult.data ?? []) as unknown as MatchEvent[],sync=(syncResult.data?.[0] ?? null) as SyncState|null;
 const invalidMatch=Boolean(params.match && !matchId.success);
 return <Shell data={data}>
  <div className="breadcrumbs"><Link href="/beheer/wedstrijden">Wedstrijden</Link><span>/</span><span>Wijzigingslog</span></div>
  <Heading title="Wijzigingslog"><Link className="button secondary" href="/beheer/wedstrijden">Terug naar wedstrijden</Link></Heading>
  {sync?.last_success_at?<section className="panel" aria-labelledby="import-status-heading"><h2 id="import-status-heading">Laatste geslaagde import</h2><p><time dateTime={sync.last_success_at}>{logDate(sync.last_success_at)}</time> · {sync.imported_count} nieuw · {sync.updated_count} gewijzigd</p></section>:<p className="notice">{syncResult.error?'De importstatus kon niet worden geladen.':'Nog geen geslaagde import vastgelegd.'}</p>}
  {sync?.last_error_code && <p className="notice warning" role="alert">{sync.last_started_at && <>{logDate(sync.last_started_at)}: </>}{syncErrorMessage(sync.last_error_code)}</p>}
  <p className="match-log-intro">Hier staan vastgelegde wijzigingen aan bestaande wedstrijden, over alle seizoenen. Nieuwe wedstrijden staan in de importteller. Een import zonder wijzigingen maakt geen logregels aan.</p>
<FilterPanel active={Boolean(kind||params.match)}>  <form method="get" action="/beheer/wedstrijden/log" className="inline-form match-log-filters" aria-label="Wijzigingslog filteren" key={kind+String(params.match ?? '')}>
   {matchId.success && <input type="hidden" name="match" value={matchId.data}/>}
   <div className="match-filter-field"><label htmlFor="event-kind">Soort wijziging</label><select id="event-kind" name="kind" defaultValue={kind}><option value="">Alle wijzigingen</option>{Object.entries(matchEventLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
   <SubmitButton className="button secondary">Filteren</SubmitButton>{(kind||params.match) && <Link className="button secondary" href="/beheer/wedstrijden/log">Filters wissen</Link>}
  </form></FilterPanel>
  {invalidMatch?<p className="notice warning" role="alert">De wedstrijdselectie is ongeldig. Wis de filters om de wijzigingshistorie te bekijken.</p>:eventsResult.error?<p className="notice warning" role="alert">Het wijzigingslog kon niet worden geladen. Controleer de databaseverbinding en of migratie 003_nevobo_matches.sql is uitgevoerd.</p>:<>
   <p className="muted small" role="status">{count} {count===1?'wijzigingsmoment':'wijzigingsmomenten'} · Nederlandse tijd</p>
   <section className="notification-list" aria-label="Wedstrijdwijzigingen">{events.length?events.map(event=>{
    const changes=matchChanges(event.old_state,event.new_state);
    return <article className="notification-row" key={event.id}><div><h2><Link href={`/beheer/wedstrijden?view=all&match=${encodeURIComponent(event.match_id)}`}>{eventMatchName(event)}</Link></h2><p className="muted small">{matchEventLabels[event.kind] ?? 'Wedstrijd gewijzigd'}{event.match?.match_code && <> · {event.match.match_code}</>}</p></div>
     <div className="notification-meta"><time dateTime={event.created_at}>{logDate(event.created_at)}</time></div>
     {changes.length?<div className="table-wrap mobile-table match-log-diff" role="region" aria-label={`Wijzigingen: ${eventMatchName(event)}`} tabIndex={0}><table role="table"><thead><tr role="row"><th>Veld</th><th>Vorige waarde</th><th>Nieuwe waarde</th></tr></thead><tbody>{changes.map(change=><tr role="row" key={change.key}><th scope="row">{change.label}</th><TableCell label="Vorige waarde">{change.before}</TableCell><TableCell label="Nieuwe waarde">{change.after}</TableCell></tr>)}</tbody></table></div>:<p className="muted small match-log-diff">Geen vergelijkbare veldwijzigingen beschikbaar.</p>}
    </article>;
   }):<p className="empty-state">Nog geen wedstrijdwijzigingen in deze selectie.</p>}</section>
   {pageCount>1 && <nav className="pagination" aria-label="Wijzigingspagina’s">{page>1 && <Link className="button secondary" href={matchLogUrl(params,page-1)}>Vorige</Link>}<span>Pagina {page} van {pageCount}</span>{page<pageCount && <Link className="button secondary" href={matchLogUrl(params,page+1)}>Volgende</Link>}</nav>}
  </>}
 </Shell>;
}
