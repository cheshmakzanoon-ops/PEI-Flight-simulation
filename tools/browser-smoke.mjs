/** Run against a local production preview. Requires Playwright and Chromium. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { Color } from 'three';

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173/';
const out = process.env.SMOKE_OUTPUT ?? 'artifacts/smoke';
await mkdir(out,{recursive:true});
console.log('Launching Chromium');
const browser = await chromium.launch({
  args:['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({viewport:{width:1200,height:760}});
  const expectedRustico = new Color(0xaeb1aa).toArray().map(Math.fround);
  const rusticoRoofPositions = [2432.568115234375,7.206749439239502,1077.5399169921875,2423.970703125,12.516749382019043,1068.70263671875,2449.072265625,12.516749382019043,1044.2471923828125,2432.568115234375,7.206749439239502,1077.5399169921875,2449.072265625,12.516749382019043,1044.2471923828125,2457.669677734375,7.206749439239502,1053.08447265625,2415.373291015625,7.206749439239502,1059.8653564453125,2440.474853515625,7.206749439239502,1035.409912109375,2449.072265625,12.516749382019043,1044.2471923828125,2415.373291015625,7.206749439239502,1059.8653564453125,2449.072265625,12.516749382019043,1044.2471923828125,2423.970703125,12.516749382019043,1068.70263671875];
  await page.addInitScript(({origin,positions})=>{
    const p=WebGL2RenderingContext.prototype,drawArrays=p.drawArrays;
    const proof=window.rusticoGpuRoof={watch:false,draw:null};
    p.drawArrays=function(mode,first,count){
      const result=drawArrays.call(this,mode,first,count);
      if(!proof.watch||proof.draw||mode!==this.TRIANGLES||first!==0||count!==37950||
        this.canvas!==document.querySelector('#world')||this.getParameter(this.DRAW_FRAMEBUFFER_BINDING)!==null)return result;
      const program=this.getParameter(this.CURRENT_PROGRAM);
      if(!program)return result;
      const modelLoc=this.getUniformLocation(program,'modelMatrix'),slot=this.getAttribLocation(program,'color'),geoSlot=this.getAttribLocation(program,'position');
      if(modelLoc===null||slot<0||geoSlot<0)return result;
      const model=this.getUniform(program,modelLoc);
      if(!model||model[12]!==origin[0]||model[13]!==origin[1]||model[14]!==origin[2])return result;
      const tight=i=>this.getVertexAttrib(i,this.VERTEX_ATTRIB_ARRAY_ENABLED)&&
        this.getVertexAttrib(i,this.VERTEX_ATTRIB_ARRAY_SIZE)===3&&
        this.getVertexAttrib(i,this.VERTEX_ATTRIB_ARRAY_TYPE)===this.FLOAT&&
        !this.getVertexAttrib(i,this.VERTEX_ATTRIB_ARRAY_NORMALIZED)&&
        this.getVertexAttrib(i,this.VERTEX_ATTRIB_ARRAY_STRIDE)===12&&
        this.getVertexAttribOffset(i,this.VERTEX_ATTRIB_ARRAY_POINTER)===0;
      if(!tight(slot)||!tight(geoSlot))return result;
      const bound=this.getVertexAttrib(slot,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
      const geo=this.getVertexAttrib(geoSlot,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
      const prior=this.getParameter(this.ARRAY_BUFFER_BINDING);
      const channels=new Float32Array(36);
      try{
        if(!bound||!geo)return result;
        const roofPositions=new Float32Array(36);
        this.bindBuffer(this.ARRAY_BUFFER,geo);
        this.getBufferSubData(this.ARRAY_BUFFER,25128*3*4,roofPositions);
        if(!roofPositions.every((x,i)=>x===positions[i]))return result;
        this.bindBuffer(this.ARRAY_BUFFER,bound);
        if(this.getBufferParameter(this.ARRAY_BUFFER,this.BUFFER_SIZE)!==37950*3*4)return result;
        this.getBufferSubData(this.ARRAY_BUFFER,25128*3*4,channels);
        proof.draw={count,roofFirst:25128,roofVertices:12,bufferStockStride:3,positionVerified:true,channels:Array.from(channels)};
      }finally{this.bindBuffer(this.ARRAY_BUFFER,prior);}
      return result;
    };
  },{origin:[-9622.229436054933,0,3889.8042232580183].map(Math.fround),positions:rusticoRoofPositions});
  const errors = [];
  page.setDefaultTimeout(60000);
  page.on('pageerror', error=>{errors.push(error.message); console.error(error.message);});
  page.on('console', entry=>{if(entry.type()==='error'){errors.push(entry.text()); console.error(entry.text());} else if (entry.type()==='warning') console.warn(entry.text());});
  page.on('response', response=>{
    if (response.status() >= 400 && response.url().startsWith(url)) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(new URL('?diagnostics', url).toString());
  const state=()=>page.evaluate(()=>window.islandAirDiagnostics);
  const waitState=(mode)=>page.waitForFunction(m=>window.islandAirDiagnostics?.mode===m,mode,{timeout:60000});
  await page.getByRole('button',{name:'Begin flight'}).waitFor({timeout:60000});
  console.log('Dispatch interface loaded');
  await page.waitForFunction(()=>window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.detail?.ready > 0 && window.islandAirDiagnostics?.drawCalls > 10,undefined,{timeout:60000});
  await page.screenshot({path:`${out}/01-dispatch.png`});
  await page.getByRole('button',{name:'Begin flight'}).click();
  await waitState('flight');
  const initial=await state();
  await page.waitForFunction(({x,z})=>Math.hypot(window.islandAirDiagnostics.x-x,window.islandAirDiagnostics.z-z)>15,initial,{timeout:30000});
  assert.equal((await state()).site,'cavendish');
  await page.screenshot({path:`${out}/02-cavendish.png`});
  await page.keyboard.press('v');
  await page.waitForFunction(()=>window.islandAirDiagnostics?.camera==='Cockpit');
  await page.screenshot({path:`${out}/03-cockpit.png`});
  for(const [option,id] of [['4','northcape'],['3','eastpoint'],['1','charlottetown'],['10','cavendish-low']]){
    await page.keyboard.press('m');
    await waitState('map');
    await page.locator('#map-site').selectOption(option);
    await page.locator('#fly-here').click();
    await waitState('flight');
    assert.equal((await state()).site,id);
  }
  await page.keyboard.press('v');
  await page.waitForFunction(()=>window.islandAirDiagnostics?.camera==='Wide chase');
  await page.keyboard.press('v');
  await page.waitForFunction(()=>window.islandAirDiagnostics?.camera==='Chase');
  await page.waitForFunction(()=>window.islandAirDiagnostics?.detail?.ready>0 && window.islandAirDiagnostics?.detail?.loading===0);
  const coast=PNG.sync.read(await page.screenshot({path:`${out}/04-cavendish-low.png`}));
  // Sample under the fixed Cavendish chase view; exclude aircraft, sky and HUD.
  // Previously this surveyed forest block was painted almost entirely blue by the sea.
  let sampled=0, blue=0;
  for(let y=Math.floor(coast.height*.78);y<coast.height*.91;y++){
    for(let x=Math.floor(coast.width*.36);x<coast.width*.78;x++){
      const i=(y*coast.width+x)*4,r=coast.data[i],g=coast.data[i+1],b=coast.data[i+2];
      sampled++;
      if(b>r+18 && g>r+13)blue++;
    }
  }
  assert.ok(blue/sampled<.15,`Ocean obscures Cavendish terrain: ${(100*blue/sampled).toFixed(1)}% blue`);
  await page.keyboard.press('p'); await waitState('paused');
  const paused=await state();
  await page.waitForTimeout(250);
  const frozen=await state();
  assert.equal(frozen.x,paused.x); assert.equal(frozen.z,paused.z);
  await page.getByRole('button',{name:'Resume flight'}).click(); await waitState('flight');

  // Prove the source-matched neutral roof streams on an unflagged ordinary
  // North Rustico route, using the same real browser and normal flight.
  await page.keyboard.press('m'); await waitState('map');
  await page.locator('#map-site').selectOption({label:'North Rustico Harbour · coastal pass'});
  await page.locator('#fly-here').click(); await waitState('flight');
  const startRustico=await state();
  assert.equal(startRustico.site,'north-rustico-harbour-low');
  try{
    await page.waitForFunction(a=>{
      const d=window.islandAirDiagnostics;
      return d?.site==='north-rustico-harbour-low'&&d.mode==='flight'&&d.camera==='Chase'&&d.rusticoHarbourRoof===true&&
        Math.hypot(d.x-a.x,d.z-a.z)>365;
    },{x:startRustico.x,z:startRustico.z},{polling:200,timeout:115000});
  }catch(error){
    console.error('North Rustico standard roof route:',JSON.stringify((await state())));
    throw error;
  }
  await page.evaluate(()=>{window.rusticoGpuRoof.draw=null;window.rusticoGpuRoof.watch=true;});
  await page.waitForFunction(()=>window.rusticoGpuRoof.draw?.positionVerified===true,undefined,{timeout:25000});
  await page.keyboard.press('p'); await waitState('paused');
  const nearRustico=await state(), q377Draw=await page.evaluate(()=>window.rusticoGpuRoof.draw);
  assert.deepEqual(q377Draw.channels,Array.from({length:12},()=>expectedRustico).flat());
  const rusticoDistance=Math.hypot(nearRustico.x-startRustico.x,nearRustico.z-startRustico.z);
  assert(rusticoDistance<560,'North Rustico verification missed the visible approach');
  assert.equal(nearRustico.rusticoHarbourRoof,true);
  assert(nearRustico.altitude>nearRustico.groundY+55);
  assert.deepEqual(await page.locator('#world').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');return [gl.isContextLost(),gl.getError()];
  }),[false,0]);
  console.log('North Rustico ordinary roof proof:',JSON.stringify({
    distance:rusticoDistance,altitude:nearRustico.altitude,renderedRoof:nearRustico.rusticoHarbourRoof,
    calls:nearRustico.drawCalls,triangles:nearRustico.triangles,q377Draw}));
  await page.locator('#world').screenshot({path:`${out}/05-north-rustico-low.png`,timeout:25000});
  assert.deepEqual((await state()).layerWarnings, []);
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: hosted build, scenery layers, flight, three county routes, camera and pause.');
} finally {
  await browser.close();
}

// Keep the already installed runner and server; local baseline-only callers
// can opt into the longer O’Leary compiled coverage without changing CI setup.
if(process.env.GITHUB_ACTIONS==='true'||process.env.OLEARY_NEIGHBORHOOD_SMOKE==='1'){
 await import('./oleary-neighborhood-smoke.mjs');
}
