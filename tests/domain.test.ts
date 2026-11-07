import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canWithdraw, overlaps, progress } from '../lib/domain';
test('afmelden is toegestaan tot, maar niet op, de 24-uursgrens',()=>{
 const joined='2026-11-01T10:00:00Z',starts='2026-11-10T10:00:00Z';
 assert.equal(canWithdraw(joined,starts,new Date('2026-11-02T09:59:59Z')),true);
 assert.equal(canWithdraw(joined,starts,new Date('2026-11-02T10:00:00Z')),false);
 assert.equal(canWithdraw(joined,'2026-11-01T11:00:00Z',new Date('2026-11-01T11:00:00Z')),false);
});
test('aansluitende diensten overlappen niet',()=>{
 const a={starts_at:'2026-11-01T10:00:00Z',ends_at:'2026-11-01T12:00:00Z'};
 assert.equal(overlaps(a,{starts_at:a.ends_at,ends_at:'2026-11-01T14:00:00Z'}),false);
 assert.equal(overlaps(a,{starts_at:'2026-11-01T11:59:59Z',ends_at:'2026-11-01T14:00:00Z'}),true);
});
test('behaald en ingepland blijven afzonderlijk, tekorten worden niet negatief',()=>{
 assert.deepEqual(progress(20,8,6),{norm:20,earned:8,planned:6,toPlan:6,toEarn:12});
 assert.equal(progress(10,12,3).toPlan,0);
 assert.equal(progress(10,12,3).toEarn,0);
});
