import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('bardienstenset: weekdagen, variatie, urenpunten, meerdere diensten, veilige herhaling en seizoencontrole',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
  await db.exec("create function public.now() returns timestamptz language sql stable as $$select '2026-11-10T00:00:00+01'::timestamptz$$;set search_path=public,pg_catalog;");
  const seed=await readFile(new URL('../scripts/seed-bar-duties-2026.sql',import.meta.url),'utf8');
  await assert.rejects(db.exec(seed),/actief seizoen/);await db.exec('rollback');
  await db.exec("insert into seasons(name,starts_on,ends_on,active,default_norm) values('Test','2026-09-01','2027-07-01',true,20)");
  await db.exec(seed);
  const rows=(await db.query<{id:string;weekday:number;points:string;capacity:number;duration:string;day:string;kind:string;location:string}>("select id,extract(isodow from starts_at at time zone 'Europe/Amsterdam')::int as weekday,points::text,capacity,extract(epoch from ends_at-starts_at)::text as duration,(starts_at at time zone 'Europe/Amsterdam')::date::text as day,kind,location from duties order by starts_at")).rows;
  assert.equal(rows.length,66);
  assert.deepEqual([...new Set(rows.map(r=>r.weekday))].sort(),[2,4,5,6]);
  assert.ok(new Set(rows.map(r=>r.capacity)).size>=3);assert.ok(new Set(rows.map(r=>r.duration)).size>=3);
  for(const r of rows) {assert.equal(r.kind,'bar');assert.equal(r.location,'Sportcomplex Amerena');assert.ok(r.day>='2026-11-10'&&r.day<='2026-12-31');assert.equal(Number(r.points),Number(r.duration)/3600);}
  const days=new Map<string,number>();for(const r of rows) days.set(r.day,(days.get(r.day)??0)+1);assert.ok([...days.values()].some(n=>n>=3));
  await db.query('update duties set cancelled=true where id=$1',[rows[0].id]);
  await db.exec(seed);assert.equal((await db.query<{n:number}>('select count(*)::int as n from duties')).rows[0].n,rows.length);
  assert.equal((await db.query<{cancelled:boolean}>('select cancelled from duties where id=$1',[rows[0].id])).rows[0].cancelled,true);
  await db.exec("update seasons set ends_on='2026-12-15'");await assert.rejects(db.exec(seed),/actieve seizoen/);await db.exec('rollback');
  await db.exec('set role anon');await assert.rejects(db.exec(seed),/permission denied/);await db.exec('rollback');
 } finally {await db.close();}
});
