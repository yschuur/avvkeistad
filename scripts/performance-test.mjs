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
const initialSeason={id:season,name:'Testseizoen',active:true,default_norm:20,youth_norm:12,senior_norm:20,starts_on:'2026-01-01',ends_on:'2027-12-31',updated_at:'2026-11-09T12:00:00.000Z'};
let testSeasons=[{...initialSeason}],seasonSaveFailure=false,seasonMigrationMissing=false,seasonVersion=0;
const seasonStamp=()=>new Date(Date.UTC(2026,10,9,13,0,++seasonVersion)).toISOString();
// All records below are isolated test fixtures. They are never imported by the app.
const teamId='30000000-0000-4000-8000-000000000001';
let testTeams=[{id:teamId,name:'Testteam',age_class:'senior',competition_level:null}];
const testDuty={id:'50000000-0000-4000-8000-000000000001',season_id:season,title:'Testdienst',kind:'bar',starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+93600000).toISOString(),points:2,capacity:2,location:'Testlocatie',required_level:0,assigned_team_id:null,cancelled:false};
let hideTestEnrollment=false,captainA=false;
let extraDuties=[],extraEnrollments=[];
const teamAssignments=new Map();
let adminRole='admin';
let brand={club_name:'AVV Keistad',logo_data:null,primary_color:'#087D56',secondary_color:'#6483B8',accent_color:'#087D56'},identityMigrationMissing=false,publicBrandingFailure=false,privateBrandingFailure=false;
const logoBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=','base64');
const testMatch={id:'70000000-0000-4000-8000-000000000001',home_team:'Test thuis',away_team:'Test uit',starts_at:testDuty.starts_at,location:'Testlocatie',level:'',club_referee:false,status:'scheduled',cancelled:false,source_description:'Uitsluitend lokale testgegevens.',referee_duties:[]};
let matchFilterFixtures=null;
const testNotification={id:'80000000-0000-4000-8000-000000000001',member_id:memberA,match_id:testMatch.id,title:'Testwedstrijd gewijzigd',body:'Nieuwe planning in de lokale testomgeving.',created_at:new Date().toISOString(),read_at:null};
const historyBefore={home_team:'Test thuis',away_team:'Test uit',starts_at:'2026-11-14T13:30:00Z',location:'Oude testhal',status:'scheduled'};
const historyAfter={...historyBefore,starts_at:'2026-11-14T14:30:00Z',location:'Gewijzigde testhal'};
const initialMatchEvents=[
 {id:'84000000-0000-4000-8000-000000000001',match_id:testMatch.id,revision:2,kind:'moved',created_at:new Date(Date.now()-60000).toISOString(),old_state:historyBefore,new_state:historyAfter,match:{home_team:'Test thuis',away_team:'Test uit',match_code:'TEST'}},
 {id:'84000000-0000-4000-8000-000000000002',match_id:testMatch.id,revision:3,kind:'cancelled',created_at:new Date().toISOString(),old_state:historyAfter,new_state:{...historyAfter,status:'cancelled'},match:{home_team:'Test thuis',away_team:'Test uit',match_code:'TEST'}},
];
let testMatchEvents=initialMatchEvents,historyUnavailable=false;
const actualProgram=await readFile(new URL('../tests/fixtures/nevobo-program.rss',import.meta.url),'utf8');
let programXml=actualProgram,programSignature=null,activeSync=false,refAssigned=false;
const emailJobs=[],sentEmails=[],additionalNotifications=[];
const cronToken='local-test-cron-token-not-a-real-secret-12345';
let syncState={last_started_at:null,last_success_at:null,last_error_code:null,feed_published_at:null,imported_count:0,updated_count:0};
const records=[];
const authWrites=[];
let refereePoints=2,dutySettingsMissing=false;
const passwords=new Map([['anna@example.test','local-test-password'],['bram@example.test','local-test-password'],['admin@example.test','local-test-password']]);
let mockUrl;
const refereeQualifications=new Map([[memberA,'V6'],[memberB,'N1']]);
const refereeCodes=['V6','V4','R2.2','R2','R1','N3','N2','N1'];
const profile=id=>({id,first_name:id===admin?'Alex':id===memberA?'Anna':'Bram',last_name:'Test',email:id===admin?'admin@example.test':id===memberA?'anna@example.test':'bram@example.test',role:id===admin?adminRole:'member',referee_level:refereeCodes.indexOf(refereeQualifications.get(id))+1,referee_qualification:refereeQualifications.get(id) ?? null,nevobo_code:null});
const token=id=>{
 const header=Buffer.from(JSON.stringify({alg:'ES256',typ:'JWT',kid:jwk.kid})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({sub:id,role:'authenticated',iss:mockUrl+'/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),session_id:'40000000-0000-4000-8000-000000000001'})).toString('base64url');
 const input=header+'.'+payload;
 return input+'.'+sign('sha256',Buffer.from(input),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
};
const mock=createServer(async(req,res)=>{
 const url=new URL(req.url,mockUrl);records.push({path:url.pathname,query:url.searchParams,time:performance.now(),authenticated:/^Bearer eyJ/.test(req.headers.authorization??'')});
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
 if(url.pathname==='/rest/v1/rpc/save_season') {
  const input=JSON.parse(body);
  if(seasonSaveFailure) {res.statusCode=400;return res.end(JSON.stringify({code:'P0001',message:'Er bestaat al een seizoen met deze naam.'}));}
  const existing=testSeasons.find(s=>s.id===input.p_season);
  if(existing && existing.updated_at!==input.p_expected_updated_at) {res.statusCode=400;return res.end(JSON.stringify({code:'P0001',message:'Dit seizoen is intussen gewijzigd. Herlaad de pagina voordat je opnieuw opslaat.'}));}
  const saved={id:existing?.id ?? '20000000-0000-4000-8000-000000000002',name:input.p_name,starts_on:input.p_start,ends_on:input.p_end,default_norm:input.p_norm,youth_norm:input.p_youth,senior_norm:input.p_senior,active:existing?.active ?? !testSeasons.some(s=>s.active),updated_at:seasonStamp()};
  if(existing) Object.assign(existing,saved);else testSeasons.push(saved);
  return res.end(JSON.stringify(saved.id));
 }
 if(url.pathname==='/rest/v1/rpc/activate_season') {
  const input=JSON.parse(body);for(const s of testSeasons) {s.active=s.id===input.p_season;s.updated_at=seasonStamp();}return res.end('null');
 }
 if(url.pathname==='/rest/v1/rpc/update_member_qualification') {
  const input=JSON.parse(body);refereeQualifications.set(input.p_member,input.p_qualification);return res.end('null');
 }
 if(url.pathname==='/rest/v1/rpc/set_duty_qualification') {
  const input=JSON.parse(body);testDuty.required_qualification=input.p_qualification;testDuty.required_level=refereeCodes.indexOf(input.p_qualification)+1;return res.end('null');
 }
 if(url.pathname==='/rest/v1/rpc/create_default_duty') return res.end('null');
 if(url.pathname==='/rest/v1/rpc/update_team_competition') {
  const input=JSON.parse(body);testTeams.find(t=>t.id===input.p_team).competition_level=input.p_competition==='Overig'?null:input.p_competition;return res.end('null');
 }
 if(url.pathname==='/rest/v1/rpc/create_team_match_duty') {
  const input=JSON.parse(body);testMatch.referee_duties=[{id:testDuty.id,kind:'referee',cancelled:false,points:refereePoints,assigned_team_id:input.p_team}];return res.end(JSON.stringify(testDuty.id));
 }
 if(url.pathname==='/rest/v1/rpc/save_duty_settings') {refereePoints=JSON.parse(body).p_referee_points;return res.end('null');}
 if(url.pathname==='/rest/v1/rpc/assign_duty_team') {
  const input=JSON.parse(body),duty=[testDuty,...extraDuties].find(d=>d.id===input.p_duty);if(duty) duty.assigned_team_id=input.p_team;
  for(const linked of testMatch.referee_duties) if(linked.id===input.p_duty) linked.assigned_team_id=input.p_team;
  return res.end('null');
 }
 if(url.pathname==='/rest/v1/rpc/enroll') {
  const input=JSON.parse(body);
  if(extraDuties.some(d=>d.id===input.p_duty)) extraEnrollments.push({id:'86000000-0000-4000-8000-000000000099',member_id:input.p_member ?? memberA,duty_id:input.p_duty,created_at:new Date().toISOString(),revoked:false,offered:false});
  return res.end('null');
 }
 if(url.pathname==='/rest/v1/rpc/cancel_duty') {testDuty.cancelled=true;return res.end('null');}
 if(url.pathname==='/rest/v1/rpc/save_club_branding') {
  const input=JSON.parse(body);Object.assign(brand,{primary_color:input.p_primary,secondary_color:input.p_secondary});return res.end('null');
 }
 if(url.pathname==='/rest/v1/rpc/save_club_identity') {
  const input=JSON.parse(body);Object.assign(brand,{club_name:input.p_name.trim(),logo_data:input.p_logo,primary_color:input.p_primary,secondary_color:input.p_secondary,accent_color:input.p_accent});return res.end('null');
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
 if(url.pathname==='/rest/v1/match_events') {
  if(historyUnavailable) {res.statusCode=400;return res.end(JSON.stringify({code:'42P01',message:'missing match_events'}));}
  const kind=url.searchParams.get('kind')?.replace('eq.',''),match=url.searchParams.get('match_id')?.replace('eq.','');
  const source=testMatchEvents.filter(e=>(!kind||e.kind===kind)&&(!match||e.match_id===match)).toSorted((a,b)=>b.created_at.localeCompare(a.created_at));
  const from=Number(url.searchParams.get('offset') ?? 0),limit=Number(url.searchParams.get('limit') ?? 25);
  result=source.slice(from,from+limit);res.setHeader('Content-Range',result.length?`${from}-${from+result.length-1}/${source.length}`:`*/${source.length}`);
 }
 if(url.pathname==='/rest/v1/nevobo_sync_state') result=[syncState];
 if(url.pathname==='/rest/v1/matches') {
  const source=matchFilterFixtures ?? [testMatch],from=Number(url.searchParams.get('offset') ?? 0),limit=Number(url.searchParams.get('limit') ?? 500);
  result=source.slice(from,from+limit);res.setHeader('Content-Range',result.length?`${from}-${from+result.length-1}/${source.length}`:`*/${source.length}`);
 }
 if(url.pathname==='/rest/v1/club_branding') {
  const authenticated=/^Bearer eyJ/.test(req.headers.authorization??'');
  if((publicBrandingFailure&&!authenticated)||(privateBrandingFailure&&authenticated)) {res.statusCode=503;return res.end(JSON.stringify({code:'PGRST000',message:'Local temporary read failure'}));}
  if(identityMigrationMissing && url.searchParams.get('select').includes('club_name')) {res.statusCode=400;return res.end(JSON.stringify({code:'42703',message:'missing club_name'}));}
  result=[identityMigrationMissing?{primary_color:brand.primary_color,secondary_color:brand.secondary_color}:brand];
 }
 if(url.pathname==='/rest/v1/duty_settings') {
  if(dutySettingsMissing) {res.statusCode=404;return res.end(JSON.stringify({code:'42P01',message:'missing duty_settings'}));}
  result=req.headers.accept?.includes('vnd.pgrst.object')?{referee_points:refereePoints}:[{referee_points:refereePoints}];
 }
 if(url.pathname==='/rest/v1/teams') result=testTeams;
 if(url.pathname==='/rest/v1/memberships') {
   const id=url.searchParams.get('member_id')?.replace('eq.','');
   result=(id?[id]:[memberA,memberB,admin]).map(member_id=>({member_id,season_id:season,team_id:teamAssignments.get(member_id) ?? teamId,captain:member_id===memberA&&captainA,norm_override:null}));
 }
 if(url.pathname==='/rest/v1/duties') result=[testDuty,...extraDuties];
 if(url.pathname==='/rest/v1/enrollments') {
  const member=url.searchParams.get('member_id')?.replace('eq.','');
  const ownBase=!hideTestEnrollment?[{id:'85000000-0000-4000-8000-000000000001',member_id:memberA,duty_id:testDuty.id,created_at:new Date(Date.now()-3600000).toISOString(),revoked:false,offered:false}]:[];
  result=[...ownBase,...extraEnrollments].filter(e=>!member||e.member_id===member);
 }
 if(url.pathname==='/rest/v1/rpc/duty_availability') result=[{duty_id:testDuty.id,occupied:0,offered_ids:[]},...extraDuties.map(d=>({duty_id:d.id,occupied:extraEnrollments.filter(e=>e.duty_id===d.id&&!e.revoked).length,offered_ids:[]}))];
 if(url.pathname==='/rest/v1/profiles') {
  const id=url.searchParams.get('id')?.replace('eq.','') ?? memberA;
  result=req.headers.accept?.includes('vnd.pgrst.object')?profile(id):url.searchParams.has('id')?[profile(id)]:[profile(memberA),profile(memberB),profile(admin)];
 }
 if(url.pathname==='/rest/v1/seasons') {
  if(seasonMigrationMissing && url.searchParams.get('select')?.includes('updated_at')) {res.statusCode=400;return res.end(JSON.stringify({code:'42703',message:'column seasons.updated_at does not exist'}));}
  result=testSeasons.filter(s=>url.searchParams.get('active')!=='eq.true'||s.active).toSorted((a,b)=>b.starts_on.localeCompare(a.starts_on));
 }
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
 await expectRedirect('/beheer/instellingen/diensten',cookieA,'/');
 for(const route of ['/beheer/leden','/beheer/teams','/beheer/planning','/beheer/functies','/beheer/rapportage','/beheer/instellingen','/beheer/instellingen/diensten','/beheer/wedstrijden','/beheer/wedstrijden/log']) await expectRedirect(route,cookieA,'/');
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
 // A member gets only own information; completed services remain accessible.
 assert.deepEqual(await page.getByRole('navigation',{name:'Hoofdnavigatie'}).getByRole('link').allTextContents(),['Mijn overzicht','Open diensten','Mijn diensten','Mijn profiel']);
 const pastId='50000000-0000-4000-8000-000000000002',foreignId='50000000-0000-4000-8000-000000000003';
 extraDuties=[{...testDuty,id:pastId,title:'Eigen afgelopen testdienst',starts_at:new Date(Date.now()-3*86400000).toISOString(),ends_at:new Date(Date.now()-3*86400000+7200000).toISOString(),points:3},{...testDuty,id:foreignId,title:'Dienst van ander lid',starts_at:new Date(Date.now()-4*86400000).toISOString(),ends_at:new Date(Date.now()-4*86400000+7200000).toISOString()}];
 extraEnrollments=[{id:'86000000-0000-4000-8000-000000000002',member_id:memberA,duty_id:pastId,created_at:new Date(Date.now()-5*86400000).toISOString(),revoked:false,offered:false},{id:'86000000-0000-4000-8000-000000000003',member_id:memberB,duty_id:foreignId,created_at:new Date(Date.now()-5*86400000).toISOString(),revoked:false,offered:false}];
 await page.goto(base+'/');
 assert.equal(await page.getByRole('progressbar',{name:'Behaalde punten'}).getAttribute('aria-valuenow'),'3');
 assert.equal(await page.getByRole('progressbar',{name:'Behaalde punten'}).getAttribute('aria-valuemax'),'20');
 assert.match(await page.getByRole('progressbar').getAttribute('aria-valuetext'),/3 van 20 punten behaald, 2 punten ingepland/);
 if(process.env.SCREENSHOT_DIR) {
  await mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
  for(const width of [390,1440]) {await page.setViewportSize({width,height:950});await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/lid-met-dienst-${width}.png`,fullPage:true});}
 }
 await page.setViewportSize({width:1280,height:950});
 await page.goto(base+'/mijn-diensten?view=history&member='+memberB);
 await page.getByRole('heading',{name:'Eigen afgelopen testdienst',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Dienst van ander lid',exact:true}).count(),0);
 await page.getByRole('link',{name:'Komend',exact:true}).click();await page.getByRole('heading',{name:'Testdienst',exact:true}).waitFor();
 await page.goto(base+'/profiel?member='+memberB);
 await page.getByRole('heading',{name:'Mijn profiel',exact:true}).waitFor();await page.getByText('anna@example.test',{exact:true}).waitFor();
 assert.equal(await page.getByText('bram@example.test',{exact:true}).count(),0);
 assert.equal(await page.locator('input[name=qualification],input[name=role],input[name=norm]').count(),0);
 await page.goto(base+'/team');await page.waitForURL(base+'/');
 // A captain sees only their own team and only eligible, free own-team members.
 const reservedId='50000000-0000-4000-8000-000000000004',otherTeam='30000000-0000-4000-8000-000000000002';
 captainA=true;teamAssignments.set(admin,otherTeam);
 testTeams=[{id:teamId,name:'Eigen testteam',age_class:'senior',competition_level:null},{id:otherTeam,name:'Ander testteam',age_class:'senior',competition_level:null}];
 extraDuties=[{...testDuty,id:reservedId,title:'Eigen teamfluitdienst',assigned_team_id:teamId,kind:'referee',required_qualification:'R1',required_level:5,capacity:1,starts_at:new Date(Date.now()+3*86400000).toISOString(),ends_at:new Date(Date.now()+3*86400000+7200000).toISOString()},{...testDuty,id:foreignId,title:'Dienst van ander team',assigned_team_id:otherTeam}];extraEnrollments=[];
 await page.goto(base+'/team');await page.getByRole('heading',{name:'Mijn team',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Ander testteam',exact:true}).count(),0);
 assert.equal(await page.getByRole('heading',{name:'Dienst van ander team',exact:true}).count(),0);
 assert.equal(await page.getByRole('region',{name:'Teampunten'}).getByText('Alex Test',{exact:true}).count(),0);
 const assign=page.getByRole('button',{name:'Toewijzen',exact:true}).locator('xpath=ancestor::form');
 assert.deepEqual(await assign.getByLabel('Teamlid toewijzen').locator('option').allTextContents(),['Kies een teamlid','Bram Test']);
 await assign.getByLabel('Teamlid toewijzen').selectOption(memberB);await assign.getByRole('button',{name:'Toewijzen',exact:true}).click();
 await page.waitForURL(url=>url.pathname==='/team'&&url.searchParams.has('success'));
 await page.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(authWrites.filter(r=>r.path.endsWith('/enroll')).at(-1).body.p_member,memberB);
 await page.getByText('Geen openstaande teamdiensten.',{exact:true}).waitFor();
 captainA=false;teamAssignments.clear();testTeams=[{id:teamId,name:'Testteam',age_class:'senior',competition_level:null}];extraDuties=[];extraEnrollments=[];
 await page.goto(base+'/');await page.getByRole('heading',{name:'Mijn overzicht',exact:true}).waitFor();
 console.log('Ledenomgeving geslaagd: vier menuonderdelen, eigen profiel en historie, geen andermans diensten, alleen eigen aanvoerdersteam en bevoegde teamleden toewijzen. Alleen lokale testgegevens.');
 // Hold the actual navigation response to verify feedback before it arrives.
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/diensten?*',async route=>{await gate;await route.continue();});
 await page.getByRole('navigation',{name:'Hoofdnavigatie'}).getByRole('link',{name:'Open diensten',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Pagina laden'}).first().waitFor({timeout:1000});
 release();await page.waitForURL('**/diensten');await page.getByRole('heading',{name:'Open diensten',exact:true}).waitFor();
 await page.goto(base+'/wedstrijden');await page.getByRole('heading',{name:'Wedstrijden',exact:true}).waitFor();
 // Combine all four match filters as a member, including an away match,
 // repeated venue names and a UTC timestamp belonging to the next Dutch day.
 const selectedTeam="Testclub/Keistad DS 1 & Sponsor '26",selectedDay='2090-06-02';
 const chosen={...testMatch,id:'71000000-0000-4000-8000-000000000001',home_team:'Andere testclub DS 1',away_team:selectedTeam,starts_at:'2090-06-01T22:30:00Z',location:'Testhal',city:'Teststad'};
 matchFilterFixtures=[chosen,
  {...chosen,id:'71000000-0000-4000-8000-000000000002',status:'cancelled'},
  {...chosen,id:'71000000-0000-4000-8000-000000000003',city:'Andere teststad'},
  {...chosen,id:'71000000-0000-4000-8000-000000000004',away_team:'Testclub DS 10'},
  {...chosen,id:'71000000-0000-4000-8000-000000000005',starts_at:'2090-06-02T22:30:00Z'},
 ];
 await page.goto(base+'/wedstrijden?view=all');
 const filterForm=page.getByRole('form',{name:'Wedstrijden filteren'}),rows=page.getByRole('region',{name:'Wedstrijdprogramma'}).locator('tbody tr');
 await filterForm.getByLabel('Dag',{exact:true}).fill(selectedDay);
 await filterForm.getByLabel('Team',{exact:true}).selectOption(selectedTeam);
 await filterForm.getByLabel('Locatie',{exact:true}).selectOption({label:'Testhal · Teststad'});
 await filterForm.getByLabel('Status',{exact:true}).selectOption('scheduled');
 await filterForm.getByRole('button',{name:'Filteren',exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get('team')===selectedTeam && url.searchParams.get('day')===selectedDay);
 await page.getByRole('status').filter({hasText:/^1 wedstrijd/}).waitFor();assert.equal(await rows.count(),1);
 assert.equal(await filterForm.getByLabel('Team',{exact:true}).inputValue(),selectedTeam);
 await page.reload();await page.getByRole('status').filter({hasText:/^1 wedstrijd/}).waitFor();
 assert.equal(await rows.count(),1);assert.equal(await filterForm.getByLabel('Dag',{exact:true}).inputValue(),selectedDay);
 await filterForm.getByLabel('Status',{exact:true}).selectOption('played');
 await filterForm.getByRole('button',{name:'Filteren',exact:true}).click();
 await page.getByText('Geen wedstrijden in deze selectie.',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Historie',exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get('view')==='history');
 assert.equal(new URL(page.url()).searchParams.get('team'),selectedTeam);
 await page.getByRole('link',{name:'Filters wissen',exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get('view')==='history' && !url.searchParams.has('team'));
 await page.waitForLoadState('networkidle');
 assert.equal(await filterForm.getByLabel('Dag',{exact:true}).inputValue(),'');
 // Filtering happens before display pagination, including beyond row 1000.
 matchFilterFixtures=Array.from({length:1051},(_,index)=>({...chosen,id:'local-filter-match-'+index,home_team:index<51?selectedTeam:'Ander team DS 1',away_team:index<51?'Tegenstander DS 1':selectedTeam}));
 await page.goto(base+'/wedstrijden?'+new URLSearchParams({view:'all',day:selectedDay,team:selectedTeam,location:JSON.stringify(['Testhal','Teststad']),status:'scheduled'}));
 await page.getByRole('status').filter({hasText:/^1051 wedstrijden/}).waitFor();assert.equal(await rows.count(),50);
 await page.getByRole('link',{name:'Volgende',exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get('page')==='2');
 await page.getByText('Pagina 2 van 22',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).searchParams.get('team'),selectedTeam);assert.equal(new URL(page.url()).searchParams.get('day'),selectedDay);
 assert.equal(new URL(page.url()).searchParams.get('location'),JSON.stringify(['Testhal','Teststad']));assert.equal(new URL(page.url()).searchParams.get('status'),'scheduled');
 await filterForm.getByLabel('Team',{exact:true}).selectOption('Ander team DS 1');
 await filterForm.getByRole('button',{name:'Filteren',exact:true}).click();
 await page.getByRole('status').filter({hasText:/^1000 wedstrijden/}).waitFor();assert.equal(new URL(page.url()).searchParams.has('page'),false);
 assert.equal(await rows.count(),50);
 await page.getByRole('link',{name:'Filters wissen',exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get('view')==='all' && !url.searchParams.has('team'));
 matchFilterFixtures=null;
 console.log('Wedstrijdfilters geslaagd: dag in Nederlandse tijd, thuis-/uitteam, locatie/plaats en status combineren, nulresultaat, bewaren/herladen, tabs, wissen en paginering over 1051 bronregels. Alleen lokale testgegevens.');
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
 assert.equal(await page.getByRole('switch',{name:'Beheermodus'}).count(),0,'Members do not get a management switch');
 assert.equal(await adminPage.getByRole('link',{name:'Beheer',exact:true}).count(),0);
 const modeSwitch=adminPage.getByRole('switch',{name:'Beheermodus'});
 assert.equal(await modeSwitch.getAttribute('aria-checked'),'false');
 await modeSwitch.click();await adminPage.waitForURL(base+'/beheer');
 await adminPage.getByRole('heading',{name:'Beheerdashboard',exact:true}).waitFor();
 assert.equal(await modeSwitch.getAttribute('aria-checked'),'true');
 const managementNav=adminPage.getByRole('navigation',{name:'Beheernavigatie'});
 assert.deepEqual(await managementNav.getByRole('link').allTextContents(),['Dashboard','Leden','Teams','Planning','Wedstrijden','Functies','Rapportage','Seizoenen','Instellingen']);
 assert.equal(await managementNav.getByRole('link',{name:'Dashboard',exact:true}).getAttribute('aria-current'),'page');
 await adminPage.reload();assert.equal(await modeSwitch.getAttribute('aria-checked'),'true');
 await modeSwitch.click();await adminPage.waitForURL(base+'/');
 await adminPage.getByRole('heading',{name:'Mijn overzicht',exact:true}).waitFor();
 await adminPage.goBack();await adminPage.waitForURL(base+'/beheer');
 assert.equal(await modeSwitch.getAttribute('aria-checked'),'true');
 // Managers see all operational sections while invitations remain admin-only.
 adminRole='manager';await adminPage.goto(base+'/beheer/leden');
 await adminPage.getByRole('heading',{name:'Leden',exact:true}).waitFor();
 assert.equal(await adminPage.getByRole('button',{name:'Uitnodiging versturen',exact:true}).count(),0);
 assert.equal(await modeSwitch.count(),1);
 adminRole='admin';await adminPage.reload();
 await adminPage.getByRole('button',{name:'Uitnodiging versturen',exact:true}).waitFor();
 // Roster selection opens the actual member editor; name search is functional.
 await adminPage.getByRole('link',{name:'Instellen voor Bram Test',exact:true}).click();
 await adminPage.waitForURL(url=>url.searchParams.get('member')===memberB);
 assert.equal(await adminPage.locator('#lidinstellen select[name=member_id]').inputValue(),memberB);
 await adminPage.getByLabel('Zoeken op naam of e-mail').fill('Anna');
 await adminPage.getByRole('button',{name:'Filteren',exact:true}).click();
 await adminPage.getByText('1 gevonden',{exact:true}).waitFor();
 assert.equal(await adminPage.getByRole('region',{name:'Ledenoverzicht'}).getByRole('row').count(),2);
 console.log('Beheeromgeving: toggle, URL/herladen/terug, negen menuonderdelen, manager/admin-grenzen, ledenzoekfunctie en lidselectie geslaagd. Alleen lokale testgegevens.');
 // Season creation/editing must have separate identities and keep unsaved input
 // on a server rejection; activation is explicit and cancellable.
 await adminPage.getByRole('navigation',{name:'Beheernavigatie'}).getByRole('link',{name:'Seizoenen',exact:true}).click();
 await adminPage.getByRole('heading',{name:'Seizoenen',exact:true}).waitFor();
 await adminPage.getByLabel('Seizoensnaam',{exact:true}).fill('Testseizoen bewerkt');
 await adminPage.getByLabel('Begindatum',{exact:true}).fill('2026-01-02');
 await adminPage.getByLabel('Einddatum',{exact:true}).fill('2025-12-31');
 await adminPage.getByRole('button',{name:'Wijzigingen opslaan'}).click();
 await adminPage.getByRole('alert').filter({hasText:'Controleer de gemarkeerde velden'}).waitFor();
 assert.equal(await adminPage.getByLabel('Einddatum',{exact:true}).getAttribute('aria-invalid'),'true');
 assert.equal(await adminPage.getByLabel('Einddatum',{exact:true}).evaluate(el=>el===document.activeElement),true);
 assert.equal(await adminPage.getByLabel('Seizoensnaam',{exact:true}).inputValue(),'Testseizoen bewerkt');
 await adminPage.getByLabel('Einddatum',{exact:true}).fill('2027-12-30');
 await adminPage.getByLabel('Algemene puntennorm',{exact:true}).fill('24');
 await adminPage.getByLabel('Puntennorm jeugd',{exact:true}).fill('');
 await adminPage.getByLabel('Puntennorm senioren',{exact:true}).fill('0');
 seasonSaveFailure=true;
 await adminPage.getByRole('button',{name:'Wijzigingen opslaan'}).click();
 await adminPage.getByRole('alert').filter({hasText:'Er bestaat al een seizoen'}).waitFor();
 assert.equal(await adminPage.getByLabel('Seizoensnaam',{exact:true}).inputValue(),'Testseizoen bewerkt');
 seasonSaveFailure=false;
 await adminPage.getByRole('button',{name:'Wijzigingen opslaan'}).click();
 await adminPage.getByRole('status').filter({hasText:'Seizoen bijgewerkt.'}).waitFor();
 assert.equal(testSeasons.length,1);assert.equal(testSeasons[0].id,season);assert.equal(testSeasons[0].name,'Testseizoen bewerkt');
 assert.equal(testSeasons[0].starts_on,'2026-01-02');assert.equal(testSeasons[0].ends_on,'2027-12-30');
 assert.equal(testSeasons[0].youth_norm,null);assert.equal(testSeasons[0].senior_norm,0);
 await adminPage.reload();assert.equal(await adminPage.getByLabel('Seizoensnaam',{exact:true}).inputValue(),'Testseizoen bewerkt');
 await adminPage.getByRole('link',{name:'Nieuw seizoen',exact:true}).click();
 await adminPage.getByRole('heading',{name:'Nieuw seizoen aanmaken',exact:true}).waitFor();
 assert.equal(await adminPage.getByLabel('Begindatum',{exact:true}).inputValue(),'2027-01-02');
 assert.equal(await adminPage.getByLabel('Algemene puntennorm',{exact:true}).inputValue(),'24');
 await adminPage.getByLabel('Seizoensnaam',{exact:true}).fill('2028/2029');
 await adminPage.getByLabel('Begindatum',{exact:true}).fill('2028-08-01');
 await adminPage.getByLabel('Einddatum',{exact:true}).fill('2029-07-31');
 await adminPage.getByRole('button',{name:'Seizoen aanmaken',exact:true}).click();
 await adminPage.getByRole('status').filter({hasText:'Seizoen aangemaakt.'}).waitFor();
 assert.equal(testSeasons.length,2);assert.equal(testSeasons[0].active,true);assert.equal(testSeasons[1].active,false);
 const nextSeasonRow=adminPage.getByRole('row').filter({hasText:'2028/2029'});
 await nextSeasonRow.getByRole('button',{name:'Activeren',exact:true}).click();
 const activationDialog=adminPage.getByRole('dialog',{name:'Actie bevestigen'});
 await activationDialog.waitFor();await activationDialog.getByRole('button',{name:'Annuleren',exact:true}).click();
 assert.equal(authWrites.filter(r=>r.path.endsWith('/activate_season')).length,0);
 await nextSeasonRow.getByRole('button',{name:'Activeren',exact:true}).click();
 await activationDialog.getByRole('button',{name:'Bevestigen',exact:true}).click();
 await adminPage.getByRole('status').filter({hasText:'Actief seizoen gewijzigd.'}).waitFor();
 assert.equal(testSeasons[0].active,false);assert.equal(testSeasons[1].active,true);
 assert.equal(await adminPage.locator('.season-label').innerText(),'2028/2029');
 // First use needs no invented club calendar; its first season becomes active.
 testSeasons=[];await adminPage.goto(base+'/beheer/seizoenen?new=1');
 assert.equal(await adminPage.getByLabel('Algemene puntennorm',{exact:true}).inputValue(),'');
 await adminPage.getByLabel('Seizoensnaam',{exact:true}).fill('Eerste testseizoen');
 await adminPage.getByLabel('Begindatum',{exact:true}).fill('2026-08-01');
 await adminPage.getByLabel('Einddatum',{exact:true}).fill('2027-07-31');
 await adminPage.getByLabel('Algemene puntennorm',{exact:true}).fill('20');
 await adminPage.getByRole('button',{name:'Seizoen aanmaken',exact:true}).click();
 await adminPage.getByRole('status').filter({hasText:'Seizoen aangemaakt.'}).waitFor();assert.equal(testSeasons[0].active,true);
 testSeasons=[{...initialSeason}];seasonMigrationMissing=true;
 await adminPage.goto(base+'/beheer/seizoenen');
 await adminPage.getByRole('alert').filter({hasText:'004_season_management.sql'}).waitFor();
 assert.equal(await adminPage.getByRole('button',{name:'Wijzigingen opslaan'}).count(),0);
 seasonMigrationMissing=false;
 await page.goto(base+'/beheer/seizoenen');await page.waitForURL(base+'/');
 assert.equal(await page.getByRole('heading',{name:'Seizoenen',exact:true}).count(),0);
 console.log('Seizoenenbeheer geslaagd: eerste/volgende aanmaken, voorstel, naam/periode/normen opslaan, invoerbehoud en veldfocus bij fouten, expliciete activatie/annulering, ledenafscherming en ontbrekende migratie. Alleen lokale testgegevens.');
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
 await adminPage.waitForURL('**/profiel?password=1');
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
 await adminPage.waitForURL('**/profiel?password=1');await adminPage.getByRole('heading',{name:'Wachtwoord instellen',exact:true}).waitFor();
 await adminPage.goto(base+'/beheer/instellingen/huisstijl');
 await adminPage.getByRole('heading',{name:'Huisstijl',exact:true}).waitFor();
 // Identity, three independent colours, raster logo, save/reload and public login.
 const saveIdentity=async()=>{
  assert.equal(await adminPage.getByRole('button',{name:'Huisstijl opslaan'}).isDisabled(),false,'Save should be enabled: '+await adminPage.locator('.stack-form').first().innerText());
  const invalid=await adminPage.getByRole('button',{name:'Huisstijl opslaan'}).locator('xpath=ancestor::form').evaluate(form=>Array.from(form.elements).filter(el=>el.willValidate&&!el.validity.valid).map(el=>({name:el.name,value:el.value,message:el.validationMessage})));assert.deepEqual(invalid,[]);
  await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/instellingen/huisstijl'),adminPage.getByRole('button',{name:'Huisstijl opslaan'}).click()]);
  await adminPage.locator('main form button[aria-busy="false"]').waitFor();
  await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();await adminPage.waitForLoadState('networkidle');
 };
 assert.equal(await adminPage.getByRole('button',{name:'Huisstijl opslaan'}).isDisabled(),true);
 await adminPage.getByLabel('Verenigingsnaam',{exact:true}).fill('Lokale testvereniging');
 await adminPage.getByLabel('Verenigingslogo',{exact:true}).setInputFiles({name:'onveilig.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await adminPage.getByRole('alert').filter({hasText:'Kies een PNG-'}).waitFor();
 assert.equal(await adminPage.getByRole('button',{name:'Huisstijl opslaan'}).isDisabled(),true);
 await adminPage.getByLabel('Verenigingslogo',{exact:true}).setInputFiles({name:'testlogo.png',mimeType:'image/png',buffer:logoBytes});
 await adminPage.locator('.branding-preview .club-logo').waitFor();
 await adminPage.getByLabel('Primaire kleur',{exact:true}).fill('#334455');
 await adminPage.getByLabel('Secundaire kleur',{exact:true}).fill('#7250A0');
 await adminPage.getByLabel('Accentkleur',{exact:true}).fill('#FFFFFF');
 assert.equal(await adminPage.locator('.branding-preview').evaluate(el=>getComputedStyle(el).getPropertyValue('--on-accent').trim()),'#000000');
 assert.equal(await adminPage.locator('.branding-preview').evaluate(el=>getComputedStyle(el).getPropertyValue('--brand-primary').trim()),'#334455');
 await adminPage.getByLabel('Accentkleur',{exact:true}).fill('#c04c18');
 await saveIdentity();assert.equal(await adminPage.getByRole('button',{name:'Huisstijl opslaan'}).isDisabled(),true,'Saved lowercase HEX values are clean');
 assert.equal(brand.primary_color,'#334455');assert.equal(brand.accent_color,'#C04C18');assert.equal(brand.club_name,'Lokale testvereniging');assert.ok(brand.logo_data.startsWith('data:image/png;base64,'));
 await adminPage.reload();await adminPage.getByRole('heading',{name:'Huisstijl',exact:true}).waitFor();
 assert.equal(await adminPage.getByLabel('Primaire kleur',{exact:true}).inputValue(),'#334455');
 assert.equal(await adminPage.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--brand-primary').trim()),'#334455');
 assert.match(await adminPage.locator('.brand').innerText(),/^Lokale testvereniging/);
 assert.equal(await adminPage.locator('.brand .club-logo').getAttribute('src'),brand.logo_data);
 const publicPage=await browser.newPage();await publicPage.goto(base+'/login');
 assert.match(await publicPage.locator('.auth-brand').innerText(),/^Lokale testvereniging/);assert.equal(await publicPage.title(),'Lokale testvereniging · Vrijwilligers');
 assert.equal(await publicPage.locator('.auth-brand .club-logo').getAttribute('src'),brand.logo_data);await publicPage.close();
 if(process.env.SCREENSHOT_DIR) for(const width of [390,1440]) {await adminPage.setViewportSize({width,height:950});assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await adminPage.screenshot({path:`${process.env.SCREENSHOT_DIR}/huisstijl-aangepast-${width}.png`,fullPage:true});}
 await adminPage.setViewportSize({width:1280,height:950});
 await adminPage.getByLabel('Accentkleur',{exact:true}).fill('#bad');assert.equal(await adminPage.getByRole('button',{name:'Huisstijl opslaan'}).isDisabled(),true);
 await adminPage.getByRole('button',{name:'Standaardkleuren herstellen'}).click();
 assert.equal(await adminPage.getByLabel('Verenigingsnaam',{exact:true}).inputValue(),'Lokale testvereniging');
 assert.equal(await adminPage.locator('.branding-preview .club-logo').getAttribute('src'),brand.logo_data);
 await saveIdentity();assert.equal(brand.primary_color,'#087D56');assert.equal(brand.accent_color,'#087D56');
 // Restore fixture identity; a missing 007 keeps the older two-colour editor working.
 await adminPage.getByLabel('Verenigingsnaam',{exact:true}).fill('AVV Keistad');await adminPage.getByRole('button',{name:'Logo verwijderen'}).click();
 identityMigrationMissing=true;await saveIdentity();
 await adminPage.getByRole('alert').filter({hasText:'De database-API levert nog alleen de oude kleurvelden'}).waitFor();
 assert.equal(await adminPage.getByLabel('Verenigingsnaam',{exact:true}).isDisabled(),true);
 assert.equal(await adminPage.getByLabel('Accentkleur',{exact:true}).isDisabled(),true);
 await adminPage.getByLabel('Primaire kleur',{exact:true}).fill('#123456');
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/beheer/instellingen/huisstijl'),adminPage.getByRole('button',{name:'Kleuren opslaan'}).click()]);await adminPage.locator('main form button[aria-busy="false"]').waitFor();await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 await adminPage.waitForLoadState('networkidle');assert.equal(brand.primary_color,'#123456');
 // SQL 007 applied while an older public response is cached: a reload is enough.
 identityMigrationMissing=false;await adminPage.reload();await adminPage.getByRole('heading',{name:'Huisstijl',exact:true}).waitFor();
 assert.equal(await adminPage.getByLabel('Verenigingsnaam',{exact:true}).isDisabled(),false);
 assert.equal(await adminPage.getByLabel('Accentkleur',{exact:true}).isDisabled(),false);
 await adminPage.getByRole('button',{name:'Standaardkleuren herstellen'}).click();await saveIdentity();
 // An unavailable public read must not lock the authenticated editor.
 publicBrandingFailure=true;await adminPage.getByLabel('Verenigingsnaam',{exact:true}).fill('Testclub via sessie');await saveIdentity();
 await adminPage.reload();assert.equal(await adminPage.getByLabel('Verenigingsnaam',{exact:true}).inputValue(),'Testclub via sessie');assert.match(await adminPage.locator('.brand .club-identity-text').innerText(),/^Testclub via sessie/);
 assert.equal(await adminPage.getByLabel('Verenigingsnaam',{exact:true}).isDisabled(),false);
 assert.ok(records.some(r=>r.path==='/rest/v1/club_branding'&&r.authenticated));
 privateBrandingFailure=true;await adminPage.reload();await adminPage.getByRole('alert').filter({hasText:'De huisstijl kon nu niet worden opgehaald'}).waitFor();
 assert.equal(brand.club_name,'Testclub via sessie');
 privateBrandingFailure=false;publicBrandingFailure=false;await adminPage.getByRole('link',{name:'Opnieuw ophalen'}).click();
 await adminPage.getByRole('heading',{name:'Huisstijl',exact:true}).waitFor();assert.equal(await adminPage.getByLabel('Verenigingsnaam',{exact:true}).inputValue(),'Testclub via sessie');
 await adminPage.getByLabel('Verenigingsnaam',{exact:true}).fill('AVV Keistad');await saveIdentity();
 console.log('Huisstijlherstel geslaagd: verse sessielezing na migratie, publieke storing blokkeert beheer niet, tijdelijke databasefout toont herstelactie en behoudt opgeslagen gegevens. Alleen lokale testgegevens.');
 // All qualification selects use codes, including R2.2, and retain saved values.
 await adminPage.goto(base+'/beheer/leden');
 const memberForm=adminPage.getByRole('button',{name:'Lidinstellingen opslaan'}).locator('xpath=ancestor::form');
 const memberLevel=memberForm.getByLabel('Scheidsrechtersniveau',{exact:true});
 await memberLevel.waitFor();
 assert.deepEqual(await memberLevel.locator('option').allTextContents(),['Niet ingesteld',...refereeCodes]);
 await memberLevel.selectOption('R2.2');await memberForm.getByRole('button',{name:'Lidinstellingen opslaan'}).click();
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(refereeQualifications.get(memberA),'R2.2');
 await adminPage.reload();assert.equal(await memberForm.getByLabel('Scheidsrechtersniveau',{exact:true}).inputValue(),'R2.2');
 // Defaults are saved once, while existing services keep their own points.
 await adminPage.goto(base+'/beheer/instellingen');
 await adminPage.getByRole('link',{name:/Diensten Standaardpunten/}).click();
 await adminPage.getByLabel('Standaardpunten per fluitbeurt',{exact:true}).fill('3.25');
 await adminPage.getByRole('button',{name:'Punten opslaan',exact:true}).click();
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 await adminPage.reload();assert.equal(await adminPage.getByLabel('Standaardpunten per fluitbeurt',{exact:true}).inputValue(),'3.25');
 assert.equal(testDuty.points,2);
 await adminPage.goto(base+'/beheer/planning');
 const reservation=adminPage.getByRole('button',{name:'Team opslaan',exact:true}).locator('xpath=ancestor::form');
 await reservation.getByLabel('Toewijzen aan team',{exact:true}).selectOption(teamId);
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/beheer/planning'),reservation.getByRole('button',{name:'Team opslaan',exact:true}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 await adminPage.reload();assert.equal(await reservation.getByLabel('Toewijzen aan team',{exact:true}).inputValue(),teamId);
 if(process.env.SCREENSHOT_DIR) {
  for(const width of [390,1440]) {await adminPage.setViewportSize({width,height:950});await adminPage.screenshot({path:`${process.env.SCREENSHOT_DIR}/teamreservering-planning-${width}.png`,fullPage:true});}
  await adminPage.setViewportSize({width:1280,height:950});
 }
 await reservation.getByLabel('Toewijzen aan team',{exact:true}).selectOption('');
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/beheer/planning'),reservation.getByRole('button',{name:'Team opslaan',exact:true}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(testDuty.assigned_team_id,null);
 const generalDuty=adminPage.getByRole('button',{name:'Diensten aanmaken',exact:true}).locator('xpath=ancestor::form');
 const futureDate=new Date(Date.now()+86400000).toISOString().slice(0,10);
 await generalDuty.getByLabel('Titel',{exact:true}).fill('Lokale testfluitdienst');
 await generalDuty.locator('select[name="kind"]').selectOption('referee');
 await generalDuty.getByLabel('Locatie',{exact:true}).fill('Testhal');
 await generalDuty.getByLabel('Begint op',{exact:true}).fill(futureDate+'T18:00');
 await generalDuty.getByLabel('Eindigt op',{exact:true}).fill(futureDate+'T20:00');
 await generalDuty.getByLabel('Vereist scheidsrechtersniveau',{exact:true}).selectOption('V4');
 assert.equal(await generalDuty.evaluate(form=>form.reportValidity()),true);
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/planning'),generalDuty.getByRole('button',{name:'Diensten aanmaken',exact:true}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 const creation=authWrites.filter(r=>r.path.endsWith('/create_default_duty')).at(-1).body;
 assert.equal(creation.p_qualification,'V4');assert.equal(creation.p_points,undefined);
 assert.equal(await generalDuty.locator('input[name=points]').count(),0);
 dutySettingsMissing=true;await adminPage.goto(base+'/beheer/instellingen/diensten');
 await adminPage.getByText('Voer migratie 008_team_duties_and_referee_defaults.sql uit in de database van deze app.',{exact:true}).waitFor();
 assert.equal(await adminPage.getByRole('button',{name:'Punten opslaan',exact:true}).isDisabled(),true);
 dutySettingsMissing=false;
 // Team competition persists, and a match requirement is derived with no manual override.
 testTeams=[{id:teamId,name:'AVV Keistad HS 4',age_class:'senior',competition_level:'Derde klasse'}];
 await adminPage.goto(base+'/beheer/teams');
 await adminPage.getByRole('heading',{name:'Teams en niveaus',exact:true}).waitFor();
 const teamForm=adminPage.getByRole('button',{name:'Niveau opslaan',exact:true}).locator('xpath=ancestor::form');
 await teamForm.getByLabel('Competitieniveau',{exact:true}).selectOption('Superdivisie');
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/teams'),teamForm.getByRole('button',{name:'Niveau opslaan'}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 await adminPage.reload();assert.equal(await teamForm.getByLabel('Competitieniveau',{exact:true}).inputValue(),'Superdivisie');
 await adminPage.getByText('Senioren · Geen clubscheidsrechter nodig',{exact:true}).waitFor();
 testMatch.home_team='AVV Keistad HS 4';
 await adminPage.goto(base+'/beheer/wedstrijden?view=all');
 await adminPage.getByText('Geen clubscheidsrechter nodig',{exact:true}).waitFor();
 assert.equal(await adminPage.locator('summary').filter({hasText:/^Fluitdienst aanmaken$/}).count(),0);
 await adminPage.goto(base+'/beheer/teams');
 await teamForm.getByLabel('Competitieniveau',{exact:true}).selectOption('Eerste klasse');
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/teams'),teamForm.getByRole('button',{name:'Niveau opslaan'}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 await adminPage.getByText('Senioren · Minimaal V4',{exact:true}).waitFor();
 await adminPage.goto(base+'/beheer/wedstrijden?view=all');
 await adminPage.locator('summary').filter({hasText:/^Fluitdienst aanmaken$/}).click();
 const matchDuty=adminPage.getByRole('button',{name:'Fluitdienst aanmaken',exact:true}).locator('xpath=ancestor::form');
 await matchDuty.getByText('Vereist scheidsrechtersniveau: V4 of hoger (automatisch).',{exact:true}).waitFor();
 assert.equal(await matchDuty.locator('select[name=qualification]').count(),0);
 assert.equal(await matchDuty.locator('input[name=points],input[name=minutes]').count(),0);
 await matchDuty.getByLabel('Toewijzen aan team',{exact:true}).selectOption(teamId);
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/wedstrijden'),matchDuty.getByRole('button',{name:'Fluitdienst aanmaken',exact:true}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.deepEqual(authWrites.filter(r=>r.path.endsWith('/create_team_match_duty')).at(-1).body,{p_match:testMatch.id,p_team:teamId});
 await adminPage.getByRole('link',{name:'Fluitdienst bekijken',exact:true}).waitFor();
 assert.equal(testMatch.referee_duties[0].points,3.25);
 if(process.env.SCREENSHOT_DIR) {
  for(const width of [390,1440]) {await adminPage.setViewportSize({width,height:950});await adminPage.screenshot({path:`${process.env.SCREENSHOT_DIR}/teamreservering-wedstrijd-${width}.png`,fullPage:true});}
  await adminPage.setViewportSize({width:1280,height:950});
 }
 const matchTeamForm=adminPage.getByRole('button',{name:'Team opslaan',exact:true}).locator('xpath=ancestor::form');
 await matchTeamForm.getByLabel('Toewijzen aan team',{exact:true}).selectOption('');
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/beheer/wedstrijden'),matchTeamForm.getByRole('button',{name:'Team opslaan',exact:true}).click()]);
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(testMatch.referee_duties[0].assigned_team_id,null);
 testMatch.referee_duties=[];testMatch.home_team='AVV Keistad HS 99';
 await adminPage.goto(base+'/beheer/wedstrijden?view=all');
 await adminPage.locator('summary').filter({hasText:/^Fluitdienst aanmaken$/}).click();
 await adminPage.getByText('Teamniveau ontbreekt. Controleer de teamlijst bij Beheer → Teams.',{exact:true}).waitFor();
 assert.equal(await adminPage.getByRole('button',{name:'Fluitdienst aanmaken',exact:true}).isDisabled(),true);
 testMatch.home_team='Test thuis';
 await page.goto(base+'/beheer/teams');await page.waitForURL(base+'/');
 console.log('Competitieregels browser: competitieniveau opslaan/herladen, geen clubdienst vanaf promotieklasse, automatisch V4 daaronder, geen handmatige verlaging, onbekend team geblokkeerd en ledenafscherming. Alleen lokale testgegevens.');
 // Management shows home teams, regardless of venue or caller-supplied filters.
 const homeBase={...testMatch,starts_at:'2090-06-02T12:00:00Z',home_team:'AVV Keistad MA 2',away_team:'Tegenstander MA 1',location:'Sportcomplex Amerena',city:'Amersfoort',status:'scheduled',cancelled:false};
 const awayBase={...homeBase,home_team:'Alleen uit-tegenstander MA 1',away_team:'AVV Keistad MA 2',location:'Alleen uit-locatie'};
 matchFilterFixtures=[
  ...Array.from({length:51},(_,index)=>({...awayBase,id:'scope-away-'+index,location:index===0?'Sportcomplex Amerena':awayBase.location})),
  ...Array.from({length:51},(_,index)=>({...homeBase,id:'scope-home-'+index})),
  {...homeBase,id:'scope-sponsor',home_team:'Proglass/AVV Keistad DS 2'},
  {...homeBase,id:'scope-internal',home_team:'AVV Keistad L3 8',away_team:'AVV Keistad L3 5'},
  {...homeBase,id:'scope-history',starts_at:'2020-06-02T12:00:00Z'},
  {...awayBase,id:'scope-away-history',starts_at:'2020-06-02T12:00:00Z'},
  {...homeBase,id:'scope-cancelled',status:'cancelled'},
 ];
 const managedRows=adminPage.locator('.table-wrap tbody tr'),managedFilters=adminPage.getByRole('form',{name:'Wedstrijden filteren'});
 await adminPage.goto(base+'/beheer/wedstrijden?view=all');
 await adminPage.getByRole('status').filter({hasText:/^55 wedstrijden/}).waitFor();assert.equal(await managedRows.count(),50);
 assert.equal(await managedRows.getByText(awayBase.home_team,{exact:true}).count(),0);
 assert.ok(!(await managedFilters.getByLabel('Locatie',{exact:true}).locator('option').allTextContents()).some(text=>text.includes(awayBase.location)));
 assert.ok(!(await managedFilters.getByLabel('Team',{exact:true}).locator('option').allTextContents()).includes(awayBase.home_team));
 await adminPage.getByRole('link',{name:'Volgende',exact:true}).click();await adminPage.getByText('Pagina 2 van 2',{exact:true}).waitFor();assert.equal(await managedRows.count(),5);
 await managedRows.getByText('Proglass/AVV Keistad DS 2',{exact:true}).waitFor();await managedRows.getByText('AVV Keistad L3 8',{exact:true}).waitFor();
 await adminPage.getByRole('link',{name:'Historie',exact:true}).click();await adminPage.getByRole('status').filter({hasText:/^1 wedstrijd ·/}).waitFor();
 assert.equal(await managedRows.getByText(awayBase.home_team,{exact:true}).count(),0);
 await adminPage.goto(base+'/beheer/wedstrijden?view=all&status=cancelled');await adminPage.getByRole('status').filter({hasText:/^1 wedstrijd ·/}).waitFor();
 await adminPage.goto(base+'/beheer/wedstrijden?view=all&match=scope-away-0');await adminPage.getByText('Geen wedstrijden in deze selectie.',{exact:true}).waitFor();
 await adminPage.goto(base+'/beheer/wedstrijden?view=all&team='+encodeURIComponent(awayBase.home_team));await adminPage.getByText('Geen wedstrijden in deze selectie.',{exact:true}).waitFor();
 // Clearing filters and manager access cannot bring an away match back.
 await adminPage.getByRole('link',{name:'Filters wissen',exact:true}).click();await adminPage.getByRole('status').filter({hasText:/^55 wedstrijden/}).waitFor();
 adminRole='manager';await adminPage.goto(base+'/beheer/wedstrijden');await adminPage.getByRole('status').filter({hasText:/^54 wedstrijden/}).waitFor();adminRole='admin';
 await page.goto(base+'/wedstrijden?view=all&match=scope-away-0');await page.locator('.table-wrap tbody').getByText(awayBase.home_team,{exact:true}).waitFor();
 await adminPage.setViewportSize({width:390,height:844});await adminPage.goto(base+'/beheer/wedstrijden?view=all');
 assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await adminPage.setViewportSize({width:1280,height:950});matchFilterFixtures=null;
 console.log('Thuiswedstrijdbeheer geslaagd: sponsor/interne teams, thuisteam ongeacht locatie, alle tabs, filters/wissen, directe wedstrijd-ID, aantallen/paginering, manager en mobiel. Volledig bronprogramma behouden. Alleen lokale testgegevens.');
 // The member view compares the new codes rather than old numbers.
 hideTestEnrollment=true;testDuty.kind='referee';testDuty.required_qualification='N3';testDuty.required_level=6;
 await page.goto(base+'/diensten');
 await page.getByText('Er zijn nu geen passende open diensten.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Inschrijven',exact:true}).count(),0);
 await adminPage.goto(base+'/beheer/planning');
 const requirementForm=adminPage.getByRole('button',{name:'Niveau opslaan'}).locator('xpath=ancestor::form');
 await requirementForm.getByLabel('Vereist niveau',{exact:true}).selectOption('R2.2');
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/planning'),requirementForm.getByRole('button',{name:'Niveau opslaan'}).click()]);await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(testDuty.required_qualification,'R2.2');
 await page.goto(base+'/diensten');assert.equal(await page.getByRole('button',{name:'Inschrijven',exact:true}).isDisabled(),false);
 if(process.env.SCREENSHOT_DIR) for(const width of [390,1440]) {await page.setViewportSize({width,height:950});await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/open-dienst-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1280,height:950});
 hideTestEnrollment=false;testDuty.kind='bar';testDuty.required_qualification=null;testDuty.required_level=0;
 console.log('Scheidsrechtersniveaus geslaagd: acht codes in opgegeven volgorde, R2.2 opslaan/herladen, bestaand dienstniveau aanpassen en blokkeren van te laag niveau. Alleen lokale testgegevens.');
 // A destructive action requires confirmation; dismissing does not submit.
 await adminPage.goto(base+'/beheer/planning');
 await adminPage.getByRole('button',{name:'Dienst annuleren',exact:true}).click();
 await adminPage.getByRole('dialog',{name:'Actie bevestigen'}).waitFor();
 await adminPage.getByRole('button',{name:'Annuleren',exact:true}).click();
 assert.equal(await adminPage.getByRole('dialog').count(),0);
 assert.equal(authWrites.filter(r=>r.path.endsWith('/cancel_duty')).length,0);
 await adminPage.getByRole('button',{name:'Dienst annuleren',exact:true}).click();
 await Promise.all([adminPage.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/beheer/planning'),adminPage.getByRole('button',{name:'Bevestigen',exact:true}).click()]);
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
 await adminPage.goto(base+'/beheer/wedstrijden?view=all');
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
 // Real source variants that previously stopped the entire import: club and
 // sponsor dashes, a prefixed cancellation, draft mini matches and summer time.
 refAssigned=false;
 programXml=await readFile(new URL('../tests/fixtures/nevobo-name-variants.rss',import.meta.url),'utf8');
 const variants=await syncRequest();assert.equal(variants.status,200);
 assert.equal((await variants.json()).counts.updated,7);
 const applied=authWrites.filter(r=>r.path.endsWith('/apply_nevobo_snapshot')).at(-1).body;
 assert.equal(applied.p_complete,true);assert.equal(applied.p_matches.length,7);
 assert.equal(applied.p_matches[0].home_team,'A.G.A.V.S. - Soesterberg MA 1');
 assert.equal(applied.p_matches.find(m=>m.external_id==='nevobo:2030783').status,'cancelled');
 assert.equal(applied.p_matches.find(m=>m.external_id==='nevobo:2084600').status,'missing');
 await adminPage.goto(base+'/beheer/wedstrijden?view=all');
 await adminPage.getByText('Geen wedstrijden in deze selectie.',{exact:true}).waitFor();
 await page.goto(base+'/wedstrijden?view=all');
 await page.getByRole('region',{name:'Wedstrijdprogramma'}).getByText('A.G.A.V.S. - Soesterberg MA 1',{exact:true}).waitFor();
 programXml=actualProgram;
 await adminPage.goto(base+'/beheer/wedstrijden?view=all');
 await adminPage.getByRole('button',{name:'Testmelding naar mij'}).click();
 await adminPage.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(sentEmails.length,2);assert.deepEqual(sentEmails[1].body.to,['admin@example.test']);
 assert.equal(additionalNotifications[0].member_id,admin);
 await adminPage.goto(base+'/meldingen');
 await adminPage.getByRole('heading',{name:/^Testmelding wedstrijdkoppeling(?:\s*Ongelezen)?$/}).waitFor();
 await page.goto(base+'/meldingen');
 assert.equal(await page.getByRole('heading',{name:/^Testmelding wedstrijdkoppeling(?:\s*Ongelezen)?$/}).count(),0);
 // Managers can inspect stored old/new values; members cannot open the log.
 await adminPage.goto(base+'/beheer/wedstrijden');
 await adminPage.getByRole('link',{name:'Wijzigingslog',exact:true}).click();
 await adminPage.getByRole('heading',{name:'Wijzigingslog',exact:true}).waitFor();
 await adminPage.getByRole('status').filter({hasText:/^2 wijzigingsmomenten/}).waitFor();
 const logArticles=adminPage.getByRole('article');assert.equal(await logArticles.count(),2);
 const movedArticle=logArticles.filter({hasText:'Wedstrijd gewijzigd'});
 await movedArticle.getByRole('cell',{name:'Oude testhal',exact:true}).waitFor();
 await movedArticle.getByRole('cell',{name:'Gewijzigde testhal',exact:true}).waitFor();
 const logForm=adminPage.getByRole('form',{name:'Wijzigingslog filteren'});
 await logForm.getByLabel('Soort wijziging',{exact:true}).selectOption('cancelled');
 await logForm.getByRole('button',{name:'Filteren',exact:true}).click();
 await adminPage.getByRole('status').filter({hasText:/^1 wijzigingsmoment /}).waitFor();
 assert.equal(await logArticles.count(),1);assert.equal(await movedArticle.count(),0);
 await adminPage.goto(base+'/beheer/wedstrijden/log?match=90000000-0000-4000-8000-000000000099');
 await adminPage.getByText('Nog geen wedstrijdwijzigingen in deze selectie.',{exact:true}).waitFor();
 testMatchEvents=Array.from({length:27},(_,index)=>({...initialMatchEvents[0],id:'local-history-event-'+index}));
 await adminPage.goto(base+'/beheer/wedstrijden/log?kind=moved');
 await adminPage.getByRole('status').filter({hasText:/^27 wijzigingsmomenten/}).waitFor();assert.equal(await logArticles.count(),25);
 await adminPage.getByRole('link',{name:'Volgende',exact:true}).click();
 await adminPage.getByText('Pagina 2 van 2',{exact:true}).waitFor();assert.equal(await logArticles.count(),2);
 assert.equal(new URL(adminPage.url()).searchParams.get('kind'),'moved');
 testMatchEvents=initialMatchEvents;historyUnavailable=true;
 await adminPage.goto(base+'/beheer/wedstrijden/log');
 await adminPage.getByRole('alert').filter({hasText:'Het wijzigingslog kon niet worden geladen'}).waitFor();
 historyUnavailable=false;
 await page.goto(base+'/wedstrijden/log');await page.waitForURL(base+'/');
 assert.equal(await page.getByRole('heading',{name:'Wijzigingslog',exact:true}).count(),0);
 console.log('Wijzigingslog geslaagd: oude/nieuwe waarden, filters, paginering over 27 wijzigingen, lege selectie, ontbrekende tabel en ledenafscherming. Alleen lokale testgegevens.');
 console.log('Nevobo-integratie geslaagd: echt aangeleverd RSS-item, beveiligde cronroute, handmatige sync, wijzigingsmail, idempotentie en behoud bij bronfout. RSS en Resend uitsluitend lokaal nagebootst.');
 const screenshots=process.env.SCREENSHOT_DIR;
 if(screenshots) await mkdir(screenshots,{recursive:true});
 for(const width of [320,390,768,1440]) {
   await adminPage.setViewportSize({width,height:950});
   for(const path of ['/','/diensten','/profiel','/mijn-diensten','/mijn-diensten?view=history','/beheer','/beheer/leden','/beheer/planning','/beheer/functies','/beheer/rapportage','/beheer/instellingen','/beheer/instellingen/diensten','/beheer/wedstrijden','/beheer/wedstrijden/log','/beheer/teams','/beheer/seizoenen','/beheer/seizoenen?new=1','/team','/wedstrijden','/wedstrijden/log','/meldingen','/beheer/instellingen/huisstijl','/login','/wachtwoord-vergeten']) {
     await adminPage.goto(base+path,{waitUntil:'networkidle'});
     assert.equal(await adminPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Horizontal overflow ${width} ${path}`);
     const largeCorners=await adminPage.locator('.panel,.button,input:not([type=checkbox]),select,.badge,.table-wrap,.duty-card,.nav-link').evaluateAll(els=>els.filter(el=>getComputedStyle(el).display!=='none'&&parseFloat(getComputedStyle(el).borderTopLeftRadius)>4).map(el=>el.className));
     assert.deepEqual(largeCorners,[],`Unexpected radius ${width} ${path}`);
     if(screenshots && ['/','/profiel','/mijn-diensten','/mijn-diensten?view=history','/beheer','/beheer/leden','/beheer/planning','/beheer/teams','/beheer/wedstrijden','/beheer/wedstrijden/log','/beheer/seizoenen','/beheer/instellingen/diensten','/beheer/instellingen/huisstijl'].includes(path)) await adminPage.screenshot({path:`${screenshots}/keistad-${path==='/'?'overzicht':path==='/profiel'?'profiel':path==='/mijn-diensten'?'mijn-diensten':path==='/mijn-diensten?view=history'?'mijn-historie':path==='/beheer'?'beheerdashboard':path==='/beheer/leden'?'leden':path==='/beheer/planning'?'planning':path==='/beheer/teams'?'teams':path==='/beheer/seizoenen'?'seizoenen':path==='/beheer/instellingen/diensten'?'dienstinstellingen':path==='/beheer/wedstrijden'?'wedstrijden':path==='/beheer/wedstrijden/log'?'wijzigingslog':'huisstijl'}-${width}.png`,fullPage:true});
   }
 }
 await adminPage.setViewportSize({width:390,height:844});await adminPage.goto(base+'/');
 await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).click();
 await adminPage.getByRole('dialog',{name:'Navigatie',exact:true}).waitFor();
 await adminPage.keyboard.press('Escape');
 assert.equal(await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).getAttribute('aria-expanded'),'false');
 await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).click();
 await adminPage.getByRole('navigation',{name:'Hoofdnavigatie'}).getByRole('link',{name:'Open diensten',exact:true}).click();
 await adminPage.waitForURL('**/diensten');
 assert.equal(await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).getAttribute('aria-expanded'),'false');
 await adminPage.setViewportSize({width:390,height:600});
 await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).click();
 await modeSwitch.click();await adminPage.waitForURL(base+'/beheer');
 assert.equal(await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).getAttribute('aria-expanded'),'false');
 await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).click();
 await adminPage.getByRole('dialog',{name:'Navigatie',exact:true}).waitFor();
 const switchBounds=await modeSwitch.boundingBox();assert.ok(switchBounds && switchBounds.y>=0 && switchBounds.y+switchBounds.height<=600,'Mobile switch remains visible');
 await adminPage.getByRole('navigation',{name:'Beheernavigatie'}).getByRole('link',{name:'Teams',exact:true}).click();
 await adminPage.waitForURL(base+'/beheer/teams');
 await adminPage.getByRole('button',{name:'Navigatiemenu openen'}).click();await modeSwitch.click();await adminPage.waitForURL(base+'/');
 // Real touch interactions, with a member and a manager session.
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await mobile.addCookies(await page.context().cookies());const touch=await mobile.newPage();touch.setDefaultTimeout(10000);
 const mobileDutyId='50000000-0000-4000-8000-000000000077';
 extraDuties=[{...testDuty,id:mobileDutyId,title:'Mobiele inschrijftest',kind:'bar',required_level:0,required_qualification:null,cancelled:false,signup_closed:false,starts_at:new Date(Date.now()+3*86400000).toISOString(),ends_at:new Date(Date.now()+3*86400000+7200000).toISOString()}];extraEnrollments=[];
 await touch.goto(base+'/');await touch.getByRole('heading',{name:'Mijn overzicht',exact:true}).waitFor();
 const quick=touch.getByRole('navigation',{name:'Mobiele hoofdnavigatie'});assert.equal(await quick.getByRole('link').count(),4);
 await quick.getByRole('link',{name:'Diensten',exact:true}).tap();await touch.waitForURL(base+'/diensten');
 await touch.getByRole('article').filter({hasText:'Mobiele inschrijftest'}).getByRole('button',{name:'Inschrijven',exact:true}).tap();
 await touch.waitForURL(url=>url.pathname==='/mijn-diensten'&&url.searchParams.has('success'));await touch.getByRole('heading',{name:'Mobiele inschrijftest',exact:true}).waitFor();
 await quick.getByRole('link',{name:'Profiel',exact:true}).tap();await touch.getByRole('heading',{name:'Mijn profiel',exact:true}).waitFor();
 await touch.getByRole('button',{name:'Navigatiemenu openen'}).tap();await touch.getByRole('dialog',{name:'Navigatie',exact:true}).waitFor();await touch.keyboard.press('Escape');
 assert.equal(await touch.getByRole('button',{name:'Navigatiemenu openen'}).getAttribute('aria-expanded'),'false');
 assert.equal(await touch.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.close();extraDuties=[];extraEnrollments=[];
 const mobileAdmin=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await mobileAdmin.addCookies(await adminPage.context().cookies());const manageTouch=await mobileAdmin.newPage();manageTouch.setDefaultTimeout(10000);
 await manageTouch.goto(base+'/beheer/leden');const mobileMembers=manageTouch.getByRole('region',{name:'Ledenoverzicht'});
 assert.equal(await mobileMembers.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 assert.equal(await mobileMembers.locator('.mobile-cell-label').first().isVisible(),true);
 await manageTouch.getByRole('button',{name:'Filters tonen',exact:true}).tap();await manageTouch.getByLabel('Zoeken op naam of e-mail').fill('Anna');
 assert.equal(await manageTouch.getByLabel('Zoeken op naam of e-mail').evaluate(el=>getComputedStyle(el).fontSize),'16px');
 await manageTouch.getByRole('button',{name:'Filteren',exact:true}).tap();await manageTouch.waitForURL(url=>url.searchParams.get('q')==='Anna');
 await mobileMembers.getByRole('link',{name:'Instellen voor Anna Test',exact:true}).waitFor();assert.equal(await mobileMembers.locator('tbody tr').count(),1);
 await mobileMembers.getByRole('link',{name:'Instellen voor Anna Test',exact:true}).tap();await manageTouch.waitForURL(url=>url.hash==='#lidinstellen');
 const inputBounds=await manageTouch.locator('#lidinstellen').boundingBox();assert.ok(inputBounds&&inputBounds.y>=60&&inputBounds.y<300,'Member editor anchor clears the sticky header');
 matchFilterFixtures=[{...testMatch,id:'70000000-0000-4000-8000-000000000077',home_team:'Proglass/AVV Keistad DS 2',away_team:'Lange tegenstander voor mobiele wedstrijdkaart DS 1',starts_at:new Date(Date.now()+2*86400000).toISOString(),status:'scheduled',cancelled:false,location:'Sportcomplex Amerena',city:'Amersfoort'}];
 await manageTouch.goto(base+'/beheer/wedstrijden');const mobileMatches=manageTouch.getByRole('region',{name:'Wedstrijdprogramma'});
 assert.equal(await mobileMatches.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await mobileMatches.getByText('Proglass/AVV Keistad DS 2',{exact:true}).waitFor();
 await manageTouch.getByRole('button',{name:'Filters tonen',exact:true}).tap();await manageTouch.getByLabel('Status',{exact:true}).selectOption('scheduled');
 await manageTouch.getByRole('button',{name:'Filteren',exact:true}).tap();await manageTouch.waitForURL(url=>url.searchParams.get('status')==='scheduled');
 // Team assignment and default-based match creation also work through touch.
 const previousMatch={...testMatch},wasCancelled=testDuty.cancelled;
 testDuty.cancelled=false;
 await manageTouch.goto(base+'/beheer/planning');
 const touchTeam=manageTouch.getByRole('button',{name:'Team opslaan',exact:true}).first().locator('xpath=ancestor::form');
 await touchTeam.getByLabel('Toewijzen aan team',{exact:true}).selectOption(teamId);
 await Promise.all([manageTouch.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/beheer/planning'),touchTeam.getByRole('button',{name:'Team opslaan',exact:true}).tap()]);
 await manageTouch.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();assert.equal(testDuty.assigned_team_id,teamId);
 await manageTouch.goto(base+'/beheer/instellingen/diensten');
 await manageTouch.getByLabel('Standaardpunten per fluitbeurt',{exact:true}).fill('3.5');
 await manageTouch.getByRole('button',{name:'Punten opslaan',exact:true}).tap();
 await manageTouch.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 await manageTouch.reload();assert.equal(await manageTouch.getByLabel('Standaardpunten per fluitbeurt',{exact:true}).inputValue(),'3.5');
 matchFilterFixtures=null;Object.assign(testMatch,{home_team:'AVV Keistad HS 4',away_team:'Andere testclub HS 1',starts_at:new Date(Date.now()+2*86400000).toISOString(),status:'scheduled',cancelled:false,referee_duties:[]});
 await manageTouch.goto(base+'/beheer/wedstrijden');
 await manageTouch.locator('summary').filter({hasText:/^Fluitdienst aanmaken$/}).tap();
 const touchMatch=manageTouch.getByRole('button',{name:'Fluitdienst aanmaken',exact:true}).locator('xpath=ancestor::form');
 assert.equal(await touchMatch.locator('input[name=points],input[name=minutes]').count(),0);
 await touchMatch.getByLabel('Toewijzen aan team',{exact:true}).selectOption(teamId);
 await Promise.all([manageTouch.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/beheer/wedstrijden'),touchMatch.getByRole('button',{name:'Fluitdienst aanmaken',exact:true}).tap()]);
 await manageTouch.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 assert.equal(testMatch.referee_duties[0].points,3.5);assert.equal(testMatch.referee_duties[0].assigned_team_id,teamId);
 assert.equal(await manageTouch.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(screenshots) await manageTouch.screenshot({path:`${screenshots}/teamreservering-touch-390.png`,fullPage:true});
 Object.assign(testMatch,previousMatch);testDuty.cancelled=wasCancelled;testDuty.assigned_team_id=null;
 await manageTouch.goto(base+'/beheer/instellingen/huisstijl');const accentBefore=brand.accent_color;await manageTouch.getByLabel('Accentkleur',{exact:true}).fill('#123456');
 const saveOnPhone=manageTouch.getByRole('button',{name:'Huisstijl opslaan',exact:true});await saveOnPhone.scrollIntoViewIfNeeded();const saveBounds=await saveOnPhone.boundingBox(),barBounds=await manageTouch.locator('.mobile-navigation').boundingBox();
 assert.ok(saveBounds&&barBounds&&saveBounds.y+saveBounds.height<=barBounds.y,'Save remains above the bottom navigation');
 await saveOnPhone.tap();await manageTouch.locator('main form button[aria-busy="false"]').waitFor();await manageTouch.getByRole('status').filter({hasText:/^Opgeslagen$/}).waitFor();
 await manageTouch.reload();assert.equal(await manageTouch.getByLabel('Accentkleur',{exact:true}).inputValue(),'#123456');
 await manageTouch.getByLabel('Accentkleur',{exact:true}).fill(accentBefore);await manageTouch.getByRole('button',{name:'Huisstijl opslaan',exact:true}).tap();
 await manageTouch.locator('main form button[aria-busy="false"]').waitFor();await manageTouch.waitForLoadState('networkidle');
 if(screenshots) await manageTouch.screenshot({path:`${screenshots}/huisstijl-touch-390.png`,fullPage:true});
 await mobileAdmin.close();matchFilterFixtures=null;
 console.log('Mobiele bediening geslaagd: echte touchinschrijving, vaste hoofdnavigatie, menu/Escape, filterbediening, leden/wedstrijdkaarten zonder zijwaarts scrollen, 16px invoer, veilige ankers, teamtoewijzing, standaardpunten, wedstrijdfluitdienst zonder punten-/duurinvoer en huisstijl opslaan boven de onderbalk. Alleen lokale testgegevens.');
 console.log('Designcontrole geslaagd: huisstijlpreview, opslaan/herladen/reset, member-toegangsbeperking, bevestigingsdialoog, mobiele navigatie en overflow op 320/390/768/1440 px. Alleen testfixtures.');
 console.log('Auth-integratie geslaagd: admin inloggen/beheer, onjuiste credentials, herstelmail zonder accountonthulling, standaard- en token-hash-herstellinks, wachtwoord wijzigen en opnieuw inloggen met exacte wachtwoordtekens. Geen echte e-mails verstuurd.');
 console.log(`Performance-integratie geslaagd: dashboard 9 API-requests (${dashboard.ms}ms), wedstrijden 7 (${matches.ms}ms), elk met 150ms nagebootste API-latentie. Geen Auth HTTP-requests bij warme JWT-verificatie; gebruikersisolatie, redirects, formulier- en navigatiefeedback gecontroleerd. Geen productiemeting.`);
} finally {
 if(browser) await browser.close();app.kill('SIGTERM');mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));
}
