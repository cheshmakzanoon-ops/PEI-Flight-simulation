import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {Color} from 'three';
const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const site='oleary-railway-low';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
 // This lane verifies actual buffer submission at two distances, not image
 // quality. Keep raster work modest on SwiftShader; the separate native
 // 960x640 exact-pixel comparison supplies the image-scope witness.
 const page=await browser.newPage({viewport:{width:640,height:426}});
 page.setDefaultTimeout(160_000);
 const issues=[];page.on('pageerror',e=>issues.push(e.message));
 page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('favicon.ico'))issues.push(e.text());});
 await page.addInitScript(({roof,wall})=>{
  const gl=WebGL2RenderingContext.prototype,draw=gl.drawArrays;
  const qa=window.olearyRoofQA={ask:null,proof:null};
  gl.drawArrays=function(mode,first,count){
   if(!qa.ask||this.canvas.id!=='world'||mode!==this.TRIANGLES||first!==0||count!==32049||
      this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)!==null)return draw.call(this,mode,first,count);
   const p=this.getParameter(this.CURRENT_PROGRAM);
   if(!p)return draw.call(this,mode,first,count);
   const color=this.getAttribLocation(p,'color'),flag=this.getAttribLocation(p,'topFlag');
   if(color<0||flag<0)return draw.call(this,mode,first,count);
   const saved=this.getParameter(this.ARRAY_BUFFER_BINDING);
   try{
    const data=(slot,width,length)=>{
     const b=this.getVertexAttrib(slot,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
     if(!b||this.getVertexAttrib(slot,this.VERTEX_ATTRIB_ARRAY_TYPE)!==this.FLOAT||
        this.getVertexAttrib(slot,this.VERTEX_ATTRIB_ARRAY_SIZE)!==width||
        this.getVertexAttrib(slot,this.VERTEX_ATTRIB_ARRAY_STRIDE)!==0||
        this.getVertexAttribOffset(slot,this.VERTEX_ATTRIB_ARRAY_POINTER)!==0)return;
     const v=new Float32Array(length*width);
     this.bindBuffer(this.ARRAY_BUFFER,b);
     this.getBufferSubData(this.ARRAY_BUFFER,1770*width*4,v);
     return v;
    };
    const c=data(color,3,102),f=data(flag,1,102);
    if(c&&f){
     const roofs=Array.from({length:30},(_,k)=>c.subarray((72+k)*3,(73+k)*3).every((v,i)=>v===roof[i])&&f[72+k]===1).filter(Boolean).length;
     const walls=Array.from({length:72},(_,k)=>c.subarray(k*3,k*3+3).every((v,i)=>v===wall[i])&&f[k]===0).filter(Boolean).length;
     qa.proof={id:qa.ask,drawVertices:count,roofs,walls,depth:this.isEnabled(this.DEPTH_TEST),error:this.getError()};
     qa.ask=null;
    }
   }finally{this.bindBuffer(this.ARRAY_BUFFER,saved);}
   return draw.call(this,mode,first,count);
  };
 },{roof:[...new Float32Array(new Color(0x89847b).toArray())],wall:[...new Float32Array(new Color(0x8e8073).toArray())]});
 const url=new URL('?departure='+site+'&diagnostics&olearyAccessRoofReview',base);
 assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
 await page.waitForFunction(s=>window.islandAirDiagnostics?.site===s&&window.islandAirDiagnostics?.mode==='dispatch',site);
 await page.getByRole('button',{name:'Begin flight'}).click();
 await page.waitForFunction(s=>window.islandAirDiagnostics?.site===s&&window.islandAirDiagnostics?.mode==='flight',site);
 const start=await page.evaluate(()=>{const d=window.islandAirDiagnostics;return [d.x,d.z];});
 const read=async()=>page.evaluate(([x,z])=>{
  const d=window.islandAirDiagnostics;
  return d?{mode:d.mode,site:d.site,camera:d.camera,distance:Math.hypot(d.x-x,d.z-z),ready:d.buildingTiles?.ready,
   active:d.olearyAccessRoof,draws:d.drawCalls,triangles:d.triangles,proof:window.olearyRoofQA.proof}:null;
 },start);
 const fail=async(stage,error)=>{
  const sample=await read().catch(()=>null);
  await writeFile(out+'/oleary-access-roof-gate-failure.json',JSON.stringify({stage,sample,issues},null,2)+'\n');
  console.error('O’Leary access roof failed stage:',stage,JSON.stringify(sample));
  throw error;
 };
 try{
  await page.waitForFunction(()=>window.islandAirDiagnostics?.olearyAccessRoof===true,{},{timeout:55_000,polling:100});
 }catch(error){await fail('signed owner in the original stream',error);}
 console.log('O’Leary access roof resident:',JSON.stringify(await read()));
 const flightDeadline=Date.now()+255_000;
 const gpu=[];
 for(const m of [1515,1630]){
  try{
   await page.waitForFunction(({f,m})=>{
     const d=window.islandAirDiagnostics;
     return d.olearyAccessRoof&&d.camera==='Chase'&&d.mode==='flight'&&Math.hypot(d.x-f[0],d.z-f[1])>=m;
   },{f:start,m},{polling:50,timeout:Math.max(1000,flightDeadline-Date.now())});
  }catch(error){await fail('ordinary Chase distance '+m,error);}
  console.log('O’Leary access roof reaching witness',m,JSON.stringify(await read()));
  await page.evaluate(m=>{window.olearyRoofQA.ask=m;},m);
  try{
   await page.waitForFunction(m=>window.olearyRoofQA.proof?.id===m,m,{timeout:32_000,polling:100});
  }catch(error){await fail('exact resident GPU draw '+m,error);}
  const witness=await page.evaluate(()=>window.olearyRoofQA.proof);
  assert.deepEqual(witness,{id:m,drawVertices:32049,roofs:30,walls:72,depth:true,error:0});
  gpu.push(witness);
 }
 const q=await page.evaluate(()=>{
   const d=window.islandAirDiagnostics,g=document.getElementById('world').getContext('webgl2');
   return {x:d.x,z:d.z,active:d.olearyAccessRoof,draws:d.drawCalls,triangles:d.triangles,error:g.getError(),
    station:d.olearyExterior,tower:d.olearyIndustrial192,warehouse:d.olearyWarehouse150};
 });
 assert(q.active&&q.draws>0&&q.triangles>0);assert.equal(q.error,0);
 assert.deepEqual([q.station,q.tower,q.warehouse],[false,'stock','stock']);assert.deepEqual(issues,[]);
 await writeFile(out+'/oleary-access-roof.json',JSON.stringify({...q,gpu},null,2)+'\n');
 await page.screenshot({path:out+'/oleary-access-roof.png'});
}finally{await browser.close();}
