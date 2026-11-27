import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const o=process.env.OUT??'replay';
const inspection=process.env.SHADOW_INSPECTION==='1';
const guards={
 roll65:{m:65,active:true,upper:67},roll160:{m:160,active:true,upper:162},
 roll980:{m:980,active:true,upper:984},roll1005:{m:1005,active:true,upper:1009},
 roll1050:{m:1050,active:true,upper:1054},
 air5:{alt:5,active:true},fade16:{alt:16,active:true},fade20:{alt:20,active:true},off23:{alt:23,active:false}
};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
await mkdir(o,{recursive:true});
const receipt={};
try{
 const page=await browser.newPage({viewport:{width:830,height:554},deviceScaleFactor:1});
 const err=[];
 page.on('pageerror',e=>err.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))err.push(m.text());});
 await page.addInitScript(({g,inspection})=>{window.__castAtomic={gates:g,frames:{},origin:null,next:null,queue:[],inspection};},{g:guards,inspection});
 const url=process.env.URL??'http://127.0.0.1:42962/';
 assert.equal((await page.goto(url+'?diagnostics&departure=cysu',{waitUntil:'domcontentloaded'})).status(),200);
 const diag=()=>page.evaluate(()=>window.islandAirDiagnostics);
 const ready=await page.waitForFunction(()=>{const d=window.islandAirDiagnostics;return d?.mode==='dispatch'&&d.site==='cysu'&&d.roads&&d.buildings&&d.detail.ready>0&&!d.detail.loading;},{},{polling:150,timeout:125_000});
 assert(ready&&!(await diag()).aircraftRunwayCast?.active);
 await page.getByRole('button',{name:'Begin flight'}).click();
 await page.waitForFunction(()=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&d.site==='cysu'&&d.aircraftRunwayCast?.active;},{},{polling:100,timeout:90_000});
 await page.evaluate(()=>{const d=window.islandAirDiagnostics;window.__castAtomic.origin={x:d.x,z:d.z};});
 const set=async (...ids)=>{await page.evaluate(a=>{
  window.__castAtomic.next=a.shift()??null;window.__castAtomic.queue=a;
 },ids);};
 const capture=async id=>{
  try{
   await page.waitForFunction(k=>!!window.__castAtomic.frames[k],id,{polling:100,timeout:300_000});
  }catch(e){console.log('diagnostics at timeout',id,JSON.stringify(await diag()));throw e;}
  const {proof,shots}=await page.evaluate(k=>{const q=window.__castAtomic;const res=q.frames[k];q.frames[k]=true;return res;},id);
  assert.equal(proof.samples,4);
  for(const q of proof.receivers){
   for(const n of ['p','i']){
    const b=Buffer.from(q[n+'64'],'base64');
    q[n+'Sha']=createHash('sha256').update(b).digest('hex');
    await writeFile(`${o}/${id}-${q.id}-${n}.bin`,b);delete q[n+'64'];
   }
  }
  assert.equal(proof.state.active,guards[id].active);
  assert.equal(proof.state.draws,1);
  assert.equal(proof.state.triangles,7184);
  assert(guards[id].upper===undefined||proof.m<=guards[id].upper,JSON.stringify(proof.m));
  let w,h;const rgba={},png={};
  for(const [k,v] of Object.entries(shots)){
   assert.equal(v.gl,0);
   assert.equal(v.calls,shots.stock.calls);assert.equal(v.triangles,shots.stock.triangles);
   const b=Buffer.from(v.image.split(',')[1],'base64'),p=PNG.sync.read(b);
   await writeFile(`${o}/${id}-${k}.png`,b);rgba[k]=p.data;png[k]=b;w=p.width;h=p.height;
  }
  assert.deepEqual(png.stock,png.repeat);
  let strong=0,changed=0,role=0,partial=0,outside=0,alpha=0,max=0,diffBright=0;
  for(let i=0;i<rgba.stock.length;i+=4){
   const d=[0,1,2].map(k=>rgba.stock[i+k]-rgba.active[i+k]);
   const c=Math.max(...d.map(Math.abs)),moved=rgba.hi[i+1]-rgba.lo[i+1];
   if(c>2)strong++;if(c)changed++;if(moved)role++;if(moved&&moved<255)partial++;if(c&&!moved)outside++;
   if(rgba.stock[i+3]!==rgba.active[i+3])alpha++;
   if(Math.min(...d)<0)diffBright++;
   max=Math.max(max,c);
  }
  assert.equal(outside,0);assert.equal(alpha,0);assert.equal(diffBright,0);
  if(id.startsWith('roll'))assert(strong>=1000);
  if(inspection&&id==='fade16')assert(changed>1000);
  if(id==='off23')assert.equal(changed,0);
  const counts={w,h,strong,changed,role,partial,outside,alpha,max,diffBright,calls:shots.stock.calls,triangles:shots.stock.triangles};
  console.log(id,proof.m,proof.alt,proof.state,counts);
  await writeFile(`${o}/${id}-geometry.json`,JSON.stringify(proof,null,2)+'\n');
  receipt[id]={m:proof.m,alt:proof.alt,gain:proof.state.gain,...counts};
  await writeFile(`${o}/receipt.json`,JSON.stringify(receipt,null,2)+'\n');
 };
 let key='=';
 const power=async()=>{
  await page.keyboard.down(key);
  try{await page.waitForFunction(()=>window.islandAirDiagnostics?.throttle>.15,{},{polling:150,timeout:26000});}
  catch(e){await page.keyboard.up(key);key='Shift';await page.keyboard.down(key);}
 };
 if(inspection){
  await power();
  await page.waitForFunction(()=>window.islandAirDiagnostics?.speed>34,{},{polling:100,timeout:170_000});
  await set('air5','fade16');await page.keyboard.down('ArrowDown');
  await capture('air5');await capture('fade16');await page.keyboard.up('ArrowDown');
 }else{
 await set('roll65','roll160');await power();await capture('roll65');
 await capture('roll160');
 await page.keyboard.press('p');
 await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='paused'&&window.islandAirDiagnostics.aircraftRunwayCast?.active);
 const paused=await diag();
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
 const later=await diag();
 assert.equal(later.mode,'paused');assert.equal(later.x,paused.x);assert.equal(later.z,paused.z);
 assert.equal(later.aircraftRunwayCast.refreshes,paused.aircraftRunwayCast.refreshes);
 console.log('paused target retained with no new cast',paused.aircraftRunwayCast);
 await page.keyboard.press('p');
 await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.aircraftRunwayCast?.active);
 await set('roll980','roll1005','roll1050');await capture('roll980');await capture('roll1005');await capture('roll1050');
 await set('air5','fade16','fade20','off23');await page.keyboard.down('ArrowDown');
 await capture('air5');await capture('fade16');await capture('fade20');await capture('off23');await page.keyboard.up('ArrowDown');
 }
 await page.keyboard.up(key);
 assert.deepEqual(err,[]);
 await page.close();
}finally{await browser.close();}
