'use server';
import { memberDutyDay,type DutyFilters } from '@/lib/duty-loading';
import { dutyVacancy } from '@/lib/member-duties';
import { DutyCard } from '@/components/ui';
export async function loadDutyDay(day:string,filters:DutyFilters) {
 const {data,duties,participants}=await memberDutyDay(filters,day);
 const byDuty=new Map<string,NonNullable<typeof participants>>();
 for(const p of participants??[]){const group=byDuty.get(p.duty_id)??[];group.push(p);byDuty.set(p.duty_id,group);}
 const visible=duties.filter(d=>filters.open!=='1'||dutyVacancy(data,d).open);
 return <>{participants===null&&<p className="notice">De namen van ingeplande leden konden niet worden geladen. Sluit en open deze dag om opnieuw te proberen.</p>}{visible.map(d=><DutyCard key={d.id} duty={d} data={data} listView participants={byDuty.get(d.id)??(participants===null?undefined:[])}/>)}{!visible.length&&<p className="empty-state">Geen diensten meer in deze selectie.</p>}</>;
}
