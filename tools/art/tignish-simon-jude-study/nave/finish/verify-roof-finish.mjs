import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LinearMipmapLinearFilter,SRGBColorSpace,NoColorSpace} from 'three';
import {finishSample,makeFinishMaps,makeTignishNaveFinish} from './roof-finish.ts';
import {makeTignishRoof} from '../roof.ts';
const recipe=JSON.parse(readFileSync(new URL('../fit.json',import.meta.url)));
const sha=a=>createHash('sha256').update(a).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const known=[
 'nave-north-east-segment','nave-north-west-segment','nave-south-east-segment','nave-south-west-segment',
];
test('the exact detached roof envelope, winding and normals are unchanged in all old meshes',()=>{
 const baseline=makeTignishRoof(recipe),art=makeTignishNaveFinish(recipe,128);
 try{
  assert.equal(art.group.parent,null);
  assert.deepEqual(art.group.position.toArray(),baseline.position.toArray());
  assert.deepEqual(art.group.children.map(x=>x.name),baseline.children.map(x=>x.name));
  assert.deepEqual(art.changed.map(x=>x.userData.role).sort(),known);
  const UVs=[];
  for(let i=0;i<baseline.children.length;i++){
   const s=baseline.children[i],t=art.group.children[i];
   for(const a of ['position','normal'])
    assert.deepEqual(bytes(s.geometry.attributes[a].array),bytes(t.geometry.attributes[a].array));
   assert.equal(s.geometry.index,t.geometry.index);
   assert.deepEqual(s.geometry.boundingSphere,t.geometry.boundingSphere);
   assert.deepEqual(t.userData,s.userData);
   if(known.includes(s.userData.role)){
    const A=s.geometry.attributes.uv,B=t.geometry.attributes.uv;
    for(let j=0;j<A.count;j++){
     assert.equal(B.getX(j),Math.fround((A.getX(j)+7)/22.5));
     assert.equal(B.getY(j),Math.fround((A.getY(j)+10.75)/16.25));
    }
    UVs.push(sha(bytes(B.array))); assert.equal(t.material.map,art.maps.albedo);
    assert.equal(t.material.transparent,false);assert.equal(t.material.depthWrite,true);
    assert.equal(t.material.metalness,0);
   }else{
    assert.deepEqual(s.geometry.attributes.uv.array,t.geometry.attributes.uv.array);
    assert.equal(s.material.color.getHex(),t.material.color.getHex());
    assert.equal(s.material.roughness,t.material.roughness);assert.equal(t.material.map,null);
   }
  }
  assert.equal(new Set(UVs).size,4,'all four patches keep their site phase, no per-face texture reset');
 }finally{
  for(const x of baseline.children){x.geometry.dispose();x.material.dispose();}
  art.dispose();
 }
});
test('original mipped RGB/normal/roughness maps keep stable bytes, correct color spaces and no alpha leakage',()=>{
 const a=makeFinishMaps(128),b=makeFinishMaps(128);
 try{
  for(const name of ['albedo','normal','roughness']){
   const t=a[name],d=t.image.data;assert.equal(sha(d),sha(b[name].image.data));assert.equal(d.length,128*128*4);
   assert.equal(t.colorSpace,name==='albedo'?SRGBColorSpace:NoColorSpace);
   assert.equal(t.minFilter,LinearMipmapLinearFilter);assert.equal(t.generateMipmaps,true);assert.equal(t.anisotropy,4);
   for(let i=3;i<d.length;i+=4)assert.equal(d[i],255);
  }
  const A=a.albedo.image.data,R=a.roughness.image.data,N=a.normal.image.data;
  let chroma=0,grain=0,nMin=255,min=255,max=0,rmin=255,rmax=0;
  for(let i=0;i<A.length;i+=4){
   min=Math.min(min,A[i+1]);max=Math.max(max,A[i+1]);
   chroma=Math.max(chroma,Math.max(A[i],A[i+1],A[i+2])-Math.min(A[i],A[i+1],A[i+2]));
   grain+=Number(N[i]!==127||N[i+1]!==127);nMin=Math.min(nMin,N[i+2]);
   rmin=Math.min(rmin,R[i+1]);rmax=Math.max(rmax,R[i+1]);
  }
  assert.ok(chroma<=3&&min>=108&&max<=139&&max-min>=9);
  assert.ok(nMin>=252&&grain>.5*128*128);
  assert.ok(rmin>=209&&rmax<=240&&rmax>rmin);
 }finally{for(const b1 of [a,b])for(const v of Object.values(b1))v.dispose();}
});
test('unsupported output sizes and invalid plan samples are rejected',()=>{
 for(const s of [0,12,63.5,85,2048]){
  assert.throws(()=>makeFinishMaps(s),/size/);
  assert.throws(()=>makeTignishNaveFinish(recipe,s),/size/);
 }
 for(const p of [[NaN,0],[0,Infinity],[Infinity,0]])assert.throws(()=>finishSample(...p),/plan sample/);
 let r=0;
 for(let j=0;j<100;j++){
  const t=finishSample(-6.5+(j%15)*1.5,-10+(j%100)*.05);
  assert.ok(t.albedo[1]>=103&&t.albedo[1]<=142&&t.roughness>=.82&&t.roughness<=.94);
  r+=t.relief;
 }
 assert.ok(r>0);
});
