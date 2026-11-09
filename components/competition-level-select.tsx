import { COMPETITION_LEVELS } from '@/lib/competition-rules';
export function CompetitionLevelSelect({id,value}:{id:string;value?:string|null}) {
 return <div className="season-field"><label htmlFor={id}>Competitieniveau</label><select id={id} name="competition" defaultValue={value ?? 'Overig'} required>{COMPETITION_LEVELS.map(level=><option key={level} value={level}>{level==='Overig'?'Overig / geen niveau vermeld':level}</option>)}</select></div>;
}
