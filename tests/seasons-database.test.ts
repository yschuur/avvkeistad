import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('seizoenen: aanmaken, op ID bewerken, veilig activeren, autorisatie en behoud van historie',async()=>{
 const db=new PGlite();
 const admin='10000000-0000-4000-8000-000000000001',manager='10000000-0000-4000-8000-000000000002',member='10000000-0000-4000-8000-000000000003';
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
  for(const id of [admin,manager,member]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='admin' where id=$1",[admin]);await db.query("update profiles set role='manager' where id=$1",[manager]);
  const profiles=(await db.query('select * from profiles order by id')).rows;
  const migration=await readFile(new URL('../supabase/migrations/004_season_management.sql',import.meta.url),'utf8');await db.exec(migration);
  const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id ?? '']);await db.exec('set role '+(id?'authenticated':'anon'));};
  const get=async(id:string)=>(await db.query<{id:string;name:string;active:boolean;updated_at:string;default_norm:string;youth_norm:string|null;senior_norm:string|null;starts_on:string;ends_on:string}>('select id,name,active,updated_at::text,default_norm,youth_norm,senior_norm,starts_on::text,ends_on::text from seasons where id=$1',[id])).rows[0];
  const save=async(id:string|null,name='2026/2027',start='2026-08-01',end='2027-07-31',norm:unknown=20,youth:unknown=null,senior:unknown=0,stamp:string|null=null)=>
   (await db.query<{id:string}>('select save_season($1,$2,$3,$4,$5,$6,$7,$8) as id',[id,name,start,end,norm,youth,senior,stamp])).rows[0].id;
  await as(null);await assert.rejects(save(null),/permission denied/);
  await as(member);await assert.rejects(save(null),/Geen beheerrechten/);await assert.rejects(db.query("update seasons set active=false"),/permission denied/);
  await as(manager);const first=await save(null);let original=await get(first);assert.equal(original.active,true);assert.equal(original.youth_norm,null);assert.equal(original.senior_norm,'0.00');
  const next=await save(null,'2027/2028','2027-08-01','2028-07-31',22,12,null);assert.equal((await get(next)).active,false);assert.equal((await get(first)).active,true);
  await assert.rejects(save(null,' 2027/2028 '),/bestaat al/);
  await assert.rejects(save(null,'Fout','2027-08-01','2027-07-31'),/begin- en einddatum/);
  for(const invalid of [-1,1000000,'NaN','Infinity',1.234]) await assert.rejects(save(null,'Fout','2026-08-01','2027-07-31',invalid),/puntennormen/);
  await assert.rejects(save(null,'Fout','2026-08-01','2027-07-31',20,-1),/puntennormen/);
  await assert.rejects(save(null,'Fout','2026-08-01','2027-07-31',20,null,'NaN'),/puntennormen/);
  // Real linked rows must keep IDs, credited amounts and season ownership.
  await db.exec('reset role');
  const team=(await db.query<{id:string}>("insert into teams(season_id,name,age_class) values($1,'Testteam','senior') returning id",[first])).rows[0].id;
  await db.query('insert into memberships(member_id,season_id,team_id,norm_override) values($1,$2,$3,17)',[member,first,team]);
  const duty=(await db.query<{id:string}>("insert into duties(season_id,title,kind,starts_at,ends_at,location,points,capacity) values($1,'Testdienst','bar','2026-11-09T18:00:00+01:00','2026-11-09T20:00:00+01:00','Testhal',2,2) returning id",[first])).rows[0].id;
  await db.query('insert into enrollments(duty_id,member_id) values($1,$2)',[duty,member]);
  await db.query("insert into matches(season_id,external_id,home_team,away_team,starts_at,location,level) values($1,'test-match','Test thuis','Test uit','2026-11-10T20:00:00+01:00','Testhal','')",[first]);
  await db.query("insert into function_assignments(season_id,member_id,title,points,starts_on,ends_on) values($1,$2,'Testfunctie',8,'2026-09-01','2027-06-30')",[first,member]);
  const snapshots=async()=>{const result:Record<string,unknown>={};for(const table of ['teams','memberships','duties','enrollments','matches','function_assignments']) result[table]=(await db.query('select * from '+table)).rows;return result;};
  const before=await snapshots();await as(manager);
  assert.equal(await save(first,'Hernoemd seizoen','2026-07-01','2027-08-01',25,10,null,original.updated_at),first);
  const edited=await get(first);assert.equal(edited.name,'Hernoemd seizoen');assert.equal(edited.starts_on,'2026-07-01');assert.equal(edited.ends_on,'2027-08-01');assert.equal(edited.active,true);assert.equal(edited.default_norm,'25.00');
  await assert.rejects(save(first,'Oude invoer','2026-08-01','2027-07-31',20,null,0,original.updated_at),/intussen gewijzigd/);
  await assert.rejects(save(first,'Zonder versie'),/intussen gewijzigd/);
  await assert.rejects(save(first,'Hernoemd seizoen','2026-11-10','2027-07-31',20,null,0,edited.updated_at),/sluit bestaande/);
  assert.equal((await get(first)).starts_on,'2026-07-01');
  await as(member);await assert.rejects(db.query('select activate_season($1,$2)',[next,(await get(next)).updated_at]),/Geen beheerrechten/);
  await as(admin);const nextBefore=await get(next);
  await assert.rejects(db.query('select activate_season($1,null)',[next]),/intussen gewijzigd/);
  await assert.rejects(db.query('select activate_season($1,$2)',['90000000-0000-4000-8000-000000000099',nextBefore.updated_at]),/bestaat niet/);
  await db.query('select activate_season($1,$2)',[next,nextBefore.updated_at]);assert.equal((await get(first)).active,false);assert.equal((await get(next)).active,true);
  assert.equal((await db.query('select * from seasons where active')).rows.length,1);
  // Editing an inactive season must never activate it or change the current one.
  const inactive=await get(first);await save(first,'Historisch seizoen','2026-07-01','2027-08-01',26,null,0,inactive.updated_at);
  assert.equal((await get(first)).active,false);assert.equal((await get(next)).default_norm,'22.00');
  await assert.rejects(db.query("select setup_season('Oude browser','2027-07-01','2028-08-01',24,null,0)"),/seizoensbeheer is vernieuwd/);
  assert.equal((await get(next)).name,'2027/2028');assert.equal((await get(next)).starts_on,'2027-08-01');
  await db.exec('reset role');assert.deepEqual(await snapshots(),before);assert.deepEqual((await db.query('select * from profiles order by id')).rows,profiles);
  const saved=(await db.query('select * from seasons order by id')).rows;await db.exec(migration);assert.deepEqual((await db.query('select * from seasons order by id')).rows,saved);
  assert.ok((await db.query<{n:number}>("select count(*)::int as n from audit_log where action in ('create_season','update_season','activate_season')")).rows[0].n>=5);
 } finally {await db.close();}
});
