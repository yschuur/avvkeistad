import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFilters,matchFilterUrl,selectMatches,matchLocationValue,matchDay,displayMatchStatus,type MatchFilterRecord } from '../lib/match-filters';
const now=new Date('2026-11-09T12:00:00Z');
const source:MatchFilterRecord[]=[
 {id:'home',home_team:'AVV Keistad DS 1',away_team:'Andere club DS 1',starts_at:'2026-11-09T23:30:00Z',location:'Sporthal',city:'Amersfoort',status:'scheduled'},
 {id:'away',home_team:'Andere club DS 1',away_team:'AVV Keistad DS 1',starts_at:'2026-11-10T18:00:00Z',location:'Sporthal',city:'Amersfoort',status:'cancelled'},
 {id:'other-city',home_team:'AVV Keistad DS 1',away_team:'Andere club DS 1',starts_at:'2026-11-10T19:00:00Z',location:'Sporthal',city:'Utrecht',status:'scheduled'},
 {id:'other-team',home_team:'AVV Keistad DS 10',away_team:'Andere club DS 2',starts_at:'2026-11-10T20:00:00Z',location:'Sporthal',city:'Amersfoort',status:'scheduled'},
 {id:'elapsed',home_team:'AVV Keistad DS 1',away_team:'Andere club DS 1',starts_at:'2026-11-09T11:00:00Z',location:'Sporthal',city:'Amersfoort',status:'scheduled'},
 {id:'played',home_team:'AVV Keistad DS 1',away_team:'Andere club DS 1',starts_at:'2026-11-08T11:00:00Z',location:'Sporthal',city:'Amersfoort',status:'played'},
 {id:'unknown',home_team:'AVV Keistad DS 1',away_team:'Andere club DS 1',starts_at:null,location:'',city:null,status:'missing'},
];
const ids=(params:Record<string,string|undefined>)=>selectMatches(source,matchFilters(params),now).map(m=>m.id);

test('combineert wedstrijddag, exact thuis-/uitteam, locatie met plaats en zichtbare status',()=>{
 const location=matchLocationValue(source[0]);
 assert.deepEqual(ids({view:'all',day:'2026-11-10',team:'AVV Keistad DS 1',location,status:'scheduled'}),['home']);
 assert.deepEqual(ids({view:'all',day:'2026-11-10',team:'AVV Keistad DS 1',location,status:'cancelled'}),['away']);
 assert.deepEqual(ids({view:'all',team:'AVV Keistad DS 1',location:matchLocationValue(source[2])}),['other-city']);
 assert.deepEqual(ids({view:'all',day:'2026-11-11'}),[]);
 assert.deepEqual(ids({view:'all',match:'away',status:'scheduled'}),[]);
 assert.deepEqual(ids({view:'all',match:'away'}),['away']);
});
test('kalenderdag gebruikt Amsterdam, ook rond middernacht en de zomertijdwissel',()=>{
 assert.equal(matchDay('2026-11-09T23:30:00Z'),'2026-11-10');
 assert.equal(matchDay('2027-03-27T23:30:00Z'),'2027-03-28');
 assert.equal(matchDay('2027-03-28T22:30:00Z'),'2027-03-29');
 assert.equal(matchDay('2027-06-01T22:30:00Z'),'2027-06-02');
 assert.equal(matchDay(null),'');assert.equal(matchDay('invalid'),'');
 assert.equal(matchFilters({day:'2026-02-30'}).day,'');
});
test('statusfilter volgt labels, historie en sluiting zonder gespeeld te verzinnen',()=>{
 assert.deepEqual(ids({view:'history',status:'elapsed'}),['elapsed']);
 assert.deepEqual(ids({view:'history',status:'played'}),['played']);
 assert.deepEqual(ids({view:'upcoming',status:'elapsed'}),[]);
 assert.deepEqual(ids({view:'all',status:'missing'}),['unknown']);
 assert.deepEqual(ids({view:'history'}),['played','elapsed']);
 assert.equal(displayMatchStatus({...source[4],cancelled:true},now),'cancelled');
 assert.equal(displayMatchStatus({...source[0],status:'unsupported'},now),'missing');
 assert.equal(displayMatchStatus({...source[0],status:undefined},now),'scheduled');
});
test('filters blijven gecodeerd bewaard in tab- en paginalinks, zonder oude paginanummers',()=>{
 const filters=matchFilters({view:'all',day:'2026-11-10',team:"Lammerink/Set-Up '65 DS 1 & Club",location:matchLocationValue(source[0]),status:'scheduled',match:'home'});
 const link=new URL(matchFilterUrl(filters,{page:2}),'https://app.example.test');
 for(const [key,value] of Object.entries(filters)) assert.equal(link.searchParams.get(key),value);
 assert.equal(link.searchParams.get('page'),'2');
 const history=new URL(matchFilterUrl(filters,{view:'history'}),'https://app.example.test');
 assert.equal(history.searchParams.get('page'),null);assert.equal(history.searchParams.get('team'),filters.team);
 assert.equal(new URL(matchFilterUrl(filters,{clearMatch:true}),'https://app.example.test').searchParams.get('match'),null);
 assert.equal(matchFilterUrl(matchFilters({view:'all'})),'/wedstrijden?view=all');
});
