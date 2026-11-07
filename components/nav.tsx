'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Users, Trophy, Settings2, ArrowUpRight } from 'lucide-react';
export function Nav({ management, captain }: { management: boolean; captain: boolean }) {
  const path = usePathname();
  const links = [ { href: '/', label: 'Mijn overzicht', icon: LayoutDashboard }, { href: '/diensten', label: 'Diensten', icon: CalendarDays }, { href: '/wedstrijden', label: 'Wedstrijden', icon: Trophy }, ...(captain || management ? [{ href: '/team', label: 'Mijn team', icon: Users }] : []), ...(management ? [{ href: '/beheer', label: 'Beheer', icon: Settings2 }] : []) ];
  return <nav aria-label="Hoofdnavigatie">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href ? 'nav-link active' : 'nav-link'}><Icon size={19}/>{label}{path===href && <ArrowUpRight size={15} className="nav-arrow"/>}</Link>)}</nav>;
}
