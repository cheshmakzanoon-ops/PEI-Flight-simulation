import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {bordenCoastRequested,capeTryonRockRequested,foundersWestRequested,forestFloorProfile,
 standardCavendishWaterRequested,coastalMarshRequested,standardCountyOrtho,standardInlandOrtho,
 standardRusticoNeighbourRequested,standardTracadieOrtho} from '../src/app/scenery-profile.ts';
import {Cover} from '../src/sim/cover.ts';
import {HarbourCover} from '../src/sim/harbour-cover.ts';
import {QUARTERMASTER} from '../src/sim/quartermaster.generated.ts';
import {coastSegments} from '../src/sim/shoreline.ts';
import {Terrain,OCEAN_Y,type TerrainSpec} from '../src/sim/terrain.ts';
import {labAerialFragment} from '../src/render/aerial-perspective-lab.ts';
import {prepareQuartermasterQuay} from '../src/render/quartermaster-quay/lease.ts';
import {QUAY_SOURCE,quartermasterQuayRequested,quartermasterQuayShaders,selectQuayPositions} from '../src/render/quartermaster-quay/finish.ts';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url));
const hash=(b:NodeJS.ArrayBufferView|string)=>createHash('sha256').update(b).digest('hex');
const world=read('../src/render/world.ts').toString();
const excerpt=(from:string,to:string)=>{
 const i=world.indexOf(from),j=world.indexOf(to,i+from.length);
 assert.ok(i>=0&&j>i);return world.slice(i,j);
};
// Extract the authored stock literals from the exact runtime, not copied GLSL.
const oldV=Function(excerpt('const vertex=','const fp=')+'return vertex;')() as string;
const oldF=labAerialFragment(Function(
 excerpt('const fp=','const skyFn=')+excerpt('const cliffFrag=','const landFrag=').replace('(east:boolean,','(east,')+'return cliffFrag(false);')() as string)!.fragment;
const spec=JSON.parse(read('../public/world/terrain.json').toString()) as TerrainSpec;
const raw=gunzipSync(read('../public/world/height.bin.gz'));
const terrain=new Terrain(spec,new Int16Array(raw.buffer,raw.byteOffset,raw.length/2));
const harbour=new HarbourCover(gunzipSync(read('../public/world/'+QUARTERMASTER.asset)));
const cover=new Cover(4096,2720,gunzipSync(read('../public/world/cover.bin.gz')),harbour,QUARTERMASTER.pinCoverSha256);
const vertices:number[]=[];
for(const {ax,az,bx,bz} of coastSegments(cover,terrain)){
 if(Math.floor(ax/12000)!==0||Math.floor(az/12000)!==2)continue;
 const a=terrain.meshElevation(ax,az)+.72,b=terrain.meshElevation(bx,bz)+.72,lo=Math.min(-.14,a-.82,b-.82),
   hi=Math.max(OCEAN_Y+.03,a),hj=Math.max(OCEAN_Y+.03,b);
 vertices.push(ax,lo,az,bx,lo,bz,ax,hi,az,ax,hi,az,bx,lo,bz,bx,hj,bz);
}
const generated=new Float32Array(vertices),native=generated.slice(),uv256=new Float32Array(QUAY_SOURCE.count*2);
const differences=[3834,3840,3843,34401,34410,34413,34686,34692,34695];
// Node and Chrome use different trig association for nine old near-zero
// Xs far outside admission: 7.106e-15 m, exact B bytes unaffected.
// Synthetic lease fixture models the independently captured native browser
// bytes verbatim at those nine slots, not a runtime tolerance or fallback.
for(const i of differences){
 assert.ok([2.76756395578559e-10,2.767635010059166e-10].includes(native[i]));
 native[i]=2.767635010059166e-10;
}
const attrHash=(a:Float32Array)=>hash(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));

test('private option has only an explicit Standard Harbour Low request',()=>{
 const wants=(q:string)=>quartermasterQuayRequested(new URLSearchParams(q));
 assert.equal(wants('quartermasterQuayStudy'),true);
 assert.equal(wants('quartermasterQuayStudy&diagnostics&departure=harbour-low'),true);
 for(const q of ['','departure=harbour-low','quartermasterQuayStudy=true','quartermasterQuayStudy&quartermasterQuayStudy',
   'quartermasterQuayStudy&scenery=detail','quartermasterQuayStudy&buildingShadows','quartermasterQuayStudy&departure=charlottetown',
   'quartermasterQuayStudy&legacyShoreArcs','quartermasterQuayStudy&noAerialPerspective','quartermasterQuayStudy&diagnostics&diagnostics'])
  assert.equal(wants(q),false,q);
});

test('private request does not disable or enable any preceding ordinary scenery gate',()=>{
 const prior=[bordenCoastRequested,capeTryonRockRequested,foundersWestRequested,forestFloorProfile,
  standardCavendishWaterRequested,coastalMarshRequested,standardCountyOrtho,standardInlandOrtho,
  standardRusticoNeighbourRequested,standardTracadieOrtho];
 for(const raw of ['', 'departure=harbour-low&diagnostics','scenery=detail','scenery=standard',
  'departure=cysu','buildingShadows','stockFoundersWestWall&stockInlandOrtho','unknownOwnSwitch',
  'departure=harbour-low&diagnostics&legacyShoreArcs']){
  const stock=new URLSearchParams(raw);
  for(const appended of ['quartermasterQuayStudy','quartermasterQuayStudy=invalid',
    'quartermasterQuayStudy&quartermasterQuayStudy=invalid']){
   const q=new URLSearchParams([raw,appended].filter(Boolean).join('&'));
   assert.deepEqual(prior.map(g=>g(q)),prior.map(g=>g(stock)),[raw,appended].join(' '));
  }
 }
});

test('selected role bytes are exact for the same native B faces, not west/rock/terrace or loose width',()=>{
 assert.equal(attrHash(native),QUAY_SOURCE.position);
 assert.equal(attrHash(uv256),QUAY_SOURCE.uv);
 const selected=selectQuayPositions(native),other=selectQuayPositions(generated);
 assert.ok(selected&&other);assert.equal(selected.byteLength,2952);
 assert.deepEqual(selected,other);assert.equal(attrHash(selected),QUAY_SOURCE.selected);
 for(const i of [12528,12660,12930]){
  const shifted=native.slice();shifted[i*3+9]+=.08;
  assert.equal(selectQuayPositions(shifted),undefined);
 }
 const moved=native.slice();moved.set(native.subarray(13608*3,13614*3),12660*3);
 assert.equal(selectQuayPositions(moved),undefined);
 assert.equal(selectQuayPositions(native.slice(0,-18)),undefined);
});

test('patch has only three explicit role subcohorts; ordinary colour transform/depth/alpha preserved',()=>{
 assert.equal(hash(oldV),QUAY_SOURCE.vertex);assert.equal(hash(oldF),QUAY_SOURCE.fragment);
 const q=quartermasterQuayShaders(oldV,oldF);assert.ok(q);
 assert.equal(q.vertexShader.match(/gl_Position=[^;]+;/)?.[0],oldV.match(/gl_Position=[^;]+;/)?.[0]);
 assert.equal(q.fragmentShader.match(/gl_FragColor=[^;]+;/)?.[0],oldF.match(/gl_FragColor=[^;]+;/)?.[0]);
 assert.equal(q.fragmentShader.match(/#include <logdepthbuf_fragment>/g)?.length,1);
 assert.ok(!q.vertexShader.includes('i>=13608')&&!q.vertexShader.includes('i>=14976'));
 assert.ok(q.vertexShader.includes('i>=12660&&i<12804')&&q.vertexShader.includes('i>=12528&&i<12594'));
 assert.ok(q.fragmentShader.includes('(p.y-.10)*gl_FragCoord.w')&&q.fragmentShader.includes('qmqLow>0.'));
 assert.ok(q.fragmentShader.includes('min(old,col)')&&!q.fragmentShader.includes('discard')&&!q.fragmentShader.includes('gl_FragDepth'));
 assert.equal(quartermasterQuayShaders(q.vertexShader,oldF),undefined);
 assert.equal(quartermasterQuayShaders(oldV,oldF.replace('void main(){','void main() {')),undefined);
 assert.equal(quartermasterQuayShaders(oldV,oldF+'\n#include <colorspace_fragment>'),undefined);
});

function fixture(){
 const a={value:1},texture=new T.Texture();
 const stock=new T.ShaderMaterial({vertexShader:oldV,fragmentShader:oldF,side:T.DoubleSide,
  uniforms:{atmosphericLabGain:a,skyMap:{value:texture},clock:{value:0}}});
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(native.slice(),3));
 geometry.setAttribute('uv',new T.BufferAttribute(uv256.slice(),2));
 geometry.computeBoundingSphere();
 const scene=new T.Scene(),shore=new T.Mesh(geometry,stock),land=new T.Mesh(),camera=new T.PerspectiveCamera();
 scene.add(shore,land);scene.updateMatrixWorld();
 const controls={samples:4,lost:false,scissor:false,linked:true,compile:0,width:1200,target:null as unknown};
 const gl={SAMPLES:1,DEPTH_BITS:2,DEPTH_CLEAR_VALUE:3,DRAW_FRAMEBUFFER_BINDING:4,STENCIL_TEST:5,SCISSOR_TEST:6,
  getContextAttributes:()=>({alpha:true,depth:true,antialias:true,stencil:false,premultipliedAlpha:true}),
  isContextLost:()=>controls.lost,isEnabled:(p:number)=>p===6&&controls.scissor,
  getParameter:(p:number)=>p===1?controls.samples:p===2?24:p===3?1:null};
 const renderer={
  getContext:()=>gl,
  getRenderTarget:()=>controls.target, xr:{isPresenting:false}, shadowMap:{enabled:false}, sortObjects:true,
  getScissorTest:()=>controls.scissor, clippingPlanes:[],localClippingEnabled:false,autoClear:true,autoClearColor:true,autoClearDepth:true,
  capabilities:{logarithmicDepthBuffer:true,reversedDepthBuffer:false,precision:'highp'},
  outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1,
  getDrawingBufferSize:(out:T.Vector2)=>out.set(1200,760),
  getCurrentViewport:(out:T.Vector4)=>out.set(0,0,controls.width,760),info:{render:{frame:100}}
 } as unknown as T.WebGLRenderer;
 const ac=new AbortController();
 const receive=()=>({shore,land,air:a});
 let compiled:T.ShaderMaterial|undefined;
 const prepare=()=>prepareQuartermasterQuay({renderer,camera,scene,cover,receive,link:async(g,signal)=>{
  controls.compile++;
  assert.ok(!g.parent&&!signal.aborted&&g.children.length===1);
  const m=g.children[0] as T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
  assert.equal(m.geometry,geometry);assert.equal(m.material.uniforms.skyMap,stock.uniforms.skyMap);
  assert.equal(m.material.uniforms.qmqGain.value,0);
  compiled=m.material;return ()=>controls.linked;
 }},ac.signal);
 return {prepare,compiled:()=>compiled,ac,controls,renderer,camera,scene,stock,shore,land,geometry,a,texture};
}
test('borrowed buffers/uniforms, actual-intent upload, and exception-safe exact restore',async()=>{
 const f=fixture(),sceneTex=f.texture.source.version,version=f.stock.version;
 const q=await f.prepare();assert.ok(q&&q.ready());
 const m=f.compiled()!, before=f.shore.onBeforeRender,after=f.shore.onAfterRender;
 let cleaned=false;
 m.addEventListener('dispose',()=>cleaned=true);
 const finish=q.begin();assert.ok(finish);assert.equal(m.uniforms.qmqGain.value,0);
 assert.equal(f.shore.material,m);assert.equal(f.shore.geometry,f.geometry);
 f.renderer.info.render.frame++;
 const args=[f.renderer,f.scene,f.camera,f.geometry,m,null] as unknown as Parameters<T.Mesh['onBeforeRender']>;
 f.shore.onBeforeRender(...args);
 f.controls.linked=false;assert.equal(m.uniforms.qmqGain.value,0);
 f.controls.linked=true;assert.equal(m.uniforms.qmqGain.value,1);
 f.shore.onAfterRender(...args);assert.equal(q.draws,1);
 try{throw Error('fixture failure');}catch{/* normal caller can rethrow */}finally{finish();}
 assert.equal(f.shore.material,f.stock);assert.equal(f.shore.onBeforeRender,before);assert.equal(f.shore.onAfterRender,after);
 assert.equal(f.stock.version,version);assert.equal(f.texture.source.version,sceneTex);
 assert.equal(m.uniforms.qmqGain.value,0);assert.ok(q.ready());
 q.dispose();assert.ok(cleaned);assert.ok(!q.begin());
});

test('raster/source failures refuse before linking and late drift does not acquire again',async()=>{
 for(const mutate of [(f:ReturnType<typeof fixture>)=>{f.controls.samples=0;},f=>{f.controls.scissor=true;},
  f=>{f.a.value=0;},f=>{f.controls.width=1199;},f=>{f.stock.fragmentShader+='\n';},
  f=>{f.stock.polygonOffset=true;},f=>{f.geometry.setDrawRange(6,Infinity);},
  f=>{f.geometry.attributes.uv.array[0]=.1;},f=>{f.geometry.attributes.position.array[0]+=.1;}]){
  const f=fixture();mutate(f);
  assert.equal(await f.prepare(),undefined);assert.equal(f.controls.compile,0);assert.equal(f.shore.material,f.stock);
 }
 const f=fixture(),q=await f.prepare();assert.ok(q);
 const finish=q.begin();assert.ok(finish);
 f.renderer.info.render.frame++;
 const m=f.compiled()!;
 const args=[f.renderer,f.scene,f.camera,f.geometry,m,null] as unknown as Parameters<T.Mesh['onBeforeRender']>;
 f.shore.onBeforeRender(...args);f.controls.lost=true;f.ac.abort();assert.equal(m.uniforms.qmqGain.value,0);
 finish();assert.equal(f.shore.material,f.stock);assert.equal(q.draws,0);assert.equal(q.begin(),undefined);
 q.dispose();
});
