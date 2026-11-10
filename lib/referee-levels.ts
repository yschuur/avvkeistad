import { z } from 'zod';
export const REFEREE_LEVELS=['V6','V4','R2.2','R2','R1','N3','N2','N1'] as const;
export type RefereeLevel=typeof REFEREE_LEVELS[number];
export const refereeLevelSchema=z.enum(REFEREE_LEVELS);
export function isRefereeLevel(value:unknown):value is RefereeLevel {
 return typeof value==='string' && REFEREE_LEVELS.includes(value as RefereeLevel);
}
export function canReferee(member:unknown,required:unknown) {
 return isRefereeLevel(member)&&isRefereeLevel(required)&&REFEREE_LEVELS.indexOf(member)>=REFEREE_LEVELS.indexOf(required);
}
export function refereeScope(value:unknown):string {
 if(!isRefereeLevel(value)) return 'Niet ingesteld';
 if(['N2','N1'].includes(value)) return 't/m Superdivisie';
 if(['R1','N3'].includes(value)) return 't/m 3e Divisie';
 if(value==='R2') return 't/m Promotieklasse';
 if(['V4','R2.2'].includes(value)) return 't/m 1e & 2e klasse (senioren) en Hoofdklasse (jeugd)';
 return 'Overige klassen (senioren en jeugd)';
}
export function refereeDescription(value:unknown):string {
 return isRefereeLevel(value)?`${refereeScope(value)} (${value})`:'Niet ingesteld';
}
