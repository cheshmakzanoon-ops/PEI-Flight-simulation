import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {gunzipSync as gunzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {Cover} from '../src/sim/cover.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {WORLD_COLS,WORLD_ROWS} from '../src/sim/coastal-terrain.ts';
import {olearyExteriorRequested,olearyIndustrialStudyRequested,olearyWarehouseRequested} from '../src/app/scenery-profile.ts';
import {OLEARY,OLEARY_INDUSTRIAL,OLEARY_WAREHOUSE,olearyGradeCenter,olearyNativeGrade,olearySourceDraw,type OlearySeat} from '../src/render/oleary-railway/authority.ts';
import {olearyIndustrialDry,olearyIndustrialSeat} from '../src/render/oleary-railway/industrial-seat.ts';
import {OlearyCohortSocket} from '../src/render/oleary-railway/cohort.ts';
import {buildDetachedIndustrial192} from '../src/render/oleary-railway/industrial-envelope.ts';
import {OLEARY_PACKET} from '../src/render/oleary-railway/packet.generated.ts';
import {decodeOleary} from '../src/render/oleary-railway/packet.ts';
import {olearyLinkPrograms,type OlearyLink,type OlearyProgramProof} from '../src/render/oleary-railway/program-gate.ts';

const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length) as ArrayBuffer;
const sha=(a:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const j=(name:string)=>JSON.parse(read('public/world/'+name,'utf8'));
const so=j('terrain.json'),terrain=new Terrain(so,new Int16Array(ab(gunzip(read('public/world/'+so.file)))));
const idx=j('buildings/index.json'),tile=idx.tiles.find((x:{id:string})=>x.id==='q20213');
const packed=read('public/world/buildings/'+idx.file).subarray(tile.offset,tile.offset+tile.bytes),rows=JSON.parse(gunzip(packed).toString()).features;
const art=ab(gunzip(read('public/art/'+OLEARY_PACKET.file))),centre=olearyGradeCenter(terrain),seams='112:56,56,56,112';
const station=()=>decodeOleary(art)!;
const sleep=(ms=5)=>new Promise(done=>setTimeout(done,ms));
const until=async (q:()=>boolean)=>{for(let i=0;!q()&&i<240;i++)await sleep();assert(q());};
const linked:OlearyLink=async()=>()=>true;
function nativeGrade(scene:T.Scene){
 const w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS,x0=terrain.left+3*w,z0=terrain.top+7*d;
 const geometry=new T.PlaneGeometry(w,d,112,112).rotateX(-Math.PI/2),p=geometry.getAttribute('position');
 const g=new T.Mesh(geometry,new T.MeshStandardMaterial());g.position.set(x0+w/2,0,z0+d/2);
 for(let k=0;k<p.count;k++)p.setY(k,terrain.atlasElevation(p.getX(k)+g.position.x,p.getZ(k)+g.position.z)+.12);
 assert.equal(sha(p.array),OLEARY.grade.position);
 for(const [side,lod]of [56,56,56,112].entries()){
  const ratio=112/lod;let a=0,b=0;
  const h=(u:number)=>terrain.atlasElevation(x0+w*(side%2===0?u:side===1?1:0),z0+d*(side%2===1?u:side===2?1:0))+.12;
  for(let k=0;k<=112;k++){
   if(k%ratio===0){a=h(k/112);b=h(Math.min(1,(k+ratio)/112));}
   const i=side===0?k:side===1?k*113+112:side===2?112*113+k:k*113;
   p.setY(i,a+(b-a)*(k%ratio)/ratio);
  }
 }
 p.needsUpdate=true;scene.add(g);return g;
}
function host(trackIndustrial=true,trackStation=true,trackWarehouse=false){
 const scene=new T.Scene(),b=new (Buildings as any)(scene,terrain,[tile],{},idx.sha256);
 const m=b.generate(rows,b.tiles[0],false,trackStation?OLEARY.ordinal:undefined,false,undefined,false,false,trackIndustrial,trackWarehouse) as T.Mesh;
 scene.add(m);
 const g=nativeGrade(scene);let grounded=true,throws=false;
 const ground=()=>{if(throws)throw new Error('bad native supplier');return grounded?{fine:g,seams}:undefined;};
 const seat=(link:OlearyLink=linked):OlearySeat=>({center:centre,ground,verifiedCover:async()=>true,link});
 return {scene,m,stock:m.geometry,g,raw:ab(packed),seat,grounded:(v:boolean)=>{grounded=v;},throws:(v:boolean)=>{throws=v;},
  close(){g.geometry.dispose();(g.material as T.Material).dispose();m.geometry.dispose();(m.material as T.Material).dispose();}};
}
function expectIndex(q:ReturnType<typeof host>,station:boolean,industrial:boolean,warehouse=false){
 if(!station&&!industrial&&!warehouse){assert.equal(q.m.geometry,q.stock);assert.equal(q.stock.index,null);return;}
 const g=q.m.geometry,i=g.index!;assert.notEqual(g,q.stock);assert(i.array instanceof Uint16Array);
 const p=OLEARY.proof,r=OLEARY_INDUSTRIAL.proof,w=OLEARY_WAREHOUSE.proof,vs:number[]=[];
 for(let j=0;j<p.vertices;j++)if(!(station&&j>=p.start&&j<p.end)&&!(industrial&&j>=r.start&&j<r.end)&&!(warehouse&&j>=w.start&&j<w.end))vs.push(j);
 assert.deepEqual(i.array,new Uint16Array(vs));
 for(const [k,v]of Object.entries(q.stock.attributes))assert.equal(v,g.getAttribute(k));
 assert(!g.groups.length&&g.drawRange.count===Infinity&&g.drawRange.start===0);
}
function make(q:ReturnType<typeof host>,options:{station?:boolean;stationLink?:OlearyLink;industrialLink?:OlearyLink;
  industrialOpen?:NonNullable<ConstructorParameters<typeof OlearyCohortSocket>[9]>['industrial'];raw?:ArrayBuffer;row?:unknown;issuer?:()=>boolean}={}){
 const s=new OlearyCohortSocket(q.scene,q.m,options.raw??q.raw,rows.length,rows[431],options.row??rows[192],
  q.seat(options.stationLink),{station:options.station??true,industrialLink:options.industrialLink??linked},
  options.issuer??(()=>true),{station:async()=>station(),industrial:options.industrialOpen});
 s.sync();return s;
}
test('explicit QA Boolean alone is independent of #240 station and all other Standard controls',()=>{
 const q=(x:unknown,options='')=>new URLSearchParams('diagnostics&scenery=standard&qa='+encodeURIComponent(JSON.stringify(x))+options);
 for(const v of [undefined,{},null,[],true,{'olearyIndustrial192':'true'},{'olearyIndustrial192':1},{'olearyIndustrial192':false}]){
  assert(!olearyIndustrialStudyRequested(q(v)));
 }
 const on={olearyIndustrial192:true};
 assert(olearyIndustrialStudyRequested(q(on)));assert(!olearyExteriorRequested(q(on)));
 assert(olearyIndustrialStudyRequested(q(on,'&stockOlearyExterior&olearyExteriorStudy'))&&!olearyExteriorRequested(q(on,'&stockOlearyExterior&olearyExteriorStudy')));
 assert(olearyIndustrialStudyRequested(q(on,'&olearyExteriorStudy'))&&olearyExteriorRequested(q(on,'&olearyExteriorStudy')));
 for(const tail of ['&surveyRelief','&scenery=detail','&qa={}'])assert(!olearyIndustrialStudyRequested(q(on,tail)));
 assert(!olearyIndustrialStudyRequested(new URLSearchParams('qa={"olearyIndustrial192":true}')));
 assert(!olearyIndustrialStudyRequested(new URLSearchParams('diagnostics&olearyIndustrial192')));
 assert(!olearyIndustrialStudyRequested(new URLSearchParams('diagnostics&qa='+' '.repeat(2049))));
 const c=j('cover.json'),cw=read('public/world/cover.bin.gz'),cover=new Cover(c.width,c.height,new Uint8Array(ab(gunzip(cw))),undefined,sha(cw));
 assert(olearyIndustrialDry(terrain,cover));
});
test('actual compiled stock emitter gives both independent spans without changing one of the six arrays',async()=>{
 const a=host(false,true),b=host(true,true),c=host(true,false);
 assert.deepEqual(b.m.userData.olearyIndustrialTriangles,[13392,13449]);assert.deepEqual(c.m.userData.olearyIndustrialTriangles,[13392,13449]);
 assert.deepEqual(b.m.userData.beaconTriangles,[26343,26385]);
 assert(!a.m.userData.olearyIndustrialTriangles&&!c.m.userData.beaconTriangles);
 for(const [k,v]of Object.entries(a.stock.attributes)){
  assert.deepEqual(b.stock.getAttribute(k).array,v.array);assert.deepEqual(c.stock.getAttribute(k).array,v.array);
 }
 assert(await olearySourceDraw(b.raw,542,rows[192],b.stock,b.m.userData.olearyIndustrialTriangles,OLEARY_INDUSTRIAL));
 assert(!await olearySourceDraw(b.raw,542,rows[431],b.stock,b.m.userData.olearyIndustrialTriangles,OLEARY_INDUSTRIAL));
 assert(await olearyNativeGrade(b.g,centre,seams));
 for(const q of [a,b,c])q.close();
});
test('actual detached native industrial seat stays on signed grade, all six authored Float32 streams are sealed',()=>{
 const q=host(),sample=olearyIndustrialSeat(q.g);assert(sample);assert(Number.isNaN(sample(0,0)));
 const m=buildDetachedIndustrial192(sample);
 assert.equal(m.datumGameM,32.11015963444702);
 assert.deepEqual(m.group.children.map(x=>(x as T.Mesh).geometry.getAttribute('position').count/3),[1536,200]);
 const pins=[["ac654210ae8e53733e33c9d3ad1baed546401b8b56c73b69ede7ba7c732a3cd5","0b64ff9f352529caf0a23ff24879b3e18c4d78af8277e7c50fbb98518c8f8a88","6049e47e770aef7a64e1c687b9c77aae93c8fc3e2399fa75777f4ddbb1a7e641"],["4f60a862cd9972484ebd5e117911c1300e7bd2c5a7d480d2f056cf0b7d021a67","9d576164b65969786d49045b676c87f971c4f66939ba9823ce379c9934f94d44","5ce42fa21f5055da3f32f37169350b44e8e41c8ebf9430e177b3068c98bac8a8"]];
 for(const [i,child]of (m.group.children as T.Mesh[]).entries()){
  assert.deepEqual(['position','normal','color'].map(k=>sha(child.geometry.getAttribute(k).array)),pins[i]);
 }
 assert(m.intact());const child=m.group.children[0];child.position.x=1;assert(!m.intact());child.position.x=0;
 child.matrixAutoUpdate=false;assert(!m.intact());child.matrixAutoUpdate=true;assert(m.intact());m.dispose();q.close();
});
test('station alone, industrial alone, and both keep the immutable whole source; q192 rollback preserves q431 bit-for-bit',async()=>{
 const a=host(true,true),b=host(true,false),c=host(true,true);
 const stationOnly=make(a,{industrialLink:async()=>undefined}),industrialOnly=make(b,{station:false}),both=make(c);
 await until(()=>stationOnly.active&&industrialOnly.industrialActive&&both.active&&both.industrialActive);
 expectIndex(a,true,false);expectIndex(b,false,true);expectIndex(c,true,true);
 const active=c.scene.children.find(x=>x.name.startsWith('O’Leary q192'))!;
 active.children[0].position.z=8;both.sync();assert(!both.industrialActive&&both.active);expectIndex(c,true,false);
 assert.deepEqual(c.m.geometry.index!.array,a.m.geometry.index!.array);
 active.children[0].position.z=0;both.sync();assert(both.active&&both.industrialActive);expectIndex(c,true,true);
 both.dispose();stationOnly.dispose();industrialOnly.dispose();
 for(const q of [a,b,c]){expectIndex(q,false,false);assert.equal(q.scene.children.length,2);q.close();}
});
test('isolated bad link on either of the real r187 gate’s material rosters keeps that old span and preserves its sibling',async()=>{
 function gate(scene:T.Scene,draws:2|5,fail:boolean){
  const camera=new T.PerspectiveCamera(),map=new Map<T.Material,{currentProgram:object}>();let queried=0;
  const gl={isContextLost:()=>false,isProgram:()=>true,LINK_STATUS:123,
   getProgramParameter:(p:{linked:boolean},k:number)=>{assert.equal(k,123);queried++;return p.linked;}};
  const r={getContext:()=>gl,getRenderTarget:()=>null,properties:{get:(m:T.Material)=>map.get(m)},clippingPlanes:[],shadowMap:{enabled:false},
   compile:(group:T.Group,c:T.Camera,s:T.Scene)=>{
    assert(!group.parent&&c===camera&&s===scene);assert.equal(group.children.length,draws);
    const mats=group.children.map(o=>(o as T.Mesh).material as T.Material);
    mats.forEach((m,i)=>map.set(m,{currentProgram:{program:{linked:!(fail&&i===mats.length-1)},isReady:()=>true}}));
    return new Set(mats);
   }};
  return {link:olearyLinkPrograms(r as unknown as T.WebGLRenderer,camera,scene,draws),count:()=>queried};
 }
 for(const bad of [2,5]){
  const q=host(),a=gate(q.scene,2,bad===2),b=gate(q.scene,5,bad===5),s=make(q,{industrialLink:a.link,stationLink:b.link});
  await until(()=>a.count()===2&&b.count()===5&&(bad===2?s.active:s.industrialActive));
  assert.equal(s.active,bad!==5);assert.equal(s.industrialActive,bad!==2);
  expectIndex(q,bad!==5,bad!==2);assert.equal(q.scene.children.filter(v=>v.isGroup).length,1);
  s.dispose();expectIndex(q,false,false);q.close();
 }
});
test('any owned alternate mutation withdraws both, while a foreign draw is never overwritten',async()=>{
 for(const mode of ['unversioned','versioned','different-index','foreign','stock-version'] as const){
  const q=host(),s=make(q);
  await until(()=>s.active&&s.industrialActive);const alt=q.m.geometry,foreign=q.stock.clone();
  if(mode==='unversioned')alt.index!.array[20]=27;
  else if(mode==='versioned')alt.index!.needsUpdate=true;
  else if(mode==='different-index')alt.setIndex(alt.index!.clone());
  else if(mode==='foreign'){q.m.geometry=foreign;foreign.setIndex([1,2,3]);}
  else q.stock.getAttribute('normal').needsUpdate=true;
  s.sync();assert(!s.active&&!s.industrialActive);
  if(mode==='foreign'){assert.equal(q.m.geometry,foreign);assert.deepEqual([...foreign.index!.array],[1,2,3]);}
  else expectIndex(q,false,false);
  s.dispose();q.close();foreign.dispose();
 }
});
test('grade supplier/actor proof throws fail safe; moving either claimed span does not change its sibling',async()=>{
 const q=host();let failed=false;
 const s=make(q,{industrialLink:async()=>()=>{if(failed)throw Error('refused local program');return true;}});
 await until(()=>s.active&&s.industrialActive);
 failed=true;s.sync();assert(s.active&&!s.industrialActive);expectIndex(q,true,false);
 failed=false;s.sync();assert(s.industrialActive);expectIndex(q,true,true);
 q.m.userData.beaconTriangles=[26343,26388];s.sync();assert(!s.active&&s.industrialActive);expectIndex(q,false,true);
 q.m.userData.beaconTriangles=[26343,26385];s.sync();expectIndex(q,true,true);
 q.throws(true);s.sync();assert(!s.active&&!s.industrialActive);expectIndex(q,false,false);
 q.throws(false);s.sync();await until(()=>s.active&&s.industrialActive);
 const p=q.g.geometry.getAttribute('position'),y=p.getY(500);p.setY(500,y+.25);p.needsUpdate=true;
 s.sync();expectIndex(q,false,false);await sleep(15);assert(!s.industrialActive);
 p.setY(500,y);p.needsUpdate=true;s.sync();await until(()=>s.active&&s.industrialActive);
 s.dispose();q.close();
});
test('stale pending awaits cannot commit after a grade withdrawal/source replacement, or clear a newer valid attempt',async()=>{
 const q=host(),waits:{s:AbortSignal;resolve:(p:OlearyProgramProof)=>void;group:T.Group}[]=[];
 const s=make(q,{industrialLink:(group,signal)=>new Promise(resolve=>waits.push({s:signal,resolve,group}))});
 await until(()=>waits.length===1&&s.active);assert(!s.industrialActive&&!waits[0].group.parent);expectIndex(q,true,false);
 q.grounded(false);s.sync();assert(waits[0].s.aborted);expectIndex(q,false,false);
 q.grounded(true);s.sync();await until(()=>waits.length===2&&s.active);
 waits[0].resolve(()=>true);await sleep(10);assert(!waits[0].group.parent&&!s.industrialActive);
 waits[1].resolve(()=>true);await until(()=>s.industrialActive);expectIndex(q,true,true);
 s.dispose();q.close();
 const q2=host();let gate:((proof:OlearyProgramProof)=>void)|undefined;
 const t=make(q2,{station:false,industrialLink:()=>new Promise(done=>{gate=done;})});
 await until(()=>!!gate);
 const replacement=q2.stock.clone();q2.m.geometry=replacement;t.sync();gate!(()=>true);await sleep(15);
 assert(!t.industrialActive&&q2.m.geometry===replacement&&q2.scene.children.length===2);t.dispose();q2.close();
});
test('candidate source mismatches never borrow a validated q431: foreign q192 row and common corrupt body',async()=>{
 const a=host(),b=host(),damaged=b.raw.slice(0);new Uint8Array(damaged)[5]^=1;
 const badRow=make(a,{row:rows[150]}),badWire=make(b,{raw:damaged});
 await until(()=>badRow.active);assert(!badRow.industrialActive&&!badWire.active&&!badWire.industrialActive);
 expectIndex(a,true,false);expectIndex(b,false,false);
 badRow.dispose();badWire.dispose();a.close();b.close();
});

test('replacement in the issuer map invalidates even a fully attached old mesh and late exact callbacks cannot borrow it',async()=>{
 const q=host();let current:T.Mesh|undefined=q.m,resolve:((f:OlearyProgramProof)=>void)|undefined;
 const s=make(q,{issuer:()=>current===q.m,industrialLink:()=>new Promise(ok=>{resolve=ok;})});
 await until(()=>s.active&&!!resolve);expectIndex(q,true,false);
 assert.equal(q.m.parent,q.scene);
 const replacement=new T.Mesh(q.stock.clone(),new T.MeshBasicMaterial());q.scene.add(replacement);
 current=replacement;s.sync();resolve!(()=>true);await sleep(15);
 assert(!s.active&&!s.industrialActive);expectIndex(q,false,false);
 assert.equal(q.m.parent,q.scene);assert.equal(replacement.geometry.index,null);assert.equal(replacement.geometry.getAttribute('position').count,32049);
 s.dispose();replacement.geometry.dispose();replacement.material.dispose();q.close();
});
test('shared detached shader proof catches a changed light roster after load even before any draw',async()=>{
 const group=new T.Group(),rscene=new T.Scene(),camera=new T.PerspectiveCamera();
 const records=new Map<T.Material,{currentProgram:object}>();
 for(let i=0;i<2;i++)group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));
 const gl={isContextLost:()=>false,isProgram:()=>true,LINK_STATUS:3,getProgramParameter:()=>true};
 const r={getContext:()=>gl,
  getRenderTarget:()=>null,properties:{get:(m:T.Material)=>records.get(m)},clippingPlanes:[],shadowMap:{enabled:false},
  compile:(g:T.Group)=>{
   const materials=g.children.map(c=>(c as T.Mesh).material as T.Material);
   for(const m of materials)records.set(m,{currentProgram:{program:{},isReady:()=>true}});
   return new Set(materials);
  }};
 const prove=olearyLinkPrograms(r as unknown as T.WebGLRenderer,camera,rscene,2,true),signal=new AbortController().signal,
  proof=await prove(group,signal);assert(proof?.());
 const foreign=new T.PointLight();rscene.add(foreign);
 assert.equal(proof!(),false);rscene.remove(foreign);assert(proof!());
 for(const c of group.children as T.Mesh<T.BufferGeometry,T.Material>[]) {c.geometry.dispose();c.material.dispose();}
});

test('warehouse selection is explicit and its stock comparison changes no sibling switch',()=>{
 const on=new URLSearchParams('diagnostics&scenery=standard&olearyExteriorStudy&qa='+encodeURIComponent('{"olearyIndustrial192":true}'));
 assert(!olearyWarehouseRequested(on));on.append('olearyWarehouseStudy','');assert(olearyWarehouseRequested(on));
 assert(olearyExteriorRequested(on)&&olearyIndustrialStudyRequested(on));
 on.append('stockOlearyWarehouse','');assert(!olearyWarehouseRequested(on));
 assert(olearyExteriorRequested(on)&&olearyIndustrialStudyRequested(on));
 for(const tail of ['&surveyRelief','&scenery=detail','&stockOlearyExterior','&qa={}']){
  const other=new URLSearchParams(on.toString()+tail);other.delete('stockOlearyWarehouse');
  assert(!olearyWarehouseRequested(other),tail);
 }
});

test('original warehouse draw proof, four replacement submissions, and exact independent rollback',async()=>{
 const q=host(true,true,true);let shouldUse=true;
 assert.deepEqual(q.m.userData.olearyWarehouseTriangles,[10470,10554]);
 assert(await olearySourceDraw(q.raw,rows.length,rows[150],q.stock,q.m.userData.olearyWarehouseTriangles,OLEARY_WAREHOUSE));
 assert(!(await olearySourceDraw(q.raw,rows.length,rows[192],q.stock,q.m.userData.olearyWarehouseTriangles,OLEARY_WAREHOUSE)));
 const checked:T.Material[]=[];
 const s=new OlearyCohortSocket(q.scene,q.m,q.raw,rows.length,rows[431],rows[192],q.seat(),
  {station:true,industrialLink:linked,warehouse:{row:rows[150],link:async(group)=>{
   assert.equal(group.parent,null);
   const sizes=group.children.flatMap(g=>g.children).map(o=>{
    assert(o instanceof T.Mesh);checked.push(o.material);
    return o.geometry.getAttribute('position').count/3;
   });
   assert.equal(sizes.length,4);
   assert.equal(sizes.reduce((n,x)=>n+x,0),140);
   const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <normal_fragment_maps>',uniforms:{}};
   const sheet=checked.find(m=>m.name==='q150 original sheet');assert(sheet);
   (sheet.onBeforeCompile as (x:unknown,y:unknown)=>void)(shader,undefined);
   assert.match(shader.fragmentShader,/q150ViewBump/);
   return ()=>shouldUse;
  }}},()=>true,{station:async()=>station()});
 s.sync();await until(()=>s.active&&s.industrialActive&&s.warehouseActive);
 expectIndex(q,true,true,true);assert.equal(q.m.geometry.index!.count,31866);
 const root=q.scene.children.find(x=>x.name.startsWith('O’Leary q150 complete'))!;
 const wing=root.children[1].children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const roof=root.children[0].children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const initialBefore=wing.onBeforeRender;
 const mutations=[
  [()=>{wing.material.visible=false;},()=>{wing.material.visible=true;}],
  [()=>{wing.material.wireframe=true;},()=>{wing.material.wireframe=false;}],
  [()=>{wing.onBeforeRender=()=>{};},()=>{wing.onBeforeRender=initialBefore;}],
  [()=>{roof.material.stencilWrite=true;},()=>{roof.material.stencilWrite=false;}],
  [()=>{root.children[1].visible=false;},()=>{root.children[1].visible=true;}],
  [()=>{roof.geometry.setDrawRange(0,6);},()=>{roof.geometry.setDrawRange(0,Infinity);}],
  [()=>{wing.layers.set(2);},()=>{wing.layers.set(0);}],
  [()=>{wing.frustumCulled=false;},()=>{wing.frustumCulled=true;}],
  [()=>{roof.geometry.getAttribute('normal').array=new Float32Array(roof.geometry.getAttribute('normal').array);},()=>{}],
 ];
 // Reversible neighboring draw faults only remove the unsafe warehouse.
 for(const [breakDraw,repair] of mutations.slice(0,-1)){
  breakDraw();s.sync();assert(s.active&&s.industrialActive&&!s.warehouseActive);expectIndex(q,true,true);
  repair();s.sync();assert(s.active&&s.industrialActive&&s.warehouseActive);expectIndex(q,true,true,true);
 }
 shouldUse=false;s.sync();assert(s.active&&s.industrialActive&&!s.warehouseActive);expectIndex(q,true,true);
 shouldUse=true;s.sync();assert(s.active&&s.industrialActive&&s.warehouseActive);expectIndex(q,true,true,true);
 mutations.at(-1)![0]();s.sync();assert(s.active&&s.industrialActive&&!s.warehouseActive);expectIndex(q,true,true);
 s.dispose();expectIndex(q,false,false);assert.equal(q.scene.children.length,2);
 q.close();
});

test('false warehouse link, changed row and retired issuer all retain authenticated stock under other actors',async()=>{
 for(const mode of ['fourth-link','foreign-row','retired-issuer'] as const){
  const q=host(true,true,true);let linkStatusReads=0,current=true,resume:(()=>void)|undefined;
  const rscene=q.scene,camera=new T.PerspectiveCamera(),records=new Map<T.Material,{currentProgram:object}>();
  const gl={isContextLost:()=>false,isProgram:()=>true,LINK_STATUS:3,
   getProgramParameter:(p:{valid:boolean})=>{linkStatusReads++;return p.valid;}};
  const r={getContext:()=>gl,getRenderTarget:()=>null,properties:{get:(m:T.Material)=>records.get(m)},clippingPlanes:[],shadowMap:{enabled:false},
   compile:(g:T.Group)=>{
    const leaves=g.children.flatMap(c=>c.children);
    const materials=leaves.map(c=>(c as T.Mesh).material as T.Material);
    for(const [i,m] of materials.entries())records.set(m,{currentProgram:{program:{valid:i<3},isReady:()=>true}});
    return new Set(materials);
   }};
  const proof=olearyLinkPrograms(r as unknown as T.WebGLRenderer,camera,rscene,4,true);
  const s=new OlearyCohortSocket(rscene,q.m,q.raw,rows.length,rows[431],rows[192],q.seat(),
   {station:true,industrialLink:linked,warehouse:{row:rows[mode==='foreign-row'?431:150],
    link:mode==='retired-issuer'?async()=>new Promise(resolve=>{resume=()=>resolve(()=>true);}):proof}},
   ()=>current,{station:async()=>station()});
  s.sync();await until(()=>s.active&&s.industrialActive&&(mode==='fourth-link'?linkStatusReads===4:mode==='retired-issuer'?!!resume:true));
  assert(!s.warehouseActive);expectIndex(q,true,true);
  if(resume){current=false;s.sync();resume();await sleep(20);assert(!s.active&&!s.industrialActive&&!s.warehouseActive);expectIndex(q,false,false);}
  s.dispose();q.close();
 }
});
