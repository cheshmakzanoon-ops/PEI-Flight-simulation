/** Actual flight and depth-sample scope of the optional Cape ocean gap fill. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const site='cape-tryon-coast';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:620,height:413}});
 page.setDefaultTimeout(120000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',e=>{if(e.type()==='error'||/WebGL.*INVALID_/.test(e.text()))errors.push(e.text());});
 await page.addInitScript(()=>{
  const gl=WebGL2RenderingContext.prototype,actual={};
  for(const k of ['shaderSource','attachShader','useProgram','drawArrays','drawElements'])actual[k]=gl[k];
  const shaders=new WeakMap,programs=new WeakMap,current=new WeakMap,locs=new WeakMap;
  const s=window.capeWetQA={sample:null,roles:[],gain:null,sky:null,hold:false,stamp:null,frame:null};
  gl.shaderSource=function(shader,src){
   if(src.includes('uniform float skyDiagnostic')&&src.includes('vec3 skyRay')){
    shaders.set(shader,'sky');
    src=src.replace('gl_FragColor=vec4(1.,0.,1.,1.);return;',
       'gl_FragColor=skyDiagnostic>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;');
   }else if(src.includes('preciseCapeWet'))shaders.set(shader,'patch');
   else if(src.includes('float filteredWave')&&src.includes('float ndv'))shaders.set(shader,'ocean');
   else if(src.includes('vec3 col=mix(vec3(.31,.194,.116)'))shaders.set(shader,'curtain');
   else if(src.includes('float meadowFootprint')||src.includes('amount<=0.)col=textureGrad(imageMap'))shaders.set(shader,'terrain');
   return actual.shaderSource.call(this,shader,src);
  };
  gl.attachShader=function(program,shader){
   if(shaders.has(shader))programs.set(program,shaders.get(shader));
   return actual.attachShader.call(this,program,shader);
  };
  gl.useProgram=function(program){current.set(this,program);return actual.useProgram.call(this,program);};
  function route(g,count,draw){
   const p=current.get(g),role=programs.get(p);
   if(!s.sample||!role||g.canvas.id!=='world'||g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)!==null)return draw();
   const rec={role,count};s.roles.push(rec);
   if(role!=='sky'&&role!=='patch')return draw();
   if(!locs.has(p))locs.set(p,g.getUniformLocation(p,role==='sky'?'skyDiagnostic':'capeWetPass'));
   const slot=locs.get(p);
   if(slot===null)return draw();
   const prev=g.getUniform(p,slot),val=role==='sky'?s.sky:s.gain;
   if(role==='patch')Object.assign(rec,{gate:prev,depthFunc:g.getParameter(g.DEPTH_FUNC),depthTest:g.isEnabled(g.DEPTH_TEST),
     depthWrite:g.getParameter(g.DEPTH_WRITEMASK),blend:g.isEnabled(g.BLEND),clear:g.getParameter(g.DEPTH_CLEAR_VALUE),
     samples:g.getParameter(g.SAMPLES)});
   if(val===null)return draw();
   g.uniform1f(slot,val);
   try{return draw();}finally{g.uniform1f(slot,prev);}
  }
  gl.drawArrays=function(...a){return route(this,a[2],()=>actual.drawArrays.apply(this,a));};
  gl.drawElements=function(...a){return route(this,a[1],()=>actual.drawElements.apply(this,a));};
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>raf(stamp=>{
   const t=s.hold?(s.stamp??stamp):stamp;s.stamp=t;s.roles=[];cb(t);
   if(s.sample&&s.roles.some(x=>x.role==='patch')){
    const c=document.getElementById('world'),g=c.getContext('webgl2');
    s.frame={tag:s.sample,poses:window.islandAirDiagnostics,roles:s.roles,err:g.getError(),png:c.toDataURL()};
    s.sample=null;
   }
  });
 });
 const url=new URL('?diagnostics&departure='+site+'&capeTryonWaterReview',base);
 assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
 await page.waitForFunction(v=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.site===v,site);
 await page.getByRole('button',{name:'Begin flight'}).click();
 await page.waitForFunction(v=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===v,site);
 const start=await page.evaluate(()=>window.islandAirDiagnostics);
 try{
  await page.waitForFunction(s=>{
   const d=window.islandAirDiagnostics;
   const m=d?Math.hypot(d.x-s.x,d.z-s.z):0;
   return d?.mode==='flight'&&d.capeWetState==='live'&&d.camera==='Chase'&&m>=368&&m<=445;
  },start,{polling:55});
 }finally{
  console.log('Cape wet moving',await page.evaluate(()=>{
   const d=window.islandAirDiagnostics;return {mode:d?.mode,camera:d?.camera,x:d?.x,z:d?.z,state:d?.capeWetState,detail:d?.detail};
  }),errors);
 }
 await page.keyboard.press('p');
 await page.waitForFunction(()=>{const d=window.islandAirDiagnostics;return d?.mode==='paused'&&d.detail?.loading===0&&d.roads&&d.buildings&&d.mainland;});
 await page.evaluate(async()=>{
  window.capeWetQA.hold=true;
  await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(()=>ok())));
 });
 async function capture(tag,gain,sky=null){
  await page.evaluate(({tag,gain,sky})=>{const s=window.capeWetQA;Object.assign(s,{gain,sky,sample:tag});},{tag,gain,sky});
  await page.waitForFunction(v=>window.capeWetQA.frame?.tag===v,tag,{polling:100});
  const f=await page.evaluate(()=>window.capeWetQA.frame);
  assert.equal(f.err,0);assert.equal(f.poses.capeWetState,'live');assert.equal(f.poses.mode,'paused');
  const p=f.roles.filter(x=>x.role==='patch');assert.equal(p.length,1);
  const patch=p[0];
  assert.equal(patch.gate,1);assert.equal(patch.count,132);
  assert.equal(patch.depthFunc,514);assert(patch.depthTest&&!patch.depthWrite&&!patch.blend);assert.equal(patch.clear,1);
  const at=f.roles.indexOf(patch);
  for(const role of ['terrain','ocean','curtain','sky']){
   const ri=f.roles.findLastIndex(x=>x.role===role);
   assert(ri>=0&&ri<at,JSON.stringify({role,ri,at}));
  }
  const bytes=Buffer.from(f.png.split(',')[1],'base64');
  return {...f,patch,bytes,rgb:PNG.sync.read(bytes).data};
 }
 const off=await capture('off',0),on=await capture('on',null),restored=await capture('restored',0);
 const oldA=await capture('old-a',0,1),oldB=await capture('old-b',0,2);
 const nowA=await capture('new-a',null,1),nowB=await capture('new-b',null,2);
 const pose=f=>[f.poses.x,f.poses.z,f.poses.altitude,f.poses.heading,f.poses.bank,f.poses.camera,f.poses.triangles,f.poses.drawCalls];
 for(const f of [on,restored,oldA,oldB,nowA,nowB])assert.deepEqual(pose(f),pose(off));
 assert.deepEqual(off.rgb,restored.rgb);
 function diff(a,b,i){return Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));}
 let changed=0,outside=0,exactOutside=0,newSky=0,closed=0,alpha=0;
 for(let i=0;i<off.rgb.length;i+=4){
  const bg=diff(oldA.rgb,oldB.rgb,i),after=diff(nowA.rgb,nowB.rgb,i);
  const d=diff(off.rgb,on.rgb,i);
  changed+=+(d>2);outside+=+(d>2&&bg<=1);exactOutside+=+(d!==0&&bg===0);newSky+=+(bg<=1&&after>1);
  closed+=+(bg-after>2);alpha+=+(off.rgb[i+3]!==on.rgb[i+3]);
 }
 const report={pose:pose(off),patch:off.patch,changed,outside,exactOutside,newSky,closed,alpha};
 assert(changed>75&&closed>75&&outside===0&&exactOutside===0&&newSky===0&&alpha===0,JSON.stringify(report));
 assert.deepEqual(errors,[]);
 await writeFile(out+'/cape-water-previous.png',off.bytes);
 await writeFile(out+'/cape-water-closed.png',on.bytes);
 await writeFile(out+'/cape-water.json',JSON.stringify(report,null,2)+'\n');
 console.log(report);
}finally{await browser.close();}
