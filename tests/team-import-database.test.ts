import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { REFEREE_LEVELS } from '../lib/referee-levels';
import { matchRefereeRequirement } from '../lib/competition-rules';
test('Excel-teams vervangen atomair; automatische wedstrijdregels, rechten en bestaande toewijzingen',async()=>{
 const db=new PGlite();
 const admin='10000000-0000-4000-8000-000000000001',weak='10000000-0000-4000-8000-000000000002',strong='10000000-0000-4000-8000-000000000003',unknown='10000000-0000-4000-8000-000000000004';
 const season='20000000-0000-4000-8000-000000000001',pastSeason='20000000-0000-4000-8000-000000000002';
 const oldTeam='30000000-0000-4000-8000-000000000001',badTeam='30000000-0000-4000-8000-000000000002';
 const migration=await readFile(new URL('../supabase/migrations/006_competition_referee_rules.sql',import.meta.url),'utf8');
 const importSql=await readFile(new URL('../supabase/import_keistad_teams.sql',import.meta.url),'utf8');
 const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id ?? '']);if(id!==null) await db.exec('set role authenticated');};
 const row=async<T extends Record<string,unknown>>(sql:string,args:unknown[]=[]) => (await db.query<T>(sql,args)).rows[0];
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const file of ['001_initial.sql','003_nevobo_matches.sql','005_referee_qualifications.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  for(const id of [admin,weak,strong,unknown]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='manager',referee_qualification='N1',referee_level=8 where id=$1",[admin]);
  await db.query("update profiles set referee_qualification='V6',referee_level=1 where id in ($1,$2)",[weak,unknown]);
  await db.query("update profiles set referee_qualification='R1',referee_level=5 where id=$1",[strong]);
  await db.query("insert into seasons(id,name,starts_on,ends_on,default_norm,active) values($1,'Lokaal testseizoen',current_date-30,current_date+365,20,true),($2,'Vorig testseizoen',current_date-400,current_date-31,20,false)",[season,pastSeason]);
  await db.query("insert into teams(id,season_id,name,age_class) values($1,$2,'Heren 1','senior'),($3,$2,'Onbekend testteam','senior')",[oldTeam,season,badTeam]);
  await db.query("insert into teams(season_id,name,age_class) values($1,'Historisch testteam','senior')",[pastSeason]);
  for(const id of [weak,strong]) await db.query('insert into memberships(member_id,season_id,team_id,captain,norm_override) values($1,$2,$3,true,13.5)',[id,season,oldTeam]);
  await db.query('insert into memberships(member_id,season_id,team_id) values($1,$2,$3)',[unknown,season,badTeam]);
  const futureMatch=(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,'AVV Keistad HS 1','Andere club HS 1',now()+interval '10 days','Testhal','') returning id",[season])).id;
  const excludedDuty=(await row<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,points,capacity,required_level,required_qualification,match_id,assigned_team_id) values($1,'Bestaande testfluitdienst','referee',now()+interval '10 days',now()+interval '10 days 2 hours','Testhal',2,2,1,'V6',$2,$3) returning id",[season,futureMatch,oldTeam])).id;
  const pastDuty=(await row<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,points,capacity,required_level,required_qualification) values($1,'Afgelopen testdienst','referee',now()-interval '10 days',now()-interval '9 days','Testhal',2,1,1,'V6') returning id",[season])).id;
  for(const id of [weak,strong]) await db.query('insert into enrollments(duty_id,member_id) values($1,$2)',[excludedDuty,id]);
  await db.query('insert into enrollments(duty_id,member_id) values($1,$2)',[pastDuty,weak]);
  await db.exec(migration);await db.exec(await readFile(new URL('../supabase/migrations/010_division_referee_levels.sql',import.meta.url),'utf8'));
  for(const level of ['Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie','Promotieklasse']) {
   const required=(await row<{code:string}>("select team_referee_requirement('senior',$1) as code",[level])).code;
   assert.equal(required,level==='Derde divisie'?'R1':level==='Promotieklasse'?'R2':'N2');
   for(const code of REFEREE_LEVELS) assert.equal((await row<{allowed:boolean}>('select referee_qualification_rank($1)>=referee_qualification_rank($2) as allowed',[code,required])).allowed,REFEREE_LEVELS.indexOf(code)>=REFEREE_LEVELS.indexOf(required as typeof code));
  }
  // An unrecognized referenced team must stop the whole destructive import.
  await assert.rejects(db.exec(importSql),/Onbekend testteam/);await db.exec('rollback');
  assert.equal((await row<{n:number}>('select count(*)::int as n from teams where season_id=$1',[season])).n,2);
  assert.equal((await row<{n:number}>('select count(*)::int as n from audit_log where action=\'replace_teams_from_excel\'')).n,0);
  await db.query("update teams set name='HS 7' where id=$1",[badTeam]);
  await db.exec(importSql);
  assert.equal((await row<{n:number}>('select count(*)::int as n from teams where season_id=$1',[season])).n,57);
  assert.equal((await row<{n:number}>('select count(*)::int as n from teams where id in ($1,$2)',[oldTeam,badTeam])).n,0);
  assert.equal((await row<{n:number}>('select count(*)::int as n from teams where season_id=$1',[pastSeason])).n,1);
  const hs1=(await row<{id:string}>("select id from teams where season_id=$1 and name='AVV Keistad HS 1'",[season])).id;
  const membership=await row<{team_id:string;captain:boolean;norm_override:string}>('select team_id,captain,norm_override from memberships where member_id=$1',[weak]);
  assert.deepEqual(membership,{team_id:hs1,captain:true,norm_override:'13.50'});
  assert.equal((await row<{assigned_team_id:string}>('select assigned_team_id from duties where id=$1',[excludedDuty])).assigned_team_id,hs1);
  assert.equal((await row<{n:number}>('select count(*)::int as n from enrollments where duty_id=$1 and member_id=$2 and revoked',[excludedDuty,weak])).n,1);
  assert.equal((await row<{n:number}>('select count(*)::int as n from enrollments where duty_id=$1 and member_id=$2 and not revoked',[excludedDuty,strong])).n,0);
  assert.equal((await row<{n:number}>('select count(*)::int as n from enrollments where duty_id=$1 and not revoked',[pastDuty])).n,1);
  assert.equal((await row<{points:string}>('select points from duties where id=$1',[pastDuty])).points,'2.00');
  assert.equal((await row<{n:number}>("select count(*)::int as n from notifications where member_id=$1 and title='Clubfluitdienst vervallen'",[weak])).n,1);
  assert.equal((await row<{n:number}>("select count(*)::int as n from audit_log where action='club_referee_not_needed'")).n,2);
  assert.equal((await row<{cancelled:boolean}>('select cancelled from duties where id=$1',[excludedDuty])).cancelled,true);
  assert.equal((await row<{club_referee:boolean}>('select club_referee from matches where id=$1',[futureMatch])).club_referee,false);
  const imported=(await db.query<{name:string;competition_level:string|null;age_class:string}>('select name,competition_level,age_class from teams where season_id=$1 order by name',[season])).rows;
  const csv=(await readFile(new URL('../supabase/data/keistad-teams.csv',import.meta.url),'utf8')).trim().split(/\r?\n/).slice(1).map(line=>{const [name,level,age_class]=line.split(',');return {name,competition_level:level||null,age_class};}).sort((a,b)=>a.name<b.name?-1:1);
  assert.deepEqual(imported,csv,'All 57 names and levels exactly match the supplied worksheet, including blank levels');
  const distribution=(await db.query<{code:string;n:number}>('select team_referee_requirement(age_class,competition_level) as code,count(*)::int as n from teams where season_id=$1 group by 1 order by 1',[season])).rows;
  assert.deepEqual(distribution,[{code:'N2',n:4},{code:'R2',n:2},{code:'V4',n:11},{code:'V6',n:40}]);
  // Every imported team must derive the same rule in UI and database, also away.
  let day=20;
  for(const t of imported) {
   const id=(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,'Andere club',$2,now()+make_interval(days=>$3),'Testhal','') returning id",[season,t.name,day++])).id;
   const required=(await row<{code:string}>('select match_referee_requirement($1) as code',[id])).code;
   assert.equal(required,matchRefereeRequirement({home_team:'Andere club',away_team:t.name},imported));
  }
  await as(weak);
  await assert.rejects(db.query("select update_team_competition($1,'Derde klasse')",[hs1]),/Geen beheerrechten/);
  await assert.rejects(db.query("update teams set competition_level='Derde klasse' where id=$1",[hs1]),/permission denied/);
  await assert.rejects(db.query('select refresh_match_referee_requirements($1)',[season]),/permission denied/);
  await assert.rejects(db.query('select create_automatic_match_duty($1,2,90)',[futureMatch]),/Geen beheerrechten/);
  await as(null);await db.exec('set role anon');await assert.rejects(db.query('select create_automatic_match_duty($1,2,90)',[futureMatch]),/permission denied/);await as(null);
  // SQL, not submitted form data, determines all 16 club-duty rank comparisons.
  let testDay=100;
  for(const [teamName,required,rank] of [['AVV Keistad HS 4','V4',1],['AVV Keistad HS 7','V6',0]] as const) {
   await as(null);
   const match=(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,$2,'Andere club',now()+make_interval(days=>$3),'Testhal','') returning id",[season,teamName,testDay++])).id;
   await as(admin);
   const duty=(await row<{id:string}>("select create_qualified_match_duty($1,2,90,'V6') as id",[match])).id; // Legacy downgrade attempt.
   assert.equal((await row<{code:string}>('select required_qualification as code from duties where id=$1',[duty])).code,required);
   await assert.rejects(db.query("select set_duty_qualification($1,'V6')",[duty]),/automatisch/);
   for(let index=0;index<8;index++) {
    await as(null);await db.query('update profiles set referee_qualification=$1,referee_level=$2 where id=$3',[REFEREE_LEVELS[index],index+1,weak]);await as(weak);
    if(index<rank) await assert.rejects(db.query('select enroll($1)',[duty]),/bevoegdheid/);
    else {await db.query('select enroll($1)',[duty]);const e=(await row<{id:string}>('select id from enrollments where duty_id=$1 and member_id=$2 and not revoked',[duty,weak])).id;await db.query("select change_enrollment($1,'withdraw')",[e]);}
   }
  }
  // Promotion class and divisions do not have a club duty, regardless of diploma.
  for(const name of ['AVV Keistad HS 1','AVV Keistad HS 2','AVV Keistad HS 3','AVV Keistad DS 1','AVV Keistad DS 2','AVV Keistad DS 3']) {
   await as(null);
   const match=(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,$2,'Andere club',now()+interval '140 days','Testhal','') returning id",[season,name])).id;
   assert.equal((await row<{needed:boolean}>('select match_needs_club_referee($1) as needed',[match])).needed,false);
   assert.equal((await row<{club_referee:boolean}>('select club_referee from matches where id=$1',[match])).club_referee,false);
   await as(admin);
   await assert.rejects(db.query('select create_automatic_match_duty($1,2,90)',[match]),/geen clubscheidsrechter/);
   await assert.rejects(db.query('select create_match_referee_duty($1,2,90,8)',[match]),/geen clubscheidsrechter/);
   await assert.rejects(db.query("select create_qualified_match_duty($1,2,90,'N1')",[match]),/geen clubscheidsrechter/);
  }
  // Missing/unrecognized team never falls back to V6, even using legacy RPCs.
  await as(null);const unrecognized=(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,'AVV Keistad HS 99','Andere club',now()+interval '150 days','Testhal','') returning id",[season])).id;
  await as(admin);await assert.rejects(db.query('select create_automatic_match_duty($1,2,90)',[unrecognized]),/Teamniveau ontbreekt/);
  const blocked=(await row<{id:string}>('select create_match_referee_duty($1,2,90,0) as id',[unrecognized])).id;
  await as(weak);await assert.rejects(db.query('select enroll($1)',[blocked]),/nog niet ingesteld/);
  // Create a genuine club duty for takeover and captain-assignment checks.
  await as(null);
  const clubMatch=(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,'AVV Keistad HS 4','Andere club',now()+interval '155 days','Testhal','') returning id",[season])).id;
  await as(admin);const futureDuty=(await row<{id:string}>('select create_automatic_match_duty($1,2,90) as id',[clubMatch])).id;
  await as(null);await db.query('update duties set assigned_team_id=$1 where id=$2',[hs1,futureDuty]);
  await as(strong);await db.query('select enroll($1)',[futureDuty]);
  // A takeover must not revoke the old enrollment if the new referee is too low.
  await as(null);await db.query("update profiles set referee_qualification='V6',referee_level=1 where id=$1",[weak]);
  const owner=(await row<{id:string}>('select id from enrollments where duty_id=$1 and member_id=$2 and not revoked',[futureDuty,strong])).id;
  await as(strong);await db.query("select change_enrollment($1,'offer')",[owner]);
  await as(weak);await assert.rejects(db.query('select enroll($1,null,$2)',[futureDuty,owner]),/bevoegdheid/);
  await as(admin);await assert.rejects(db.query('select enroll($1,$2)',[futureDuty,weak]),/bevoegdheid/);
  await as(strong);await assert.rejects(db.query('select enroll($1,$2)',[futureDuty,weak]),/bevoegdheid/,'An authorized captain must also respect the target referee qualification');
  await as(null);await db.query('update profiles set referee_level=10 where id=$1',[weak]);
  await as(weak);await assert.rejects(db.query('select enroll($1,null,$2)',[futureDuty,owner]),/Minimaal V4 vereist/,'A high legacy number must not bypass the explicit code');
  await as(unknown);await assert.rejects(db.query('select enroll($1,$2)',[futureDuty,weak]),/niet toewijzen/);
  await as(null);assert.equal((await row<{revoked:boolean}>('select revoked from enrollments where id=$1',[owner])).revoked,false);
  // An explicit profile downgrade also reopens future games and notifies once.
  await db.query("update profiles set referee_qualification='V6',referee_level=1 where id=$1",[strong]);
  assert.equal((await row<{revoked:boolean}>('select revoked from enrollments where id=$1',[owner])).revoked,true);
  // Moving a club team up to promotion class cancels its existing future duties.
  const hs7=(await row<{id:string}>("select id from teams where season_id=$1 and name='AVV Keistad HS 7'",[season])).id;
  const lowMatch=(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,'AVV Keistad HS 7','Andere club',now()+interval '160 days','Testhal','') returning id",[season])).id;
  await as(admin);const lowDuty=(await row<{id:string}>('select create_automatic_match_duty($1,2,90) as id',[lowMatch])).id;
  await as(weak);await db.query('select enroll($1)',[lowDuty]);
  await as(admin);await db.query("select update_team_competition($1,'Promotieklasse')",[hs7]);
  assert.equal((await row<{code:string}>('select required_qualification as code from duties where id=$1',[lowDuty])).code,'R2');
  assert.equal((await row<{cancelled:boolean}>('select cancelled from duties where id=$1',[lowDuty])).cancelled,true);
  await as(null);assert.equal((await row<{n:number}>('select count(*)::int as n from enrollments where duty_id=$1 and not revoked',[lowDuty])).n,0);
  await db.query("update matches set home_team='AVV Keistad HS 1' where id=$1",[lowMatch]);
  assert.equal((await row<{code:string}>('select required_qualification as code from duties where id=$1',[lowDuty])).code,'N2');
  // Reapplying schema/import leaves one exact catalogue, members and past points.
  await db.exec(migration);await db.exec(await readFile(new URL('../supabase/migrations/010_division_referee_levels.sql',import.meta.url),'utf8'));await db.exec(importSql);
  assert.equal((await row<{n:number}>('select count(*)::int as n from teams where season_id=$1',[season])).n,57);
  assert.equal((await row<{n:number}>('select count(*)::int as n from memberships where season_id=$1',[season])).n,3);
  assert.equal((await row<{n:number}>('select count(*)::int as n from enrollments where duty_id=$1 and not revoked',[pastDuty])).n,1);
 } finally {await db.close();}
});
