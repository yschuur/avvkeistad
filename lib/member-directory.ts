import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Profile } from './domain';
import type { Membership } from './data';
export const MEMBERS_PAGE_SIZE=25;
const emptySeason='00000000-0000-0000-0000-000000000000';
type MemberRow=Profile&{memberships:Membership[]};
export function memberSearchFilter(value:string) {
 const terms=value.trim().slice(0,200).split(/\s+/).filter(Boolean);
 const clauses=terms.map(term=>{
  const pattern=JSON.stringify('%'+term.replace(/[\\%_*]/g,'\\$&')+'%');
  return `or(first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern})`;
 });
 return clauses.length?`and(${clauses.join(',')})`:null;
}
export function memberDirectoryUrl(params:Record<string,string|undefined>,page=1,member?:string) {
 const q=new URLSearchParams();if(params.q)q.set('q',params.q.slice(0,200));if(params.team)q.set('team',params.team);
 if(page>1)q.set('page',String(page));if(member)q.set('member',member);
 return '/beheer/leden'+(q.size?'?'+q:'');
}
export async function loadMemberDirectory(db:SupabaseClient,seasonId:string|null,params:Record<string,string|undefined>) {
 const search=memberSearchFilter(params.q??''),team=params.team;
 const query=(head=false)=>{
  let request=db.from('profiles').select(`*,memberships!${team&&team!=='none'?'inner':'left'}(member_id,team_id,captain,norm_override)`,{count:'exact',head}).eq('memberships.season_id',seasonId??emptySeason);
  if(team==='none')request=request.is('memberships',null);
  else if(team)request=z.uuid().safeParse(team).success?request.eq('memberships.team_id',team):request.eq('id',emptySeason);
  if(search)request=request.or(search);
  return request;
 };
 const counted=await query(true);
 if(counted.error||counted.count===null)throw new Error('Het ledenoverzicht kon niet worden opgehaald. Probeer opnieuw.');
 const total=counted.count,pages=Math.max(1,Math.ceil(total/MEMBERS_PAGE_SIZE)),requested=Number(params.page??1);
 const page=Math.min(pages,Number.isSafeInteger(requested)&&requested>0?requested:1);
 const result=await query().order('last_name').order('first_name').order('id').range((page-1)*MEMBERS_PAGE_SIZE,page*MEMBERS_PAGE_SIZE-1);
 if(result.error)throw new Error('De leden konden niet worden opgehaald. Probeer opnieuw.');
 const rows=(result.data??[]) as unknown as MemberRow[],editorRows=[...rows];
 if(params.member&&z.uuid().safeParse(params.member).success&&!rows.some(p=>p.id===params.member)) {
  const selected=await db.from('profiles').select('*,memberships!left(member_id,team_id,captain,norm_override)').eq('id',params.member).eq('memberships.season_id',seasonId??emptySeason).maybeSingle();
  if(selected.error)throw new Error('Het gekozen lid kon niet worden opgehaald.');
  if(selected.data)editorRows.push(selected.data as MemberRow);
 }
 return {profiles:rows.map(({memberships,...profile})=>profile),editorProfiles:editorRows.map(({memberships,...profile})=>profile),memberships:editorRows.flatMap(p=>p.memberships??[]),page,pages,total};
}
