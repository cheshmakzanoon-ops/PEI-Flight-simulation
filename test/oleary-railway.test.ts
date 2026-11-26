import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as R} from 'node:fs';
import {gunzipSync as Z} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {verifyDecodedCover} from '../src/sim/cover-proof.ts';
import {CANOPY_FENCE} from '../src/render/canopy-fence.generated.ts';
import {WORLD_COLS,WORLD_ROWS,GROUND_LIFT} from '../src/sim/coastal-terrain.ts';
import {olearyExteriorRequested,dalvayExteriorRequested,dalvayWaterRequested,sourisKnightRequested} from '../src/app/scenery-profile.ts';
import {project} from '../src/sim/geo.ts';
import {OLEARY as A,olearyAtlasOwner,olearySiteAllows,olearyOriginalSource,olearyNativeGrade,olearyCloseCamera,olearyGradeCenter} from '../src/render/oleary-railway/authority.ts';
import {OLEARY_PACKET as P} from '../src/render/oleary-railway/packet.generated.ts';
import {OlearySocket} from '../src/render/oleary-railway/socket.ts';
import {decodeOleary,loadOleary} from '../src/render/oleary-railway/packet.ts';
import {makeOlearyExterior} from '../src/render/oleary-railway/exterior.ts';
import {olearyFinish,olearyFinishEnvelope} from '../src/render/oleary-railway/finish.ts';
import {OLEARY_NATIVE_GRADE} from '../src/render/oleary-railway/grade.generated.ts';
import {partitionOlearyNativeXYZ} from '../src/render/oleary-railway/grade-shape.ts';
import {olearyLinkPrograms,OLEARY_STATION_PROGRAM_MS,type OlearyProgramProof} from '../src/render/oleary-railway/program-gate.ts';

const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length) as ArrayBuffer,sha=(v:Buffer|ArrayBufferView)=>createHash('sha256').update(v as Buffer).digest('hex');
const dir='public/world/',j=(n:string)=>JSON.parse(R(dir+n,'utf8')),spec=j('terrain.json'),terrain=new Terrain(spec,new Int16Array(ab(Z(R(dir+spec.file))))),
 idx=j('buildings/index.json'),tile=idx.tiles.find((x:any)=>x.id===A.id),wire=R(dir+'buildings/'+idx.file).subarray(tile.offset,tile.offset+tile.bytes),
 source=JSON.parse(Z(wire).toString()).features,wireArt=R('public/art/'+P.file),raw=Z(wireArt),z=()=>decodeOleary(ab(raw))!;
const proved=async()=>()=>true;
const sleep=(m=5)=>new Promise(r=>setTimeout(r,m));
const ready=async(f:()=>boolean)=>{for(let i=0;i<180&&!f();i++)await sleep();assert(f());};
function context(){
 const s=new T.Scene(),b=new (Buildings as any)(s,terrain,[tile],{},idx.sha256),owner=b.generate(source,b.tiles[0],false,A.ordinal) as T.Mesh;
 s.add(owner);return {s,owner,raw:ab(wire),original:owner.geometry};
}
const cold='112:56,56,56,112',warm='112:112,56,56,112';
function grade(seams=cold){
 const w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS,x=terrain.left+w*3+w/2,z=terrain.top+d*7+d/2;
 const g=new T.PlaneGeometry(w,d,112,112);g.rotateX(-Math.PI/2);const p=g.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setY(i,terrain.atlasElevation(p.getX(i)+x,p.getZ(i)+z)+GROUND_LIFT);
 const mesh=new T.Mesh(g,new T.MeshBasicMaterial());mesh.position.set(x,0,z);
 nativeRim(mesh,seams);return mesh;
}
function nativeRim(mesh:T.Mesh,seams:string){
 const p=mesh.geometry.getAttribute('position'),n=112,lv=seams.slice(4).split(',').map(Number);
 const w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS,x0=terrain.left+w*3,z0=terrain.top+d*7;
 for(let side=0;side<4;side++){
  const ratio=n/lv[side];let a=0,b=0;
  const h=(t:number)=>terrain.atlasElevation(x0+w*(side%2===0?t:side===1?1:0),z0+d*(side%2===1?t:side===2?1:0))+.12;
  for(let k=0;k<=n;k++){
   if(k%ratio===0){a=h(k/n);b=h(Math.min(1,(k+ratio)/n));}
   const i=side===0?k:side===1?k*(n+1)+n:side===2?n*(n+1)+k:k*(n+1);
   p.setY(i,a+(b-a)*(k%ratio)/ratio);
  }
 }
 p.needsUpdate=true;
}
test('only explicit verified Standard close exterior can qualify; other review switches keep their own behavior',async()=>{
 for(const [query,ok]of[['',false],['stockOlearyExterior',false],['olearyExteriorStudy',true],['olearyExteriorStudy&diagnostics&scenery=standard',true],
  ['olearyExteriorStudy&stockOlearyExterior',false],['olearyExteriorStudy&scenery=detail',false],['olearyExteriorStudy&surveyRelief',false],
  ['olearyExteriorStudy&foreignGrade',false],['olearyExteriorStudy&scenery=standard&scenery=detail',false]]as const)assert.equal(olearyExteriorRequested(new URLSearchParams(query)),ok,query);
 const all=new URLSearchParams('olearyExteriorStudy&dalvayExteriorStudy&dalvayWaterOptics&sourisKnightExterior');
 assert(olearyExteriorRequested(all)&&dalvayExteriorRequested(all)&&dalvayWaterRequested(all)&&sourisKnightRequested(all));
 const [x,z]=A.xz;assert(olearyCloseCamera(x,A.groundOrigin+5,z));assert(!olearyCloseCamera(x+1851,A.groundOrigin+5,z));assert(!olearyCloseCamera(x,A.groundOrigin+386,z));assert(!olearyCloseCamera(x,NaN,z));
 const c=j('cover.json'),cw=R(dir+'cover.bin.gz'),cover=new Cover(c.width,c.height,new Uint8Array(ab(Z(cw))),undefined,sha(cw));
 assert.equal(await verifyDecodedCover(cover),CANOPY_FENCE.pins.coverDecoded);
 assert(olearySiteAllows(terrain,spec.sha256,cover));assert(!olearySiteAllows(terrain,'bad',cover));
});
test('pins full source and all six original draw attributes; unrelated q20213/192 cannot obtain the socket',async()=>{
 const q=context();assert(olearyAtlasOwner(idx.sha256,tile));assert(!olearyAtlasOwner(idx.sha256,{...tile,count:541}));assert(!olearyAtlasOwner('bad',tile));
 assert(await olearyOriginalSource(q.raw,542,source[431],q.owner));assert(!(await olearyOriginalSource(q.raw,542,source[192],q.owner)));
 const on=new Uint8Array(q.raw);on[15]^=1;assert(!await olearyOriginalSource(q.raw,542,source[431],q.owner));on[15]^=1;
 for(const a of Object.values(q.original.attributes)){
  const p=(a as T.BufferAttribute).array,v=p[2];p[2]=v+1;assert(!await olearyOriginalSource(q.raw,542,source[431],q.owner));p[2]=v;
 }
 assert(await olearyOriginalSource(q.raw,542,source[431],q.owner));
 assert.deepEqual(q.owner.userData.beaconTriangles,[26343,26385]);
});
test('reproduces every authored buffer bit; one authentic hip, closed raised deck and exact q431 projected negative space',()=>{
 assert.equal(sha(wireArt),P.packedSHA256);assert.equal(sha(raw),P.rawSHA256);
 const a=z(),b=makeOlearyExterior(terrain),features=b.group.userData.olearyProof.features as {role:string;parts:Record<string,[number,number]>}[];
 assert(a.intact());assert.deepEqual(a.group.position.toArray(),b.group.position.toArray());
 const ring=source[431].footprint.map((q:[number,number])=>project(...q));const o=a.group.position;
 for(const [i,m]of(a.group.children as T.Mesh[]).entries()){
  const n=(b.group.children[i] as T.Mesh).geometry,ix=m.geometry.index!;
  for(const [key,v]of Object.entries(m.geometry.attributes)){
   const attr=v as T.BufferAttribute,original=n.getAttribute(key),size=attr.itemSize;
   assert.equal(ix.count,original.count);
   const recreated=new Float32Array(ix.count*size);for(let j=0;j<ix.count;j++)for(let k=0;k<size;k++)recreated[j*size+k]=attr.array[ix.getX(j)*size+k];
   assert.deepEqual(recreated,original.array);assert.equal(sha(recreated),P.parts[i].expandedSourceSHA256[['position','normal','color','uv'].indexOf(key)]);
  }
  const v=m.geometry.getAttribute('position');
  for(let j=0;j<v.count;j++){
   const x=v.getX(j)+o.x,z=v.getZ(j)+o.z;
   assert(ring.every((q:any,n:number)=>{const b=ring[(n+1)%4],dx=b.x-q.x,dz=b.z-q.z;return (dx*(z-q.z)-dz*(x-q.x))/Math.hypot(dx,dz)>.13;}));
  }
 }
 assert.equal(P.parts.reduce((s,q)=>s+q.indices/3,0),6122);
 const roof=(b.group.children[3] as T.Mesh).geometry.getAttribute('normal');
 for(let i=0;i<roof.count;i++)assert(roof.getY(i)>.55);
 assert.equal(features.find(a=>a.role.startsWith('true shelter'))!.parts.roof[1],6);
 assert.equal(features.find(a=>a.role.startsWith('individual deep timber'))!.parts.timber[1],960);
 assert.equal(b.group.userData.olearyProof.supports.length,34);
 const part=a.group.children[0]as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;const m=part.material;m.opacity=.9;assert(!a.intact());m.opacity=1;assert(a.intact());
 m.roughness=.2;assert(!a.intact());m.roughness=.91;assert(a.intact());
 a.dispose();b.dispose();
});
test('absent, altered, oversize or canceled optional body never builds a material',async()=>{
 const sig=new AbortController(),damage=Buffer.from(wireArt);damage[600]^=1;
 assert.equal(await loadOleary('/a',sig.signal,async()=>new Response('',{status:404})),undefined);
 for(const b of[damage,Buffer.concat([wireArt,Buffer.from([0])]),Buffer.alloc(58)]){
  assert.equal(await loadOleary('/a',sig.signal,async()=>new Response(ab(b))),undefined);
 }
 const a=await loadOleary('/a',sig.signal,async()=>new Response(ab(wireArt)));assert(a?.intact());a.dispose();
 sig.abort();let calls=0;assert.equal(await loadOleary('/a',sig.signal,async()=>{calls++;return new Response(ab(wireArt));}),undefined);assert.equal(calls,0);
});
test('stock remains complete until authenticated native ground, cover and art; faults restore untouched old draw',async()=>{
 const q=context(),g=grade(),w=grade();let current:T.Mesh|undefined,opens=0;
 const seat={center:olearyGradeCenter(terrain),ground:()=>current?{fine:current,seams:cold}:undefined,verifiedCover:async()=>true,link:proved};
 const s=new OlearySocket(q.s,q.owner,q.raw,542,source[431],seat,async()=>{opens++;return z();});s.sync();await sleep(22);assert.equal(opens,0);
 w.geometry.getAttribute('position').setY(6,0);assert(!await olearyNativeGrade(w,seat.center,cold));current=w;s.sync();await sleep(22);assert.equal(opens,0);
 g.position.x+=.25;current=g;s.sync();await sleep(22);assert.equal(opens,0);
 assert(!await olearyNativeGrade(g,seat.center,cold));current=undefined;s.sync();g.position.x-=.25;
 current=g;s.sync();await ready(()=>s.active);assert.equal(opens,1);
 const g2=q.owner.geometry,index=g2.index!;
 assert.equal(index.count,32049-42);for(let i=0;i<index.count;i++)assert.equal(index.getX(i),i<26343?i:i+42);
 for(const k of Object.keys(g2.attributes))assert.equal(g2.getAttribute(k),q.original.getAttribute(k));
 const art=q.s.children.find(x=>x!==q.owner)! as T.Group,m=art.children[0]as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 m.material.opacity=.8;s.sync();assert(!s.active);assert.equal(q.owner.geometry,q.original);
 m.material.opacity=1;s.sync();assert(s.active);
 g.position.x+=.01;s.sync();assert(!s.active);assert.equal(q.owner.geometry,q.original);g.position.x-=.01;s.sync();assert(s.active);
 current=undefined;s.sync();assert(!s.active);current=g;s.sync();await ready(()=>s.active);assert.equal(opens,1);
 s.dispose();assert.equal(q.owner.geometry,q.original);assert.equal(q.s.children.length,1);
 const n=context();let resolve:((p:ReturnType<typeof z>)=>void)|undefined;
 const late=new OlearySocket(n.s,n.owner,n.raw,542,source[431],seat,async()=>await new Promise(r=>{resolve=r;}));
 late.sync();await ready(()=>!!resolve);late.dispose();resolve!(z());await sleep();assert.equal(n.s.children.length,1);assert.equal(n.owner.geometry,n.original);
 g.geometry.dispose();g.material.dispose();w.geometry.dispose();w.material.dispose();
});
test('significant sampled roof finish receives pitch/normal and roughness, then fades smoothly without a new sampler',()=>{
 const m=olearyFinish('roof'),shader={fragmentShader:T.ShaderLib.standard.fragmentShader,vertexShader:T.ShaderLib.standard.vertexShader,uniforms:{}};
 m.onBeforeCompile(shader,{} as T.WebGLRenderer);
 assert(shader.fragmentShader.includes('normal=olSafeNormal')&&shader.fragmentShader.includes('roughnessFactor+olF.z')&&shader.fragmentShader.includes('float lip=')&&shader.fragmentShader.includes('float seam='));
 assert(shader.vertexShader.includes('olLocal=position'));assert.deepEqual(shader.uniforms,{});
 const sample=[8,30,46,61,90,120,147,185].map(d=>olearyFinishEnvelope(.055,d));
 assert(sample[0]>.80&&sample[0]===sample[1]&&sample[2]>sample[3]&&sample[3]>sample[4]&&sample[5]>sample[6]&&sample[6]===0);
 assert(olearyFinishEnvelope(.18,8)===0&&olearyFinishEnvelope(Infinity,8)===0);m.dispose();
});

test('interrupted local intent aborts pending art and can recover on the same intact cached owner; real absence latches',async()=>{
 const a=context(),g=grade();let ground:T.Mesh|undefined=g;
 const seat={center:olearyGradeCenter(terrain),ground:()=>ground?{fine:ground,seams:cold}:undefined,verifiedCover:async()=>true,link:proved};
 const requests:{signal:AbortSignal;finish:(a:ReturnType<typeof z>|undefined)=>void}[]=[];
 const lease=new OlearySocket(a.s,a.owner,a.raw,542,source[431],seat,signal=>new Promise(done=>requests.push({signal,finish:done})));
 lease.sync();await ready(()=>requests.length===1);
 ground=undefined;lease.sync();assert(requests[0].signal.aborted&&!lease.active&&a.owner.geometry===a.original);
 ground=g;lease.sync();assert.equal(requests.length,1);
 const tardy=z();requests[0].finish(tardy);await ready(()=>requests.length===2);assert(!tardy.intact());
 requests[1].finish(z());await ready(()=>lease.active);lease.dispose();assert.equal(a.owner.geometry,a.original);
 const absent=context();let tried=0;
 const lost=new OlearySocket(absent.s,absent.owner,absent.raw,542,source[431],seat,async()=>{tried++;return undefined;});
 lost.sync();await ready(()=>tried===1);await sleep();
 ground=undefined;lost.sync();ground=g;lost.sync();await sleep(30);assert.equal(tried,1);assert(!lost.active);lost.dispose();g.geometry.dispose();g.material.dispose();
});


test('World stock N112 retains every signed native position and recovers exact seam revisions without another packet',async()=>{
 const {s,owner,original,raw}=context(),g=grade(),p=g.geometry.getAttribute('position'),i=g.geometry.index!,target=olearyGradeCenter(terrain);
 let seams=cold,opens=0;
 const seat={center:target,ground:()=>({fine:g,seams}),verifiedCover:async()=>true,link:proved};
 const cells=partitionOlearyNativeXYZ(p.array as Float32Array)!;
 assert.equal(cells.inner.length+cells.rim.reduce((x,y)=>x+y.length,0),12769*3);
 assert.equal(sha(cells.inner),OLEARY_NATIVE_GRADE.interiorXYZSHA256);
 const readyCold=await olearyNativeGrade(g,target,cold);
 assert(readyCold?.());assert(!await olearyNativeGrade(g,target,warm));assert(!await olearyNativeGrade(g,target,'112:48,56,56,112'));
 const lease=new OlearySocket(s,owner,raw,542,source[431],seat,async()=>{opens++;return z();});
 lease.sync();await ready(()=>lease.active);assert.equal(opens,1);
 seams=warm;nativeRim(g,warm);lease.sync();assert(!readyCold?.()&&!lease.active&&owner.geometry===original);
 assert.equal(sha(partitionOlearyNativeXYZ(p.array as Float32Array)!.inner),OLEARY_NATIVE_GRADE.interiorXYZSHA256);
 await ready(()=>lease.active);
 const y=p.getY(5545);p.setY(5545,y+.01);p.needsUpdate=true;lease.sync();
 assert(!lease.active&&owner.geometry===original);await sleep(15);assert(!lease.active);
 p.setY(5545,y);p.needsUpdate=true;lease.sync();await ready(()=>lease.active);
 const first=i.getX(0);i.setX(0,first+1);i.needsUpdate=true;lease.sync();
 assert(!lease.active&&owner.geometry===original);await sleep(15);assert(!lease.active);
 i.setX(0,first);i.needsUpdate=true;lease.sync();await ready(()=>lease.active);
 const edge=p.getY(112*113+7);p.setY(112*113+7,edge+.005);p.needsUpdate=true;lease.sync();
 assert(!lease.active&&owner.geometry===original);await sleep(15);assert(!lease.active);
 p.setY(112*113+7,edge);p.needsUpdate=true;lease.sync();await ready(()=>lease.active);assert.equal(opens,1);
 lease.dispose();assert.equal(owner.geometry,original);g.geometry.dispose();g.material.dispose();
});

test('only two complete stock UV byte outputs are sealed, independent of the identical q431 UVs',async()=>{
 const q=context(),v=q.original.getAttribute('uv').array as Float32Array,bits=new Uint32Array(v.buffer,v.byteOffset,v.length);
 const sourceStamp=[
  [0x2a410000,0xac26a000,[63501,63513,63523,63529,63815,63819,63821,63825,63835,63837,63841,63847,63853]],
  [0xabb7d4e0,0xaa944500,[63515,63519,63533,63557,63581,63585]],
  [0xab97a000,0xa91a0000,[63547,63553,63561,63579,63647,63651,63653,63657,63667,63669,63673,63679,63685]],
  [0xab8fd000,0x28bc0000,[63683,63687,63713]],
  [0x381cc0ca,0x381cc0c9,[63827,63831,63857]],
  [0xab714000,0x2a510000,[63851,63855,63881]],
 ] as const;
 assert.equal(sourceStamp.reduce((n,e)=>n+e[2].length,0),41);
 for(const [node,chrome,ids]of sourceStamp)for(const i of ids){
  assert(i%2===1&&(i<26343*2||i>=26385*2));assert.equal(bits[i],node);bits[i]=chrome;
 }
 assert.equal(sha(bits),'5472a9b595817aa9cf0663af5910f64f1a53860e5e49403684cfab6a9bd223e6');
 assert(await olearyOriginalSource(q.raw,542,source[431],q.owner));
 const i=sourceStamp[0][2][0];bits[i]^=1;
 assert(!await olearyOriginalSource(q.raw,542,source[431],q.owner));
 bits[i]^=1;bits[26343*2+1]^=1;
 assert(!await olearyOriginalSource(q.raw,542,source[431],q.owner));
 q.original.dispose();
});


test('r187 preflights all actual detached programs with the target camera/lights, and denies stale or unavailable links',async()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),gloss=new T.DirectionalLight(),model=z();
 scene.add(gloss);let everyLinked=true,complete=true,caseCompile=0,lost=false;
 const failed=new Set<object>(),hold=new Map<object,{program:object;isReady:()=>boolean}>();
 const gl={LINK_STATUS:0x8B82,isContextLost:()=>lost,isProgram:(p:object)=>!!p,
  getProgramParameter:(program:object,which:number)=>{assert.equal(which,0x8B82);return everyLinked&&!failed.has(program);}};
 let rt:null|object=null;
 const fake={compile(g:T.Group,c:T.Camera,target:T.Scene){
  assert.equal(g,model.group);assert.equal(c,camera);assert.equal(target,scene);assert(!g.parent);
  assert(target.children.includes(gloss));caseCompile++;
  const m=g.children.map((q:any)=>q.material);for(const p of m)hold.set(p,{program:{},isReady:()=>complete});
  if(!everyLinked)failed.add(hold.get(m[3])!.program);
  return new Set(m);
 },properties:{get:(m:object)=>({currentProgram:hold.get(m)})},getContext:()=>gl,getRenderTarget:()=>rt,clippingPlanes:[],
  outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:false,type:T.PCFShadowMap}};
 const preflight=olearyLinkPrograms(fake as unknown as T.WebGLRenderer,camera,scene),s=new AbortController();
 const ok=await preflight(model.group,s.signal);assert(ok?.());assert.equal(caseCompile,1);
 rt={};assert(!ok?.());rt=null;assert(ok?.());
 everyLinked=false;assert(!await preflight(model.group,s.signal));assert.equal(caseCompile,2);
 everyLinked=true;complete=false;const interrupted=new AbortController(),p=preflight(model.group,interrupted.signal);
 interrupted.abort();assert.equal(await p,undefined);assert.equal(caseCompile,3);
 lost=true;assert(!await preflight(model.group,s.signal));assert.equal(caseCompile,3);
 lost=false;complete=true;scene.add(model.group);assert(!await preflight(model.group,s.signal));assert.equal(caseCompile,3);
 assert(!await olearyLinkPrograms({} as T.WebGLRenderer,camera,scene)(new T.Group(),s.signal));
 model.dispose();
});

test('the five-material station links during the longer cold window, never after its bound',async t=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),model=z();
 let tick=0,step=1850,availableAt=1,queries=0,pass=true;
 t.mock.method(performance,'now',()=>tick);
 const assigned=new WeakMap<T.Material,{program:object;isReady:()=>boolean}>();
 const gl={LINK_STATUS:0x8B82,isContextLost:()=>false,isProgram:(p:object)=>!!p,
  getProgramParameter:()=>{queries++;return pass;}};
 const fake={compile(g:T.Group){
  const matches=g.children.map(q=>(q as T.Mesh).material as T.Material);
  for(const a of matches)assigned.set(a,{program:{},isReady:()=>tick>=availableAt});
  setTimeout(()=>{tick=step;},1);
  return new Set(matches);
 },properties:{get:(m:T.Material)=>({currentProgram:assigned.get(m)})},getContext:()=>gl,getRenderTarget:()=>null,
 clippingPlanes:[],outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:false,type:T.PCFShadowMap}};
 const probe=olearyLinkPrograms(fake as unknown as T.WebGLRenderer,camera,scene);
 const notAborted=new AbortController().signal;
 assert((await probe(model.group,notAborted))?.());
 assert.equal(queries,5);
 tick=0;step=OLEARY_STATION_PROGRAM_MS-1000;
 assert((await probe(model.group,notAborted))?.());
 assert.equal(queries,10);
 tick=0;step=OLEARY_STATION_PROGRAM_MS+100;
 assert.equal(await probe(model.group,notAborted),undefined);
 assert.equal(queries,10);
 tick=0;step=2000;pass=false;
 assert.equal(await probe(model.group,notAborted),undefined);
 assert.equal(queries,11);
 assert.equal(model.group.parent,null);
 model.dispose();
});

test('never stages an omission while the detached link is in flight or after it rejects or loses source/terrain',async()=>{
 const n=context(),g=grade(),a=z();
 let ground:T.Mesh|undefined=g,finish:((p:OlearyProgramProof|undefined)=>void)|undefined, signal:AbortSignal|undefined;
 const seat={center:olearyGradeCenter(terrain),ground:()=>ground?{fine:ground,seams:cold}:undefined,verifiedCover:async()=>true,
  link:async(group:T.Group,s:AbortSignal)=>{assert(!group.parent);signal=s;return await new Promise<OlearyProgramProof|undefined>(done=>finish=done);}};
 const lease=new OlearySocket(n.s,n.owner,n.raw,542,source[431],seat,async()=>a);
 lease.sync();await ready(()=>!!finish);assert(!lease.active&&n.s.children.length===1&&n.owner.geometry===n.original);
 finish!(undefined);await ready(()=>!a.intact());assert(!lease.active&&n.s.children.length===1&&n.owner.geometry===n.original);
 lease.dispose();
 const m=context(),b=z();finish=undefined;
 const stale=new OlearySocket(m.s,m.owner,m.raw,542,source[431],seat,async()=>b);
 stale.sync();await ready(()=>!!finish);const chunk=new Uint8Array(m.raw);chunk[5]^=1;
 finish!(()=>true);await ready(()=>!b.intact());assert(!stale.active&&m.s.children.length===1&&m.owner.geometry===m.original);
 stale.dispose();
 const f=context(),c=z();finish=undefined;signal=undefined;
 const canceled=new OlearySocket(f.s,f.owner,f.raw,542,source[431],seat,async()=>c);
 canceled.sync();await ready(()=>!!finish);ground=undefined;canceled.sync();assert(signal?.aborted);
 finish!(()=>true);await ready(()=>!c.intact());assert(!canceled.active&&f.s.children.length===1&&f.owner.geometry===f.original);
 canceled.dispose();g.geometry.dispose();g.material.dispose();
});
