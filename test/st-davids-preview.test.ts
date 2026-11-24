import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import * as T from 'three';
import {BuildingShadows} from '../src/render/local-building-shadows.ts';
import {ST_DAVIDS as S} from '../src/render/st-davids/source.generated.ts';
import {ST_DAVIDS_ART as A} from '../src/render/st-davids/art.generated.ts';
import {stDavidsAtlasAllows,stDavidsGround,stDavidsOwnerAllows,stDavidsOwnerBytes,stDavidsRequested,stDavidsStandardRequested} from '../src/render/st-davids/admit.ts';
import {decodeStDavids,loadStDavids} from '../src/render/st-davids/runtime.ts';
const dir=new URL('../public/',import.meta.url),read=(p:string)=>fs.readFileSync(new URL(p,dir));
const slice=(a:Uint8Array)=>Uint8Array.from(a).buffer;
const sha=(a:Uint8Array)=>createHash('sha256').update(a).digest('hex');
const wire=read('art/'+A.file),raw=gunzipSync(wire,{maxOutputLength:A.raw}),renderer=new BuildingShadows({} as T.WebGLRenderer,new T.Vector3(-.60,.74,-.31));
const plain=(p:URLSearchParams)=>stDavidsRequested(p),want='buildingShadows&stDavidsChurchReview';
test('St. David’s explicit shadow mode is one-owner only',()=>{
 for(const q of ['', 'buildingShadows','stDavidsChurchReview',want+'&scenery=detail',want+'&surveyRelief',want+'&inlandRelief',want+'&seatedRoads'])assert(!plain(new URLSearchParams(q)),q);
 assert(plain(new URLSearchParams(want)));
 assert(plain(new URLSearchParams(want+'&summersideStationReview')));
 const atlas=JSON.parse(read('world/buildings/index.json').toString()),part=atlas.tiles.find((t:{id:string})=>t.id===S.tile),
  packed=read('world/buildings/'+atlas.file).subarray(S.offset,S.offset+S.size),rows=JSON.parse(gunzipSync(packed).toString()).features;
 assert(stDavidsAtlasAllows(atlas.sha256,part));assert(!stDavidsAtlasAllows(atlas.sha256,{...part,bounds:[...part.bounds].reverse()}));
 assert(!stDavidsAtlasAllows(atlas.sha256,{...part,offset:part.offset+1}));assert(!stDavidsAtlasAllows('bad',part));
 assert.deepEqual([S.tile,S.ordinal,S.vertices,S.start,S.end],['q11220',203,31179,14070,14136]);
 assert(stDavidsOwnerAllows(rows));rows[S.ordinal].footprint.reverse();assert(!stDavidsOwnerAllows(rows));
 return stDavidsOwnerBytes(slice(packed)).then(result=>assert(result));
});
test('the same original meshes reach the translation-only depth roster, with no rear porch',()=>{
 assert.equal(wire.byteLength,A.wire);assert.equal(raw.byteLength,A.raw);assert.equal(sha(wire),A.wireSha);assert.equal(sha(raw),A.rawSha);
 const a=decodeStDavids(slice(raw),renderer);assert(a);assert.equal(a.group.visible,false);
 // One exact, retained image/geometry pack for both paths. Verify each expanded shadow vertex.
 const gp=new T.Vector3(),cp=new T.Vector3(),pos=a.caster.geometry.getAttribute('position'),idx=a.caster.geometry.index!;
 const members=a.group.children as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[];
 a.group.updateMatrixWorld(true);assert.equal(members.length,13);
 let vs=0,ix=0,error=0;
 for(const g of members){
  const attr=g.geometry.getAttribute('position'),inOrder=g.geometry.index!;
  for(let i=0;i<attr.count;i++){
   gp.fromBufferAttribute(attr,i).applyMatrix4(g.matrixWorld);cp.fromBufferAttribute(pos,vs+i).applyMatrix4(a.caster.matrixWorld);
   error=Math.max(error,cp.distanceTo(gp));
  }
  for(let i=0;i<inOrder.count;i++)assert.equal(idx.getX(ix+i),vs+inOrder.getX(i));
  vs+=attr.count;ix+=inOrder.count;
 }
 assert.equal(ix/3,5364);assert.equal(ix,idx.count);assert.equal(vs,pos.count);assert(error<.000002,`${error}m geometry/caster mismatch`);
 assert.equal(new T.Box3().setFromObject(a.group).intersectsBox(new T.Box3(new T.Vector3(S.originXZ[0]-.1,1e3,S.originXZ[1]-.1),new T.Vector3(S.originXZ[0]+.1,1010,S.originXZ[1]+.1))),false);
 // Both variants use the exact production shader uniforms, and disposal is idempotent.
 for(const m of members){const s={uniforms:{},vertexShader:'#include <worldpos_vertex>', fragmentShader:'#include <common>\n#include <emissivemap_fragment>\n#include <lights_fragment_end>'};
  m.material.onBeforeCompile(s as never, {} as T.WebGLRenderer);assert.match(s.fragmentShader,/railBuildingShade\(sdavWorld/);assert.equal((s.uniforms as any).localCastLive,renderer.uniforms.localCastLive);}
 const scene=new T.Scene();scene.add(a.group);let disposed=0;
 for(const m of members){m.geometry.addEventListener('dispose',()=>disposed++);m.material.addEventListener('dispose',()=>disposed++);m.material.map?.addEventListener('dispose',()=>disposed++);}
 a.caster.geometry.addEventListener('dispose',()=>disposed++);a.caster.material.addEventListener('dispose',()=>disposed++);
 a.dispose();const old=disposed;a.dispose();assert.equal(disposed,old);assert.equal(disposed,members.length*2+members.filter(q=>q.material.map).length+2);assert.equal(a.group.parent,null);
});
test('valid raw/streamed gzip accepted; same-length damaged / oversized / wrong gzip / late rejected',async()=>{
 const cases=[slice(wire),slice(raw)];
 const good=`/art/${A.file}`;
 for(const input of cases){
  let asked=0;const a=await loadStDavids('/art/',renderer,async href=>{
   assert.equal(href,good);asked++;
   return new Response(new ReadableStream({start(r){const b=new Uint8Array(input);for(let i=0;i<b.length;i+=9013)r.enqueue(b.subarray(i,i+9013));r.close();}}));
  });assert(a);assert.equal(asked,1);a.dispose();
 }
 const mismatch=new Uint8Array(slice(raw));mismatch[mismatch.length-64]^=4;
 const bad=[new Response('not here',{status:404}),new Response(slice(wire),{status:206}),new Response(slice(wire.subarray(0,-1))),
   new Response(mismatch),new Response(slice(gzipSync(mismatch))),new Response(new Uint8Array(A.raw+1))];
 for(const x of bad)assert.equal(await loadStDavids('/art/',renderer,async()=>x),undefined);
 const broken=Uint8Array.from(raw);broken[0]^=1;assert.equal(decodeStDavids(slice(broken),renderer),undefined);
 let aborted=false,replied=false;const pending=async(_href: unknown,init?:RequestInit)=>{
  init?.signal?.addEventListener('abort',()=>aborted=true);
  await new Promise(ok=>setTimeout(ok,48));replied=true;return new Response(slice(wire));
 };
 assert.equal(await loadStDavids('/art/',renderer,pending,10),undefined);assert(aborted);
 await new Promise(ok=>setTimeout(ok,55));assert(replied);
});
test('contact lease is locked to the same unaltered near geometry and surface fingerprints',()=>{
 const tile=new T.BufferGeometry(),other=new T.BufferGeometry();let l:T.BufferGeometry|undefined=tile,offset=0,road:string|undefined=S.road,checked=0;
 const m=Object.fromEntries(S.grade.map(([x,z,y,h])=>[`${x}_${z}`,[y,h]]));
 const actor={
  rollingCanopyOwner:()=>l?{key:S.groundTile,geometry:l}:undefined,
  visualGroundHeight:(x:number,z:number)=>{checked++;return m[`${x}_${z}`][0]+offset;},
  surface:(x:number,z:number)=>({height:m[`${x}_${z}`][1],land:true,runway:false}),
  cover:{distance:()=>S.minDry,sourceSha:S.cover,sourceDecodedSha:S.coverDecoded},terrain:{},
 };
 const gate=stDavidsGround(actor as never,S.terrain,()=>road);assert(gate);assert(gate());assert(gate());assert.equal(checked,S.grade.length);
 road=undefined;assert(!gate());road=S.road;l=undefined;assert(!gate());l=other;offset=.21;assert(!gate());
 l=tile;offset=0;assert(gate());assert.equal(stDavidsGround(actor as never,'incorrect',()=>road),undefined);
});
test('the ordinary exterior skips the decoded caster but keeps the same exact art groups',()=>{
 const enabled=(q:string)=>stDavidsStandardRequested(new URLSearchParams(q));
 assert.equal(enabled(''),true);
 assert.equal(enabled('departure=georgetown-low'),true);
 for(const q of ['stockStDavidsExterior','stDavidsChurchReview','buildingShadows','scenery=detail','surveyRelief','inlandRelief',
  'seatedRoads','northBaywalkPreview','northBaywalkConcrete','spinnakersPreview'])assert.equal(enabled(q),false,q);
 const standard=decodeStDavids(slice(raw),undefined),preview=decodeStDavids(slice(raw),renderer);
 assert(standard&&preview);assert.equal(standard.caster,undefined);assert(preview.caster);
 const geometry=(g:T.Group)=>g.children.map(c=>{
  const m=c as T.Mesh;return [m.name,m.geometry.index?.count,m.geometry.getAttribute('position').count] as const;
 });
 assert.deepEqual(geometry(standard.group),geometry(preview.group));
 const m=standard.group.children.find(q=>q.name==='glass') as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const opt={uniforms:{},vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <emissivemap_fragment>\n#include <lights_fragment_end>'};
 m.material.onBeforeCompile(opt as never,{} as T.WebGLRenderer);
 assert.match(opt.fragmentShader,/sdavFresnel/);assert.doesNotMatch(opt.fragmentShader,/railBuildingShade/);assert.deepEqual(opt.uniforms,{});
 standard.dispose();preview.dispose();
});
