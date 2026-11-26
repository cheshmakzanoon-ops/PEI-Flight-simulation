/** Verify the existing optional Montague ripple/foam program and stock fallback. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';

const {chromium}=createRequire(import.meta.url)('playwright');
const url=process.env.PREVIEW_URL??'http://127.0.0.1:4173/';
const baseline=process.env.BEFORE_PREVIEW_URL;
const out=process.env.SMOKE_OUTPUT??'artifacts/smoke';
const layer='montague-bridge-channel-preview';
const foundation='**/world/montague/v0/foundation.preview.gz';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,
 args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const result={};
try {
 for(const [address, prior] of [...(baseline?[[baseline,true]]:[]),[url,false]]){
 for(const mode of ['plain','only-optics','bad-foundation','live']){
  const page=await browser.newPage({viewport:{width:760,height:507},deviceScaleFactor:1});
  page.setDefaultTimeout(90000);
  let reads=0;const errors=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/montague/v0/foundation.preview.gz'))reads++;});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&m.text().includes('THREE.WebGLProgram'))errors.push(m.text());});
  if(mode==='bad-foundation')await page.route(foundation,route=>route.fulfill({status:200,
   contentType:'application/gzip',body:gzipSync(Buffer.alloc(111524))}));
  await page.addInitScript(()=>{
   const proto=WebGL2RenderingContext.prototype,original=proto.shaderSource;
   const water=new Set();
   window.nativeMontagueReachWater=water;
   proto.shaderSource=function(shader,source){
    if(this.canvas.id==='world'&&source.includes('rippleMap;')&&source.includes('foamPixelM='))water.add(source);
    return original.call(this,shader,source);
   };
  });
  try {
   const p=new URL(address);
   p.searchParams.set('diagnostics','');
   p.searchParams.set('departure','montague-bridge-low');
   if(mode!=='plain')p.searchParams.set('montagueReachOptics','');
   if(mode==='bad-foundation'||mode==='live')p.searchParams.set('montagueFoundationPreview','');
   const live=mode==='live';
   await page.goto(p.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(arg=>{
    const d=window.islandAirDiagnostics;
    return d?.mode==='dispatch'&&d.site===arg&&(window.nativeMontagueReachWater?.size??0)>0;
   },live?'montague-bridge-low':'montague');
   const sample=await page.evaluate(()=>{
    const g=document.querySelector('#world').getContext('webgl2');
    return {diagnostics:window.islandAirDiagnostics,gl:g.getError(),programs:[...window.nativeMontagueReachWater]};
   });
   assert.equal(sample.gl,0);assert.deepEqual(errors,[]);
   const expected=mode==='bad-foundation'||live?1:0;
   assert.equal(reads,expected);
   assert.equal(sample.diagnostics.montagueFoundation,live?layer:null);
   assert.equal(await page.locator('#site option[value]').evaluateAll(a=>a.filter(x=>x.textContent.includes('Montague · river bridge pass')).length),live?1:0);
   const dye='if(riverCalm>0.)deep=mix(deep,vec3(.021,.053,.067),riverCalm*.68);';
   assert.equal(sample.programs.filter(s=>s.includes(dye)).length,prior&&live?1:0);
   const calm=sample.programs.filter(s=>s.includes('float riverCalm=montagueStillWater(reach)'));
   assert.equal(calm.length,live?1:0);
   for(const s of calm){
    assert.ok(s.includes('n*=1.-.61*riverCalm'));
    assert.ok(s.includes('foam*=1.-smoothstep(0.,.255,riverCalm)'));
   }
   // Compare like-for-like profiles. Historically the optics query flag
   // already selected different surrounding shader options even without
   // a foundation; that compatibility behaviour is not changed here.
   const programSHA=sample.programs.map(s=>createHash('sha256')
    .update(s.replace(dye,'').replace(/\s/g,'')).digest('hex')).sort();
   const value={site:sample.diagnostics.site,foundation:sample.diagnostics.montagueFoundation,reads,gl:sample.gl,
    activePrograms:calm.length,programSHA};
   if(prior)(result.before??={})[mode]=value;
   else {
    if(baseline)assert.deepEqual(value,result.before[mode]);
    result[mode]=value;
   }
   console.log('Montague reach',prior?'before':'compiled',mode,value);
  }finally{await page.close();}
 }
 }
 await mkdir(out,{recursive:true});
 await writeFile(out+'/montague-reach-optics.json',JSON.stringify(result,null,2)+'\n');
}finally{await browser.close();}
