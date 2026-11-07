import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectPages } from '../lib/pagination';

test('haalt ook meer dan 1000 wedstrijden volledig op bij een lagere backendlimiet',async()=>{
 const source=Array.from({length:1201},(_,id)=>({id})),offsets:number[]=[];
 const result=await collectPages(async(from,to)=>{offsets.push(from);return {data:source.slice(from,Math.min(to+1,from+100)),count:source.length,error:null};});
 assert.deepEqual(result.data,source);assert.deepEqual(offsets,[0,100,200,300,400,500,600,700,800,900,1000,1100,1200]);
});
test('toont geen gedeeltelijk schema als een vervolgpagina faalt',async()=>{
 await assert.rejects(collectPages(async(from)=>from===0?{data:[{id:1}],count:2,error:null}:{data:null,count:null,error:{code:'upstream_error'}},1),/volledig/);
});
