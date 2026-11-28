/** Offline exact atlas + Three r187 render-list and lease controls; no browser. */
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
import {CANOPY_FENCE} from '../../src/render/canopy-fence.generated.ts';
import {prepareSouth21Rim,SOUTH21,SOUTH21_VERTEX,south21ClipWorldZ,south21DryTaps} from '../../src/render/south21-rim.ts';
import {STOCK_TERRAIN_VERTEX} from '../../src/render/regular-z-rim-clip-v2.ts';

const app=new URL('../../src/',import.meta.url),publicWorld=new URL('../../public/world/',import.meta.url);
const bytes=v=>new Uint8Array(v.buffer,v.byteOffset,v.byteLength);
const sha=v=>createHash('sha256').update(bytes(v)).digest('hex');
const read=p=>readFileSync(new URL(p,publicWorld));
const hook=registerHooks({load(url,ctx,next){const out=next(url,ctx);return url.startsWith(app.href)&&url.endsWith('.ts')&&out.source?
 {...out,source:"import.meta.env={BASE_URL:'/'};\n"+out.source}:out;}});
const {World}=await import('../../src/render/world.ts');hook.deregister();
globalThis.fetch=()=>{throw new Error('No network in South21 offline proof');};
T.TextureLoader.prototype.load=()=>new T.Texture();
globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
const ts=JSON.parse(read('terrain.json')),raw=gunzipSync(read(ts.file));
A.equal(sha(raw),CANOPY_FENCE.pins.terrain);
const dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
const terrain=new Terrain(ts,Int16Array.from({length:raw.length/2},(_,i)=>dv.getInt16(2*i,true)));
const cm=JSON.parse(read('cover.json')),wire=read(cm.file);
A.equal(sha(wire),CANOPY_FENCE.pins.cover);
const cover=new Cover(cm.width,cm.height,new Uint8Array(gunzipSync(wire)),undefined,cm.compressedSha256);
const gl={SAMPLES:0x80a9,ALPHA_BITS:0x0d55,DEPTH_BITS:0x0d56,drawingBufferWidth:840,drawingBufferHeight:540,
 createVertexArray(){},isContextLost:()=>lost,getContextAttributes:()=>attrs,getParameter(k){
  probes++;switch(k){case gl.SAMPLES:return samples;case gl.ALPHA_BITS:return alpha;case gl.DEPTH_BITS:return depth;}throw Error(k);
 }};
const attrs={alpha:true,antialias:true,depth:true,stencil:false};
let lost=false,probes=0,samples=4,alpha=8,depth=24,target=null,scissor=false,strip=[];
let pxRatio=1,width=840,height=540,viewLogical=[0,0,width,height],viewPhysical=[0,0,width,height];
const scene=new T.Scene(),camera=new T.PerspectiveCamera(53,840/540,.08,350000);
const renderer={getContext:()=>gl,getRenderTarget:()=>target,getScissorTest:()=>scissor,
 getSize:v=>v.set(width,height),getPixelRatio:()=>pxRatio,
 getViewport:v=>v.set(...viewLogical),getCurrentViewport:v=>v.set(...viewPhysical),
 xr:{isPresenting:false},shadowMap:{enabled:false},clippingPlanes:[],localClippingEnabled:false,autoClearColor:true,
 capabilities:{logarithmicDepthBuffer:true,reversedDepthBuffer:false,maxTextureSize:4096},sortObjects:true,autoClear:true,autoClearDepth:true,
 info:{render:{frame:200}},renderLists:{get(s,d){A.equal(s,scene);A.equal(d,0);return {opaque:strip};}}};
const world=new World(scene,terrain,new T.Texture(),renderer,cover,new T.Texture());world.details.load=async()=>undefined;
const point=project(-62.53736049,45.99272727272727);
const actualEye=[50892.74685260925,71.63787892260825,56330.87672181807];
const place=(x,y,z)=>{camera.position.set(x,y,z);camera.lookAt(point.x,18,point.z);camera.updateMatrixWorld();};
place(...actualEye);
let clock=1;
const update=(x,z)=>world.update(new T.Vector3(x,120,z),clock+=1),away=()=>update(500000,500000),near=()=>update(point.x,point.z);
const tile=(id)=>world.byId.get(id);
let grade;
const config={scene,renderer,terrain,cover,terrainSha:ts.sha256,tile,grade:id=>id===grade};
const host=prepareSouth21Rim(config);
A(host);
const [a,b]=[SOUTH21.actor,SOUTH21.donor].map(tile),mat=a.local,donor=b.local;
const beforeProto=T.Object3D.prototype.onBeforeRender,afterProto=T.Object3D.prototype.onAfterRender;
const [frag,defs,dict,id]=[mat.fragmentShader,mat.defines,mat.uniforms,mat.id];
const G=SOUTH21.gain;
const mode=(name)=>A.deepEqual(host.diagnostics(),{source:'verified',drawnFine:name===true?[SOUTH21.actor]:[]});
const neutral=()=>{A.equal(mat.vertexShader,STOCK_TERRAIN_VERTEX);A.equal(donor.vertexShader,STOCK_TERRAIN_VERTEX);
 A.equal(mat.uniforms,dict);A.equal(mat.fragmentShader,frag);A.equal(mat.defines,defs);A.equal(mat.id,id);A(!Object.hasOwn(dict,G));};
const matOf=q=>({object:q, geometry:q.geometry, material:q.material,group:null});
const next=(list=[matOf(a.fine),matOf(b.fine)])=>{strip=list;renderer.info.render.frame++;};
const before=(cam=camera,m=mat,geo=a.fine.geometry,group=null,r=renderer,s=scene)=>a.fine.onBeforeRender(r,s,cam,geo,m,group);
const after=()=>a.fine.onAfterRender(renderer,scene,camera,a.fine.geometry,mat,null);
const active=()=>{A.equal(dict[G]?.value,1);A.equal(mat.vertexShader,SOUTH21_VERTEX);A.equal(donor.vertexShader,STOCK_TERRAIN_VERTEX);};
const view=()=>[a,b].flatMap(t=>['position','uv','normal','index'].map(k=>{
 const q=k==='index'?t.fine.geometry.index:t.fine.geometry.getAttribute(k);
 return [t.fine,t.fine.geometry,q,q.array,q.version,sha(q.array)];
 }));
const contact=()=>[-37,-8,0,8,37].flatMap(x=>[-3,-.1,0,.1,3].flatMap(z=>[
 world.groundHeight(point.x+x,point.z+z),world.visualGroundHeight(point.x+x,point.z+z),world.surface(point.x+x,point.z+z)]));
const stock=()=>{A.equal(a.fine.onBeforeRender,beforeProto);A.equal(a.fine.onAfterRender,afterProto);neutral();};
const acquire=()=>{const done=host.begin(camera);A(done);neutral();A.equal(host.begin(camera),undefined);return done;};
away();A.equal(host.begin(camera),undefined);A.equal(probes,0);near();
// Legitimately stale existing N112 owners do not open a callback at a
// distant camera or partial viewport, even with their identity unchanged.
place(...[actualEye[0]+1100,...actualEye.slice(1)]);A.equal(host.begin(camera),undefined);A.equal(probes,0);
place(...actualEye);viewLogical=[0,0,839,540];A.equal(host.begin(camera),undefined);A.equal(probes,0);
viewLogical=[0,0,840,540];
A.equal(host.begin(camera),undefined);A.equal(host.diagnostics().source,'checking');
A.equal(await verifyDecodedCover(cover),CANOPY_FENCE.pins.coverDecoded);await Promise.resolve();mode(false);
const snapshots=view(),contacts=contact();const startVersion=mat.version;A.equal(probes,3);
let end=acquire();const stale=end;
// Exact frame fence: current list only at next renderer frame, not before.
strip=[matOf(a.fine),matOf(b.fine)];before();neutral();
next();a.coarse.onBeforeRender(renderer,scene,camera,a.coarse.geometry,mat,null);neutral();
b.fine.onBeforeRender(renderer,scene,camera,b.fine.geometry,donor,null);neutral();
before();active();A.equal(mat.version,startVersion+1);mode(false);
const slot=dict[G];after();A.equal(slot.value,0);neutral();mode(true);A.equal(mat.version,startVersion+2);
before();neutral();end();stock();mode(true);
end=acquire();next();stale();before();active();
try{throw Error('test renderer exception before after callback');}catch{}finally{end();}
stock();mode(false);end();A.equal(probes,3);
A.deepEqual(view(),snapshots);A.deepEqual(contact(),contacts);
for(const deny of ['no donor','duplicate donor','no owner','foreign donor material','foreign geometry','group','wrong camera','wrong renderer','wrong scene','layer','scissor','target','override','grade','donor raster','foreign scalar','foreign define','version drift geometry','dispose','late render list','far camera','nan matrix','physical viewport','autoClearColor','morph','foreign uniform wrapper','wrong buffer upload']){
 end=acquire();
 let restore=()=>{};let list=[matOf(a.fine),matOf(b.fine)],run=before;
 switch(deny){
  case 'no donor':list=list.slice(0,1);break;
  case 'duplicate donor':list.push(list[1]);break;
  case 'no owner':list=list.slice(1);break;
  case 'foreign donor material':list[1]={...list[1],material:mat};break;
  case 'foreign geometry':list[0]={...list[0],geometry:b.fine.geometry};break;
  case 'group':list[0]={...list[0],group:{}};break;
  case 'wrong camera':run=()=>before(camera.clone());break;
  case 'wrong renderer':run=()=>before(camera,mat,a.fine.geometry,null,{...renderer});break;
  case 'wrong scene':run=()=>before(camera,mat,a.fine.geometry,null,renderer,new T.Scene());break;
  case 'layer':b.fine.layers.mask=2;restore=()=>{b.fine.layers.mask=1;};break;
  case 'scissor':scissor=true;restore=()=>{scissor=false;};break;
  case 'target':target={};restore=()=>{target=null;};break;
  case 'override':scene.overrideMaterial=mat;restore=()=>{scene.overrideMaterial=null;};break;
  case 'grade':grade=b.id;restore=()=>{grade=undefined;};break;
  case 'donor raster':donor.polygonOffset=true;restore=()=>{donor.polygonOffset=false;};break;
  case 'foreign scalar':dict[G]={value:1};restore=()=>{A.equal(dict[G].value,1);delete dict[G];};break;
  case 'foreign define':mat.defines.bad=1;restore=()=>{delete mat.defines.bad;};break;
  case 'version drift geometry':a.fine.geometry.attributes.position.needsUpdate=true;break;
  case 'dispose':b.fine.geometry.dispose();break;
  case 'late render list':renderer.info.render.frame++;break;
  case 'far camera':place(actualEye[0],actualEye[1],actualEye[2]-1200);restore=()=>place(...actualEye);break;
  case 'nan matrix':camera.projectionMatrix.elements[8]=NaN;restore=()=>camera.updateProjectionMatrix();break;
  case 'physical viewport':viewPhysical=[0,0,840,499];restore=()=>{viewPhysical=[0,0,840,540];};break;
  case 'autoClearColor':renderer.autoClearColor=false;restore=()=>{renderer.autoClearColor=true;};break;
  case 'morph':a.fine.geometry.morphAttributes.position=[];restore=()=>{delete a.fine.geometry.morphAttributes.position;};break;
  case 'foreign uniform wrapper':{const old=donor.uniforms.coverMap;donor.uniforms.coverMap={value:old.value};restore=()=>{donor.uniforms.coverMap=old;};break;}
  case 'wrong buffer upload':{const p=a.fine.geometry.attributes.position,tmp=p.onUploadCallback;p.onUpload(()=>{});restore=()=>{p.onUpload(tmp);};break;}
 }
 next(list);run();A.equal(mat.vertexShader,STOCK_TERRAIN_VERTEX,deny);restore();neutral();mode(false);end();stock();
}
// Actual source-bearing EBO and Float32 rows from world ownership, not a synthetic plane.
const attrsCPU=()=>[a,b].map(t=>{
 const mesh=t.fine,g=mesh.geometry,side=t===a?0:112,offset=side*113,k=offset+36;
 const p=g.attributes.position,v=g.attributes.uv;
 return {id:t.id,lod:t.lod,seams:t.seams,positions:p.count,index:g.index.count,wholeIndexSha:sha(g.index.array),
  localPosSHA:sha(p.array.slice(k*3,(k+6)*3)),localUVSHA:sha(v.array.slice(k*2,(k+6)*2)),
  starIndexSha:sha(g.index.array.slice(((t===a?0:111)*112+36)*6,((t===a?0:111)*112+41)*6)),
  rimWorld:Array.from({length:113},(_,k)=>[Math.fround(Math.fround(mesh.position.x)+p.getX(k+offset)),p.getY(k+offset),
   Math.fround(Math.fround(mesh.position.z)+p.getZ(k+offset))])};
});
const [x,y]=attrsCPU();
A.equal(x.wholeIndexSha,'33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa');
A.equal(x.wholeIndexSha,y.wholeIndexSha);
A.equal(x.localPosSHA,'033e880a6bca6c89e79ae5acc27b0c6689938f77a622255abe4ecfa50caaab79');
A.equal(y.localPosSHA,'8d05720b43489f0bd08e4cf4c7b5bd9536c102769d937e91664b1032e8a77815');
A.equal(x.localUVSHA,'d0956ee283111067ffbd718fb063479410ce839164d7e4cecdb50dc7d195d687');
A.equal(x.localUVSHA,y.localUVSHA);
A.equal(x.starIndexSha,'01a8426b282c48d2213a6b5390af11b9af14d52e792730acb0305657d17927de');
A.equal(y.starIndexSha,'17995307eec35f87850b4b6854bb663637d50654272a43105f9281183529dab0');
for(let k=0;k<113;k++){
 A.deepEqual(x.rimWorld[k].slice(0,2),y.rimWorld[k].slice(0,2));
 A.equal(x.rimWorld[k][2],SOUTH21.fromZ);A.equal(y.rimWorld[k][2],SOUTH21.toZ);
 A.equal(south21ClipWorldZ(SOUTH21.localZ,k,x.rimWorld[k][2],1),
         k>=37&&k<=40?y.rimWorld[k][2]:x.rimWorld[k][2]);
}
if(process.argv[2]){
 const q=JSON.parse(readFileSync(process.argv[2])).south21;
 A.deepEqual([y.rimWorld,x.rimWorld],q.rimVertices);
}
const sameCaps=()=>{renderer.capabilities={...renderer.capabilities};};
for(const test of ['actual 0x','actual 2x','RGB only','nonstock depth','MSAA contradiction','stencil','context loss']){
 sameCaps();
 switch(test){
  case 'actual 0x':samples=0;attrs.antialias=false;break;
  case 'actual 2x':samples=2;break;
  case 'RGB only':alpha=0;break;
  case 'nonstock depth':depth=16;break;
  case 'MSAA contradiction':attrs.antialias=false;break;
  case 'stencil':attrs.stencil=true;break;
  case 'context loss':lost=true;break;
 }
 A.equal(host.begin(camera),undefined,test);stock();
 samples=4;alpha=8;depth=24;attrs.antialias=true;attrs.stencil=false;lost=false;
}
sameCaps();end=acquire();next();before();active();after();end();stock();mode(true);
// r187 ordinary whole default viewport can round one pixel past physical
// buffer width at fractional DPR. A shortened/cropped physical port can't.
width=855;pxRatio=1.25;gl.drawingBufferWidth=1068;gl.drawingBufferHeight=675;
viewLogical=[0,0,855,540];viewPhysical=[0,0,1069,675];
end=acquire();next();before();active();after();end();stock();mode(true);
viewPhysical=[0,0,1067,675];A.equal(host.begin(camera),undefined);stock();
width=840;pxRatio=1;gl.drawingBufferWidth=840;gl.drawingBufferHeight=540;
viewLogical=[0,0,840,540];viewPhysical=[0,0,840,540];
end=acquire();next();sameCaps();before();neutral();end();stock();mode(false);
const oldFine=a.fine;away();A.equal(host.begin(camera),undefined);neutral();near();A.notEqual(a.fine,oldFine);
end=acquire();next();before();active();after();end();stock();mode(true);
const mixed=[];
for(const [offset,expect] of [[-7500,'112:56'],[7500,'56:112'],[-12200,'56:8'],[12200,'8:56']]){
 away();update(point.x,a.z0+offset);const observed=`${b.lod}:${a.lod}`;
 A.equal(observed,expect);mixed.push(observed);
 A.equal(host.begin(camera),undefined);neutral();mode(false);
}
near();
const badBytes=cover.bytes.slice();badBytes[1]^=1;
const changed=new Cover(cm.width,cm.height,badBytes,undefined,cm.compressedSha256);
const wrongCover=prepareSouth21Rim({...config,cover:changed}),wrongTerrain=prepareSouth21Rim({...config,terrainSha:'wrong-sha'});
A.equal(wrongTerrain,undefined);A(wrongCover);
A.equal(wrongCover.begin(camera),undefined);A.notEqual(await verifyDecodedCover(changed),CANOPY_FENCE.pins.coverDecoded);
await Promise.resolve();A.equal(wrongCover.diagnostics().source,'stock');
A.equal(wrongCover.begin(camera),undefined);neutral();
// These are original objects and real host callbacks, not VM mocks. Leave
// any foreign callbacks untouched and do not have a stale lease paint.
let foreignCalls=0;
const foreign=()=>{foreignCalls++;};
for(const mesh of [a.fine,b.fine]){
 mesh.onBeforeRender=foreign;
 A.equal(host.begin(camera),undefined);A.equal(mesh.onBeforeRender,foreign);neutral();
 mesh.onBeforeRender=beforeProto;
}
end=acquire();next();
const savedBefore=a.fine.onBeforeRender;
a.fine.onBeforeRender=foreign;
savedBefore(renderer,scene,camera,a.fine.geometry,mat,null);
neutral();mode(false);end();A.equal(a.fine.onBeforeRender,foreign);A.equal(a.fine.onAfterRender,afterProto);
a.fine.onBeforeRender=beforeProto;
end=acquire();next();before();active();
const ownedScalar=dict[G];a.fine.onAfterRender=foreign;
end();neutral();A.equal(ownedScalar.value,0);mode(false);A.equal(a.fine.onAfterRender,foreign);
A.equal(a.fine.onBeforeRender,beforeProto);A.equal(host.begin(camera),undefined);
a.fine.onAfterRender=afterProto;stock();A.equal(foreignCalls,0);
end=acquire();next();before();active();after();end();stock();mode(true);
mat.needsUpdate=true;A.equal(host.begin(camera),undefined);neutral();
console.log(JSON.stringify({scope:'authentic offline q24-20/q24-21 current base, paired r187 callback fixture, no graphics',
 atlas:ts.sha256,cover:CANOPY_FENCE.pins.coverDecoded,actor:Object.fromEntries(Object.entries(x).filter(([k])=>k!=='rimWorld')),
 donor:Object.fromEntries(Object.entries(y).filter(([k])=>k!=='rimWorld')),localDry:south21DryTaps(terrain,cover),
 moves:[37,38,39,40],wz:[SOUTH21.fromZ,SOUTH21.toZ],
 mixed,unchangedAttributes:8,unchangedContactValues:contacts.length,renderRefusalCases:27,unsupportedRaster:7,fullViewport:true,staleOutsideRadiusRefused:true,
 nativeRimRowsCompared:process.argv[2]?226:0,exactRestore:true,reentry:true,noForeignProgramWrites:true,foreignBeforeAndAfterPreserved:true},null,2));
