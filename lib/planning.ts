import { formatInTimeZone,fromZonedTime } from 'date-fns-tz';
import type { Season } from './seasons';
export function planningMonth(requested:string|undefined,season:Pick<Season,'starts_on'|'ends_on'>|null,now=new Date()) {
 const valid=(v:string|undefined)=>Boolean(v&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v));
 const first=season?.starts_on.slice(0,7),last=season?.ends_on.slice(0,7);
 let month=valid(requested)?requested!:formatInTimeZone(now,'Europe/Amsterdam','yyyy-MM');
 if(first&&month<first) month=first;if(last&&month>last) month=last;
 const [year,m]=month.split('-').map(Number),next=formatInTimeZone(new Date(Date.UTC(year,m,1,12)),'UTC','yyyy-MM');
 const start=fromZonedTime(`${month}-01T00:00:00`,'Europe/Amsterdam').toISOString(),end=fromZonedTime(`${next}-01T00:00:00`,'Europe/Amsterdam').toISOString();
 const months:string[]=[];
 if(first&&last) {let cursor=first;while(cursor<=last&&months.length<1200) {months.push(cursor);const [y,m]=cursor.split('-').map(Number);cursor=formatInTimeZone(new Date(Date.UTC(y,m,1,12)),'UTC','yyyy-MM');}}
 else months.push(month);
 return {month,start,end,months,label:monthLabel(month)};
}
export function monthLabel(month:string) {return new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));}
export function planningUrl(params:Record<string,string|undefined>,changes:Record<string,string|undefined>={}) {
 const search=new URLSearchParams();for(const k of ['month','status','day','team','kind','match','duty']) {const v=k in changes?changes[k]:params[k];if(v)search.set(k,v);}
 return '/beheer/planning'+(search.size?'?'+search:'');
}
export function pageNumbers(current:number,total:number) {return Array.from({length:total},(_,i)=>i+1).filter(i=>total<=9||i===1||i===total||Math.abs(i-current)<=2);}
