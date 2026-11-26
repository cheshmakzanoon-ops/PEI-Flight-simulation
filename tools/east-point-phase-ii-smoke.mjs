/** Scoped, pose-locked Phase II replay on the production atlas. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
await mkdir(out,{recursive:true});
const counts=[7272,4560,1968,1824,624,768];
const start=async(page, stock=false)=>{
 page.setDefaultTimeout(100000);
 const errors=[];
 page.on('pageerror', e=>errors.push(e.message));page.on('console', m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))errors.push(m.text());});
 if(!stock)await page.addInitScript(list=>{
  const g=WebGL2RenderingContext.prototype,starts=new Set(list),u=g.useProgram,draw=g.drawElementsInstanced;
  const uniforms=new WeakMap(), active=new WeakMap();
  const s=window.eastSkylineCheck={ask:null,past:null,hold:false,png:null,rows:[],result:null};
  g.useProgram=function(p){active.set(this,p);return u.call(this,p);};
  g.drawElementsInstanced=function(...a){
   // The unchanged fleets share the rotor index counts. Require not only
   // a wind program, but the unique Phase II clock multiplier for rotors.
   if(s.ask&&this.canvas.id==='world'&&starts.has(a[1])&&a[4]>=1&&a[4]<=7&&this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)===null){
    const p=active.get(this);
    if(p&&!uniforms.has(p)){
     const sources=this.getAttachedShaders(p)?.map(a=>this.getShaderSource(a)??'')??[];
     uniforms.set(p,{wind:sources.some(s=>s.includes('windWorldP')),e2Rotor:sources.some(s=>s.includes('regionalWindClock*1.0995574288'))});
    }
    const program=p?uniforms.get(p):null;
    if(program?.wind&&([7272,1968,624].includes(a[1])||program.e2Rotor)){s.rows.push([a[1],a[4],this.isEnabled(this.DEPTH_TEST),this.getParameter(this.DEPTH_WRITEMASK)]);if(s.ask==='off')return;}
   }
   return draw.apply(this,a);
  };
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>raf(t=>{
   if(s.hold)t=s.past??t;s.past=t;s.rows=[];cb(t);
   if(s.ask){const c=document.getElementById('world'),g=c.getContext('webgl2');s.result={ask:s.ask,draws:s.rows,error:g.getError(),raw:c.toDataURL(),diag:window.islandAirDiagnostics};s.ask=null;}
  });
 },counts);
 const url=new URL(base);
 url.searchParams.set('diagnostics','');
 url.searchParams.set('departure','eastern-kings-skyline');
 if(stock)url.searchParams.set('stockEastPointPhaseII','');
 const res=await page.goto(url.href,{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);
 await page.waitForFunction(stock=>{
  const d=window.islandAirDiagnostics; if(!(d?.mode==='dispatch'&&d.roads&&d.mainland&&d.site==='eastern-kings-skyline'))return false;
  const f=d.regionalWind?.farms??[], a=f.find(a=>a.farm==='east-point-i'), b=f.find(a=>a.farm==='east-point-ii');
  return a?.registered===10&&(stock?!b:b?.registered===7);
 },stock,{polling:100});
 const d=await page.evaluate(()=>window.islandAirDiagnostics);
 assert.deepEqual(d.layerWarnings,[]);console.log('dispatch',stock,d.x,d.z,d.altitude,d.regionalWind);
 return {d,errors};
};
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-program-cache','--disk-cache-size=1024','--disable-background-networking']});
try{
 const page=await browser.newPage({viewport:{width:760,height:507},deviceScaleFactor:1});
 const {d,errors}=await start(page);
 await page.getByRole('button',{name:'Begin flight'}).click();
 const images=[];
 for(const [check,view] of [[350,'Chase'],[570,'Chase'],[700,'Cockpit']]){
  if(view==='Cockpit'){await page.keyboard.press('v');await page.waitForFunction(()=>window.islandAirDiagnostics?.camera==='Cockpit');}
  await page.waitForFunction(({x,z,m,view})=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&d.camera===view&&Math.hypot(d.x-x,d.z-z)>m;},{x:d.x,z:d.z,m:check,view},{polling:70,timeout:135000});
  await page.keyboard.press('p'); await page.waitForFunction(()=>window.islandAirDiagnostics.mode==='paused');
  await page.evaluate(()=>{window.eastSkylineCheck.hold=true;});
  const sample=async ask=>{
   await page.evaluate(k=>{window.eastSkylineCheck.ask=k;},ask);
   await page.waitForFunction(k=>window.eastSkylineCheck.result?.ask===k,ask);
   const f=await page.evaluate(()=>window.eastSkylineCheck.result);assert.equal(f.error,0); return {...f,png:Buffer.from(f.raw.split(',')[1],'base64')};
  }
  const a=await sample('normal'),b=await sample('off'),c=await sample('restored');
  assert.deepEqual(a.png,c.png,'restoring only Phase II draws restores the full frame');
  assert.deepEqual([a.diag.x,a.diag.altitude,a.diag.z],[b.diag.x,b.diag.altitude,b.diag.z]);
  assert.equal(a.diag.regionalWind.farms.find(a=>a.farm==='east-point-i').registered,10);
  assert.equal(a.diag.regionalWind.farms.find(a=>a.farm==='east-point-ii').registered,7);
  assert.equal(a.diag.regionalWind.farms.find(a=>a.farm==='east-point-ii').groundLight,null);
  assert.deepEqual(a.draws,b.draws);assert(a.draws.length>=2&&a.draws.length<=6); assert(a.draws.every(r=>r[2]&&r[3]));
  const moved=Math.hypot(a.diag.x-d.x,a.diag.z-d.z); const u=PNG.sync.read(a.png),v=PNG.sync.read(b.png);
  let strong=0,alpha=0;for(let i=0;i<u.data.length;i+=4){if(Math.max(...[0,1,2].map(k=>Math.abs(u.data[i+k]-v.data[i+k])))>5)strong++;if(u.data[i+3]!==v.data[i+3])alpha++;}
  assert(strong>100&&alpha===0,JSON.stringify({check,view,strong,alpha,draws:a.draws})); const result={view,moved,altitude:a.diag.altitude,draws:a.draws,strong,alpha};console.log('GPU A/B',result);images.push(result);
  if(check!==350)await writeFile(out+'/east-point-phase-ii-'+check+'.png',a.png);
  await page.evaluate(()=>{window.eastSkylineCheck.hold=false;});
  if(view!=='Cockpit'){await page.keyboard.press('p');await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='flight');}
 }
 assert.deepEqual(errors,[]);await page.close();
 const p=await browser.newPage({viewport:{width:760,height:507},deviceScaleFactor:1});const stock=await start(p,true);assert.deepEqual(stock.errors,[]);await p.close();
 await writeFile(out+'/east-point-phase-ii.json',JSON.stringify({images,stock:'ten Phase I visible, no Phase II'},null,2)+'\n');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
