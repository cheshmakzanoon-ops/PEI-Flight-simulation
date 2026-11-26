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
  const s=window.capeWetQA={sample:null,roles:[],gain:null,sky:null,quant:0,hold:false,stamp:null,frame:null};
  gl.shaderSource=function(shader,src){
   if(src.includes('uniform float skyDiagnostic')&&src.includes('vec3 skyRay')){
    shaders.set(shader,'sky');
    src=src.replace('gl_FragColor=vec4(1.,0.,1.,1.);return;',
       'gl_FragColor=skyDiagnostic>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;');
   }else if(src.includes('float filteredWave')&&src.includes('float ndv')){
    const patch=src.includes('preciseCapeWet');shaders.set(shader,patch?'patch':'ocean');
    // The natural path runs with quant=0. A separate diagnostic reproduces
    // an old rounded-zero backend on the same signed source at this pose.
    const k='float foamPixelM=length(fwidth(q));';
    if(src.split(k).length!==2)throw Error('missing old water sign witness');
    src=src.replace('void main(){','uniform float capeWetQAQuant;\nvoid main(){');
    src=src.replace(k,`if(capeWetQAQuant>.5&&abs(shore)<.96&&p.x>=-23800.&&p.x<=-23290.&&p.z>=-3920.&&p.z<=-3610.)shore=0.;
      `+k);
    if(patch){
     const edge='if(!(capeWetPass>=.5)||shore!=0.';
     if(src.split(edge).length!==2)throw Error('missing exact tie guard');
     // Gain 2 is an independent admission witness on the existing
     // far-depth buffer. It does not relax the original zero predicate.
     src=src.replace('shore=exact;','shore=exact; if(capeWetPass>1.5){gl_FragDepth=1.;gl_FragColor=vec4(1.,.12,0.,1.);return;}');
    }
   }
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
   if(role!=='sky'&&role!=='patch'&&role!=='ocean')return draw();
   if(!locs.has(p))locs.set(p,{
    mode:g.getUniformLocation(p,role==='sky'?'skyDiagnostic':'capeWetPass'),
    quant:g.getUniformLocation(p,'capeWetQAQuant')});
   const slots=locs.get(p),saved=[];
   function set(slot,v){
    if(slot===null||v===null)return;
    saved.push([slot,g.getUniform(p,slot)]);
    g.uniform1f(slot,v);
   }
   if(role==='patch')Object.assign(rec,{gate:g.getUniform(p,slots.mode),depthFunc:g.getParameter(g.DEPTH_FUNC),depthTest:g.isEnabled(g.DEPTH_TEST),
     depthWrite:g.getParameter(g.DEPTH_WRITEMASK),blend:g.isEnabled(g.BLEND),clear:g.getParameter(g.DEPTH_CLEAR_VALUE),
     samples:g.getParameter(g.SAMPLES)});
   set(slots.quant,s.quant);
   set(slots.mode,role==='sky'?s.sky:s.gain);
   try{return draw();}finally{for(const [slot,value] of saved)g.uniform1f(slot,value);}

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
 async function capture(tag,gain,sky=null,quant=0){
  await page.evaluate(({tag,gain,sky,quant})=>{const s=window.capeWetQA;Object.assign(s,{gain,sky,quant,sample:tag});},{tag,gain,sky,quant});
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
 const pose=f=>[f.poses.x,f.poses.z,f.poses.altitude,f.poses.heading,f.poses.bank,f.poses.camera,f.poses.triangles,f.poses.drawCalls];
 function diff(a,b,i){return Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));}
 async function compare(name,quant){
  const [off,on,restored]=[
   await capture(name+'-off',0,null,quant),await capture(name+'-on',null,null,quant),await capture(name+'-restored',0,null,quant)];
  const oldA=await capture(name+'-old-a',0,1,quant),oldB=await capture(name+'-old-b',0,2,quant);
  const nowA=await capture(name+'-new-a',null,1,quant),nowB=await capture(name+'-new-b',null,2,quant);
  const attempted=await capture(name+'-witness',2,null,quant);
  for(const f of [on,restored,oldA,oldB,nowA,nowB,attempted])assert.deepEqual(pose(f),pose(off));
  assert.deepEqual(off.rgb,restored.rgb);
  let changed=0,outside=0,exactOutside=0,newSky=0,closed=0,alpha=0,visibleWitness=0,witnessOutside=0;
  for(let i=0;i<off.rgb.length;i+=4){
   const bg=diff(oldA.rgb,oldB.rgb,i),after=diff(nowA.rgb,nowB.rgb,i);
   const d=diff(off.rgb,on.rgb,i),visible=diff(off.rgb,attempted.rgb,i)>2;
   changed+=+(d>2);outside+=+(d>2&&bg<=1);exactOutside+=+(d!==0&&bg===0);newSky+=+(bg<=1&&after>1);
   closed+=+(bg-after>2);alpha+=+(off.rgb[i+3]!==on.rgb[i+3]);visibleWitness+=+visible;
   witnessOutside+=+(visible&&bg===0);
  }
  const report={pose:pose(off),patch:off.patch,changed,outside,exactOutside,newSky,closed,alpha,visibleWitness,witnessOutside};
  // Preserve witness frames even when an assertion below fails.
  await writeFile(out+'/cape-water-'+name+'-previous.png',off.bytes);
  await writeFile(out+'/cape-water-'+name+'-active.png',on.bytes);
  console.log(name,report);
  assert(outside===0&&exactOutside===0&&newSky===0&&alpha===0&&witnessOutside===0,JSON.stringify(report));
  if(visibleWitness===0){assert.equal(changed,0);assert.equal(closed,0);}
  else assert(changed>0&&closed>0);
  return report;
 }
 // Tiny independent measurement of this driver's RG8 linear interpolation;
 // the diagnostic context is not the simulator's context.
 const sampler=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=8;c.height=1;
  const g=c.getContext('webgl2',{alpha:true,antialias:false});
  if(!g)throw Error('detached RG8 diagnostic WebGL2 unavailable');
  const program=g.createProgram();
  const verts='#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(2.*p-1.,0.,1.);}';
  const frag=`#version 300 es
   precision highp float;precision highp int;
   uniform sampler2D src;
   out vec4 color;
   void main(){
    float ts[8]=float[8](0.,.25,.5,.75,.875,.9375,.984375,1.);
    float t=ts[int(gl_FragCoord.x)];
    float d=(texture(src,vec2(.25+.5*t,.5)).g*255.-128.)*2.;
    uint p=floatBitsToUint(d);
    color=vec4(uvec4(p&255u,(p>>8)&255u,(p>>16)&255u,p>>24))/255.;
   }`;
  for(const [kind,text] of [[g.VERTEX_SHADER,verts],[g.FRAGMENT_SHADER,frag]]){
   const shader=g.createShader(kind);g.shaderSource(shader,text);g.compileShader(shader);
   if(!g.getShaderParameter(shader,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(shader));
   g.attachShader(program,shader);
  }
  g.linkProgram(program);
  if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));
  g.useProgram(program);g.disable(g.DITHER);
  const tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);
  g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
  g.texImage2D(g.TEXTURE_2D,0,g.RG8,2,2,0,g.RG,g.UNSIGNED_BYTE,new Uint8Array([0,127,0,128,0,127,0,128]));
  g.viewport(0,0,8,1);g.drawArrays(g.TRIANGLES,0,3);
  const pixel=new Uint8Array(32);g.readPixels(0,0,8,1,g.RGBA,g.UNSIGNED_BYTE,pixel);
  if(g.getError()!==0)throw Error('RG8 probe generated a GL error');
  const v=new DataView(pixel.buffer),weights=[0,.25,.5,.75,.875,.9375,.984375,1];
  return weights.map((t,i)=>({weight:t,linear:v.getFloat32(i*4,true),precise:2*(t-1)}));
 });
 assert(sampler.every(x=>Number.isFinite(x.linear)));
 console.log('Detached RG8 response',sampler);
 const natural=await compare('natural',0);
 const roundedZero=await compare('rounded-zero-fixture',1);
 assert(roundedZero.changed>75&&roundedZero.closed>75&&roundedZero.visibleWitness>75,JSON.stringify(roundedZero));
 assert.deepEqual(errors,[]);
 await writeFile(out+'/cape-water.json',JSON.stringify({sampler,natural,roundedZero,
  distinction:'Natural is untouched SwiftShader graphics arithmetic. Rounded-zero is an explicitly forced QA-only backend fixture at the same raw signed terrain and pose.'},null,2)+'\n');
}finally{await browser.close();}
