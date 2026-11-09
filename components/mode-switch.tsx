'use client';
import { usePathname,useRouter } from 'next/navigation';
import { useTransition } from 'react';
export function ModeSwitch() {
 const path=usePathname(),router=useRouter(),[pending,startTransition]=useTransition();
 const active=path==='/beheer'||path.startsWith('/beheer/');
 return <button type="button" className="mode-switch" role="switch" aria-label="Beheermodus" aria-checked={active} disabled={pending} onClick={()=>startTransition(()=>router.push(active?'/':'/beheer'))}>
  <span><strong>Beheermodus</strong><small>{pending?'Omgeving laden…':active?'Naar ledenomgeving':'Naar beheeromgeving'}</small></span><span className="switch-track" aria-hidden="true"><span/></span>
 </button>;
}
