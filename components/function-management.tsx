import Link from 'next/link';
import type { AppData } from '@/lib/data';
import type { FunctionCatalog,FunctionDefinition } from '@/lib/functions';
import { saveSeasonFunction,saveFunctionGroup } from '@/app/actions';
import { SubmitButton } from './submit-button';
import { TableCell } from './responsive-table';
import { FunctionAssignmentForm,FunctionAwards,GroupMembersPicker,type FunctionMember } from './function-assignment';
export function functionMembers(data:AppData,includeUnassigned=false):FunctionMember[] {
 return data.profiles.filter(p=>includeUnassigned||data.memberships.some(m=>m.member_id===p.id)).map(p=>{const m=data.memberships.find(m=>m.member_id===p.id);return {id:p.id,name:`${p.first_name} ${p.last_name}`.trim(),email:p.email,team:data.teams.find(t=>t.id===m?.team_id)?.name??'Geen team'};});
}
export function FunctionMigrationNotice({catalog}:{catalog:FunctionCatalog}) {return catalog.error?<p className="notice warning" role="alert">{catalog.error}</p>:null;}
export function FunctionDefinitionForm({data,item,group,available}:{data:AppData;item?:FunctionDefinition;group:boolean;available:boolean}) {
 const prefix=group?'groep':'functie',base=group?'/beheer/functiegroepen':'/beheer/functies';
 return <section className="panel" id={prefix+'-formulier'}><div className="section-heading"><h2>{item?`${group?'Functiegroep':'Functie'} bewerken`:`${group?'Functiegroep':'Functie'} aanmaken`}</h2>{item&&<Link href={base}>Nieuwe {group?'functiegroep':'functie'}</Link>}</div>
 <p className="muted small">Vaste punten per lid voor {data.season?.name??'het geselecteerde seizoen'}. Aanpassen werkt door naar alle gekoppelde toekenningen in dit seizoen.</p>
 <form action={group?saveFunctionGroup:saveSeasonFunction} key={item?.id??'new'}><input type="hidden" name="season_id" value={data.season?.id??''}/><input type="hidden" name="definition_id" value={item?.id??''}/><fieldset className="stack-form" disabled={!data.season||!available}>
 <div className="field"><label htmlFor={prefix+'-title'}>{group?'Groepsnaam':'Functienaam'}</label><input id={prefix+'-title'} name="title" defaultValue={item?.title} required maxLength={200}/></div><div className="field"><label htmlFor={prefix+'-points'}>Punten per lid per seizoen</label><input id={prefix+'-points'} name="points" type="number" min="0" max="999999.99" step="0.25" defaultValue={item?.points} required/></div>
 <SubmitButton className="button">{group?'Functiegroep opslaan':'Functie opslaan'}</SubmitButton></fieldset></form></section>;
}
export function FunctionsWorkspace({data,catalog,selectedId}:{data:AppData;catalog:FunctionCatalog;selectedId?:string}) {
 const selected=data.functions.find(f=>f.id===selectedId),members=functionMembers(data);
 return <><FunctionMigrationNotice catalog={catalog}/><div className="admin-grid function-catalog-layout"><section className="panel"><h2>Functies</h2><div className="table-wrap mobile-table" role="region" aria-label="Functies" tabIndex={0}><table role="table"><thead><tr role="row"><th>Functie</th><th>Punten per seizoen</th><th>Actie</th></tr></thead><tbody>{data.functions.map(f=><tr key={f.id} role="row"><TableCell label="Functie" data-featured="true">{f.title}</TableCell><TableCell label="Punten per seizoen">{f.points}</TableCell><TableCell label="Actie"><Link className="button secondary" href={'/beheer/functies?function='+f.id+'#functie-formulier'} aria-label={'Functie bewerken: '+f.title}>Bewerken</Link></TableCell></tr>)}</tbody></table>{!data.functions.length&&<p className="empty-state">Nog geen functies aangemaakt.</p>}</div></section><FunctionDefinitionForm data={data} item={selected} group={false} available={catalog.available}/></div>
 <section className="panel"><h2>Functie of functiegroep toewijzen</h2><FunctionAssignmentForm functions={data.functions} groups={catalog.groups} assignments={data.assignments} members={members} seasonId={data.season?.id??''} available={catalog.available} returnTo="/beheer/functies"/></section>
 <section className="panel"><h2>Toekenningen</h2><FunctionAwards assignments={data.assignments} members={functionMembers(data,true)} returnTo="/beheer/functies"/></section></>;
}
export function FunctionGroupsWorkspace({data,catalog,selectedId}:{data:AppData;catalog:FunctionCatalog;selectedId?:string}) {
 const selected=catalog.groups.find(g=>g.id===selectedId),members=functionMembers(data);
 const assigned=selected?data.assignments.filter(a=>a.group_id===selected.id):[];
 const roster=data.profiles.map(p=>({id:p.id,name:`${p.first_name} ${p.last_name}`.trim(),email:p.email,team:members.find(m=>m.id===p.id)?.team??'Geen team'}));
 return <><FunctionMigrationNotice catalog={catalog}/><div className="admin-grid function-catalog-layout"><section className="panel"><h2>Functiegroepen</h2><div className="table-wrap mobile-table" role="region" aria-label="Functiegroepen" tabIndex={0}><table role="table"><thead><tr role="row"><th>Groep</th><th>Punten per lid</th><th>Leden</th><th>Actie</th></tr></thead><tbody>{catalog.groups.map(g=><tr role="row" key={g.id}><TableCell label="Groep" data-featured="true">{g.title}</TableCell><TableCell label="Punten per lid">{g.points}</TableCell><TableCell label="Leden">{data.assignments.filter(a=>a.group_id===g.id).length}</TableCell><TableCell label="Actie"><Link className="button secondary" href={'/beheer/functiegroepen?group='+g.id} aria-label={'Functiegroep beheren: '+g.title}>Beheren</Link></TableCell></tr>)}</tbody></table>{!catalog.groups.length&&<p className="empty-state">Nog geen functiegroepen aangemaakt.</p>}</div></section><FunctionDefinitionForm data={data} item={selected} group available={catalog.available}/></div>
 {selected?<><section className="panel"><h2>Leden van {selected.title}</h2><p className="muted small">Ieder lid ontvangt {selected.points} punten voor {data.season?.name}. Verwijderen uit deze groep trekt uitsluitend deze toekenning in.</p><FunctionAwards assignments={assigned} members={roster} returnTo="/beheer/functiegroepen" groupId={selected.id}/></section>
 <section className="panel"><h2>Leden toevoegen aan {selected.title}</h2><GroupMembersPicker key={selected.id} groupId={selected.id} hasSeasonMembers={members.length>0} members={members.filter(m=>!assigned.some(a=>a.member_id===m.id))}/></section></>:catalog.groups.length>0&&<p className="notice">Kies Beheren bij een functiegroep om leden toe te voegen of te verwijderen.</p>}</>;
}
