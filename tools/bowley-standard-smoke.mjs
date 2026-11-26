/** Ordinary compiled Dispatch, scoped wet rendering and original fallback. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const water='world/greenwich/v0/bowley-2020-water.r8.gz';
const routeId='greenwich-dunes-low',waterId='bowley-pond-survey-2020';
const archive=await readFile(new URL('../dist/'+water,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(archive),'e8e87a77911b27c9387568f4096ecebeb28c74f22aca72551b9a087ea38206f5');
const corrupted=gunzipSync(archive);corrupted[313]^=3;
const invalid=gzipSync(corrupted);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking']});
const cases=[
 {name:'standard',select:true,wet:true,requests:1,full:true},
 {name:'stock',select:true,query:'&stockBowleyPond',wet:false,requests:0,full:true},
 {name:'corrupt',select:true,corrupt:true,wet:false,requests:1}
];
const records=[];
try{
 for(const spec of cases){
  // Preserve every fixed simulation step and every actual Chromium draw.
  // The synthetic timestamp, like the other compiled replays, makes
  // camera and physics samples directly comparable across test runs.
  const page=await browser.newPage({viewport:{width:635,height:400},deviceScaleFactor:1});
  page.setDefaultTimeout(135000);
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('favicon.ico'))errors.push(e.text());});
  page.on('request',q=>{if(new URL(q.url()).pathname.endsWith('/'+water))requests.push(q.url());});
  if(spec.corrupt)await page.route('**/'+water,r=>r.fulfill({status:200,contentType:'application/gzip',body:invalid}));
  await page.addInitScript(full=>{
   const raf=window.requestAnimationFrame.bind(window), rows=window.bowleyFlightProof={active:false,n:0,frames:{}};
   let t;
   window.requestAnimationFrame=cb=>raf(now=>{
    if(t!==undefined)now=rows.active?t+99.999:Math.max(now,t);
    t=now;
    const before=window.islandAirDiagnostics;cb(now);const d=window.islandAirDiagnostics;
    if(!rows.active||!d||d===before||d.mode!=='flight'||d.camera!=='Chase')return;
    const n=++rows.n;
    if(n===1||n===116&&full){
     rows.frames[n]={x:d.x,y:d.altitude,z:d.z,heading:d.heading,ground:d.groundY,site:d.site,
      draws:d.drawCalls,triangles:d.triangles,pond:d.bowleyPond,warnings:d.layerWarnings,
      image:n===116?document.getElementById('world').toDataURL('image/png'):undefined};
    }
   });
  },!!spec.full);
  const href=new URL('?diagnostics'+(spec.select?'':('&departure='+routeId))+(spec.query??''),base);
  assert.equal((await page.goto(href.href,{waitUntil:'domcontentloaded'})).status(),200);
  await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='dispatch');
  if(spec.select)await page.selectOption('#site',{label:'Greenwich Dunes · coastal pass'});
  await page.waitForFunction(id=>{
   const d=window.islandAirDiagnostics,b=d?.buildingTiles;return d?.site===id&&d.mode==='dispatch'&&d.mainland&&d.roads&&
    b?.ready>0&&b.loading===0&&b.pending===0&&d.woodlandStream?.inflight===0&&d.detail.loading===0;
  },routeId,{polling:100}).catch(async error=>{
   const state=await page.evaluate(()=>window.islandAirDiagnostics).catch(()=>undefined);
   console.error(spec.name,'wait for settled dispatch',JSON.stringify({site:state?.site,
    trees:state?.woodlandStream,buildings:state?.buildingTiles,detail:state?.detail,errors}));
   throw error;
  });
  const {bowleyPond:dispatch,buildingTiles,woodlandStream,detail}=await page.evaluate(()=>window.islandAirDiagnostics);
  const expected=spec.wet?waterId:null;
  assert.equal(dispatch,expected,spec.name+' dispatch');
  await page.getByRole('button',{name:'Begin flight'}).evaluate(button=>{window.bowleyFlightProof.active=true;button.click();});
  await page.waitForFunction(n=>window.bowleyFlightProof.n>=n,spec.full?116:8,{timeout:225000});
  const frames=await page.evaluate(()=>window.bowleyFlightProof.frames);
  for(const f of Object.values(frames)){
   assert.equal(f.site,routeId);assert.equal(f.pond,expected);assert.deepEqual(f.warnings,[]);
   if(f.image){
    const png=Buffer.from(f.image.split(',')[1],'base64');await writeFile(out+'/bowley-'+spec.name+'.png',png);
    f.imageSHA=sha(png);delete f.image;
   }
  }
  if(spec.full)assert(Math.hypot(frames[116].x-frames[1].x,frames[116].z-frames[1].z)>590);
  await page.keyboard.press('v');await page.waitForFunction(()=>window.islandAirDiagnostics?.camera==='Cockpit');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='paused');
  assert.equal(requests.length,spec.requests,spec.name);assert.deepEqual(errors,[]);
  records.push({name:spec.name,dispatch,frames,requests:requests.length,paused:true,errors,
   settled:{buildingTiles,woodlandStream,detail}});
  console.log(spec.name,'completed',requests.length,'water requests',woodlandStream.resident,'woodland tiles');
  await page.close();
 }
 const [live,stock]=records;
 const a=PNG.sync.read(await readFile(out+'/bowley-standard.png'));
 const b=PNG.sync.read(await readFile(out+'/bowley-stock.png'));
 const la=live.frames[116],lb=stock.frames[116], delta=[];
 for(const k of ['x','y','z','heading'])assert(Math.abs(la[k]-lb[k])<1e-7,'matched ordinary flight '+k);
 // A broad lower-left crop preselected from the approach, not proof of
 // exact changed geometry. The existing separate aperture/ray QA verifies
 // the registered wet boundary and not just a pixel count in this region.
 for(let y=250;y<368;y++)for(let x=55;x<300;x++){
  const k=(y*a.width+x)*4;
  delta.push(Math.max(...[0,1,2].map(i=>Math.abs(a.data[k+i]-b.data[k+i]))));
 }
 const strong=delta.filter(x=>x>12).length;
 assert(strong>1700,JSON.stringify({strong,records}));
 console.log('Ordinary Greenwich compiled flight, strong local pixels:',strong);
 await writeFile(out+'/bowley-standard.json',JSON.stringify({records,strongLocalPixels:strong},null,2)+'\n');
}finally{await browser.close();}
