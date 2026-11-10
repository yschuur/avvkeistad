'use client';
import { useId,useState } from 'react';
import type { Assignment } from '@/lib/data';
import type { FunctionDefinition } from '@/lib/functions';
import { assignSeasonFunction,removeFunction,addFunctionGroupMembers } from '@/app/actions';
import { SubmitButton } from './submit-button';
import { ConfirmSubmitButton } from './confirm-submit-button';
export type FunctionMember={id:string;name:string;team:string;email:string};
export type FunctionReturn='/beheer/leden'|'/beheer/functies'|'/beheer/functiegroepen';
export function FunctionAssignmentForm({functions,groups,assignments,members,seasonId,available,returnTo,memberId}:{functions:FunctionDefinition[];groups:FunctionDefinition[];assignments:Assignment[];members:FunctionMember[];seasonId:string;available:boolean;returnTo:FunctionReturn;memberId?:string}) {
 const prefix=useId(),[selectedMember,setMember]=useState(''),[choice,setChoice]=useState('');
 const member=memberId??selectedMember;
 const choices=[...functions.map(item=>({...item,value:'function:'+item.id})),...groups.map(item=>({...item,value:'group:'+item.id}))];
 const assigned=(value:string)=>{const [kind,id]=value.split(':');return assignments.some(a=>a.member_id===member&&(kind==='group'?a.group_id===id:a.definition_id===id));};
 const selected=choices.find(item=>item.value===choice),eligible=members.some(m=>m.id===member);
 return <form action={assignSeasonFunction} className="stack-form"><input type="hidden" name="season_id" value={seasonId}/><input type="hidden" name="return_to" value={returnTo}/>{memberId&&<input type="hidden" name="member_id" value={memberId}/>}
 <fieldset className="stack-form" disabled={!available||!seasonId||!members.length}>
 {!memberId&&<div className="field"><label htmlFor={prefix+'member'}>Lid</label><select id={prefix+'member'} name="member_id" value={selectedMember} onChange={event=>{setMember(event.target.value);setChoice('');}} required><option value="">Kies een lid</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} · {m.team}</option>)}</select></div>}
 <div className="field"><label htmlFor={prefix+'choice'}>Functie of functiegroep</label><select id={prefix+'choice'} name="choice" value={choice} onChange={event=>setChoice(event.target.value)} required disabled={!eligible||!choices.length}><option value="">Kies een functie of functiegroep</option>{functions.length>0&&<optgroup label="Functies">{functions.map(item=><option key={item.id} value={'function:'+item.id} disabled={assigned('function:'+item.id)}>{item.title} · {item.points} punten{assigned('function:'+item.id)?' (al toegewezen)':''}</option>)}</optgroup>}{groups.length>0&&<optgroup label="Functiegroepen">{groups.map(item=><option key={item.id} value={'group:'+item.id} disabled={assigned('group:'+item.id)}>{item.title} · {item.points} punten{assigned('group:'+item.id)?' (al toegewezen)':''}</option>)}</optgroup>}</select></div>
 <p className="field-help" role="status">{selected?`${selected.points} punten voor dit seizoen.`:memberId&&!eligible?'Dit lid heeft nog geen teamindeling in het actieve seizoen.':!members.length?'Er zijn nog geen leden met een teamindeling in dit seizoen.':!choices.length?'Maak eerst een functie of functiegroep aan.':'De ingestelde punten worden direct voor dit seizoen toegekend.'}</p>
 <SubmitButton className="button" disabled={!eligible||!choice||assigned(choice)}>Toewijzen</SubmitButton></fieldset></form>;
}
export function FunctionAwards({assignments,members,returnTo,groupId}:{assignments:Assignment[];members:FunctionMember[];returnTo:FunctionReturn;groupId?:string}) {
 return <>{!assignments.length&&<p className="empty-state">Nog geen toekenningen.</p>}{assignments.map(a=><form key={a.id} action={removeFunction} className="correction-row"><input type="hidden" name="assignment_id" value={a.id}/><input type="hidden" name="return_to" value={returnTo}/><input type="hidden" name="member_id" value={a.member_id}/>{groupId&&<input type="hidden" name="group_id" value={groupId}/>}
 <span><strong>{members.find(m=>m.id===a.member_id)?.name??'Lid zonder teamindeling'} · {a.points} punten</strong><small>{a.title} · {a.group_id?'Functiegroep':a.definition_id?'Functie':'Bestaande functie'}</small></span>
 <ConfirmSubmitButton className="button secondary danger" question={`Deze toekenning van ${a.title} intrekken? De ${a.points} punten vervallen voor dit seizoen.`}>{a.group_id?'Uit groep verwijderen':'Toekenning intrekken'}</ConfirmSubmitButton></form>)}</>;
}
export function GroupMembersPicker({groupId,members,hasSeasonMembers=true}:{groupId:string;members:FunctionMember[];hasSeasonMembers?:boolean}) {
 const prefix=useId(),[query,setQuery]=useState(''),[selected,setSelected]=useState<Set<string>>(new Set());
 const filtered=members.filter(m=>(m.name+' '+m.team+' '+m.email).toLocaleLowerCase('nl').includes(query.trim().toLocaleLowerCase('nl')));
 const valid=members.filter(m=>selected.has(m.id));
 return <form action={addFunctionGroupMembers} className="stack-form"><input type="hidden" name="group_id" value={groupId}/><input type="hidden" name="return_to" value="/beheer/functiegroepen"/>{valid.map(m=><input key={m.id} type="hidden" name="member_ids" value={m.id}/>)}
 <div className="field"><label htmlFor={prefix+'search'}>Leden zoeken</label><input id={prefix+'search'} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Naam, team of e-mail"/></div>
 {!members.length?<p className="empty-state">{hasSeasonMembers?'Alle leden met een teamindeling zijn al toegevoegd.':'Er zijn nog geen leden met een teamindeling in dit seizoen.'}</p>:<><div className="function-member-tools"><button className="text-button" type="button" onClick={()=>setSelected(previous=>new Set([...previous,...filtered.map(m=>m.id)]))} disabled={!filtered.length}>Zichtbare leden selecteren</button><button className="text-button" type="button" onClick={()=>setSelected(new Set())} disabled={!valid.length}>Selectie wissen</button><span className="muted small" role="status">{valid.length} geselecteerd</span></div>
 <div className="function-member-picker" role="group" aria-label="Leden kiezen">{filtered.map(m=><label className="checkbox" key={m.id}><input type="checkbox" checked={selected.has(m.id)} onChange={event=>{const checked=event.target.checked;setSelected(previous=>{const next=new Set(previous);if(checked) next.add(m.id);else next.delete(m.id);return next;});}}/><span><strong>{m.name}</strong><small>{m.team}</small></span></label>)}{!filtered.length&&<p className="empty-state">Geen leden gevonden.</p>}</div><SubmitButton className="button" disabled={!valid.length}>Leden toevoegen</SubmitButton></>}
 </form>;
}
