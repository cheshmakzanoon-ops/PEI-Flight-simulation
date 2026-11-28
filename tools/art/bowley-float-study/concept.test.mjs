import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import * as T from 'three';
import {makeBowleyFloatConcept as build,BOWLEY_SECTION as s} from './bowley-float-concept.ts';
const near=(a,b,t=1e-7)=>assert(Math.abs(a-b)<t,[a,b]);
const sameword=(a,b)=>assert.deepEqual([...a],[...b]);
const sha=(a)=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const intersection=(a,b)=>a.hi.map((v,i)=>Math.min(v,b.hi[i])-Math.max(a.lo[i],b.lo[i]));
const contains=(a,p,pad=0)=>p.every((v,i)=>v>=a.lo[i]+pad&&v<=a.hi[i]-pad);
const solidContains=(a,xyz)=>{
 const d=xyz.map((x,i)=>Math.min(x-a.lo[i],a.hi[i]-x));
 return Math.min(...d)>.0003&&Math.min(d[0]+d[1],d[1]+d[2],d[2]+d[0])>a.bevel+.0003
   &&d.reduce((x,y)=>x+y)>2*a.bevel+.0003;
};
const joined=(p,q)=>{
 const witness=p.lo.map((a,j)=>(Math.max(a,q.lo[j])+Math.min(p.hi[j],q.hi[j]))*.5);
 return solidContains(p,witness)&&solidContains(q,witness);
};
test('only the two nominal 2015 sections; local deck datum and authored module bounds',()=>{
 const q=build(), parts=q.members;
 const [a,b]=[parts.find(p=>p.name==='left:handrail'),parts.find(p=>p.name==='right:handrail')];
 near(b.lo[0]-a.hi[0],1.830);near(a.hi[1],1.070);near(b.hi[1],1.070);
 const deck=parts.filter(p=>p.role===0);
 assert.equal(deck.length,38);assert(deck.every(p=>p.hi[1]===0));
 near(deck[0].lo[2],-3.30);near(deck.at(-1).hi[2],3.30);
 near(q.geometry.boundingBox.max.y,s.nominal2015RailTopM);
 near(q.geometry.boundingBox.min.y,-.4);near(q.geometry.boundingBox.max.z,3.3);
 assert(q.mesh.parent===null&&q.mesh.children.length===0);
 assert.deepEqual(q.mesh.position.toArray(),[0,0,0]);assert.deepEqual(q.mesh.scale.toArray(),[1,1,1]);q.dispose();
});
test('indexed Float32 geometry, opaque state, exact directed positional closure per real member',()=>{
 const q=build(),g=q.geometry,n=g.attributes.normal.array,p=g.attributes.position.array,e=g.index.array,r=g.attributes.sectionRole.array;
 assert.equal(q.members.length,76);assert.equal(e.length/3,3216);assert.equal(g.attributes.position.count,6912);
 assert(e instanceof Uint16Array);
 assert([...n,...p,...e,...r,...g.attributes.uv.array].every(Number.isFinite));
 let k=0,minimum=Infinity;
 for(const m of q.members){
   assert.equal(m.start,k);assert.equal(m.end%3,0);assert(m.end>k);
   const edges=new Map();
   const key=i=>p.subarray(i*3,i*3+3).join(',');
   for(;k<m.end;k+=3){
     const inds=[e[k],e[k+1],e[k+2]];
     assert(inds.every(i=>i<g.attributes.position.count&&r[i]===m.role));
     assert(new Set(inds).size===3);
     const pts=inds.map(i=>new T.Vector3().fromArray(p,i*3)),normal=new T.Vector3().fromArray(n,inds[0]*3);
     const v=pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0]));
     minimum=Math.min(minimum,v.length()*.5);assert(v.length()>.000001);
     assert(v.normalize().dot(normal)>.999995);
     for(let i=0;i<3;i++){
       const a=key(inds[i]),b=key(inds[(i+1)%3]);assert.notEqual(a,b);
       const id=a<b?a+';'+b:b+';'+a,t0=edges.get(id)??[0,0];
       t0[0]++;t0[1]+=a<b?1:-1;edges.set(id,t0);
     }
   }
   assert([...edges.values()].every(([count,w])=>count===2&&w===0),m.name);
 }
 assert.equal(k,e.length);
 assert(minimum>1e-6);near(q.geometry.attributes.color.normalized?1:0,1);
 assert(q.geometry.attributes.sectionRole.array instanceof Uint8Array);
 assert.equal(q.geometry.groups.length,0);assert(!Array.isArray(q.mesh.material));
 assert.equal(q.material.side,T.FrontSide);assert.equal(q.material.blending,T.NoBlending);
 assert(q.material.depthTest&&q.material.depthWrite&&!q.material.transparent);
 assert(!q.mesh.castShadow&&!q.mesh.receiveShadow);q.dispose();
});
test('authored joinery is seated: planks/frame, posts/fascia, cables/posts and casing/sills',()=>{
 const q=build(),m=Object.fromEntries(q.members.map(a=>[a.name,a]));
 const z0=s.authoredPostCentresM[0],z1=s.authoredPostCentresM.at(-1);
 const deck=q.members.filter(a=>a.role===0);
 for(const p of deck){
   assert(intersection(p,m['joist:1']).every(h=>h>.01),p.name);
   assert(joined(p,m['joist:1'])&&joined(p,m['joist:2']),p.name);
 }
 for(const sign of ['left','right']){
   const r=m[sign+':handrail'],f=m[sign+':fascia'];
   for(let i=0;i<7;i++){
     const post=m[sign+':post:'+i];
     assert(intersection(post,r).every(h=>h>.04));
     assert(joined(post,r)&&joined(post,f));
   }
   for(let i=0;i<4;i++){
     const c=m[sign+':cable:'+i],x=(c.lo[0]+c.hi[0])*.5,y=(c.lo[1]+c.hi[1])*.5;
     for(const [j,z] of s.authoredPostCentresM.entries()){
       assert(contains(m[sign+':post:'+j],[x,y,z],.04));
       assert(z>=z0&&z<=z1);
     }
   }
   for(let i=0;i<4;i++)assert(joined(m[sign+':illustrative-shallow-cassette'],m['underslung-sill:'+i]));
 }
 const gaps=deck.slice(1).map((p,i)=>p.lo[2]-deck[i].hi[2]);
 assert(Math.min(...gaps)>.0045&&Math.max(...gaps)<.0066);
 q.dispose();
});
test('one original mipmapped lookup, actual byte/triangle budgets, exact deterministic words',()=>{
 const a=build(),b=build();
 const hash=Object.fromEntries(Object.entries(a.geometry.attributes).map(([k,v])=>[k,sha(v.array)]));
 for(const [k,v] of Object.entries(b.geometry.attributes))assert.equal(sha(v.array),hash[k]);
 assert.equal(sha(a.geometry.index.array),sha(b.geometry.index.array));
 const x=a.grain.image,y=b.grain.image;
 assert.equal(sha(x.data),sha(y.data));
 assert(x.width===256&&x.height===64&&x.data.byteLength===65536);
 assert.equal(a.grain.format,T.RGBAFormat);assert.equal(a.grain.type,T.UnsignedByteType);
 assert.equal(a.grain.colorSpace,T.NoColorSpace);assert(a.grain.generateMipmaps&&!a.grain.flipY);
 assert.equal(a.grain.minFilter,T.LinearMipmapLinearFilter);
 let gm=0;
 for(let w=x.width,h=x.height;w>=1&&h>=1;w=Math.floor(w/2),h=Math.floor(h/2)){
   gm+=w*h*4;if(w===1&&h===1)break; if(w===1)w=2;if(h===1)h=2;
 }
 assert.equal(gm,87388);assert(gm<=s.gpuTextureLimitBytes);
 const bytes=Object.values(a.geometry.attributes).reduce((v,k)=>v+k.array.byteLength,0)+a.geometry.index.array.byteLength;
 assert.equal(bytes,268128);assert(bytes<=s.geometryLimitBytes);
 assert(a.geometry.index.count/3<=s.triangleLimit);
 assert(a.material.uniforms.bGrain.value===a.grain&&b.material.uniforms.bGrain.value===b.grain);
 assert(a.grain!==b.grain&&a.geometry!==b.geometry&&a.material!==b.material);
 assert(new Set(x.data.filter((v,i)=>i%4===0)).size>20);
 a.dispose();b.dispose();
});
test('dispose is local, idempotent and does not need an installed scene',()=>{
 const a=build(),b=build(),ctr=[0,0,0,0];
 for(const [i,o] of [a.grain,a.geometry,a.material,b.geometry].entries())
   o.addEventListener('dispose',()=>ctr[i]++);
 a.dispose();a.dispose();assert.deepEqual(ctr,[1,1,1,0]);
 b.dispose();assert.deepEqual(ctr,[1,1,1,1]);
});
