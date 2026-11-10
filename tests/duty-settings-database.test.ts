import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('dienstinstellingen en teamreserveringen: rechten, vaste punten, veilige teamwissel en bevoegd fluiten',async()=>{
 const db=new PGlite();
 const manager='10000000-0000-4000-8000-000000000001',captain='10000000-0000-4000-8000-000000000002',referee='10000000-0000-4000-8000-000000000003',outside='10000000-0000-4000-8000-000000000004';
 const season='20000000-0000-4000-8000-000000000001',otherSeason='20000000-0000-4000-8000-000000000002';
 const team='30000000-0000-4000-8000-000000000001',otherTeam='30000000-0000-4000-8000-000000000002',foreignTeam='30000000-0000-4000-8000-000000000003';
 const migration=await readFile(new URL('../supabase/migrations/008_team_duties_and_referee_defaults.sql',import.meta.url),'utf8');
 const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);if(id) await db.exec('set role authenticated');};
 const row=async<T extends Record<string,unknown>>(sql:string,args:unknown[]=[]) => (await db.query<T>(sql,args)).rows[0];
 const assign=(duty:string,target:string|null)=>db.query('select assign_duty_team($1,$2)',[duty,target]);
 const manual=async(title:string,kind='referee',target:string|null=null)=>{
  await db.query("select create_default_duty($1,$2,$3,now()+interval '30 days',now()+interval '30 days 2 hours','Testhal',3,'V4',$4,1)",[season,title,kind,target]);
  return (await row<{id:string}>('select id from duties where title=$1',[title])).id;
 };
 const match=async(home='AVV Keistad HS 4')=>(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,$2,'Andere club',now()+interval '40 days','Testhal','') returning id",[season,home])).id;
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const file of ['001_initial.sql','003_nevobo_matches.sql','005_referee_qualifications.sql','006_competition_referee_rules.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(migration);
  for(const id of [manager,captain,referee,outside]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='manager' where id=$1",[manager]);
  await db.query("update profiles set referee_qualification='V6',referee_level=1");
  await db.query("update profiles set referee_qualification='N1',referee_level=8 where id=$1",[referee]);
  await db.query("insert into seasons(id,name,starts_on,ends_on,default_norm,active) values($1,'Test actief',current_date-30,current_date+365,20,true),($2,'Test ander',current_date-400,current_date-31,20,false)",[season,otherSeason]);
  await db.query("insert into teams(id,season_id,name,age_class,competition_level) values($1,$2,'AVV Keistad HS 4','senior','Eerste klasse'),($3,$2,'AVV Keistad HS 1','senior','Superdivisie'),($4,$5,'Ander seizoen','senior',null)",[team,season,otherTeam,foreignTeam,otherSeason]);
  for(const id of [captain,referee]) await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$2,$3,$4)',[id,season,team,id===captain]);
  await db.query('insert into memberships(member_id,season_id,team_id) values($1,$2,$3)',[outside,season,otherTeam]);
  await as(null);await db.exec('set role anon');
  await assert.rejects(db.query('select referee_points from duty_settings'),/permission denied/);
  await assert.rejects(db.query('select save_duty_settings(3)'),/permission denied/);
  await assert.rejects(db.query('select create_team_match_duty(null,null)'),/permission denied/);
  await as(captain);
  assert.equal((await row<{referee_points:string}>('select referee_points from duty_settings')).referee_points,'2.00');
  await assert.rejects(db.query('select save_duty_settings(3)'),/Geen beheerrechten/);
  await assert.rejects(db.query('update duty_settings set referee_points=3'),/permission denied/);
  await assert.rejects(manual('Geen rechten'),/Geen beheerrechten/);
  await as(manager);
  for(const value of ['0','-1','1001','2.33','NULL',"'NaN'::numeric"]) await assert.rejects(db.query(`select save_duty_settings(${value})`),/Kies|constraint/);
  await db.query('select save_duty_settings(3.25)');
  const oldDuty=await manual('Oude waarde'),bar=await manual('Urenbar','bar',team);
  assert.equal((await row<{points:string}>('select points from duties where id=$1',[oldDuty])).points,'3.25');
  assert.equal((await row<{points:string;assigned_team_id:string}>('select points,assigned_team_id from duties where id=$1',[bar])).points,'2.00');
  await db.query('select save_duty_settings(4)');
  const newDuty=await manual('Nieuwe waarde');
  assert.equal((await row<{points:string}>('select points from duties where id=$1',[newDuty])).points,'4.00');
  assert.equal((await row<{points:string}>('select points from duties where id=$1',[oldDuty])).points,'3.25');
  await assign(oldDuty,team);
  await assert.rejects(assign(oldDuty,foreignTeam),/hetzelfde seizoen/);
  await assert.rejects(assign(oldDuty,'30000000-0000-4000-8000-000000000099'),/hetzelfde seizoen/);
  await as(captain);await assert.rejects(assign(oldDuty,otherTeam),/Geen beheerrechten/);
  await assert.rejects(db.query('select enroll($1,$2)',[oldDuty,captain]),/bevoegdheid|Minimaal V4/);
  await db.query('select enroll($1,$2)',[oldDuty,referee]);
  await as(outside);await assert.rejects(db.query('select enroll($1)',[oldDuty]),/team/);
  await as(manager);await assert.rejects(assign(oldDuty,otherTeam),/deelnemers buiten dit team/);
  assert.equal((await row<{assigned_team_id:string}>('select assigned_team_id from duties where id=$1',[oldDuty])).assigned_team_id,team);
  assert.equal((await row<{n:number}>('select count(*)::int as n from enrollments where duty_id=$1 and not revoked',[oldDuty])).n,1);
  const audits=(await row<{n:number}>("select count(*)::int as n from audit_log where action='assign_duty_team'")).n;
  await assign(oldDuty,team);assert.equal((await row<{n:number}>("select count(*)::int as n from audit_log where action='assign_duty_team'")).n,audits);
  await assign(oldDuty,null);assert.equal((await row<{assigned_team_id:null}>('select assigned_team_id from duties where id=$1',[oldDuty])).assigned_team_id,null);
  // Past, cancelled and match-closed duties cannot be reserved; no data is lost.
  for(const change of ["starts_at=now()-interval '3 hours',ends_at=now()-interval '1 hour'",'cancelled=true','signup_closed=true']) {
   const id=await manual('Gesloten '+change);
   await as(null);await db.exec(`update duties set ${change} where id='${id}'`);await as(manager);
   await assert.rejects(assign(id,team),/openstaande toekomstige/);
  }
  await as(null);const firstMatch=await match(),invalidMatch=await match(),excluded=await match('AVV Keistad HS 1'),unknown=await match('AVV Keistad HS 99');await as(manager);
  // Invalid reservation rolls the entire creation back, including match flags.
  await assert.rejects(db.query('select create_team_match_duty($1,$2)',[invalidMatch,foreignTeam]),/hetzelfde seizoen/);
  assert.equal((await row<{n:number}>('select count(*)::int as n from duties where match_id=$1',[invalidMatch])).n,0);
  const linked=(await row<{id:string}>('select create_team_match_duty($1,$2) as id',[firstMatch,otherTeam])).id;
  const created=await row<{points:string;assigned_team_id:string;required_qualification:string;minutes:number}>('select points,assigned_team_id,required_qualification,extract(epoch from ends_at-starts_at)::int/60 as minutes from duties where id=$1',[linked]);
  assert.deepEqual(created,{points:'4.00',assigned_team_id:otherTeam,required_qualification:'V4',minutes:90});
  await as(outside);await assert.rejects(db.query('select enroll($1)',[linked]),/bevoegdheid|Minimaal V4/,'Providing team does not lower actual match qualification');
  await as(manager);await assert.rejects(db.query('select create_team_match_duty($1,null)',[excluded]),/geen clubscheidsrechter/);
  await assert.rejects(db.query('select create_team_match_duty($1,null)',[unknown]),/Teamniveau ontbreekt/);
  await as(null);const snapshot=(await db.query('select id,points,assigned_team_id,starts_at,ends_at from duties order by id')).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query('select id,points,assigned_team_id,starts_at,ends_at from duties order by id')).rows,snapshot);
  assert.equal((await row<{referee_points:string}>('select referee_points from duty_settings')).referee_points,'4.00');
  assert.ok((await row<{n:number}>("select count(*)::int as n from audit_log where action='save_duty_settings'")).n>=2);
  await as(null);const otherMigration=await readFile(new URL('../supabase/migrations/013_other_duties.sql',import.meta.url),'utf8');await db.exec(otherMigration);await db.exec(otherMigration);
  await as(manager);const custom=await manual('Zelfgekozen overige dienst','other');
  assert.deepEqual(await row('select kind,title,points::text,required_qualification from duties where id=$1',[custom]),{kind:'other',title:'Zelfgekozen overige dienst',points:'2.00',required_qualification:null});
  await as(outside);await assert.rejects(manual('Verboden dienst','other'),/beheerrechten/);
 }finally{await db.close();}
});
