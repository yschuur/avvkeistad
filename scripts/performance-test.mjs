// Local integration test: real Next server + signed test sessions + delayed mock
// Supabase HTTP API. No real credentials or member data are used.
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright-core';
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwk={...publicKey.export({format:'jwk'}),kid:'local-performance-test',alg:'ES256',use:'sig'};
const memberA='10000000-0000-4000-8000-000000000001', memberB='10000000-0000-4000-8000-000000000002', admin='10000000-0000-4000-8000-000000000003';
const season='20000000-0000-4000-8000-000000000001';
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
 if(url.pathname==='/rest/v1/profiles') {
  const id=url.searchParams.get('id')?.replace('eq.','') ?? memberA;
  result=req.headers.accept?.includes('vnd.pgrst.object')?profile(id):[profile(id)];
 }
 if(url.pathname==='/rest/v1/seasons') result=[{id:season,name:'Testseizoen',active:true,default_norm:20,youth_norm:12,senior_norm:20,starts_on:'2026-01-01',ends_on:'2027-12-31'}];
 res.end(JSON.stringify(result));
});
mock.listen(0,'127.0.0.1');await once(mock,'listening');mockUrl=`http://127.0.0.1:${mock.address().port}`;
const port=Number(process.env.PERFORMANCE_TEST_PORT ?? 3011),base=`http://localhost:${port}`;
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:mockUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_test',NEXT_PUBLIC_SITE_URL:base},stdio:['ignore','pipe','pipe']});
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
 assert.match((await load('/',cookieA)).html,/Hoi Anna/);
 records.length=0;
 const dashboard=await load('/',cookieA);
 const dashboardRequests=[...records];
 assert.equal(dashboardRequests.filter(r=>r.path.startsWith('/auth/')).length,0,'Warme paginawissel mag geen Auth HTTP-request nodig hebben met asymmetrische sleutels');
 assert.equal(dashboardRequests.filter(r=>r.path.startsWith('/rest/')).length,8);
 assert.ok(!dashboardRequests.some(r=>r.path.endsWith('/matches') || r.path.endsWith('/function_definitions')));
 const p=dashboardRequests.find(r=>r.path.endsWith('/profiles')),s=dashboardRequests.find(r=>r.path.endsWith('/seasons'));
 assert.ok(Math.abs(p.time-s.time)<100,'Profiel en seizoen moeten parallel laden');
 assert.equal(dashboardRequests.find(r=>r.path.endsWith('/enrollments')).query.get('member_id'),'eq.'+memberA);
 assert.equal(dashboardRequests.find(r=>r.path.endsWith('/enrollments')).query.get('duties.season_id'),'eq.'+season);
 records.length=0;
 const matches=await load('/wedstrijden',cookieA);
 assert.equal(records.filter(r=>r.path.startsWith('/rest/')).length,5);
 assert.ok(!records.some(r=>r.path.endsWith('/duties') || r.path.endsWith('/enrollments')));
 assert.match((await load('/',cookieB)).html,/Hoi Bram/);
 assert.doesNotMatch((await load('/',cookieB)).html,/Hoi Anna/);
 async function expectRedirect(path,cookie,target) {
  const response=await fetch(base+path,{headers:cookie?{cookie}:{},redirect:'manual'});
  if(response.status===307) assert.equal(response.headers.get('location'),target);
  else { const html=await response.text(); assert.equal(response.status,200); assert.ok(html.includes('url='+target), 'Streaming redirect ontbreekt'); assert.ok(!html.includes('Samen goed geregeld')); }
 }
 await expectRedirect('/beheer',cookieA,'/');
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
 await page.waitForURL(base+'/');await page.getByRole('heading',{name:/Hoi Anna/}).waitFor();
 // Hold the actual navigation response to verify feedback before it arrives.
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/wedstrijden?*',async route=>{await gate;await route.continue();});
 await page.getByRole('link',{name:'Wedstrijden',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Pagina laden'}).first().waitFor({timeout:1000});
 release();await page.waitForURL('**/wedstrijden');await page.getByRole('heading',{name:'Het wedstrijdprogramma'}).waitFor();
 // Exercise the original admin flow, rejected credentials and both email-link formats.
 const adminPage=await browser.newPage();adminPage.setDefaultTimeout(10000);await adminPage.goto(base+'/login');
 await adminPage.getByLabel('E-mailadres').fill('admin@example.test');
 await adminPage.getByLabel('Wachtwoord',{exact:true}).fill('wrong-test-password');
 await adminPage.getByRole('button',{name:'Inloggen'}).click();
 await adminPage.getByRole('alert').filter({hasText:'wachtwoord niet herkend'}).waitFor();
 await adminPage.getByLabel('E-mailadres').fill('admin@example.test');
 await adminPage.getByLabel('Wachtwoord',{exact:true}).fill('local-test-password');
 await adminPage.getByRole('button',{name:'Inloggen'}).click();
 await adminPage.waitForURL(base+'/');await adminPage.getByRole('heading',{name:/Hoi Alex/}).waitFor();
 await adminPage.getByRole('link',{name:'Beheer',exact:true}).click();
 await adminPage.getByRole('heading',{name:'Samen goed geregeld'}).waitFor();
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
 await adminPage.getByRole('heading',{name:'Maak je account compleet'}).waitFor();
 assert.equal(new URL(adminPage.url()).hash,'');
 const newPassword=' local-test-password-with-spaces ';
 await adminPage.getByLabel('Nieuw wachtwoord').fill(newPassword);
 await adminPage.getByRole('button',{name:'Wachtwoord instellen'}).click();
 await adminPage.getByRole('status').filter({hasText:'Opgeslagen'}).waitFor();
 assert.equal(passwords.get('admin@example.test'),newPassword);
 await adminPage.getByRole('button',{name:'Uitloggen'}).click();
 await adminPage.waitForURL('**/login');
 await adminPage.getByLabel('E-mailadres').fill('admin@example.test');
 await adminPage.getByLabel('Wachtwoord',{exact:true}).fill(newPassword);
 await adminPage.getByRole('button',{name:'Inloggen'}).click();
 await adminPage.waitForURL(base+'/');await adminPage.getByRole('heading',{name:/Hoi Alex/}).waitFor();
 await adminPage.goto(base+'/auth/confirm?token_hash=local-test-recovery&type=recovery');
 await adminPage.waitForURL('**/?password=1');await adminPage.getByRole('heading',{name:'Maak je account compleet'}).waitFor();
 console.log('Auth-integratie geslaagd: admin inloggen/beheer, onjuiste credentials, herstelmail zonder accountonthulling, standaard- en token-hash-herstellinks, wachtwoord wijzigen en opnieuw inloggen met exacte wachtwoordtekens. Geen echte e-mails verstuurd.');
 console.log(`Performance-integratie geslaagd: dashboard 8 API-requests (${dashboard.ms}ms), wedstrijden 5 (${matches.ms}ms), elk met 150ms nagebootste API-latentie. Geen Auth HTTP-requests bij warme JWT-verificatie; gebruikersisolatie, redirects, formulier- en navigatiefeedback gecontroleerd. Geen productiemeting.`);
} finally {
 if(browser) await browser.close();app.kill('SIGTERM');mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));
}
