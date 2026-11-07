import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DEFAULT_BRANDING } from '../lib/branding';

test('huisstijlmigratie: persistentie, beheerrechten, publieke kleuren en behoud van bestaande data',async()=>{
 const db=new PGlite();
 const admin='10000000-0000-4000-8000-000000000001',manager='10000000-0000-4000-8000-000000000002',member='10000000-0000-4000-8000-000000000003';
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
  for(const id of [admin,manager,member]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='admin' where id=$1",[admin]);await db.query("update profiles set role='manager' where id=$1",[manager]);
  const before=(await db.query('select id,email,role from profiles order by id')).rows;
  const migration=await readFile(new URL('../supabase/migrations/002_club_branding.sql',import.meta.url),'utf8');
  await db.exec(migration);
  let colors=await db.query<{primary_color:string;secondary_color:string}>('select primary_color,secondary_color from club_branding');
  assert.deepEqual(colors.rows,[{primary_color:DEFAULT_BRANDING.primaryColor,secondary_color:DEFAULT_BRANDING.secondaryColor}]);
  const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id ?? '']);await db.exec('set role '+(id?'authenticated':'anon'));};
  await as(null);
  assert.equal((await db.query('select primary_color,secondary_color from club_branding')).rows.length,1);
  await assert.rejects(db.query<{updated_by:string}>('select updated_by from club_branding'),/permission denied/);
  await assert.rejects(db.query("select save_club_branding('#112233','#445566')"),/permission denied/);
  await as(member);
  await assert.rejects(db.query("select save_club_branding('#112233','#445566')"),/Geen beheerrechten/);
  await assert.rejects(db.query("update club_branding set primary_color='#112233'"),/permission denied/);
  await as(manager);await db.query("select save_club_branding('#112233','#445566')");
  await assert.rejects(db.query("select save_club_branding('#123;bad','#445566')"),/HEX/);
  await assert.rejects(db.query("select save_club_branding(null,'#445566')"),/HEX/);
  await as(admin);await db.query("select save_club_branding('#abcdef','#ffffff')");
  colors=await db.query('select primary_color,secondary_color from club_branding');
  assert.deepEqual(colors.rows,[{primary_color:'#ABCDEF',secondary_color:'#FFFFFF'}]);
  await db.exec('reset role');
  assert.equal((await db.query<{updated_by:string}>('select updated_by from club_branding')).rows[0].updated_by,admin);
  assert.equal((await db.query<{n:number}>("select count(*)::int as n from audit_log where action='save_club_branding'")).rows[0].n,2);
  await db.exec(migration); // Re-applying the new migration must not reset colours.
  assert.deepEqual((await db.query('select primary_color,secondary_color from club_branding')).rows,colors.rows);
  assert.deepEqual((await db.query('select id,email,role from profiles order by id')).rows,before);
  await as(admin);await db.query('select save_club_branding($1,$2)',[DEFAULT_BRANDING.primaryColor,DEFAULT_BRANDING.secondaryColor]);
  assert.deepEqual((await db.query('select primary_color,secondary_color from club_branding')).rows,[{primary_color:DEFAULT_BRANDING.primaryColor,secondary_color:DEFAULT_BRANDING.secondaryColor}]);
 } finally {await db.close();}
});
