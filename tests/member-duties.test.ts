import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openMemberDuties,ownDutyEntries,teamDutyCandidates,teamDutyOptions } from '../lib/member-duties';
import { REFEREE_LEVELS } from '../lib/referee-levels';
import type { AppData } from '../lib/data';
import type { Duty,Profile,Enrollment } from '../lib/domain';
const now=new Date('2027-01-01T12:00:00Z');
const profile=(id:string,code='V4'):Profile=>({id,first_name:id,last_name:'Test',email:id+'@example.test',role:'member',referee_level:code==='N1'?8:2,referee_qualification:code,nevobo_code:null});
const duty=(id:string,change:Partial<Duty>={}):Duty=>({id,title:id,kind:'bar',starts_at:'2027-01-10T18:00:00Z',ends_at:'2027-01-10T20:00:00Z',location:'Testhal',points:2,capacity:1,cancelled:false,required_level:0,assigned_team_id:null,...change});
const enrollment=(id:string,duty_id:string,member_id='me',revoked=false):Enrollment=>({id,duty_id,member_id,revoked,offered:false,created_at:'2027-01-01T10:00:00Z'});
function data():AppData {return {profile:profile('me'),profiles:[profile('me'),profile('teammate','N1'),profile('other','N1')],memberships:[{member_id:'me',team_id:'own',captain:true,norm_override:null},{member_id:'teammate',team_id:'own',captain:false,norm_override:null},{member_id:'other',team_id:'other-team',captain:false,norm_override:null}],duties:[],matches:[],enrollments:[],availability:[],assignments:[],teams:[],functions:[],season:null,unreadNotifications:0,syncState:null};}
test('open diensten passen bij team, diploma, planning, bezetting en inschrijfstatus',()=>{
 const d=data();d.duties=[duty('open'),duty('own-team',{assigned_team_id:'own'}),duty('other-team',{assigned_team_id:'other-team'}),duty('ref-low',{kind:'referee',required_qualification:'V6'}),duty('ref-high',{kind:'referee',required_qualification:'R1'}),duty('full'),duty('takeover'),duty('closed',{signup_closed:true}),duty('cancelled',{cancelled:true}),duty('past',{starts_at:'2026-12-01T18:00:00Z',ends_at:'2026-12-01T20:00:00Z'})];
 d.availability=[{duty_id:'full',occupied:1,offered_ids:[]},{duty_id:'takeover',occupied:1,offered_ids:['offered-enrollment']}];
 assert.deepEqual(openMemberDuties(d,now).map(d=>d.id),['open','own-team','ref-low','takeover']);
 d.enrollments=[enrollment('mine','open')];assert.deepEqual(openMemberDuties(d,now),[],'Already registered and overlapping duties are hidden');
 d.memberships=[];assert.deepEqual(openMemberDuties(d,now),[],'An active team membership is required');
});
test('eigen diensten tonen uitsluitend eigen inschrijvingen met behoud van historie',()=>{
 const d=data();d.duties=[duty('active'),duty('withdrawn'),duty('someone-else')];
 d.enrollments=[enrollment('previous','active','me',true),enrollment('current','active'),enrollment('withdrawn','withdrawn','me',true),enrollment('foreign','someone-else','other')];
 assert.deepEqual(ownDutyEntries(d).map(e=>[e.duty.id,e.enrollment.id]),[['active','current'],['withdrawn','withdrawn']]);
});
test('aanvoerder kan alleen beschikbare en bevoegde leden van het eigen team kiezen',()=>{
 const d=data(),ref=duty('ref',{kind:'referee',required_qualification:'R1',assigned_team_id:'own'});
 assert.deepEqual(teamDutyCandidates(d,ref,'own').map(p=>p.id),['teammate']);
 d.duties=[duty('conflict')];d.enrollments=[enrollment('booked','conflict','teammate')];
 assert.deepEqual(teamDutyCandidates(d,ref,'own'),[]);
});
test('alle eigen spelers blijven zichtbaar met correcte licentiereden voor elk vereist niveau',()=>{
 const d=data();
 for(const required of REFEREE_LEVELS) for(const qualification of REFEREE_LEVELS) {
  d.profiles[0]={...d.profiles[0],referee_qualification:qualification,referee_level:99};
  const options=teamDutyOptions(d,duty('ref',{kind:'referee',required_qualification:required}),'own');
  assert.deepEqual(options.map(o=>o.profile.id),['me','teammate']);
  const option=options[0],eligible=REFEREE_LEVELS.indexOf(qualification)>=REFEREE_LEVELS.indexOf(required);
  assert.equal(option.reason===null,eligible,`${qualification} for ${required}`);
  if(!eligible) {assert.match(option.reason!,/Niet de juiste scheidsrechterslicentie/);assert.ok(option.reason!.includes(`minimaal ${required} vereist`));}
 }
 for(const qualification of [null,undefined,'onbekend']) {
  d.profiles[0]={...d.profiles[0],referee_qualification:qualification,referee_level:99};
  assert.match(teamDutyOptions(d,duty('ref',{kind:'referee',required_qualification:'V6'}),'own')[0].reason!,/niveau niet ingesteld/);
 }
 assert.match(teamDutyOptions(d,duty('ref',{kind:'referee'}),'own')[1].reason!,/beheerder/);
});
test('beschikbare licenties blijven onderscheiden van inschrijvingen en roosterconflicten',()=>{
 const d=data(),ref=duty('ref',{kind:'referee',required_qualification:'V4'});
 d.duties=[ref,duty('overlap'),duty('cancelled',{cancelled:true})];
 d.enrollments=[enrollment('assigned','ref'),enrollment('overlap','overlap','teammate')];
 assert.deepEqual(teamDutyOptions(d,ref,'own').map(o=>o.reason),['Al toegewezen aan deze dienst.','Al ingepland op een overlappende dienst.']);
 d.enrollments=[enrollment('revoked','overlap','me',true),enrollment('cancelled','cancelled','teammate')];
 assert.deepEqual(teamDutyOptions(d,ref,'own').map(o=>o.reason),[null,null]);
 assert.equal(teamDutyOptions(d,duty('bar'),'own').length,2,'Bar duties do not require a referee licence');
});
