import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dutySlots,dutySlotTeams,teamSlotSummary,canTakeDutySlot,dutyTeamSummary } from '../lib/duty-slots';
import type { Duty } from '../lib/domain';
const duty: Duty={id:'d',title:'Bar',kind:'bar',starts_at:'2027-02-01T18:00:00Z',ends_at:'2027-02-01T20:00:00Z',points:2,capacity:3,location:'Hal',required_level:0,assigned_team_id:null,cancelled:false,slot_team_ids:['A','A','B']};
const slots=[{slot:1,team_id:'A',occupied:true},{slot:2,team_id:'A',occupied:false},{slot:3,team_id:'B',occupied:false}];
test('aanvoerder ziet eigen gereserveerde plekken en aparte voortgang per team',()=>{
 const a={occupied:1,slots};assert.deepEqual(teamSlotSummary(duty,'A',a),{slots:slots.slice(0,2),total:2,filled:1,remaining:1});
 assert.deepEqual(teamSlotSummary(duty,'B',a),{slots:slots.slice(2),total:1,filled:0,remaining:1});
 assert.equal(dutyTeamSummary(duty,[{id:'A',name:'Heren 1'},{id:'B',name:'Dames 2'}]),'Heren 1: 2 plekken · Dames 2: 1 plek');
});
test('volle eigen plekken blijven vol terwijl een ander team nog ruimte heeft; overnames volgen de plek',()=>{
 const a={occupied:2,slots:slots.map(s=>({...s,occupied:s.team_id==='A'}))};
 assert.equal(canTakeDutySlot(duty,'A',a),false);assert.equal(canTakeDutySlot(duty,'B',a),true);assert.equal(canTakeDutySlot(duty,'C',a),false);
 a.slots[0]={...a.slots[0],offered_id:'takeover'} as typeof a.slots[number];assert.equal(canTakeDutySlot(duty,'A',a),true);assert.equal(canTakeDutySlot(duty,'C',a),false);
 assert.equal(canTakeDutySlot({...duty,slot_team_ids:['A','A',null]},'C',{occupied:2,slots:a.slots.map(s=>({...s,team_id:s.slot===3?null:s.team_id}))}),true);
});
test('bestaande hele-teamreserveringen blijven bruikbaar voordat migratie 017 is toegepast',()=>{
 const old={...duty,slot_team_ids:undefined,assigned_team_id:'A'};
 assert.deepEqual(dutySlotTeams(old),['A','A','A']);assert.equal(dutySlots(old,{occupied:1})[0].occupied,true);
 assert.equal(teamSlotSummary(old,'A',{occupied:1}).remaining,2);
 assert.equal(canTakeDutySlot(old,'A',{occupied:3,offered_ids:['offered']}),true);
});
