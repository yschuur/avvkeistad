import type { Duty,Enrollment } from './domain';
export type DutySlot={slot:number;team_id:string|null;occupied:boolean;offered_id?:string|null};
export function dutySlotTeams(duty:Duty):(string|null)[] {
 return duty.slot_team_ids?.length===duty.capacity?duty.slot_team_ids:Array.from({length:duty.capacity},()=>duty.assigned_team_id);
}
export function dutySlots(duty:Duty,availability?:{slots?:DutySlot[];occupied:number;offered_ids?:string[]},enrollments:Enrollment[]=[]):DutySlot[] {
 if(availability?.slots) return availability.slots;
 const active=enrollments.filter(e=>e.duty_id===duty.id&&!e.revoked);
 return dutySlotTeams(duty).map((team_id,i)=>({slot:i+1,team_id,offered_id:availability?.offered_ids?.[i]??null,occupied:active.some(e=>e.slot_number===i+1)||!active.some(e=>e.slot_number)&&i<(availability?.occupied??active.length)}));
}
export function teamSlotSummary(duty:Duty,teamId:string,availability?:{slots?:DutySlot[];occupied:number;offered_ids?:string[]},enrollments:Enrollment[]=[]) {
 const slots=dutySlots(duty,availability,enrollments).filter(s=>s.team_id===teamId);
 return {slots,total:slots.length,filled:slots.filter(s=>s.occupied).length,remaining:slots.filter(s=>!s.occupied).length};
}
export function canTakeDutySlot(duty:Duty,teamId:string|undefined,availability?:{slots?:DutySlot[];occupied:number;offered_ids?:string[]},enrollments:Enrollment[]=[]) {
 return Boolean(teamId&&dutySlots(duty,availability,enrollments).some(s=>(s.team_id===null||s.team_id===teamId)&&(!s.occupied||s.offered_id)));
}
export function dutyTeamSummary(duty:Duty,teams:{id:string;name:string}[]) {
 const counts=new Map<string|null,number>();for(const id of dutySlotTeams(duty)) counts.set(id,(counts.get(id)??0)+1);
 return [...counts].map(([id,n])=>`${id?teams.find(t=>t.id===id)?.name??'Team niet beschikbaar':'Open voor alle teams'}: ${n} ${n===1?'plek':'plekken'}`).join(' · ');
}
