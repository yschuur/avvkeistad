import Link from 'next/link';
import { TableCell } from '@/components/responsive-table';
import { refereeDescription } from '@/lib/referee-levels';
import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { CompetitionLevelSelect } from '@/components/competition-level-select';
import { SubmitButton } from '@/components/submit-button';
import { teamRefereeRequirement,clubRefereeRequired } from '@/lib/competition-rules';
import { TeamCreateSection } from '@/components/management/sections';
import { updateTeamCompetition } from '@/app/actions';
export default async function TeamsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('teams'),params=await searchParams;
 const teams=[...data.teams].sort((a,b)=>a.name.localeCompare(b.name,'nl',{numeric:true}));
 const selected=teams.find(t=>t.id===params.team);
 const members=selected?data.memberships.filter(m=>m.team_id===selected.id).flatMap(m=>{const profile=data.profiles.find(p=>p.id===m.member_id);return profile?[{...profile,captain:m.captain}]:[];}).sort((a,b)=>a.last_name.localeCompare(b.last_name,'nl')||a.first_name.localeCompare(b.first_name,'nl')):[];
 const ready=teams.every(t=>t.competition_level!==undefined);
 return <Shell data={data}><Heading title="Teams en niveaus"/><Notice params={params}/>
 <section className="panel"><p>{data.season?.name ?? 'Geen actief seizoen'} · {teams.length} {teams.length===1?'team':'teams'}</p><p className="muted small">Het competitieniveau bepaalt of een clubscheidsrechter nodig is en welk minimum geldt. Een wijziging werkt ook door in toekomstige wedstrijden. Toewijzingen met een te laag of ontbrekend scheidsrechtersniveau worden ingetrokken, met een melding voor het lid. Afgelopen diensten en behaalde punten blijven behouden.</p>
 {!ready && <p className="notice warning" role="alert">Teams met competitieniveaus zijn nog niet beschikbaar. Voer migratie 006_competition_referee_rules.sql uit.</p>}
 {teams.map(t=><div className="correction-row" key={t.id}><span><strong><Link href={`/beheer/teams?team=${encodeURIComponent(t.id)}#teamleden`}>{t.name}</Link></strong><small>{t.age_class==='youth'?'Jeugd':'Senioren'} · {t.competition_level===undefined?'Niveau nog niet beschikbaar':clubRefereeRequired(teamRefereeRequirement(t.age_class,t.competition_level))?`Minimaal ${teamRefereeRequirement(t.age_class,t.competition_level)}`:'Geen clubscheidsrechter nodig'}</small></span><Link className="button secondary" href={`/beheer/teams?team=${encodeURIComponent(t.id)}#teamleden`} aria-label={`Leden van ${t.name}`}>Leden bekijken</Link>{ready && <form action={updateTeamCompetition} className="qualification-form"><input type="hidden" name="team_id" value={t.id}/><CompetitionLevelSelect id={`competition-${t.id}`} value={t.competition_level}/><SubmitButton className="button secondary">Niveau opslaan</SubmitButton></form>}</div>)}
 {!teams.length && <p className="empty-state">Geen teams in dit seizoen.</p>}
 </section>
 {params.team&&!selected&&<p className="notice" role="status">Dit team is niet beschikbaar in het actieve seizoen.</p>}
 {selected&&<section className="panel" id="teamleden" aria-labelledby="team-members-heading"><div className="section-heading"><h2 id="team-members-heading">Leden van {selected.name}</h2><Link href="/beheer/teams">Alle teams</Link></div><p className="muted small">{data.season?.name} · {members.length} {members.length===1?'lid':'leden'}</p><div className="table-wrap mobile-table" role="region" aria-label="Teamleden" tabIndex={0}><table role="table"><thead><tr role="row"><th>Lid</th><th>E-mail</th><th>Nevobo-nummer</th><th>Scheidsrechtersniveau</th><th>Actie</th></tr></thead><tbody>{members.map(member=><tr role="row" key={member.id}><TableCell label="Lid" data-featured="true">{member.first_name} {member.last_name}{member.captain&&<span className="captain-tag">Aanvoerder</span>}</TableCell><TableCell label="E-mail">{member.email}</TableCell><TableCell label="Nevobo-nummer">{member.nevobo_code||'Niet ingesteld'}</TableCell><TableCell label="Scheidsrechtersniveau">{refereeDescription(member.referee_qualification)}</TableCell><TableCell label="Actie"><Link className="button secondary" href={`/beheer/leden?member=${encodeURIComponent(member.id)}#lidinstellen`} aria-label={`Lid beheren: ${member.first_name} ${member.last_name}`}>Lid beheren</Link></TableCell></tr>)}</tbody></table></div>{!members.length&&<p className="empty-state">Dit team heeft nog geen leden in dit seizoen.</p>}</section>}
 <section className="panel"><h2>Fluitregels</h2><dl className="season-summary"><div><dt>Promotieklasse en hoger, inclusief Topdivisie</dt><dd>Geen clubscheidsrechter nodig</dd></div><div><dt>Senioren eerste en tweede klasse; jeugd hoofdklasse</dt><dd>V4 of hoger</dd></div><div><dt>Overige niveaus en lege niveaus uit de Excel</dt><dd>V6 of hoger</dd></div></dl><p className="field-help">Een lid zonder ingesteld scheidsrechtersniveau kan geen fluitdienst aannemen.</p></section>
 <TeamCreateSection data={data}/></Shell>;
}
