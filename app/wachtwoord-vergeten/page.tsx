import { ClubIdentity } from '@/components/club-identity';
import Link from 'next/link';
import { requestPasswordReset } from '@/app/actions';
import { SubmitButton } from '@/components/submit-button';
import { Notice } from '@/components/ui';

export default async function PasswordReset({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  return <main className="login-page"><div className="auth-brand"><ClubIdentity/></div>
    <section className="login-panel"><h1>Wachtwoord herstellen</h1><p>Vraag een herstellink aan voor je bestaande account. Je rol en punten blijven behouden.</p><Notice params={await searchParams}/>
      <form action={requestPasswordReset} className="stack-form"><label>E-mailadres<input name="email" type="email" autoComplete="email" required/></label><SubmitButton className="button">Herstelmail aanvragen</SubmitButton><Link href="/login" className="text-button">Terug naar inloggen</Link></form>
    </section></main>;
}
