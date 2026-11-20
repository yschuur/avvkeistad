'use client';
import { useRef,useState,type ReactNode } from 'react';
import { loadDutyDay } from '@/app/diensten/actions';
import type { DutyFilters } from '@/lib/duty-loading';
export function DutyDay({day,label,count,vacancies,filters}:{day:string;label:string;count:number;vacancies:number;filters:DutyFilters}) {
 const [content,setContent]=useState<ReactNode>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 const request=useRef(0),details=useRef<HTMLDetailsElement>(null);
 async function load(){const id=++request.current;setLoading(true);setError(false);setContent(null);try{const result=await loadDutyDay(day,filters);if(id===request.current)setContent(result);}catch{if(id===request.current)setError(true);}finally{if(id===request.current)setLoading(false);}}
 return <details ref={details} className="duty-day" onToggle={()=>{if(details.current?.open)void load();else{request.current++;setLoading(false);}}}><summary><span>{label}</span><span className="muted small">{count} {count===1?'dienst':'diensten'} · {vacancies} vrije plekken</span></summary><div className="duty-day-entries" aria-busy={loading}>{loading&&<p role="status">Diensten laden…</p>}{error&&<div><p role="alert">De diensten konden niet worden geladen.</p><button type="button" className="button secondary" onClick={()=>void load()}>Opnieuw proberen</button></div>}{!loading&&!error&&content}</div></details>;
}
