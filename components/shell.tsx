import Link from 'next/link';
import { Volleyball, LogOut, Heart, ArrowUpRight } from 'lucide-react';
import { type AppData } from '@/lib/data';
import { Nav } from './nav';
import { logout } from '@/app/actions';
export function Shell({ data, children }: { data: AppData; children: React.ReactNode }) {
  const management = data.profile.role !== 'member';
  const captain = data.memberships.some(m => m.member_id===data.profile.id && m.captain);
  return <div className="app-shell">
    <aside className="sidebar"><Link href="/" className="brand"><div className="brand-icon"><Volleyball size={30}/></div><span>KEISTAD<small>VRIJWILLIGERS</small></span></Link>
      <div className="season-label">SEIZOEN {data.season?.name ?? 'NOG NIET INGESTELD'}</div>
      <Nav management={management || data.demo} captain={captain}/>
      <div className="sidebar-bottom"><div className="club-note"><Heart size={19}/><strong>De club, dat zijn wij.</strong><p>Jouw inzet maakt het verschil.<br/>Op én naast het veld.</p></div><div className="profile"><div className="avatar">{data.profile.first_name[0]}{data.profile.last_name[0]}</div><div><strong>{data.profile.first_name} {data.profile.last_name}</strong><small>{data.demo ? 'Voorbeeldlid' : management ? 'Beheerder' : 'Lid'}</small></div><form action={logout}><button className="icon-button" aria-label="Uitloggen"><LogOut size={17}/></button></form></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><span>AVV Keistad <span className="muted">/ Vrijwilligersportaal</span></span><a href="https://www.volleybal.nl/competitie/vereniging/ckl7s2r#program" target="_blank" rel="noreferrer">Clubprogramma <ArrowUpRight size={14}/></a></header>
    {data.demo && <div className="demo-banner"><span className="status-dot"/> Voorbeeldomgeving · wijzigingen worden niet opgeslagen. <Link href="/login">Supabase koppelen</Link></div>}
    <main>{children}</main><footer>AVV Keistad · Samen maken we de club <span>Met elkaar. Voor elkaar.</span></footer></div>
  </div>;
}
