/** Real compiled Summerside route with fixed-frame q68 material-only pixel proof.
 * Browser clock manipulation begins only after an ordinary flight and pause.
 * A deliberately invalid isolated shader proves fallback without an invalid shipped script.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const fixture=JSON.parse(await readFile(new URL('./q68-fixture/terminal-stock-owner.json',import.meta.url)));
const origin=fixture.origin.map(Math.fround),walls=[];
for(let i=0;i<fixture.localRows.length;i+=3){
 const tri=fixture.localRows.slice(i,i+3);
 assert(tri.every(q=>q[3]===tri[0][3]));
 if(!tri[0][3])walls.push(tri.map(([x,y,z])=>[x+origin[0],y,z+origin[2],1]));
}
assert.equal(walls.length,100);
const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const drops=[[30618,30666],[51228,51429],[65946,65988]];
const complete=Uint32Array.from(Array.from({length:69906},(_,i)=>i).filter(i=>!drops.some(([a,b])=>i>=a&&i<b)));
const actorsOnly=69615;
assert.equal(complete.length,actorsOnly);
const maskDigest=createHash('sha256').update(Buffer.from(complete.buffer)).digest('hex');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({
 executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'],
});
const result={};
function mat(M,q){return [0,1,2,3].map(i=>M[i]*q[0]+M[i+4]*q[1]+M[i+8]*q[2]+M[i+12]*q[3]);}
function wallPixelCheck(neutral,active,view,projection){
 const a=PNG.sync.read(neutral),b=PNG.sync.read(active),W=a.width,H=a.height;
 assert.equal(W,b.width);assert.equal(H,b.height);
 const visible=walls.map(t=>t.map(q=>{
  const [x,y,z,w]=mat(projection,mat(view,q));
  assert(w>0&&Math.abs(z/w)<1);return [(x/w+1)*W/2,(1-y/w)*H/2];
 })).filter(t=>Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]))>1e-5);
 const margin=2,inside=([x,y],t)=>{
  let plus=false,minus=false,min=Infinity;
  for(let i=0;i<3;i++){
   const c=t[i],d=t[(i+1)%3],u=d[0]-c[0],v=d[1]-c[1],j=x-c[0],k=y-c[1],n=u*k-v*j;
   const a=Math.max(0,Math.min(1,(j*u+k*v)/(u*u+v*v)));
   min=Math.min(min,(j-u*a)**2+(k-v*a)**2);plus||=n>0;minus||=n<0;
  }
  return !(plus&&minus)||min<=margin**2;
 };
 let changedRgb=0,outside=0,alpha=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const k=(y*W+x)*4;
  if(a.data[k+3]!==b.data[k+3])alpha++;
  if(a.data[k]===b.data[k]&&a.data[k+1]===b.data[k+1]&&a.data[k+2]===b.data[k+2])continue;
  changedRgb++;
  if(!visible.some(t=>inside([x+.5,y+.5],t)))outside++;
 }
 assert.ok(changedRgb>100&&outside===0&&alpha===0,JSON.stringify({changedRgb,outside,alpha}));
 return {changedRgb,outside,alpha,width:W,height:H};
}
try{
 for(const mode of ['active','refused']){
  const page=await browser.newPage({viewport:{width:540,height:360}});
  page.setDefaultTimeout(95_000);
  const errors=[],rejected=[],requests=[],logs=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))errors.push(`${r.status()} ${r.url()}`);});
  page.on('request',r=>{
   if(new URL(r.url()).pathname.endsWith('buildings/tiles.pack'))requests.push(r.headers().range??'none');
  });
  page.on('console',m=>{
   const msg=m.text();if(m.type()==='warning'&&!/WebGL.*INVALID/.test(msg))return;
   if(m.type()!=='error'&&m.type()!=='warning')return;
   if(mode==='refused'&&msg.startsWith('THREE.WebGLProgram: Shader Error')&&msg.includes('VALIDATE_STATUS'))rejected.push(msg);
   else errors.push(msg);
  });
  await page.addInitScript(({origin,refuse,actorsOnly})=>{
   const raf=window.requestAnimationFrame.bind(window),proto=WebGL2RenderingContext.prototype;
   const sh=proto.shaderSource,attach=proto.attachShader,parameter=proto.getProgramParameter,use=proto.useProgram;
   const elements=proto.drawElements,arrays=proto.drawArrays,uniform=proto.getUniformLocation;
   const shaders=new WeakSet(),candidates=new WeakSet(),current=new WeakMap(),slots=new WeakMap();
   const s=window.terminalWallSmoke={freeze:false,clock:null,request:null,target:null,frame:null,gain:-1,
    candidateDraws:0,stockDraws:0,candidateSources:0,refused:0,errors:[]};
   let originalSky=null;
   proto.shaderSource=function(q,code){
    if(code.includes('terminalWallLive')&&code.includes('q68OuterWall')){
     shaders.add(q);s.candidateSources++;
     if(refuse)code+='\nq68_forced_invalid_fragment_token\n';
    }
    return sh.call(this,q,code);
   };
   proto.attachShader=function(p,q){if(shaders.has(q))candidates.add(p);return attach.call(this,p,q);};
   proto.getProgramParameter=function(p,key){
    const value=parameter.call(this,p,key);
    if(refuse&&key===this.LINK_STATUS&&candidates.has(p)&&value===false)s.refused++;
    return value;
   };
   proto.useProgram=function(p){current.set(this,p);return use.call(this,p);};
   function observe(gl,draw,c,call){
    const p=current.get(gl);
    if(!p||!c||gl.canvas!==document.querySelector('#world')||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null)return call();
    if(!slots.has(p))slots.set(p,{
     gain:uniform.call(gl,p,'terminalWallLive'),view:uniform.call(gl,p,'viewMatrix'),
     proj:uniform.call(gl,p,'projectionMatrix'),model:uniform.call(gl,p,'modelMatrix'),
     sky:uniform.call(gl,p,'waterStreetSky')});
    const q=slots.get(p),world=q.model&&gl.getUniform(p,q.model);
    if(!world||world[12]!==origin[0]||world[13]!==origin[1]||world[14]!==origin[2])return call();
    const gain=q.gain===null?null:gl.getUniform(p,q.gain);
    if(gain===null)s.stockDraws++;else s.candidateDraws++;
    let sky;
    if(q.sky!==null&&(s.request!==null||!originalSky&&gain===null)){
     const old=gl.getParameter(gl.ACTIVE_TEXTURE),unit=gl.getUniform(p,q.sky);
     let texture,wrapS;
     try{
      gl.activeTexture(gl.TEXTURE0+unit);
      texture=gl.getParameter(gl.TEXTURE_BINDING_2D);
      wrapS=texture===null?null:gl.getTexParameter(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S);
     }finally{gl.activeTexture(old);}
     if(gain===null&&texture&&wrapS===gl.REPEAT)originalSky=texture;
     sky={repeat:!!texture&&wrapS===gl.REPEAT,
      retained:originalSky===null?null:originalSky===texture};
    }
    if(s.request!==null){
     const bound=gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);
     const bytes=bound?gl.getBufferParameter(gl.ELEMENT_ARRAY_BUFFER,gl.BUFFER_SIZE):0;
     const index=bytes===actorsOnly*4?new Uint8Array(bytes):null;
     if(index)gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,index);
     s.target={draw,gain,count:c,index,sky,
      times:(s.target?.times??0)+1,view:Array.from(gl.getUniform(p,q.view)),projection:Array.from(gl.getUniform(p,q.proj))};
    }
    if(gain===null||s.gain<0)return call();
    gl.uniform1f(q.gain,s.gain);
    try{return call();}finally{gl.uniform1f(q.gain,gain);}
   }
   proto.drawArrays=function(mode,first,count){
    return observe(this,'arrays',mode===this.TRIANGLES&&first===0&&count===69906?count:0,
      ()=>arrays.call(this,mode,first,count));
   };
   proto.drawElements=function(mode,count,type,offset){
    return observe(this,'uint32',mode===this.TRIANGLES&&type===this.UNSIGNED_INT&&offset===0&&
      [69615,69663,69858].includes(count)?count:0,()=>elements.call(this,mode,count,type,offset));
   };
   window.requestAnimationFrame=function(callback){return raf(t=>{
    if(s.request!==null)s.target=null;
    const used=s.freeze?(s.clock??t):t;s.clock=used;
    callback(used);
    if(s.request!==null&&s.target){
     const canvas=document.querySelector('#world'),gl=canvas.getContext('webgl2'),error=gl.getError();
     if(error)s.errors.push(error);
     const {index,...target}=s.target;
     if(index){
      s.readback=crypto.subtle.digest('SHA-256',index).then(buffer=>Array.from(new Uint8Array(buffer),x=>x.toString(16).padStart(2,'0')).join(''));
     }else s.readback=Promise.resolve(null);
     s.frame={key:s.request,...target,png:canvas.toDataURL('image/png')};s.request=null;
    }
   });};
  },{origin,refuse:mode==='refused',actorsOnly});
  const url=new URL('?diagnostics&departure=spinnakers-low&summersideTerminalWallPreview',base);
  assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
  const data=()=>page.evaluate(()=>{
   const d=window.islandAirDiagnostics,h=window.terminalWallSmoke,gl=document.querySelector('#world')?.getContext('webgl2');
   return {phase:d?.mode,site:d?.site,x:d?.x,z:d?.z,y:d?.altitude,rail:d?.summersideStation,wharf:d?.spinnakersDeck,
    paint:d?.summersideTerminalWallPreview===true,drawn:d?.summersideTerminalWallDrawn===true,candidateDraws:h.candidateDraws,stockDraws:h.stockDraws,
    refs:h.refused,candidateSources:h.candidateSources,glError:gl?.getError(),lost:gl?.isContextLost(),
    drawCalls:d?.drawCalls,triangles:d?.triangles,loading:[d?.buildingTiles?.loading,d?.detail?.loading],warnings:d?.layerWarnings};
  });
  try{
   await page.waitForFunction(mode=>{
    const d=window.islandAirDiagnostics,q=window.terminalWallSmoke;
    return d?.mode==='dispatch'&&d.site==='spinnakers-low'&&d.summersideStation&&d.spinnakersDeck&&
      (mode==='active'?d.summersideTerminalWallDrawn&&q.candidateDraws>0:q.refused>0&&q.stockDraws>0);
   },mode,{polling:175});
   const healthy=d=>{assert.equal(d.glError,0);assert.equal(d.lost,false);};
   const start=await data();healthy(start);logs.push(start);
   if(mode==='active'){
    await page.getByRole('button',{name:'Begin flight'}).click();
    await page.waitForFunction(a=>{
     const d=window.islandAirDiagnostics;
     return d?.mode==='flight'&&d.summersideTerminalWallDrawn&&d.summersideStation&&d.spinnakersDeck&&Math.hypot(d.x-a.x,d.z-a.z)>84;
    },start,{polling:150});
    await page.keyboard.press('p');
    await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='paused'&&
      window.islandAirDiagnostics?.buildingTiles?.loading===0&&window.islandAirDiagnostics?.detail?.loading===0);
    const first=await data();await page.waitForTimeout(580);const second=await data();
    healthy(first);healthy(second);
    assert.deepEqual([first.x,first.y,first.z],[second.x,second.y,second.z]);
    assert.deepEqual([first.drawCalls,first.triangles],[second.drawCalls,second.triangles]);logs.push(second);
    assert(Math.hypot(second.x-start.x,second.z-start.z)<286,'lost enough wall coverage');
   }
   const take=async(key,gain)=>{
    await page.evaluate(({key,gain})=>{
     const m=window.terminalWallSmoke;m.frame=null;m.request=key;m.gain=gain;m.freeze=true;
    },{key,gain});
    await page.waitForFunction(k=>window.terminalWallSmoke.frame?.key===k,key);
    const f=await page.evaluate(async()=>{
     const h=window.terminalWallSmoke;
     return {...h.frame,indexDigest:await h.readback};
    });
    assert.equal(f.times,1);assert.equal(f.draw,'uint32');assert.equal(f.count,actorsOnly);
    assert.equal(f.gain,mode==='active'?1:null);
    assert.equal(f.indexDigest,maskDigest);
    assert.equal(f.sky.repeat,true);assert.notEqual(f.sky.retained,false);
    const dat=Buffer.from(f.png.split(',')[1],'base64');delete f.png;
    await writeFile(`${out}/q68-${key}.png`,dat);return {...f,dat};
   };
   let comparison;
   if(mode==='active'){
    const old=await take('wall-neutral',0),paint=await take('wall-finish',-1),repeat=await take('wall-restored',0);
    assert.deepEqual(old.view,paint.view);assert.deepEqual(old.projection,paint.projection);
    assert.equal(Buffer.compare(old.dat,repeat.dat),0);
    comparison=wallPixelCheck(old.dat,paint.dat,paint.view,paint.projection);
   }else{
    assert.equal(start.drawn,false);assert.equal(start.candidateDraws,0);
    assert.ok(start.refs>0);
    await take('link-refused-stock',-1);
   }
   assert.deepEqual(await page.evaluate(()=>window.terminalWallSmoke.errors),[]);
   const after=await data();
   assert(after.rail&&after.wharf&&!after.glError&&!after.lost&&after.candidateSources>0);
   assert.equal(after.drawn,mode==='active');
   assert.deepEqual(after.warnings,[]);assert.deepEqual(errors,[]);
   const r=`bytes=${fixture.offset}-${fixture.offset+fixture.size-1}`;
   assert.equal(requests.filter(x=>x===r).length,1,'q68 must use exactly one range request');
   result[mode]={start,after,comparison,requests,expectedIsolatedLinkErrors:rejected};
   await writeFile(`${out}/q68-wall-native.json`,JSON.stringify(result,null,2)+'\n');
   console.log('Summerside terminal compiled native:',mode,comparison??'retained stock');
  }catch(err){
   const last=await data().catch(e=>({readError:e.message}));
   console.error('q68 native gate failed',JSON.stringify({mode,last,logs,errors,requests}));
   throw err;
  }finally{await page.close();}
 }
}finally{await browser.close();}
