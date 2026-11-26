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
        gl_FragColor=plain?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;
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
    ctx.uniform1f(gate,s.ask.kind==='stock'?0:value);ctx.uniform1f(mask,s.ask.kind==='mask'?1:0);
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
   const start=await page.evaluate(()=>window.islandAirDiagnostics);
   await page.keyboard.down('Shift');
   receipt[mode]=[];
   for(const m of mode==='live'?[65,160]:[35]){
    await page.waitForFunction(({start,m,site})=>{
     const d=window.islandAirDiagnostics;
     return d?.mode==='flight'&&d.site===site&&d.camera==='Chase'&&Math.hypot(d.x-start.x,d.z-start.z)>m;
    },{start,m,site},{polling:60});
    if(mode!=='live'){
     const r=await page.evaluate(()=>{
      const s=window.cyygPavingQA;const d=window.islandAirDiagnostics;
      return {sources:s.sources,draws:s.seen,x:d.x,z:d.z,runway03Pavement:d.runway03Pavement};
     });
     assert.equal(r.draws,0);
     if(mode!=='summerside')assert.equal(r.sources,0);
     receipt[mode].push(r);break;
    }
    await page.keyboard.up('Shift');
    await page.evaluate(()=>{window.cyygPavingQA.hold=true;});
    const frame=async(kind)=>{
     const tag=m+kind;
     await page.evaluate(({kind,tag})=>{window.cyygPavingQA.ask={kind,tag};},{kind,tag});
     await page.waitForFunction(t=>window.cyygPavingQA.frame?.tag===t,tag);
     const f=await page.evaluate(()=>window.cyygPavingQA.frame);
     assert.equal(f.err,0);assert(f.draws.length&&f.draws.every(x=>x.actual===1&&x.depth&&x.depthWrite),JSON.stringify(f.draws));
     return {...f,bytes:Buffer.from(f.png.split(',')[1],'base64')};
    };
    const a=await frame('stock'),b=await frame('live'),mask=await frame('mask'),c=await frame('restored');
    assert.deepEqual(a.at,b.at);assert.deepEqual(a.at,mask.at);assert.deepEqual(b.bytes,c.bytes);
    const A=PNG.sync.read(a.bytes),B=PNG.sync.read(b.bytes),M=PNG.sync.read(mask.bytes),W=A.width,H=A.height;
    const green=i=>M.data[i*4]===0&&M.data[i*4+1]===255&&M.data[i*4+2]===0;
    const pink=i=>M.data[i*4]===255&&M.data[i*4+1]===0&&M.data[i*4+2]===255;
    let strong=0,greenCount=0,paint=0,paintDifference=0,exterior=0,alpha=0;
    for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){
     const I=y*W+x,i=I*4,around=[I-W-1,I-W,I-W+1,I-1,I,I+1,I+W-1,I+W,I+W+1];
     const diff=Math.max(Math.abs(A.data[i]-B.data[i]),Math.abs(A.data[i+1]-B.data[i+1]),Math.abs(A.data[i+2]-B.data[i+2]));
     if(green(I))greenCount++;
     if(around.every(pink)){paint++;if(diff)paintDifference++;}
     if(diff>2){strong++;if(!around.some(green))exterior++;}
     if(A.data[i+3]!==B.data[i+3])alpha++;
    }
    const exact={checkpoint:m,position:a.at,strong,greenCount,paint,paintDifference,exterior,alpha,gpuDraws:a.draws.length};
    console.log('CYYG 03 exact browser comparison',JSON.stringify(exact));
    assert(strong>1000&&paint>30&&paintDifference===0&&exterior===0&&alpha===0,JSON.stringify(exact));
    receipt[mode].push(exact);
    if(m===160){
     await writeFile(out+'/cyyg03-stock.png',a.bytes);
     await writeFile(out+'/cyyg03-filtered.png',b.bytes);
    }
    await page.evaluate(()=>{window.cyygPavingQA.hold=false;});
    await page.keyboard.down('Shift');
   }
   await page.keyboard.up('Shift');
   assert.deepEqual(errors,[]);
   console.log('CYYG 03 browser case',mode,JSON.stringify(receipt[mode]));
  }finally{await page.close();}
 }
 await writeFile(out+'/cyyg03-pavement.json',JSON.stringify(receipt,null,2)+'\n');
}finally{await browser.close();}
