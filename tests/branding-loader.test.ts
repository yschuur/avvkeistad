import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBranding,publicBrandingHeaders } from '../lib/branding-loader';
const row={club_name:'Testclub',logo_data:null,primary_color:'#112233',secondary_color:'#445566',accent_color:'#778899'};
test('huisstijl: legacy JWT en nieuwe publishable key gebruiken hun juiste headers',()=>{
 assert.deepEqual(publicBrandingHeaders('eyJ.local.test'),{apikey:'eyJ.local.test',Authorization:'Bearer eyJ.local.test'});
 assert.deepEqual(publicBrandingHeaders('sb_publishable_local_test'),{apikey:'sb_publishable_local_test'});
});
test('huisstijl: tijdelijke storing of rechtenfout wordt niet als ontbrekende 007 gemeld',async()=>{
 for(const error of [{code:'42501',status:403},{code:'PGRST301',status:401},{code:'bad_gateway',status:502}]) {
  let requests=0;const result=await loadBranding(async()=>{requests++;return {data:null,error};});
  assert.equal(requests,1);assert.equal(result.available,false);assert.equal(result.issue,error.status===502?'connection':'access');
 }
 assert.equal((await loadBranding(async()=>{throw new Error('Network failure');})).issue,'connection');
});
test('huisstijl: herstelde verbinding en uitgevoerde migratie worden meteen opgehaald',async()=>{
 let upgraded=false;
 const read=async(columns:string)=>!upgraded&&columns.includes('club_name')?{data:null,error:{code:'42703'}}:{data:[upgraded?row:{primary_color:row.primary_color,secondary_color:row.secondary_color}]};
 const before=await loadBranding(read);assert.equal(before.available,true);assert.equal(before.identityAvailable,false);
 upgraded=true;const after=await loadBranding(read);assert.equal(after.identityAvailable,true);assert.equal(after.clubName,'Testclub');assert.equal(after.accentColor,row.accent_color);
});
test('huisstijl: ontbrekende of ongeldige gegevens worden niet stil als bestaande configuratie bewerkt',async()=>{
 assert.equal((await loadBranding(async()=>({data:[]}))).issue,'missing');
 assert.equal((await loadBranding(async()=>({data:[{...row,accent_color:'red'}]}))).issue,'invalid');
});
