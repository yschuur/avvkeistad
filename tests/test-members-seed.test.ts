import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { z } from 'zod';
const seed=readFile(new URL('../scripts/seed-test-members.sql',import.meta.url),'utf8');
const season='20000000-0000-4000-8000-000000000001';
const source='keistad-test-members-v1';
async function setup() {
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key default gen_random_uuid(),instance_id uuid,aud text,role text,email text unique,
 encrypted_password text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',created_at timestamptz,updated_at timestamptz,
 confirmation_token text,email_change text,email_change_token_new text,recovery_token text,email_change_token_current text,reauthentication_token text,phone_change text,phone_change_token text);
 create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,provider_id text not null,identity_data jsonb not null,provider text not null,created_at timestamptz,updated_at timestamptz,unique(provider_id,provider));
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const migration of ['001_initial.sql','003_nevobo_matches.sql','005_referee_qualifications.sql','006_competition_referee_rules.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
 return db;
}
async function run(db:PGlite) {try{return await db.exec(await seed);}catch(error){await db.exec('rollback');throw error;}}
async function activeSeason(db:PGlite) {await db.query("insert into seasons(id,name,starts_on,ends_on,default_norm,active) values($1,'Testseizoen',current_date-30,current_date+365,20,true)",[season]);}
test('testleden: alle 57 teams gevuld, bevestigde accounts/identities, unieke codes, geldige UUIDs, één aanvoerder en veilig herhalen',async()=>{
 const db=await setup();
 try {
  await activeSeason(db);
  const teams=(await readFile(new URL('../supabase/data/keistad-teams.csv',import.meta.url),'utf8')).trim().split(/\r?\n/).slice(1).map(line=>line.split(','));
  for(const [name,level,age] of teams) await db.query('insert into teams(season_id,name,competition_level,age_class) values($1,$2,$3,$4)',[season,name,level||null,age]);
  const team=(await db.query<{id:string}>("select id from teams where name='AVV Keistad HS 1'")).rows[0].id;
  const existing='10000000-0000-4000-8000-000000000001';
  await db.query("insert into auth.users(id,email,encrypted_password,raw_user_meta_data) values($1,'existing@example.test','existing-password-hash','{\"first_name\":\"Bestaand\",\"last_name\":\"Lid\"}')",[existing]);
  await db.query("update profiles set role='admin',nevobo_code='EIGEN',referee_qualification='R1',referee_level=5 where id=$1",[existing]);
  await db.query('insert into memberships(member_id,season_id,team_id,captain,norm_override) values($1,$2,$3,true,7)',[existing,season,team]);
  const beforeExisting=(await db.query('select p.*,m.captain,m.norm_override,u.encrypted_password from profiles p join memberships m on m.member_id=p.id join auth.users u on u.id=p.id where p.id=$1',[existing])).rows;
  const results=await run(db),report=results.at(-1)!.rows as {team:string;leden:number;aanvoerders:number}[];
  assert.equal(report.length,57);
  for(const row of report) {assert.ok(Number(row.leden)>=8&&Number(row.leden)<=12,row.team);assert.equal(Number(row.aanvoerders),1,row.team);}
  const users=(await db.query<{id:string;email:string;email_confirmed_at:Date;encrypted_password:string;raw_user_meta_data:Record<string,unknown>}>('select * from auth.users where raw_user_meta_data->>\'seed_source\'=$1',[source])).rows;
  assert.ok(users.length>=455&&users.length<=683);
  for(const user of users) {z.uuid().parse(user.id);assert.match(user.email,/^testlid-[a-f0-9]{32}-[0-9]+@example\.test$/);assert.ok(user.email_confirmed_at);assert.equal(user.encrypted_password,'');assert.equal(user.raw_user_meta_data.test_member,true);}
  const missing=(await db.query<{n:number}>(`select count(*)::int as n from auth.users u left join auth.identities i on i.user_id=u.id
   where u.raw_user_meta_data->>'seed_source'=$1 and (i.user_id is null or i.provider<>'email' or i.provider_id<>u.id::text or i.identity_data->>'email'<>u.email or i.identity_data->>'email_verified'<>'true')`,[source])).rows[0].n;
  assert.equal(missing,0);
  const profiles=(await db.query<{role:string;nevobo_code:string;referee_qualification:string;referee_level:number}>('select p.* from profiles p join auth.users u on u.id=p.id where u.raw_user_meta_data->>\'seed_source\'=$1',[source])).rows;
  const levels=['V6','V4','R2.2','R2','R1','N3','N2','N1'];
  assert.equal(new Set(profiles.map(p=>p.nevobo_code)).size,profiles.length);
  assert.deepEqual([...new Set(profiles.map(p=>p.referee_qualification))].sort(),levels.toSorted());
  for(const p of profiles) {assert.equal(p.role,'member');assert.match(p.nevobo_code,/^TEST[0-9]{6}$/);assert.equal(p.referee_level,levels.indexOf(p.referee_qualification)+1);}
  assert.equal((await db.query<{n:number}>('select count(distinct(first_name,last_name))::int as n from profiles p join auth.users u on u.id=p.id where u.raw_user_meta_data->>\'seed_source\'=$1',[source])).rows[0].n,users.length);
  assert.deepEqual((await db.query('select p.*,m.captain,m.norm_override,u.encrypted_password from profiles p join memberships m on m.member_id=p.id join auth.users u on u.id=p.id where p.id=$1',[existing])).rows,beforeExisting);
  const snapshot=(await db.query('select u.id,u.email,u.encrypted_password,u.email_confirmed_at,p.referee_qualification,m.* from auth.users u join profiles p on p.id=u.id join memberships m on m.member_id=u.id order by u.id')).rows;
  await run(db);
  assert.deepEqual((await db.query('select u.id,u.email,u.encrypted_password,u.email_confirmed_at,p.referee_qualification,m.* from auth.users u join profiles p on p.id=u.id join memberships m on m.member_id=u.id order by u.id')).rows,snapshot);
  assert.equal((await db.query<{details:{added:number}}>("select details from audit_log where action='seed_test_members' order by created_at desc limit 1")).rows[0].details.added,0);
  // A shared password is opt-in and only affects newly created test users.
  await db.exec('create extension pgcrypto');
  const password='local-only-test-password';
  await db.query("select set_config('avv.test_member_password',$1,false)",[password]);
  const extra=(await db.query<{id:string}>("insert into teams(season_id,name,age_class) values($1,'Extra testteam','senior') returning id",[season])).rows[0].id;
  await run(db);
  const hashes=(await db.query<{valid:boolean}>('select u.encrypted_password=crypt($1,u.encrypted_password) as valid from auth.users u join memberships m on m.member_id=u.id where m.team_id=$2',[password,extra])).rows;
  assert.ok(hashes.length>=8);assert.ok(hashes.every(row=>row.valid));
  assert.equal((await db.query<{value:string}>("select current_setting('avv.test_member_password') as value")).rows[0].value,'');
  assert.equal((await db.query<{encrypted_password:string}>('select encrypted_password from auth.users where id=$1',[users[0].id])).rows[0].encrypted_password,'');
 }finally{await db.close();}
});
test('testleden: ontbrekend seizoen/team, te grote roosters en dubbele aanvoerders veranderen niets',async()=>{
 const db=await setup();
 try {
  await assert.rejects(run(db),/actief seizoen/);await activeSeason(db);await assert.rejects(run(db),/geen teams/);
  const team=(await db.query<{id:string}>("insert into teams(season_id,name,age_class) values($1,'Testteam','senior') returning id",[season])).rows[0].id;
  for(let i=0;i<13;i++) {const user=(await db.query<{id:string}>('insert into auth.users(email) values($1) returning id',['existing'+i+'@example.test'])).rows[0].id;await db.query('insert into memberships(member_id,season_id,team_id,captain) values($1,$2,$3,$4)',[user,season,team,i<2]);}
  const before=(await db.query('select * from memberships order by member_id')).rows;
  await assert.rejects(run(db),/meer dan 12/);assert.deepEqual((await db.query('select * from memberships order by member_id')).rows,before);
  await db.exec('delete from memberships where member_id=(select member_id from memberships where not captain limit 1)');
  await assert.rejects(run(db),/meerdere aanvoerders/);
  assert.equal((await db.query<{n:number}>("select count(*)::int as n from auth.users where raw_user_meta_data->>'seed_source'=$1",[source])).rows[0].n,0);
 }finally{await db.close();}
});
test('testleden: gewone accounts kunnen niet seeden en een e-mailconflict draait de volledige import terug',async()=>{
 const db=await setup();
 try {
  await db.exec('set role authenticated');await assert.rejects(run(db),/permission denied/);await db.exec('reset role');
  await activeSeason(db);
  await db.query("insert into teams(season_id,name,age_class) values($1,'A testteam','senior')",[season]);
  const last=(await db.query<{id:string}>("insert into teams(season_id,name,age_class) values($1,'Z testteam','senior') returning id",[season])).rows[0].id;
  const email='testlid-'+last.replaceAll('-','')+'-1@example.test';
  await db.query("insert into auth.users(email,raw_user_meta_data) values($1,'{\"first_name\":\"Bestaand\",\"last_name\":\"Account\"}')",[email]);
  const before=(await db.query('select * from profiles')).rows;
  await assert.rejects(run(db),/Test-e-mailadres bestaat al/);
  assert.deepEqual((await db.query('select * from profiles')).rows,before);
  assert.equal((await db.query<{n:number}>('select count(*)::int as n from auth.users')).rows[0].n,1);
  assert.equal((await db.query<{n:number}>('select count(*)::int as n from memberships')).rows[0].n,0);
  assert.equal((await db.query<{n:number}>("select count(*)::int as n from audit_log where action='seed_test_members'")).rows[0].n,0);
 }finally{await db.close();}
});
