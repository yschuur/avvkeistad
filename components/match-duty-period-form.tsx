'use client';
import { useActionState,useState } from 'react';
import { createMatchDutiesForPeriod } from '@/app/actions';
import type { Team } from '@/lib/data';
import { teamAge,teamAgeLabels } from '@/lib/team-age';
import { SubmitButton } from '@/components/submit-button';
export function MatchDutyPeriodForm({season,today,available,points,teams}:{season:string;today:string;available:boolean;points:number|null;teams:Team[]}) {
 const [selected,setSelected]=useState(teams.map(t=>t.id));
 const [dates,setDates]=useState({from:today,until:today});
 const [state,action]=useActionState(createMatchDutiesForPeriod,{});
 return <section className="panel" aria-labelledby="match-duty-period-heading"><h2 id="match-duty-period-heading">Fluitdiensten voor een periode</h2>
 <p className="field-help">Maak in één keer fluitdiensten voor de komende thuiswedstrijden van de aangevinkte teams in de gekozen periode (beide datums inbegrepen). Bestaande diensten blijven behouden. Wedstrijden vanaf Promotieklasse worden overgeslagen. Je kiest hier het thuisteam van de wedstrijd. De nieuwe diensten staan open voor alle uitvoerende teams; plekken reserveren kan daarna per dienst.</p>
 {points!==null&&<p className="field-help">{points} punten per fluitbeurt, volgens Instellingen → Diensten. De duur en het vereiste niveau worden automatisch bepaald.</p>}
 <form action={action} className="form-grid" aria-label="Fluitdiensten voor periode aanmaken"><input type="hidden" name="season" value={season}/>
 <div><label htmlFor="match-duty-from">Vanaf</label><input id="match-duty-from" type="date" name="from" required value={dates.from} onChange={e=>setDates({...dates,from:e.target.value})}/></div>
 <div><label htmlFor="match-duty-until">Tot en met</label><input id="match-duty-until" type="date" name="until" required value={dates.until} onChange={e=>setDates({...dates,until:e.target.value})}/></div>
 <fieldset className="period-team-selection"><legend>Thuisteams</legend><div className="form-actions"><button type="button" className="button secondary" onClick={()=>setSelected(teams.map(t=>t.id))}>Alles selecteren</button><button type="button" className="button secondary" onClick={()=>setSelected([])}>Selectie wissen</button></div><p className="field-help" role="status">{selected.length} van {teams.length} teams geselecteerd</p><div className="period-team-options">{teams.map(team=><label className="checkbox" key={team.id}><input type="checkbox" name="team_id" value={team.id} checked={selected.includes(team.id)} onChange={e=>setSelected(e.target.checked?[...selected,team.id]:selected.filter(id=>id!==team.id))}/><span>{team.name}<small className="muted"> · {teamAgeLabels[teamAge(team.name,team.age_class)??'senior']}</small></span></label>)}</div>{!selected.length&&<p className="field-help">Selecteer minstens één thuisteam.</p>}</fieldset>
 <div><SubmitButton className="button" disabled={!available||!selected.length}>Fluitdiensten aanmaken</SubmitButton></div></form>
 {state.error&&<p className="notice error" role="alert">{state.error}</p>}
 {state.counts&&<div className="notice success" role="status"><strong>{state.counts.created} fluitdiensten aangemaakt.</strong><p>Overgeslagen: {state.counts.existing} met een bestaande dienst · {state.counts.excluded} zonder clubscheidsrechter · {state.counts.unknown} met onbekend teamniveau · {state.counts.unavailable} niet meer beschikbaar.</p>{state.counts.unknown>0&&<p>Controleer de teamnamen en competitieniveaus bij Beheer → Teams.</p>}</div>}
 </section>;
}
