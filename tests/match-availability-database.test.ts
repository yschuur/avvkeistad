import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('wedstrijdconflicten: team- en lidtoewijzing, aanmaak, wijzigingen en bestaande inschrijvingen beschermd',async()=>{
 const db=new PGlite(),manager='10000000-0000-4000-8000-000000000001',home='10000000-0000-4000-8000-000000000002',away='10000000-0000-4000-8000-000000000003';
 const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec('set role '+(id?'authenticated':'anon'));};
 const row=async<T extends Record<string,unknown>>(sql:string,args:unknown[]=[]) => (await db.query<T>(sql,args)).rows[0];
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const file of ['001_initial.sql','003_nevobo_matches.sql','005_referee_qualifications.sql','006_competition_referee_rules.sql','008_team_duties_and_referee_defaults.sql','010_division_referee_levels.sql','013_other_duties.sql','015_duty_management.sql','016_match_availability.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/016_match_availability.sql',import.meta.url),'utf8'));
  for(const id of [manager,home,away])await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='manager' where id=$1",[manager]);
  const season=(await row<{id:string}>("insert into seasons(name,starts_on,ends_on,active,default_norm) values('Test',current_date-30,current_date+365,true,20) returning id")).id;
  const team=async(name:string)=>(await row<{id:string}>("insert into teams(season_id,name,age_class) values($1,$2,'senior') returning id",[season,name])).id;
  const ht=await team('HS 4'),at=await team('AVV Keistad DS 3');
  for(const [id,t]of[[home,ht],[away,at]])await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$2,$3,true)',[id,season,t]);
  const start=(await row<{ts:string}>("select (date_trunc('day',now())+interval '10 days 12 hours')::text as ts")).ts,when=(hours:number)=>new Date(new Date(start).getTime()+hours*3600000).toISOString();
  const match=async(h:string,a:string)=>(await row<{id:string}>("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,$2,$3,$4,'Hal','') returning id",[season,h,a,start])).id;
  const hm=await match('AVV Keistad HS 4','Andere club HS 1'),am=await match('Andere club DS 1','Sponsor/AVV Keistad DS 3');
  const duty=async(title:string,from:number,to:number)=>{await as(null);await db.exec('reset role');return(await row<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,capacity,points) values($1,$2,'bar',$3,$4,'Hal',5,1) returning id",[season,title,when(from),when(to)])).id;};
  let n=0;
  for(const [member,t,from,to,blocked]of[[home,ht,-2,0,false],[home,ht,2,3,false],[home,ht,-1,0.01,true],[home,ht,1.99,3,true],[away,at,-5,-3,false],[away,at,5,7,false],[away,at,-4,-2.99,true],[away,at,4.99,6,true],[away,at,-5,1,true]] as const){
   const d=await duty('Dienst '+(++n),from,to);await as(manager);
   if(blocked){await assert.rejects(db.query('select assign_duty_team($1,$2)',[d,t]),/Team niet beschikbaar/);await assert.rejects(db.query('select enroll($1,$2)',[d,member]),/Lid niet beschikbaar/);}
   else {await db.query('select assign_duty_team($1,$2)',[d,t]);await db.query('select enroll($1,$2)',[d,member]);const e=await row<{id:string}>('select id from enrollments where duty_id=$1 and not revoked',[d]);await db.query("select change_enrollment($1,'revoke','Testcorrectie')",[e.id]);}
  }
  await db.exec('reset role');await db.query("update matches set status='played' where id=$1",[am]);const travel=await duty('Terugreis',3,4);await as(manager);await assert.rejects(db.query('select enroll($1,$2)',[travel,away]),/Lid niet beschikbaar/);
  const clash=await duty('Zelf proberen',0,1);await as(home);await assert.rejects(db.query('select enroll($1,null)',[clash]),/Lid niet beschikbaar/);await assert.rejects(db.query('select assign_duty_team($1,$2)',[clash,ht]),/Geen beheerrechten/);
  await assert.rejects(db.query('select team_match_conflict($1,$2,$3,$4)',[season,ht,when(0),when(1)]),/permission denied/);
  await as(manager);await assert.rejects(db.query("select create_default_duty($1,'Reeks','bar',$2,$3,'Hal',2,null,$4,1)",[season,when(0),when(1),ht]),/Team niet beschikbaar/);
  await db.exec('reset role');await db.query("insert into matches(season_id,home_team,away_team,starts_at,location,level) values($1,'AVV Keistad HS 4','Andere club HS 1',$2,'Hal','')",[season,when(7*24-2)]);await as(manager);await assert.rejects(db.query("select create_default_duty($1,'Hele reeks','bar',$2,$3,'Hal',2,null,$4,2)",[season,when(-2),when(0),ht]),/Team niet beschikbaar/);assert.equal((await db.query("select id from duties where title='Hele reeks'")).rows.length,0);
  const changed=await duty('Bestaande dienst',-2,0);await as(manager);await db.query('select enroll($1,$2)',[changed,home]);
  await assert.rejects(db.query("select update_managed_duty($1,'Nieuw','Hal',$2,$3,5)",[changed,when(0),when(1)]),/ingepland lid is niet beschikbaar/);
  await db.query('select assign_duty_team($1,$2)',[changed,ht]);await assert.rejects(db.query("select update_managed_duty($1,'Nieuw','Hal',$2,$3,5)",[changed,when(0),when(1)]),/Team niet beschikbaar/);
  // Cancellation releases the conflict; importing a changed match does not erase an existing assignment.
  await db.exec('reset role');await db.query("update matches set cancelled=true,status='cancelled' where id in ($1,$2)",[hm,am]);await as(manager);await db.query('select assign_duty_team($1,$2)',[clash,ht]);await db.query('select enroll($1,$2)',[clash,home]);
  await db.exec('reset role');await db.query("update matches set cancelled=false,status='scheduled' where id=$1",[hm]);await as(manager);await assert.rejects(db.query('select assign_duty_team($1,$2)',[clash,ht]),/Team niet beschikbaar/);
  const existing=await row<{id:string}>('select id from enrollments where duty_id=$1 and not revoked',[clash]);await db.query("select change_enrollment($1,'revoke','Ziek gemeld')",[existing.id]);
  await as(null);await assert.rejects(db.query('select assign_duty_team($1,$2)',[clash,ht]),/permission denied/);
 } finally {await db.close();}
});
