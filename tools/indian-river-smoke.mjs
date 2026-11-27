/** Compiled Standard and explicit church smoke; use the same Playwright build as the base flight check. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({
 executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'],
});
try{
 const page=await browser.newPage({viewport:{width:660,height:450}});
 page.setDefaultTimeout(75000);
 const errors=[],requests=[];
 const signedFiles=['ground.g11.gz','sun-cast.r8.gz'],phaseByRequest=new WeakMap();
 const isSigned=url=>url.startsWith(base)&&new URL(url).pathname.includes('/indian-river/v1/');
 page.on('request',r=>{if(isSigned(r.url()))phaseByRequest.set(r,
  new URL(r.frame().url()).searchParams.has('indianRiverReview')?'explicit':'ordinary');});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{
  if(!r.url().startsWith(base))return;
  if(r.status()>=400)errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
  if(isSigned(r.url())){
   requests.push({phase:phaseByRequest.get(r.request()),
    name:new URL(r.url()).pathname.split('/').at(-1),status:r.status()});
  }
 });
 const opts=new URL('?diagnostics&departure=indian-river-country-pass',base);
 await page.goto(opts.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>{
  const d=window.islandAirDiagnostics;
  return d?.mode==='dispatch'&&d.indianRiverStandardReady;
 });
 const ready=await page.evaluate(()=>window.islandAirDiagnostics);
 assert.equal(ready.site,'indian-river-country-pass');
 assert(ready.indianRiverStandard&&!ready.indianRiver&&!ready.indianRiverSun);
 assert(!ready.localGroundGrades.includes('st-marys-2020-grade-study'),'preflight changed Dispatch ground');
 const ordinary=requests.filter(r=>r.phase==='ordinary');
 assert.deepEqual(ordinary.map(r=>r.name).sort(),signedFiles);
 assert(ordinary.every(r=>r.status===200));
 await page.getByRole('button',{name:'Begin flight'}).click();
 await page.waitForFunction(()=>{
  const d=window.islandAirDiagnostics;
  return d?.mode==='flight'&&d.indianRiver&&d.indianRiverSun&&
   d.indianRiverShadowReceivers===4&&d.localGroundGrades.includes('st-marys-2020-grade-study');
 });
 await page.screenshot({path:`${out}/05-indian-river-standard.png`});
 // Disable only the automatic preflight on the second Dispatch. The
 // historical explicit study is an independent setting and still qualifies.
 opts.searchParams.set('stockIndianRiver','');
 await page.goto(opts.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='dispatch');
 assert.equal(await page.evaluate(()=>window.islandAirDiagnostics.indianRiverStandard),false);
 assert.equal(requests.length,signedFiles.length);
 await page.locator('.scenery-reviews summary').click();
 await page.getByLabel('St. Mary’s exterior').check();
 await Promise.all([
  page.waitForURL(u=>u.searchParams.has('indianRiverReview')),
  page.getByRole('button',{name:'Apply studies'}).click(),
 ]);
 await page.waitForFunction(()=>{
  const d=window.islandAirDiagnostics;
  return d?.mode==='dispatch'&&d.indianRiver&&d.indianRiverSun&&d.indianRiverShadowReceivers===4&&d.indianRiverDetail?.tier==='far';
 });
 const init=await page.evaluate(()=>window.islandAirDiagnostics);
 assert.equal(init.site,'indian-river-country-pass');
 assert.equal(init.localGroundGrade,'st-marys-2020-grade-study');
 const explicit=requests.filter(r=>r.phase==='explicit');
 assert.deepEqual(explicit.map(r=>r.name).sort(),signedFiles);
 assert(explicit.every(r=>r.status===200));
 assert.equal(requests.length,2*signedFiles.length,'late or unclassified signed response');
 await page.getByRole('button',{name:'Begin flight'}).click();
 await page.waitForFunction(({x,z})=>{
  const d=window.islandAirDiagnostics;
  return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>145;
 },{x:init.x,z:init.z},{timeout:60000,polling:180});
 const d=await page.evaluate(()=>window.islandAirDiagnostics);
 assert(d.indianRiver&&d.indianRiverSun&&d.indianRiverShadowReceivers===4);
 assert.deepEqual(d.layerWarnings,[]);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:`${out}/05-indian-river.png`});
 console.log('Indian River smoke passed: Standard admits only after Begin; the independent explicit review still shows signed grade, four casters and the live approach.');
}finally{await browser.close();}
