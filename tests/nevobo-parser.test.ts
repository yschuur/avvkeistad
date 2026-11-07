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
