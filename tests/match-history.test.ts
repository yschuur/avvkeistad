import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchChanges,eventMatchName,matchLogUrl,logDate,type MatchEvent } from '../lib/match-history';

test('wijzigingslog toont uitsluitend werkelijk veranderde velden met oude en nieuwe waarden',()=>{
 const before={home_team:'Test thuis',away_team:'Test uit',starts_at:'2026-11-14T13:30:00Z',location:'Oude testhal',status:'scheduled',court:null};
 const changes=matchChanges(before,{...before,starts_at:'2026-11-14T14:30:00Z',location:'Nieuwe testhal',status:'cancelled'});
 assert.deepEqual(changes.map(c=>c.key),['starts_at','location','status']);
 assert.match(changes[0].before,/14:30/);assert.match(changes[0].after,/15:30/);assert.match(changes[0].after,/2026/);
 assert.deepEqual(changes[1],{key:'location',label:'Locatie',before:'Oude testhal',after:'Nieuwe testhal'});
 assert.equal(changes[2].before,'Gepland');assert.equal(changes[2].after,'Afgelast');
 assert.deepEqual(matchChanges(before,before),[]);
 assert.deepEqual(matchChanges(null,[]),[]);
 assert.notEqual(logDate('2026-10-25T00:30:00Z'),logDate('2026-10-25T01:30:00Z'),'Herhaalde lokale kloktijd bij wintertijd blijft te onderscheiden');
});
test('lognamen komen uit de vastgelegde wijziging; paginering bewaart logfilters',()=>{
 const event={new_state:{home_team:'Historische teamnaam',away_team:'Historische tegenstander'},match:{home_team:'Huidige naam',away_team:'Huidige tegenstander',match_code:null}} as MatchEvent;
 assert.equal(eventMatchName(event),'Historische teamnaam – Historische tegenstander');
 assert.equal(eventMatchName({...event,new_state:null}),'Huidige naam – Huidige tegenstander');
 const params={kind:'cancelled',match:'test-match'};
 assert.equal(matchLogUrl(params,2),'/wedstrijden/log?kind=cancelled&match=test-match&page=2');
 assert.equal(matchLogUrl({kind:'not-real'}),'/wedstrijden/log');
});
