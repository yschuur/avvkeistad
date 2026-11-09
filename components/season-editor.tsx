'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { saveSeason } from '@/app/actions';
import { nextSeasonValues,seasonValues,type Season,type SeasonValues,type SeasonFormState } from '@/lib/seasons';
import { SubmitButton } from './submit-button';

export function SeasonEditor({season,previous,hasActive}:{season:Season|null;previous:Season|null;hasActive:boolean}) {
 const initial=season?seasonValues(season):nextSeasonValues(previous);
 const [values,setValues]=useState(initial);
 const [state,action]=useActionState<SeasonFormState,FormData>(saveSeason,{});
 const form=useRef<HTMLFormElement>(null);
 const dirty=JSON.stringify(values)!==JSON.stringify(initial);
 useEffect(()=>{if(state.errors) form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();},[state]);
 function field(name:keyof SeasonValues,label:string,type='text',required=true) {
  const error=state.errors?.[name],help=name==='youth'||name==='senior'?`${name}-help`:undefined;
  return <div className="season-field"><label htmlFor={`season-${name}`}>{label}</label><input id={`season-${name}`} name={name} type={type} value={values[name]} required={required}
   onChange={e=>setValues({...values,[name]:e.target.value})} min={type==='number'?0:undefined} max={type==='number'?999999.99:undefined} step={type==='number'?'0.01':undefined} maxLength={name==='name'?120:undefined}
   aria-invalid={error?true:undefined} aria-describedby={[help,error?`${name}-error`:null].filter(Boolean).join(' ')||undefined}/>
   {help && <span id={help} className="field-help">Leeg gebruikt de algemene norm. Vul 0 in voor vrijstelling.</span>}
   {error && <span className="field-error" id={`${name}-error`}>{error}</span>}
  </div>;
 }
 return <section className="panel" id="seizoenformulier" aria-labelledby="season-editor-heading" tabIndex={-1}>
  <h2 id="season-editor-heading">{season?'Seizoen bewerken':'Nieuw seizoen aanmaken'}</h2>
  {!season && previous && <p className="muted">De datums en normen zijn een voorstel op basis van {previous.name}. Controleer de gegevens voordat je opslaat.</p>}
  <form ref={form} action={action} className="stack-form">
   <input type="hidden" name="season_id" value={season?.id ?? ''}/><input type="hidden" name="updated_at" value={season?.updated_at ?? ''}/>
   {field('name','Seizoensnaam')}
   <div className="form-grid">{field('start','Begindatum','date')}{field('end','Einddatum','date')}</div>
   {field('norm','Algemene puntennorm','number')}
   <div className="form-grid">{field('youth','Puntennorm jeugd','number',false)}{field('senior','Puntennorm senioren','number',false)}</div>
   <p className="field-help">Een persoonlijke norm gaat voor de leeftijdsnorm; daarna geldt de algemene norm. Een gewijzigde norm past het puntendoel aan, niet de behaalde punten.</p>
   {!season && <p className="field-help">{hasActive?'Het huidige seizoen blijft actief. Je kunt dit seizoen na het opslaan apart activeren.':'Dit wordt het actieve seizoen, omdat er nog geen actief seizoen is.'} Teamindelingen en diensten worden niet automatisch overgenomen.</p>}
   {state.error && <p className="notice error" role="alert">{state.error}</p>}
   <div className="form-actions"><SubmitButton className="button" disabled={Boolean(season)&&!dirty}>{season?'Wijzigingen opslaan':'Seizoen aanmaken'}</SubmitButton><Link className="button secondary" href="/beheer">Annuleren</Link></div>
   {dirty && <p className="field-help" role="status">Niet-opgeslagen wijzigingen.</p>}
  </form>
 </section>;
}
