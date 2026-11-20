import { collectPages } from './pagination';
import { supabase } from './supabase/server';
export type TeamMemberPoints={member_id:string;first_name:string;last_name:string;referee_qualification:string|null;captain:boolean;norm:number;earned:number;planned:number;to_earn:number};
export async function teamMemberPoints(teamId:string):Promise<TeamMemberPoints[]|null> {
 const db=await supabase();
 try{return (await collectPages<TeamMemberPoints>(async(from,to)=>{const r=await db.rpc('team_member_points',{p_team:teamId},{count:'exact'}).order('last_name').order('first_name').order('member_id').range(from,to);return {data:r.data,count:r.count,error:r.error};})).data;}
 catch{return null;}
}
