import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import * as T from 'three';
import {MCLEAN_UPPER_HIP as hip} from '../tools/art/mclean-house-roof-study/mclean-upper-hip.generated.ts';
import {createMcLeanFrontDormerStudy as make,MCLEAN_DORMER_ROLE as roles} from '../tools/art/mclean-house-roof-study/mclean-front-dormer-study.ts';
import {createMcLeanHistoricBellStudy as priorRoof,MCLEAN_BELL_ROLE as br} from '../tools/art/mclean-house-roof-study/mclean-historic-bell-study.ts';
import {createMcLeanPrincipalHistoricStudy as priorHouse} from '../tools/art/mclean-house-roof-study/mclean-principal-body.ts';
const h=b=>createHash('sha256').update(b).digest('hex');
const byte=x=>Buffer.from(x.buffer,x.byteOffset,x.byteLength);
const file=n=>new URL(n,new URL('../tools/art/mclean-house-roof-study/',import.meta.url)),read=n=>readFileSync(file(n));
const exact=Object.freeze({
 'mclean-upper-hip.generated.ts':'40e5b8bb4f031cb06a1e7d7b1017aaf683225a1cbf15eb0db166b4df036f68d7',
 'mclean-historic-bell-study.ts':'108373e3fa33ab0cbd85c4d8224fdd0aceb06c2bcde61b0fd075f6670335f18f',
 'mclean-principal-body.ts':'3ca7ee8d91cf120a4988a632b7d2032c07e4a44a9dd664fb372624a464d9fbd2'
});
const overlapShaderHash=m=>Object.entries(m.geometry.attributes).map(([a,b])=>[a,b.count,b.itemSize,b.normalized,h(byte(b.array))]);
const A=new T.Vector3(hip.vertices[1][0],0,hip.vertices[1][2]),B=new T.Vector3(hip.vertices[2][0],0,hip.vertices[2][2]);
const L=B.distanceTo(A),v=B.clone().sub(A).normalize(),n=new T.Vector3(v.z,0,-v.x),Y=new T.Vector3(0,1,0);
const C=(s,y,d)=>A.clone().addScaledVector(v,s).addScaledVector(Y,y).addScaledVector(n,d);
const inv=p=>{const delta=p.clone().sub(A);return [v.dot(delta),p.y,n.dot(delta)];};
const rl=(o,dir,objects)=>new T.Raycaster(o,dir,.0001,100).intersectObjects(objects,false);
const front=(s,y,objs)=>rl(C(s,y,20),n.clone().negate(),objs);
const rear=(s,y,objs)=>rl(C(s,y,-20),n.clone(),objs);
const mat=m=>m.material;
const a=(g,name,j)=>g.getAttribute(name).getX(j);
const role=(hit,name)=>a(hit.object.geometry,name,hit.face.a);
const pos=(g,j)=>new T.Vector3().fromBufferAttribute(g.getAttribute('position'),j);
const key=p=>byte(new Float32Array(p.toArray())).toString('hex');

test('sealed body/roof constants; isolated object owns one inactive opaque material',()=>{
 for(const [p,sha]of Object.entries(exact))assert.equal(h(read(p)),sha);
 assert.throws(()=>make('fake'),/tier/);
 for(const [tier,tri] of [['near',848],['mid',496]]){
  const r=make(tier),m=r.mesh,g=m.geometry,mt=mat(m);
  assert(!m.parent&&!r.scope.placement&&!r.scope.stockMask&&!r.scope.seat&&!r.scope.addedGeometryMeasured);
  assert(r.scope.exclusivelyBelowMeasuredCap&&Object.isFrozen(r.scope)&&r.triangles===tri);
  assert(m.isMesh&&mt.type==='MeshStandardMaterial'&&mt.opacity===1&&mt.depthTest&&mt.depthWrite&&mt.side===T.FrontSide);
  assert(g.index===null&&!g.groups.length&&!mt.transparent&&!mt.map&&!mt.normalMap&&!mt.envMap&&!m.castShadow&&!m.receiveShadow);
  assert.equal(r.spans.length,2);
  const vs=g.getAttribute('position').count;assert.deepEqual(r.spans,[[0,vs/2],[vs/2,vs]]);
  assert.equal(vs,3*tri);assert(g.boundingBox.max.y<-.09);
  const s=new T.Scene();s.add(m);let count=0;
  m.geometry.addEventListener('dispose',()=>count++);mt.addEventListener('dispose',()=>count++);
  r.close();r.close();assert.equal(count,2);assert(!s.children.length);
 }
});
test('each attached sub-part is a closed oriented packed 2-manifold, separate paired silhouettes',()=>{
 const boxes=[];
 for(const tier of ['near','mid']){
  const r=make(tier),g=r.mesh.geometry,M=new Map(),bounds=[[Infinity,-Infinity],[Infinity,-Infinity]],counts=Array(10).fill(0),normal=g.attributes.normal;
  for(let i=0;i<g.attributes.position.count;i+=3){
   const j=a(g,'mcDormerId',i),component=a(g,'mcDormerPart',i),material=a(g,'mcDormerRole',i),kk=j+':'+component;
   assert(j===1||j===2);counts[material]++;
   const pp=[pos(g,i),pos(g,i+1),pos(g,i+2)], [p,q,r]=pp;
   const unit=q.clone().sub(p).cross(r.clone().sub(p));assert(unit.length()>.00003);unit.normalize();
   if(!M.has(kk))M.set(kk,{V:new Set,E:new Map,F:0,Y:0});
   const mm=M.get(kk);mm.F++;mm.Y+=p.dot(q.clone().cross(r))/6;
   for(let j0=0;j0<3;j0++){
    assert.equal(a(g,'mcDormerId',i+j0),j);assert.equal(a(g,'mcDormerPart',i+j0),component);assert.equal(a(g,'mcDormerRole',i+j0),material);
    const k=key(pp[j0]),b=key(pp[(j0+1)%3]),kk=[k,b].sort().join(':');
    const G=new T.Vector3().fromBufferAttribute(normal,i+j0);
    assert(Math.abs(G.length()-1)<1e-6&&G.dot(unit)>.99999);mm.V.add(k);mm.E.set(kk,[...(mm.E.get(kk)??[]),k<b]);
    const [t,y,d]=inv(pp[j0]);
    assert(t>.8&&t<L-.8&&y<-.09&&y>-1.55&&d<.85&&d>-.08);
    bounds[j-1]=[Math.min(bounds[j-1][0],t),Math.max(bounds[j-1][1],t)];
   }
  }
  for(const [label,w]of M){
   assert.equal(w.V.size-w.E.size+w.F,2,label);
   assert([...w.E.values()].every(r=>r.length===2&&r[0]!==r[1]),label);
   assert(w.Y>0,label);
  }
  assert(counts.every(k=>k>0));
  assert.equal(M.size,tier==='near'?12:10);
  assert(bounds[1][0]-bounds[0][1]>2.7);
  boxes.push([...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray()]);
  r.close();
 }
 assert.deepEqual(boxes[0],boxes[1]);
});
test('both authentic lower-bell support patches behind actual near/mid enclosure, no contact with surveyed upper hip',()=>{
 for(const tier of ['near','mid']){
  const det=make(tier),old=priorRoof(tier),g=det.mesh.geometry;
  const oldPOS=overlapShaderHash(old.mesh);
  const [mesh,roof]=[det.mesh,old.mesh];mesh.updateMatrixWorld(true);roof.updateMatrixWorld(true);
  const typ=roof.geometry.getAttribute('mcBRole'),rp=roof.geometry.attributes.position;
  assert(typ&&rp);
  for(let i=0;i<typ.count;i++)if(typ.getX(i)===br.hip)assert(rp.getY(i)>=0);
  assert(g.boundingBox.max.y<-.09&&g.boundingBox.min.y>-1.55);
  for(const c of det.scope.centresAreAuthoredFractions){
   const check=(du,y)=>{
    const s=L*c+du,o=front(s,y,[roof])[0],p=front(s,y,[mesh,roof])[0],q=rear(s,y,[mesh,roof])[0];
    assert(o&&p&&q);
    assert.equal(o.object,roof);assert.equal(role(o,'mcBRole'),br.bell);
    const [_,__,d0]=inv(o.point); assert(d0>=0&&d0<.65);
    assert.equal(q.object,roof);assert(inv(q.point)[2]<-.08);
    return {s,p,d0};
   };
   for(const dx of [-.25,0,.25])for(const y of [-1.41,-1.22,-.9,-.65])check(dx,y);
   const bottom=check(0,-1.499),cap=check(0,-.172),mid=check(.11,-1.12),arched=check(.092,-.46),trim=check(.169,-.172);
   const R='mcDormerRole';
   assert.equal(bottom.p.object,mesh);assert.equal(role(bottom.p,R),roles.sill);
   assert.equal(cap.p.object,mesh);assert.equal(role(cap.p,R),roles.keystone);
   for(const x of [mid,arched]){
    assert.equal(x.p.object,mesh);assert.equal(role(x.p,R),roles.glass);
    assert(Math.abs(inv(x.p.point)[2]-.63)<1e-6);
    assert(inv(x.p.point)[2]-x.d0>.12);
   }
   assert.equal(role(trim.p,R),roles.lightMoulding);
   assert(inv(trim.p.point)[2]-inv(mid.p.point)[2]>.175);
  }
  for(const y of [-1.,-.30]){
   const mid=front(.5*L,y,[mesh,roof])[0];assert(mid&&mid.object===roof&&role(mid,'mcBRole')===br.bell);
  }
  assert.deepEqual(overlapShaderHash(old.mesh),oldPOS);
  old.close();det.close();
 }
});
test('attaching to private principal changes no existing parent/material/stream or stock-world involvement',()=>{
 const a=priorHouse(),b=make();
 const before=a.group.children.map(p=>[p,mat(p),p.geometry,overlapShaderHash(p)]);
 const scene=new T.Scene();
 assert(!a.group.parent&&!b.mesh.parent);a.group.add(b.mesh);
 for(let j=0;j<2;j++){
  const [obj,m,g,data]=before[j];
  assert(a.group.children[j]===obj&&obj.geometry===g&&mat(obj)===m);
  assert.deepEqual(overlapShaderHash(obj),data);
 }
 b.close();assert.equal(a.group.children.length,2);assert(!scene.children.length);
 for(const [obj,m,g,data]of before){assert(obj.parent===a.group&&obj.geometry===g&&mat(obj)===m);assert.deepEqual(overlapShaderHash(obj),data);}
 a.close();
});
test('single material injects only role-local window optics; malformed anchors remain literal stock PBR',()=>{
 const p=make(),m=p.mesh.material;
 const candidates=()=>({vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader});
 const stock=candidates(),copy=candidates();
 m.onBeforeCompile(copy,undefined);
 assert(copy.vertexShader.includes('attribute vec2 mcDormerOptics;'));
 assert(copy.fragmentShader.includes('if(mcDIsPane)diffuseColor.rgb=mcDPane'));
 assert(copy.fragmentShader.includes('if(mcDIsPane)roughnessFactor=.58;'));
 assert(!copy.fragmentShader.includes('gl_FragDepth')&&!copy.fragmentShader.includes('discard;')&&!copy.fragmentShader.includes('texture2D('));
 assert.deepEqual(candidates(),stock);
 const broken=candidates();broken.fragmentShader=broken.fragmentShader.replace('#include <color_fragment>','');
 const copyB={...broken};m.onBeforeCompile(broken,undefined);assert.deepEqual(broken,copyB);
 p.close();
});

test('native workbench dormer overlay is reversible and not a playable import',()=>{
 const f=new URL('../docs/qa/mclean-house-inn/dormer-receipt.json',import.meta.url);
 const p=JSON.parse(readFileSync(f,'utf8'));
 assert(!p.playableChanges&&p.compare.restoredRGBA&&p.compare.sameCamera);
 assert.deepEqual([p.compare.changed,p.compare.alpha,p.compare.addedDraws,p.compare.addedTriangles],[9972,0,1,848]);
 assert(p.compare.left&&p.compare.right);
 const b=readFileSync(new URL('../src/render/buildings.ts',import.meta.url),'utf8');
 assert(!b.includes('mclean-front-dormer')&&!b.includes('mcLeanPrivateQA'));
});
