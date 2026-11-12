import { AvailableTeamSelect } from './available-team-select';
import type { AvailabilityMatch,DutyWindow } from '@/lib/match-availability';
import { assignDutyTeam } from '@/app/actions';
import type { Team } from '@/lib/data';
import { SubmitButton } from './submit-button';
export function TeamDutyAssignment({dutyId,teamId,teams,returnTo,disabled=false,matches=[],duty,slotTeams}:{dutyId:string;teamId:string|null;teams:Team[];returnTo:string;disabled?:boolean;matches?:AvailabilityMatch[];duty?:DutyWindow;slotTeams?:(string|null)[]}) {
 return <form action={assignDutyTeam} className={slotTeams?'stack-form':'team-assignment-form'}><input type="hidden" name="duty_id" value={dutyId}/><input type="hidden" name="return_to" value={returnTo}/>{slotTeams?<><p className="field-help">Kies per plek een team. Hetzelfde team mag meerdere plekken krijgen.</p><div className="slot-team-grid">{slotTeams.map((team,index)=><AvailableTeamSelect key={`${index}-${team??'open'}`} id={`assign-team-${dutyId}-${index}`} teamId={team} teams={teams} matches={matches} duty={duty} disabled={disabled} name="slot_team_id" label={`Plek ${index+1}`}/>)}</div></>:<AvailableTeamSelect key={teamId??'open'} id={`assign-team-${dutyId}`} teamId={teamId} teams={teams} matches={matches} duty={duty} disabled={disabled}/>}<SubmitButton className="button secondary" disabled={disabled}>Team opslaan</SubmitButton></form>;
}
