// Local integration test: real Next server + signed test sessions + delayed mock
// Supabase HTTP API. No real credentials or member data are used.
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright-core';
import { mkdir,readFile } from 'node:fs/promises';
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwk={...publicKey.export({format:'jwk'}),kid:'local-performance-test',alg:'ES256',use:'sig'};
const memberA='10000000-0000-4000-8000-000000000001', memberB='10000000-0000-4000-8000-000000000002', admin='10000000-0000-4000-8000-000000000003';
const season='20000000-0000-4000-8000-000000000001';
// All records below are isolated test fixtures. They are never imported by the app.
const teamId='30000000-0000-4000-8000-000000000001';
const testDuty={id:'50000000-0000-4000-8000-000000000001',season_id:season,title:'Testdienst',kind:'bar',starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+93600000).toISOString(),points:2,capacity:2,location:'Testlocatie',required_level:0,assigned_team_id:null,cancelled:false};
let brand={primary_color:'#087D56',secondary_color:'#6483B8'};
const testMatch={id:'70000000-0000-4000-8000-000000000001',home_team:'Test thuis',away_team:'Test uit',starts_at:testDuty.starts_at,location:'Testlocatie',level:'',club_referee:false,status:'scheduled',cancelled:false,source_description:'Uitsluitend lokale testgegevens.',referee_duties:[]};
const testNotification={id:'80000000-0000-4000-8000-000000000001',member_id:memberA,match_id:testMatch.id,title:'Testwedstrijd gewijzigd',body:'Nieuwe planning in de lokale testomgeving.',created_at:new Date().toISOString(),read_at:null};
const actualProgram=await readFile(new URL('../tests/fixtures/nevobo-program.rss',import.meta.url),'utf8');
let programXml=actualProgram,programSignature=null,activeSync=false,refAssigned=false;
const emailJobs=[],sentEmails=[],additionalNotifications=[];
const cronToken='local-test-cron-token-not-a-real-secret-12345';
let syncState={last_started_at:null,last_success_at:null,last_error_code:null,feed_published_at:null,imported_count:0,updated_count:0};
const records=[];
const authWrites=[];
const passwords=new Map([['anna@example.test','local-test-password'],['bram@example.test','local-test-password'],['admin@example.test','local-test-password']]);
let mockUrl;
const profile=id=>({id,first_name:id===admin?'Alex':id===memberA?'Anna':'Bram',last_name:'Test',email:id===admin?'admin@example.test':id===memberA?'anna@example.test':'bram@example.test',role:id===admin?'admin':'member',referee_level:0,nevobo_code:null});
const token=id=>{
 const header=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid:jwk.kid})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({sub:id,role:'authenticated',iss:mockUrl+'/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),session_id:'40000000-0000-4000-8000-000000000001'})).toString('base64url');
 const input=header+'.'+payload;
 return input+'.'+sign('sha256',Buffer.from(input),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
};
const mock=createServer(async(req,res)=>{
 const url=new URL(req.url,mockUrl);records.push({path:url.pathname,query:url.searchParams,time:performance.now()});
 let body='';for await(const chunk of req) body+=chunk;
 await new Promise(resolve=>setTimeout(resolve,150));
 res.setHeader('Content-Type','application/json');
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info, x-supabase-api-version');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');
 if(req.method==='OPTIONS') return res.end();
 if(body) authWrites.push({path:url.pathname,body:JSON.parse(body)});
 if(url.pathname==='/fixture-nevobo.rss') {res.setHeader('Content-Type','application/rss+xml');return res.end(programXml);}
 if(url.pathname==='/fixture-resend') {sentEmails.push({body:JSON.parse(body),key:req.headers['idempotency-key']});return res.end(JSON.stringify({id:'test-resend-message'}));}
 if(url.pathname==='/rest/v1/rpc/acquire_nevobo_sync') {
  if(activeSync) return res.end('null');activeSync=true;syncState.last_started_at=new Date().toISOString();
  return res.end(JSON.stringify('90000000-0000-4000-8000-000000000001'));
 }
 if(url.pathname==='/rest/v1/rpc/fail_nevobo_sync') {activeSync=false;syncState.last_error_code=JSON.parse(body).p_code;return res.end('null');}
 if(url.pathname==='/rest/v1/rpc/apply_nevobo_snapshot') {
  const input=JSON.parse(body),signature=JSON.stringify(input.p_matches),inserted=programSignature===null?input.p_matches.length:0,updated=programSignature!==null && programSignature!==signature?input.p_matches.length:0;
  Object.assign(testMatch,input.p_matches[0]);
  if(updated && refAssigned) emailJobs.push({outbox_id:'91000000-0000-4000-8000-000000000001',claim:'92000000-0000-4000-8000-000000000001',recipient:'anna@example.test',subject:'Wedstrijd gewijzigd',body:'Lokale wijzigingstest: '+input.p_matches[0].starts_at,notification_id:testNotification.id});
  programSignature=signature;activeSync=false;syncState={...syncState,last_success_at:new Date().toISOString(),last_error_code:null,imported_count:inserted,updated_count:updated};
  return res.end(JSON.stringify({inserted,updated,skipped:0}));
 }
 if(url.pathname==='/rest/v1/rpc/claim_notification_emails') return res.end(JSON.stringify(emailJobs.splice(0,JSON.parse(body).p_limit)));
 if(url.pathname==='/rest/v1/rpc/finish_notification_email') return res.end('null');
 if(url.pathname==='/rest/v1/notifications' && req.method==='POST') {
  const row={...JSON.parse(body),id:'83000000-0000-4000-8000-000000000001',match_id:null,read_at:null,created_at:new Date().toISOString()};
  additionalNotifications.push(row);return res.end(JSON.stringify(row));
 }
 if(url.pathname==='/rest/v1/rpc/mark_notification_read') {testNotification.read_at=new Date().toISOString();return res.end('null');}
 if(url.pathname==='/rest/v1/rpc/cancel_duty') {testDuty.cancelled=true;return res.end('null');}
 if(url.pathname==='/rest/v1/rpc/save_club_branding') {
  const input=JSON.parse(body);brand={primary_color:input.p_primary,secondary_color:input.p_secondary};return res.end('null');
 }
 if(url.pathname.endsWith('/recover') || url.pathname.endsWith('/logout')) return res.end('{}');
 if(url.pathname.endsWith('/.well-known/jwks.json')) return res.end(JSON.stringify({keys:[jwk]}));
 if(url.pathname.endsWith('/token') || url.pathname.endsWith('/verify')) {
  const input=JSON.parse(body);
  if(url.pathname.endsWith('/token') && passwords.get(input.email)!==input.password) {
   res.statusCode=400;return res.end(JSON.stringify({code:'invalid_credentials',msg:'Invalid login credentials'}));
  }
  const id=url.pathname.endsWith('/verify') || input.email==='admin@example.test'?admin:input.email==='bram@example.test'?memberB:memberA;
  return res.end(JSON.stringify({access_token:token(id),token_type:'bearer',expires_in:3600,refresh_token:'local-test-refresh',user:{...profile(id),aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}}));
 }
 if(url.pathname.endsWith('/user')) {
  const jwt=req.headers.authorization?.split(' ')[1];
  const id=jwt?JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).sub:memberA;
  if(req.method==='PUT' && JSON.parse(body).password) passwords.set(profile(id).email,JSON.parse(body).password);
  return res.end(JSON.stringify(profile(id)));
 }
 let result=[];
 if(url.pathname==='/rest/v1/notifications') {
  const own=url.searchParams.get('member_id')?.replace('eq.','');
  result=[testNotification,...additionalNotifications].filter(n=>n.member_id===own && (url.searchParams.get('read_at')!=='is.null'||!n.read_at));
  res.setHeader('Content-Range',result.length?`0-${result.length-1}/${result.length}`:'*/0');
 }
 if(url.pathname==='/rest/v1/nevobo_sync_state') result=[syncState];
 if(url.pathname==='/rest/v1/matches') result=[testMatch];
 if(url.pathname==='/rest/v1/club_branding') result=[brand];
 if(url.pathname==='/rest/v1/teams') result=[{id:teamId,name:'Testteam',age_class:'senior'}];
 if(url.pathname==='/rest/v1/memberships') {
   const id=url.searchParams.get('member_id')?.replace('eq.','');
   result=(id?[id]:[memberA,memberB,admin]).map(member_id=>({member_id,season_id:season,team_id:teamId,captain:false,norm_override:null}));
 }
 if(url.pathname==='/rest/v1/duties') result=[testDuty];
 if(url.pathname==='/rest/v1/enrollments' && (!url.searchParams.get('member_id') || url.searchParams.get('member_id')==='eq.'+memberA)) result=[{id:'85000000-0000-4000-8000-000000000001',member_id:memberA,duty_id:testDuty.id,created_at:new Date(Date.now()-3600000).toISOString(),revoked:false,offered:false}];
 if(url.pathname==='/rest/v1/rpc/duty_availability') result=[{duty_id:testDuty.id,occupied:0,offered_ids:[]}];
 if(url.pathname==='/rest/v1/profiles') {
  const id=url.searchParams.get('id')?.replace('eq.','') ?? memberA;
  result=req.headers.accept?.includes('vnd.pgrst.object')?profile(id):[profile(id)];
 }
 if(url.pathname==='/rest/v1/seasons') result=[{id:season,name:'Testseizoen',active:true,default_norm:20,youth_norm:12,senior_norm:20,starts_on:'2026-01-01',ends_on:'2027-12-31'}];
 res.end(JSON.stringify(result));
});
mock.listen(0,'127.0.0.1');await once(mock,'listening');mockUrl=`http://127.0.0.1:${mock.address().port}`;
const port=Number(process.env.PERFORMANCE_TEST_PORT ?? 3011),base=`http://localhost:${port}`;
const app=spawn(process.execPath,['--import',new URL('./test-network.mjs',import.meta.url).href,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,AVV_TEST_NETWORK_URL:mockUrl,CRON_SECRET:cronToken,RESEND_API_KEY:'local-test-resend-key',NOTIFICATION_FROM_EMAIL:'club@example.test',SUPABASE_SERVICE_ROLE_KEY:'local-test-service-role',NEXT_PUBLIC_SUPABASE_URL:mockUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_test',NEXT_PUBLIC_SITE_URL:base},stdio:['ignore','pipe','pipe']});
let logs='';app.stdout.on('data',d=>logs+=d);app.stderr.on('data',d=>logs+=d);
let browser;
try {
 let started=false;
 for(let i=0;i<100;i++){try{const r=await fetch(base+'/login');if(r.ok){started=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 assert.ok(started,'Next testserver start niet: '+logs);
 async function session(email) {
  const jar=new Map();
  const db=createServerClient(mockUrl,'sb_publishable_local_test',{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
  const {error}=await db.auth.signInWithPassword({email,password:'local-test-password'});assert.equal(error,null);
  return [...jar].map(([k,v])=>`${k}=${v}`).join('; ');
 }
 const cookieA=await session('anna@example.test'), cookieB=await session('bram@example.test');
 async function load(path,cookie){const before=performance.now();const response=await fetch(base+path,{headers:{cookie}});const html=await response.text();assert.equal(response.status,200);return {html,ms:Math.round(performance.now()-before)};}
 assert.match((await load('/',cookieA)).html,/Anna/);
 records.length=0;
 const dashboard=await load('/',cookieA);
 const dashboardRequests=[...records];
 assert.equal(dashboardRequests.filter(r=>r.path.startsWith('/auth/')).length,0,'Warme paginawissel mag geen Auth HTTP-request nodig hebben met asymmetrische sleutels');
 assert.equal(dashboardRequests.filter(r=>r.path.startsWith('/rest/')).length,9);
 assert.ok(!dashboardRequests.some(r=>r.path.endsWith('/matches') || r.path.endsWith('/function_definitions')));
 const p=dashboardRequests.find(r=>r.path.endsWith('/profiles')),s=dashboardRequests.find(r=>r.path.endsWith('/seasons'));
 assert.ok(Math.abs(p.time-s.time)<100,'Profiel en seizoen moeten parallel laden');
 assert.equal(dashboardRequests.find(r=>r.path.endsWith('/enrollments')).query.get('member_id'),'eq.'+memberA);
 assert.equal(dashboardRequests.find(r=>r.path.endsWith('/enrollments')).query.get('duties.season_id'),'eq.'+season);
 records.length=0;
 const matches=await load('/wedstrijden',cookieA);
 assert.equal(records.filter(r=>r.path.startsWith('/rest/')).length,7);
 assert.ok(!records.some(r=>r.path.endsWith('/duties') || r.path.endsWith('/enrollments')));
 assert.match((await load('/',cookieB)).html,/Bram/);
 assert.doesNotMatch((await load('/',cookieB)).html,/Anna/);
 async function expectRedirect(path,cookie,target) {
  const response=await fetch(base+path,{headers:cookie?{cookie}:{},redirect:'manual'});
  if(response.status===307) assert.equal(response.headers.get('location'),target);
  else { const html=await response.text(); assert.equal(response.status,200); assert.ok(html.includes('url='+target), 'Streaming redirect ontbreekt'); assert.ok(!html.includes('Puntenrapportage')); }
 }
 await expectRedirect('/beheer',cookieA,'/');
 await expectRedirect('/beheer/instellingen/huisstijl',cookieA,'/');
 await expectRedirect('/',null,'/login');
 // A forged member ID in the cookie must not be trusted or reach the database.
 const forgedCookie=cookieA.split('; ').map(part=>{
  const at=part.indexOf('=');const name=part.slice(0,at),value=part.slice(at+1);
  if(!value.startsWith('base64-')) return part;
  const session=JSON.parse(Buffer.from(value.slice(7),'base64url').toString());
  if(!session.access_token) return part;
  const chunks=session.access_token.split('.');
  const payload=JSON.parse(Buffer.from(chunks[1],'base64url').toString());payload.sub=memberB;
  chunks[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');session.access_token=chunks.join('.');
  return name+'=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
 }).join('; ');
 records.length=0;await expectRedirect('/',forgedCookie,'/login');
 assert.equal(records.filter(r=>r.path.startsWith('/rest/')).length,0,'Ongeldige handtekening mag geen gegevens laden');
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();await page.goto(base+'/login');
 await page.getByLabel('E-mailadres').fill('anna@example.test');await page.getByLabel('Wachtwoord',{exact:true}).fill('local-test-password');
 await page.getByRole('button',{name:'Inloggen'}).click();
 await page.locator('button[aria-busy=true]').waitFor({timeout:1000});
 assert.equal(await page.getByRole('button',{name:/Inloggen/}).isDisabled(),true);
 await page.waitForURL(base+'/');await page.getByText('Anna Test',{exact:true}).first().waitFor();
 // Hold the actual navigation response to verify feedback before it arrives.
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/wedstrijden?*',async route=>{await gate;await route.continue();});
 await page.getByRole('link',{name:'Wedstrijden',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Pagina laden'}).first().waitFor({timeout:1000});
 release();await page.waitForURL('**/wedstrijden');await page.getByRole('heading',{name:'Wedstrijden',exact:true}).waitFor();
 await page.goto(base+'/meldingen');
 await page.getByRole('heading',{name:'Meldingen',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Testwedstrijd gewijzigd'}).waitFor();
 await page.getByRole('button',{name:'Markeren als gelezen'}).click();
 await page.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.ok(testNotification.read_at);
 const forbiddenWorker=await fetch(base+'/api/nevobo/notifications');assert.equal(forbiddenWorker.status,401);
 // Closing new signup must preserve the owner's original 24-hour withdrawal.
 testDuty.signup_closed=true;
 await page.goto(base+'/diensten?view=mine');
 await page.getByRole('button',{name:'Afmelden',exact:true}).waitFor();
 assert.doesNotMatch((await load('/diensten',cookieB)).html,/Testdienst/);
 testDuty.signup_closed=false;
 // Exercise the original admin flow, rejected credentials and both email-link formats.
 const adminPage=await browser.newPage();adminPage.setDefaultTimeout(10000);await adminPage.goto(base+'/login');
 await adminPage.getByLabel('E-mailadres').fill('admin@example.test');
 await adminPage.getByLabel('Wachtwoord',{exact:true}).fill('wrong-test-password');
 await adminPage.getByRole('button',{name:'Inloggen'}).click();
 await adminPage.getByRole('alert').filter({hasText:'wachtwoord niet herkend'}).waitFor();
 await adminPage.getByLabel('E-mailadres').fill('admin@example.test');
 await adminPage.getByLabel('Wachtwoord',{exact:true}).fill('local-test-password');
 await adminPage.getByRole('button',{name:'Inloggen'}).click();
 await adminPage.waitForURL(base+'/');await adminPage.getByText('Alex Test',{exact:true}).first().waitFor();
 await adminPage.getByRole('link',{name:'Beheer',exact:true}).click();
 await adminPage.getByRole('heading',{name:'Beheer',exact:true}).waitFor();
 await adminPage.goto(base+'/wachtwoord-vergeten');
 await adminPage.getByLabel('E-mailadres').fill('admin@example.test');
 await adminPage.getByRole('button',{name:'Herstelmail aanvragen'}).click();
 await adminPage.getByRole('status').filter({hasText:'Als er een account'}).waitFor();
 await adminPage.goto(base+'/wachtwoord-vergeten');
 await adminPage.getByLabel('E-mailadres').fill('unknown@example.test');
 await adminPage.getByRole('button',{name:'Herstelmail aanvragen'}).click();
 await adminPage.getByRole('status').filter({hasText:'Als er een account'}).waitFor();
 assert.equal(authWrites.filter(r=>r.path.endsWith('/recover')).length,2);
 await adminPage.goto(base+'/auth/confirm#access_token='+encodeURIComponent(token(admin))+'&refresh_token=local-test-refresh&type=recovery');
 await adminPage.waitForURL('**/?password=1');
 await adminPage.getByRole('heading',{name:'Wachtwoord instellen',exact:true}).waitFor();
 assert.equal(new URL(adminPage.url()).hash,'');
 const newPassword=' local-test-password-with-spaces ';
 await adminPage.getByLabel('Nieuw wachtwoord').fill(newPassword);
 await adminPage.getByRole('button',{name:'Wachtwoord instellen'}).click();
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(passwords.get('admin@example.test'),newPassword);
 await adminPage.getByRole('button',{name:'Uitloggen'}).click();
 await adminPage.waitForURL('**/login');
 await adminPage.getByLabel('E-mailadres').fill('admin@example.test');
 await adminPage.getByLabel('Wachtwoord',{exact:true}).fill(newPassword);
 await adminPage.getByRole('button',{name:'Inloggen'}).click();
 await adminPage.waitForURL(base+'/');await adminPage.getByText('Alex Test',{exact:true}).first().waitFor();
 await adminPage.goto(base+'/auth/confirm?token_hash=local-test-recovery&type=recovery');
 await adminPage.waitForURL('**/?password=1');await adminPage.getByRole('heading',{name:'Wachtwoord instellen',exact:true}).waitFor();
 await adminPage.goto(base+'/beheer/instellingen/huisstijl');
 await adminPage.getByRole('heading',{name:'Huisstijl',exact:true}).waitFor();
 await adminPage.getByLabel('Primaire kleur',{exact:true}).fill('#FFFFFF');
 assert.equal(await adminPage.locator('.branding-preview').evaluate(el=>getComputedStyle(el).getPropertyValue('--on-accent').trim()),'#000000');
 await adminPage.getByLabel('Primaire kleur',{exact:true}).fill('#334455');
 await adminPage.getByLabel('Secundaire kleur',{exact:true}).fill('#7250A0');
 assert.equal(await adminPage.locator('.branding-preview').evaluate(el=>getComputedStyle(el).getPropertyValue('--brand-primary').trim()),'#334455');
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/instellingen/huisstijl'),adminPage.getByRole('button',{name:'Kleuren opslaan'}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(brand.primary_color,'#334455');
 await adminPage.reload();await adminPage.getByRole('heading',{name:'Huisstijl',exact:true}).waitFor();
 assert.equal(await adminPage.getByLabel('Primaire kleur',{exact:true}).inputValue(),'#334455');
 assert.equal(await adminPage.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--brand-primary').trim()),'#334455');
 await adminPage.getByRole('button',{name:'Standaardkleuren herstellen'}).click();
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/instellingen/huisstijl'),adminPage.getByRole('button',{name:'Kleuren opslaan'}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(brand.primary_color,'#087D56');
 // A destructive action requires confirmation; dismissing does not submit.
 await adminPage.goto(base+'/beheer');
 await adminPage.getByRole('button',{name:'Dienst annuleren',exact:true}).click();
 await adminPage.getByRole('dialog',{name:'Actie bevestigen'}).waitFor();
 await adminPage.getByRole('button',{name:'Annuleren',exact:true}).click();
 assert.equal(await adminPage.getByRole('dialog').count(),0);
 assert.equal(authWrites.filter(r=>r.path.endsWith('/cancel_duty')).length,0);
 await adminPage.getByRole('button',{name:'Dienst annuleren',exact:true}).click();
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer'),adminPage.getByRole('button',{name:'Bevestigen',exact:true}).click()]);
 assert.equal(authWrites.filter(r=>r.path.endsWith('/cancel_duty')).length,1);
 assert.equal(testDuty.cancelled,true);
 // Exercise the actual RSS adapter and server endpoints through a local-only
 // network preloader. PostgreSQL behaviour is independently tested with PGlite.
 assert.equal((await fetch(base+'/api/nevobo/sync')).status,401);
 const syncRequest=()=>fetch(base+'/api/nevobo/sync',{method:'POST',headers:{Authorization:'Bearer '+cronToken}});
 const imported=await syncRequest();assert.equal(imported.status,200);
 const importResult=await imported.json();assert.equal(importResult.counts.inserted,1);
 assert.equal(testMatch.external_id,'nevobo:1964526');assert.equal(testMatch.starts_at,'2026-11-14T13:30:00.000Z');
 assert.equal(testMatch.postal_code,'3815XT');assert.equal(sentEmails.length,0);
 await adminPage.goto(base+'/wedstrijden?view=all');
 await adminPage.getByRole('button',{name:'Nu synchroniseren'}).click();
 await adminPage.getByRole('status').filter({hasText:/Import voltooid/}).waitFor();
 refAssigned=true;programXml=actualProgram.replaceAll('14:30','15:30');
 const changed=await syncRequest();assert.equal(changed.status,200);assert.equal((await changed.json()).counts.updated,1);
 assert.equal(sentEmails.length,1);assert.equal(sentEmails[0].key,'nevobo-'+testNotification.id);
 assert.deepEqual(sentEmails[0].body.to,['anna@example.test']);
 await syncRequest();assert.equal(sentEmails.length,1,'Een identieke import verstuurt geen nieuwe mail');
 const previousApplyCount=authWrites.filter(r=>r.path.endsWith('/apply_nevobo_snapshot')).length;
 programXml='<html>Temporary upstream error</html>';
 assert.equal((await syncRequest()).status,503);
 assert.equal(authWrites.filter(r=>r.path.endsWith('/apply_nevobo_snapshot')).length,previousApplyCount);
 assert.equal(testMatch.starts_at,'2026-11-14T14:30:00.000Z','Een defecte bron wist de planning niet');
 programXml=actualProgram;
 await adminPage.goto(base+'/wedstrijden?view=all');
 await adminPage.getByRole('button',{name:'Testmelding naar mij'}).click();
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(sentEmails.length,2);assert.deepEqual(sentEmails[1].body.to,['admin@example.test']);
 assert.equal(additionalNotifications[0].member_id,admin);
 await adminPage.goto(base+'/meldingen');
 await adminPage.getByRole('heading',{name:/^Testmelding wedstrijdkoppeling(?:\s*Ongelezen)?$/}).waitFor();
 await page.goto(base+'/meldingen');
 assert.equal(await page.getByRole('heading',{name:/^Testmelding wedstrijdkoppeling(?:\s*Ongelezen)?$/}).count(),0);
 console.log('Nevobo-integratie geslaagd: echt aangeleverd RSS-item, beveiligde cronroute, handmatige sync, wijzigingsmail, idempotentie en behoud bij bronfout. RSS en Resend uitsluitend lokaal nagebootst.');
 const screenshots=process.env.SCREENSHOT_DIR;
 if(screenshots) await mkdir(screenshots,{recursive:true});
 for(const width of [390,768,1440]) {
   await adminPage.setViewportSize({width,height:950});
   for(const path of ['/','/diensten','/beheer','/team','/wedstrijden','/meldingen','/beheer/instellingen/huisstijl','/login','/wachtwoord-vergeten']) {
     await adminPage.goto(base+path,{waitUntil:'networkidle'});
     assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Horizontal overflow ${width} ${path}`);
     if(screenshots && ['/','/beheer/instellingen/huisstijl'].includes(path)) await adminPage.screenshot({path:`${screenshots}/keistad-${path==='/'?'overzicht':'huisstijl'}-${width}.png`,fullPage:true});
   }
 }
 await adminPage.setViewportSize({width:390,height:844});await adminPage.goto(base+'/');
 await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).click();
 await adminPage.getByRole('dialog',{name:'Navigatie',exact:true}).waitFor();
 await adminPage.keyboard.press('Escape');
 assert.equal(await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).getAttribute('aria-expanded'),'false');
 await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).click();
 await adminPage.getByRole('link',{name:'Diensten',exact:true}).click();
 await adminPage.waitForURL('**/diensten');
 assert.equal(await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).getAttribute('aria-expanded'),'false');
 console.log('Designcontrole geslaagd: huisstijlpreview, opslaan/herladen/reset, member-toegangsbeperking, bevestigingsdialoog, mobiele navigatie en overflow op 390/768/1440 px. Alleen testfixtures.');
 console.log('Auth-integratie geslaagd: admin inloggen/beheer, onjuiste credentials, herstelmail zonder accountonthulling, standaard- en token-hash-herstellinks, wachtwoord wijzigen en opnieuw inloggen met exacte wachtwoordtekens. Geen echte e-mails verstuurd.');
 console.log(`Performance-integratie geslaagd: dashboard 9 API-requests (${dashboard.ms}ms), wedstrijden 7 (${matches.ms}ms), elk met 150ms nagebootste API-latentie. Geen Auth HTTP-requests bij warme JWT-verificatie; gebruikersisolatie, redirects, formulier- en navigatiefeedback gecontroleerd. Geen productiemeting.`);
} finally {
 if(browser) await browser.close();app.kill('SIGTERM');mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));
}
