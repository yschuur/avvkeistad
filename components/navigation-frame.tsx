'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { MobileNavLinks } from './nav';

export function WorkspaceFrame({children}:{children:React.ReactNode}) {
  const path=usePathname(),management=path==='/beheer'||path.startsWith('/beheer/');
  return <div className={`app-shell ${management?'management-workspace':'member-workspace'}`}>{children}</div>;
}

export function NavigationFrame({children,management,captain}:{children:React.ReactNode;management:boolean;captain:boolean}) {
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null),drawer=useRef<HTMLElement>(null);
  const path=usePathname();
  useEffect(()=>{setOpen(false);},[path]);
  useEffect(()=>{
    const desktop=window.matchMedia('(min-width: 769px)');
    const resize=()=>{if(desktop.matches) setOpen(false);};
    desktop.addEventListener('change',resize);
    return ()=>desktop.removeEventListener('change',resize);
  },[]);
  useEffect(()=>{
    if(!open) return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const getItems=()=>Array.from(drawer.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),[tabindex="0"]') ?? []);
    getItems()[0]?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setOpen(false);}
      if(event.key==='Tab'){
        const items=getItems(),first=items[0],last=items.at(-1);
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    window.addEventListener('keydown',key);
    return ()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',key);trigger.current?.focus();};
  },[open]);
  const adminMode=management&&(path==='/beheer'||path.startsWith('/beheer/'));
  return <><button ref={trigger} className="mobile-menu-trigger icon-button" onClick={()=>setOpen(true)} aria-label="Navigatiemenu openen" aria-controls="app-navigation" aria-expanded={open}><Menu size={20} aria-hidden="true"/><span className="mobile-menu-label">Menu</span></button><nav className="mobile-navigation" aria-label={adminMode?'Mobiele beheernavigatie':'Mobiele hoofdnavigatie'}><MobileNavLinks management={management} captain={captain}/></nav>
    {open && <button className="menu-backdrop" aria-label="Navigatiemenu sluiten" tabIndex={-1} onClick={()=>setOpen(false)}/>}
    <aside id="app-navigation" ref={drawer} className={`sidebar ${open?'is-open':''}`} role={open?'dialog':undefined} aria-modal={open || undefined} aria-label="Navigatie" onClick={event=>{if((event.target as HTMLElement).closest('a')) setOpen(false);}}>
      <button className="mobile-menu-close icon-button" onClick={()=>setOpen(false)} aria-label="Navigatiemenu sluiten"><X size={20} aria-hidden="true"/><span>Sluiten</span></button>{children}
    </aside></>;
}
