'use client';
import { SubmitButton } from '@/components/submit-button';
import { useState } from 'react';
import type { Profile } from '@/lib/domain';
import type { Membership, Team } from '@/lib/data';
import { RefereeLevelSelect } from './referee-level-select';
import { updateMember } from '@/app/actions';
import type { Assignment } from '@/lib/data';
import type { FunctionDefinition } from '@/lib/functions';
import { FunctionAssignmentForm,FunctionAwards,type FunctionMember } from './function-assignment';
export function MemberEditor({profiles,memberships,teams,season,disabled,initialMember,functions,groups,assignments,functionMembers,functionsAvailable}:{profiles:Profile[];memberships:Membership[];teams:Team[];season:string;disabled:boolean;initialMember?:string;functions:FunctionDefinition[];groups:FunctionDefinition[];assignments:Assignment[];functionMembers:FunctionMember[];functionsAvailable:boolean}) {
 const [selected,setSelected]=useState(profiles.some(p=>p.id===initialMember)?initialMember!:profiles[0]?.id ?? '');
 const profile=profiles.find(p=>p.id===selected);const membership=memberships.find(m=>m.member_id===selected);
 return <><form action={updateMember}><input type="hidden" name="season_id" value={season}/><fieldset disabled={disabled} className="stack-form"><label>Lid<select name="member_id" value={selected} onChange={e=>setSelected(e.target.value)} required>{profiles.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label><div key={selected} className="member-editor-fields"><label>Team<select name="team_id" defaultValue={membership?.team_id ?? ''} required><option value="" disabled>Kies een team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Persoonlijke norm (leeg = standaard)<input name="norm" type="number" min={0} step="0.25" defaultValue={membership?.norm_override ?? ''}/></label><RefereeLevelSelect id="member-referee-level" label="Scheidsrechtersniveau" value={profile?.referee_qualification} optional/><label className="checkbox"><input type="checkbox" name="captain" defaultChecked={membership?.captain ?? false}/>Aanvoerder van dit team</label></div><SubmitButton className="button">Lidinstellingen opslaan</SubmitButton></fieldset></form>{profile&&<div id="lidfuncties" className="member-function-section" key={selected}><h3>Functie of functiegroep toewijzen aan {profile.first_name} {profile.last_name}</h3><FunctionAssignmentForm functions={functions} groups={groups} assignments={assignments} members={functionMembers} seasonId={season} available={functionsAvailable} returnTo="/beheer/leden" memberId={selected}/><h3 className="subheading">Toekenningen voor dit seizoen</h3><FunctionAwards assignments={assignments.filter(a=>a.member_id===selected)} members={[{id:selected,name:`${profile.first_name} ${profile.last_name}`,team:'',email:profile.email}]} returnTo="/beheer/leden"/></div>}</>;
}
