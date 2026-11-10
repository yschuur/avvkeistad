import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planningMonth,planningUrl,pageNumbers } from '../lib/planning';
const season={starts_on:'2026-09-01',ends_on:'2027-06-30'};
test('maandplanning gebruikt lokale maandgrenzen, seizoen en zomertijd',()=>{
 const march=planningMonth('2027-03',season);assert.equal(march.start,'2027-02-28T23:00:00.000Z');assert.equal(march.end,'2027-03-31T22:00:00.000Z');assert.equal(march.months.length,10);
 assert.equal(planningMonth('2025-01',season).month,'2026-09');assert.equal(planningMonth('2028-03',season).month,'2027-06');assert.equal(planningMonth('2026-99',season,new Date('2026-11-10')).month,'2026-11');
 assert.equal(planningMonth(undefined,null,new Date('2026-10-31T23:30:00Z')).month,'2026-11');
});
test('directe paginakeuze houdt begin/einde bereikbaar zonder honderden links',()=>{
 assert.deepEqual(pageNumbers(1,4),[1,2,3,4]);assert.deepEqual(pageNumbers(10,21),[1,8,9,10,11,12,21]);assert.deepEqual(pageNumbers(21,21),[1,19,20,21]);
});
test('maandnavigatie bewaart filters en wist alleen dag en geopende dienst',()=>{
 const url=planningUrl({month:'2026-11',status:'open',day:'2026-11-10',team:'team',kind:'bar',duty:'id',error:'x'},{month:'2026-12',day:undefined,duty:undefined});
 assert.equal(url,'/beheer/planning?month=2026-12&status=open&team=team&kind=bar');
});
