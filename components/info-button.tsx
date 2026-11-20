'use client';
import { useEffect,useId,useRef,useState,type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info,X } from 'lucide-react';

export function InfoButton({topic,children}:{topic:string;children:ReactNode}) {
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false);
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[open]);
 return <span className="info-inline"><button ref={trigger} type="button" className="info-trigger" aria-label={`Uitleg over ${topic}`} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={()=>{if(dialog.current){dialog.current.showModal();setOpen(true);}}}><Info size={17} aria-hidden="true"/></button>{mounted&&createPortal(<dialog ref={dialog} id={id} className="info-dialog" aria-labelledby={id+'-title'} aria-describedby={id+'-body'} onClose={()=>{setOpen(false);trigger.current?.focus({preventScroll:true});}} onClick={event=>{
  if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.current?.close();
 }}><div className="info-dialog-heading"><h2 id={id+'-title'}>{topic}</h2><button type="button" className="icon-button" aria-label="Uitleg sluiten" onClick={()=>dialog.current?.close()}><X size={20} aria-hidden="true"/></button></div><div id={id+'-body'} className="info-dialog-body">{children}</div><div className="dialog-actions"><button type="button" className="button secondary" onClick={()=>dialog.current?.close()}>Sluiten</button></div></dialog>,document.body)}</span>;
}
