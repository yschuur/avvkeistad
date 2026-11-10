import type { AppData } from './data';
import type { Duty,Profile,Enrollment } from './domain';
import { overlaps } from './domain';
import { canReferee,isRefereeLevel,refereeDescription } from './referee-levels';
export function meetsDutyQualification(profile:Profile,duty:Duty) {
 return duty.kind==='referee'?canReferee(profile.referee_qualification,duty.required_qualification):profile.referee_level>=duty.required_level;
}
export function openMemberDuties(data:AppData,now=new Date()) {
 const mine=data.enrollments.filter(e=>e.member_id===data.profile.id&&!e.revoked);
 const team=data.memberships.find(m=>m.member_id===data.profile.id)?.team_id;
 if(!team) return [];
 return data.duties.filter(d=>{
  if(d.kind==='lines'||d.cancelled||d.signup_closed||new Date(d.starts_at)<=now||mine.some(e=>e.duty_id===d.id)||!meetsDutyQualification(data.profile,d)||d.assigned_team_id&&d.assigned_team_id!==team) return false;
  if(mine.some(e=>data.duties.some(other=>other.id===e.duty_id&&!other.cancelled&&overlaps(d,other)))) return false;
  const availability=data.availability.find(a=>a.duty_id===d.id);
  return (availability?.occupied ?? 0)<d.capacity||Boolean(availability?.offered_ids.length);
 });
}
export function listedMemberDuties(data:AppData,now=new Date()) {
 return data.duties.filter(d=>d.kind!=='lines'&&!d.cancelled&&new Date(d.starts_at)>now).sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime()||a.id.localeCompare(b.id));
}
export function dutyVacancy(data:AppData,duty:Duty,now=new Date()) {
 const availability=data.availability.find(a=>a.duty_id===duty.id);
 const occupied=Number(availability?.occupied ?? 0),remaining=Math.max(0,duty.capacity-occupied),offered=availability?.offered_ids.length ?? 0;
 return {occupied,remaining,offered,open:!duty.cancelled&&!duty.signup_closed&&new Date(duty.starts_at)>now&&(remaining>0||offered>0)};
}
export function groupDutiesByDay(duties:Duty[]) {
 const days=new Map<string,Duty[]>();
 for(const duty of duties) {
  const day=new Date(duty.starts_at).toLocaleDateString('sv-SE',{timeZone:'Europe/Amsterdam'});
  days.set(day,[...(days.get(day) ?? []),duty]);
 }
 return [...days].sort(([a],[b])=>a.localeCompare(b));
}
export function ownDutyEntries(data:AppData) {
 const entries=new Map<string,{duty:Duty;enrollment:Enrollment}>();
 for(const e of data.enrollments.filter(e=>e.member_id===data.profile.id)) {
  const d=data.duties.find(d=>d.id===e.duty_id);if(!d) continue;
  const current=entries.get(d.id)?.enrollment;
  if(!current||current.revoked&&!e.revoked||current.revoked===e.revoked&&new Date(e.created_at)>new Date(current.created_at)) entries.set(d.id,{duty:d,enrollment:e});
 }
 return [...entries.values()];
}
export function teamDutyOptions(data:AppData,duty:Duty,teamId:string) {
 return data.memberships.filter(m=>m.team_id===teamId).flatMap(m=>{
  const profile=data.profiles.find(p=>p.id===m.member_id);if(!profile) return [];
  let reason:string|null=null;
  if(duty.kind==='referee'&&!isRefereeLevel(duty.required_qualification)) reason='Het vereiste scheidsrechtersniveau moet door de beheerder worden ingesteld.';
  else if(!meetsDutyQualification(profile,duty)) reason=duty.kind==='referee'
   ? `Niet de juiste scheidsrechterslicentie: ${isRefereeLevel(profile.referee_qualification)?refereeDescription(profile.referee_qualification):'niveau niet ingesteld'}; minimaal ${refereeDescription(duty.required_qualification)} vereist.`
   : 'Niet het juiste niveau voor deze dienst.';
  else if(data.enrollments.some(e=>e.member_id===profile.id&&!e.revoked&&e.duty_id===duty.id)) reason='Al toegewezen aan deze dienst.';
  else if(data.enrollments.some(e=>e.member_id===profile.id&&!e.revoked&&data.duties.some(d=>d.id===e.duty_id&&!d.cancelled&&overlaps(d,duty)))) reason='Al ingepland op een overlappende dienst.';
  return [{profile,reason}];
 });
}
export function teamDutyCandidates(data:AppData,duty:Duty,teamId:string) {
 return teamDutyOptions(data,duty,teamId).filter(option=>!option.reason).map(option=>option.profile);
}
