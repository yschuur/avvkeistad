import { statusLabels } from './nevobo/types';

export const matchEventLabels:Record<string,string>={
 moved:'Wedstrijd gewijzigd',cancelled:'Afgelast',unconfirmed:'Status niet bevestigd',
 postponed:'Uitgesteld',played:'Gespeeld',restored:'Opnieuw bevestigd',
};
export type MatchEvent={id:string;match_id:string;revision:number;kind:string;created_at:string;old_state:unknown;new_state:unknown;match:{home_team:string;away_team:string;match_code:string|null}|null};
const fields:Record<string,string>={starts_at:'Begintijd',home_team:'Thuisteam',away_team:'Uitteam',location:'Locatie',address:'Adres',postal_code:'Postcode',city:'Plaats',court:'Veld',status:'Status'};
const formatter=new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
export function logDate(value:string) {
 const instant=new Date(value);return Number.isFinite(instant.getTime())?formatter.format(instant):value;
}
function record(value:unknown):Record<string,unknown> {
 return value!==null && typeof value==='object' && !Array.isArray(value)?value as Record<string,unknown>:{};
}
function text(value:unknown) {
 return typeof value==='string'?value:typeof value==='number'?String(value):null;
}
function fieldValue(field:string,value:unknown) {
 const raw=text(value);
 if(raw===null) return 'Niet vermeld';
 if(raw==='') return 'Leeg';
 if(field==='starts_at') return logDate(raw);
 if(field==='status' && Object.hasOwn(statusLabels,raw)) return statusLabels[raw as keyof typeof statusLabels];
 return raw;
}
export function matchChanges(before:unknown,after:unknown) {
 const oldState=record(before),newState=record(after);
 return Object.entries(fields).filter(([key])=>!Object.is(oldState[key] ?? null,newState[key] ?? null))
  .map(([key,label])=>({key,label,before:fieldValue(key,oldState[key]),after:fieldValue(key,newState[key])}));
}
export function eventMatchName(event:MatchEvent) {
 const state=record(event.new_state),home=text(state.home_team) || event.match?.home_team,away=text(state.away_team) || event.match?.away_team;
 return home&&away?`${home} – ${away}`:'Wedstrijdgegevens niet beschikbaar';
}
export function matchLogUrl(params:Record<string,string|undefined>,page=1,base='/wedstrijden/log') {
 const query=new URLSearchParams();
 if(params.kind && Object.hasOwn(matchEventLabels,params.kind)) query.set('kind',params.kind);
 if(params.match) query.set('match',params.match);
 if(page>1) query.set('page',String(page));
 return base+(query.size?'?'+query:'');
}
