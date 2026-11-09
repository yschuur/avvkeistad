import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const logo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=';
for(const legacy of [false,true]) test(`clubidentiteit: ${legacy?'bestaande kleuren behouden':'direct na 001'}, rechten, validatie, herhalen en onafhankelijke kleuren`,async()=>{
 const db=new PGlite(),admin='10000000-0000-4000-8000-000000000001',manager='10000000-0000-4000-8000-000000000002',member='10000000-0000-4000-8000-000000000003';
 const migration=(name:string)=>readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);
  await db.exec(await migration('001_initial'));
  for(const id of [admin,manager,member]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.test']);
  await db.query("update profiles set role='admin' where id=$1",[admin]);await db.query("update profiles set role='manager' where id=$1",[manager]);
  const before=(await db.query('select id,email,role from profiles order by id')).rows;
  if(legacy) {await db.exec(await migration('002_club_branding'));await db.exec("update club_branding set primary_color='#123456',secondary_color='#654321'");}
  const sql=await migration('007_club_identity');await db.exec(sql);
  const active=async()=> (await db.query<{club_name:string;logo_data:string|null;primary_color:string;secondary_color:string;accent_color:string}>('select club_name,logo_data,primary_color,secondary_color,accent_color from club_branding where id')).rows[0];
  assert.equal((await active()).primary_color,legacy?'#123456':'#087D56');assert.equal((await active()).accent_color,legacy?'#123456':'#087D56');
  await db.exec("insert into club_branding(id,club_name) values(false,'Andere testvereniging')");
  const as=async(id:string|null)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec('set role '+(id?'authenticated':'anon'));};
  await as(null);assert.equal((await db.query('select club_name,logo_data from club_branding')).rows.length,1);
  await assert.rejects(db.query('select updated_by from club_branding'),/permission denied/);
  await assert.rejects(db.query("select save_club_identity('Testclub',null,'#112233','#445566','#778899')"),/permission denied/);
  await as(member);await assert.rejects(db.query("select save_club_identity('Testclub',null,'#112233','#445566','#778899')"),/Geen beheerrechten/);
  await assert.rejects(db.query("update club_branding set club_name='Testclub'"),/permission denied/);
  await as(manager);await db.query('select save_club_identity($1,$2,$3,$4,$5)',[' Testclub ',logo,'#112233','#445566','#aabbcc']);
  assert.deepEqual(await active(),{club_name:'Testclub',logo_data:logo,primary_color:'#112233',secondary_color:'#445566',accent_color:'#AABBCC'});
  for(const [name,image,accent] of [['X',null,'#123456'],['Test\nclub',null,'#123456'],['Testclub','data:image/svg+xml;base64,PHN2Zz4=','#123456'],['Testclub','data:image/png;base64,'+Buffer.from('Not an image at all').toString('base64'),'#123456'],['Testclub',logo,'red']]) {
   await assert.rejects(db.query('select save_club_identity($1,$2,$3,$4,$5)',[name,image,'#112233','#445566',accent]));
  }
  await as(admin);await db.query("select save_club_branding('#abcdef','#ffffff')");
  assert.deepEqual(await active(),{club_name:'Testclub',logo_data:logo,primary_color:'#ABCDEF',secondary_color:'#FFFFFF',accent_color:'#AABBCC'});
  await db.exec('reset role');await db.exec(sql);
  assert.equal((await active()).logo_data,logo);assert.equal((await active()).accent_color,'#AABBCC');
  assert.deepEqual((await db.query('select id,email,role from profiles order by id')).rows,before);
  const audit=(await db.query<{details:Record<string,unknown>}>("select details from audit_log where action='save_club_identity'")).rows;
  assert.equal(audit.length,1);assert.equal(audit[0].details.has_logo,true);assert.ok(!JSON.stringify(audit).includes('base64'));
  assert.equal((await db.query<{n:number}>('select count(*)::int as n from club_branding')).rows[0].n,2);
  await as(admin);await db.query("select save_club_identity('Testclub',null,'#112233','#445566','#000000')");assert.equal((await active()).logo_data,null);
 } finally {await db.close();}
});
