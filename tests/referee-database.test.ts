import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { REFEREE_LEVELS } from '../lib/referee-levels';
test('scheidsrechtersniveaus: rechten, hiërarchie, legacybehoud, inschrijven, overname en correctie',async()=>{
 const db=new PGlite(),admin='10000000-0000-4000-8000-000000000001',member='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',season='20000000-0000-4000-8000-000000000001',team='30000000-0000-4000-8000-000000000001';
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
  for(const id of [admin,member,other]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='manager',referee_level=10 where id=$1",[admin]);
  await db.query("insert into seasons(id,name,starts_on,ends_on,default_norm,active) values($1,'Testseizoen',current_date-30,current_date+365,20,true)",[season]);
  await db.query("insert into teams(id,season_id,name,age_class) values($1,$2,'Testteam','senior')",[team,season]);
  for(const id of [member,other]) await db.query('insert into memberships(member_id,season_id,team_id) values($1,$2,$3)',[id,season,team]);
  const legacy=(await db.query<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,points,capacity,required_level) values($1,'Bestaande fluitdienst','referee',now()+interval '10 days',now()+interval '10 days 2 hours','Testhal',2,1,0) returning id",[season])).rows[0].id;
  await db.query('insert into enrollments(duty_id,member_id) values($1,$2)',[legacy,member]);
  await db.exec(await readFile(new URL('../supabase/migrations/003_nevobo_matches.sql',import.meta.url),'utf8'));
  const migration=await readFile(new URL('../supabase/migrations/005_referee_qualifications.sql',import.meta.url),'utf8');await db.exec(migration);
  const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id ?? '']);await db.exec('set role '+(id?'authenticated':'anon'));};
  const setMember=async(id:string,code:string|null)=>db.query('select update_member_qualification($1,$2,$3,false,null,$4)',[id,season,team,code]);
  const active=(await db.query('select id,duty_id,member_id,revoked from enrollments')).rows;
  assert.equal((await db.query<{n:number}>('select referee_level as n from profiles where id=$1',[admin])).rows[0].n,10);
  assert.equal((await db.query<{code:string|null}>('select referee_qualification as code from profiles where id=$1',[admin])).rows[0].code,null);
  await as(null);await assert.rejects(setMember(member,'N1'),/permission denied/);
  await as(member);await assert.rejects(setMember(member,'N1'),/Geen beheerrechten/);
  await assert.rejects(db.query("update profiles set referee_qualification='N1' where id=$1",[member]),/permission denied/);
  const oldEnrollment=(await db.query<{id:string}>('select id from enrollments where duty_id=$1',[legacy])).rows[0].id;
  await db.query("select change_enrollment($1,'offer')",[oldEnrollment]); // Responsibility remains manageable before confirmation.
  await as(other);await assert.rejects(db.query('select enroll($1,null,$2)',[legacy,oldEnrollment]),/moet het vereiste/);
  await as(admin);await db.query("select set_duty_qualification($1,'V6')",[legacy]);
  await assert.rejects(setMember(other,'invalid'),/geldig scheidsrechtersniveau/);
  await setMember(other,'N1');await as(other);await db.query('select enroll($1,null,$2)',[legacy,oldEnrollment]);
  await as(admin);const enrollment=(await db.query<{id:string}>('select id from enrollments where duty_id=$1 and not revoked',[legacy])).rows[0].id;
  await db.query("select change_enrollment($1,'revoke','Ziek gemeld')",[enrollment]);
  // Each required level uses a separate day; all 64 qualification comparisons
  // pass through the actual SQL enrollment function and its transaction guard.
  const duties:string[]=[];
  for(let i=0;i<8;i++) {
   await db.query("select create_qualified_duty($1,$2,'referee',now()+make_interval(days=>$3),now()+make_interval(days=>$3)+interval '2 hours','Testhal',2,2,$4,null,1)",[season,'Niveau '+i,i+20,REFEREE_LEVELS[i]]);
   duties.push((await db.query<{id:string}>('select id from duties where title=$1',['Niveau '+i])).rows[0].id);
  }
  for(let required=0;required<8;required++) for(let level=0;level<8;level++) {
   await as(admin);await setMember(member,REFEREE_LEVELS[level]);await as(member);
   if(level<required) await assert.rejects(db.query('select enroll($1)',[duties[required]]),/bevoegdheid/);
   else {await db.query('select enroll($1)',[duties[required]]);const e=(await db.query<{id:string}>('select id from enrollments where duty_id=$1 and not revoked',[duties[required]])).rows[0].id;await db.query("select change_enrollment($1,'withdraw')",[e]);}
  }
  // A high legacy number cannot bypass the explicit code or unset state.
  await as(admin);await setMember(member,'V6');await db.query('select update_member($1,$2,$3,false,null,10)',[member,season,team]);
  await as(member);await assert.rejects(db.query('select enroll($1)',[duties[7]]),/bevoegdheid/);
  await as(admin);await setMember(member,null);await as(member);await assert.rejects(db.query('select enroll($1)',[duties[0]]),/nog niet ingesteld/);
  await as(admin);await setMember(member,'V6');
  await assert.rejects(db.query('select enroll($1,$2)',[duties[7],member]),/bevoegdheid/,'Assigning someone else uses their qualification');
  await db.query("select create_qualified_duty($1,'Testbar','bar',now()+interval '50 days',now()+interval '50 days 2 hours','Testhal',2,999,null,null,1)",[season]);
  const bar=(await db.query<{id:string;points:string;required_qualification:string|null}>("select id,points,required_qualification from duties where title='Testbar'")).rows[0];assert.equal(bar.points,'2.00');assert.equal(bar.required_qualification,null);
  await setMember(member,null);await as(member);await db.query('select enroll($1)',[bar.id]);
  await db.exec('reset role');const match=(await db.query<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,'Test thuis','Test uit',now()+interval '60 days','Testhal','') returning id",[season])).rows[0].id;
  await as(admin);const linked=(await db.query<{id:string}>("select create_qualified_match_duty($1,2,90,'R2.2') as id",[match])).rows[0].id;
  assert.equal((await db.query<{code:string}>('select required_qualification as code from duties where id=$1',[linked])).rows[0].code,'R2.2');
  await db.exec('reset role');const before=(await db.query('select id,required_qualification,required_level from duties order by id')).rows;
  await db.exec(migration);assert.deepEqual((await db.query('select id,required_qualification,required_level from duties order by id')).rows,before);
  assert.ok(active.length);assert.ok((await db.query('select id from enrollments where id=$1',[oldEnrollment])).rows.length,'Old enrollments are retained');
 } finally {await db.close();}
});
