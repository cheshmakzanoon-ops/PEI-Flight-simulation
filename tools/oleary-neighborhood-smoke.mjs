/** Compiled player coverage for the optional warehouse and both independent neighbors. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'],
});
const receipt={};
try {
 for(const mode of ['combined','stock','link-refusal']){
  const page=await browser.newPage({viewport:{width:660,height:440}});
  page.setDefaultTimeout(110_000);
  const errors=[],requests=[],flightErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(new URL(r.url()).pathname));
  page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))errors.push(`${r.status()} ${r.url()}`);});
  page.on('console',m=>{if(m.type()==='error')flightErrors.push(m.text());});
  await page.addInitScript(refuse=>{
   const p=WebGL2RenderingContext.prototype;
   const source=p.shaderSource,attach=p.attachShader,query=p.getProgramParameter;
   const sheets=new WeakSet(),warehousePrograms=new WeakSet();
   window.olearySmokeLinkWitness={warehouseSource:0,statusChecks:0,refused:0};
   p.shaderSource=function(shader,code){
    if(code.includes('q150SheetGain')&&code.includes('q150ViewBump')){
     sheets.add(shader);window.olearySmokeLinkWitness.warehouseSource++;
    }
    return source.call(this,shader,code);
   };
   p.attachShader=function(program,shader){
    if(sheets.has(shader))warehousePrograms.add(program);
    return attach.call(this,program,shader);
   };
   p.getProgramParameter=function(program,key){
    const result=query.call(this,program,key);
    if(key!==this.LINK_STATUS||!warehousePrograms.has(program))return result;
    window.olearySmokeLinkWitness.statusChecks++;
    if(refuse){window.olearySmokeLinkWitness.refused++;return false;}
    return result;
   };
  },mode==='link-refusal');
  const url=new URL(base);
  url.searchParams.set('diagnostics','');
  url.searchParams.set('departure','oleary-railway-low');
  url.searchParams.set('olearyExteriorStudy','');
  url.searchParams.set('qa',JSON.stringify({olearyIndustrial192:true}));
  url.searchParams.set('olearyWarehouseStudy','');
  if(mode==='stock')url.searchParams.set('stockOlearyWarehouse','');
  assert.equal((await page.goto(url.href,{waitUntil:'domcontentloaded'})).status(),200);
  const read=()=>page.evaluate(()=>{
   const g=window.islandAirDiagnostics,canvas=document.querySelector('#world'),gl=canvas.getContext('webgl2');
   return {mode:g.mode,site:g.site,x:g.x,z:g.z,altitude:g.altitude,ground:g.groundY,
    station:g.olearyExterior,tower:g.olearyIndustrial192,warehouse:g.olearyWarehouse150,
    ready:g.buildingTiles?.ready,draws:g.drawCalls,triangles:g.triangles,warnings:g.layerWarnings,
    contextLost:gl.isContextLost(),glError:gl.getError(),link:window.olearySmokeLinkWitness};
  });
  await page.waitForFunction(()=>window.islandAirDiagnostics?.mode==='dispatch'&&
   window.islandAirDiagnostics.site==='oleary-railway-low'&&window.islandAirDiagnostics.buildings,{},{polling:200});
  const start=await read();
  if(mode!=='combined')assert.equal(start.warehouse,'stock');
  await page.getByRole('button',{name:'Begin flight'}).click();
  await page.waitForFunction(f=>{
   const d=window.islandAirDiagnostics;
   return d?.mode==='flight'&&Math.hypot(d.x-f.x,d.z-f.z)>690&&
    d.olearyExterior==='authored'&&d.olearyIndustrial192==='authored'&&d.buildingTiles?.ready>0&&
    (!f.active||d.olearyWarehouse150==='authored')&&(!f.refuse||window.olearySmokeLinkWitness.refused>0);
  },{x:start.x,z:start.z,active:mode==='combined',refuse:mode==='link-refusal'},{polling:150});
  const close=await read();
  assert.equal(close.site,'oleary-railway-low');
  const distance=Math.hypot(close.x-start.x,close.z-start.z);
  assert.ok(distance>690&&distance<1450,`not a near screenshot: ${distance}`);
  assert.equal(close.station,'authored');
  assert.equal(close.tower,'authored');
  assert.equal(close.warehouse,mode==='combined'?'authored':'stock');
  assert.equal(close.contextLost,false);
  assert.equal(close.glError,0);
  assert.ok(close.altitude>close.ground+35);
  assert.ok(close.draws>15&&close.triangles>10_000);
  assert.deepEqual(close.warnings,[]);
  assert.deepEqual(errors,[]);
  const warehouseModules=requests.filter(r=>/\/q150-(wing|material|exact-graph)-/.test(r));
  if(mode==='stock'){
   assert.deepEqual(close.link,{warehouseSource:0,statusChecks:0,refused:0});
   assert.deepEqual(warehouseModules,[]);
  }else{
   assert.ok(close.link.warehouseSource>0&&close.link.statusChecks>0&&warehouseModules.length>=2);
   assert.equal(close.link.refused>0,mode==='link-refusal');
  }
  if(mode==='link-refusal'){
   for(const err of flightErrors)assert.match(err,/THREE\.WebGLProgram|VALIDATE_STATUS|shader|link/i);
  }else assert.deepEqual(flightErrors,[]);
  await page.locator('#world').screenshot({path:`${out}/oleary-neighborhood-${mode}.png`,timeout:25_000});
  receipt[mode]={start,close,distance,warehouseModules,flightErrors};
  await writeFile(`${out}/oleary-neighborhood.json`,JSON.stringify(receipt,null,2)+'\n');
  console.log('O’Leary warehouse flight:',mode,Math.round(distance),close.warehouse,close.link);
  await page.close();
 }
}finally{await browser.close();}
