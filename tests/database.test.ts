import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const ids={admin:'10000000-0000-4000-8000-000000000001',a:'10000000-0000-4000-8000-000000000002',b:'10000000-0000-4000-8000-000000000003',c:'10000000-0000-4000-8000-000000000004',s:'20000000-0000-4000-8000-000000000001',t:'30000000-0000-4000-8000-000000000001'};
test('database: echte migratie, RLS, inschrijven, 24 uur, overname en correctie', async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
 for(const member of [ids.admin,ids.a,ids.b,ids.c]) await db.query("insert into auth.users(id,email) values($1,$2)",[member,member+'@example.com']);
 await db.query("update public.profiles set role='admin' where id=$1",[ids.admin]);
 await db.query("insert into seasons(id,name,starts_on,ends_on,default_norm,active) values($1,'Test',current_date-30,current_date+365,20,true)",[ids.s]);
 await db.query("insert into teams(id,season_id,name,age_class) values($1,$2,'Heren 1','senior')",[ids.t,ids.s]);
 for(const member of [ids.a,ids.b,ids.c]) await db.query('insert into memberships(member_id,season_id,team_id) values($1,$2,$3)',[member,ids.s,ids.t]);
 const duty=async(offset=5,level=0)=>{
  const r=await db.query<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,points,capacity,required_level) values($1,'Test','bar',now()+make_interval(days=>$2),now()+make_interval(days=>$2)+interval '2 hours','Hal',2,1,$3) returning id",[ids.s,offset,level]);return r.rows[0].id;
 };
 const d=await duty(); const d2=await duty();const strict=await duty(8,3);
 const as=async(member:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[member]);await db.exec('set role authenticated');};
 await as(ids.a);
 await db.query('select enroll($1)',[d]);
 await assert.rejects(db.query('select enroll($1)',[d]),/overlapt/);
 await assert.rejects(db.query('select enroll($1)',[d2]),/overlapt/);
 await assert.rejects(db.query('select enroll($1)',[strict]),/bevoegdheid/);
 await assert.rejects(db.query("update profiles set role='admin' where id=$1",[ids.a]),/permission denied/);
 let own=await db.query<{id:string}>('select id from enrollments where duty_id=$1',[d]);const e=own.rows[0].id;
 await db.exec('reset role');await db.query("update enrollments set created_at=now()-interval '24 hours' where id=$1",[e]);await as(ids.a);
 await assert.rejects(db.query("select change_enrollment($1,'withdraw')",[e]),/afmeldtermijn/);
 await db.query("select change_enrollment($1,'offer')",[e]);
 assert.equal((await db.query<{offered:boolean}>('select offered from enrollments where id=$1',[e])).rows[0].offered,true);
 await as(ids.b);
 assert.equal((await db.query('select * from enrollments')).rows.length,0,'ander lid kan de oorspronkelijke inschrijving niet lezen');
 const available=await db.query<{offered_ids:string[]}>('select offered_ids from duty_availability() where duty_id=$1',[d]);assert.deepEqual(available.rows[0].offered_ids,[e]);
 await assert.rejects(db.query('select enroll($1)',[d]),/vol/);
 await db.query('select enroll($1,null,$2)',[d,e]);
 await as(ids.c);await assert.rejects(db.query('select enroll($1,null,$2)',[d,e]),/niet meer worden overgenomen/);
 await as(ids.admin);
 const active=await db.query<{id:string;member_id:string}>('select * from enrollments where duty_id=$1 and not revoked',[d]);assert.equal(active.rows.length,1);assert.equal(active.rows[0].member_id,ids.b);
 await db.exec('reset role');await db.query("update duties set starts_at=now()-interval '3 hours',ends_at=now()-interval '1 hour' where id=$1",[d]);await as(ids.admin);
 await db.query("select change_enrollment($1,'revoke','Ziek gemeld')",[active.rows[0].id]);
 assert.equal((await db.query('select * from enrollments where duty_id=$1 and not revoked',[d])).rows.length,0);
 await as(ids.c); await db.query('select enroll($1)',[d2]);
 const ce=await db.query<{id:string}>('select id from enrollments where duty_id=$1',[d2]);await db.query("select change_enrollment($1,'withdraw')",[ce.rows[0].id]);
 assert.equal((await db.query('select * from enrollments where not revoked')).rows.length,0);
 await as(ids.admin);
 await db.query("select create_duty($1,'Winterreeks','bar',date_trunc('day',now())+interval '20 days 18 hours',date_trunc('day',now())+interval '20 days 20 hours','Clubhuis',2,99,0,null,2)",[ids.s]);
 assert.equal((await db.query<{points:string}>("select points from duties where title='Winterreeks'")).rows[0].points,'2.00');
 } finally {await db.close();}
});

test('aanvoerder leest alleen het eigen team en wijst uitsluitend eigen teamdiensten aan eigen leden toe',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
  for(const id of [ids.a,ids.b,ids.c]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("insert into seasons(id,name,starts_on,ends_on,default_norm,active) values($1,'Testseizoen',current_date,current_date+365,20,true)",[ids.s]);
  const other='30000000-0000-4000-8000-000000000002';
  await db.query("insert into teams(id,season_id,name,age_class) values($1,$3,'Eigen testteam','senior'),($2,$3,'Ander testteam','senior')",[ids.t,other,ids.s]);
  await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$4,$5,true),($2,$4,$5,false),($3,$4,$6,false)',[ids.a,ids.b,ids.c,ids.s,ids.t,other]);
  const ownDuty=(await db.query<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,points,capacity,assigned_team_id) values($1,'Teamdienst','bar',now()+interval '10 days',now()+interval '10 days 2 hours','Testhal',2,3,$2) returning id",[ids.s,ids.t])).rows[0].id;
  const foreignDuty=(await db.query<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,points,capacity,assigned_team_id) values($1,'Andere teamdienst','bar',now()+interval '20 days',now()+interval '20 days 2 hours','Testhal',2,3,$2) returning id",[ids.s,other])).rows[0].id;
  const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  await as(ids.a);
  assert.deepEqual((await db.query<{id:string}>('select id from profiles order by id')).rows.map(p=>p.id),[ids.a,ids.b]);
  assert.equal((await db.query('select * from memberships where team_id=$1',[other])).rows.length,0);
  await db.query('select enroll($1,$2)',[ownDuty,ids.b]);
  assert.equal((await db.query('select * from enrollments where member_id=$1 and not revoked',[ids.b])).rows.length,1);
  await assert.rejects(db.query('select enroll($1,$2)',[ownDuty,ids.c]),/niet toewijzen/);
  await assert.rejects(db.query('select enroll($1,$2)',[foreignDuty,ids.b]),/niet toewijzen/);
  await as(ids.b);await assert.rejects(db.query('select enroll($1,$2)',[ownDuty,ids.a]),/niet toewijzen/);
 } finally {await db.close();}
});
