'use client';
import { useId,useState } from 'react';
import { SlidersHorizontal,ChevronDown } from 'lucide-react';
export function FilterPanel({children,active=false}:{children:React.ReactNode;active?:boolean}) {
 const [open,setOpen]=useState(active),id=useId();
 return <div className={`filter-panel ${open?'is-open':''}`}><button type="button" className="button secondary filter-toggle" onClick={()=>setOpen(!open)} aria-controls={id} aria-expanded={open}><SlidersHorizontal size={16}/>{open?'Filters verbergen':'Filters tonen'}{active&&<span className="badge">Actief</span>}<ChevronDown size={16}/></button><div id={id} className="filter-panel-content">{children}</div></div>;
}
