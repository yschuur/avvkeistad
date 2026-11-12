'use client';
import { useEffect,useMemo,useRef,useState } from 'react';
import { fromZonedTime } from 'date-fns-tz';
import { createMatchAvailability,type AvailabilityMatch,type DutyWindow } from '@/lib/match-availability';
import type { Team } from '@/lib/data';
export function AvailableTeamSelect({id,teams,matches=[],duty,teamId,disabled=false,name="team_id",label="Toewijzen aan team"}:{id:string;teams:Team[];matches?:AvailabilityMatch[];duty?:DutyWindow;teamId?:string|null;disabled?:boolean;name?:string;label?:string}) {
 const field=useRef<HTMLDivElement>(null),[selection,setSelection]=useState(teamId??''),[entered,setEntered]=useState<DutyWindow[]>([]);
 useEffect(()=>{
  if(duty)return;
  const form=field.current?.closest('form');if(!form)return;
  const update=()=>{const start=(form.elements.namedItem('start') as HTMLInputElement|null)?.value,end=(form.elements.namedItem('end') as HTMLInputElement|null)?.value;
   if(!start||!end){setEntered([]);return;}
   const weeks=Number((form.elements.namedItem('repeat') as HTMLInputElement|null)?.value??1),count=Number.isInteger(weeks)&&weeks>=1&&weeks<=53?weeks:1;
   const firstStart=new Date(start+'Z').getTime(),firstEnd=new Date(end+'Z').getTime();
   if(!Number.isFinite(firstStart)||!Number.isFinite(firstEnd)){setEntered([]);return;}
   const windows:Array<DutyWindow>=[];
   for(let i=0;i<count;i++) {const a=fromZonedTime(new Date(firstStart+i*7*86400000).toISOString().slice(0,19),'Europe/Amsterdam'),b=fromZonedTime(new Date(firstEnd+i*7*86400000).toISOString().slice(0,19),'Europe/Amsterdam');if(Number.isFinite(a.getTime())&&Number.isFinite(b.getTime()))windows.push({starts_at:a.toISOString(),ends_at:b.toISOString()});}
   setEntered(windows);
  };
  update();form.addEventListener('input',update);form.addEventListener('change',update);return()=>{form.removeEventListener('input',update);form.removeEventListener('change',update);};
 },[duty]);
 const check=useMemo(()=>createMatchAvailability(matches),[matches]);
 const windows=duty?[duty]:entered;
 return <div ref={field} className="team-assignment-field"><label htmlFor={id}>{label}</label><input type="hidden" name={name} value={selection} disabled={disabled}/><select id={id} value={selection} onChange={e=>setSelection(e.target.value)} disabled={disabled}><option value="">Open voor alle teams</option>{teams.map(t=>{const reason=windows.map(window=>check(t.name,window)).find(Boolean);return <option key={t.id} value={t.id} disabled={Boolean(reason)}>{t.name}{reason?` — ${reason}`:''}</option>;})}</select></div>;
}
