/** Compiled Standard/veto playback. Exact camera-local RGB scope is separately
 * documented in the matched same-context native report; this lane tests live admission. */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {join} from 'node:path';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const url=new URL('?departure=georgetown-low&diagnostics',process.env.PREVIEW_URL??'http://127.0.0.1:4173/');
const target=[51180.5893173,35333.6897254];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const report=[];
try{
  for(const stock of [false,true]){
   const page=await browser.newPage({viewport:{width:720,height:480}});
   const errors=[],warnings=[],retrieved=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error'||/WebGL.*INVALID/.test(m.text()))errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
   page.on('request',r=>{if(/art\/.*(?:school|georgetown)|q31/.test(r.url()))retrieved.push(r.url());});
   await page.addInitScript(target=>{
    const raf=window.requestAnimationFrame.bind(window);
    let used,hold=false;
    window.schoolStageQA={at:null,go:false,missed:false,capture:false,frame:null};
    const q=window.schoolStageQA;
    window.requestAnimationFrame=cb=>raf(t=>{
     if(hold)t=used??t;
     else if(q.go&&used!==undefined)t=used+99.999;
     else if(used!==undefined)t=Math.max(used,t);
     used=t;
     const before=window.islandAirDiagnostics;
     cb(t);
     const d=window.islandAirDiagnostics;
     // Only the real renderer replaces diagnostics. Capture the non-preserved
     // backbuffer in that same task, not an unrelated animation callback.
     if(q.capture&&d&&d!==before&&d.mode==='flight'&&d.camera==='Chase'){
      const canvas=document.getElementById('world');
      const gl=canvas.getContext('webgl2');
      q.frame={png:canvas.toDataURL('image/png'),state:d.georgetownSchoolWalls,church:d.stDavids,
       errors:[gl.getError(),...d.layerWarnings],pose:[d.x,d.z,d.altitude],
       draws:d.drawCalls,triangles:d.triangles,geom:d.geometries};
      q.capture=false;
     }
     if(q.go&&d?.mode==='flight'&&!hold){
      const near=Math.hypot(d.x-target[0],d.z-target[1]);
      if(!q.nearest||q.nearest>near)q.nearest=near;
      if(near<.05){q.at=[d.x,d.z,d.altitude];hold=true;}
      else if(d.x<target[0]-5)q.missed=true;
     }
    });
   },target);
   const res=await page.goto(url.href+(stock?'&stockGeorgetownSchoolWalls':''),{waitUntil:'domcontentloaded'});
   assert.equal(res.status(),200);
   await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.buildings,null,{timeout:65000});
   await page.evaluate(()=>{window.schoolStageQA.go=true;});
   await page.getByRole('button',{name:'Begin flight'}).click();
   await page.waitForFunction(()=>window.schoolStageQA.at||window.schoolStageQA.missed,null,{timeout:260000});
   const q=await page.evaluate(()=>window.schoolStageQA);
   assert(q.at&&!q.missed,JSON.stringify(q));
   await page.waitForFunction((stock)=>{
     const d=window.islandAirDiagnostics;
     return !!d?.stDavids&&d.mode==='flight'&&d.site==='georgetown-low'&&d.georgetownSchoolWalls===!stock;
   },stock,{timeout:25000}).catch(async e=>{
    throw Error(JSON.stringify(await page.evaluate(()=>({q:schoolStageQA,d:islandAirDiagnostics}))),{cause:e});
   });
   await page.evaluate(()=>{window.schoolStageQA.capture=true;});
   await page.waitForFunction(()=>window.schoolStageQA.frame,null,{timeout:30000});
   const data=await page.evaluate(()=>window.schoolStageQA.frame);
   const bytes=Buffer.from(data.png.split(',')[1],'base64');delete data.png;
   const observed=PNG.sync.read(bytes);
   assert.equal(observed.width,720);assert.equal(observed.height,480);
   assert(observed.data.some((v,i)=>i%4!==3&&v>8),'Native flight frame was blank');
   assert.equal(data.state,!stock);assert.equal(data.church,true);
   await writeFile(join(out,'georgetown-school-'+(stock?'stock':'standard')+'.png'),bytes);
   report.push({stock,...data,networkArtRequests:retrieved});
   assert.deepEqual(data.errors,[0]);assert.deepEqual(errors,[]);assert.deepEqual(retrieved,[]);
   console.log(JSON.stringify(report.at(-1)));
   await writeFile(join(out,'georgetown-school-walls.json'),JSON.stringify(report,null,2)+'\n');
   await page.close();
  }
}finally{await browser.close();}
