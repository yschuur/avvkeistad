import { z } from 'zod';
import { statusLabels, type MatchStatus } from './nevobo/types';

export type MatchFilterRecord={id:string;home_team:string;away_team:string;starts_at:string|null;location:string;city?:string|null;status?:string;cancelled?:boolean};
export type MatchView='upcoming'|'history'|'all';
export const matchFilterStatusLabels={...statusLabels,elapsed:'Afgelopen'};
export type DisplayMatchStatus=keyof typeof matchFilterStatusLabels;
export type MatchFilters={view:MatchView;day:string;team:string;location:string;status:string;match:string};
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'});
export function matchDay(value:string|null) {
 if(!value) return '';
 const instant=new Date(value);if(!Number.isFinite(instant.getTime())) return '';
 const parts=dayFormatter.formatToParts(instant),part=(type:string)=>parts.find(p=>p.type===type)?.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function displayMatchStatus(match:MatchFilterRecord,now:Date):DisplayMatchStatus {
 if(match.cancelled) return 'cancelled';
 const status=match.status ?? 'scheduled';
 if(status==='scheduled' && match.starts_at && new Date(match.starts_at)<=now) return 'elapsed';
 return Object.hasOwn(statusLabels,status)?status as MatchStatus:'missing';
}
export function matchLocationValue(match:Pick<MatchFilterRecord,'location'|'city'>) {
 // Distinguish venues with the same name in different towns; no invented IDs.
 return JSON.stringify([match.location.trim(),match.city?.trim() ?? '']);
}
export function matchLocationLabel(match:Pick<MatchFilterRecord,'location'|'city'>) {
 return [match.location.trim() || 'Niet vermeld',match.city?.trim()].filter(Boolean).join(' · ');
}
export function matchFilters(params:Record<string,string|undefined>):MatchFilters {
 return {view:params.view==='history'?'history':params.view==='all'?'all':'upcoming',
  day:z.iso.date().safeParse(params.day).success?params.day!:'',team:params.team ?? '',location:params.location ?? '',
  status:Object.hasOwn(matchFilterStatusLabels,params.status ?? '')?params.status!:'',match:params.match ?? ''};
}
export function selectMatches<T extends MatchFilterRecord>(source:T[],filters:MatchFilters,now:Date):T[] {
 const matches=source.filter(m=>{
  if(filters.match && m.id!==filters.match) return false;
  const past=m.status==='played'||Boolean(m.starts_at && new Date(m.starts_at)<=now);
  if(filters.view==='history'?!past:filters.view==='upcoming'&&past) return false;
  return (!filters.day||matchDay(m.starts_at)===filters.day)
   && (!filters.team||m.home_team===filters.team||m.away_team===filters.team)
   && (!filters.location||matchLocationValue(m)===filters.location)
   && (!filters.status||displayMatchStatus(m,now)===filters.status);
 });
 return filters.view==='history'?matches.reverse():matches;
}
export function matchFilterUrl(filters:MatchFilters,options:{view?:MatchView;page?:number;clearMatch?:boolean}={}) {
 const params=new URLSearchParams({view:options.view ?? filters.view});
 for(const key of ['day','team','location','status','match'] as const) {
  if(filters[key] && !(key==='match'&&options.clearMatch)) params.set(key,filters[key]);
 }
 if(options.page) params.set('page',String(options.page));
 return '/wedstrijden?'+params;
}
