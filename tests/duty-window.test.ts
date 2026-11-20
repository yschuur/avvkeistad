import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dutyDayWindow } from '../lib/duty-window';
test('dienstendagen gebruiken lokale grenzen inclusief zomer- en wintertijd',()=>{
 for(const [day,hours] of [['2027-03-28',23],['2027-10-31',25],['2027-05-12',24]] as const){const w=dutyDayWindow(day);assert.equal((Date.parse(w.end)-Date.parse(w.start))/3600000,hours);}
 assert.deepEqual(dutyDayWindow('2026-11-23'),{start:'2026-11-22T23:00:00.000Z',end:'2026-11-23T23:00:00.000Z'});
 for(const day of ['2027-02-30','invalid','2027-13-01'])assert.throws(()=>dutyDayWindow(day));
});
