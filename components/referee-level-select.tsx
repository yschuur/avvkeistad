import { REFEREE_LEVELS,isRefereeLevel } from '@/lib/referee-levels';
export function RefereeLevelSelect({id,label,value,optional=false}:{id:string;label:string;value?:string|null;optional?:boolean}) {
 return <div className="season-field"><label htmlFor={id}>{label}</label><select id={id} name="qualification" defaultValue={isRefereeLevel(value)?value:''} required={!optional} aria-describedby={`${id}-help`}>
  <option value="" disabled={!optional}>{optional?'Niet ingesteld':'Kies een niveau'}</option>{REFEREE_LEVELS.map(level=><option key={level} value={level}>{level}</option>)}
 </select><small className="field-help" id={`${id}-help`}>V6 is het laagste niveau; N1 het hoogste.</small></div>;
}
