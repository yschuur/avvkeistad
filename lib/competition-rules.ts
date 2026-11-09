import { z } from 'zod';
import { REFEREE_LEVELS, type RefereeLevel } from './referee-levels';

export const COMPETITION_LEVELS=['Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie','Promotieklasse','Hoofdklasse','Eerste klasse','Tweede klasse','Derde klasse','Vierde klasse','Overig'] as const;
export const competitionLevelSchema=z.enum(COMPETITION_LEVELS);
export function teamRefereeRequirement(age:string,level:string|null|undefined):RefereeLevel {
 if(['Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie'].includes(level ?? '')) return 'R1';
 if(level==='Promotieklasse') return 'R2';
 if((age==='senior' && ['Eerste klasse','Tweede klasse'].includes(level ?? '')) || (age==='youth' && level==='Hoofdklasse')) return 'V4';
 return 'V6';
}
// Sponsoring does not change team identity. Match names must identify Keistad;
// short internal names support remapping existing team memberships on import.
export function keistadTeamKey(name:string,short=false):string|null {
 const full=name.trim().match(/\bkeistad\s+(HS|DS|JA|JB|JC|MA|MB|MC|XZ|L[1-6])\s*(\d+)$/i);
 if(full) return full[1].toUpperCase()+Number(full[2]);
 if(!short) return null;
 const code=name.trim().match(/^(HS|DS|JA|JB|JC|MA|MB|MC|XZ|L[1-6])\s*(\d+)$/i);
 if(code) return code[1].toUpperCase()+Number(code[2]);
 const adult=name.trim().match(/^(Heren|Dames|H|D)\s*(\d+)$/i);
 return adult?(/^(Heren|H)$/i.test(adult[1])?'HS':'DS')+Number(adult[2]):null;
}
type CompetitionTeam={name:string;age_class:string;competition_level?:string|null};
export function matchRefereeRequirement(match:{home_team:string;away_team:string},teams:CompetitionTeam[]):RefereeLevel|null {
 const clubNames=[match.home_team,match.away_team].filter(name=>/\bkeistad\b/i.test(name));
 if(!clubNames.length) return null;
 const required:RefereeLevel[]=[];
 for(const name of clubNames) {
  const key=keistadTeamKey(name);
  const found=teams.filter(t=>key && keistadTeamKey(t.name,true)===key);
  if(found.length!==1 || found[0].competition_level===undefined) return null;
  required.push(teamRefereeRequirement(found[0].age_class,found[0].competition_level));
 }
 return required.sort((a,b)=>REFEREE_LEVELS.indexOf(b)-REFEREE_LEVELS.indexOf(a))[0];
}

export function clubRefereeRequired(requirement:RefereeLevel|null):boolean|null {
 return requirement===null?null:REFEREE_LEVELS.indexOf(requirement)<REFEREE_LEVELS.indexOf('R2');
}
