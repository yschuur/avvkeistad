import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mailConfig,sendMatchEmail } from '../lib/nevobo/mail';
import { isCronAuthorized } from '../lib/nevobo/cron-auth';
import { canRegisterForMatch } from '../lib/nevobo/types';

test('wedstrijdinschrijving sluit bij aanvang en bij niet-bevestigde of geannuleerde planning',()=>{
 const now=new Date('2026-11-07T10:00:00Z');const m={starts_at:'2026-11-07T10:01:00Z',status:'scheduled'};
 assert.equal(canRegisterForMatch(m,now),true);
 for(const status of ['played','cancelled','postponed','missing']) assert.equal(canRegisterForMatch({...m,status},now),false);
 assert.equal(canRegisterForMatch({...m,starts_at:null},now),false);
 assert.equal(canRegisterForMatch({...m,starts_at:now.toISOString()},now),false);
});
test('cron vereist de exacte server-token; ontbrekende configuratie is geen toegang',()=>{
 assert.equal(isCronAuthorized(null,'test-secret'),false);assert.equal(isCronAuthorized('Bearer test-secret','test-secret'),true);
 assert.equal(isCronAuthorized('Bearer other','test-secret'),false);assert.equal(isCronAuthorized('Bearer test-secret',''),false);
});
test('wijzigingsmail heeft een stabiele idempotentiesleutel en bevat de werkelijke melding',async()=>{
 assert.equal(mailConfig({}),null);
 const config={key:'local-test-key',from:'club@example.test',siteUrl:'https://app.example.test'};
 const job={outbox_id:'test-outbox',claim:'test-claim',recipient:'referee@example.test',subject:'Wedstrijd gewijzigd',body:'Testwedstrijd. Nieuwe planning: 08-11-2026 14:00.',notification_id:'test-notification'};
 const calls:RequestInit[]=[];
 const fetcher:typeof fetch=async(_url,options)=>{calls.push(options!);return new Response(JSON.stringify({id:'local-provider-id'}),{status:200});};
 const result=await sendMatchEmail(job,config,fetcher);assert.deepEqual(result,{sent:true,providerId:'local-provider-id'});
 const headers=calls[0].headers as Record<string,string>;assert.equal(headers['Idempotency-Key'],'nevobo-test-notification');
 const payload=JSON.parse(String(calls[0].body));assert.match(payload.text,/08-11-2026 14:00/);assert.match(payload.text,/https:\/\/app.example.test\/meldingen/);
 assert.deepEqual(await sendMatchEmail(job,config,async()=>new Response('{}',{status:429})),{sent:false,code:'provider_http_429'});
});
