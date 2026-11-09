import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseNevoboProgram } from '../lib/nevobo/parse-feed';
const fixture=()=>readFile(new URL('./fixtures/nevobo-program.rss',import.meta.url),'utf8');

test('leest het echte door de gebruiker aangeleverde RSS-item inclusief tijdzone en adres',async()=>{
  const snapshot=parseNevoboProgram(await fixture());
  assert.equal(snapshot.matches.length,1);assert.equal(snapshot.complete,true);
  const m=snapshot.matches[0];
  assert.equal(m.external_id,'nevobo:1964526');assert.equal(m.starts_at,'2026-11-14T13:30:00.000Z');
  assert.equal(m.home_team,'Proglass/AVV Keistad DS 2');
  assert.equal(m.away_team,"Lammerink Installatiegroep/Set-Up '65 DS 1");
  assert.equal(m.match_code,'9000TAD DB');assert.equal(m.location,'Sportcomplex Amerena');
  assert.equal(m.address,'De Velduil 2');assert.equal(m.postal_code,'3815XT');assert.equal(m.city,'Amersfoort');
  assert.equal(m.status,'scheduled');assert.equal(m.is_home,true);assert.equal(m.level,'');
});
test('wedstrijdidentiteit blijft gelijk bij verplaatsing; zomer- en wintertijd worden juist gelezen',async()=>{
  const xml=await fixture();const first=parseNevoboProgram(xml).matches[0];
  const moved=parseNevoboProgram(xml.replaceAll('14:30','15:30')).matches[0];
  assert.equal(moved.external_id,first.external_id);assert.equal(moved.starts_at,'2026-11-14T14:30:00.000Z');
  const summer=parseNevoboProgram(xml.replaceAll('14 november','14 juni').replaceAll('14 nov','14 jun').replace('Sat, 14 Nov','Sun, 14 Jun').replace('+0100','+0200')).matches[0];
  assert.equal(summer.starts_at,'2026-06-14T12:30:00.000Z');
});
test('bronstatus sluit gespeelde, afgelaste en onzekere wedstrijden zonder statussen te verzinnen',async()=>{
  const xml=await fixture();
  for(const [raw,status] of [['gespeeld','played'],['afgelast','cancelled'],['uitgesteld','postponed'],['onbekend','missing']]) {
    assert.equal(parseNevoboProgram(xml.replace('<nevobo:status>gepland','<nevobo:status>'+raw)).matches[0].status,status);
  }
  const postponed=xml.replace('<nevobo:status>gepland','<nevobo:status>uitgesteld').replace(/<pubDate>[^<]*<\/pubDate>/,'');
  assert.equal(parseNevoboProgram(postponed).matches[0].starts_at,null);
  assert.throws(()=>parseNevoboProgram(xml.replace(/<pubDate>[^<]*<\/pubDate>/,'')),/invalid_match_date/);
});
test('dubbele identieke items worden één wedstrijd; tegenstrijdige of defecte invoer wordt volledig geweigerd',async()=>{
  const xml=await fixture(),item=xml.match(/<item>[\s\S]*?<\/item>/)![0];
  assert.equal(parseNevoboProgram(xml.replace('</channel>',item+'</channel>')).matches.length,1);
  assert.throws(()=>parseNevoboProgram(xml.replace('</channel>',item.replaceAll('14:30','15:30')+'</channel>')),/duplicate_match_id/);
  assert.throws(()=>parseNevoboProgram(xml.replace('<guid>https://api.nevobo.nl/permalink/wedstrijd/1964526','<guid>https://api.nevobo.nl/permalink/wedstrijd/99999')),/invalid_match_identity/);
  assert.throws(()=>parseNevoboProgram(xml.replace('14 nov 14:30:','14 nov 16:30:')),/conflicting_match_date/);
  assert.throws(()=>parseNevoboProgram('<!DOCTYPE rss><rss><channel/></rss>'),/unsupported_xml/);
  assert.equal(parseNevoboProgram('<rss><channel><title>Programma</title></channel></rss>').complete,false);
});

test('een expliciete afgelasting blijft geldig als de bron geen betrouwbare nieuwe wedstrijddatum geeft',async()=>{
 const xml=(await fixture()).replace('<nevobo:status>gepland','<nevobo:status>afgelast').replace('Sat, 14 Nov 2026 14:30:00 +0100','Fri, 13 Nov 2026 10:00:00 +0100');
 const match=parseNevoboProgram(xml).matches[0];
 assert.equal(match.status,'cancelled');assert.equal(match.starts_at,null);assert.equal(match.external_id,'nevobo:1964526');
});

test('bewaart club- en sponsornamen met eigen streepjes uit de actuele Nevobo-feed',async()=>{
 const snapshot=parseNevoboProgram(await readFile(new URL('./fixtures/nevobo-name-variants.rss',import.meta.url),'utf8'));
 assert.equal(snapshot.complete,true);assert.equal(snapshot.matches.length,7);
 assert.equal(snapshot.publishedAt,'2026-11-09T13:02:07.000Z');
 const teams:Record<string,[string,string]>={
  '2026205':['A.G.A.V.S. - Soesterberg MA 1','AVV Keistad MA 2'],
  '2029483':['AVV Keistad MB 3','A.G.A.V.S. - Soesterberg MB 1'],
  '2017013':['AVV Keistad HS 5','Haarkliniek het Kale Balletje - USV Protos HS 3'],
  '2017044':['AVV Keistad HS 4','Van Wijk Vastgoedonderhoud - Volleer HS 1'],
  '2030783':['Gemini S XC 1','AVV Keistad MC 1'],
  '2084600':['AVV Keistad L2 2','Forza Hoogland L2 3'],
  '2017205':['Haarkliniek het Kale Balletje - USV Protos HS 3','AVV Keistad HS 5'],
 };
 for(const m of snapshot.matches) assert.deepEqual([m.home_team,m.away_team],teams[m.external_id.replace('nevobo:','')]);
 const cancelled=snapshot.matches.find(m=>m.external_id==='nevobo:2030783')!;
 assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.match_code,'3000XC2I1 BC');
 assert.equal(cancelled.starts_at,'2026-11-14T14:00:00.000Z');
 const draft=snapshot.matches.find(m=>m.external_id==='nevobo:2084600')!;
 assert.equal(draft.status,'missing');assert.equal(draft.starts_at,'2026-11-21T08:00:00.000Z');
 const summer=snapshot.matches.find(m=>m.external_id==='nevobo:2017205')!;
 assert.equal(summer.starts_at,'2027-04-03T09:00:00.000Z');
 assert.equal(summer.address,'De Uithof, Uppsalalaan 3');
});

test('onderscheidt teamgrenzen zonder eerste of laatste streepje blind te kiezen',async()=>{
 const xml=await fixture(),original="Proglass/AVV Keistad DS 2 - Lammerink Installatiegroep/Set-Up '65 DS 1";
 for(const separator of [' - ',' – ',' — ']) {
  const [m]=parseNevoboProgram(xml.replace(original,'Club - Sponsor L4 2'+separator+'Andere club - Sponsor L4 3')).matches;
  assert.equal(m.home_team,'Club - Sponsor L4 2');assert.equal(m.away_team,'Andere club - Sponsor L4 3');
 }
 for(const invalid of ['Club HS 1 - Tweede club HS 2 - Derde club HS 3','Club - Sponsor - Andere club','Club DS 1 - ',' - Club DS 1','Club zonder tegenstander']) {
  assert.throws(()=>parseNevoboProgram(xml.replace(original,invalid)),/invalid_match_title/);
 }
});
