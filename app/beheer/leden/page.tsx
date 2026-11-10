import { getFunctionCatalog } from '@/lib/functions';
import { FunctionMigrationNotice } from '@/components/function-management';
import { FilterPanel } from '@/components/filter-panel';
import { TableCell } from '@/components/responsive-table';
import Link from 'next/link';
import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { MemberSection,InviteSection } from '@/components/management/sections';
export default async function Members({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams,catalog=await getFunctionCatalog(data.season?.id??null);
 const query=(params.q ?? '').trim().toLocaleLowerCase('nl');
 const profiles=data.profiles.filter(p=>{
  const m=data.memberships.find(m=>m.member_id===p.id);
  return (!query||`${p.first_name} ${p.last_name} ${p.email}`.toLocaleLowerCase('nl').includes(query))&&(!params.team||(params.team==='none'?!m:m?.team_id===params.team));
 });
 return <Shell data={data}><Heading title="Leden"/><Notice params={params}/><section className="panel"><div className="section-heading"><h2>Leden en accounts</h2><span className="muted">{profiles.length} gevonden</span></div>
<FilterPanel active={Boolean(params.q||params.team)}> <form className="inline-form" method="get"><label>Zoeken op naam of e-mail<input name="q" type="search" defaultValue={params.q ?? ''}/></label><label>Team<select name="team" defaultValue={params.team ?? ''}><option value="">Alle teams en accounts</option><option value="none">Geen team</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><SubmitButton className="button secondary">Filteren</SubmitButton></form></FilterPanel>
 <div className="table-wrap mobile-table" role="region" aria-label="Ledenoverzicht" tabIndex={0}><table role="table"><thead><tr role="row"><th>Naam</th><th>Team</th><th>Scheidsrechtersniveau</th><th>Rol</th><th>Actie</th></tr></thead><tbody>{profiles.map(p=>{const m=data.memberships.find(m=>m.member_id===p.id);return <tr role="row" key={p.id}><TableCell label="Naam" data-featured="true"><strong>{p.first_name} {p.last_name}</strong><small>{p.email}</small></TableCell><TableCell label="Team">{data.teams.find(t=>t.id===m?.team_id)?.name ?? 'Geen team'}{m?.captain&&<small>Aanvoerder</small>}</TableCell><TableCell label="Scheidsrechtersniveau">{p.referee_qualification ?? 'Niet ingesteld'}</TableCell><TableCell label="Rol">{p.role==='admin'?'Admin':p.role==='manager'?'Beheerder':'Lid'}</TableCell><TableCell label="Actie" className="table-actions"><div className="form-actions"><Link className="button secondary" href={`/beheer/leden?member=${encodeURIComponent(p.id)}#lidinstellen`} aria-label={`Instellen voor ${p.first_name} ${p.last_name}`}>Instellen</Link><Link className="button secondary" href={`/beheer/leden?member=${encodeURIComponent(p.id)}#lidfuncties`} aria-label={`Functie of groep toewijzen aan ${p.first_name} ${p.last_name}`}>Functie toewijzen</Link></div></TableCell></tr>;})}</tbody></table>{!profiles.length&&<p className="empty-state">Geen leden gevonden voor deze selectie.</p>}</div></section>
 <FunctionMigrationNotice catalog={catalog}/><MemberSection data={data} params={params} catalog={catalog}/><InviteSection data={data}/></Shell>;
}
