import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadMemberDirectory,memberDirectoryUrl,memberSearchFilter } from '../lib/member-directory';
const team='20000000-0000-4000-8000-000000000001',season='30000000-0000-4000-8000-000000000001';
const fixtures=Array.from({length:67},(_,i)=>({id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,first_name:'Lid',last_name:`Test ${String(i).padStart(2,'0')}`,email:`lid${i}@example.test`,role:'member',referee_level:0,nevobo_code:null,memberships:[{member_id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,team_id:team,captain:false,norm_override:null}]}));
function backend(rows=fixtures,fail=false) {
 const requests:{url:URL;method:string}[]=[];
 const db=createClient('https://members.example.test','local-test-key',{global:{fetch:async(input,init)=>{
  const url=new URL(String(input)),method=init?.method??'GET';requests.push({url,method});
  if(fail)return new Response(JSON.stringify({message:'Test unavailable'}),{status:503});
  const selected=url.searchParams.get('id')?.slice(3),filtered=selected?rows.filter(p=>p.id===selected):rows;
  const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??25),page=filtered.slice(offset,offset+limit);
  return new Response(method==='HEAD'?null:JSON.stringify(page),{headers:{'Content-Type':'application/json','Content-Range':`${page.length?`${offset}-${offset+page.length-1}`:'*'}/${filtered.length}`}});
 }}});
 return {db,requests};
}
test('leden worden als 25 rijen opgehaald; telling is HEAD en pagina’s zijn stabiel begrensd',async()=>{
 for(const [requested,page,offset,length] of [['1',1,0,25],['2',2,25,25],['3',3,50,17],['999',3,50,17],['-1',1,0,25],['abc',1,0,25]] as const){
  const {db,requests}=backend(),result=await loadMemberDirectory(db,season,{page:requested});
  assert.equal(result.page,page);assert.equal(result.total,67);assert.equal(result.pages,3);assert.equal(result.profiles.length,length);assert.equal(result.editorProfiles.length,length);
  assert.equal(requests.length,2);assert.equal(requests[0].method,'HEAD');assert.equal(requests[0].url.searchParams.has('limit'),false);
  assert.equal(requests[1].url.searchParams.get('limit'),'25');assert.equal(requests[1].url.searchParams.get('offset'),String(offset));
  assert.equal(requests[1].url.searchParams.get('order'),'last_name.asc,first_name.asc,id.asc');assert.equal(requests[1].url.searchParams.get('memberships.season_id'),'eq.'+season);
 }
});
test('naam/e-mail en teamfilters gelden voor telling én rijen; Geen team gebruikt een anti-join in het gekozen seizoen',async()=>{
 const {db,requests}=backend();await loadMemberDirectory(db,season,{q:'Anna Test',team,page:'2'});
 for(const r of requests){assert.match(r.url.searchParams.get('select')!,/memberships!inner/);assert.equal(r.url.searchParams.get('memberships.team_id'),'eq.'+team);assert.equal(r.url.searchParams.get('or'),'('+memberSearchFilter('Anna Test')+')');}
 const other=backend();await loadMemberDirectory(other.db,season,{team:'none'});
 for(const r of other.requests){assert.match(r.url.searchParams.get('select')!,/memberships!left/);assert.equal(r.url.searchParams.get('memberships'),'is.null');assert.equal(r.url.searchParams.get('memberships.season_id'),'eq.'+season);}
 assert.equal(memberDirectoryUrl({q:'Anna Test',team},2),'/beheer/leden?q=Anna+Test&team='+team+'&page=2');
 assert.equal(memberSearchFilter(''),null);assert.match(memberSearchFilter('a%,(b)')!,/ilike\."%a\\\\%,\(b\)%"/);
});
test('direct geopend lid buiten de tabel wordt apart geladen zonder een 26e tabelrij',async()=>{
 const {db,requests}=backend(),result=await loadMemberDirectory(db,season,{page:'2',member:fixtures[60].id});
 assert.equal(result.profiles.length,25);assert.equal(result.profiles.some(p=>p.id===fixtures[60].id),false);assert.equal(result.editorProfiles.length,26);
 assert.equal(result.editorProfiles.at(-1)?.id,fixtures[60].id);assert.equal(result.total,67);assert.equal(requests.length,3);assert.equal(requests[2].url.searchParams.get('id'),'eq.'+fixtures[60].id);
});
test('lege resultaten en backendfouten leveren geen onjuist of onvolledig ledenoverzicht',async()=>{
 const empty=backend([]),result=await loadMemberDirectory(empty.db,null,{page:'999'});assert.equal(result.page,1);assert.equal(result.total,0);assert.equal(result.profiles.length,0);
 const broken=backend(fixtures,true);await assert.rejects(loadMemberDirectory(broken.db,season,{}),/niet worden opgehaald/);
});
