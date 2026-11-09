import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { CompetitionLevelSelect } from '@/components/competition-level-select';
import { SubmitButton } from '@/components/submit-button';
import { teamRefereeRequirement,clubRefereeRequired } from '@/lib/competition-rules';
import { TeamCreateSection } from '@/components/management/sections';
import { updateTeamCompetition } from '@/app/actions';
export default async function TeamsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('settings'),params=await searchParams;
 const teams=[...data.teams].sort((a,b)=>a.name.localeCompare(b.name,'nl',{numeric:true}));
 const ready=teams.every(t=>t.competition_level!==undefined);
 return <Shell data={data}><Heading title="Teams en niveaus"/><Notice params={params}/>
 <section className="panel"><p>{data.season?.name ?? 'Geen actief seizoen'} · {teams.length} {teams.length===1?'team':'teams'}</p><p className="muted small">Het competitieniveau bepaalt of een clubscheidsrechter nodig is en welk minimum geldt. Een wijziging werkt ook door in toekomstige wedstrijden. Toewijzingen met een te laag of ontbrekend scheidsrechtersniveau worden ingetrokken, met een melding voor het lid. Afgelopen diensten en behaalde punten blijven behouden.</p>
 {!ready && <p className="notice warning" role="alert">Teams met competitieniveaus zijn nog niet beschikbaar. Voer migratie 006_competition_referee_rules.sql uit.</p>}
 {teams.map(t=><div className="correction-row" key={t.id}><span><strong>{t.name}</strong><small>{t.age_class==='youth'?'Jeugd':'Senioren'} · {t.competition_level===undefined?'Niveau nog niet beschikbaar':clubRefereeRequired(teamRefereeRequirement(t.age_class,t.competition_level))?`Minimaal ${teamRefereeRequirement(t.age_class,t.competition_level)}`:'Geen clubscheidsrechter nodig'}</small></span>{ready && <form action={updateTeamCompetition} className="qualification-form"><input type="hidden" name="team_id" value={t.id}/><CompetitionLevelSelect id={`competition-${t.id}`} value={t.competition_level}/><SubmitButton className="button secondary">Niveau opslaan</SubmitButton></form>}</div>)}
 {!teams.length && <p className="empty-state">Geen teams in dit seizoen.</p>}
 </section><section className="panel"><h2>Fluitregels</h2><dl className="season-summary"><div><dt>Promotieklasse en hoger, inclusief Topdivisie</dt><dd>Geen clubscheidsrechter nodig</dd></div><div><dt>Senioren eerste en tweede klasse; jeugd hoofdklasse</dt><dd>V4 of hoger</dd></div><div><dt>Overige niveaus en lege niveaus uit de Excel</dt><dd>V6 of hoger</dd></div></dl><p className="field-help">Een lid zonder ingesteld scheidsrechtersniveau kan geen fluitdienst aannemen.</p></section>
 <TeamCreateSection data={data}/></Shell>;
}
