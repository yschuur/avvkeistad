import { SubmitButton } from '@/components/submit-button';
import { LogOut } from 'lucide-react';
import { type AppData } from '@/lib/data';
import { Nav,WorkspaceHeader,BrandLink } from './nav';
import { ModeSwitch } from './mode-switch';
import { NavigationFrame,WorkspaceFrame } from './navigation-frame';
import { logout } from '@/app/actions';
export function Shell({ data, children }: { data: AppData; children: React.ReactNode }) {
  const management = data.profile.role !== 'member';
  const captain = data.memberships.some(m => m.member_id===data.profile.id && m.captain);
  const role=data.profile.role==='admin'?'Admin':management?'Beheerder':'Lid';
  return <WorkspaceFrame><a href="#main-content" className="skip-link">Naar hoofdinhoud</a>
    <NavigationFrame><BrandLink/>
      <div className="season-label">{data.season?.name ?? 'Geen actief seizoen'}</div>
      <Nav management={management} captain={captain} unread={data.unreadNotifications}/>
      <div className="sidebar-bottom">{management && <ModeSwitch/>}<div className="profile"><div className="avatar" aria-hidden="true">{data.profile.first_name[0]}{data.profile.last_name[0]}</div><div className="profile-identity"><strong>{data.profile.first_name} {data.profile.last_name}</strong><small>{role}</small></div><form action={logout}><SubmitButton className="icon-button" aria-label="Uitloggen"><LogOut size={16}/></SubmitButton></form></div></div>
    </NavigationFrame>
    <div className="workspace"><header className="topbar"><WorkspaceHeader unread={data.unreadNotifications}/></header>
    <main id="main-content" tabIndex={-1}>{children}</main></div>
  </WorkspaceFrame>;
}
