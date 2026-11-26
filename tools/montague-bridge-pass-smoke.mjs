/** Playable low river pass and guarded source fallback on the compiled atlas. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const bridge=[42373.87286805469,37357.55220951266];
const site='montague-bridge-low',old='montague',plan='montague-bridge-channel-preview';
const path='/world/montague/v0/foundation.preview.gz';
const name='Montague · river bridge pass';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const receipt={};
try{
 for(const mode of ['live','stock','wrong-body']){
  const page=await browser.newPage({viewport:{width:760,height:507},deviceScaleFactor:1});
  page.setDefaultTimeout(120_000);
  const errors=[];
  let reads=0;
  page.on('request',r=>{if(new URL(r.url()).pathname.endsWith(path))reads++;});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error'&&!msg.text().includes('favicon.ico'))errors.push(msg.text());});
  if(mode==='wrong-body')await page.route('**'+path,route=>route.fulfill({
   status:200,contentType:'application/gzip',body:gzipSync(Buffer.alloc(111524)),
  }));
  if(mode==='live')await page.addInitScript(([x,z])=>{
   const gl=WebGL2RenderingContext.prototype,methods={use:gl.useProgram,draw:gl.drawArrays};
   const programs=new WeakMap(),locations=new WeakMap(),s=window.montagueRouteQA={ask:null,frame:null,draws:[],hold:false,last:null,pose:null};
   gl.useProgram=function(p){programs.set(this,p);return methods.use.call(this,p);};
   gl.drawArrays=function(...a){
    if(s.ask&&this.canvas.id==='world'&&[15210,7500,8922,16488,72,1416,1044].includes(a[2])&&
       this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)===null){
     const p=programs.get(this);
     if(p){
      if(!locations.has(p))locations.set(p,[
       this.getUniformLocation(p,'modelMatrix'),this.getUniformLocation(p,'modelViewMatrix'),
      ]);
      const [world,view]=locations.get(p),m=world?this.getUniform(p,world):null;
      const v=view?Array.from(this.getUniform(p,view)).slice(12,15):null;
      if(v&&a[2]===15210&&m&&Math.abs(m[12]-x)<.025&&Math.abs(m[14]-z)<.025)s.pose=v;
      if(v){
       s.draws.push({vertices:a[2],v,depth:this.isEnabled(this.DEPTH_TEST),write:this.getParameter(this.DEPTH_WRITEMASK)});
       if(s.ask==='omit'&&s.pose?.every((c,i)=>Math.abs(c-v[i])<.025))return;
      }
     }
    }
    return methods.draw.apply(this,a);
   };
   const raf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=cb=>raf(stamp=>{
    if(s.hold)stamp=s.last??stamp;
    s.last=stamp;s.draws=[];cb(stamp);
    if(s.ask){
     const c=document.getElementById('world'),g=c.getContext('webgl2');
     s.frame={mode:s.ask,draws:s.draws.filter(r=>s.pose?.every((v,i)=>Math.abs(v-r.v[i])<.025)).map(({v,...draw})=>draw),err:g.getError(),png:c.toDataURL(),at:window.islandAirDiagnostics};
     s.ask=null;
    }
   });
  },bridge);
  try{
   const url=new URL(base);
   url.searchParams.set('diagnostics','');
   url.searchParams.set('departure',mode==='live'?site:old);
   if(mode!=='stock')url.searchParams.set('montagueFoundationPreview','');
   assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
   await page.waitForFunction(id=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.site===id,mode==='live'?site:old);
   assert.equal(await page.locator('#map-site option').filter({hasText:name}).count(),mode==='live'?1:0);
   const start=await page.evaluate(()=>window.islandAirDiagnostics);
   assert.equal(start.montagueFoundation,mode==='live'?plan:null);
   assert.equal(reads,mode==='stock'?0:1);
   await page.getByRole('button',{name:'Begin flight'}).click();
   const minTravel=mode==='live'?305:115;
   await page.waitForFunction(({start,minTravel})=>{
    const d=window.islandAirDiagnostics;
    return d?.mode==='flight'&&d.camera==='Chase'&&d.roads&&d.mainland&&
      d.detail?.ready>0&&!d.detail.loading&&Math.hypot(d.x-start.x,d.z-start.z)>minTravel;
   },{start,minTravel},{polling:60,timeout:160_000});
   const d=await page.evaluate(()=>window.islandAirDiagnostics);
   assert.equal(d.montagueFoundation,mode==='live'?plan:null);
   assert.equal(d.montagueBridge,mode==='live');
   assert.deepEqual(d.layerWarnings,[]);
   assert.deepEqual(errors,[]);
   const travelled=Math.hypot(d.x-start.x,d.z-start.z);
   receipt[mode]={start:[start.x,start.altitude,start.z],travelled,reads,foundation:d.montagueFoundation,bridge:d.montagueBridge};
   if(mode==='live'){
    assert(start.altitude>60&&start.altitude<68);
    assert(Math.hypot(d.x-bridge[0],d.z-bridge[1])<385);
    await page.keyboard.press('p');
    await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='paused');
    await page.evaluate(()=>{window.montagueRouteQA.hold=true;});
    const sample=async(kind)=>{
     await page.evaluate(k=>{window.montagueRouteQA.ask=k;},kind);
     await page.waitForFunction(k=>window.montagueRouteQA.frame?.mode===k,kind);
     const f=await page.evaluate(()=>window.montagueRouteQA.frame);
     assert.equal(f.err,0);
     for(const v of [15210,7500,8922,16488])assert(f.draws.some(k=>k.vertices===v&&k.depth&&k.write),JSON.stringify(f.draws));
     return {...f,bytes:Buffer.from(f.png.split(',')[1],'base64')};
    };
    const on=await sample('normal'),off=await sample('omit');
    assert.deepEqual([on.at.x,on.at.z,on.at.altitude],[off.at.x,off.at.z,off.at.altitude]);
    const a=PNG.sync.read(on.bytes),b=PNG.sync.read(off.bytes);
    assert.deepEqual([a.width,a.height],[b.width,b.height]);
    let changed=0,alpha=0;
    for(let i=0;i<a.data.length;i+=4){
     if(Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),
      Math.abs(a.data[i+2]-b.data[i+2]))>6)changed++;
     if(a.data[i+3]!==b.data[i+3])alpha++;
    }
    assert(changed>=50&&alpha===0,JSON.stringify({changed,alpha,draws:on.draws}));
    Object.assign(receipt[mode],{draws:on.draws,strongChangedPixels:changed,alpha,viewport:[a.width,a.height]});
    await writeFile(out+'/montague-bridge-normal.png',on.bytes);
    await writeFile(out+'/montague-bridge-draw-omitted.png',off.bytes);
   }
   console.log('Montague bridge pass',mode,receipt[mode]);
  }finally{await page.close();}
 }
 await writeFile(out+'/montague-bridge-pass.json',JSON.stringify(receipt,null,2)+'\n');
}finally{await browser.close();}
