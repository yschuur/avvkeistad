import { SubmitButton } from '@/components/submit-button';
import Link from 'next/link';
import { LogOut, ExternalLink } from 'lucide-react';
import { type AppData } from '@/lib/data';
import { Nav } from './nav';
import { NavigationFrame } from './navigation-frame';
import { logout } from '@/app/actions';
export function Shell({ data, children }: { data: AppData; children: React.ReactNode }) {
  const management = data.profile.role !== 'member';
  const captain = data.memberships.some(m => m.member_id===data.profile.id && m.captain);
  const role=data.profile.role==='admin'?'Admin':management?'Beheerder':'Lid';
  return <div className="app-shell"><a href="#main-content" className="skip-link">Naar hoofdinhoud</a>
    <NavigationFrame><Link href="/" className="brand"><span className="brand-monogram">K</span><span>AVV Keistad<small>Vrijwilligers</small></span></Link>
      <div className="season-label">{data.season?.name ?? 'Geen actief seizoen'}</div>
      <Nav management={management} captain={captain} unread={data.unreadNotifications}/>
      <div className="sidebar-bottom"><div className="profile"><div className="avatar" aria-hidden="true">{data.profile.first_name[0]}{data.profile.last_name[0]}</div><div className="profile-identity"><strong>{data.profile.first_name} {data.profile.last_name}</strong><small>{role}</small></div><form action={logout}><SubmitButton className="icon-button" aria-label="Uitloggen"><LogOut size={16}/></SubmitButton></form></div></div>
    </NavigationFrame>
    <div className="workspace"><header className="topbar"><span>Vrijwilligersportaal</span><a href="https://www.volleybal.nl/competitie/vereniging/ckl7s2r#program" target="_blank" rel="noreferrer">Bondsprogramma <ExternalLink size={13}/></a></header>
    <main id="main-content" tabIndex={-1}>{children}</main></div>
  </div>;
}
