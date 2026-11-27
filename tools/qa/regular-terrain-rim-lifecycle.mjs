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
];
const scene=world.scene;
const camera=new T.PerspectiveCamera(53,840/540,.08,350000);
const view2=camera.clone();
world.details.load=async()=>undefined;
let clock=1;const update=(x,z)=>world.update(new T.Vector3(x,120,z),clock+=1);
const far=()=>update(500000,500000);
const go=k=>{const {lon,lat}=poses[k],v=project(lon,lat);far();update(v.x,v.z);};
const normal=(alpha=true,samples=4)=>{
 let probes=0;
 const gl={SAMPLES:0x80a9,createVertexArray(){},isContextLost:()=>false,
  getContextAttributes:()=>({alpha,antialias:!!samples,depth:true}),getParameter(p){A.equal(p,gl.SAMPLES);++probes;return samples;}};
 return {r:{getContext:()=>gl,getRenderTarget:()=>null,
   xr:{isPresenting:false},capabilities:{logarithmicDepthBuffer:true,reversedDepthBuffer:false},
   autoClear:true,autoClearDepth:true,sortObjects:true}, gl, count:()=>probes};
};
const get=id=>world.byId.get(id);
const meta=normal();
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
// Genuine other test centre, not a respawn or special camera inserted into output.
go(1);const Q=get('20-19'),q=Q.fine;
close=owner.begin(camera);A(close);
dispatch(q);A.equal(Q.local.uniforms[RIM_UNIFORM].value,44666.54296875);
complete(q);A.equal(Q.local.uniforms[RIM_UNIFORM].value,0);
A.deepEqual(owner.diagnostics().drawnFine,['20-19']);close();
far();A.equal(owner.begin(camera),undefined);
A.equal(Q.local.vertexShader,STOCK_TERRAIN_VERTEX);A(!Q.local.uniforms[RIM_UNIFORM]);
A.equal(H.local.vertexShader,STOCK_TERRAIN_VERTEX);A.equal(meta.count(),1);

go(1);
for(const f of [normal(false,4),normal(true,0),normal(true,2)]){
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
console.log(JSON.stringify({scope:'Offline host and actual original Three terrain. Fake renderer calls only; real independent Cover SHA.',
 rgba4OrdinaryTrueAccepted:true,falseAlphaAndNoOrDifferentSampleFallback:true,onlyOneFramebufferProbe:true,
 coldNoNewSourceOrRimElsewhere:true,bothExactTargetPairsScopedPositive:true,nonOwnerControlExact:true,
 rawStockGeometryAndPointersExact:true,foreignUniformBetweenBeginAndDrawRestoresOwnedSource:true,
 noStaleDisposerAndForceFinallyZero:true,constructionMaterialVersionAndDefinesFrozen:true,
 whiteDepthPolygonCameraLayerSceneRendererDriftVeto:true,offLODLiteralOldBothRoles:true,
 correctMetadataWrongBytesRefusedByRealSubtle:true},null,2));
