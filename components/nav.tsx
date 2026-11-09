'use client';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Users, Bell, Trophy, SlidersHorizontal, UsersRound, CalendarRange, ListChecks, Award, ChartNoAxesCombined,UserRound,ExternalLink } from 'lucide-react';
function NavigationStatus() {
 const {pending}=useLinkStatus();
 return pending?<span className="nav-pending" role="status"><span className="loading-spinner" aria-hidden="true"/><span className="sr-only">Pagina laden…</span></span>:null;
}
export function Nav({management,captain,unread}:{management:boolean;captain:boolean;unread:number|null}) {
 const path=usePathname(),adminMode=management&&(path==='/beheer'||path.startsWith('/beheer/'));
 const links=adminMode?[
  {href:'/beheer',label:'Dashboard',icon:LayoutDashboard},
  {href:'/beheer/leden',label:'Leden',icon:Users},
  {href:'/beheer/teams',label:'Teams',icon:UsersRound},
  {href:'/beheer/planning',label:'Planning',icon:ListChecks},
  {href:'/beheer/wedstrijden',label:'Wedstrijden',icon:Trophy},
  {href:'/beheer/functies',label:'Functies',icon:Award},
  {href:'/beheer/rapportage',label:'Rapportage',icon:ChartNoAxesCombined},
  {href:'/beheer/seizoenen',label:'Seizoenen',icon:CalendarRange},
  {href:'/beheer/instellingen',label:'Instellingen',icon:SlidersHorizontal},
 ]:[{href:'/',label:'Mijn overzicht',icon:LayoutDashboard},{href:'/diensten',label:'Open diensten',icon:CalendarDays},{href:'/mijn-diensten',label:'Mijn diensten',icon:ListChecks},{href:'/profiel',label:'Mijn profiel',icon:UserRound},...(captain?[{href:'/team',label:'Mijn team',icon:Users}]:[])];
 return <nav className="sidebar-nav" aria-label={adminMode?'Beheernavigatie':'Hoofdnavigatie'}>{links.map(({href,label,icon:Icon})=>{const active=href==='/'||href==='/beheer'?path===href:path===href||path.startsWith(href+'/');return <Link key={href} href={href} aria-current={active?'page':undefined} className={`nav-link ${active?'active':''}`}><Icon size={16}/><span>{label}</span>{href==='/meldingen'&&unread!==null&&unread>0&&<span className="count" aria-label={`${unread} ongelezen`}>{unread}</span>}<NavigationStatus/></Link>;})}</nav>;
}
export function WorkspaceLabel() {
 const path=usePathname();return <span>{path==='/beheer'||path.startsWith('/beheer/')?'Beheeromgeving':'Vrijwilligersportaal'}</span>;
}
export function BrandLink() {
 const path=usePathname();return <Link href={path==='/beheer'||path.startsWith('/beheer/')?'/beheer':'/'} className="brand"><span className="brand-monogram">K</span><span>AVV Keistad<small>Vrijwilligers</small></span></Link>;
}

export function WorkspaceHeader({unread}:{unread:number|null}) {
 const path=usePathname(),adminMode=path==='/beheer'||path.startsWith('/beheer/');
 return <><WorkspaceLabel/>{adminMode?<a href="https://www.volleybal.nl/competitie/vereniging/ckl7s2r#program" target="_blank" rel="noreferrer">Bondsprogramma <ExternalLink size={13}/></a>:<Link href="/meldingen"><Bell size={15}/><span>Meldingen{unread!==null&&unread>0?` (${unread})`:''}</span></Link>}</>;
}
