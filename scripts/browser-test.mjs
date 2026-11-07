import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TEST_BASE_URL ?? 'http://localhost:3000';
 const response=await page.goto(base,{waitUntil:'networkidle'});assert.equal(response.status(),200);
 assert.match(await page.locator('h1').textContent(),/Hoi Robin/);
 assert.match(await page.locator('.demo-banner').textContent(),/wijzigingen worden niet opgeslagen/);
 await page.getByRole('link',{name:'Vind jouw volgende dienst'}).click();
 await page.waitForURL('**/diensten');
 await page.locator('select[name=kind]').selectOption('bar');await page.getByRole('button',{name:'Filteren'}).click();await page.waitForURL('**/diensten?**kind=bar');
 assert.equal(await page.locator('.duty-card').count(),2);
 await page.getByRole('link',{name:'Mijn diensten',exact:true}).click();
 await page.waitForURL('**/diensten?view=mine');
 assert.equal(await page.locator('.duty-card').count(),2);
 assert.match(await page.locator('main').textContent(),/Punten behaald/);
 for(const path of ['/beheer','/team','/wedstrijden','/login']) {const r=await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(r.status(),200,path);}
 for(const width of [390,768,1440]) {
  await page.setViewportSize({width,height:844});
  for(const path of ['/','/diensten','/beheer','/team','/wedstrijden']) {await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Horizontal overflow: ${width} ${path}`);}
 }
 assert.deepEqual(errors,[]);console.log('Browsercontrole geslaagd: navigatie, filters, mijn diensten, responsive schermen en geen runtimefouten.');
} finally {await browser.close();}
