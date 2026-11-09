import type { AppData } from './data';
import type { Duty,Profile,Enrollment } from './domain';
import { overlaps } from './domain';
import { canReferee } from './referee-levels';
export function meetsDutyQualification(profile:Profile,duty:Duty) {
 return duty.kind==='referee'?canReferee(profile.referee_qualification,duty.required_qualification):profile.referee_level>=duty.required_level;
}
export function openMemberDuties(data:AppData,now=new Date()) {
 const mine=data.enrollments.filter(e=>e.member_id===data.profile.id&&!e.revoked);
 const team=data.memberships.find(m=>m.member_id===data.profile.id)?.team_id;
 if(!team) return [];
 return data.duties.filter(d=>{
  if(d.cancelled||d.signup_closed||new Date(d.starts_at)<=now||mine.some(e=>e.duty_id===d.id)||!meetsDutyQualification(data.profile,d)||d.assigned_team_id&&d.assigned_team_id!==team) return false;
  if(mine.some(e=>data.duties.some(other=>other.id===e.duty_id&&!other.cancelled&&overlaps(d,other)))) return false;
  const availability=data.availability.find(a=>a.duty_id===d.id);
  return (availability?.occupied ?? 0)<d.capacity||Boolean(availability?.offered_ids.length);
 });
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
export function teamDutyCandidates(data:AppData,duty:Duty,teamId:string) {
 return data.memberships.filter(m=>m.team_id===teamId).flatMap(m=>{
  const p=data.profiles.find(p=>p.id===m.member_id);if(!p||!meetsDutyQualification(p,duty)) return [];
  if(data.enrollments.some(e=>e.member_id===p.id&&!e.revoked&&data.duties.some(d=>d.id===e.duty_id&&!d.cancelled&&overlaps(d,duty)))) return [];
  return [p];
 });
}
