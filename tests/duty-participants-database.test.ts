import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('deelnemersnamen zijn beperkt tot actieve inschrijvingen op komende diensten van het actieve seizoen',async()=>{
 const db=new PGlite(),member='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
  for(const id of [member,other]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set first_name='Andere',last_name='Speler' where id=$1",[other]);
  const active=(await db.query<{id:string}>("insert into seasons(name,starts_on,ends_on,default_norm,active) values('Actief',current_date,current_date+100,20,true) returning id")).rows[0].id;
  const old=(await db.query<{id:string}>("insert into seasons(name,starts_on,ends_on,default_norm,active) values('Ander',current_date,current_date+100,20,false) returning id")).rows[0].id;
  let visible='';
  for(const kind of ['visible','past','cancelled','other-season','revoked']) {
   const id=(await db.query<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,points,capacity,cancelled) values($1,$2,'bar',now()+$3::interval,now()+$3::interval+interval '1 hour','Hal',1,1,$4) returning id",[kind==='other-season'?old:active,kind,kind==='past'?'-3 days':'3 days',kind==='cancelled'])).rows[0].id;
   await db.query('insert into enrollments(duty_id,member_id,revoked) values($1,$2,$3)',[id,other,kind==='revoked']);
   if(kind==='visible') visible=id;
  }
  const migration=await readFile(new URL('../supabase/migrations/011_duty_participants.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[member]);await db.exec('set role authenticated');
  assert.equal((await db.query('select * from enrollments')).rows.length,0,'Other enrollment records stay private');
  assert.equal((await db.query('select * from profiles where id=$1',[other])).rows.length,0,'No broader profile access');
  assert.deepEqual((await db.query('select * from duty_participants()')).rows,[{duty_id:visible,first_name:'Andere',last_name:'Speler'}]);
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role authenticated');
  assert.equal((await db.query('select * from duty_participants()')).rows.length,0);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from duty_participants()'),/permission denied/);
 } finally {await db.close();}
});
