import { z } from 'zod';

export type Season = {
 id:string;name:string;starts_on:string;ends_on:string;active:boolean;
 default_norm:number;youth_norm:number|null;senior_norm:number|null;updated_at:string;
};
export type SeasonValues={name:string;start:string;end:string;norm:string;youth:string;senior:string};
export type SeasonFormState={error?:string;errors?:Partial<Record<keyof SeasonValues,string>>};
const points=z.number().finite().min(0,'Vul minimaal 0 punten in.').max(999999.99,'Vul maximaal 999999,99 punten in.').multipleOf(0.01,'Gebruik maximaal twee decimalen.');
const requiredPoints=z.string().trim().min(1,'Vul de algemene puntennorm in.').transform(value=>Number(value)).pipe(points);
const optionalPoints=z.string().trim().transform(value=>value===''?null:Number(value)).pipe(points.nullable());
export const seasonSchema=z.object({
 name:z.string().trim().min(1,'Vul een seizoensnaam in.').max(120,'Gebruik maximaal 120 tekens.'),
 start:z.iso.date('Kies een geldige begindatum.'),end:z.iso.date('Kies een geldige einddatum.'),
 norm:requiredPoints,youth:optionalPoints,senior:optionalPoints,
}).refine(value=>value.end>=value.start,{path:['end'],message:'De einddatum moet op of na de begindatum liggen.'});
export function seasonValues(season:Season):SeasonValues {
 return {name:season.name,start:season.starts_on,end:season.ends_on,norm:String(season.default_norm),youth:season.youth_norm===null?'':String(season.youth_norm),senior:season.senior_norm===null?'':String(season.senior_norm)};
}
export function seasonDate(value:string) {
 return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Amsterdam'}).format(new Date(value));
}
function nextYear(value:string) {
 const [year,month,day]=value.split('-').map(Number),lastDay=new Date(Date.UTC(year+1,month,0)).getUTCDate();
 return `${year+1}-${String(month).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
}
/** A proposal derived from a saved season, never an invented club calendar. */
export function nextSeasonValues(previous:Season|null):SeasonValues {
 if(!previous) return {name:'',start:'',end:'',norm:'',youth:'',senior:''};
 const values=seasonValues(previous);
 const years=previous.name.match(/^(.*?)(\d{4})(\s*[/–-]\s*)(\d{4})([^\d]*)$/);
 return {...values,name:years && Number(years[4])===Number(years[2])+1?`${years[1]}${Number(years[2])+1}${years[3]}${Number(years[4])+1}${years[5]}`:'',start:nextYear(previous.starts_on),end:nextYear(previous.ends_on)};
}
