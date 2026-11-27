/** Compiled ordinary harbour pass, exact stock comparison, and byte-corrupt
 * geometry delivery. Asset art and collision are checked as a single lease. */
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{PNG}=require('pngjs');
const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const site='north-rustico-harbour-low',grade='north-rustico-2020-dry-ground';
const asset='/world/rustico/v1/lighthouse-ground.g11.gz';
const extract=[302,433];
const observedPath=(p)=>p===asset||/^\/world\/(?:cover|roads|sidewalks|parking)[./]/u.test(p)||
 /^\/world\/buildings\/index\.json$/u.test(p)||/^\/assets\/mount-[^/]+\.js$/u.test(p);
async function boundedObservation(page) {
 let timer;
 try {
  return await Promise.race([
   page.evaluate(()=>({clock:performance.now(),ticks:window.rusticoSmoke?.readyTicks??0,
    transitions:window.rusticoSmoke?.readyTransitions??[] })).catch(()=>null),
   new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1800);}),
  ]);
 }finally{clearTimeout(timer);}
}
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const receipts=[];
try{
 for(const mode of ['standard','stock','corrupt']){
  const page=await browser.newPage({viewport:{width:840,height:560}});
  const errors=[],requests=[],network=[],tracked=new Map();
  const zero=performance.now();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||/WebGL.*INVALID/.test(m.text()))errors.push(m.text());});
  page.on('request',r=>{
   const p=new URL(r.url()).pathname;
   if(p.endsWith(asset))requests.push(asset);
   if(!observedPath(p)||network.length>=48)return;
   const row={path:p,startedMs:performance.now()-zero};network.push(row);tracked.set(r,row);
  });
  page.on('response',r=>{const n=tracked.get(r.request());if(n){n.responseMs=performance.now()-zero;n.status=r.status();}});
  page.on('requestfinished',r=>{const n=tracked.get(r);if(n){n.finishedMs=performance.now()-zero;tracked.delete(r);}});
  page.on('requestfailed',r=>{const n=tracked.get(r);if(n){n.failedMs=performance.now()-zero;n.error=r.failure()?.errorText;tracked.delete(r);}});
  if(mode==='corrupt')await page.route('**'+asset,r=>r.fulfill({status:200,body:Buffer.alloc(3201)}));
  await page.addInitScript(({grade,extract,mode})=>{
   const raf=window.requestAnimationFrame.bind(window);
   const q=window.rusticoSmoke={active:false,origin:null,frames:{},readyTicks:0,readyTransitions:[]};
   let lastState;
   const wanted=mode==='corrupt'?[160]:extract;let clock;
   window.requestAnimationFrame=cb=>raf(t=>{
    if(clock!==undefined)t=q.active?clock+99.999:Math.max(clock,t);
    clock=t;
    const previous=window.islandAirDiagnostics;cb(t);
    const d=window.islandAirDiagnostics;
    if(!q.active&&d&&d!==previous&&d.mode==='dispatch'){
     q.readyTicks++;
     const status={controller:d.northRusticoLighthouse??null,roads:!!d.roads,buildings:!!d.buildings,
      layerWarnings:d.layerWarnings??[]};
     const key=JSON.stringify(status);
     if(key!==lastState&&q.readyTransitions.length<32){
      lastState=key;q.readyTransitions.push({atMs:performance.now(),...status});
     }
    }
    if(!q.active||!d||d===previous||d.mode!=='flight'||d.camera!=='Chase')return;
    const metres=Math.hypot(d.x-q.origin[0],d.z-q.origin[1]);
    const at=wanted.find(x=>metres>=x&&!q.frames[x]);if(at===undefined)return;
    const canvas=document.getElementById('world'),gl=canvas.getContext('webgl2');
    q.frames[at]={
     metres,pose:[d.x,d.z,d.altitude,d.heading,d.groundY],inletGrade:d.localGroundGrades.includes(grade),
     light:d.northRusticoLighthouse?.visible===true,otherRoof:d.rusticoHarbourRoof,
     extra:[d.rusticoMassingReview,d.rusticoDrySoil,d.rusticoDryTussocks],
     png:mode==='corrupt'?undefined:canvas.toDataURL('image/png'),gl:gl.getError(),
    };
   });
  },{grade,extract,mode});
  const url=new URL('?departure='+site+'&diagnostics',base);
  if(mode==='stock')url.searchParams.set('stockRusticoLighthouse','');
  assert((await page.goto(url.href,{waitUntil:'domcontentloaded'})).ok());
  await page.waitForFunction(site=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.site===site,site,{timeout:65000});
  const expected=mode==='standard'?'ready':mode==='corrupt'?'held':null;
  if(expected!==null){
   let issue,phase,checkpoint='scene prerequisites',layers;
   try{
    // The first dispatch frame can precede decode and attachment of the
    // signed roads/buildings. A software runner may not even issue the
    // lighthouse request before those invariants are known. Keep a separate
    // finite deadline for prerequisites, then test the same terminal phase.
    const prerequisite=await page.waitForFunction(()=>{
     const d=window.islandAirDiagnostics,c=d?.northRusticoLighthouse;
     if(c?.layers==='held')return 'held';
     return d?.mode==='dispatch'&&d.roads&&d.buildings&&c?.layers==='verified'?'verified':null;
    },null,{timeout:55000,polling:200});
    layers={value:await prerequisite.jsonValue(),elapsedMs:performance.now()-zero};
    await prerequisite.dispose();
    assert.equal(layers.value,'verified','Rustico signed scene prerequisites were refused');
    checkpoint='lighthouse terminal phase';
    const result=await page.waitForFunction(()=>{
     const p=window.islandAirDiagnostics?.northRusticoLighthouse?.phase;
     return p==='ready'||p==='held'?p:null;
    },null,{timeout:22000,polling:200});
    phase=await result.jsonValue();await result.dispose();
    assert.equal(phase,expected,`Rustico ${mode} resolved ${phase}; expected ${expected}`);
   }catch(error){issue=error;}
   const pageState=await boundedObservation(page);
   const readiness={mode,site,expected,phase:phase??null,checkpoint,layers:layers??null,
    elapsedMs:performance.now()-zero,pageState,network,errors,
    fault:issue?.message??null};
   await writeFile(join(out,`rustico-readiness-${mode}.json`),JSON.stringify(readiness,null,2)+'\n');
   if(issue){console.error(JSON.stringify(readiness));throw issue;}
  }
  const initial=await page.evaluate(grade=>{
   const d=window.islandAirDiagnostics;return [d.localGroundGrades.includes(grade),!!d.northRusticoLighthouse?.visible];
  },grade);
  assert.deepEqual(initial,[false,false]);
  const begin=page.getByRole('button',{name:'Begin flight'});
  assert(await begin.isVisible()&&await begin.isEnabled(),'Dispatch button is not usable');
  // The replay advances virtual time; arm it and invoke the real Dispatch
  // handler in one task, without waiting for a compositor stability frame
  // while a software renderer is servicing the enlarged terrain close-up.
  await begin.evaluate(button=>{
   const d=window.islandAirDiagnostics,q=window.rusticoSmoke;
   if(!(button instanceof HTMLButtonElement)||button.disabled||d?.mode!=='dispatch')throw Error('Rustico Dispatch was not ready');
   q.origin=[d.x,d.z];q.active=true;button.click();
  });
  await page.waitForFunction(site=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===site,site,{timeout:45000});
  await page.waitForFunction(last=>!!window.rusticoSmoke.frames[last],mode==='corrupt'?160:extract.at(-1),{timeout:245000});
  const frames=await page.evaluate(()=>window.rusticoSmoke.frames);
  for(const [pose,value] of Object.entries(frames)){
   assert.equal(value.gl,0);
   assert.equal(value.inletGrade,mode==='standard');assert.equal(value.light,mode==='standard');
   assert.equal(value.otherRoof,true);assert.deepEqual(value.extra,[false,false,0]);
   if(value.png){
    const bytes=Buffer.from(value.png.split(',')[1],'base64'),read=PNG.sync.read(bytes);
    assert.equal(read.width,840);assert.equal(read.height,560);
    assert(read.data.some((v,i)=>v>8&&i%4!==3),'The renderer returned a blank frame');
    await writeFile(join(out,'rustico-'+mode+'-'+pose+'.png'),bytes);delete value.png;
   }
  }
  assert.deepEqual(requests,mode==='stock'?[]:[asset]);assert.deepEqual(errors,[]);
  receipts.push({mode,requests,frames});
  await writeFile(join(out,'rustico-lighthouse.json'),JSON.stringify(receipts,null,2)+'\n');
  console.log(JSON.stringify(receipts.at(-1)));await page.close();
 }
 const [actual,stock]=receipts;
 for(const pose of extract)assert.deepEqual(actual.frames[pose].pose,stock.frames[pose].pose);
}finally{await browser.close();}
