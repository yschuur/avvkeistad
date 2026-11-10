import { AvailableTeamSelect } from './available-team-select';
import type { AvailabilityMatch,DutyWindow } from '@/lib/match-availability';
import { assignDutyTeam } from '@/app/actions';
import type { Team } from '@/lib/data';
import { SubmitButton } from './submit-button';
export function TeamDutyAssignment({dutyId,teamId,teams,returnTo,disabled=false,matches=[],duty}:{dutyId:string;teamId:string|null;teams:Team[];returnTo:string;disabled?:boolean;matches?:AvailabilityMatch[];duty?:DutyWindow}) {
 const id=`assign-team-${dutyId}`;
 return <form action={assignDutyTeam} className="team-assignment-form"><input type="hidden" name="duty_id" value={dutyId}/><input type="hidden" name="return_to" value={returnTo}/><AvailableTeamSelect key={teamId??'open'} id={id} teamId={teamId} teams={teams} matches={matches} duty={duty} disabled={disabled}/><SubmitButton className="button secondary" disabled={disabled}>Team opslaan</SubmitButton></form>;
}
