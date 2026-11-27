/** Offline draw-lifecycle and refusal controls on real signed Three.js terrain. */
import * as T from 'three';
import A from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {project} from '../../src/sim/geo.ts';
import {verifyDecodedCover} from '../../src/sim/cover-proof.ts';
import {RegularNorthRimDraw} from '../../src/render/regular-z-rim-host.ts';
import {PINNED_TERRAIN,RIM_VERTEX,RIM_UNIFORM,STOCK_TERRAIN_VERTEX} from '../../src/render/regular-z-rim-clip-v2.ts';
import {CANOPY_FENCE} from '../../src/render/canopy-fence.generated.ts';

const prefix=new URL('../../src/',import.meta.url).href,dir=new URL('../../public/world/',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFileSync(new URL(p,dir));
const hook=registerHooks({load(url,ctx,next){
 const row=next(url,ctx);
 return url.startsWith(prefix)&&url.endsWith('.ts')&&row.source?
  {...row,source:"import.meta.env={BASE_URL:'/'};\n"+row.source}:row;
}});
const {World}=await import('../../src/render/world.ts');hook.deregister();
const tm=JSON.parse(read('terrain.json')),raw=gunzipSync(read(tm.file));
A.equal(sha(raw),tm.sha256);A.equal(tm.sha256,PINNED_TERRAIN);
const dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
const terrain=new Terrain(tm,Int16Array.from({length:raw.byteLength/2},(_,i)=>dv.getInt16(i*2,true)));
const cm=JSON.parse(read('cover.json')),wire=read(cm.file);
A.equal(sha(wire),cm.compressedSha256);
const cover=new Cover(cm.width,cm.height,new Uint8Array(gunzipSync(wire)),undefined,cm.compressedSha256);
T.TextureLoader.prototype.load=()=>new T.Texture();
globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
const world=new World(new T.Scene(),terrain,new T.Texture(),{capabilities:{maxTextureSize:4096}},cover,new T.Texture());
const poses=[
 {lon:-62.83470189398629,lat:46.20312037327427,owners:['20-16','20-17']},
 {lon:-62.854377469109984,lat:46.09749268994005,owners:['20-18','20-19']},
 {lon:-62.98198862542011,lat:46.257249568527996,owners:['18-15','18-16']},
];
const scene=world.scene;
const camera=new T.PerspectiveCamera(53,840/540,.08,350000);
const view2=camera.clone();
world.details.load=async()=>undefined;
let clock=1;const update=(x,z)=>world.update(new T.Vector3(x,120,z),clock+=1);
const far=()=>update(500000,500000);
const go=k=>{const {lon,lat}=poses[k],v=project(lon,lat);far();update(v.x,v.z);};
const normal=(alpha=true,samples=4,antialias=samples>0,depth=true)=>{
 let probes=0,lost=false;
 const gl={SAMPLES:0x80a9,createVertexArray(){},isContextLost:()=>lost,
  getContextAttributes:()=>({alpha,antialias,depth}),getParameter(p){A.equal(p,gl.SAMPLES);++probes;return samples;}};
 const r={getContext:()=>gl,getRenderTarget:()=>null,
   xr:{isPresenting:false},capabilities:{logarithmicDepthBuffer:true,reversedDepthBuffer:false},
   autoClear:true,autoClearDepth:true,sortObjects:true};
 return {r,gl,count:()=>probes,lose:v=>{lost=v;},restore:(nextSamples,nextAA)=>{
  lost=false;samples=nextSamples;antialias=nextAA;r.capabilities={...r.capabilities};
 }};
};
const get=id=>world.byId.get(id);
const profile=process.argv[2]??'rgba4';
A(profile==='rgba4'||profile==='rgba0');
const samples=profile==='rgba4'?4:0,meta=normal(true,samples,profile==='rgba4');
const source=new Cover(cover.width,cover.height,cover.bytes,cover.harbour,cover.sourceSha);
const base=()=>new RegularNorthRimDraw(scene,meta.r,terrain,source,PINNED_TERRAIN,get,()=>false);
const owner=base();A.equal(source.sourceDecodedSha,undefined);
far();A.equal(owner.begin(camera),undefined);A.equal(owner.diagnostics().source,'cold');A.equal(meta.count(),0);
go(0);const [N,S]=poses[0].owners.map(get),S2=get('20-19'),H=get('18-16');
A.equal(owner.begin(camera),undefined);A.equal(S.local.vertexShader,STOCK_TERRAIN_VERTEX);A(!S.local.uniforms[RIM_UNIFORM]);
A.equal(owner.diagnostics().source,'checking');
A.equal(await verifyDecodedCover(source),CANOPY_FENCE.pins.coverDecoded);
await Promise.resolve();A.equal(owner.diagnostics().source,'verified');
const defaultBefore=T.Object3D.prototype.onBeforeRender,defaultAfter=T.Object3D.prototype.onAfterRender;
const u=()=>S.local.uniforms[RIM_UNIFORM];
const dispatch=(p,mat=p.material,r=meta.r,c=camera,geo=p.geometry,sceneArg=scene,group=null)=>{
 p.onBeforeRender(r,sceneArg,c,geo,mat,group);
};
const complete=(p)=>p.onAfterRender(meta.r,scene,camera,p.geometry,p.material,null);
const g=N.fine,f=S.fine,stock=N.local,ground=S.local;
const baseAttrs=[g,f].map(m=>[m.geometry,m.material,m.geometry.index,...Object.values(m.geometry.attributes)]);
const vertices=baseAttrs.map(m=>m.slice(2).map(x=>sha(Buffer.from(x.array.buffer,x.array.byteOffset,x.array.byteLength))));
const FS=ground.fragmentShader, uniform=ground.uniforms;
const initialVersion=ground.version;
const pairSurface=(n,s)=>[.15,.5,.85].flatMap(f=>[-.05,0,.05].map(d=>{
 const x=n.x0+n.w*f,z=s.z0+d;return [world.visualGroundHeight(x,z),world.surface(x,z)];
}));
const beforeSurface=pairSurface(N,S);

let end=owner.begin(camera);A(end);
A.equal(ground.version,initialVersion+1);A.equal(ground.vertexShader,RIM_VERTEX);A.equal(ground.fragmentShader,FS);
A.equal(ground.uniforms,uniform);A.equal(N.local,stock);A.equal(u().value,0);
A.equal(g.onBeforeRender,defaultBefore);A.equal(S.coarse.onBeforeRender,defaultBefore);
A.equal(H.local.vertexShader,STOCK_TERRAIN_VERTEX);A.equal(S2.local.vertexShader,STOCK_TERRAIN_VERTEX);
dispatch(g);dispatch(S.coarse);A.equal(u().value,0);
dispatch(f);A.equal(u().value,32944.1015625);
complete(f);A.equal(u().value,0);A.deepEqual(owner.diagnostics().drawnFine,['20-17']);
dispatch(f);A.equal(u().value,32944.1015625);
end();A.equal(u().value,0);A.equal(f.onBeforeRender,defaultBefore);A.equal(f.onAfterRender,defaultAfter);
const stale=end;
end=owner.begin(camera);A(end);dispatch(f);stale();A.equal(u().value,32944.1015625);
end();A.equal(u().value,0);
A.equal(meta.count(),1);

function resetBad(key,obj,bad){
 const old=obj[key],close=owner.begin(camera);A(close);
 obj[key]=bad;dispatch(f);
 A.equal(ground.vertexShader,STOCK_TERRAIN_VERTEX);
 A(!u());A.deepEqual(owner.diagnostics().drawnFine,[]);
 obj[key]=old;close();
}
for(const [name,val] of [['polygonOffset',true],['colorWrite',false],['opacity',.5],['depthFunc',T.AlwaysDepth],
                         ['fragmentShader',FS+' ']]){
 resetBad(name,ground,val);
}
resetBad('mask',camera.layers,2);
resetBad('mask',g.layers,2);
resetBad('overrideMaterial',scene,ground);
let close=owner.begin(camera);A(close);
ground.defines.__foreign_rim_test=1;dispatch(f);
A.equal(ground.vertexShader,STOCK_TERRAIN_VERTEX);A(!u());close();
delete ground.defines.__foreign_rim_test;

close=owner.begin(camera);A(close);
const foreign={value:32944.1015625};
ground.uniforms[RIM_UNIFORM]=foreign;dispatch(f);
A.equal(ground.vertexShader,STOCK_TERRAIN_VERTEX);A.equal(u(),foreign); // unrelated wrapper is never written
close();delete ground.uniforms[RIM_UNIFORM];

for(const denial of [[normal().r,camera],[meta.r,view2],[meta.r,camera,null]]){
 close=owner.begin(camera);A(close);
 dispatch(f,ground,denial[0],denial[1],denial.length===3?null:f.geometry);
 A.equal(ground.vertexShader,STOCK_TERRAIN_VERTEX);A(!u());close();
}
close=owner.begin(camera);A(close);
const oldVersion=ground.version;
ground.needsUpdate=true;dispatch(f);
A.equal(ground.vertexShader,STOCK_TERRAIN_VERTEX);A(!u());
close();A.equal(ground.version,oldVersion+2);
A.equal(owner.begin(camera),undefined); // permanent construction material drift on 20-17
A.equal(meta.count(),1);
for(const [i,m] of [g,f].entries()){
 const now=[m.geometry,m.material,m.geometry.index,...Object.values(m.geometry.attributes)];
 A.deepEqual(now,baseAttrs[i]);
 A.deepEqual(now.slice(2).map(x=>sha(Buffer.from(x.array.buffer,x.array.byteOffset,x.array.byteLength))),vertices[i]);
}
A.deepEqual(pairSurface(N,S),beforeSurface);
// Genuine other test centre, not a respawn or special camera inserted into output.
go(1);const M=get('20-18'),Q=get('20-19'),q=Q.fine;
const beforeQ=pairSurface(M,Q);
const originalQ=[q.geometry,q.material,q.geometry.index,...Object.values(q.geometry.attributes)];
const attrSha=(items)=>items.slice(2).map(x=>sha(Buffer.from(x.array.buffer,x.array.byteOffset,x.array.byteLength)));
const originalQSha=attrSha(originalQ);
close=owner.begin(camera);A(close);
dispatch(q);A.equal(Q.local.uniforms[RIM_UNIFORM].value,44666.54296875);
complete(q);A.equal(Q.local.uniforms[RIM_UNIFORM].value,0);
A.deepEqual(owner.diagnostics().drawnFine,['20-19']);close();
const afterQ=[q.geometry,q.material,q.geometry.index,...Object.values(q.geometry.attributes)];
A.deepEqual(afterQ,originalQ);A.deepEqual(attrSha(afterQ),originalQSha);
A.deepEqual(pairSurface(M,Q),beforeQ);
meta.lose(true);A.equal(owner.begin(camera),undefined);
A.equal(Q.local.vertexShader,STOCK_TERRAIN_VERTEX);A(!Q.local.uniforms[RIM_UNIFORM]);
A.equal(meta.count(),1);meta.lose(false);
close=owner.begin(camera);A(close);dispatch(q);A.equal(Q.local.uniforms[RIM_UNIFORM].value,44666.54296875);
close();A.equal(Q.local.uniforms[RIM_UNIFORM].value,0);A.equal(meta.count(),2);
// r187 may finish loss and restore between RAFs on the same GL object.
meta.restore(2,true);A.equal(owner.begin(camera),undefined);A.equal(meta.count(),3);
A.equal(meta.r.getContext(),meta.gl);A.equal(Q.local.vertexShader,STOCK_TERRAIN_VERTEX);A(!Q.local.uniforms[RIM_UNIFORM]);
A.equal(owner.begin(camera),undefined);A.equal(meta.count(),3);
meta.restore(samples,profile==='rgba4');
close=owner.begin(camera);A(close);A.equal(meta.count(),4);
meta.restore(2,true);dispatch(q);A.equal(Q.local.vertexShader,STOCK_TERRAIN_VERTEX);A(!Q.local.uniforms[RIM_UNIFORM]);
A.deepEqual(owner.diagnostics().drawnFine,[]);close();
A.equal(owner.begin(camera),undefined);A.equal(meta.count(),5);
meta.restore(samples,profile==='rgba4');
close=owner.begin(camera);A(close);dispatch(q);complete(q);close();A.equal(meta.count(),6);
A.deepEqual(owner.diagnostics().drawnFine,['20-19']);
far();A.equal(owner.begin(camera),undefined);
A.equal(Q.local.vertexShader,STOCK_TERRAIN_VERTEX);A(!Q.local.uniforms[RIM_UNIFORM]);
const mixed=[];
for(const [dz,want] of [[-7500,'112:56'],[7500,'56:112'],[-12200,'56:8'],[12200,'8:56']]){
 far();update(M.x0+M.w/2,Q.z0+dz);A.equal(`${M.lod}:${Q.lod}`,want);
 close=owner.begin(camera);
 A.equal(Q.local.vertexShader,STOCK_TERRAIN_VERTEX);A(!Q.local.uniforms[RIM_UNIFORM]);
 close?.();mixed.push(want);
}
go(2);
A(poses[2].owners.every(id=>get(id).lod===112));
close=owner.begin(camera);A.equal(H.local.vertexShader,STOCK_TERRAIN_VERTEX);A(!H.local.uniforms[RIM_UNIFORM]);close?.();
A.equal(meta.count(),6);
go(1);
for(const f of [normal(false,4,true),normal(false,0,false),normal(true,2,true),normal(true,8,true),
                 normal(true,0,true),normal(true,4,false),normal(true,2,false),normal(true,0,false,false),
                 normal(true,4,true,false)]){
 const invalid=new RegularNorthRimDraw(scene,f.r,terrain,source,PINNED_TERRAIN,get,()=>false);
 A.equal(invalid.begin(camera),undefined);
 A.equal(Q.local.vertexShader,STOCK_TERRAIN_VERTEX);
 A.equal(invalid.diagnostics().source,'cold');
}
const corrupt=cover.bytes.slice();corrupt[3]^=14;
const wrongCover=new Cover(cover.width,cover.height,corrupt,cover.harbour,cover.sourceSha);
const bogus=new RegularNorthRimDraw(scene,meta.r,terrain,wrongCover,PINNED_TERRAIN,get,()=>false);
A.equal(bogus.begin(camera),undefined);
A.notEqual(await verifyDecodedCover(wrongCover),CANOPY_FENCE.pins.coverDecoded);
A.equal(bogus.diagnostics().source,'stock');A.equal(bogus.begin(camera),undefined);
const no= new RegularNorthRimDraw(scene,meta.r,terrain,source,'forged-terrain',get,()=>false);
A.equal(no.begin(camera),undefined);A.equal(no.diagnostics().source,'stock');
console.log(JSON.stringify({scope:'Source-free actual original Three terrain and host lifecycle. Stand-in renderer callbacks, authentic local hashed atlas.',
 profile,samples,alpha:true,antialias:samples===4,depth:true,
 exactIdenticalStockOwnersAndGains:[{pair:N.id+'/'+S.id,stockAttributeSHA:vertices,shaderZ:32944.1015625},
 {pair:M.id+'/'+Q.id,stockAttributeSHA:originalQSha,shaderZ:44666.54296875}],
 worldContactAndVisualHeightUnchanged:true,refusedFramebufferCases:9,
 oncePerContextEpochAndLossRestoredLiteralShader:true,sameGLNewCapabilitiesCannotReuseStaleProfile:true,oldOwnerAndMixedLiteralStock:mixed,
 coldNoNewSourceOrRimElsewhere:true,bothExactTargetPairsScopedPositive:true,nonOwnerControlExact:true,
 rawStockGeometryAndPointersExact:true,foreignUniformBetweenBeginAndDrawRestoresOwnedSource:true,
 noStaleDisposerAndForceFinallyZero:true,constructionMaterialVersionAndDefinesFrozen:true,
 whiteDepthPolygonCameraLayerSceneRendererDriftVeto:true,offLODLiteralOldBothRoles:true,
 correctMetadataWrongBytesRefusedByRealSubtle:true},null,2));
