import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Buffer} from 'node:buffer';
import * as T from 'three';
import {buildBordenRearTower as old} from '../studio/src/rear-range.ts';
import {buildBordenRearTower as next,BORDEN_STUDY_DIMENSIONS as dims} from './src/rear-range.ts';
const sha=v=>createHash('sha256').update(v).digest('hex');
const digest=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
assert.equal(sha(readFileSync(new URL('../studio/src/rear-range.ts',import.meta.url))),'9ceb49c799b77b4812d94dc95cf0502dfd3e9c280a764fd81713d468df8e1a6b');
assert.equal(sha(readFileSync(new URL('../v1-rgba-reference.json',import.meta.url))),'81bc3cce3162a19010d20eb336945b16f964dc85438c31f97f8573232d91f629');
assert.equal(sha(readFileSync(new URL('../BORDEN-REAR-DETACHED-V2-PRELOCK.md',import.meta.url))),'985942561de4ec68efcd3e07f8804fe4ee7952beffb54ecd41d62c89e61454bb');
const preserved=['gallery','bracket','guard','cap','terminal'];
const inside=(i,[lo,hi])=>i>=lo&&i<hi;
const inspect=[...['close','medium'].map(level=>{
 const a=old(level),b=next(level),c=next(level),m=b.mesh,ma=a.mesh,g=b.mesh.geometry,ga=ma.geometry,at=g.attributes,p=at.position,n=at.normal;
 assert.deepEqual(a.dimensions,b.dimensions);assert.deepEqual(a.dimensions,dims);
 assert(a.mesh.position.equals(m.position));assert(a.mesh.rotation.equals(m.rotation));assert(m.position.lengthSq()===0&&m.parent===null);
 assert(Object.values(m.material).every(x=>!(x instanceof T.Texture)));
 assert(m.material.isMeshStandardMaterial&&m.material.depthWrite&&m.material.depthTest&&!m.material.transparent&&
  !m.castShadow&&!m.receiveShadow&&m.material.side===T.FrontSide&&m.material.opacity===1);
 assert.deepEqual(Object.keys(at),Object.keys(ga.attributes));
 assert.equal(g.index,null);assert.equal(g.groups.length,0);
 assert.deepEqual(g.boundingBox.min.toArray(),ga.boundingBox.min.toArray());
 assert.deepEqual(g.boundingBox.max.toArray(),ga.boundingBox.max.toArray());
 assert.equal(p.count%3,0);assert.equal(g.boundingBox.min.y,0);assert.equal(g.boundingBox.max.y,Math.fround(12.8));
 const all=Object.fromEntries(Object.entries(at).map(([k,v])=>{
  assert(v.count===p.count&&v.array instanceof Float32Array&&v.array.every(Number.isFinite));
  const sha=digest(v.array);
  assert.equal(sha,digest(c.mesh.geometry.attributes[k].array));
  return [k,{sha,bytes:v.array.byteLength,size:v.itemSize}];
 }));
 const clean=Object.fromEntries(preserved.map(name=>[name,Object.fromEntries(Object.entries(at).map(([k,v])=>{
  const a0=ga.attributes[k].array.subarray(a.roles[name][0]*v.itemSize,a.roles[name][1]*v.itemSize);
  const a1=v.array.subarray(b.roles[name][0]*v.itemSize,b.roles[name][1]*v.itemSize);
  const h=digest(a1);assert.equal(h,digest(a0));return [k,h];
 }))]));
 // Actual closed frustum including the recessed face returns and the unique opaque back
 // but not its additional overlapping fitted trim/brow. Exact welded edges (not a tolerance ring).
 const cut=[0,b.upperSash[0]+30], edges=new Map(), normal=new T.Vector3();
 let volume=0,minArea=Infinity,minNormal=Infinity,shingleVertices=0;
 for(let i=0;i<p.count;i+=3){
  const t=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j));
  normal.subVectors(t[1],t[0]).cross(new T.Vector3().subVectors(t[2],t[0]));
  const area=normal.length()*.5;assert(area>1e-7);minArea=Math.min(minArea,area);
  const claim=n.getX(i)*normal.x+n.getY(i)*normal.y+n.getZ(i)*normal.z;
  assert(claim/(area*2)>.99997);minNormal=Math.min(minNormal,claim/(area*2));
  if(level==='close'){
   const k=at.bordenClad.getX(i);
   assert.equal(at.bordenClad.getX(i+1),k);assert.equal(at.bordenClad.getX(i+2),k);
   if(k){assert(i<b.upperSash[0]);shingleVertices+=3;}
  }
  if(!inside(i,cut))continue;
  volume+=t[0].dot(t[1].clone().cross(t[2]))/6;
  for(let e=0;e<3;e++){
   const a=t[e].toArray().join(','),b=t[(e+1)%3].toArray().join(','),key=[a,b].sort().join('|');
   const old=edges.get(key)||[0,0];old[0]++;old[1]+=a<b?1:-1;edges.set(key,old);
  }
 }
 assert([...edges.values()].every(([n,o])=>n===2&&!o),JSON.stringify([...edges].filter(([,a])=>a[0]!==2||a[1]).slice(0,5)));
 assert(volume>148&&volume<148.74);assert(b.upperSash[1]===b.roles.shaft[1]);
 const roof=m.geometry.attributes.normal;
 assert(roof.getY(b.upperSash[1]-36)>.70,'shed physical top normal');
 if(level==='close'){
  const glsl={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};
  m.material.onBeforeCompile(glsl,undefined);
  assert.equal((glsl.fragmentShader.match(/fwidth\(/g)||[]).length,1);
  assert(!/sampler|texture[2D]|\bdiscard\b|\bgl_FragDepth\b/.test(glsl.fragmentShader));
  assert(glsl.fragmentShader.indexOf('fwidth')<glsl.fragmentShader.indexOf('if(vBordenClad>'));
  assert.throws(()=>m.material.onBeforeCompile({vertexShader:'',fragmentShader:''},undefined),/anchors/);
 }
 return {level,oldTotal:ga.attributes.position.count/3,total:p.count/3,all,clean,shingleVertices,minArea,minNormal,volume,
  upperSash:b.upperSash,bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()],roles:b.roles};
})];
assert(inspect[1].total<inspect[0].total*.70);
for(const input of [{shaftBase:3},{finialTop:23.2},{galleryDepth:.001},{lanternEave:15},{shaftTop:10.1},{noWorldMount:1},{railHeight:NaN}]){
 assert.throws(()=>next('close',input),/illustrative/);
}
assert.throws(()=>next('far'),/LOD/);
assert.equal(next('close',{shaftBase:5.32}).dimensions.shaftBase,5.32);
const result={scope:'Detached V2 CPU; V1 intact. No source, renderer, placement, or production claims.',inspect};
console.log(JSON.stringify(result,null,2));
