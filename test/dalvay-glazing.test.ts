import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {aerialPerspectiveRequested} from '../src/render/aerial-profile.ts';
import {loadVerifiedAerialSky,verifiedAerialOptics,type VerifiedAerialSky} from '../src/render/aerial-perspective-lab.ts';
import {dalvayGlazingRequested,dalvayExteriorRequested,dalvayWaterRequested,standardSourisShoreline} from '../src/app/scenery-profile.ts';
import {dalvayGlazingFragment,dalvayGlazingWitness,type DalvayGlazingSource} from '../src/render/dalvay-glazing.ts';
import {decodeDalvay,loadDalvay} from '../src/render/dalvay-art-packet.ts';

const bytes=readFileSync('public/art/dalvay-manor-exterior-v2.dvx'),raw=gunzipSync(bytes),skyBytes=readFileSync('public/world/maritime-sky.webp');
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
async function mockWorld(){
 const source=await loadVerifiedAerialSky('/sky',async()=>new T.Texture({width:4096,height:2048}),async()=>new Response(ab(skyBytes)));
 if(!source)throw Error('Expected genuine signed panorama authority');
 assert(verifiedAerialOptics(source));assert(!verifiedAerialOptics({texture:source.texture} as VerifiedAerialSky));
 const panorama=source.texture;panorama.colorSpace=T.SRGBColorSpace;panorama.wrapS=T.RepeatWrapping;
 const skyEnv=panorama.clone();skyEnv.mapping=T.EquirectangularReflectionMapping;skyEnv.needsUpdate=true;
 const viewer=new T.PerspectiveCamera(53,1.5,.08,350000);const scene=new T.Scene();
 scene.environment=skyEnv;scene.environmentIntensity=.77;scene.environmentRotation.y=-.512*Math.PI*2;
 let target:T.WebGLRenderTarget|null=null,contextLost=false;const reports:boolean[]=[];
 const engine={capabilities:{maxTextures:16},getRenderTarget:()=>target,getContext:()=>({isContextLost:()=>contextLost}),xr:{isPresenting:false}} as unknown as T.WebGLRenderer;
 const request:DalvayGlazingSource={verified:source,panorama,scene,viewer,engine,report:x=>reports.push(x)};
 return {request,reports,changeTarget:(t:T.WebGLRenderTarget|null)=>{target=t;},contextLost:(v:boolean)=>{contextLost=v;},dispose(){skyEnv.dispose();panorama.dispose();}};
}
const render=(mesh:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>,r:DalvayGlazingSource,camera:T.Camera=r.viewer)=>{
 mesh.onBeforeRender(r.engine,r.scene,camera,mesh.geometry,mesh.material,null as any);
};
const asGlass=(art:NonNullable<ReturnType<typeof decodeDalvay>>)=>art.group.children[4] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
const actualShader=()=>({fragmentShader:T.ShaderLib.standard.fragmentShader,vertexShader:T.ShaderLib.standard.vertexShader,uniforms:{}});
test('glass is nested under authenticated manor opt-in, and all Dalvay/ordinary switches remain independent',()=>{
 const keys=['dalvayExteriorStudy','stockDalvayExterior','dalvayGlazingStudy','stockDalvayGlazing','dalvayWaterOptics','stockDalvayWaterOptics'];
 for(let p=0;p<64;p++){
  const q=new URLSearchParams('departure=dalvay-lake-coastal-pass&scenery=standard');
  keys.forEach((key,i)=>{if(p&(1<<i))q.set(key,'');});
  const manor=!!(p&1)&&!(p&2),glass=manor&&!!(p&4)&&!(p&8),water=!!(p&16)&&!(p&32);
  assert.equal(dalvayGlazingRequested(q),glass,q.toString());assert.equal(dalvayExteriorRequested(q),manor);assert.equal(dalvayWaterRequested(q),water);
  assert(standardSourisShoreline(q));assert(aerialPerspectiveRequested(q));
  for(const blocked of ['scenery=detail','surveyRelief','alien'])assert(!dalvayGlazingRequested(new URLSearchParams(q.toString()+'&'+blocked)));
 }
});

test('opaque signed meshes and only original glass material keep draw identity, with exact compiled-stock hooks on withdrawal',async()=>{
 assert.equal(sha(bytes),'35b99bcb553c16a25960f98ea540a6313c315d622e5cc75f9aa27b2512ff6382');
 assert.equal(sha(raw),'f6cc105d9f22c2b469de95cc2b4f1b70805e080aba0562acba7e6833021661fd');
 const w=await mockWorld(),a=decodeDalvay(ab(raw),w.request)!;
 const m=asGlass(a),stock=m.material,stockKey=stock.customProgramCacheKey;let invalidations=0;
 stock.addEventListener('dispose',()=>invalidations++);
 const g=a.group.children as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[],refs=g.map(q=>[q,q.material,q.geometry,q.geometry.index]);
 assert(a.intact()&&g.length===5);assert.equal(g.reduce((n,m)=>n+m.geometry.index!.count/3,0),24853);
 const sig=()=>{
  refs.forEach(([q,mat,geo,idx],i)=>{assert.equal(g[i],q);assert.equal(g[i].material,mat);assert.equal(g[i].geometry,geo);assert.equal(g[i].geometry.index,idx);});
  assert.equal(stock.depthTest,true);assert.equal(stock.depthWrite,true);assert.equal(stock.transparent,false);assert.equal(stock.opacity,1);assert.equal(stock.roughness,.29);assert.equal(stock.metalness,.08);assert(a.intact());
 };
 const base=actualShader();stock.onBeforeCompile(base,w.request.engine);
 assert.equal(base.fragmentShader,T.ShaderLib.standard.fragmentShader);
 render(m,w.request);
 const active=actualShader();stock.onBeforeCompile(active,w.request.engine);
 assert.equal(active.vertexShader,base.vertexShader);assert.equal((active.uniforms as any).dalvayOriginalSky.value,w.request.panorama);
 assert(active.fragmentShader.includes('dvGlazing(outgoingLight,normal,geometryViewDir,vViewPosition)'));
 assert.notEqual(stock.customProgramCacheKey,stockKey);assert.deepEqual(w.reports,[true]);assert.equal(invalidations,0);sig();
 render(m,w.request);assert.equal(invalidations,0,'steady flight must never invalidate the cached shader');
 const other=w.request.viewer.clone();render(m,w.request,other);
 assert.equal(stock.customProgramCacheKey,stockKey);assert.equal(invalidations,1);const withdrawn=actualShader();stock.onBeforeCompile(withdrawn,w.request.engine);assert.deepEqual(withdrawn,base);sig();
 render(m,w.request);const replay=actualShader();stock.onBeforeCompile(replay,w.request.engine);assert.equal(replay.fragmentShader,active.fragmentShader);assert.equal(invalidations,2);sig();
 const otherTarget=new T.WebGLRenderTarget(1,1);w.changeTarget(otherTarget);render(m,w.request);assert.equal(stock.customProgramCacheKey,stockKey);
 w.changeTarget(null);render(m,w.request);assert.notEqual(stock.customProgramCacheKey,stockKey);
 w.contextLost(true);render(m,w.request);assert.equal(stock.customProgramCacheKey,stockKey);
 w.contextLost(false);render(m,w.request);assert.notEqual(stock.customProgramCacheKey,stockKey);
 w.request.panorama.minFilter=T.LinearFilter;render(m,w.request);assert.equal(stock.customProgramCacheKey,stockKey);sig();
 w.request.panorama.minFilter=T.LinearMipmapLinearFilter;render(m,w.request);assert.equal(w.reports.at(-1),true);
 const auth=w.request.verified as {texture:T.Texture|undefined},held=auth.texture;
 auth.texture=undefined;render(m,w.request);assert.equal(stock.customProgramCacheKey,stockKey);
 auth.texture=held;render(m,w.request);assert.equal(w.reports.at(-1),true);
 w.request.panorama.needsUpdate=true;render(m,w.request);assert.equal(w.reports.at(-1),false);
 a.dispose();a.dispose();assert.equal(stock.customProgramCacheKey,stockKey);
 assert.equal(m.onBeforeRender,T.Object3D.prototype.onBeforeRender);w.dispose();otherTarget.dispose();
});
test('unauthenticated, altered and unknown source are optional; unavailable body remains original manor fallback',async()=>{
 const w=await mockWorld(),base=decodeDalvay(ab(raw))!,native=asGlass(base),q=w.request;
 let art=decodeDalvay(ab(raw),{...q,panorama:new T.Texture()})!;
 assert.equal(asGlass(art).onBeforeRender,native.onBeforeRender);art.dispose();
 q.panorama.generateMipmaps=false;
 art=decodeDalvay(ab(raw),q)!;assert.equal(asGlass(art).onBeforeRender,native.onBeforeRender);assert(art.intact());art.dispose();
 q.panorama.generateMipmaps=true;
 (q.panorama.image as any).width=1024;
 art=decodeDalvay(ab(raw),q)!;assert.equal(asGlass(art).onBeforeRender,native.onBeforeRender);assert(art.intact());art.dispose();
 q.panorama.image.width=4096;
 art=decodeDalvay(ab(raw),q)!;const m=asGlass(art);render(m,q);
 const unknown={...actualShader(),fragmentShader:'foreign host'};m.material.onBeforeCompile(unknown,q.engine);assert.equal(unknown.fragmentShader,'foreign host');render(m,q);
 assert.equal(m.material.customProgramCacheKey,native.material.customProgramCacheKey);assert(art.intact());art.dispose();base.dispose();
 const sig=new AbortController().signal;let request=0;
 for(const response of [()=>new Response('',{status:404}),()=>new Response(ab(Buffer.from(bytes).fill(0,5,15)))]){
  assert.equal(await loadDalvay('/missing/',sig,async()=>{request++;return response();},q),undefined);
 }
 assert.equal(request,2);w.dispose();
});
test('registered angle, horizon, distance and mip thresholds are finite and bounded',()=>{
 const p={viewCos:.7,rayY:.25,footprintPx:64,pixelM:.055,distanceM:72,viewZ:70,cameraNear:.08,skyLinear:[.40,.50,.62] as const};
 const a=(extra:Partial<typeof p>={})=>dalvayGlazingWitness({...p,...extra})!;
 const angle=[1,.75,.5,.25,0].map(viewCos=>a({viewCos}).layer);
 assert(angle.every((v,i)=>i===0||v>angle[i-1]));assert(angle[0]>.04&&angle.at(-1)!<.28);
 const mip=[0,1e-9,1,16,64,230,1800,3100,1e6].map(footprintPx=>a({footprintPx}).mip);
 assert(mip.every((v,i)=>Number.isFinite(v)&&(i===0||v>=mip[i-1])));assert(mip[0]>=4.65&&mip.at(-1)===10.25);
 assert.deepEqual(a({rayY:-.001-.065}).radiance,a({rayY:-.75,skyLinear:[1,0,0] as any}).radiance);
 const ys=Array.from({length:91},(_,i)=>-.35+.01*i),diffs=ys.slice(1).map((y,i)=>Math.max(...a({rayY:y}).radiance.map((v,j)=>Math.abs(v-a({rayY:ys[i]}).radiance[j]))));
 assert(Math.max(...diffs)<.028&&a({rayY:.2}).radiance.every(x=>x>0&&x<.7));
 assert(a({viewZ:.55}).layer<a({viewZ:1.42}).layer);assert(a({pixelM:.74}).layer<a({pixelM:.22}).layer);assert(a({distanceM:500}).layer<a().layer);
 for(const f of [{viewZ:.4},{viewZ:.49,cameraNear:1},{cameraNear:-.1},{distanceM:600},{rayY:NaN},{footprintPx:Infinity},{pixelM:.82}])assert.equal(a(f),undefined);
 const source=T.ShaderLib.standard.fragmentShader;assert(dalvayGlazingFragment(source));
 assert.equal(dalvayGlazingFragment(source+source),undefined);assert.equal(dalvayGlazingFragment(source.replace('#include <opaque_fragment>','')),undefined);
});
