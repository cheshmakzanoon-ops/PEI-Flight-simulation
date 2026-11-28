import {test} from 'node:test';
import A from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeRailArtwork} from '../../../../../src/render/summerside-station/rail-art.ts';
import {RAIL_ART} from '../../../../../src/render/summerside-station/art.generated.ts';
import {compileRailRoofFinish,prepareRailRoofFinish,valleys,caps} from '../rail-roof-finish.ts';
const src=readFileSync(new URL('../../../../../public/art/'+RAIL_ART.file,import.meta.url)),raw=gunzipSync(src);
const sha=q=>createHash('sha256').update(q).digest('hex');
const decode=(s)=>decodeRailArtwork(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),s);
const key=m=>m.customProgramCacheKey();
const program=()=>({vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}});
const array=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const ownership=g=>g.children.map(m=>[m,m.geometry,m.geometry.index,m.material,m.material.map,m.material.map?.source,m.material.map?.source.version,
 m.geometry.index.count,Object.values(m.geometry.attributes).map(b=>[b,b.version,sha(array(b.array))]),sha(array(m.geometry.index.array))]);

test('verified asset only; exact assembly, attributes, atlas ownership, caster and draw ledger persist',async()=>{
 A.equal(sha(src),RAIL_ART.wireSha);A.equal(sha(raw),RAIL_ART.rawSha);
 const a=decode();A(a);
 try{
  const g=a.group,p=g.getObjectByName('roof'),mat=p.material,before=ownership(g),xf=g.matrix.toArray();
  const caster=sha(array(a.caster.geometry.attributes.position.array))+sha(array(a.caster.geometry.index.array));
  const oldCB=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey;
  const lease=await prepareRailRoofFinish(g);A(lease);
  A.equal(key(mat),'summ-rail-base/registered-lapped-roof-v1');
  A.equal(await prepareRailRoofFinish(g),undefined);
  const b=program();mat.onBeforeCompile(b,undefined); A.equal(b.uniforms.railFinishGain.value,0);
  A(lease.set(true));A.equal(b.uniforms.railFinishGain.value,1);
  A.equal(b.vertexShader.includes('railFinishPosition=position;'),true);
  A.equal(b.fragmentShader.includes('railFinishGain'),true);
  A(lease.set(false));A.equal(b.uniforms.railFinishGain.value,0);
  lease.release();lease.release();A(!lease.set(true));
  A.equal(mat.onBeforeCompile,oldCB);A.equal(mat.customProgramCacheKey,oldKey);A.deepEqual(ownership(g),before);
  A.deepEqual(xf,g.matrix.toArray());
  A.equal(caster,sha(array(a.caster.geometry.attributes.position.array))+sha(array(a.caster.geometry.index.array)));
  A.equal(g.children.reduce((x,q)=>x+q.geometry.index.count/3,0),5299);
 }finally{a.dispose();}
});

test('one-word geometry or map mutation, shadow mode and reduced geometry set refuse',async()=>{
 for(const fault of ['geometry','texture','missing-role','shadow-mode']){
  const a=decode(fault==='shadow-mode'?{uniforms:{}}:undefined);A(a);
  try{
   const q=a.group.getObjectByName('roof'), original=q.material.onBeforeCompile;
   if(fault==='geometry')new Uint32Array(q.geometry.attributes.position.array.buffer,q.geometry.attributes.position.array.byteOffset,1)[0]^=1;
   if(fault==='texture')q.material.map.image.data[730]^=1;
   if(fault==='missing-role')a.group.add(new T.Group());
   A.equal(await prepareRailRoofFinish(a.group),undefined,fault);
   A.equal(q.material.onBeforeCompile,original,fault);
  }finally{
   if(fault==='missing-role')a.group.remove(a.group.children.at(-1));
   a.dispose();
  }
 }
});

test('wrong partial program and newer material owner are not overwritten',async()=>{
 const sh=program();sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','');
 const orig={...sh};
 A.equal(compileRailRoofFinish(sh,{value:1}),false);A.deepEqual(sh,orig);
 const a=decode();A(a);
 try{
  const m=a.group.getObjectByName('roof').material,l=await prepareRailRoofFinish(a.group);A(l);
  const b=program();m.onBeforeCompile(b,undefined);A(l.set(true));
  const callback=()=>{},id=()=> 'next';
  m.onBeforeCompile=callback;m.customProgramCacheKey=id;
  A.equal(l.set(true),false);A.equal(b.uniforms.railFinishGain.value,0);
  l.release();A.equal(m.onBeforeCompile,callback);A.equal(m.customProgramCacheKey,id);
 }finally{a.dispose();}
});

test('all 15 features lie on submitted hard roof joins, not the triangle interior',()=>{
 const {group,dispose}=decode();
 try{
  const g=group.getObjectByName('roof').geometry,p=g.attributes.position.array,n=g.attributes.normal.array,i=g.index.array;
  const v=(a,k)=>new T.Vector3(a[3*k],a[3*k+1],a[3*k+2]);
  const facets=Array.from({length:i.length/3},(_,j)=>{
   const t=[i[3*j],i[3*j+1],i[3*j+2]];
   return [t.map(k=>v(p,k)),v(n,t[0])];
  });
  for(const s of [...valleys,...caps]){
   const q=new T.Vector3(...s.slice(0,3)),r=new T.Vector3(...s.slice(3));
   const l=r.distanceTo(q),ax=r.clone().sub(q).normalize(),groups=new Map();
   for(const [pts,N] of facets)for(let k=0;k<3;k++){
    const a=pts[k].clone().sub(q),b=pts[(k+1)%3].clone().sub(q);
    const ta=a.dot(ax),tb=b.dot(ax);
    if(a.addScaledVector(ax,-ta).length()>3.0e-5||b.addScaledVector(ax,-tb).length()>3.0e-5)continue;
    const l0=Math.max(0,Math.min(ta,tb)), l1=Math.min(l,Math.max(ta,tb));
    if(l1-l0<=1.e-5)continue;
    const key=N.toArray().map(x=>x.toFixed(4)).join(',');
    if(!groups.has(key))groups.set(key,{N,spans:[]});
    groups.get(key).spans.push([l0,l1]);
   }
   const found=[];
   for(const {N,spans} of groups.values()){
    let end=0;
    for(const [a,b] of spans.sort((t,u)=>t[0]-u[0])){if(a>end+5.e-5)break;end=Math.max(end,b);}
    if(l-end<5.e-5)found.push(N);
   }
   A(found.some(N=>found.some(M=>N.distanceTo(M)>=.09)),JSON.stringify(s));
  }
 }finally{dispose();}
});
