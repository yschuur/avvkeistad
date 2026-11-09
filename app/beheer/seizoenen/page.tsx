import { TableCell } from '@/components/responsive-table';
import Link from 'next/link';
import { getData } from '@/lib/data';
import { supabase } from '@/lib/supabase/server';
import { seasonDate, type Season } from '@/lib/seasons';
import { activateSeason } from '@/app/actions';
import { Shell } from '@/components/shell';
import { Heading, Notice } from '@/components/ui';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { SeasonEditor } from '@/components/season-editor';

export default async function SeasonsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('settings');
 const [params,db]=await Promise.all([searchParams,supabase()]);
 const result=await db.from('seasons').select('id,name,starts_on,ends_on,active,default_norm,youth_norm,senior_norm,updated_at').order('starts_on',{ascending:false}).order('id');
 const seasons=(result.data ?? []) as Season[];
 const creating=params.new==='1'||seasons.length===0;
 const selected=creating?null:params.season?seasons.find(s=>s.id===params.season):seasons.find(s=>s.active) ?? seasons[0];
 const unknown=Boolean(params.season && !seasons.some(s=>s.id===params.season));
 return <Shell data={data}>
  <div className="breadcrumbs"><Link href="/beheer">Beheer</Link><span>/</span><span>Seizoenen</span></div>
  <Heading title="Seizoenen"><Link className="button" href="/beheer/seizoenen?new=1#seizoenformulier">Nieuw seizoen</Link></Heading>
  <Notice params={params}/>
  {result.error?<p className="notice warning" role="alert">{result.error.code==='42703'||result.error.code==='PGRST204'?'Voer eerst migratie 004_season_management.sql uit in Supabase om seizoenen te kunnen aanmaken en bewerken.':'De seizoenen konden niet worden geladen. Herlaad de pagina of controleer de databaseverbinding.'}</p>:<>
   {unknown && <p className="notice warning" role="alert">Het gekozen seizoen bestaat niet meer. Selecteer een seizoen uit het overzicht.</p>}
   <div className="season-layout">
    <section className="panel" aria-labelledby="seizoenen-overzicht"><h2 id="seizoenen-overzicht">Alle seizoenen</h2><p className="muted">Het actieve seizoen bepaalt de overzichten, teamindelingen en Nevobo-import. Een volgend seizoen blijft apart bewaard totdat je het activeert.</p>
     <div className="table-wrap mobile-table" role="region" aria-label="Seizoenenoverzicht" tabIndex={0}><table role="table"><thead><tr role="row"><th>Seizoen</th><th>Periode</th><th>Status</th><th>Acties</th></tr></thead><tbody>{seasons.map(s=><tr role="row" key={s.id} className={selected?.id===s.id?'season-row-current':undefined}>
      <TableCell label="Seizoen" data-featured="true"><strong>{s.name}</strong><small>Algemene norm: {s.default_norm} punten</small></TableCell><TableCell label="Periode">{seasonDate(s.starts_on)}<small>t/m {seasonDate(s.ends_on)}</small></TableCell><TableCell label="Status"><span className="badge">{s.active?'Actief':'Niet actief'}</span></TableCell>
      <TableCell label="Acties" className="table-actions"><div className="season-actions"><Link className="button secondary" href={`/beheer/seizoenen?season=${s.id}#seizoenformulier`} aria-label={`${s.name} bewerken`} aria-current={selected?.id===s.id?'true':undefined}>Bewerken</Link>{!s.active && <form action={activateSeason}><input type="hidden" name="season_id" value={s.id}/><input type="hidden" name="updated_at" value={s.updated_at}/><ConfirmSubmitButton className="button secondary" question={`Seizoen ${s.name} activeren? Overzichten en Nevobo-import gebruiken daarna dit seizoen. Bestaande gegevens blijven bij hun eigen seizoen.`}>Activeren</ConfirmSubmitButton></form>}</div></TableCell>
     </tr>)}</tbody></table>{!seasons.length && <p className="empty-state">Nog geen seizoenen. Maak het eerste seizoen aan.</p>}</div>
    </section>
    {!unknown && <SeasonEditor key={selected?selected.id+selected.updated_at:'new'} season={selected ?? null} previous={seasons[0] ?? null} hasActive={seasons.some(s=>s.active)}/>}
   </div>
  </>}
 </Shell>;
}
