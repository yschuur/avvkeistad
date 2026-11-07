import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BRANDING, brandingTokens, isHexColor, contrast } from '../lib/branding';

test('HEX-validatie staat uitsluitend volledige RGB-kleuren toe',()=>{
 for(const value of ['#000000','#FFFFFF','#087d56']) assert.equal(isHexColor(value),true);
 for(const value of ['red','#fff','087d56','#123456; color:red','url(https://example.test)','#GG0000',' #123456']) assert.equal(isHexColor(value),false);
 assert.deepEqual(brandingTokens({primaryColor:'invalid',secondaryColor:'invalid'}),brandingTokens(DEFAULT_BRANDING));
});
test('clubkleuren houden tekst en selectie op minimaal WCAG AA contrast',()=>{
 // Includes white, black, saturated colours, and the full sampled RGB cube.
 for(const r of [0,51,102,153,204,255]) for(const g of [0,51,102,153,204,255]) for(const b of [0,51,102,153,204,255]) {
  const color='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  const t=brandingTokens({primaryColor:color,secondaryColor:color});
  assert.ok(contrast(t['--accent'],t['--on-accent'])>=4.5,color+' primaire actie');
  assert.ok(contrast(t['--accent-text'],t['--accent-subtle'])>=4.5,color+' selectie');
  assert.ok(contrast(t['--focus'],'#FFFFFF')>=4.5,color+' focus');
  assert.ok(contrast(t['--secondary-text'],'#FFFFFF')>=4.5,color+' secundair');
 }
});
