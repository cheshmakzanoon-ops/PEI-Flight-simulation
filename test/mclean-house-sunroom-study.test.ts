import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createMcLeanEastSunroomSection as make,MCLEAN_SUNROOM_ROLE as R} from '../tools/art/mclean-house-roof-study/mclean-east-sunroom-study.ts';
import {MCLEAN_SUNROOM_INNER as M} from '../tools/art/mclean-house-roof-study/mclean-east-sunroom-roof.generated.ts';
import {createMcLeanPrincipalHistoricStudy as old} from '../tools/art/mclean-house-roof-study/mclean-principal-body.ts';
import {createMcLeanFrontDormerStudy as prior} from '../tools/art/mclean-house-roof-study/mclean-front-dormer-study.ts';
const bytes=x=>Buffer.from(x.buffer,x.byteOffset,x.byteLength),sha=b=>createHash('sha256').update(b).digest('hex');
const file=s=>new URL(s,import.meta.url),read=s=>readFileSync(file(s));
const frozen={
 '../tools/art/mclean-house-roof-study/mclean-east-sunroom-roof.generated.ts':'4235c07a70ba8f319a43d087e0f6d816d3701e422f5b49683df2da3d258389ce',
 '../tools/art/mclean-house-roof-study/mclean-principal-body.ts':'3ca7ee8d91cf120a4988a632b7d2032c07e4a44a9dd664fb372624a464d9fbd2',
 '../tools/art/mclean-house-roof-study/mclean-historic-bell-study.ts':'108373e3fa33ab0cbd85c4d8224fdd0aceb06c2bcde61b0fd075f6670335f18f',
 '../tools/art/mclean-house-roof-study/mclean-front-dormer-study.ts':'cfbe149d6ac47cdc9d93f75b3dbad228e61577ea9bd74edf8f832ff4c89fed2b'
};
const [a,b,c,d]=M.vertices;
const slopeX=(b[1]-a[1])/(b[0]-a[0]),slopeZ=(d[1]-a[1])/(d[2]-a[2]);
const Y=(x,z)=>a[1]-M.renderCutY+(x-a[0])*slopeX+(z-a[2])*slopeZ;
function P(g,i){return new T.Vector3().fromBufferAttribute(g.attributes.position,i);}
const V=(q,n)=>q[n];
const sig=m=>Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,a])=>[k,sha(bytes(a.array))]));
const tag=(h,n='mcSunroomRole')=>h.object.geometry.attributes[n].getX(h.face.a);
const near=(p,q,t=1e-6)=>assert(Math.abs(p-q)<t,JSON.stringify([p,q,t]));

test('exact source custody, roof top F32 and no implicit floor, join or site permission',()=>{
 for(const [f,s]of Object.entries(frozen))assert.equal(sha(read(f)),s);
 for(const tier of ['near','mid']){
  const S=make(tier),p=S.wood.geometry.getAttribute('position'),fit=S.wood.geometry.getAttribute('mcSunroomRole');
  assert(!S.root.parent&&S.scope.roofOnlyMeasured&&S.scope.roofEdgeIsNotObservedEave&&S.scope.noFloorOrSiteJoin&&S.scope.noCompleteFootprint&&Object.isFrozen(S.scope));
  const expected=new Float32Array([0,3,2,0,2,1].flatMap(k=>[M.vertices[k][0],M.vertices[k][1]-M.renderCutY,M.vertices[k][2]]));
  assert.deepEqual(bytes(p.array.slice(0,18)),bytes(expected));
  for(let i=0;i<fit.count;i++)assert(fit.getX(i)!==R.roofSurface||i<6);
  for(const q of [S.wood,S.glass]){
   const p=q.geometry.attributes.position;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),w=Y(x,z);
    assert(x>=a[0]-1e-6&&x<=c[0]+1e-6&&z>=a[2]-1e-6&&z<=c[2]+1e-6);
    assert(y<=w+1e-6&&y>=S.layout.cutApronBottom-1e-6);
   }
  }
  S.close();
 }
});
test('actual opaque independent primitives positive, closed F32, overlap roof only behind its original top',()=>{
 const S=make(),g=S.wood.geometry,p=g.attributes.position,parts=g.attributes.mcSunroomJoint,N=g.attributes.normal,all=new Map();
 for(let i=0;i<p.count;i+=3){
  const id=parts.getX(i),tri=[P(g,i),P(g,i+1),P(g,i+2)], [q,r,s]=tri;
  if(!all.has(id))all.set(id,{V:new Set(),E:new Map(),F:0,X:0});
  const raw=r.clone().sub(q).cross(s.clone().sub(q));
  assert(raw.length()>.00004);raw.normalize();
  const k=all.get(id);k.F++;k.X+=q.dot(r.clone().cross(s))/6;
  for(let i0=0;i0<3;i0++){
   assert(parts.getX(i+i0)===id);
   const e=bytes(new Float32Array(tri[i0].toArray())).toString('hex');
   const f=bytes(new Float32Array(tri[(i0+1)%3].toArray())).toString('hex');
   const key=[e,f].sort().join('|');
   k.E.set(key,[...(k.E.get(key)??[]),e<f]);k.V.add(e);
   const n=new T.Vector3().fromBufferAttribute(N,i+i0);
   assert(n.dot(raw)>.99999&&Math.abs(n.length()-1)<1e-6);
  }
 }
 for(const [id,e]of all){
  assert.equal(e.V.size-e.E.size+e.F,2,'joint '+id);
  assert([...e.E.values()].every(k=>k.length===2&&k[0]!==k[1]),'joint '+id);
  assert(e.X>0,'joint '+id);
 }
 assert.equal(all.size,S.opaqueTriangles/12);
 const findTop=(x,z)=>new T.Raycaster(new T.Vector3(x,0,z),new T.Vector3(0,-1,0)).intersectObject(S.wood,false)[0];
 for(const x of [.8,1.027,2,3.125,4.31])for(const z of [-5.15,-4.79,-4.32,-3.42,-2.55]){
  const h=findTop(x,z);assert(h);
  near(h.point.y,Y(x,z));assert.equal(tag(h),R.roofSurface);
 }
 const bottomRear=new T.Raycaster(new T.Vector3(2.6,-13,-3.38),new T.Vector3(0,1,0)).intersectObjects([S.wood,S.glass],false)[0];
 assert(bottomRear&&tag(bottomRear)===R.roofUnder);near(bottomRear.point.y,Y(2.6,-3.38)-.076);
 S.close();
});
const cross=(a,b,s)=>(b[0]-a[0])*(s[1]-a[1])-(b[1]-a[1])*(s[0]-a[0]);
const signedArea=q=>q.reduce((a,p,i)=>i>1?a+.5*cross(q[0],q[i-1],p):a,0);
function overlap(pp,re){
 let P=pp;
 const sign=Math.sign(signedArea(re));assert(sign);
 for(let j=0;j<3;j++){
  const a=re[j],b=re[(j+1)%3],z=[];
  for(let i=0;i<P.length;i++){
   const x=P[i],y=P[(i+1)%P.length],u=cross(a,b,x)*sign,v=cross(a,b,y)*sign;
   if(u>=0)z.push(x);
   if((u<0)!==(v<0)){const q=u/(u-v);z.push([x[0]+q*(y[0]-x[0]),x[1]+q*(y[1]-x[1])]);}
  }
  P=z;if(P.length<3)return 0;
 }
 return Math.abs(signedArea(P));
}
test('one disjoint submitted glass plane, true four-light cut and colors in the two flank transoms only',()=>{
 for(const tier of ['near','mid']){
  const S=make(tier),g=S.glass.geometry,p=g.attributes.position,parts=new Set(),Tess=[],areas=[0,0];
  for(let i=0;i<p.count;i+=3){
   const q=[0,1,2].map(j=>P(g,i+j)),t=g.attributes.mcSunroomTint.getX(i),id=g.attributes.mcSunroomPane.getX(i);
   assert(q.every((v,j)=>g.attributes.mcSunroomTint.getX(i+j)===t&&g.attributes.mcSunroomPane.getX(i+j)===id&&v.z===Math.fround(S.layout.paneZ)));
   if(t===1)assert(q.every(v=>v.y>=S.layout.transomLow-1e-6&&v.y<=S.layout.transomHigh+1e-6));
   if(t===1)assert(q.every(v=>v.x<S.layout.screenSpans[1]||v.x>S.layout.screenSpans[2]));
   const xy=q.map(v=>[v.x,v.y]),measure=Math.abs(signedArea(xy));assert(measure>.002);
   Tess.push(xy);areas[t]+=measure;parts.add(id);
  }
  assert.equal(Tess.length,46);assert.equal(parts.size,27);
  for(let i=0;i<Tess.length;i++)for(let j=i+1;j<Tess.length;j++)assert(overlap(Tess[i],Tess[j])<2e-10);
  assert(areas[0]>3.29&&areas[0]<3.52);assert(areas[1]>.55&&areas[1]<.59);
  const sample=(x,y,objects=[S.glass,S.wood])=>new T.Raycaster(new T.Vector3(x,y,-7),new T.Vector3(0,0,1)).intersectObjects(objects,false)[0];
  const L=S.layout;
  for(let i=0;i<3;i++){
   const x=L.screenSpans[i]+.25,y=L.glassMainSill+.26;
   const ray=sample(x,y);
   assert(ray&&ray.object===S.glass&&tag(ray)===R.clear);
   assert(!sample(x,y,[S.wood])); // no opaque substitute in any sample of the three actual apertures
   const t=sample(x,(L.transomLow+L.transomHigh)*.5,[S.glass]);
   assert(t&&tag(t,'mcSunroomTint')===(i===1?0:1));
  }
  const stud=sample(L.screenSpans[1],L.glassMainSill+.19);
  assert(stud&&stud.object===S.wood&&tag(stud)===R.timber);
  assert(!sample(L.screenSpans[0]+.22,L.cutApronBottom-.025));
  S.close();
 }
});
test('keeps all stock-study identities untouched and transparent cohort only own buffer',()=>{
 assert.throws(()=>make('None'),/quality/);
 const f=make('near'),med=make('mid'),P=old(),D=prior();P.group.add(D.mesh);
 const state=P.group.children.map(b=>[b,b.material,b.geometry,sig(b)]);
 assert.equal(f.opaqueTriangles,480);assert.equal(med.opaqueTriangles,336);
 assert.equal(f.glassTriangles,46);assert.equal(med.glassTriangles,46);
 assert.deepEqual(f.wood.geometry.boundingBox,med.wood.geometry.boundingBox);
 const gm=f.glass.material,wm=f.wood.material;
 assert(gm.isMeshStandardMaterial&&gm.transparent&&gm.forceSinglePass&&gm.depthTest&&!gm.depthWrite&&gm.side===T.DoubleSide);
 assert(gm.opacity===.32&&gm.blending===T.NormalBlending&&!gm.premultipliedAlpha&&gm.alphaTest===0&&!gm.alphaToCoverage);
 assert(wm.isMeshStandardMaterial&&!wm.transparent&&wm.depthWrite&&wm.depthTest&&wm.side===T.FrontSide);
 for(const m of [f.glass,f.wood])assert(!m.geometry.index&&!m.geometry.groups.length&&!m.material.map&&!m.material.envMap&&!m.material.normalMap&&!m.castShadow&&!m.receiveShadow);
 assert.equal(f.root.children.length,2);assert(!f.root.parent);
 // Add only to an isolated comparative scene; no replacement or visibility change.
 const s=new T.Scene();s.add(P.group,f.root);
 for(const [obj,m,g,data]of state){assert(obj.material===m&&obj.geometry===g&&obj.parent===P.group);assert.deepEqual(sig(obj),data);}
 let disposed=0;
 for(const x of [f.wood,f.glass]){x.geometry.addEventListener('dispose',()=>disposed++);x.material.addEventListener('dispose',()=>disposed++);}
 f.close();f.close();assert.equal(disposed,4);assert.deepEqual(s.children,[P.group]);
 for(const [obj,m,g,data]of state){assert(obj.material===m&&obj.geometry===g&&obj.parent===P.group);assert.deepEqual(sig(obj),data);}
 med.close();D.close();P.close();
});
test('literal Three alpha variant only on one plane, no source textures or rejection changes',()=>{
 const f=make(),g=f.glass.material,o=f.wood.material;
 const pair=()=>({vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader});
 const edited=pair(),plain=pair();g.onBeforeCompile(edited,undefined);o.onBeforeCompile(plain,undefined);
 assert(edited.fragmentShader.includes('diffuseColor=mcSunroomPane(diffuseColor,normal,vViewPosition,mcGuv,mcGtint)'));
 assert(edited.fragmentShader.indexOf('#include <normal_fragment_begin>')<edited.fragmentShader.indexOf('diffuseColor=mcSunroomPane'));
 assert(!edited.fragmentShader.includes('gl_FragDepth')&&!edited.fragmentShader.includes('discard;')&&!edited.fragmentShader.includes('texture2D('));
 assert.deepEqual(plain,pair());const bad=pair();bad.fragmentShader=bad.fragmentShader.replace('#include <normal_fragment_begin>','');
 const before={...bad};g.onBeforeCompile(bad,undefined);assert.deepEqual(before,bad);
 for(const m of [0,1])for(const F of [0,1])for(const up of [0,1]){
  const v=(m===0?.19:.54)+(.14-.062*m)*F+.022*up;
  assert(v>=.19&&v<=.64+1e-8);
 }
 f.close();
});
