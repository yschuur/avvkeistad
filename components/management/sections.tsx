import { AvailableTeamSelect } from '@/components/available-team-select';
import type { FunctionCatalog } from '@/lib/functions';
import { functionMembers } from '@/components/function-management';
import { FilterPanel } from '@/components/filter-panel';
import { TableCell } from '@/components/responsive-table';
import Link from 'next/link';
import type { AppData } from '@/lib/data';
import { memberProgress } from '@/lib/data';
import { seasonDate } from '@/lib/seasons';
import { date } from '@/components/ui';
import { MemberEditor } from '@/components/member-editor';
import { SubmitButton } from '@/components/submit-button';
import { CompetitionLevelSelect } from '@/components/competition-level-select';
import { RefereeLevelSelect } from '@/components/referee-level-select';
import { createTeam,createDuty,invite } from '@/app/actions';
function Field({label,name,type='text',value,required=true,min,max,step}:{label:string;name:string;type?:string;value?:string|number;required?:boolean;min?:number;max?:number;step?:string}) {return <label>{label}<input name={name} type={type} defaultValue={value} required={required} min={min} max={max} step={step}/></label>;}
function context(data:AppData) {
 const s=data.season,seasonInput=<input type="hidden" name="season_id" value={s?.id ?? ''}/>;
 const teamOptions=data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>);
 const memberOptions=data.profiles.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>);
 return {s,seasonInput,teamOptions,memberOptions};
}
export function ReportSection({data,params={}}:{data:AppData;params?:Record<string,string|undefined>}) {
 const {teamOptions}=context(data);
 const filtered=data.profiles.filter(p=>{const m=data.memberships.find(m=>m.member_id===p.id),score=memberProgress(data,p.id);return m&&(!params.team||m.team_id===params.team)&&(params.deficit!=='1'||score.toEarn>0);});
 return <section className="panel"><div className="section-heading"><h2>Puntenrapportage</h2><a href={`/rapportage?team=${encodeURIComponent(params.team ?? '')}&deficit=${params.deficit==='1'?'1':'0'}`} className="button secondary" >CSV exporteren</a></div><FilterPanel active={Boolean(params.team||params.deficit==='1')}><form className="inline-form" method="get"><label>Team<select name="team" defaultValue={params.team ?? ''}><option value="">Alle teams</option>{teamOptions}</select></label><label className="checkbox"><input type="checkbox" name="deficit" value="1" defaultChecked={params.deficit==='1'}/>Alleen leden onder de norm</label><SubmitButton className="button secondary">Filteren</SubmitButton></form></FilterPanel><div className="table-wrap mobile-table" role="region" aria-label="Puntenrapportage" tabIndex={0}><table role="table"><thead><tr role="row"><th>Lid</th><th>Team</th><th className="numeric">Norm</th><th className="numeric">Behaald</th><th className="numeric">Ingepland</th><th className="numeric">Nog te behalen</th></tr></thead><tbody>{filtered.map(p=>{const m=data.memberships.find(m=>m.member_id===p.id);const score=memberProgress(data,p.id);return <tr role="row" key={p.id}><TableCell label="Lid" data-featured="true">{p.first_name} {p.last_name}</TableCell><TableCell label="Team">{data.teams.find(t=>t.id===m?.team_id)?.name}</TableCell><TableCell label="Norm" className="numeric">{score.norm}</TableCell><TableCell label="Behaald" className="numeric"><span className="earned-text">{score.earned}</span></TableCell><TableCell label="Ingepland" className="numeric">{score.planned}</TableCell><TableCell label="Nog te behalen" className="numeric">{score.toEarn}</TableCell></tr>;})}</tbody></table>{!filtered.length && <p className="muted">Geen leden gevonden.</p>}</div></section>;
}
export function SeasonSection({data,params={}}:{data:AppData;params?:Record<string,string|undefined>}) {
 const {s}=context(data);
 return <section className="panel"><div className="section-heading"><h2>Actief seizoen</h2><Link href="/beheer/seizoenen">Seizoenen beheren</Link></div>{s?<><h3>{s.name}</h3><p className="muted small">{seasonDate(s.starts_on)} t/m {seasonDate(s.ends_on)}</p><dl className="season-summary"><div><dt>Algemene norm</dt><dd>{s.default_norm} punten</dd></div><div><dt>Jeugd</dt><dd>{s.youth_norm ?? s.default_norm} punten</dd></div><div><dt>Senioren</dt><dd>{s.senior_norm ?? s.default_norm} punten</dd></div></dl><Link className="button secondary" href={`/beheer/seizoenen?season=${s.id}#seizoenformulier`}>Seizoen bewerken</Link></>:<><p className="muted">Maak eerst een seizoen aan om teams en diensten te beheren.</p><Link className="button" href="/beheer/seizoenen?new=1">Seizoen aanmaken</Link></>}</section>;
}
export function TeamCreateSection({data,params={}}:{data:AppData;params?:Record<string,string|undefined>}) {
 const {s,seasonInput}=context(data);
 return <section className="panel"><div className="section-heading"><h2>Team aanmaken</h2></div><form action={createTeam}>{seasonInput}<fieldset disabled={!s} className="stack-form"><Field label="Teamnaam" name="name"/><label>Leeftijdsklasse<select name="age"><option value="senior">Senioren</option><option value="youth">Jeugd</option></select></label><CompetitionLevelSelect id="new-team-competition"/><SubmitButton className="button">Team toevoegen</SubmitButton></fieldset></form><p className="muted small">Teams dit seizoen: {data.teams.map(t=>t.name).join(', ') || 'nog geen'}</p></section>;
}
export function DutyCreateSection({data,refereePoints,fixedKind,returnTo}:{data:AppData;refereePoints:number|null;fixedKind?:'bar'|'event'|'other';returnTo?:string}) {
 const {s,seasonInput,teamOptions}=context(data);
 return <section id="dienst-aanmaken" className="panel wide"><h2>{fixedKind?`${fixedKind==='bar'?'Bardienst':fixedKind==='event'?'Evenement':'Overige dienst'} of wekelijkse reeks aanmaken`:'Dienst of wekelijkse reeks aanmaken'}</h2>{fixedKind?<p className="muted small">Tijden zijn Nederlandse tijden. Voor deze dienst geldt 1 uur = 1 punt per deelnemer. Een reeks herhaalt wekelijks op dezelfde lokale tijd.</p>:<p className="muted small">Tijden zijn Nederlandse tijden. Een reeks herhaalt wekelijks op dezelfde lokale tijd. Voor reguliere diensten geldt 1 uur = 1 punt per deelnemer; fluitdiensten gebruiken de standaardpunten uit Instellingen → Diensten. Maak fluitdiensten voor wedstrijden via <Link href="/beheer/wedstrijden">Wedstrijden</Link>; daar wordt het vereiste niveau automatisch bepaald.</p>}{(!fixedKind||refereePoints===null)&&<p className="field-help">{refereePoints!==null?`Fluitdienst: ${refereePoints} punten per deelnemer.`:"Voer migratie 008 uit om diensten aan te maken en standaardpunten in te stellen."}</p>}<form action={createDuty}>{seasonInput}{returnTo&&<input type="hidden" name="return_to" value={returnTo}/>}<fieldset disabled={!s||refereePoints===null} className="form-grid three"><Field label="Titel" name="title"/>{fixedKind?<input type="hidden" name="kind" value={fixedKind}/>:<label>Soort<select name="kind"><option value="bar">Bardienst</option><option value="referee">Fluitdienst</option><option value="event">Evenement</option><option value="lines">Vlaggen</option></select></label>}<Field label="Locatie" name="location"/><Field label="Begint op" name="start" type="datetime-local"/><Field label="Eindigt op" name="end" type="datetime-local"/><Field label="Aantal deelnemers" name="capacity" type="number" min={1} max={100} value={2}/>{!fixedKind&&<div><RefereeLevelSelect id="duty-referee-level" label="Vereist scheidsrechtersniveau" optional/><p className="field-help">Alleen verplicht bij een fluitdienst.</p></div>}<Field label="Aantal weken (1 = eenmalig)" name="repeat" type="number" min={1} max={53} value={1}/><AvailableTeamSelect id="new-duty-team" teams={data.teams} matches={data.matches}/><SubmitButton className="button">Diensten aanmaken</SubmitButton></fieldset></form></section>;
}
export function MemberSection({data,params={},catalog}:{data:AppData;params?:Record<string,string|undefined>;catalog:FunctionCatalog}) {
 const {s}=context(data);
 return <section className="panel" id="lidinstellen"><h2>Lid instellen</h2><MemberEditor key={params.member ?? 'first'} initialMember={params.member} profiles={data.profiles} memberships={data.memberships} teams={data.teams} season={s?.id ?? ""} disabled={!s} functions={data.functions} groups={catalog.groups} assignments={data.assignments} functionMembers={functionMembers(data)} functionsAvailable={catalog.available}/></section>;
}
export function InviteSection({data,params={}}:{data:AppData;params?:Record<string,string|undefined>}) {
 const {s,seasonInput,teamOptions}=context(data);
 if(data.profile.role!=='admin') return null;
 return <section className="panel wide"><h2>Account uitnodigen</h2><p className="muted small">Het lid of de beheerder ontvangt een persoonlijke uitnodiging per e-mail. Voor leden zijn team en Nevobo-code verplicht.</p><form action={invite}>{seasonInput}<fieldset disabled={false} className="form-grid three"><Field label="Voornaam" name="first"/><Field label="Achternaam" name="last"/><Field label="E-mailadres" name="email" type="email"/><label>Autorisatie<select name="role"><option value="member">Lid</option><option value="manager">Beheerder</option></select></label><Field label="Nevobo-code (verplicht voor lid)" name="code" required={false}/><label>Team<select name="team_id"><option value="">Geen team (alleen beheerder)</option>{teamOptions}</select></label><SubmitButton className="button">Uitnodiging versturen</SubmitButton></fieldset></form></section>;
}
