import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import * as T from 'three';
import {createDetachedHedgeBand,hedgePrototype} from './hedge-art.ts';
const q=JSON.parse(read(new URL('venue.json',import.meta.url)));
const art=new T.Texture();art.anisotropy=2;art.colorSpace=T.SRGBColorSpace;
const sun=new T.Vector3(-.60,.74,-.31).normalize();
test('literal lobes/tubes have two reciprocal half edges per face and no degenerate triangles',()=>{
 for(const f of ['shrub','broad','tall'])for(let v=0;v<4;v++){
  const g=hedgePrototype(f,v),P=g.positions;
  let min=Infinity,max=-Infinity;
  for(let i=0;i<P.length;i+=3){
   assert(Math.hypot(P[i],P[i+2]/.54)<=.48200006);
   min=Math.min(min,P[i+1]);max=Math.max(max,P[i+1]);
  }
  assert.equal(min,0); assert.equal(max,1);
  for(const [s,e] of g.pieceRanges){
   const seen=new Map();
   for(let j=s*3;j<e*3;j+=3){
    const a=Array.from(g.indices.slice(j,j+3));assert.equal(new Set(a).size,3);
    const [p,q,r]=a.map(a=>new T.Vector3().fromArray(P,a*3));
    assert(q.sub(p).cross(r.sub(p)).length()>.000005, f+" "+j);
    for(let k=0;k<3;k++){const m=a[k]+':'+a[(k+1)%3];assert(!seen.has(m));seen.set(m,1);}
   }
   for(const s of seen.keys()){const [i,j]=s.split(':');assert(seen.has(j+':'+i),f+' '+s);}
  }
  assert(g.triangles<1250);
 }
});
test('mutually authenticated, exact old XYZ/H/W/variant/light echoed in instance arrays for all supplies',()=>{
 for(const [county,x] of Object.entries(q.county)){
  const t=createDetachedHedgeBand(x.rows,sun,art);assert(t&&t.group.visible===false&&t.group.parent===null);
  assert.equal(x.rows.length,t.batches.reduce((a,b)=>a+b.rows.length,0));
  assert(t.group.children.length<=6);
  assert(t.triangles<70000&&t.bytes<180000);
  for(const {rows,mesh} of t.batches){
   for(let i=0;i<rows.length;i++){
    const r=rows[i];const [h,w,v,l]=r.shape;
    const e=mesh.geometry.getAttribute('hedgeSeat').array,a=mesh.geometry.getAttribute('hedgeArt').array;
    assert.deepEqual(Array.from(e.slice(4*i,4*i+4)),[...r.coords,w]);
    assert.deepEqual(Array.from(a.slice(4*i,4*i+4)),[h,l,Math.fround(r.bandAxisYaw),v]);
   }
  }
  let n=0;const on=()=>{n++;};art.addEventListener('dispose',on);
  const originalVersion=art.source.version;
  assert.equal(t.material.uniforms.stockLeafArt.value,art);
  t.dispose();assert.equal(t.group.parent,null);assert.equal(n,0);
  assert.equal(art.source.version,originalVersion);
  art.removeEventListener('dispose',on);
 }
});
test('bad/double/reseated rows and wrong stock world light are refused',()=>{
 const r=q.county.kings.rows[0];
 assert.equal(createDetachedHedgeBand([r,r],sun,art),undefined);
 assert.equal(createDetachedHedgeBand([{...r,closureM:-.01}],sun,art),undefined);
 assert.equal(createDetachedHedgeBand([{...r,coords:[r.coords[0],Math.fround(r.coords[1]+.03),r.coords[2]]}],sun,art),undefined);
 assert.equal(createDetachedHedgeBand([r],new T.Vector3(1,1,1),art),undefined);
});
