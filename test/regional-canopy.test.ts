import test from 'node:test';
import { standardRegionalCanopyRequested } from '../src/app/scenery-profile.ts';
import { departureBriefing } from '../src/app/departure-briefing.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {regionalCanopyRequested,sceneryOptions,sceneryReviewBlock,reviewedScenery} from '../src/app/scenery-profile.ts';
import {decodeRegionalCanopy,readRegionalCanopy} from '../src/render/regional-canopy/assets.ts';
import {REGIONAL_STANDS} from '../src/render/regional-canopy/spec.ts';
import {REGIONAL_CANOPY_DEPARTURES} from '../src/render/regional-canopy/departures.ts';
import {SITES} from '../src/sim/places.ts';
const bytes=(a:Uint8Array)=>Uint8Array.from(a).buffer;

test('the legacy opt-in path stays separate from Detailed and other woodland cohorts',()=>{
 assert(!regionalCanopyRequested(sceneryOptions('')));
 assert(!regionalCanopyRequested(sceneryOptions('?miscoucheCanopyStudy')));
 assert(regionalCanopyRequested(sceneryOptions('?regionalCanopyStudy')));
 assert(regionalCanopyRequested(sceneryOptions('?regionalCanopyStudy&mist&miscoucheCanopyStudy')));
 assert.equal(sceneryReviewBlock('regionalCanopyStudy',sceneryOptions('?scenery=detail')),'detail');
 for(const mode of ['scenery=detail','scenery=unknown','canopyLight','woodlandView','surveyRelief','inlandRelief',
  'forestFloor','woodland3D','woodlandCrownBase','woodlandBark','mappedLaneCanopyStudy','buildingShadows','seatedForestShadows','stockRegionalCanopy']){
  assert(!regionalCanopyRequested(sceneryOptions('?regionalCanopyStudy&'+mode)),mode);
 }
 assert.deepEqual(reviewedScenery('?regionalCanopyStudy'),['regionalCanopyStudy']);
 assert(REGIONAL_CANOPY_DEPARTURES.every((s)=>s.height===112&&s.heading===90&&!SITES.some(old=>old.id===s.id)));
});

test('authenticates both small RCV1 cohorts and rejects malformed transports, body and identities',async()=>{
 for(const s of REGIONAL_STANDS){
  const gzip=bytes(readFileSync(new URL('../public/world/regional-canopy-v1/'+s.file,import.meta.url))),raw=bytes(gunzipSync(gzip));
  const both=[['identity',gzip],['gzip',raw]] as const;
  for(const [encoding,file] of both){
   let calls=0;
   const items=await readRegionalCanopy('/fixture/',s,async(path,init)=>{
    assert.equal(path,'/fixture/regional-canopy-v1/'+s.file);assert.equal(init?.redirect,'error');calls++;
    return new Response(file,{headers:{'content-length':String(s.wireBytes),'content-encoding':encoding}});
   });
   assert.equal(calls,1);assert.equal(items?.length,s.count);
  }
  const flip=gzip.slice(0);new Uint8Array(flip)[9]^=32; // Payload decodes to the exact original model.
  const badDecoded=raw.slice(0);new Uint8Array(badDecoded)[23]^=16;
  for(const r of [new Response(null,{status:404}),new Response(gzip,{status:206}),new Response(gzip,{headers:{'content-range':'bytes 0-4/5'}}),
   new Response(flip),new Response(raw),new Response(gzip.slice(0,100)),new Response(new ArrayBuffer(gzip.byteLength+1)),
   new Response(badDecoded,{headers:{'content-encoding':'gzip'}}),new Response(gzip,{headers:{'content-encoding':'br'}})])
   assert.equal(await readRegionalCanopy('/',s,async()=>r),undefined);
  for(const i of [0,4,8,10]){
   const twin=raw.slice(0);new Uint8Array(twin)[i]^=1;assert.equal(decodeRegionalCanopy(twin,s),undefined);
  }
  const infinite=raw.slice(0);new DataView(infinite).setFloat32(12,-Infinity,true);assert.equal(decodeRegionalCanopy(infinite,s),undefined);
 }
});

test('late success cannot arm a cohort and oversize streaming aborts before parse',async()=>{
 const s=REGIONAL_STANDS[0],gzip=bytes(readFileSync(new URL('../public/world/regional-canopy-v1/'+s.file,import.meta.url)));
 let aborted=false,cancelled=false;
 const late=await readRegionalCanopy('/',s,async(_path,init)=>{
  init?.signal?.addEventListener('abort',()=>aborted=true);
  await new Promise(r=>setTimeout(r,35));return new Response(gzip);
 },7);
 assert(!late&&aborted);
 const oversize=await readRegionalCanopy('/',s,async()=>new Response(new ReadableStream<Uint8Array>({
  start(c){c.enqueue(new Uint8Array(gzip.byteLength+8));},cancel(){cancelled=true;}
 })));
 assert(!oversize&&cancelled);
});

test('both woodland passes stay available for Standard, stock and detailed comparisons',()=>{
 assert(standardRegionalCanopyRequested(sceneryOptions('')));
 for(const k of ['stockRegionalCanopy','regionalCanopyStudy','miscoucheCanopyStudy','scenery=detail',
  'buildingShadows','duneGrassSurface','seatedRoads','woodland3D'])
   assert(!standardRegionalCanopyRequested(sceneryOptions('?'+k)),k);
 for (const departure of REGIONAL_CANOPY_DEPARTURES) {
  assert.match(departureBriefing(departure,''),/denser crowns/);
  assert.match(departureBriefing(departure,'?stockRegionalCanopy'),/canopy treatment is off/);
  assert.match(departureBriefing(departure,'?scenery=detail'),/canopy treatment is off/);
 }
});

test('signed crown mesh borrows the original sampler and only the registered directional sunlight uniform', async()=>{
 const {Scene,ShaderMaterial,Texture,Vector3,DoubleSide}=await import('three');
 const {createRegionalCanopy}=await import('../src/render/regional-canopy/mesh.ts');
 const s=REGIONAL_STANDS[0],file=bytes(readFileSync(new URL('../public/world/regional-canopy-v1/'+s.file,import.meta.url)));
 const rows=decodeRegionalCanopy(bytes(gunzipSync(new Uint8Array(file))),s);
 assert(rows);
 const sun={value:new Vector3(1,1,1).normalize()}, texture={value:new Texture()};
 function shader(hasMarker:boolean,other=false){
  return new ShaderMaterial({side:DoubleSide,alphaToCoverage:true,
   vertexShader:hasMarker?'uniform vec3 canopySun; varying vec3 cardSun;':'',
   fragmentShader:'varying vec3 cardSun; float a=clamp((a-.30)*3.8,0.,1.);',
   uniforms:{canopy:texture,canopySun:sun,...(other?{unknown:{value:7}}:{})}});
 }
 const scene=new Scene();
 assert.equal(createRegionalCanopy(scene,shader(false),s,rows,()=>s.seats[0]),undefined);
 assert.equal(createRegionalCanopy(scene,shader(true,true),s,rows,()=>s.seats[0]),undefined);
 const pass=createRegionalCanopy(scene,shader(true),s,rows,()=>s.seats[0]);
 assert(pass);assert.equal(pass.mesh.material.uniforms.canopySun,sun);
 assert.equal(pass.mesh.material.uniforms.canopy,texture);
 pass.dispose();assert.equal(scene.children.length,0);
});

test('the exact Standard near-leaf shader seats the existing Queens and Kings crowns; altered peers fail closed',async()=>{
 const {Scene,ShaderMaterial,Texture,Vector3,DoubleSide}=await import('three');
 const {STOCK_LEAF_CROWN_PROGRAM}=await import('../src/render/stock-crown-program.ts');
 const {inheritedCanopyCoverageBlend,opaqueCanopyCoverageBlend}=await import('../src/render/canopy-coverage-alpha.ts');
 const {createRegionalCanopy}=await import('../src/render/regional-canopy/mesh.ts');
 const alpha='clamp((a-.30)*3.8,0.,1.)';
 const {createHash}=await import('node:crypto');
 const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
 assert.equal(sha(STOCK_LEAF_CROWN_PROGRAM.vertexShader),'7cdc5727c9ddd750358ff213f6f2f6c9e07cfb3f927eb0ac2744d799795f0176');
 assert.equal(sha(STOCK_LEAF_CROWN_PROGRAM.fragmentShader),'0b87f025c69132184c76a824fe86163d202cce3b3f0f50d54c0350f1ad2fc2d8');
 assert(!STOCK_LEAF_CROWN_PROGRAM.vertexShader.includes('uniform vec3 canopySun; varying vec3 cardSun;'));
 for(const spec of REGIONAL_STANDS){
  const packed=readFileSync(new URL('../public/world/regional-canopy-v1/'+spec.file,import.meta.url));
  const rows=decodeRegionalCanopy(bytes(gunzipSync(packed)),spec);assert(rows);
  const scene=new Scene(),sampler={value:new Texture()},sun={value:new Vector3(.5,.8,.4).normalize()};
  const base=new ShaderMaterial({side:DoubleSide,alphaToCoverage:true,uniforms:{canopy:sampler,canopySun:sun},...opaqueCanopyCoverageBlend,...STOCK_LEAF_CROWN_PROGRAM});
  const seat=(x:number,z:number)=>x===rows[0][0]&&z===rows[0][1]?spec.seats[0]:spec.seats[1];
  const originalSourceVersion=sampler.value.source.version;
  const shape=createRegionalCanopy(scene,base,spec,rows,seat);assert(shape);
  assert.equal(sampler.value.source.version,originalSourceVersion);
  assert.equal(shape.total,spec.count);assert(!shape.mesh.visible);
  assert.equal(inheritedCanopyCoverageBlend(shape.mesh.material),opaqueCanopyCoverageBlend);
  assert.equal(shape.mesh.material.uniforms.canopy,sampler);
  assert.equal(shape.mesh.material.uniforms.canopySun,sun);
  assert.equal(shape.mesh.material.vertexShader,STOCK_LEAF_CROWN_PROGRAM.vertexShader);
  assert.equal(shape.mesh.material.fragmentShader,'uniform float regionalCanopyAlpha;\n'+STOCK_LEAF_CROWN_PROGRAM.fragmentShader.replace(alpha,alpha+'*regionalCanopyAlpha'));
  assert.equal(base.fragmentShader,STOCK_LEAF_CROWN_PROGRAM.fragmentShader);
  assert(!Object.hasOwn(base.uniforms,'regionalCanopyAlpha'));
  shape.gainTo(1);assert(shape.mesh.visible);shape.dispose();assert.equal(scene.children.length,0);
  // Same declarations and varying names, but not the exact live program.
  for(const [key,value] of [['vertexShader',base.vertexShader],['fragmentShader',base.fragmentShader]] as const){
   base[key]=value+'/* different program */';
   assert.equal(createRegionalCanopy(scene,base,spec,rows,seat),undefined);
   base[key]=value;
  }
  assert.equal(createRegionalCanopy(scene,base,spec,rows,()=>undefined),undefined);
  const noOpaque=new ShaderMaterial({side:DoubleSide,alphaToCoverage:true,uniforms:{canopy:sampler,canopySun:sun},...STOCK_LEAF_CROWN_PROGRAM});
  assert.equal(createRegionalCanopy(scene,noOpaque,spec,rows,seat),undefined);noOpaque.dispose();
  const noSun=new ShaderMaterial({side:DoubleSide,alphaToCoverage:true,uniforms:{canopy:sampler},...opaqueCanopyCoverageBlend,...STOCK_LEAF_CROWN_PROGRAM});
  assert.equal(createRegionalCanopy(scene,noSun,spec,rows,seat),undefined);noSun.dispose();
  assert.equal(scene.children.length,0);
  base.dispose();sampler.value.dispose();
 }
});
