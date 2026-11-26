/** Real production flight, two existing shore owners and failed-link refuge. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const site='cape-tryon-coast',targetOwners=[1662,2730];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']});
try{
 const report={};
 for(const refuse of [false,true]){
  const page=await browser.newPage({viewport:{width:620,height:413}});
  page.setDefaultTimeout(120000);
  const errors=[],expected=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{
   if(e.type()!=='error'&&!/WebGL.*INVALID_/.test(e.text()))return;
   if(refuse&&e.text().startsWith('THREE.WebGLProgram: Shader Error')&&e.text().includes('force_rejected_tryon_material'))expected.push(e.text());
   else errors.push(e.text());
  });
  await page.addInitScript(({refuse,targetOwners})=>{
   const gl=WebGL2RenderingContext.prototype,actual={};
   for(const k of ['shaderSource','attachShader','getProgramParameter','useProgram','drawArrays'])actual[k]=gl[k];
   const shaders=new WeakMap,programs=new WeakMap,current=new WeakMap,slots=new WeakMap;
   const s=window.capeStoneQA={role:[],refused:0,compiled:0,hold:false,stamp:null,sample:null,frame:null,gain:null};
   gl.shaderSource=function(shader,src){
    if(src.includes('vec3 col=mix(vec3(.31,.194,.116)')&&!/eastRockWall|BasinWetReach|northCourtSigned/.test(src)){
     const authored=src.includes('tryonStoneCoverage');shaders.set(shader,{authored});
     if(authored){s.compiled++;if(refuse)src+='\nforce_rejected_tryon_material;\n';}
    }
    return actual.shaderSource.call(this,shader,src);
   };
   gl.attachShader=function(program,shader){
    if(shaders.has(shader))programs.set(program,shaders.get(shader));
    return actual.attachShader.call(this,program,shader);
   };
   gl.getProgramParameter=function(program,key){
    const v=actual.getProgramParameter.call(this,program,key);
    if(key===this.LINK_STATUS&&v===false&&programs.get(program)?.authored)s.refused++;
    return v;
   };
   gl.useProgram=function(program){current.set(this,program);return actual.useProgram.call(this,program);};
   gl.drawArrays=function(mode,first,count){
    const run=()=>actual.drawArrays.call(this,mode,first,count);
    const p=current.get(this),role=programs.get(p);
    if(!role||!targetOwners.includes(count)||!s.sample||this.canvas.id!=='world'||this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)!==null)return run();
    const loc=this.getAttribLocation(p,'position');
    if(loc<0)return run();
    const bind=this.getParameter(this.ARRAY_BUFFER_BINDING);
    const v=this.getVertexAttrib(loc,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
    let positions=null;
    if(v)try{
     this.bindBuffer(this.ARRAY_BUFFER,v);
     const bytes=this.getBufferParameter(this.ARRAY_BUFFER,this.BUFFER_SIZE);
     if(bytes===count*3*4){
      const out=new Uint8Array(bytes);this.getBufferSubData(this.ARRAY_BUFFER,0,out);
      positions=btoa(String.fromCharCode(...out));
     }
    }finally{this.bindBuffer(this.ARRAY_BUFFER,bind);}
    if(!role.authored){s.role.push({count,authored:false,positions});return run();}
    if(!slots.has(p))slots.set(p,{gain:this.getUniformLocation(p,'tryonRockGain'),
     all:this.getUniformLocation(p,'tryonRockAll'),uv:this.getAttribLocation(p,'uv')});
    const slot=slots.get(p),all=this.getUniform(p,slot.all),previous=this.getUniform(p,slot.gain);
    let marked=0,uvWitness=false;
    if(all===0&&slot.uv>=0){
     const a=this.getVertexAttrib(slot.uv,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
     const before=this.getParameter(this.ARRAY_BUFFER_BINDING);
     this.bindBuffer(this.ARRAY_BUFFER,a);
     try{
      const bytes=this.getBufferParameter(this.ARRAY_BUFFER,this.BUFFER_SIZE);
      if(bytes===count*2*4){
       const uv=new Float32Array(bytes/4);
       this.getBufferSubData(this.ARRAY_BUFFER,0,uv);
       let valid=true;
       for(let p=0;p<uv.length;p+=2){
        valid&&=(uv[p]===0||uv[p]===1)&&uv[p+1]===0;
        marked+=Number(uv[p]===1);
       }
       uvWitness=valid;
      }
     }finally{this.bindBuffer(this.ARRAY_BUFFER,before);}
    }
    s.role.push({count,authored:true,all,marked,uvWitness,previous,positions});
    if(s.gain===null)return run();
    this.uniform1f(slot.gain,s.gain);
    try{return run();}finally{this.uniform1f(slot.gain,previous);}
   };
   const raf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=cb=>raf(stamp=>{
    const t=s.hold?(s.stamp??stamp):stamp;s.stamp=t;s.role=[];
    cb(t);
    if(s.sample&&s.role.length){
     const canvas=document.getElementById('world'),g=canvas.getContext('webgl2');
     s.frame={tag:s.sample,role:s.role.slice(),diag:window.islandAirDiagnostics,png:canvas.toDataURL(),
      code:g.getError(),compiled:s.compiled,refused:s.refused};
     s.sample=null;
    }
   });
  },{refuse,targetOwners});
  const url=new URL('?diagnostics&departure='+site+'&capeTryonRockReview',base);
  assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
  await page.waitForFunction(v=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.site===v,site);
  const sample=()=>page.evaluate(()=>{
   const d=window.islandAirDiagnostics,s=window.capeStoneQA;
   return {phase:d?.tryonRockState,active:d?.tryonRockPreview,repair:d?.tryonCoast,
    authoredSources:s.compiled,refused:s.refused,drawCalls:d?.drawCalls,mode:d?.mode};
  });
  console.log('Cape Stone dispatch',refuse?'refused':'normal',await sample());
  try{
   await page.waitForFunction(rejected=>{
    const d=window.islandAirDiagnostics,s=window.capeStoneQA;
    if(d?.tryonRockState?.startsWith('stock-')||d?.tryonRockState?.startsWith('missing-owners'))return true;
    return rejected?s.refused>0&&d?.tryonRockState==='stock-link':d?.tryonRockPreview===true;
   },refuse,{polling:150,timeout:100000});
  }finally{console.log('Cape Stone link result',refuse?'refused':'normal',await sample(),errors);}
  const admitted=await sample();
  assert.equal(admitted.phase,refuse?'stock-link':'live',JSON.stringify(admitted));
  assert.equal(admitted.active,!refuse);
  if(refuse)assert(admitted.refused>0,JSON.stringify(admitted));
  await page.getByRole('button',{name:'Begin flight'}).click();
  await page.waitForFunction(v=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===v,site);
  const start=await page.evaluate(()=>window.islandAirDiagnostics);
  await page.waitForFunction(s=>{
   const d=window.islandAirDiagnostics;
   if(d?.mode!=='flight'||d.site!==s.site||d.camera!=='Chase'||(d.tryonCoast?.refined??0)!==1)return false;
   const meters=Math.hypot(d.x-s.x,d.z-s.z);
   return meters>=250&&meters<440&&d.altitude-d.groundY>=70;
  },start,{polling:70});
  await page.keyboard.press('p');
  await page.waitForFunction(()=>{const d=window.islandAirDiagnostics;return d?.mode==='paused'&&d.detail?.loading===0&&d.roads&&d.buildings&&d.mainland;},undefined,{polling:160});
  await page.evaluate(async()=>{
   window.capeStoneQA.hold=true;
   await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done())));
  });
  async function frame(tag,gain){
   await page.evaluate(({tag,gain})=>{const s=window.capeStoneQA;s.gain=gain;s.sample=tag;},{tag,gain});
   await page.waitForFunction(tag=>window.capeStoneQA.frame?.tag===tag,tag,{polling:70});
   const f=await page.evaluate(()=>window.capeStoneQA.frame);
   assert.equal(f.code,0);
   assert.deepEqual(f.role.map(x=>x.count).sort((a,b)=>a-b),targetOwners);
   assert.equal(f.diag.tryonRockPreview,!refuse);
   f.role=f.role.map(({positions,...q})=>{
    assert(positions,'expected an existing direct position buffer');
    return {...q,positionSha256:createHash('sha256').update(Buffer.from(positions,'base64')).digest('hex')};
   });
   return {...f,bytes:Buffer.from(f.png.split(',')[1],'base64')};
  }
  const neutral=await frame('previous',0),live=await frame('live',null),restored=await frame('restored',0);
  const spatial=d=>[d.x,d.z,d.altitude,d.heading,d.bank,d.camera,d.triangles,d.drawCalls];
  assert.deepEqual(spatial(neutral.diag),spatial(live.diag));assert.deepEqual(spatial(live.diag),spatial(restored.diag));
  const a=PNG.sync.read(neutral.bytes),b=PNG.sync.read(live.bytes),r=PNG.sync.read(restored.bytes);
  assert.deepEqual(a.data,r.data);
  let changedGt2=0,alpha=0;
  for(let i=0;i<a.data.length;i+=4){
   changedGt2+=+(Math.max(...[0,1,2].map(j=>Math.abs(a.data[i+j]-b.data[i+j])))>2);
   alpha+=+(a.data[i+3]!==b.data[i+3]);
  }
  assert.equal(alpha,0);
  const positions=q=>q.role.map(v=>[v.count,v.positionSha256]).sort(([a],[b])=>a-b);
  assert.deepEqual(positions(neutral),positions(live));assert.deepEqual(positions(live),positions(restored));
  if(refuse){
   assert.deepEqual(positions(live),positions(report.active),'the refused link keeps both actual original position buffers');
   assert(live.compiled>0&&live.refused>0);
   assert(live.role.every(q=>!q.authored)&&changedGt2===0);
   assert.deepEqual(a.data,b.data);
  }else{
   const old=live.role.find(q=>q.count===2730),curve=live.role.find(q=>q.count===1662);
   assert(old.authored&&old.all===0&&old.uvWitness&&old.marked===30&&old.previous===1);
   assert(curve.authored&&curve.all===1&&curve.previous===1);
   assert(changedGt2>350);
  }
  assert.deepEqual(errors,[]);
  const run=refuse?'invalid-link':'active';
  report[run]={samePose:spatial(live.diag),owners:live.role,changedGt2,alpha,compiled:live.compiled,refused:live.refused,expectedShaderErrors:expected.length,
   distance:Math.hypot(live.diag.x-start.x,live.diag.z-start.z)};
  if(!refuse)await writeFile(out+'/cape-stone-previous.png',neutral.bytes);
  await writeFile(out+'/cape-stone-'+run+'.png',live.bytes);
  await page.close();
 }
 await writeFile(out+'/cape-stone.json',JSON.stringify(report,null,2)+'\n');
 console.log(report);
}finally{await browser.close();}
