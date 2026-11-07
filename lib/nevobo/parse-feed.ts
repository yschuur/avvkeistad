import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { importedMatch, type FeedSnapshot, type ImportedMatch, type MatchStatus } from './types';

const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:true,processEntities:false,isArray:name=>name==='item'});
const months:Record<string,number>={jan:1,januari:1,feb:2,februari:2,mrt:3,maart:3,apr:4,april:4,mei:5,jun:6,juni:6,jul:7,juli:7,aug:8,augustus:8,sep:9,sept:9,september:9,okt:10,oktober:10,nov:11,november:11,dec:12,december:12};
function nodeText(value:unknown):string {
 if(typeof value==='string'||typeof value==='number') return String(value);
 if(value && typeof value==='object' && '#text' in value) return nodeText(value['#text']);
 return '';
}
function entities(value:string) {
 const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
 return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(original,key:string)=>{
  if(!key.startsWith('#')) return named[key.toLowerCase()] ?? original;
  const n=key.toLowerCase().startsWith('#x')?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
  return n>0 && n<=0x10ffff && !(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):original;
 });
}
function plain(value:unknown) {
 return entities(nodeText(value).replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi,'\n').replace(/<[^>]*>/g,''))
  .split('\n').map(line=>line.replace(/[\t ]+/g,' ').trim()).filter(Boolean).join('\n').trim();
}
function fields(description:string):Record<string,string> {
 const markers=[...description.matchAll(/(?:^|[,\n])\s*([\p{L}][\p{L} /-]{1,40}):\s*/gu)];
 const result:Record<string,string>={};
 for(let i=0;i<markers.length;i++) {
  const marker=markers[i],start=marker.index!+marker[0].length,end=markers[i+1]?.index ?? description.length;
  result[marker[1].trim().toLowerCase()]=description.slice(start,end).trim().replace(/,$/,'');
 }
 return result;
}
function instant(value:unknown):string|null {
 const text=nodeText(value).trim();
 if(!text || !/(?:[+-]\d{4}|GMT|UTC)\s*$/i.test(text)) return null;
 const timestamp=Date.parse(text);return Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;
}
function sourceId(guid:unknown,link:unknown) {
 const ids:string[]=[];let sourceUrl:string|null=null;
 for(const value of [guid,link]) {
  const text=nodeText(value).trim();if(!text) continue;
  let url:URL;try{url=new URL(text);}catch{continue;}
  const match=url.pathname.match(/^\/permalink\/wedstrijd\/(\d+)\/?$/);
  if(url.protocol==='https:' && url.hostname==='api.nevobo.nl' && match) {ids.push(match[1]);sourceUrl=`https://api.nevobo.nl/permalink/wedstrijd/${match[1]}`;}
 }
 if(!ids.length || new Set(ids).size!==1) throw new Error('nevobo_invalid_match_identity');
 return {externalId:`nevobo:${ids[0]}`,sourceUrl};
}
function normalizeStatus(raw:string,hasDate:boolean):MatchStatus {
 const status=raw.trim().toLowerCase();
 if(['gepland','vastgesteld','scheduled'].includes(status)) return 'scheduled';
 if(['gespeeld','uitslag bekend','played'].includes(status)) return 'played';
 if(['afgelast','geannuleerd','vervallen','afgezegd','cancelled','canceled'].includes(status)) return 'cancelled';
 if(['uitgesteld','postponed'].includes(status)) return 'postponed';
 if(['verplaatst','rescheduled'].includes(status)) return hasDate?'scheduled':'postponed';
 // Unknown source states must not silently become bookable or be called cancelled.
 return 'missing';
}
function normalizeItem(raw:Record<string,unknown>):ImportedMatch {
 const title=plain(raw.title),description=plain(raw.description),f=fields(description);
 const identity=sourceId(raw.guid,raw.link);
 let starts=instant(raw.pubDate);
 const sourceStatus=plain(raw['nevobo:status'] ?? raw.status);
 const status=normalizeStatus(sourceStatus,Boolean(starts));
 if(status==='scheduled' && !starts) throw new Error('nevobo_invalid_match_date');
 const prefix=title.replace(/^(?:afgelast|uitgesteld|verplaatst|gespeeld)\s*:\s*/i,'').match(/^(\d{1,2})\s+([\p{L}.]+)\s+(\d{1,2}):(\d{2})\s*:\s*(.+)$/u);
 const teams=(prefix?.[5] ?? title).split(/\s+[–—-]\s+/);
 if(teams.length!==2 || !teams.every(t=>t.trim())) throw new Error('nevobo_invalid_match_title');
 if(starts && prefix) {
  const parts=new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(new Date(starts));
  const part=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  if(part('day')!==Number(prefix[1]) || part('month')!==months[prefix[2].toLowerCase().replace(/\.$/,'')] || part('hour')!==Number(prefix[3]) || part('minute')!==Number(prefix[4])) {
   if(status==='scheduled') throw new Error('nevobo_conflicting_match_date');
   // A conclusive cancellation/result must still close enrollment even if its
   // pubDate now represents publication rather than the earlier match time.
   starts=null;
  }
 }
 const venue=f.speellocatie ?? f.sporthal ?? f.locatie ?? '';
 const pieces=venue.split(',').map(p=>p.trim()).filter(Boolean);
 const postalCity=(pieces.at(-1) ?? '').match(/^(\d{4}\s?[a-z]{2})\s+(.+)$/i);
 const address=f.adres ?? (postalCity && pieces.length>=3?pieces.slice(1,-1).join(', '):pieces.length>1?pieces.slice(1).join(', '):null);
 const postal=f.postcode ?? (postalCity?postalCity[1].toUpperCase():null);
 const city=f.plaats ?? (postalCity?postalCity[2]:null);
 const home=teams[0].trim(),away=teams[1].trim(),club=/\b(?:avv\s+)?keistad\b/i;
 return importedMatch.parse({
  external_id:identity.externalId,home_team:home,away_team:away,starts_at:starts,
  location:pieces[0] ?? '',level:f.competitie ?? f.niveau ?? f.klasse ?? '',address,postal_code:postal,city,court:f.veld ?? null,
  match_code:f.wedstrijd ?? f.wedstrijdcode ?? null,source_url:identity.sourceUrl,source_description:description,
  source_details:{rss_item:raw,title,fields:f,pub_date:nodeText(raw.pubDate),status:sourceStatus,guid:nodeText(raw.guid)},
  status,is_home:club.test(home)?true:club.test(away)?false:null,
 });
}
export function parseNevoboProgram(xml:string):FeedSnapshot {
 if(xml.length>3*1024*1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('nevobo_unsupported_xml');
 if(XMLValidator.validate(xml)!==true) throw new Error('nevobo_invalid_rss');
 const document=parser.parse(xml);
 const channel=document?.rss?.channel;
 if(!channel || typeof channel!=='object' || Array.isArray(channel)) throw new Error('nevobo_invalid_rss');
 const items:unknown[]=channel.item ?? [];
 if(!Array.isArray(items) || items.length>5000) throw new Error('nevobo_snapshot_too_large');
 const unique=new Map<string,ImportedMatch>();
 for(const raw of items) {
  if(!raw || typeof raw!=='object') throw new Error('nevobo_invalid_rss');
  const item=normalizeItem(raw as Record<string,unknown>),previous=unique.get(item.external_id);
  if(previous) {
   const comparable=({source_details:_details,source_description:_description,...match}:ImportedMatch)=>JSON.stringify(match);
   if(comparable(previous)!==comparable(item)) throw new Error('nevobo_duplicate_match_id');
   if(previous.source_description!==item.source_description) previous.source_description+='\n\n'+item.source_description;
  } else unique.set(item.external_id,item);
 }
 return {matches:[...unique.values()],publishedAt:instant(channel.lastBuildDate ?? channel.pubDate),complete:items.length>0};
}
