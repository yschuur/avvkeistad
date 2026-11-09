import Link from 'next/link';
import { getData,memberProgress } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { setPassword } from '@/app/actions';
export default async function ProfilePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('profile'),params=await searchParams,p=data.profile;
 const membership=data.memberships.find(m=>m.member_id===p.id),team=data.teams.find(t=>t.id===membership?.team_id);
 return <Shell data={data}><Heading title="Mijn profiel"/><Notice params={params}/>
 <section className="panel"><h2>Mijn gegevens</h2><dl className="profile-details"><div><dt>Naam</dt><dd>{p.first_name} {p.last_name}</dd></div><div><dt>E-mailadres</dt><dd>{p.email}</dd></div><div><dt>Nevobo-code</dt><dd>{p.nevobo_code || 'Niet ingesteld'}</dd></div><div><dt>Team</dt><dd>{team?.name ?? 'Nog geen teamindeling'}{membership?.captain&&' · Aanvoerder'}</dd></div><div><dt>Scheidsrechtersniveau</dt><dd>{p.referee_qualification ?? 'Niet ingesteld'}</dd></div><div><dt>Puntennorm dit seizoen</dt><dd>{data.season&&membership?`${memberProgress(data,p.id).norm} punten`:'Nog niet vastgesteld'}</dd></div></dl><p className="muted small">Klopt er iets niet? Neem contact op met de beheerder.</p></section>
 {params.password&&<section className="panel"><h2>Wachtwoord instellen</h2><form action={setPassword} className="inline-form"><label>Nieuw wachtwoord (minimaal 12 tekens)<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password"/></label><SubmitButton className="button">Wachtwoord instellen</SubmitButton></form></section>}
 <p className="small"><Link href="/meldingen">Mijn meldingen bekijken</Link></p></Shell>;
}
