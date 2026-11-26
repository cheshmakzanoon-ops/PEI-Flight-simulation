/** Matched player color/depth controls for one public exterior face. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const site='souris-waterfront-pass';
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const fromPng=(data)=>Buffer.from(data.slice(data.indexOf(',')+1),'base64');
const receipt={};
await mkdir(out,{recursive:true});
try{
 for(const mode of ['live','veto','link-refusal']){
  const page=await browser.newPage({viewport:{width:840,height:560}});
  page.setDefaultTimeout(145_000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',m=>{
   if(m.type()==='error'&&!m.text().includes('favicon.ico'))errors.push(m.text());
  });
  await page.addInitScript((refused)=>{
   const gl=WebGL2RenderingContext.prototype,method={};
   for(const k of ['shaderSource','attachShader','getProgramParameter','useProgram','drawArrays','drawElements'])method[k]=gl[k];
   const shaders=new WeakSet(),programs=new WeakSet(),current=new WeakMap(),locations=new WeakMap();
   const s=window.sourisWestQA={readyLinks:0,refusals:0,sources:0,hold:false,ask:null,last:null,counts:[],frame:null};
   gl.shaderSource=function(shader,src){
    if(src.includes('uniform float srsWestLive;')&&src.includes('schoolWestOriginalFacade')){
     shaders.add(shader);s.sources++;
     const brace=src.lastIndexOf('}');
     if(brace===-1)throw Error('No fragment main terminator for scoped QA witness');
     src=src.slice(0,brace)+'\n if(srsWestQa>.5&&schoolWestMark&&srsWestWeight(uv2d.x)>0.)gl_FragColor=vec4(1.,0.,1.,1.);\n'+src.slice(brace);
     src=src.replace('uniform float srsWestLive;','uniform float srsWestLive;\nuniform float srsWestQa;');
    }
    return method.shaderSource.call(this,shader,src);
   };
   gl.attachShader=function(program,shader){
    if(shaders.has(shader))programs.add(program);
    return method.attachShader.call(this,program,shader);
   };
   gl.getProgramParameter=function(program,k){
    const value=method.getProgramParameter.call(this,program,k);
    if(programs.has(program)&&k===this.LINK_STATUS){
     if(refused){s.refusals++;return false;}
     if(value)s.readyLinks++;
    }
    return value;
   };
   gl.useProgram=function(p){current.set(this,p);return method.useProgram.call(this,p);};
   function route(ctx,count,draw){
    const p=current.get(ctx);
    if(!s.ask||!p||!programs.has(p)||ctx.canvas.id!=='world'||ctx.getParameter(ctx.DRAW_FRAMEBUFFER_BINDING)!==null)return draw();
    if(!locations.has(p))locations.set(p,[ctx.getUniformLocation(p,'srsWestLive'),ctx.getUniformLocation(p,'srsWestQa')]);
    const [gain,witness]=locations.get(p);
    if(gain===null||witness===null)throw Error('Scoped fixture is missing its exact uniforms');
    const old=ctx.getUniform(p,gain),oldMask=ctx.getUniform(p,witness);
    s.counts.push({count,old,depth:ctx.isEnabled(ctx.DEPTH_TEST),write:ctx.getParameter(ctx.DEPTH_WRITEMASK)});
    ctx.uniform1f(gain,s.ask.kind==='baseline'?0:1);
    ctx.uniform1f(witness,s.ask.kind==='witness'?1:0);
    try{return draw();}finally{ctx.uniform1f(gain,old);ctx.uniform1f(witness,oldMask);}
   }
   gl.drawArrays=function(...args){return route(this,args[2],()=>method.drawArrays.apply(this,args));};
   gl.drawElements=function(...args){return route(this,args[1],()=>method.drawElements.apply(this,args));};
   const raf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=(cb)=>raf((stamp)=>{
    if(s.hold)stamp=s.last??stamp;
    s.last=stamp;s.counts=[];cb(stamp);
    if(s.ask&&s.counts.length){
     const canvas=document.getElementById('world'),ctx=canvas.getContext('webgl2');
     const d=window.islandAirDiagnostics;
     s.frame={tag:s.ask.tag,count:s.counts,ctx:ctx.getError(),x:d.x,z:d.z,draws:d.drawCalls,triangles:d.triangles,png:canvas.toDataURL()};
     s.ask=null;
    }
   });
  },mode==='link-refusal');
  const url=new URL(base);
  url.searchParams.set('diagnostics','');url.searchParams.set('departure',site);
  if(mode==='veto')url.searchParams.set('stockSourisWestFacing','');
  assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
  await page.waitForFunction(site=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.site===site,site);
  await page.getByRole('button',{name:'Begin flight'}).click();
  await page.waitForFunction(site=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics?.site===site,site);
  const start=await page.evaluate(()=>{const d=window.islandAirDiagnostics;return [d.x,d.z];});
  const march=async(m)=>{
   await page.evaluate(()=>{window.sourisWestQA.hold=false;});
   await page.waitForFunction(({start,m})=>{
    const d=window.islandAirDiagnostics;
    return d?.mode==='flight'&&d.camera==='Chase'&&d.buildingTiles?.ready>0&&Math.hypot(d.x-start[0],d.z-start[1])>=m;
   },{start,m},{polling:33});
  };
  if(mode!=='live'){
   await march(330);
   const s=await page.evaluate(()=>({active:window.islandAirDiagnostics.sourisWestFacing,source:window.sourisWestQA.sources,refusals:window.sourisWestQA.refusals,link:window.sourisWestQA.readyLinks}));
   assert.equal(s.active,false);
   if(mode==='veto')assert.equal(s.source,0);
   else assert(s.refusals>0&&s.source>0,'refusal did not exercise an actual linked program query');
   if(mode==='veto')assert.deepEqual(errors,[]);
   else assert(errors.every(v=>/WebGLProgram.*Shader Error|THREE\.WebGLProgram|VALIDATE_STATUS|Program Info Log/.test(v)),errors.join('\n'));
   receipt[mode]=s;
  }else{
   await page.waitForFunction(()=>window.islandAirDiagnostics?.sourisWestFacing&&window.sourisWestQA.readyLinks>0,{},{polling:100});
   receipt.live=[];
   for(const m of [215,315,405]){
    await march(m);
    await page.evaluate(()=>{window.sourisWestQA.hold=true;});
    const take=async(kind)=>{
     const tag=m+':'+kind;
     await page.evaluate(({kind,tag})=>{window.sourisWestQA.ask={kind,tag};},{kind,tag});
     await page.waitForFunction(tag=>window.sourisWestQA.frame?.tag===tag,tag);
     const q=await page.evaluate(()=>window.sourisWestQA.frame);
     assert.equal(q.ctx,0);assert.equal(q.count.length,1);assert.deepEqual(q.count[0],{count:13953,old:1,depth:true,write:true});
     return {...q,bytes:fromPng(q.png)};
    };
    const a=await take('baseline'),b=await take('live'),w=await take('witness'),restore=await take('baseline');
    for(const v of [b,w,restore])assert.deepEqual([v.x,v.z,v.draws,v.triangles],[a.x,a.z,a.draws,a.triangles]);
    const [pa,pb,pw,pc]=[a,b,w,restore].map(f=>PNG.sync.read(f.bytes));
    assert(pa.data.equals(pc.data),'could not restore stock frame');
    let mask=0,changed=0,changedOutside=0,changedStrong=0,alpha=0;
    for(let i=0;i<pa.data.length;i+=4){
     const w=Math.max(...[0,1,2].map(j=>Math.abs(pa.data[i+j]-pw.data[i+j])));
     const v=Math.max(...[0,1,2].map(j=>Math.abs(pa.data[i+j]-pb.data[i+j])));
     if(w)mask++;if(v)changed++;if(v>2)changedStrong++;if(v&&!w)changedOutside++;
     if(pa.data[i+3]!==pb.data[i+3])alpha++;
    }
    for(const f of [a,b,w])await writeFile(out+'/souris-west-'+f.tag.replace(':','-')+'.png',f.bytes);
    receipt.live.push({m,mask,changed,changedStrong,changedOutside,alpha,x:a.x,z:a.z,draws:a.draws,triangles:a.triangles});
    assert.equal(changedOutside,0);assert.equal(alpha,0);
   }
   assert(receipt.live.filter(x=>x.mask>=100&&x.changedStrong>=80).length>=2,'Two ordinary views must show the exact admitted face');
   assert.deepEqual(errors,[]);
  }
  console.log('Souris southwest face',mode,JSON.stringify(receipt[mode]));
  await page.close();
 }
}finally{
 await writeFile(out+'/souris-west-facing.json',JSON.stringify(receipt,null,2)+'\n');
 await browser.close();
}
