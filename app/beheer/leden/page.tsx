import { supabase } from '@/lib/supabase/server';
import { collectPages } from '@/lib/pagination';
import type { Assignment } from '@/lib/data';
import { loadMemberDirectory,memberDirectoryUrl } from '@/lib/member-directory';
import { PageNavigation } from '@/components/page-navigation';
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
 const base=await getData('members'),params=await searchParams,db=await supabase();
 const [directory,catalog]=await Promise.all([loadMemberDirectory(db,base.season?.id??null,params),getFunctionCatalog(base.season?.id??null)]);
 const ids=directory.editorProfiles.map(p=>p.id);
 const awards=ids.length?await collectPages<Assignment>(async(from,to)=>{const r=await db.from('function_assignments').select('*',{count:'exact'}).eq('season_id',base.season?.id??'00000000-0000-0000-0000-000000000000').in('member_id',ids).order('id').range(from,to);return {data:r.data as Assignment[]|null,count:r.count,error:r.error};}):{data:[]};
 const data={...base,profiles:directory.editorProfiles,memberships:[...directory.memberships,...base.memberships.filter(m=>!directory.memberships.some(loaded=>loaded.member_id===m.member_id))],assignments:awards.data};
 const profiles=directory.profiles,pages=Array.from({length:directory.pages},(_,i)=>({label:`Pagina ${i+1}`,href:memberDirectoryUrl(params,i+1)}));
 return <Shell data={data}><Heading title="Leden"/><Notice params={params}/><section className="panel"><div className="section-heading"><h2>Leden en accounts</h2><span className="muted">{directory.total} gevonden</span></div>
<FilterPanel active={Boolean(params.q||params.team)}> <form className="inline-form" method="get"><label>Zoeken op naam of e-mail<input name="q" type="search" maxLength={200} defaultValue={params.q ?? ''}/></label><label>Team<select name="team" defaultValue={params.team ?? ''}><option value="">Alle teams en accounts</option><option value="none">Geen team</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><SubmitButton className="button secondary">Filteren</SubmitButton></form></FilterPanel>
 <div className="table-wrap mobile-table" role="region" aria-label="Ledenoverzicht" tabIndex={0}><table role="table"><thead><tr role="row"><th>Naam</th><th>Team</th><th>Scheidsrechtersniveau</th><th>Rol</th><th>Actie</th></tr></thead><tbody>{profiles.map(p=>{const m=data.memberships.find(m=>m.member_id===p.id);return <tr role="row" key={p.id}><TableCell label="Naam" data-featured="true"><strong>{p.first_name} {p.last_name}</strong><small>{p.email}</small></TableCell><TableCell label="Team">{data.teams.find(t=>t.id===m?.team_id)?.name ?? 'Geen team'}{m?.captain&&<small>Aanvoerder</small>}</TableCell><TableCell label="Scheidsrechtersniveau">{p.referee_qualification ?? 'Niet ingesteld'}</TableCell><TableCell label="Rol">{p.role==='admin'?'Admin':p.role==='manager'?'Beheerder':'Lid'}</TableCell><TableCell label="Actie" className="table-actions"><div className="form-actions"><Link prefetch={false} className="button secondary" href={`${memberDirectoryUrl(params,directory.page,p.id)}#lidinstellen`} aria-label={`Instellen voor ${p.first_name} ${p.last_name}`}>Instellen</Link><Link prefetch={false} className="button secondary" href={`${memberDirectoryUrl(params,directory.page,p.id)}#lidfuncties`} aria-label={`Functie of groep toewijzen aan ${p.first_name} ${p.last_name}`}>Functie toewijzen</Link></div></TableCell></tr>;})}</tbody></table>{!profiles.length&&<p className="empty-state">Geen leden gevonden voor deze selectie.</p>}</div><PageNavigation current={directory.page} pages={pages} name="Ledenpagina’s"/></section>
 <FunctionMigrationNotice catalog={catalog}/>{data.profiles.length>0&&<MemberSection data={data} params={params} catalog={catalog}/>}<InviteSection data={data}/></Shell>;
}
