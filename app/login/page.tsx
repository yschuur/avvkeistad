import { SubmitButton } from '@/components/submit-button';
import Link from 'next/link';
import { login } from '@/app/actions';
import { configured } from '@/lib/supabase/server';
import { Notice } from '@/components/ui';
export default async function Login({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const ready = configured();
  return <main className="login-page"><div className="auth-brand">AVV Keistad <span>Vrijwilligers</span></div><section className="login-panel"><h1>Inloggen</h1><Notice params={await searchParams}/>{ready ? <form action={login} className="stack-form"><label>E-mailadres<input type="email" name="email" required autoComplete="email"/></label><label>Wachtwoord<input type="password" name="password" required autoComplete="current-password"/></label><SubmitButton className="button">Inloggen</SubmitButton><Link href="/wachtwoord-vergeten" className="text-button">Wachtwoord vergeten?</Link><p className="muted small">Nog geen account? Vraag de clubbeheerder om een uitnodiging.</p></form> : <div className="info-strip"><strong>De omgeving is nog niet gekoppeld</strong><p>Neem contact op met de beheerder om de applicatie in te stellen.</p></div>}</section></main>;
}
