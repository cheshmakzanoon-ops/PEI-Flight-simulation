/** Compiled production verification for a source-aligned sightseeing start.
 * Begin a real flight before diagnostics freeze a same-camera comparison.
 * JS injection belongs only to the test browser, not the simulated app. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const kingsSite='kings-mapped-farmland-pass',queensSite='queens-fields';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']});
try{
 const proofs=[];
 for(const mode of ['standard','expanded','queens']){
 const standard=mode!=='expanded',queens=mode==='queens',site=queens?queensSite:kingsSite;
 const page=await browser.newPage({viewport:{width:540,height:360}});
 page.setDefaultTimeout(95000);
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',e=>{if(e.type()==='error'||/WebGL.*INVALID_/.test(e.text()))errors.push(e.text())});
 page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))errors.push(r.status()+' '+r.url());});
 page.on('request',r=>{
  const name=new URL(r.url()).pathname;
  if(/\/fields-province\/v2\/|\/furrow-relief\.webp$/.test(name))requests.push([name.split('/').at(-1),r.headers().range??null]);
 });
 await page.addInitScript(()=>{
  const raf=window.requestAnimationFrame.bind(window),g=WebGL2RenderingContext.prototype;
  const use=g.useProgram,el=g.drawElements,arr=g.drawArrays,uf=g.uniform1f,uniform=g.getUniformLocation;
  const current=new WeakMap,known=new WeakMap;
  const s=window.mappedFarmlandQA={hold:false,clock:undefined,sample:null,frame:null,gain:null,draws:0,owners:[]};
  g.useProgram=function(p){current.set(this,p);return use.call(this,p);};
  function sample(gl,call){
   if(s.sample===null||gl.canvas!==document.querySelector('#world')||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null)return call();
   const p=current.get(gl);if(!p)return call();
   if(!known.has(p))known.set(p,{control:uniform.call(gl,p,'provinceFieldStrength'),tile:uniform.call(gl,p,'detailBox')});
   const {control,tile}=known.get(p);if(control===null)return call();
   s.draws++;
   if(tile)s.owners.push(Array.from(gl.getUniform(p,tile)));
   if(s.gain===null)return call();
   const v=gl.getUniform(p,control);
   uf.call(gl,control,s.gain);
   try{return call();}finally{uf.call(gl,control,v);}
  }
  g.drawElements=function(...a){return sample(this,()=>el.apply(this,a));};
  g.drawArrays=function(...a){return sample(this,()=>arr.apply(this,a));};
  window.requestAnimationFrame=cb=>raf(t=>{
   const used=s.hold?(s.clock??t):t;s.clock=used;s.draws=0;s.owners=[];
   cb(used);
   if(s.sample!==null&&s.draws>0){
    const canvas=document.querySelector('#world'), gl=canvas.getContext('webgl2');
    s.frame={id:s.sample,draws:s.draws,owners:s.owners,png:canvas.toDataURL('image/png'),glError:gl.getError(),
      d:window.islandAirDiagnostics};
    s.sample=null;
   }
  });
 });
 const url=new URL('?diagnostics&departure='+site+(standard?'':'&provinceFieldsReview'),base);
 assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
 await page.getByRole('button',{name:'Begin flight'}).waitFor();
 await page.waitForFunction(v=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.site===v,site,{polling:120});
 await page.getByRole('button',{name:'Begin flight'}).click();
 await page.waitForFunction(v=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===v,site,{polling:80});
 const start=await page.evaluate(()=>window.islandAirDiagnostics);
 await page.waitForFunction(({a,standard,queens})=>{
  const d=window.islandAirDiagnostics,pass=(queens?window.islandAirQueensFields:window.islandAirKingsFields)?.state;
  const field=standard?pass?.stream:d?.provinceFields;
  if(!d||d.site!==a.site||d.mode!=='flight'||d.camera!=='Chase'||(field?.ready??0)<2||
      (standard&&pass.phase!=='live'))return false;
  const k=Math.hypot(d.x-a.x,d.z-a.z);
  return k>=103&&k<=235&&d.altitude-d.groundY>=47&&d.altitude-d.groundY<=83;
 },{a:start,standard,queens},{polling:65});
 const current=await page.evaluate(()=>window.islandAirDiagnostics);
 await page.keyboard.press('p');
 await page.waitForFunction(({standard,queens})=>{
  const d=window.islandAirDiagnostics,pass=(queens?window.islandAirQueensFields:window.islandAirKingsFields)?.state;
  const field=standard?pass?.stream:d?.provinceFields;
  return d?.mode==='paused'&&field?.active&&field.ready>=2&&field.pending===0&&d.detail?.loading===0;
 },{standard,queens},{polling:130});
 // Field arrivals use the real wall clock. Give existing residents their
 // shipped 0.85 s blend *after* normal cold launch has been verified.
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,950)));
 await page.evaluate(()=>{window.mappedFarmlandQA.hold=true;});
 async function capture(id,gain){
  await page.evaluate(({id,gain})=>{const s=window.mappedFarmlandQA;s.gain=gain;s.sample=id;s.frame=null;},{id,gain});
  await page.waitForFunction(v=>window.mappedFarmlandQA.frame?.id===v,id,{polling:70});
  const a=await page.evaluate(()=>window.mappedFarmlandQA.frame);
  assert.equal(a.glError,0);assert(a.draws>0);assert.equal(a.d.mode,'paused');assert.equal(a.d.site,site);
  return {...a,image:Buffer.from(a.png.split(',')[1],'base64')};
 }
 const stock=await capture('stock',0),live=await capture('live',null),marker=await capture('scope',-1),restored=await capture('restored',0);
 assert.equal(stock.draws,live.draws);assert.equal(restored.draws,live.draws);assert.equal(marker.draws,live.draws);
 if(standard){
  assert.equal(live.draws,1,'Standard cannot repaint all terrain groups');
  assert.deepEqual(live.owners,[[(queens?12:23)/32,Math.fround(13/22),32,22]],'wrong submitted terrain receiver');
  assert.equal(current.provinceFields,null,'Standard must not use the legacy option');
 }
 const spatial=d=>[d.x,d.z,d.altitude,d.groundY,d.heading,d.bank,d.camera];
 assert.deepEqual(spatial(stock.d),spatial(live.d));assert.deepEqual(spatial(live.d),spatial(restored.d));
 const a=PNG.sync.read(stock.image),b=PNG.sync.read(live.image),c=PNG.sync.read(restored.image),mask=PNG.sync.read(marker.image);
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 assert.deepEqual(a.data,c.data,'same-canvas optical revert should restore the original RGB');
 let changed=0,strong=0,alpha=0,peak=0,exterior=0;
 for(let i=0;i<a.data.length;i+=4){
  const x=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]));
  changed+=+(x>0);strong+=+(x>2);peak=Math.max(peak,x);alpha+=+(a.data[i+3]!==b.data[i+3]);
  if(x&&a.data[i]===mask.data[i]&&a.data[i+1]===mask.data[i+1]&&a.data[i+2]===mask.data[i+2])exterior++;
 }
 assert(changed>400&&strong>400&&peak>=7&&alpha===0&&exterior===0,JSON.stringify({changed,strong,peak,alpha,exterior}));
 assert.deepEqual(errors,[]);assert.deepEqual(current.layerWarnings,[]);
 const names=requests.map(x=>x[0]);
 assert.equal(names.filter(s=>s==='index.fcr.gz').length,1);
 assert.equal(names.filter(s=>s==='furrow-relief.webp').length,1);
 assert(names.some(s=>/^crop-\d\d\.pack$/.test(s)));
 if(standard)assert(names.every(n=>['index.fcr.gz','furrow-relief.webp',queens?'crop-19.pack':'crop-32.pack'].includes(n)),'Standard opened an unauthorized pack');
 proofs.push({mode,samePose:spatial(live.d),equalOpticalDraws:live.draws,site,
  distance:Math.hypot(current.x-start.x,current.z-start.z),aboveGround:current.altitude-current.groundY,
  fieldStream:standard?await page.evaluate(q=>(q?window.islandAirQueensFields:window.islandAirKingsFields)?.state.stream,queens):current.provinceFields,
  requests,changed,strong,peak,alpha,exterior,restored:true});
 await writeFile(out+'/mapped-farmland-'+mode+'-stock.png',stock.image);
 await writeFile(out+'/mapped-farmland-'+mode+'-live.png',live.image);
 await page.close();
 }

 const explicitStock=[];
 for(const [site,flag] of [[kingsSite,'stockKingsFieldPass'],[queensSite,'stockQueensFieldPass']]){
 const off=await browser.newPage({viewport:{width:510,height:340}});
 const stockRequests=[],stockErrors=[];
 off.on('pageerror',e=>stockErrors.push(e.message));
 off.on('request',r=>{const p=new URL(r.url()).pathname;if(/\/fields-province\/v2\/|\/furrow-relief\.webp$/.test(p))stockRequests.push(p);});
 const offURL=new URL('?diagnostics&departure='+site+'&'+flag,base);
 assert.equal((await off.goto(offURL.href,{waitUntil:'domcontentloaded',timeout:60_000})).status(),200);
 await off.waitForFunction(v=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.site===v,site,{timeout:65_000,polling:200});
 await off.getByRole('button',{name:'Begin flight'}).click({timeout:35_000});
 await off.waitForFunction(v=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===v,site,{timeout:40_000,polling:125});
 const offStart=await off.evaluate(()=>window.islandAirDiagnostics);
 await off.waitForFunction(a=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&d.site===a.site&&
  Math.hypot(d.x-a.x,d.z-a.z)>78;},offStart,{timeout:65_000,polling:160});
 const offState=await off.evaluate(()=>window.islandAirDiagnostics);
 assert.equal(offState.provinceFields,null);assert.equal(offState.cropRowsReview,false);
 assert.deepEqual(stockRequests,[]);assert.deepEqual(stockErrors,[]);
 explicitStock.push({site:offState.site,flag,travelled:Math.hypot(offState.x-offStart.x,offState.z-offStart.z),fieldRequests:stockRequests.length});
 await off.close();
 }
 const proof={proof:'Compiled native Standard and Expanded farmland. Actual flight then exact paused comparison and authority.',
  tests:proofs,explicitStock};
 await writeFile(out+'/mapped-farmland-kings.json',JSON.stringify(proof,null,2)+'\n');
 console.log(proof);
}finally{await browser.close();}
