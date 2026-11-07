import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchNevoboProgram } from '../lib/nevobo/fetch-feed';
import { NEVOBO_PROGRAM_URL } from '../lib/nevobo/types';

test('Nevobo transport haalt uitsluitend de opgegeven bron zonder cache op',async()=>{
 const xml='<?xml version="1.0"?><rss version="2.0"><channel><title>Transporttest</title></channel></rss>';
 const fetcher:typeof fetch=async(url,options)=>{
  assert.equal(url,NEVOBO_PROGRAM_URL);assert.equal(options?.cache,'no-store');assert.equal(options?.redirect,'manual');
  return new Response(xml,{status:200});
 };
 assert.equal(await fetchNevoboProgram(fetcher),xml);
});
test('Nevobo transport weigert HTML, XML-entiteiten, te grote invoer en redirects buiten de bron',async()=>{
 await assert.rejects(fetchNevoboProgram(async()=>new Response('<html>Server error</html>')),/invalid_rss/);
 await assert.rejects(fetchNevoboProgram(async()=>new Response('<!DOCTYPE rss><rss><channel/></rss>')),/unsupported_xml/);
 await assert.rejects(fetchNevoboProgram(async()=>new Response('',{headers:{'content-length':'4000000'}})),/too_large/);
 await assert.rejects(fetchNevoboProgram(async()=>new Response(null,{status:302,headers:{location:'https://example.test/feed'}})),/invalid_redirect/);
 await assert.rejects(fetchNevoboProgram(async()=>new Response('not authorized',{status:403})),/http_error/);
});
