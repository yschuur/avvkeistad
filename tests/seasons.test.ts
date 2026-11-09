import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSeasonValues,seasonSchema,seasonValues,type Season } from '../lib/seasons';
const season:Season={id:'20000000-0000-4000-8000-000000000001',name:'2026/2027',starts_on:'2026-08-01',ends_on:'2027-07-31',default_norm:20,youth_norm:null,senior_norm:0,active:true,updated_at:'2026-11-09T13:00:00.000Z'};

test('seizoensformulier bewaart vrijstelling 0, algemene terugval en controleert echte datums en normen',()=>{
 const values=seasonValues(season);assert.equal(values.youth,'');assert.equal(values.senior,'0');
 assert.deepEqual(seasonSchema.parse(values),{name:'2026/2027',start:'2026-08-01',end:'2027-07-31',norm:20,youth:null,senior:0});
 for(const invalid of [{norm:''},{norm:'abc'},{norm:'-1'},{norm:'Infinity'},{youth:'NaN'},{senior:'1000000'},{name:' '},{start:'2027-02-30'},{end:'2026-07-31'},{norm:'1.234'}]) {
  assert.equal(seasonSchema.safeParse({...values,...invalid}).success,false,JSON.stringify(invalid));
 }
});
test('volgend seizoen is een aanpasbaar voorstel uit opgeslagen gegevens, met schrikkeljaarcorrectie',()=>{
 assert.deepEqual(nextSeasonValues(season),{...seasonValues(season),name:'2027/2028',start:'2027-08-01',end:'2028-07-31'});
 assert.equal(nextSeasonValues({...season,name:'Jeugdcompetitie'}).name,'');
 assert.equal(nextSeasonValues({...season,starts_on:'2024-02-29'}).start,'2025-02-28');
 assert.deepEqual(nextSeasonValues(null),{name:'',start:'',end:'',norm:'',youth:'',senior:''});
});
