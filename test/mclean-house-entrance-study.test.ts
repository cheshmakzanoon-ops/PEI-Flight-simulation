import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createMcLeanPrincipalHistoricStudy as previous} from '../tools/art/mclean-house-roof-study/mclean-principal-body.ts';
import {createMcLeanEntranceTransomStudy as make} from '../tools/art/mclean-house-roof-study/mclean-entrance-transom.ts';
const f=name=>new URL(name,import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const B=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const keys=['position','normal','color','mcHouseBoard','mcHouseKind'];
const pos=(m,i)=>new T.Vector3().fromBufferAttribute(m.geometry.attributes.position,i);
const key=p=>B(new Float32Array(p.toArray())).toString('hex');
const allowed={near:[7392,80],mid:[5916,48]};
export const cameras=[
 ['front',[27,2.2,10],[2.12,-4.5,3.65]],
 ['corner',[24.8,2.8,-10.1],[2.12,-4.5,3.65]]
];
function ray(m,o,n){
 return new T.Raycaster(o,n,0,100).intersectObject(m,false)[0];
}
const get=m=>new T.Vector3(...m);
test('exact old model appends four cavity pieces without touching any old float, shader or visual role',()=>{
 for(const [p,k]of Object.entries({
  '../tools/art/mclean-house-roof-study/mclean-principal-body.ts':'3ca7ee8d91cf120a4988a632b7d2032c07e4a44a9dd664fb372624a464d9fbd2',
  '../tools/art/mclean-house-roof-study/mclean-historic-bell-study.ts':'108373e3fa33ab0cbd85c4d8224fdd0aceb06c2bcde61b0fd075f6670335f18f',
  '../tools/art/mclean-house-roof-study/mclean-upper-hip.generated.ts':'40e5b8bb4f031cb06a1e7d7b1017aaf683225a1cbf15eb0db166b4df036f68d7',
 }))assert.equal(sha(readFileSync(f(p))),k);
 for(const q of ['near','mid']){
  const s=make(q),o=previous(q),[count,tri]=allowed[q];
  const g=s.body.geometry,v=o.body.geometry;
  assert.deepEqual(Object.keys(g.attributes),keys);
  assert.equal(g.attributes.position.count,count+tri*3);
  assert(s.active.doorAndHoodUnchanged&&s.active.noOuterTrimChange&&!s.active.gradeOrThresholdSiteAuthority&&s.active.detached);
  assert.equal(s.oldVertexCount,count);assert.equal(s.barRanges.length,4);
  assert.equal(s.barRanges[0][0],count);assert.equal(s.barRanges.at(-1)[1],g.attributes.position.count);
  for(const k of keys){
   const a=g.attributes[k],c=v.attributes[k],n=c.itemSize*c.count;
   assert.equal(a.itemSize,c.itemSize);assert.strictEqual(a.usage,c.usage);
   assert.deepEqual(B(a.array.subarray(0,n)),B(c.array));
  }
  const ma=s.body.material,mb=o.body.material;
  assert(!ma.transparent&&ma.depthWrite&&ma.depthTest&&ma.type===mb.type&&ma.customProgramCacheKey()===mb.customProgramCacheKey());
  const shaders=()=>({vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader});
  const n=shaders(),p=shaders();ma.onBeforeCompile(n,undefined);mb.onBeforeCompile(p,undefined);assert.deepEqual(n,p);
  for(const [k,x]of Object.entries(o.roof.geometry.attributes))
   assert.deepEqual(B(s.roof.geometry.attributes[k].array),B(x.array));
  assert.deepEqual(s.loft,o.loft);
  assert.deepEqual(g.boundingBox,v.boundingBox);
  assert(!g.index&&!g.groups.length&&!s.body.castShadow&&!s.body.receiveShadow);
  s.close();o.close();
 }
});
test('near and mid true closed beveled or plain rails are strictly in the original glass rect and far behind the unchanged hood',()=>{
 for(const q of ['near','mid']){
  const s=make(q),v=s.body.geometry,X=s.frame,N=get(X.outwardNormal),T0=get(X.tangentialAxis),A=get(X.origin);
  const kind=v.attributes.mcHouseKind;const color=new T.Vector3().fromBufferAttribute(v.attributes.color,s.priorHood[0]);
  const sub=p=>p.clone().sub(A),l=X.glassWidth;
  for(const [a,b]of s.barRanges){
   const V=new Set(),E=new Map(),us=[];
   let volume=0;
   for(let i=a;i<b;i+=3){
    const p=[0,1,2].map(j=>pos(s.body,i+j));
    const n=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    assert(n.length()>1e-6);n.normalize();
    for(let j=0;j<3;j++){
     const v0=p[j],x=sub(v0),u=T0.dot(x),d=N.dot(x);
     const c=key(v0),b=key(p[(j+1)%3]),k=[c,b].sort().join('|');
     V.add(c);E.set(k,[...(E.get(k)??[]),c<b]);us.push(u);
     assert(kind.getX(i+j)===2&&new T.Vector3().fromBufferAttribute(v.attributes.color,i+j).equals(color));
     assert(u>.30&&u<l-.30&&d>-.006001&&d<.020001&&v0.y>=X.origin[1]+.016999&&v0.y<X.origin[1]+X.glassHeight-.016999);
     assert(new T.Vector3().fromBufferAttribute(v.attributes.normal,i+j).dot(n)>.999999);
    }
    volume+=p[0].dot(p[1].clone().cross(p[2]))/6;
   }
   assert(volume>0&&V.size-E.size+(b-a)/3===2);
   assert([...E.values()].every(p=>p.length===2&&p[0]!==p[1]));
   assert(Math.abs(Math.max(...us)-Math.min(...us)-.032)<2e-6);
  }
  s.close();
 }
});
test('each divider and all five residual lights actually win a Three first-hit ray; unchanged neighboring opening',()=>{
 for(const q of ['near','mid']){
  const a=previous(q),b=make(q),Z=b.frame,T0=get(Z.tangentialAxis),N=get(Z.outwardNormal),axis=N.clone().negate(),O=get(Z.origin);
  const at=(u,y)=>O.clone().addScaledVector(T0,u).addScaledVector(N,12).setY(y);
  const ht=O.y+Z.glassHeight*.45;
  for(let j=1;j<5;j++){
   const t=j*Z.glassWidth/5,first=ray(a.body,at(t,ht),axis),next=ray(b.body,at(t,ht),axis);
   assert(first&&next&&first.face.a>=b.priorGlass[0]&&first.face.a<b.priorGlass[1]);
   assert(next.face.a>=b.barRanges[j-1][0]&&next.face.a<b.barRanges[j-1][1]);
   assert(Math.abs(next.point.clone().sub(first.point).dot(N)-.02)<1e-6);
  }
  for(let j=0;j<5;j++){
   const t=(j+.5)*Z.glassWidth/5,p=at(t,ht),first=ray(a.body,p,axis),next=ray(b.body,p,axis);
   assert(first&&next&&first.point.equals(next.point)&&first.faceIndex===next.faceIndex);
   assert(first.face.a>=b.priorGlass[0]&&first.face.a<b.priorGlass[1]);
  }
  for(const [u,y]of[[Z.glassWidth*.5,-7.55],[Z.glassWidth*.5,-6.346],[.18,-7.45]]){
   const p=at(u,y),old=ray(a.body,p,axis),changed=ray(b.body,p,axis);
   assert(old&&changed&&old.point.equals(changed.point)&&old.faceIndex===changed.faceIndex);
  }
  a.close();b.close();
 }
});
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function project(m,c){
 const v=m.clone().project(c);return [(v.x+1)*600,(1-v.y)*400];
}
export function camera(p,t){
 const c=new T.PerspectiveCamera(38,1200/800,.05,155);c.position.set(...p);c.lookAt(...t);c.updateMatrixWorld(true);
 return c;
}
test('real existing neutral studio front and corner optical bounds keep every new projection inside the old pane',()=>{
 const r=make(),M=r.body;
 for(const [label,p,t]of cameras){
  const C=camera(p,t),[start]=r.priorGlass,Q=[0,1,2,5].map(i=>project(pos(M,start+i),C)),sg=Math.sign(cross(Q[0],Q[1],Q[2]));
  assert(sg!==0);
  for(const [lo,hi]of r.barRanges){
   const newPoints=Array.from({length:hi-lo},(_,i)=>project(pos(M,lo+i),C));
   let margin=Infinity;
   for(const at of newPoints)for(let i=0;i<4;i++){
    const a=Q[i],b=Q[(i+1)%4];margin=Math.min(margin,cross(a,b,at)*sg/dist(a,b));
   }
   assert(margin>.18,label+' '+margin);
   assert(Math.max(...newPoints.map(q=>q[1]))-Math.min(...newPoints.map(q=>q[1]))>17);
  }
 }
 r.close();
});
test('refuses any unsupported tier and disposes exactly once without changing another study',()=>{
 assert.throws(()=>make('other'),/quality/);
 const a=previous(),b=make(),s=new T.Scene();s.add(a.group,b.group);
 let old=0,re=0;a.body.geometry.addEventListener('dispose',()=>old++);b.body.geometry.addEventListener('dispose',()=>re++);
 b.close();b.close();assert.deepEqual(s.children,[a.group]);assert.equal(old,0);assert.equal(re,1);a.close();
});
