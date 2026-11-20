import { keistadTeamKey } from './team-identity';
export const teamAgeLabels={senior:'Senioren',youth:'Jeugd',mini:"Mini’s"} as const;
export type TeamAge=keyof typeof teamAgeLabels;
export function teamAge(name:string,stored?:string):TeamAge|null {
 const key=keistadTeamKey(name,true);
 if(key?.startsWith('L'))return 'mini';
 if(stored==='mini'||stored==='youth'||stored==='senior')return stored;
 if(key&&/^(HS|DS)/.test(key))return 'senior';
 if(key)return 'youth';
 return null;
}
export function matchAge(match:{home_team:string;away_team:string},teams:{name:string;age_class:string}[]=[]):TeamAge|null {
 for(const name of [match.home_team,match.away_team]) {
  const key=keistadTeamKey(name);if(!key)continue;
  const team=teams.find(t=>keistadTeamKey(t.name,true)===key);
  return teamAge(name,team?.age_class);
 }
 return null;
}
