'use client';
import Link, { useLinkStatus } from 'next/link';
import { useBranding } from './club-identity';
import { ClubIdentity } from './club-identity';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Users, Bell, Trophy, SlidersHorizontal, UsersRound, CalendarRange, ListChecks, Award, ChartNoAxesCombined,UserRound,ExternalLink,Coffee,PartyPopper,ChevronDown } from 'lucide-react';
function NavigationStatus() {
 const {pending}=useLinkStatus();
 return pending?<span className="nav-pending" role="status"><span className="loading-spinner" aria-hidden="true"/><span className="sr-only">Pagina laden…</span></span>:null;
}
const serviceLinks=[
 {href:'/beheer/wedstrijden',label:'Wedstrijden',icon:Trophy},
 {href:'/beheer/bardiensten',label:'Bardiensten',icon:Coffee},
 {href:'/beheer/evenementen',label:'Evenementen',icon:PartyPopper},
 {href:'/beheer/overige-diensten',label:'Overige diensten',icon:ListChecks},
 {href:'/beheer/planning',label:'Planning',icon:ListChecks},
];
function workspaceLinks(adminMode:boolean,captain:boolean) {
 return adminMode?[
  {href:'/beheer',label:'Dashboard',icon:LayoutDashboard},
  {href:'/beheer/leden',label:'Leden',icon:Users},
  {href:'/beheer/teams',label:'Teams',icon:UsersRound},
  ...serviceLinks,
  {href:'/beheer/functies',label:'Functies',icon:Award},
  {href:'/beheer/functiegroepen',label:'Functiegroepen',icon:UsersRound},
  {href:'/beheer/rapportage',label:'Rapportage',icon:ChartNoAxesCombined},
  {href:'/beheer/seizoenen',label:'Seizoenen',icon:CalendarRange},
  {href:'/beheer/instellingen',label:'Instellingen',icon:SlidersHorizontal},
 ]:[{href:'/',label:'Mijn overzicht',icon:LayoutDashboard},{href:'/diensten',label:'Diensten',icon:CalendarDays},{href:'/mijn-diensten',label:'Mijn diensten',icon:ListChecks},...(captain?[{href:'/team',label:'Mijn team',icon:Users}]:[]),{href:'/profiel',label:'Mijn profiel',icon:UserRound}];
}
function TeamDutyCount({count}:{count:number|null}) {return count!==null&&count>0?<span className="team-duty-count" aria-label={`${count} teamdiensten nog toe te wijzen`} title={`${count} teamdiensten nog toe te wijzen`}>{count}</span>:null;}
export function MobileNavLinks({management,captain,pendingTeamDuties=null}:{management:boolean;captain:boolean;pendingTeamDuties?:number|null}) {
 const path=usePathname(),adminMode=management&&(path==='/beheer'||path.startsWith('/beheer/'));
 const destinations=adminMode?['/beheer','/beheer/planning','/beheer/wedstrijden']:[ '/', '/diensten', '/mijn-diensten',...(captain?['/team']:[]),'/profiel'];
 const labels:Record<string,string>={'/':'Overzicht','/profiel':'Profiel','/diensten':'Diensten'};
 return <>{workspaceLinks(adminMode,captain).filter(link=>destinations.includes(link.href)).sort((a,b)=>destinations.indexOf(a.href)-destinations.indexOf(b.href)).map(({href,label,icon:Icon})=>{
  const active=href==='/'||href==='/beheer'?path===href:path===href||path.startsWith(href+'/');
  return <Link key={href} href={href} aria-current={active?'page':undefined} className={`mobile-nav-link ${active?'active':''}`}><Icon size={20}/><span>{labels[href]??label}</span>{href==='/team'&&<TeamDutyCount count={pendingTeamDuties}/>}<NavigationStatus/></Link>;
 })}</>;
}
export function Nav({management,captain,unread,pendingTeamDuties=null}:{management:boolean;captain:boolean;unread:number|null;pendingTeamDuties?:number|null}) {
 const path=usePathname(),adminMode=management&&(path==='/beheer'||path.startsWith('/beheer/'));
 const links=workspaceLinks(adminMode,captain);
 const linkElement=({href,label,icon:Icon}:typeof links[number])=>{const active=href==='/'||href==='/beheer'?path===href:path===href||path.startsWith(href+'/');return <Link key={href} href={href} aria-current={active?'page':undefined} className={`nav-link ${active?'active':''}`}><Icon size={16}/><span>{label}</span>{href==='/team'&&<TeamDutyCount count={pendingTeamDuties}/>}{href==='/meldingen'&&unread!==null&&unread>0&&<span className="count" aria-label={`${unread} ongelezen`}>{unread}</span>}<NavigationStatus/></Link>;};
 const serviceActive=serviceLinks.some(link=>path===link.href||path.startsWith(link.href+'/'));
 return <nav className="sidebar-nav" aria-label={adminMode?'Beheernavigatie':'Hoofdnavigatie'}>{links.map(link=>{
  if(adminMode&&serviceLinks.some(service=>service.href===link.href)) return link.href===serviceLinks[0].href?<details key="services" className={`nav-group ${serviceActive?'active':''}`} open={serviceActive}><summary className="nav-link" tabIndex={0}><CalendarDays size={16}/><span>Diensten</span><ChevronDown size={14} className="nav-group-chevron"/></summary><div className="nav-submenu" role="group" aria-label="Diensten">{serviceLinks.map(linkElement)}</div></details>:null;
  return linkElement(link);
 })}</nav>;
}
export function WorkspaceLabel() {
 const path=usePathname(),branding=useBranding();return <span className="workspace-label"><strong className="mobile-club-name">{branding.clubName}</strong><span>{path==='/beheer'||path.startsWith('/beheer/')?'Beheeromgeving':'Vrijwilligersportaal'}</span></span>;
}
export function BrandLink() {
 const path=usePathname();return <Link href={path==='/beheer'||path.startsWith('/beheer/')?'/beheer':'/'} className="brand"><ClubIdentity/></Link>;
}

export function WorkspaceHeader({unread}:{unread:number|null}) {
 const path=usePathname(),adminMode=path==='/beheer'||path.startsWith('/beheer/');
 return <><WorkspaceLabel/>{adminMode?<a href="https://www.volleybal.nl/competitie/vereniging/ckl7s2r#program" target="_blank" rel="noreferrer">Bondsprogramma <ExternalLink size={13}/></a>:<Link href="/meldingen"><Bell size={15}/><span>Meldingen{unread!==null&&unread>0?` (${unread})`:''}</span></Link>}</>;
}
