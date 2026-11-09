import { assignDutyTeam } from '@/app/actions';
import type { Team } from '@/lib/data';
import { SubmitButton } from './submit-button';
export function TeamDutyAssignment({dutyId,teamId,teams,returnTo,disabled=false}:{dutyId:string;teamId:string|null;teams:Team[];returnTo:'/beheer/planning'|'/beheer/wedstrijden';disabled?:boolean}) {
 const id=`assign-team-${dutyId}`;
 return <form action={assignDutyTeam} className="team-assignment-form"><input type="hidden" name="duty_id" value={dutyId}/><input type="hidden" name="return_to" value={returnTo}/><div className="team-assignment-field"><label htmlFor={id}>Toewijzen aan team</label><select id={id} name="team_id" defaultValue={teamId??''} key={teamId??'open'} disabled={disabled}><option value="">Open voor alle teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><SubmitButton className="button secondary" disabled={disabled}>Team opslaan</SubmitButton></form>;
}
