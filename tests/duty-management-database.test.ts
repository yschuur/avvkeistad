import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('dienst wijzigen: beheerrechten, capaciteit, overlap, seizoen, punten en meldingen',async()=>{
 const db=new PGlite(),manager='10000000-0000-4000-8000-000000000001',member='10000000-0000-4000-8000-000000000002';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const file of ['001_initial.sql','003_nevobo_matches.sql','015_duty_management.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  for(const id of [manager,member]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='manager' where id=$1",[manager]);
  const season=(await db.query<{id:string}>("insert into seasons(name,starts_on,ends_on,active,default_norm) values('Test',current_date-30,current_date+365,true,20) returning id")).rows[0].id;
  const duty=async(title:string,start=3)=>(await db.query<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,capacity,points) values($1,$2,'bar',date_trunc('day',now())+make_interval(days=>$3,hours=>12),date_trunc('day',now())+make_interval(days=>$3,hours=>14),'Hal',3,2) returning id",[season,title,start])).rows[0].id;
  const d=await duty('Bar'),other=await duty('Ander',4);
  for(const id of [d,other]) await db.query('insert into enrollments(duty_id,member_id) values($1,$2)',[id,member]);
  const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec('set role '+(id?'authenticated':'anon'));};
  const edit=(id=d,days=3,cap=2)=>db.query("select update_managed_duty($1,'Gewijzigd','Nieuwe hal',date_trunc('day',now())+make_interval(days=>$2,hours=>12),date_trunc('day',now())+make_interval(days=>$2,hours=>15),$3)",[id,days,cap]);
  await as(null);await assert.rejects(edit(),/permission denied/);await as(member);await assert.rejects(edit(),/Geen beheerrechten/);await as(manager);
  await assert.rejects(edit(d,3,0),/plaatsen/);await assert.rejects(edit(d,4),/andere dienst/);await assert.rejects(edit(d,400),/seizoen/);await assert.rejects(edit(d,-1),/toekomstige/);
  await edit();const row=(await db.query<{title:string;points:string;capacity:number}>('select title,points,capacity from duties where id=$1',[d])).rows[0];assert.equal(row.title,'Gewijzigd');assert.equal(row.points,'3.00');assert.equal(row.capacity,2);
  assert.equal((await db.query('select * from notifications where member_id=$1',[member])).rows.length,1);
  assert.equal((await db.query("select * from audit_log where action='update_duty'")).rows.length,1);
  await db.exec('reset role');const referee=await duty('Fluit');await db.query("update duties set kind='referee',points=2.75 where id=$1",[referee]);await as(manager);await edit(referee);assert.equal((await db.query<{points:string}>('select points from duties where id=$1',[referee])).rows[0].points,'2.75');
  await db.exec('reset role');const match=(await db.query<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,'Thuis','Uit',now()+interval '3 days','Hal','') returning id",[season])).rows[0].id;await db.query('update duties set match_id=$1 where id=$2',[match,referee]);await as(manager);await assert.rejects(edit(referee),/Nevobo/);
  await db.exec('reset role');await db.query('update duties set cancelled=true where id=$1',[d]);await as(manager);await assert.rejects(edit(),/komende open/);
 }finally {await db.close();}
});
