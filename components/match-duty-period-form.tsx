'use client';
import { useActionState,useState } from 'react';
import { createMatchDutiesForPeriod } from '@/app/actions';
import { SubmitButton } from '@/components/submit-button';
export function MatchDutyPeriodForm({season,today,available,points}:{season:string;today:string;available:boolean;points:number|null}) {
 const [dates,setDates]=useState({from:today,until:today});
 const [state,action]=useActionState(createMatchDutiesForPeriod,{});
 return <section className="panel" aria-labelledby="match-duty-period-heading"><h2 id="match-duty-period-heading">Fluitdiensten voor een periode</h2>
 <p className="field-help">Maak in één keer fluitdiensten voor alle komende thuiswedstrijden in de gekozen periode (beide datums inbegrepen). Bestaande diensten blijven behouden. Wedstrijden vanaf Promotieklasse worden overgeslagen. De diensten staan open voor alle teams; toewijzen kan daarna per dienst.</p>
 {points!==null&&<p className="field-help">{points} punten per fluitbeurt, volgens Instellingen → Diensten. De duur en het vereiste niveau worden automatisch bepaald.</p>}
 <form action={action} className="form-grid" aria-label="Fluitdiensten voor periode aanmaken"><input type="hidden" name="season" value={season}/>
 <div><label htmlFor="match-duty-from">Vanaf</label><input id="match-duty-from" type="date" name="from" required value={dates.from} onChange={e=>setDates({...dates,from:e.target.value})}/></div>
 <div><label htmlFor="match-duty-until">Tot en met</label><input id="match-duty-until" type="date" name="until" required value={dates.until} onChange={e=>setDates({...dates,until:e.target.value})}/></div>
 <div><SubmitButton className="button" disabled={!available}>Fluitdiensten aanmaken</SubmitButton></div></form>
 {state.error&&<p className="notice error" role="alert">{state.error}</p>}
 {state.counts&&<div className="notice success" role="status"><strong>{state.counts.created} fluitdiensten aangemaakt.</strong><p>Overgeslagen: {state.counts.existing} met een bestaande dienst · {state.counts.excluded} zonder clubscheidsrechter · {state.counts.unknown} met onbekend teamniveau · {state.counts.unavailable} niet meer beschikbaar.</p>{state.counts.unknown>0&&<p>Controleer de teamnamen en competitieniveaus bij Beheer → Teams.</p>}</div>}
 </section>;
}
