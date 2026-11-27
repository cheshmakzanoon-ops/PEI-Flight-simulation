import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {BufferAttribute,Vector3} from 'three';
import {createDetachedGeorgetownOuterPier} from '../tools/art/georgetown-marine-terminal-study/georgetown-outer-deck.ts';
import {createDetachedGeorgetownPierV2} from '../tools/art/georgetown-marine-terminal-study/georgetown-pier-v2.ts';
import {createDetachedGeorgetownPierV3EastFascia} from '../tools/art/georgetown-marine-terminal-study/georgetown-pier-v3-east-fascia.ts';
import {createDetachedTransitShedA} from '../tools/art/georgetown-marine-terminal-study/shed-a-detached.ts';

const sun=()=>new Vector3(-.6,.74,-.31).normalize();
const bytes=(a:unknown)=>{
 assert(a instanceof BufferAttribute && a.array instanceof Float32Array);
 return Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
};
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const flags=(mesh:{parent:unknown;visible:boolean;castShadow:boolean;receiveShadow:boolean})=>{
 assert.equal(mesh.parent,null);assert.equal(mesh.visible,false);
 assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);
};
const renderFlags=(m:{transparent:boolean;depthWrite:boolean;depthTest:boolean})=>{
 assert(!m.transparent&&m.depthWrite&&m.depthTest);
};
test('Georgetown detached finish uses the exact historic pier buffers and no runtime hooks',()=>{
 const core=createDetachedGeorgetownOuterPier(sun()),extended=createDetachedGeorgetownPierV2(sun()),
  finish=createDetachedGeorgetownPierV3EastFascia(sun());
 const all=[core,extended,finish];all.forEach(m=>{flags(m);renderFlags(m.material);});
 try{
  const c=core.geometry,e=extended.geometry,f=finish.geometry;
  assert.deepEqual([c.attributes.position.count,e.attributes.position.count,f.attributes.position.count],[348,1974,1974]);
  assert.equal(sha(bytes(c.attributes.position)),'a180186788fde83109692b1c7b9d91b79630568e5d838e9cae1473057848ecf3');
  assert.equal(sha(bytes(e.attributes.position)),'80cb6eab877eb24cce14d09bfe46a44aeaf3ac2455abf6053f9eb7b542752be2');
  assert.deepEqual(core.position.toArray(),extended.position.toArray());assert.deepEqual(extended.position.toArray(),finish.position.toArray());
  for(const k of ['position','normal','uv','marinePart']){
   const original=bytes(c.attributes[k]),more=bytes(e.attributes[k]),paint=bytes(f.attributes[k]);
   assert.deepEqual(more.subarray(0,original.length),original);
   assert.deepEqual(paint,more);
  }
  assert.equal(finish.material.vertexShader,extended.material.vertexShader);
  assert.notEqual(finish.material.fragmentShader,extended.material.fragmentShader);
  assert.match(finish.material.fragmentShader,/marineRole>\.5&&marineRole<1\.5&&pierEastEnvelope>0\./);
  assert(!e.index&&!f.index&&e.groups.length===0&&f.groups.length===0);
 }finally{all.forEach(m=>{m.geometry.dispose();m.material.dispose();});}
});
test('Georgetown historical shed keeps all roof and wall seams closed above the modeled floor',()=>{
 const shed=createDetachedTransitShedA(sun());flags(shed);renderFlags(shed.material);
 try{
  const g=shed.geometry,p=g.attributes.position;
  assert.equal(p.count,42);
  assert.equal(sha(bytes(p)),'fbed813aa12e9a14aa42d58d7728cf5a3e947addb6adabdf5cd6ed5c650d6c40');
  const edges=new Map<string,{directions:string[];base:boolean}>();
  for(let at=0;at<p.count;at+=3){
   const k=[at,at+1,at+2].map(j=>[p.getX(j),p.getY(j),p.getZ(j)]);
   for(let j=0;j<3;j++){
    const a=k[j],b=k[(j+1)%3],x=a.join('/'),y=b.join('/');
    const key=[x,y].sort().join('|'),address=edges.get(key)??{directions:[],base:Math.abs(a[1]-1.69)<1e-6&&Math.abs(b[1]-1.69)<1e-6};
    address.directions.push(x+'|'+y);edges.set(key,address);
   }
  }
  const open=[...edges.values()].filter(x=>x.directions.length===1);
  assert.equal(open.length,4); assert(open.every(e=>e.base));
  for(const edge of edges.values())if(edge.directions.length!==1){
    assert.equal(edge.directions.length,2);assert.equal(edge.directions[0].split('|').reverse().join('|'),edge.directions[1]);
  }
  const y=g.boundingBox!.max.y;assert(y>8.95&&y<9.05);
 }finally{shed.geometry.dispose();shed.material.dispose();}
});
