import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('teams per plek: migratiebehoud, quota, aanvoerdersrechten, bezetting en veilige wijzigingen',async()=>{
 const db=new PGlite();
 const ids=Array.from({length:7},(_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`),[manager,ca,a1,a2,cb,b1,b2]=ids;
 const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec('set role '+(id?'authenticated':'anon'));};
 const row=async<T>(sql:string,args:unknown[]=[]) => (await db.query<T>(sql,args)).rows[0];
 const migration=await readFile(new URL('../supabase/migrations/017_duty_team_slots.sql',import.meta.url),'utf8');
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const f of ['001_initial.sql','003_nevobo_matches.sql','005_referee_qualifications.sql','006_competition_referee_rules.sql','008_team_duties_and_referee_defaults.sql','010_division_referee_levels.sql','013_other_duties.sql','014_captain_team_duty_count.sql','015_duty_management.sql','016_match_availability.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  for(const id of ids)await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='manager' where id=$1",[manager]);
  const season=(await row<{id:string}>("insert into seasons(name,starts_on,ends_on,default_norm,active) values('Test',current_date-30,current_date+365,20,true) returning id")).id;
  const teams=[];for(const name of ['HS 1','DS 2'])teams.push((await row<{id:string}>("insert into teams(season_id,name,age_class) values($1,$2,'senior') returning id",[season,name])).id);
  const [ta,tb]=teams;
  for(const [id,t]of [[ca,ta],[a1,ta],[a2,ta],[cb,tb],[b1,tb],[b2,tb]])await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$2,$3,$4)',[id,season,t,id===ca||id===cb]);
  const duty=async(title:string,capacity=3,target:string|null=null)=>(await row<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,capacity,location,points,assigned_team_id) values($1,$2,'bar',now()+interval '30 days',now()+interval '30 days 2 hours',$3,'Hal',2,$4) returning id",[season,title,capacity,target])).id;
  const legacy=await duty('Bestaand',3,ta);await db.query('insert into enrollments(duty_id,member_id) values($1,$2)',[legacy,a1]);
  await db.exec(migration);
  assert.equal((await row<{slot_number:number}>('select slot_number from enrollments where duty_id=$1',[legacy])).slot_number,1);
  assert.deepEqual((await row<{teams:string[]}>('select duty_slot_teams(d) as teams from duties d where id=$1',[legacy])).teams,[ta,ta,ta]);
  await db.query('update enrollments set revoked=true where duty_id=$1',[legacy]);
  const mixed=await duty('Gemengd'),assign=(teams:(string|null)[])=>db.query('select assign_duty_slots($1,$2::uuid[])',[mixed,teams]);
  await as(null);await assert.rejects(assign([ta,ta,tb]),/permission denied/);
  await as(a1);await assert.rejects(assign([ta,ta,tb]),/Geen beheerrechten/);
  await as(manager);await assert.rejects(assign([ta,tb]),/iedere plek/);
  await assign([ta,ta,tb]);
  assert.equal((await row<{assigned_team_id:null}>('select assigned_team_id from duties where id=$1',[mixed])).assigned_team_id,null);
  const count=async()=>(await row<{n:number}>('select captain_team_duty_count() as n')).n;
  await as(ca);assert.equal(await count(),2); // legacy also has open A places
  await assert.rejects(db.query('select enroll_duty_slot($1,3,$2)',[mixed,a1]),/jouw team/);
  await assert.rejects(db.query('select enroll_duty_slot($1,3,$2)',[mixed,b1]),/niet toewijzen/);
  await db.query('select enroll_duty_slot($1,1,$2)',[mixed,a1]);
  await as(a2);await assert.rejects(db.query('select enroll_duty_slot($1,2,$2)',[mixed,ca]),/niet toewijzen/);
  await as(ca);await assert.rejects(db.query('select enroll_duty_slot($1,1,$2)',[mixed,a2]),/al ingevuld/);
  await db.query('select enroll_duty_slot($1,2,$2)',[mixed,a2]);assert.equal(await count(),1);
  await assert.rejects(db.query('select enroll($1)',[mixed]),/vrije plek/);
  const eid=(await row<{id:string}>('select id from enrollments where duty_id=$1 and member_id=$2 and not revoked',[mixed,a1])).id;
  await as(a1);await db.query("select change_enrollment($1,'offer')",[eid]);
  await as(b1);await assert.rejects(db.query('select enroll($1,null,$2)',[mixed,eid]),/ander team/);
  await as(manager);assert.equal((await row<{revoked:boolean}>('select revoked from enrollments where id=$1',[eid])).revoked,false);
  await assert.rejects(assign([tb,ta,tb]),/al ingevuld/);
  await as(cb);assert.equal(await count(),1);await db.query('select enroll_duty_slot($1,3,$2)',[mixed,b1]);assert.equal(await count(),0);
  const availability=await row<{occupied:number;slots:{slot:number;team_id:string;occupied:boolean}[]}>('select occupied::int,slots from duty_availability() where duty_id=$1',[mixed]);
  assert.equal(availability.occupied,3);assert.deepEqual(availability.slots.map(s=>[s.slot,s.team_id,s.occupied]),[[1,ta,true],[2,ta,true],[3,tb,true]]);
  await as(a1);await db.query("select change_enrollment($1,'withdraw')",[eid]);
  await as(ca);assert.equal(await count(),2);await db.query('select enroll_duty_slot($1,1,$2)',[mixed,ca]);
  await as(manager);await assert.rejects(db.query("select update_managed_duty($1,'Minder','Hal',now()+interval '30 days',now()+interval '30 days 2 hours',2)",[mixed]),/aantal plaatsen/);
  await db.query("select update_managed_duty($1,'Meer','Hal',now()+interval '30 days',now()+interval '30 days 2 hours',4)",[mixed]);
  assert.deepEqual((await row<{slot_team_ids:(string|null)[]}>('select slot_team_ids from duties where id=$1',[mixed])).slot_team_ids,[ta,ta,tb,null]);
  assert.equal((await row<{assigned_team_id:null}>('select assigned_team_id from duties where id=$1',[mixed])).assigned_team_id,null);
  // Ordinary members can fill an explicitly open place, not another team's reserved place.
  await as(b2);await db.query('select enroll($1)',[mixed]);
  await as(manager);await assert.rejects(assign([ta,ta,tb,ta]),/al ingevuld/);
  // Captains cannot use another member to consume an unreserved place.
  await db.exec('reset role');const openDuty=await duty('Eigen en open',2);
  await db.query("update duties set starts_at=now()+interval '60 days',ends_at=now()+interval '60 days 2 hours' where id=$1",[openDuty]);
  await as(manager);await db.query('select assign_duty_slots($1,$2::uuid[])',[openDuty,[ta,null]]);
  await as(ca);await assert.rejects(db.query('select enroll_duty_slot($1,2,$2)',[openDuty,a1]),/jouw team/);
  await db.query('select enroll_duty_slot($1,1,$2)',[openDuty,a1]);
  const offered=(await row<{id:string}>('select id from enrollments where duty_id=$1 and not revoked',[openDuty])).id;
  await as(a1);await db.query("select change_enrollment($1,'offer')",[offered]);
  await as(ca);await db.query('select enroll($1,$2,$3)',[openDuty,a2,offered]);
  assert.equal((await row<{slot_number:number}>('select slot_number from enrollments where duty_id=$1 and not revoked',[openDuty])).slot_number,1);
  // Every reserved team is checked for match and travel conflicts, also on time edits.
  await db.exec('reset role');const conflict=await duty('Wedstrijdcontrole');
  await db.query("insert into matches(season_id,home_team,away_team,starts_at,location,level) select season_id,'AVV Keistad DS 2','Andere club',starts_at,'Hal','' from duties where id=$1",[conflict]);
  await as(manager);await assert.rejects(db.query('select assign_duty_slots($1,$2::uuid[])',[conflict,[ta,tb,null]]),/Team niet beschikbaar/);
  await db.exec('reset role');await db.query('delete from matches');
  await as(manager);await db.query('select assign_duty_slots($1,$2::uuid[])',[conflict,[ta,tb,null]]);
  await db.exec('reset role');await db.query("insert into matches(season_id,home_team,away_team,starts_at,location,level) select season_id,'AVV Keistad DS 2','Andere club',starts_at+interval '1 day','Hal','' from duties where id=$1",[conflict]);
  await as(manager);await assert.rejects(db.query("select update_managed_duty($1,'Verschoven','Hal',now()+interval '31 days',now()+interval '31 days 2 hours',3)",[conflict]),/Team niet beschikbaar/);
  await db.exec('reset role');await db.query("update duties set starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day' where id=$1",[conflict]);
  assert.deepEqual((await row<{slot_team_ids:(string|null)[]}>('select slot_team_ids from duties where id=$1',[conflict])).slot_team_ids,[ta,tb,null]);
  await db.query('delete from matches');
  const foreignSeason=(await row<{id:string}>("insert into seasons(name,starts_on,ends_on,default_norm) values('Ander',current_date-1,current_date+365,20) returning id")).id;
  const foreign=(await row<{id:string}>("insert into teams(season_id,name,age_class) values($1,'Ander team','senior') returning id",[foreignSeason])).id;
  await as(manager);await assert.rejects(db.query('select assign_duty_slots($1,$2::uuid[])',[conflict,[ta,foreign,null]]),/hetzelfde seizoen/);
  // Retrying the migration keeps every active assignment in its original slot.
  await db.exec('reset role');const before=(await db.query('select id,slot_number from enrollments where not revoked order by id')).rows;
  await db.exec(migration);assert.deepEqual((await db.query('select id,slot_number from enrollments where not revoked order by id')).rows,before);
  await as(null);await assert.rejects(db.query('select duty_availability()'),/permission denied/);
 }finally{await db.close();}
});
