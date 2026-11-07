'use client';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Users, Trophy, Settings2, SlidersHorizontal } from 'lucide-react';
function NavigationStatus() {
  const {pending}=useLinkStatus();
  return pending?<span className="nav-pending" role="status"><span className="loading-spinner" aria-hidden="true"/><span className="sr-only">Pagina laden…</span></span>:null;
}
export function Nav({management,captain}:{management:boolean;captain:boolean}) {
  const path=usePathname();
  const links=[{href:'/',label:'Mijn overzicht',icon:LayoutDashboard},{href:'/diensten',label:'Diensten',icon:CalendarDays},{href:'/wedstrijden',label:'Wedstrijden',icon:Trophy},
    ...(captain||management?[{href:'/team',label:'Mijn team',icon:Users}]:[]),
    ...(management?[{href:'/beheer',label:'Beheer',icon:Settings2},{href:'/beheer/instellingen/huisstijl',label:'Instellingen',icon:SlidersHorizontal}]:[])];
  return <nav aria-label="Hoofdnavigatie">{links.map(({href,label,icon:Icon})=>{const active=href==='/beheer'?path==='/beheer':href==='/'?path==='/':path.startsWith(href);return <Link key={href} href={href} aria-current={active?'page':undefined} className={`nav-link ${active?'active':''}`}><Icon size={16}/><span>{label}</span><NavigationStatus/></Link>;})}</nav>;
}
