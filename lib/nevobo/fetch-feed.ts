import { NEVOBO_PROGRAM_URL } from './types';

/** Retrieves the exact club feed; interpretation belongs to the source adapter. */
export async function fetchNevoboProgram(fetcher:typeof fetch=fetch):Promise<string> {
 const signal=AbortSignal.timeout(15000);let url=NEVOBO_PROGRAM_URL;
 for(let redirects=0;redirects<4;redirects++) {
  let response:Response;
  try {response=await fetcher(url,{cache:'no-store',redirect:'manual',headers:{Accept:'application/rss+xml, application/xml, text/xml'},signal});}
  catch {throw new Error('nevobo_feed_unreachable');}
  if([301,302,303,307,308].includes(response.status)) {
   const location=response.headers.get('location');if(!location) throw new Error('nevobo_invalid_redirect');
   const next=new URL(location,url);
   if(next.protocol!=='https:' || next.hostname!=='api.nevobo.nl') throw new Error('nevobo_invalid_redirect');
   url=next.href;continue;
  }
  if(!response.ok) throw new Error('nevobo_feed_http_error');
  if(Number(response.headers.get('content-length') ?? 0)>3*1024*1024) throw new Error('nevobo_feed_too_large');
  const reader=response.body?.getReader();if(!reader) throw new Error('nevobo_feed_empty');
  const chunks:Uint8Array[]=[];let size=0;
  try {
   while(true) {const {done,value}=await reader.read();if(done) break;size+=value.byteLength;if(size>3*1024*1024) {await reader.cancel();throw new Error('nevobo_feed_too_large');}chunks.push(value);}
  } catch(error) {if(error instanceof Error && error.message==='nevobo_feed_too_large') throw error;throw new Error('nevobo_feed_unreachable');}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(!xml.trim()) throw new Error('nevobo_feed_empty');
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('nevobo_unsupported_xml');
  if(!/<rss[\s>]/i.test(xml) || !/<channel[\s>]/i.test(xml)) throw new Error('nevobo_invalid_rss');
  return xml;
 }
 throw new Error('nevobo_invalid_redirect');
}
