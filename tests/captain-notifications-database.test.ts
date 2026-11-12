import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('aanvoerdersmeldingen: nieuwe plekken, inplanning, afmelden, overname, eigen ontvangers en geen reminders/mail',async()=>{
 const db=new PGlite(),ids=Array.from({length:6},(_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`),[manager,ca,ca2,ma,cb,mb]=ids;
 const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);if(id)await db.exec('set role authenticated');};
 const row=async<T>(sql:string,args:unknown[]=[]) => (await db.query<T>(sql,args)).rows[0];
 const migration=await readFile(new URL('../supabase/migrations/018_captain_notifications.sql',import.meta.url),'utf8');
 let day=30;
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const f of ['001_initial.sql','003_nevobo_matches.sql','005_referee_qualifications.sql','006_competition_referee_rules.sql','008_team_duties_and_referee_defaults.sql','010_division_referee_levels.sql','013_other_duties.sql','014_captain_team_duty_count.sql','015_duty_management.sql','016_match_availability.sql','017_duty_team_slots.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  for(const id of ids)await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='manager' where id=$1",[manager]);await db.query("update profiles set first_name='Anna',last_name='Lid' where id=$1",[ma]);await db.query("update profiles set first_name='Bram',last_name='Lid' where id=$1",[mb]);
  const season=(await row<{id:string}>("insert into seasons(name,starts_on,ends_on,default_norm,active) values('Actief',current_date-30,current_date+365,20,true) returning id")).id;
  const teams=[];for(const name of ['Heren 1','Dames 2'])teams.push((await row<{id:string}>("insert into teams(season_id,name,age_class) values($1,$2,'senior') returning id",[season,name])).id);
  const [ta,tb]=teams;
  for(const [id,t]of [[ca,ta],[ca2,ta],[ma,ta],[cb,tb],[mb,tb]])await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$2,$3,$4)',[id,season,t,id!==ma&&id!==mb]);
  const duty=async(title:string,target:string|null=null,capacity=3)=>{await as(null);return(await row<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,capacity,location,points,assigned_team_id) values($1,$2,'bar',now()+$3::interval,now()+$3::interval+interval '2 hours',$4,'Testhal',2,$5) returning id",[season,title,`${day++} days`,capacity,target])).id;};
  const existing=await duty('Bestaand',ta);await db.exec(migration);
  const count=async()=>{await as(null);return(await row<{n:number}>('select count(*)::int n from notifications')).n;};
  assert.equal(await count(),0,'Installing does not notify about historical assignments');
  const assigned=await duty('Nieuwe teamdienst',ta,2);assert.equal(await count(),2,'One message for each of A’s two captains, not one per place');
  const body=(await row<{body:string}>('select body from notifications where member_id=$1',[ca])).body;assert.match(body,/2 plekken nieuw toegewezen/);assert.match(body,/Heren 1/);assert.match(body,/Testhal/);
  await as(ca);assert.equal((await row<{n:number}>('select count(*)::int n from notifications')).n,1);await as(ca2);assert.equal((await row<{n:number}>('select count(*)::int n from notifications')).n,1);await as(cb);assert.equal((await row<{n:number}>('select count(*)::int n from notifications')).n,0);await as(ma);assert.equal((await row<{n:number}>('select count(*)::int n from notifications')).n,0);
  await assert.rejects(db.query("select notify_team_captains($1,$2,'Fake','Fake')",[ta,assigned]),/permission denied/);await assert.rejects(db.query("insert into notifications(member_id,title,body) values($1,'Fake','Fake')",[ca]),/permission denied/);
  await as(manager);await db.query('select enroll_duty_slot($1,1,$2)',[assigned,ma]);assert.equal(await count(),4);
  const eid=(await row<{id:string}>('select id from enrollments where duty_id=$1 and not revoked',[assigned])).id;
  assert.equal((await row<{n:number}>("select count(*)::int n from notifications where title='Teamlid ingepland' and body like '%Anna Lid%'")).n,2);
  let before=await count();await as(ma);await db.query("select change_enrollment($1,'offer')",[eid]);await db.query("select change_enrollment($1,'unoffer')",[eid]);assert.equal(await count(),before,'Offering a takeover does not end responsibility');
  await as(null);await db.query('update enrollments set revoked=false where id=$1',[eid]);assert.equal(await count(),before,'No duplicate for an unchanged enrollment');
  await as(ma);await db.query("select change_enrollment($1,'withdraw')",[eid]);assert.equal(await count(),before+2);assert.equal((await row<{n:number}>("select count(*)::int n from notifications where title='Teamlid afgemeld'")).n,2);
  const mixed=await duty('Gemengde teamdienst');before=await count();await as(manager);await db.query('select assign_duty_slots($1,$2::uuid[])',[mixed,[ta,ta,tb]]);assert.equal(await count(),before+3);
  before=await count();await as(manager);await db.query('select assign_duty_slots($1,$2::uuid[])',[mixed,[ta,ta,tb]]);assert.equal(await count(),before);
  await as(manager);await db.query('select assign_duty_slots($1,$2::uuid[])',[mixed,[ta,null,tb]]);assert.equal(await count(),before,'Removing a reservation is not a new assignment');
  await as(manager);await db.query('select assign_duty_slots($1,$2::uuid[])',[mixed,[ta,ta,tb]]);assert.equal(await count(),before+2);
  // Captains and members use the same event path, including self-signup on open services.
  const open=await duty('Open teamlid-dienst');before=await count();await as(ma);await db.query('select enroll($1)',[open]);assert.equal(await count(),before+2);
  const offered=(await row<{id:string}>('select id from enrollments where duty_id=$1 and not revoked',[open])).id;
  await as(ma);await db.query("select change_enrollment($1,'offer')",[offered]);before=await count();await as(mb);await db.query('select enroll($1,null,$2)',[open,offered]);assert.equal(await count(),before+3,'A’s captains see the withdrawal, B’s captain sees the replacement');
  assert.equal((await row<{n:number}>("select count(*)::int n from notifications where member_id=$1 and title='Teamlid ingepland' and body like '%Bram Lid%'",[cb])).n,1);
  const replacement=(await row<{id:string}>('select id from enrollments where duty_id=$1 and not revoked',[open])).id;
  before=await count();await as(manager);await db.query("select change_enrollment($1,'revoke','Beheercorrectie')",[replacement]);assert.equal(await count(),before+1);assert.equal((await row<{n:number}>("select count(*)::int n from notifications where member_id=$1 and body like '%Beheercorrectie%'",[cb])).n,1);
  await as(null);before=await count();await db.query('update enrollments set revoked=false where id=$1',[replacement]);assert.equal(await count(),before+1,'Restored active assignments notify once');
  before=await count();await as(cb);await assert.rejects(db.query('select assign_duty_slots($1,$2::uuid[])',[mixed,[tb,tb,tb]]),/Geen beheerrechten/);assert.equal(await count(),before);
  const notification=(await row<{id:string}>('select id from notifications where member_id=$1 limit 1',[ca])).id;await as(cb);await assert.rejects(db.query('select mark_notification_read($1)',[notification]),/Niet gevonden|niet gevonden/);
  await as(ca);await db.query('select mark_notification_read($1)',[notification]);assert.ok((await row<{read_at:string}>('select read_at from notifications where id=$1',[notification])).read_at);
  // No future-time scheduler or email enqueue is involved.
  await as(null);assert.equal((await row<{n:number}>('select count(*)::int n from notification_email_outbox')).n,0);
  await as(null);before=await count();await db.query('update duties set starts_at=starts_at+interval \'1 minute\',ends_at=ends_at+interval \'1 minute\' where id=$1',[existing]);assert.equal(await count(),before);
  for(const state of ['past','cancelled','closed'])await db.query("insert into duties(season_id,title,kind,starts_at,ends_at,capacity,location,points,assigned_team_id,cancelled,signup_closed) values($1,$2,'bar',now()+$3::interval,now()+$3::interval+interval '2 hours',1,'Hal',2,$4,$5,$6)",[season,state,state==='past'?'-5 days':'80 days',ta,state==='cancelled',state==='closed']);
  assert.equal(await count(),before);
  const snapshot=(await db.query('select id,read_at from notifications order by id')).rows;await db.exec(migration);assert.deepEqual((await db.query('select id,read_at from notifications order by id')).rows,snapshot);
  await db.exec('set role anon');await assert.rejects(db.query('select * from notifications'),/permission denied/);
 }finally{await db.close();}
});
