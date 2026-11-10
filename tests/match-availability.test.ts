import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamMatchConflict } from '../lib/match-availability';
const match={home_team:'Proglass/AVV Keistad DS 2',away_team:'Andere club DS 1',starts_at:'2027-01-16T12:00:00Z',status:'scheduled'};
const window=(start:string,end:string)=>({starts_at:`2027-01-16T${start}Z`,ends_at:`2027-01-16T${end}Z`});
test('thuiswedstrijd: 120 minuten; direct vóór en na de wedstrijd beschikbaar',()=>{
 assert.equal(teamMatchConflict('DS 2',[match],window('10:00:00','12:00:00')),null);
 assert.equal(teamMatchConflict('Dames 2',[match],window('14:00:00','15:00:00')),null);
 assert.equal(teamMatchConflict('AVV Keistad DS 2',[match],window('11:59:59','12:00:01')),'Eigen thuiswedstrijd');
 assert.equal(teamMatchConflict('DS 2',[match],window('13:59:59','15:00:00')),'Eigen thuiswedstrijd');
});
test('uitwedstrijd: volledige dienst moet buiten wedstrijd plus drie uur reistijd passen',()=>{
 const away={...match,home_team:match.away_team,away_team:match.home_team};
 assert.equal(teamMatchConflict('DS 2',[away],window('07:00:00','09:00:00')),null);
 assert.equal(teamMatchConflict('DS 2',[away],window('17:00:00','19:00:00')),null);
 assert.equal(teamMatchConflict('DS 2',[{...away,status:'played'}],window('14:00:00','15:00:00')),'Uitwedstrijd / reistijd');
 for(const [start,end] of [['08:00:00','09:00:01'],['16:59:59','18:00:00'],['07:00:00','13:00:00']]) assert.equal(teamMatchConflict('DS 2',[away],window(start,end)),'Uitwedstrijd / reistijd');
});
test('alleen eigen geplande wedstrijden tellen mee; sponsor, meerdere wedstrijden en annulering',()=>{
 const duty=window('12:00:00','13:00:00');
 for(const m of [{...match,cancelled:true},{...match,status:'cancelled'},{...match,status:'postponed'},{...match,starts_at:null}]) assert.equal(teamMatchConflict('DS 2',[m],duty),null);
 assert.equal(teamMatchConflict('DS 3',[match],duty),null);assert.equal(teamMatchConflict('Onbekend',[match],duty),null);
 assert.equal(teamMatchConflict('DS 2',[{...match,starts_at:'2027-01-17T12:00:00Z'},match],duty),'Eigen thuiswedstrijd');
});
