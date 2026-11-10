import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('aanvoerdersteller telt alleen eigen komende teamdiensten met open plekken, ook gedeeltelijk gevuld',async()=>{
 const db=new PGlite(),captain='10000000-0000-4000-8000-000000000001',member='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const file of ['001_initial.sql','003_nevobo_matches.sql','014_captain_team_duty_count.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  for(const id of [captain,member,other]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  const season=(await db.query<{id:string}>("insert into seasons(name,starts_on,ends_on,active,default_norm) values('Actief',current_date-30,current_date+365,true,20) returning id")).rows[0].id;
  const old=(await db.query<{id:string}>("insert into seasons(name,starts_on,ends_on,active,default_norm) values('Ander',current_date-30,current_date+365,false,20) returning id")).rows[0].id;
  const teams=[];for(const name of ['A','B','C']) teams.push((await db.query<{id:string}>("insert into teams(season_id,name,age_class) values($1,$2,'senior') returning id",[season,name])).rows[0].id);
  const oldTeam=(await db.query<{id:string}>("insert into teams(season_id,name,age_class) values($1,'Historisch','senior') returning id",[old])).rows[0].id;
  for(const team of [teams[0]]) await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$2,$3,true)',[captain,season,team]);
  await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$2,$3,true)',[captain,old,oldTeam]);
  await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$2,$3,true)',[other,season,teams[2]]);
  let partial='';for(const kind of ['free','partial','full','revoked','closed','cancelled','past','unassigned','foreign','second','historic']) {
   const s=kind==='historic'?old:season,team=kind==='unassigned'?null:kind==='historic'?oldTeam:kind==='foreign'?teams[2]:kind==='second'?teams[1]:teams[0];
   const duty=(await db.query<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,capacity,points,required_level,assigned_team_id,signup_closed,cancelled) values($1,$2,'bar',now()+$3::interval,now()+$3::interval+interval '1 hour','Hal',$4,1,0,$5,$6,$7) returning id",[s,kind,kind==='past'?'-3 days':'3 days',kind==='partial'?2:1,team,kind==='closed',kind==='cancelled'])).rows[0].id;
   if(['full','partial','revoked'].includes(kind)) await db.query('insert into enrollments(duty_id,member_id,revoked) values($1,$2,$3)',[duty,member,kind==='revoked']);if(kind==='partial') partial=duty;
  }
  const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec('set role '+(id?'authenticated':'anon'));};
  const count=async()=>(await db.query<{n:number}>('select captain_team_duty_count() as n')).rows[0].n;
  await as(null);await assert.rejects(count(),/permission denied/);await as(member);assert.equal(await count(),0);await as(other);assert.equal(await count(),1);await as(captain);assert.equal(await count(),3);
  await db.exec('reset role');await db.query('insert into enrollments(duty_id,member_id) values($1,$2)',[partial,captain]);await as(captain);assert.equal(await count(),2);
 } finally {await db.close();}
});
