import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const cases=(process.env.CAST_CONTROLS??'stock,zero,charlottetown').split(',');
const out=process.env.OUT??'controls';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const receipt={};
try{
 for(const mode of cases){
  const page=await browser.newPage({viewport:{width:830,height:554},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))errors.push(m.text());});
  await page.addInitScript(m=>{
   window.__castControl={sources:0,depthSource:0};
   const gl=WebGL2RenderingContext.prototype, shader=gl.shaderSource;
   gl.shaderSource=function(h,s){
    if(s.includes('uniform float aircraftCastLive;'))window.__castControl.sources++;
    if(s.includes('void main(){gl_FragColor=vec4(0.);}'))window.__castControl.depthSource++;
    shader.call(this,h,s);
   };
   if(m==='zero'){
    const p=HTMLCanvasElement.prototype,original=p.getContext;
    p.getContext=function(name,opts,...extras){
     if(this.id==='world'&&name==='webgl2')opts={...opts,antialias:false};
     return original.call(this,name,opts,...extras);
    };
   }
  },mode);
  const site=mode==='charlottetown'?'cyyg':'cysu';
  const url=new URL(process.env.URL??'http://127.0.0.1:42963/');
  url.searchParams.set('departure',site);url.searchParams.set('diagnostics','');
  if(mode==='stock')url.searchParams.set('stockAircraftRunwayCast','');
  assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
  await page.waitForFunction(site=>{const d=window.islandAirDiagnostics;return d?.mode==='dispatch'&&d.site===site&&d.roads&&d.buildings&&d.detail.ready>0&&!d.detail.loading;},site,{polling:120,timeout:125000});
  await page.getByRole('button',{name:'Begin flight'}).click();
  await page.waitForFunction(site=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&d.site===site;},site,{polling:120});
  const origin=await page.evaluate(()=>[window.islandAirDiagnostics.x,window.islandAirDiagnostics.z]);
  let key='=';
  await page.keyboard.down(key);
  try{await page.waitForFunction(()=>window.islandAirDiagnostics?.throttle>.15,{},{timeout:26000});}
  catch(e){await page.keyboard.up(key);key='Shift';await page.keyboard.down(key);}
  await page.waitForFunction(([x,z])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>=15;},origin,{polling:120,timeout:140000});
  await page.keyboard.up(key);
  const r=await page.evaluate(()=>{
   const d=window.islandAirDiagnostics,gl=document.querySelector('#world').getContext('webgl2'),p=window.__castControl;
   return {samples:gl.getParameter(gl.SAMPLES),error:gl.getError(),state:d.aircraftRunwayCast,x:d.x,z:d.z,
    mode:d.mode,site:d.site,depthSource:p.depthSource,sources:p.sources};
  });
  assert.equal(r.mode,'flight');assert.equal(r.site,site);assert.equal(r.error,0);
  assert.equal(r.samples,mode==='zero'?0:4);
  assert.equal(r.depthSource,0);
  if(mode==='charlottetown'){assert(r.state);assert(!r.state.active&&r.state.refreshes===0);}
  else{assert.equal(r.state,null);assert.equal(r.sources,0);}
  assert.deepEqual(errors,[]);
  receipt[mode]=r;console.log(mode,r);
  await writeFile(out+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');
  await page.close();
 }
}finally{await browser.close();}
