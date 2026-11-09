'use client';
import { SubmitButton } from '@/components/submit-button';
import { useState } from 'react';
import type { Profile } from '@/lib/domain';
import type { Membership, Team } from '@/lib/data';
import { RefereeLevelSelect } from './referee-level-select';
import { updateMember } from '@/app/actions';
export function MemberEditor({profiles,memberships,teams,season,disabled}:{profiles:Profile[];memberships:Membership[];teams:Team[];season:string;disabled:boolean}) {
 const [selected,setSelected]=useState(profiles[0]?.id ?? '');
 const profile=profiles.find(p=>p.id===selected);const membership=memberships.find(m=>m.member_id===selected);
 return <form action={updateMember}><input type="hidden" name="season_id" value={season}/><fieldset disabled={disabled} className="stack-form"><label>Lid<select name="member_id" value={selected} onChange={e=>setSelected(e.target.value)} required>{profiles.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label><div key={selected} className="stack-form"><label>Team<select name="team_id" defaultValue={membership?.team_id ?? ''} required><option value="" disabled>Kies een team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Persoonlijke norm (leeg = standaard)<input name="norm" type="number" min={0} step="0.25" defaultValue={membership?.norm_override ?? ''}/></label><RefereeLevelSelect id="member-referee-level" label="Scheidsrechtersniveau" value={profile?.referee_qualification} optional/><label className="checkbox"><input type="checkbox" name="captain" defaultChecked={membership?.captain ?? false}/>Aanvoerder van dit team</label></div><SubmitButton className="button">Lidinstellingen opslaan</SubmitButton></fieldset></form>;
}
