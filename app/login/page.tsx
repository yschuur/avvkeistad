import Link from 'next/link';
import { Volleyball } from 'lucide-react';
import { login } from '@/app/actions';
import { configured } from '@/lib/supabase/server';
import { Notice } from '@/components/ui';
export default async function Login({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const ready = configured();
  return <main className="login-page"><section className="login-brand"><Volleyball size={48}/><h1>De club,<br/>dat zijn wij.</h1><p>Het vrijwilligersportaal van AVV Keistad.</p></section><section className="login-panel"><div className="eyebrow">WELKOM BIJ KEISTAD</div><h2>Fijn dat je er bent.</h2><p>Log in om jouw bijdrage aan de club te plannen.</p><Notice params={await searchParams}/>{ready ? <form action={login} className="stack-form"><label>E-mailadres<input type="email" name="email" required autoComplete="email"/></label><label>Wachtwoord<input type="password" name="password" required autoComplete="current-password"/></label><button className="button">Inloggen →</button><p className="muted small">Nog geen account of toegang kwijt? Vraag de clubbeheerder om een uitnodiging of herstelmail.</p></form> : <div className="info-strip"><strong>De omgeving is nog niet gekoppeld</strong><p>Volg de stappen in README.md om Supabase en Vercel in te stellen. Er zijn nog geen echte ledengegevens.</p><Link className="button" href="/">Bekijk de voorbeeldomgeving →</Link></div>}</section></main>;
}
