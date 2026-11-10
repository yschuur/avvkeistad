import { keistadTeamKey } from './team-identity';
export const MATCH_DURATION_MINUTES=120;
export const AWAY_TRAVEL_MINUTES=180;
export type AvailabilityMatch={home_team:string;away_team:string;starts_at:string|null;status?:string;cancelled?:boolean};
export type DutyWindow={starts_at:string;ends_at:string};
/** Index once per screen: each member/team checks only its own matches. */
export function createMatchAvailability(matches:AvailabilityMatch[]) {
 const schedule=new Map<string,{start:number;end:number;reason:string}[]>();
 for(const match of matches) {
  if(match.cancelled||!['scheduled','played'].includes(match.status??'scheduled')||!match.starts_at)continue;
  const begins=new Date(match.starts_at).getTime();if(!Number.isFinite(begins))continue;
  const home=keistadTeamKey(match.home_team),away=keistadTeamKey(match.away_team),finishes=begins+MATCH_DURATION_MINUTES*60000,travel=AWAY_TRAVEL_MINUTES*60000;
  if(home)schedule.set(home,[...(schedule.get(home)??[]),{start:begins,end:finishes,reason:'Eigen thuiswedstrijd'}]);
  if(away&&away!==home)schedule.set(away,[...(schedule.get(away)??[]),{start:begins-travel,end:finishes+travel,reason:'Uitwedstrijd / reistijd'}]);
 }
 return (teamName:string,duty:DutyWindow):string|null=>{
  const key=keistadTeamKey(teamName,true),start=new Date(duty.starts_at).getTime(),end=new Date(duty.ends_at).getTime();
  if(!key||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
  return schedule.get(key)?.find(match=>start<match.end&&end>match.start)?.reason??null;
 };
}
export function teamMatchConflict(teamName:string,matches:AvailabilityMatch[],duty:DutyWindow):string|null {
 return createMatchAvailability(matches)(teamName,duty);
}
