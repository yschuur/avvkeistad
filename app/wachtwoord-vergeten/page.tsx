import Link from 'next/link';
import { Volleyball } from 'lucide-react';
import { requestPasswordReset } from '@/app/actions';
import { SubmitButton } from '@/components/submit-button';
import { Notice } from '@/components/ui';

export default async function PasswordReset({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  return <main className="login-page"><section className="login-brand"><Volleyball size={48}/><h1>We helpen<br/>je weer op weg.</h1><p>Het vrijwilligersportaal van AVV Keistad.</p></section>
    <section className="login-panel"><div className="eyebrow">TOEGANG HERSTELLEN</div><h2>Wachtwoord vergeten?</h2><p>Vraag een herstellink aan voor je bestaande account. Je rol en punten blijven behouden.</p><Notice params={await searchParams}/>
      <form action={requestPasswordReset} className="stack-form"><label>E-mailadres<input name="email" type="email" autoComplete="email" required/></label><SubmitButton className="button">Herstelmail aanvragen</SubmitButton><Link href="/login" className="text-button">Terug naar inloggen</Link></form>
    </section></main>;
}
