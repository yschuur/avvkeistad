'use client';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Users, Bell, Trophy, Settings2, SlidersHorizontal } from 'lucide-react';
function NavigationStatus() {
  const {pending}=useLinkStatus();
  return pending?<span className="nav-pending" role="status"><span className="loading-spinner" aria-hidden="true"/><span className="sr-only">Pagina laden…</span></span>:null;
}
export function Nav({management,captain,unread}:{management:boolean;captain:boolean;unread:number|null}) {
  const path=usePathname();
  const links=[{href:'/',label:'Mijn overzicht',icon:LayoutDashboard},{href:'/diensten',label:'Diensten',icon:CalendarDays},{href:'/wedstrijden',label:'Wedstrijden',icon:Trophy},{href:'/meldingen',label:'Meldingen',icon:Bell},
    ...(captain||management?[{href:'/team',label:'Mijn team',icon:Users}]:[]),
    ...(management?[{href:'/beheer',label:'Beheer',icon:Settings2},{href:'/beheer/instellingen/huisstijl',label:'Instellingen',icon:SlidersHorizontal}]:[])];
  return <nav aria-label="Hoofdnavigatie">{links.map(({href,label,icon:Icon})=>{const active=href==='/beheer'?path==='/beheer'||path.startsWith('/beheer/seizoenen'):href==='/'?path==='/':path.startsWith(href);return <Link key={href} href={href} aria-current={active?'page':undefined} className={`nav-link ${active?'active':''}`}><Icon size={16}/><span>{label}</span>{href==='/meldingen' && unread!==null && unread>0 && <span className="count" aria-label={`${unread} ongelezen`}>{unread}</span>}<NavigationStatus/></Link>;})}</nav>;
}
