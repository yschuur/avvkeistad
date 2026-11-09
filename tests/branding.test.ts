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

test('accentkleur is onafhankelijk van navigatie en behoudt leesbare voortgang',()=>{
 const base=brandingTokens({...DEFAULT_BRANDING,primaryColor:'#112233',secondaryColor:'#445566',accentColor:'#FFFFFF'});
 assert.equal(base['--accent'],'#FFFFFF');assert.equal(base['--on-accent'],'#000000');assert.equal(base['--brand-primary'],'#112233');
 assert.ok(contrast(base['--progress-earned'],'#FFFFFF')>=4.5);
 assert.equal(base['--accent-text'],brandingTokens({...DEFAULT_BRANDING,primaryColor:'#112233'} )['--accent-text']);
});
test('clubnaam en rasterlogo worden gecontroleerd zonder SVG of externe URLs',async()=>{
 const {validLogoData,validClubName,clubInitials}=await import('../lib/branding');
 assert.equal(validClubName('Testvereniging'),true);assert.equal(clubInitials('AVV Keistad'),'AK');
 for(const name of ['', 'X','x'.repeat(81),'Club\nnaam']) assert.equal(validClubName(name),false);
 const logo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=';
 for(const image of [null,'',logo]) assert.equal(validLogoData(image),true);
 for(const image of ['https://example.test/logo.png','data:image/svg+xml;base64,PHN2Zz4=',logo.replace('iVBORw0KGgo','iVBORwAAAAA'),'data:image/png;base64,'+Buffer.alloc(262145).toString('base64')]) assert.equal(validLogoData(image),false);
});
