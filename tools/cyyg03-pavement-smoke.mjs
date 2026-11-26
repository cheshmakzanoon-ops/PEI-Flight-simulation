/** Real rendered CYYG 03 runway during a normal ground roll: exact marking/owner guard. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
await mkdir(out,{recursive:true});
const receipt={};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 for(const mode of ['live','veto','bad-swatch','summerside']){
  const page=await browser.newPage({viewport:{width:830,height:554},deviceScaleFactor:1});
  page.setDefaultTimeout(125_000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))errors.push(m.text());});
  await page.addInitScript(badSwatch=>{
   if(badSwatch){
    const p=CanvasRenderingContext2D.prototype,read=p.getImageData;
    p.getImageData=function(x,y,w,h,...a){
     const result=read.call(this,x,y,w,h,...a);
     if(this.canvas.width===384&&this.canvas.height===2048&&x===60&&y===1023&&w===1&&h===2)result.data[0]^=1;
     return result;
    };
   }
   const gl=WebGL2RenderingContext.prototype;
   const original={shader:gl.shaderSource,attach:gl.attachShader,use:gl.useProgram,a:gl.drawArrays,e:gl.drawElements};
   const shaders=new WeakSet(),programs=new WeakSet(),cur=new WeakMap(),locations=new WeakMap();
   const s=window.cyygPavingQA={frame:null,ask:null,hold:false,last:null,draws:[],sources:0,seen:0};
   gl.shaderSource=function(shader,src){
    if(src.includes('uniform float runway03PavementLive;')){
     shaders.add(shader);s.sources++;
     const anchor='vec3 paint=texture2D(paintMap,u).rgb;';
     if(src.split(anchor).length!==2)throw Error('Main runway QA could not bind unique original painter');
     // Only the in-test mask direct-writes color. Depth, strip priority and
     // occlusion stay in exactly the compiled and flown land rendering path.
     src=src.replace('uniform float runway03PavementLive;','uniform float runway03PavementLive; uniform float cyygPavingQAView;')
      .replace(anchor,anchor+`
       if(cyygPavingQAView>.5&&i==0&&d<=600.){
        bool plain=all(equal(paint,texelFetch(paintMap,ivec2(60,1024),0).rgb));
        gl_FragColor=plain?vec4(0.,step(1.5,cyygPavingQAView),0.,1.):vec4(1.,0.,1.,1.);return;
       }`);
    }
    return original.shader.call(this,shader,src);
   };
   gl.attachShader=function(program,shader){if(shaders.has(shader))programs.add(program);return original.attach.call(this,program,shader);};
   gl.useProgram=function(program){cur.set(this,program);return original.use.call(this,program);};
   function route(ctx,args,draw){
    const p=cur.get(ctx);
    if(!p||!programs.has(p)||ctx.canvas.id!=='world')return draw.apply(ctx,args);
    s.seen++;
    if(!s.ask||ctx.getParameter(ctx.DRAW_FRAMEBUFFER_BINDING)!==null)return draw.apply(ctx,args);
    if(!locations.has(p))locations.set(p,['runway03PavementLive','cyygPavingQAView'].map(k=>ctx.getUniformLocation(p,k)));
    const [gate,mask]=locations.get(p);
    if(!gate||!mask)throw Error('The exact main runway shade program did not link');
    const value=ctx.getUniform(p,gate),before=ctx.getUniform(p,mask);
    s.draws.push({actual:value,depth:ctx.isEnabled(ctx.DEPTH_TEST),depthWrite:ctx.getParameter(ctx.DEPTH_WRITEMASK)});
    ctx.uniform1f(gate,s.ask.kind==='stock'?0:value);ctx.uniform1f(mask,s.ask.kind==='support-lo'?1:s.ask.kind==='support-hi'?2:0);
    try{return draw.apply(ctx,args);}finally{ctx.uniform1f(gate,value);ctx.uniform1f(mask,before);}
   }
   gl.drawArrays=function(...args){return route(this,args,original.a);};
   gl.drawElements=function(...args){return route(this,args,original.e);};
   const raf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=cb=>raf(stamp=>{
    if(s.hold)stamp=s.last??stamp;
    s.last=stamp;s.draws=[];cb(stamp);
    if(s.ask){
     const c=document.getElementById('world'),g=c.getContext('webgl2'),d=window.islandAirDiagnostics;
     s.frame={tag:s.ask.tag,draws:s.draws,err:g.getError(),at:[d.x,d.altitude,d.z],png:c.toDataURL()};
     s.ask=null;
    }
   });
  },mode==='bad-swatch');
  try{
   const site=mode==='summerside'?'cysu':'cyyg';
   const u=new URL(base);u.searchParams.set('diagnostics','');u.searchParams.set('departure',site);
   u.searchParams.set('runway03PavementReview','');
   if(mode==='veto')u.searchParams.set('stockRunway03Pavement','');
   assert.equal((await page.goto(u.href,{waitUntil:'domcontentloaded'})).status(),200);
   await page.waitForFunction(id=>{
    const d=window.islandAirDiagnostics;
    return d?.mode==='dispatch'&&d.site===id&&d.roads&&d.buildings&&d.detail.ready>0&&!d.detail.loading;
   },site,{polling:120});
   assert.equal(await page.evaluate(()=>window.islandAirDiagnostics.runway03Pavement),mode==='live'||mode==='summerside');
   await page.getByRole('button',{name:'Begin flight'}).click();
   await page.waitForFunction(id=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===id,site);
   const start=await page.evaluate(()=>window.islandAirDiagnostics);
   let powerKey='=';
   const accelerate=async()=>{
    await page.keyboard.down(powerKey);
    try{
     await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.throttle>.15,
      {},{polling:180,timeout:24000});
    }catch(e){
     await page.keyboard.up(powerKey);
     powerKey=powerKey==='='?'Shift':'=';
     await page.keyboard.down(powerKey);
     await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.throttle>.15,
      {},{polling:180,timeout:32000});
    }
   };
   const state=()=>page.evaluate(()=>{
    const {mode,site,x,z,speed,throttle,camera,runway03Pavement}=window.islandAirDiagnostics;
    return {mode,site,x,z,speed,throttle,camera,runway03Pavement,sources:window.cyygPavingQA.sources};
   });
   console.log('CYYG runway start',mode,JSON.stringify(await state()));
   await accelerate();
   console.log('CYYG runway throttle engaged',mode,JSON.stringify(await state()));
   receipt[mode]=[];
   for(const m of mode==='live'?[65,160]:[15]){
    try{
     await page.waitForFunction(({start,m,site})=>{
      const d=window.islandAirDiagnostics;
      return d?.mode==='flight'&&d.site===site&&d.camera==='Chase'&&Math.hypot(d.x-start.x,d.z-start.z)>m;
     },{start,m,site},{polling:100,timeout:190_000});
    }finally{console.log('CYYG runway movement',mode,m,JSON.stringify(await state()),errors);}
    if(mode!=='live'){
     const r=await page.evaluate(()=>{
      const s=window.cyygPavingQA;const d=window.islandAirDiagnostics;
      return {sources:s.sources,draws:s.seen,x:d.x,z:d.z,runway03Pavement:d.runway03Pavement};
     });
     assert.equal(r.draws,0);
     if(mode!=='summerside')assert.equal(r.sources,0);
     receipt[mode].push(r);break;
    }
    await page.keyboard.up(powerKey);
    await page.evaluate(()=>{window.cyygPavingQA.hold=true;});
    const frame=async(kind)=>{
     const tag=m+kind;
     await page.evaluate(({kind,tag})=>{window.cyygPavingQA.ask={kind,tag};},{kind,tag});
     await page.waitForFunction(t=>window.cyygPavingQA.frame?.tag===t,tag);
     const f=await page.evaluate(()=>window.cyygPavingQA.frame);
     assert.equal(f.err,0);assert(f.draws.length&&f.draws.every(x=>x.actual===1&&x.depth&&x.depthWrite),JSON.stringify(f.draws));
     return {...f,bytes:Buffer.from(f.png.split(',')[1],'base64')};
    };
    const a=await frame('stock'),b=await frame('live'),lo=await frame('support-lo'),hi=await frame('support-hi'),c=await frame('restored');
    for(const f of [b,lo,hi,c])assert.deepEqual(a.at,f.at);
    assert.deepEqual(b.bytes,c.bytes);
    const A=PNG.sync.read(a.bytes),B=PNG.sync.read(b.bytes),L=PNG.sync.read(lo.bytes),H=PNG.sync.read(hi.bytes),
     w=A.width,h=A.height;
    const diff=(x,y,i)=>Math.max(Math.abs(x[i]-y[i]),Math.abs(x[i+1]-y[i+1]),Math.abs(x[i+2]-y[i+2]));
    const pink=i=>H.data[i]===255&&H.data[i+1]===0&&H.data[i+2]===255&&
     L.data[i]===255&&L.data[i+1]===0&&L.data[i+2]===255;
    let strong=0,support=0,partial=0,paint=0,paintDifference=0,exterior=0,exteriorStrong=0,alpha=0;
    const outside=[];
    // A matched two-colour support toggle, not a pure green mask, keeps
    // partially covered MSAA samples observable under adjacent paint or
    // opaque scenery. The rest of the render stays exactly the same.
    for(let i=0;i<A.data.length;i+=4){
     const d=diff(A.data,B.data,i),moved=diff(L.data,H.data,i);
     if(moved){support++;if(moved<255)partial++;}
     if(pink(i)){paint++;if(d)paintDifference++;}
     if(d>2)strong++;
     if(d&&!moved){
      exterior++;if(d>2)exteriorStrong++;
      if(outside.length<24)outside.push([i/4%w,Math.floor(i/4/w),d]);
     }
     if(A.data[i+3]!==B.data[i+3])alpha++;
    }
    const exact={checkpoint:m,position:a.at,strong,support,partial,paint,paintDifference,exterior,exteriorStrong,alpha,
     viewport:[w,h],gpuDraws:a.draws.length,outside};
    console.log('CYYG 03 exact browser comparison',JSON.stringify(exact));
    receipt[mode].push(exact);
    if(m===160||exterior||paintDifference||alpha){
     await writeFile(out+'/cyyg03-stock.png',a.bytes);
     await writeFile(out+'/cyyg03-filtered.png',b.bytes);
     await writeFile(out+'/cyyg03-support-lo.png',lo.bytes);
     await writeFile(out+'/cyyg03-support-hi.png',hi.bytes);
    }
    assert(strong>1000&&paint>30&&paintDifference===0&&exterior===0&&alpha===0,JSON.stringify(exact));
    await page.evaluate(()=>{window.cyygPavingQA.hold=false;});
    await accelerate();
   }
   await page.keyboard.up(powerKey);
   assert.deepEqual(errors,[]);
   console.log('CYYG 03 browser case',mode,JSON.stringify(receipt[mode]));
  }finally{await page.close();}
 }
 await writeFile(out+'/cyyg03-pavement.json',JSON.stringify(receipt,null,2)+'\n');
}finally{await browser.close();}
