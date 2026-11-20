import { dutyDayWindow } from './duty-window';
import { redirect } from 'next/navigation';
import { getData,getIdentity,type AppData,type Match,type DutyParticipant,type Membership } from './data';
import type { Duty,Enrollment,Profile } from './domain';
import { collectPages } from './pagination';
import { supabase } from './supabase/server';
import { filterDutiesByHomeTeam } from './member-duties';
import { planningMonth } from './planning';

export type DutyFilters={kind?:string;team?:string;match?:string;open?:string;day?:string;status?:string;duty?:string;month?:string};
const uuid=(v:string|undefined)=>Boolean(v&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
export async function dutyAvailability(seasonId:string,ids:string[],slots=true):Promise<AppData['availability']> {
 if(!ids.length)return [];
 if(ids.length>100)return (await Promise.all(Array.from({length:Math.ceil(ids.length/100)},(_,i)=>dutyAvailability(seasonId,ids.slice(i*100,(i+1)*100),slots)))).flat();
 const db=await supabase();
 return (await collectPages<AppData['availability'][number]>(async(from,to)=>{
  let r=await db.rpc('duty_availability_for',{p_season:seasonId,p_duties:ids,p_slots:slots},{count:'exact'}).order('duty_id').range(from,to);
  // Rolling deployment: older databases retain their existing availability rules.
  if(r.error&&['PGRST202','42883'].includes(r.error.code))r=await db.rpc('duty_availability',{}, {count:'exact'}).in('duty_id',ids).order('duty_id').range(from,to);
  return {data:r.data,count:r.count,error:r.error};
 })).data;
}
async function memberDuties(base:Pick<AppData,'season'|'teams'>,filters:DutyFilters,day?:string) {
 if(!base.season)return [];
 const db=await supabase();
 const [duties,matches]=await Promise.all([
  collectPages<Duty>(async(from,to)=>{
   let q=db.from('duties').select('*',{count:'exact'}).eq('season_id',base.season!.id).eq('cancelled',false).neq('kind','lines').gt('starts_at',new Date().toISOString());
   if(filters.kind){if(!['bar','referee','event','other'].includes(filters.kind))return {data:[],count:0,error:null};q=q.eq('kind',filters.kind);}
   if(filters.match){if(!uuid(filters.match))return {data:[],count:0,error:null};q=q.eq('match_id',filters.match);}
   if(day){const w=dutyDayWindow(day);q=q.gte('starts_at',w.start).lt('starts_at',w.end);}
   const r=await q.order('starts_at').order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};
  }),
  filters.team?collectPages<Match>(async(from,to)=>{const r=await db.from('matches').select('id,home_team,away_team,starts_at,status,cancelled,location,level,club_referee',{count:'exact'}).eq('season_id',base.season!.id).order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};}):Promise.resolve({data:[] as Match[]}),
 ]);
 return filterDutiesByHomeTeam({...base,matches:matches.data},duties.data,filters.team);
}
export async function memberDutyIndex(filters:DutyFilters) {
 const identity=await getIdentity(),basePromise=getData('profile');
 const [base,duties]=await Promise.all([basePromise,memberDuties(filters.team?await basePromise:{...identity,teams:[]},filters)]);
 const availability=await dutyAvailability(base.season?.id??'',duties.map(d=>d.id),false);
 return {...base,duties,availability};
}
type JoinedEnrollment=Enrollment&{duties:Duty};
type RosterEnrollment=Enrollment&{profile?:Profile};
async function ownEnrollments(base:Pick<AppData,'season'|'profile'>) {
 if(!base.season)return [];
 const db=await supabase();
 return (await collectPages<JoinedEnrollment>(async(from,to)=>{const r=await db.from('enrollments').select('*, duties!inner(*)',{count:'exact'}).eq('duties.season_id',base.season!.id).eq('member_id',base.profile.id).order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};})).data;
}
function mergeDuties(...sets:Duty[][]) {return [...new Map(sets.flat().map(d=>[d.id,d])).values()];}
export async function ownDutyData() {
 const identity=await getIdentity();
 const [base,enrollments]=await Promise.all([getData('profile'),ownEnrollments(identity)]),duties=mergeDuties(enrollments.map(e=>e.duties));
 const availability=await dutyAvailability(base.season?.id??'',duties.map(d=>d.id));
 return {...base,duties,enrollments,availability};
}
export async function memberDutyDay(filters:DutyFilters,day:string) {
 dutyDayWindow(day);
 const identity=await getIdentity(),basePromise=getData('profile');
 const [base,duties,enrollments]=await Promise.all([basePromise,memberDuties(filters.team?await basePromise:{...identity,teams:[]},filters,day),ownEnrollments(identity)]);
 const ids=duties.map(d=>d.id),db=await supabase();
 const [availability,participants]=await Promise.all([
  dutyAvailability(base.season?.id??'',ids),
  ids.length?collectPages<DutyParticipant>(async(from,to)=>{let r=await db.rpc('duty_participants_for',{p_duties:ids}, {count:'exact'}).order('duty_id').order('first_name').order('last_name').range(from,to);if(r.error&&['PGRST202','42883'].includes(r.error.code))r=await db.rpc('duty_participants',{}, {count:'exact'}).in('duty_id',ids).order('duty_id').order('first_name').order('last_name').range(from,to);return {data:r.data,count:r.count,error:r.error};}).then(r=>r.data).catch(()=>null):Promise.resolve([]),
 ]);
 return {data:{...base,duties:mergeDuties(duties,enrollments.map(e=>e.duties)),enrollments,availability},duties,participants};
}
export async function managedDutyData(filters:DutyFilters,kind?:'bar'|'event'|'other',planning=false) {
 const identity=await getIdentity();if(identity.profile.role==='member')redirect('/');
 const basePromise=getData('profile');
 if(!identity.season)return {data:await basePromise,listedDuties:[] as Duty[]};
 const base=identity;
 const db=await supabase(),seasonId=identity.season.id,now=new Date().toISOString(),month=planning&&!filters.match?planningMonth(filters.month??filters.day?.slice(0,7),base.season):null;
 const listedDuties=(await collectPages<Duty>(async(from,to)=>{
  let q=db.from('duties').select('*',{count:'exact'}).eq('season_id',seasonId).eq('cancelled',false);
  if(kind)q=q.in('kind',kind==='other'?['other','lines']:[kind]);else if(filters.kind)q=q.eq('kind',filters.kind);
  if(month)q=q.gte('starts_at',month.start).lt('starts_at',month.end);
  if(filters.day){const w=dutyDayWindow(filters.day);q=q.gte('starts_at',w.start).lt('starts_at',w.end);}
  if(filters.status==='history')q=q.lte('starts_at',now);else if(!planning||filters.status==='open')q=q.gt('starts_at',now);
  if(filters.status==='open')q=q.eq('signup_closed',false);
  if(filters.match){if(!uuid(filters.match))return {data:[],count:0,error:null};q=q.eq('match_id',filters.match);}
  if(filters.team){if(!uuid(filters.team))return {data:[],count:0,error:null};q=q.or(`assigned_team_id.eq.${filters.team},slot_team_ids.cs.{${filters.team}}`);}
  const r=await q.order('starts_at').order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};
 })).data;
 const context=await basePromise;
 const selected=listedDuties.find(d=>d.id===filters.duty),ids=listedDuties.map(d=>d.id);
 const [roster,memberships,profiles,conflictDuties,conflictEnrollments,matches]=await Promise.all([
  Promise.all(Array.from({length:Math.ceil(ids.length/100)},(_,i)=>collectPages<RosterEnrollment>(async(from,to)=>{const r=await db.from('enrollments').select('*, profile:profiles(*)',{count:'exact'}).in('duty_id',ids.slice(i*100,(i+1)*100)).eq('revoked',false).order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};}))).then(parts=>({data:parts.flatMap(p=>p.data)})),
  selected?collectPages<Membership>(async(from,to)=>{const r=await db.from('memberships').select('*',{count:'exact'}).eq('season_id',seasonId).order('member_id').range(from,to);return {data:r.data,count:r.count,error:r.error};}):Promise.resolve({data:context.memberships}),
  selected?collectPages<Profile>(async(from,to)=>{const r=await db.from('profiles').select('*',{count:'exact'}).order('last_name').order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};}):Promise.resolve({data:context.profiles}),
  selected?collectPages<Duty>(async(from,to)=>{const r=await db.from('duties').select('*',{count:'exact'}).eq('season_id',seasonId).lt('starts_at',selected.ends_at).gt('ends_at',selected.starts_at).order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};}):Promise.resolve({data:[] as Duty[]}),
  selected?collectPages<Enrollment>(async(from,to)=>{const r=await db.from('enrollments').select('*, duties!inner(season_id)',{count:'exact'}).eq('duties.season_id',seasonId).lt('duties.starts_at',selected.ends_at).gt('duties.ends_at',selected.starts_at).eq('revoked',false).order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};}):Promise.resolve({data:[] as Enrollment[]}),
  collectPages<Match>(async(from,to)=>{const r=await db.from('matches').select('id,home_team,away_team,starts_at,status,cancelled,location,level,club_referee',{count:'exact'}).eq('season_id',seasonId).in('status',['scheduled','played']).eq('cancelled',false).order('starts_at').order('id').range(from,to);return {data:r.data,count:r.count,error:r.error};}),
 ]);
 return {listedDuties,data:{...context,duties:mergeDuties(listedDuties,conflictDuties.data),enrollments:[...new Map([...roster.data,...conflictEnrollments.data].map(e=>[e.id,e])).values()],memberships:memberships.data,profiles:[...new Map([...profiles.data,...roster.data.flatMap(e=>e.profile?[e.profile]:[])].map(p=>[p.id,p])).values()],matches:matches.data}};
}
