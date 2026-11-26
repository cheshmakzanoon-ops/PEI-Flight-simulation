import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {BufferGeometry,FrontSide,Vector3,ShaderLib} from 'three';
import {buildBoardwalkCap} from './boardwalk-cap.ts';
import {integratedTimberGroove,patchBoardwalkTimber,TIMBER_VIEW_RECIPE} from './boardwalk-timber.ts';
import {buildSyntheticWalk,SYNTHETIC_STANDARD,syntheticGround} from './synthetic-seawalk-fixture.mjs';

const ok=r=>{assert.equal(r.ok,true,JSON.stringify(r));return r;};
const close=(a,b,d=1e-6)=>assert.ok(Math.abs(a-b)<=d,a+' and '+b);
const basic={centerline:[[0,0],[10,0]],width:3,ground:()=>1,dry:()=>true};
const arrays=(mesh)=>[mesh.geometry.index,...Object.values(mesh.geometry.attributes)].map(a=>a.array);
const key=v=>[...v].join(',');
const signature=r=>{
 const a=createHash('sha256');
 for(const mesh of r.group.children){
  for(const v of arrays(mesh))a.update(Buffer.from(v.buffer,v.byteOffset,v.byteLength));
 }
 return a.digest('hex');
};
function walkTris(mesh,doTri){
 const g=mesh.geometry,p=g.attributes.position,t=g.attributes.uv,n=g.attributes.normal,ix=g.index.array;
 for(let i=0;i<ix.length;i+=3){
  const ids=ix.subarray(i,i+3);
  const v=Array.from(ids,j=>new Vector3(p.getX(j),p.getY(j),p.getZ(j)));
  const u=Array.from(ids,j=>[t.getX(j),t.getY(j)]),normal=Array.from(ids,j=>[n.getX(j),n.getY(j),n.getZ(j)]);
  doTri(v,u,normal,i/3);
 }
 return g;
}

test('compound art fixture is deterministic, all-positive top and closed exact Float32 edge mesh',()=>{
 const r=ok(buildSyntheticWalk());
 assert.equal(r.group.parent,null);
 assert.deepEqual(r.group.userData,{visualOnly:true,installAuthority:false,footprintProof:'caller'});
 const law=r.receipt;
 close(law.stationLength,26.934352635918344);close(law.outlineM2,78.54622714426193);
 assert.equal(law.rows,27);assert.equal(law.miterJoins,3);assert.equal(law.bevelJoins,2);
 assert.equal(law.triangles,512);assert.equal(law.draws,2);assert.equal(law.dryTriangles,198);
 assert.equal(law.visualGroundSamples,653);
 assert.ok(law.sampledMinCapClearance>.029&&law.sampledMaxCapClearance<.061);
 assert.equal(Object.isFrozen(r.origin),true);assert.equal(Object.isFrozen(law),true);
 const edges=new Map(),triangles=new Set();
 let volume=0,deckArea=0,deckNormalMinimum=1,sides=0;
 function addEdge(v,w){
  const a=key(v),b=key(w),sorted=a<b?a+'@'+b:b+'@'+a;
  const e=edges.get(sorted)??[0,0];
  e[a<b?0:1]++;edges.set(sorted,e);
 }
 for(const m of r.group.children){
  const role=m.userData.role;
  assert.ok(m.geometry instanceof BufferGeometry);
  assert.equal(m.material.side,FrontSide);
  assert.equal(m.material.map,null);
  assert.equal(m.material.transparent,false);
  assert.equal(m.material.opacity,1);
  assert.deepEqual(Object.keys(m.geometry.attributes).sort(),['normal','position','uv']);
  assert.ok(m.geometry.index.array instanceof Uint16Array);
  walkTris(m,(v,t,n)=>{
   assert.equal(t.flat().filter(Number.isFinite).length,6);
   const [a,b,c]=v,face=new Vector3().subVectors(b,a).cross(new Vector3().subVectors(c,a));
   assert.ok(face.length()>1e-5,role);
   n.forEach(x=>close(Math.hypot(...x),1,2e-6));
   if(role==='deck'){
    assert.ok(face.y>0);
    deckArea+=face.y*.5;deckNormalMinimum=Math.min(face.y/face.length(),deckNormalMinimum);
    assert.ok(t[0][0]>=-1.5&&t[0][0]<=1.5);
    const uvDet=(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]);
    assert.ok(uvDet>1e-6,'deck UV patch warped or inverted');
   }else if(Math.abs(face.y)<1e-7)sides++;
   volume+=a.dot(b.clone().cross(c))/6;
   const k=v.map(key).sort().join('@');assert.equal(triangles.has(k),false);
   triangles.add(k);
   addEdge(a,b);addEdge(b,c);addEdge(c,a);
  });
 }
 for(const uses of edges.values())assert.deepEqual(uses,[1,1]);
 assert.ok(deckNormalMinimum>.80&&deckNormalMinimum<.98,'bevel lip must not be a box');
 assert.ok(sides>40);close(deckArea,law.outlineM2,1e-5);
 assert.ok(volume>5.8&&volume<6.01,volume);
 assert.equal(signature(r),signature(ok(buildSyntheticWalk())));
 assert.equal(signature(r),signature(ok(buildSyntheticWalk('flat'))));
 assert.equal(signature(r),signature(ok(buildSyntheticWalk('tone'))));
});

test('actual emitted local Float32 triangles get full immutable world authority, including across joins',()=>{
 const offset=[-8032.662554,4874.956355];
 const src=SYNTHETIC_STANDARD.centerline.map(([x,z])=>[x+offset[0],z+offset[1]]);
 const attested=[];
 const getY=(x,z)=>syntheticGround(x-offset[0],z-offset[1]);
 const r=ok(buildBoardwalkCap({centerline:src,width:SYNTHETIC_STANDARD.width,ground:getY,dry:p=>{
  assert.ok(Object.isFrozen(p));
  assert.ok(p.every(Object.isFrozen));
  attested.push(p);return true;
 }}));
 assert.ok(Math.abs(r.origin[0]-offset[0])<.0005);
 walkTris(r.group.children[0],(v,t,n,i)=>{
  assert.deepEqual(v.map(a=>[a.x+r.origin[0],a.z+r.origin[2]]),attested[i]);
  for(const a of v)assert.ok(a.y+r.origin[1]>getY(a.x+r.origin[0],a.z+r.origin[2]));
 });
 assert.equal(attested.length,r.receipt.dryTriangles);
 src[3][0]=Infinity;
 assert.throws(()=>{attested[0][0][0]=Infinity;},TypeError);
 assert.equal(r.receipt.miterJoins,3);
});

test('a wholly interior wet point and outside margin reject; no point-only truthy substitute',()=>{
 const w=[4.47,.38];
 const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 let found=0;
 const r=buildBoardwalkCap({...basic,dry:p=>{
  const hit=p.every((q,i)=>turn(q,p[(i+1)%3],w)<0);
  if(hit)found++;return !hit;
 }});
 assert.equal(r.ok,false);assert.equal(r.reason,'wet');assert.equal(found,1);assert.equal('group' in r,false);
 const bounds=buildBoardwalkCap({...basic,dry:p=>p.every(q=>Math.abs(q[1])<=1.49)});
 assert.equal(bounds.ok,false);assert.equal(bounds.reason,'wet');
 assert.equal(buildBoardwalkCap({...basic,dry:()=>1}).reason,'wet');
 assert.equal(buildBoardwalkCap({...basic,dry:()=>{throw Error('unknown');}}).reason,'unsupported');
});

test('ground predicates must provide useful exact levels and cannot hide a real midpoint bump',()=>{
 assert.equal(buildBoardwalkCap({...basic,ground:()=>undefined}).reason,'unsupported');
 assert.equal(buildBoardwalkCap({...basic,ground:()=>NaN}).reason,'unsupported');
 assert.equal(buildBoardwalkCap({...basic,ground:()=>{throw Error('unknown');}}).reason,'unsupported');
 const concealed=(x,z)=>x===.625&&z===0?1.091:1;
 assert.equal(buildBoardwalkCap({...basic,ground:concealed}).reason,'grade');
 assert.equal(buildBoardwalkCap({...basic,ground:x=>1+.25*x}).reason,'grade');
 assert.equal(buildBoardwalkCap({...basic,ground:(x,z)=>1+.049*z}).reason,'grade');
 const r=ok(buildBoardwalkCap({...basic,ground:(x,z)=>1+.021*x-.003*z}));
 assert.ok(r.receipt.sampledMaxCapClearance<.05);
 assert.ok(r.receipt.sampledMinCapClearance>.029);
});

test('invalid station, corners, crossings and degenerate swept footprint fail before a Three group',()=>{
 for(const centerline of [
  [[0,0],[0,0]],[[0,0],[.04,.04]],[[9e20,0],[9e20,1]],[[0,0],[NaN,0]],
  new Array(2),[[,0],[2,0]],[[9,0],null],[[1,0],[1,0],[10,0]],
 ]) assert.deepEqual(buildBoardwalkCap({...basic,centerline}).reason,'input');
 assert.equal(buildBoardwalkCap({...basic,width:.6}).reason,'input');
 assert.equal(buildBoardwalkCap({...basic,centerline:[[0,0],[2000.1,0]]}).reason,'length');
 const back=buildBoardwalkCap({...basic,centerline:[[0,0],[10,0],[.1,.1]]});
 assert.equal(back.reason,'bend');assert.ok(!('group' in back));
 assert.equal(buildBoardwalkCap({...basic,centerline:[[0,0],[8,0],[8,8],[2,8],[2,-4]]}).reason,'self-overlap');
 assert.equal(buildBoardwalkCap({...basic,centerline:[[0,0],[8,0],[8,2],[0,2]]}).reason,'bend');
});

test('each handed bevel stays closed and identical along equal-length straight profile, no strip overlap',()=>{
 const L=ok(buildBoardwalkCap({...basic,centerline:[[0,0],[9,0],[9,6]]}));
 const R=ok(buildBoardwalkCap({...basic,centerline:[[0,0],[9,0],[9,-6]]}));
 for(const r of [L,R]){
  assert.equal(r.receipt.bevelJoins,1);
  assert.equal(r.receipt.miterJoins,0);
  assert.equal(r.receipt.dryTriangles,107);
  close(r.receipt.outlineM2,43.875);
  close(r.receipt.sampledMinCapClearance,.030);
  close(r.receipt.sampledMaxCapClearance,.041);
 }
 assert.equal(L.receipt.triangles,R.receipt.triangles);
});

test('nominal 950m comparison stays indexed and linearly bounded; no world asset for that case',()=>{
 const r=ok(buildBoardwalkCap({...basic,centerline:[[42.726,-19.553],[992.726,-19.553]]}));
 assert.equal(r.receipt.draws,2);
 assert.equal(r.receipt.rows,761);
 assert.equal(r.receipt.dryTriangles,6080);
 assert.ok(r.receipt.visualGroundSamples<21500);
 assert.ok(r.receipt.triangles<15500);
 assert.ok(r.group.children.every(m=>m.geometry.index.array instanceof Uint16Array));
 assert.ok(r.group.children.flatMap(arrays).reduce((a,b)=>a+b.byteLength,0)<550_000);
});

test('wood-course box filter follows exact periodic width, stays stable at coarse footprints',()=>{
 const p=TIMBER_VIEW_RECIPE.visualBoardPitchM,g=2*TIMBER_VIEW_RECIPE.authorHalfGrooveFraction;
 close(integratedTimberGroove(0,0),g/TIMBER_VIEW_RECIPE.minFilter,1e-10);
 close(integratedTimberGroove(p*.5,0),0,1e-12);
 for(const w of [1,2,5.47,10,20,30.5]){
  let sum=0;
  for(let j=0;j<200;j++){
   const x=j*p/200;
   const v=integratedTimberGroove(x,w*p);
   close(v,integratedTimberGroove(x+5190*p,w*p),2e-9);
   close(v,integratedTimberGroove(-x,w*p),2e-10);
   if(w===Math.round(w))close(v,g,1e-9);
   sum+=v;
  }
  close(sum/200,g,1e-7);
 }
 let peak=0;
 for(let j=0;j<300;j++){
  const a=integratedTimberGroove((j/300)*p,.83);
  const b=integratedTimberGroove((j/300)*p+.018,.83);
  peak=Math.max(Math.abs(a-b),peak);
 }
 assert.ok(peak<.007,peak);
});

test('Three r187 shader branch uses only normal/position/uv, variant adds no sampler, uniform, alpha, or draw',()=>{
 const {vertexShader:v,fragmentShader:f}=ShaderLib.standard;
 const tone=patchBoardwalkTimber(v,f,'deck','tone'),full=patchBoardwalkTimber(v,f,'deck','full');
 const edge=patchBoardwalkTimber(v,f,'edge','full');
 assert.equal(patchBoardwalkTimber(v,f,'deck','flat'),undefined);
 assert.match(tone.fragment,/roughnessFactor=clamp/);
 assert.match(full.fragment,/normal=peiTimberMicroNormal/);
 assert.doesNotMatch(tone.fragment,/normal=peiTimberMicroNormal/);
 assert.doesNotMatch(edge.fragment,/normal=peiTimberMicroNormal/);
 assert.equal(full.vertex,tone.vertex);assert.equal(full.vertex,edge.vertex);
 assert.equal(patchBoardwalkTimber(full.vertex,full.fragment,'deck'),undefined);
 assert.equal(patchBoardwalkTimber(v,f+'\n#include <common>','edge'),undefined);
 for(const out of [tone,full,edge]){
  assert.match(out.vertex,/vPeiTimberM=uv/);
  for(const t of [/\buniform\b/g,/\b(?:texture|sampler2D|samplerCube)\b/g,/diffuseColor\.a/g,/\bdiscard\b/g]){
   assert.equal((out.fragment.match(t)??[]).length,(f.match(t)??[]).length);
  }
 }
 const m=ok(buildSyntheticWalk('full')).group.children[0].material;
 const q={vertexShader:v,fragmentShader:f,uniforms:{scene:{value:0}}},u=q.uniforms;
 m.onBeforeCompile(q,{});
 assert.equal(q.vertexShader,full.vertex);assert.equal(q.fragmentShader,full.fragment);
 assert.equal(q.uniforms,u);
});

test('relief field preserves original cap position and normal bytes and retags only 16 true terminal triangles',()=>{
 const old=ok(buildSyntheticWalk('full')),refined=ok(buildSyntheticWalk('relief')),
  noBump=ok(buildSyntheticWalk('relief-tone'));
 assert.deepEqual(old.receipt,refined.receipt);
 assert.equal(signature(refined),signature(noBump));
 let tri=0;
 for(const [m,b] of refined.group.children.map((m,i)=>[m,old.group.children[i]])){
  assert.deepEqual(m.geometry.index.array,b.geometry.index.array);
  assert.deepEqual(m.geometry.attributes.position.array,b.geometry.attributes.position.array);
  assert.deepEqual(m.geometry.attributes.normal.array,b.geometry.attributes.normal.array);
  const prior=b.geometry.attributes.uv;
  const now=m.geometry.attributes.uv;
  if(m.userData.role==='deck'){
   assert.deepEqual(now.array,prior.array);continue;
  }
  const ix=m.geometry.index.array;
  for(let i=0;i<ix.length;i+=3){
   const verts=[ix[i],ix[i+1],ix[i+2]];
   const changed=verts.filter(a=>prior.getX(a)!==now.getX(a)||prior.getY(a)!==now.getY(a));
   if(changed.length){
    assert.equal(changed.length,3);tri++;
    for(const a of changed){
     assert.ok(now.getX(a)>=6.5&&now.getX(a)<=9.5);
     assert.ok(now.getY(a)>=0&&now.getY(a)<.08);
     assert.ok(prior.getY(a)===0||Math.abs(prior.getY(a)-old.receipt.stationLength)<2e-6);
    }
   }
  }
 }
 assert.equal(tri,16);
 const {vertexShader:v,fragmentShader:f}=ShaderLib.standard;
 const full=patchBoardwalkTimber(v,f,'deck','relief'),flat=patchBoardwalkTimber(v,f,'deck','relief-tone');
 assert.match(full.fragment,/normal=peiTimberReliefGroove/);
 assert.doesNotMatch(flat.fragment,/normal=peiTimberReliefGroove/);
 assert.equal(full.fragment.match(/vec3 peiTimberP=.*/)[0],flat.fragment.match(/vec3 peiTimberP=.*/)[0]);
 const edge=patchBoardwalkTimber(v,f,'edge','relief');
 assert.match(edge.fragment,/peiTimberSawnEnds\(vec2\(vPeiTimberM\.x-8\.,vPeiTimberM\.y\)\)/);
});
