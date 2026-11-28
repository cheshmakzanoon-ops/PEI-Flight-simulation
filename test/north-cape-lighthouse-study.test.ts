import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {makeNorthCapeDetachedStudy,northCapeReference,studyFaceXAtHeight} from '../tools/art/north-cape-lighthouse/north-cape-lens-draft.ts';

test('the detached North Cape silhouette has repeatable metre scale and two bounded render roles',()=>{
 for(const detail of [true,false]){
  const model=makeNorthCapeDetachedStudy(detail);
  try{
   assert.equal(model.group.parent,null);assert.equal(model.group.children.length,2);
   assert.equal(model.ringEdges,8);assert.equal(model.glassFaces,7);
   assert.equal(model.galleryPosts.length,8);
   const q=model.exterior.geometry.attributes.position;
   for(const {first,end} of model.galleryPosts){
    assert.equal(end-first,36);
    const y=Array.from({length:36},(_,j)=>q.getY(first+j));
    assert.ok(Math.abs(Math.min(...y)-15.69)<1e-6 && Math.min(...y)<15.72&&Math.max(...y)>16.60);
   }
   assert.equal(model.triangles,detail?3924:560);
   assert.equal(model.exterior.geometry.boundingBox!.min.y,0);
   assert.equal(model.exterior.geometry.boundingBox!.max.y,northCapeReference.structureHeightMetres);
   assert.equal(model.panes.material.depthWrite,false);assert.equal(model.panes.material.transparent,true);
   assert.equal(model.exterior.material.map,null);assert.equal(model.panes.material.map,null);
   for(const g of [model.exterior.geometry,model.panes.geometry]){
    const v=g.attributes.position,n=g.attributes.normal;
    assert.equal(v.count,n.count);
    for(let k=0;k<n.count;k++)assert.ok(Math.abs(Math.hypot(n.getX(k),n.getY(k),n.getZ(k))-1)<1e-5);
   }
  }finally{model.dispose();}
 }
});

test('the 384 m detached site crop retains an exact centimetre raster and the published locator cell',()=>{
 const dir=new URL('../data/north-cape-lighthouse-study/',import.meta.url),j=JSON.parse(readFileSync(new URL('source.json',dir),'utf8'));
 const sha=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
 const compressed=readFileSync(new URL(j.file,dir)),data=gunzipSync(compressed);
 assert.equal(sha(compressed),j.storedSHA256);assert.equal(sha(data),j.decodedSHA256);
 assert.equal(data.length,384*384*2);assert.equal(j.validSamples,384*384);
 assert.deepEqual(j.registration.geotransform,[2281139,1,0,350642,0,-1]);
 assert.deepEqual(j.registration.sourcePixelOffset,[281139,149358]);
 assert.ok(j.maxQuantizationM<=.00501);
 const {row,col}= {row:j.reference.row,col:j.reference.column};
 assert.equal(j.reference.longitude,northCapeReference.lon);assert.equal(j.reference.latitude,northCapeReference.lat);
 assert.equal(data.readInt16LE((row*384+col)*2),551);
 assert.ok(j.rangeCM[0]<0&&j.rangeCM[1]>1000);
});

test('each representative opening follows the sloped face and the casing backs remain seated',()=>{
 const detailed=makeNorthCapeDetachedStudy();const coarse=makeNorthCapeDetachedStudy(false);
 try{
  assert.equal(detailed.trimSeats.length,3);assert.equal(coarse.trimSeats.length,0);
  const p=detailed.exterior.geometry.attributes.position;
  for(const {first,end} of detailed.trimSeats){
   assert.equal(end-first,180);
   const offsets=Array.from({length:36},(_,j)=>p.getX(first+j)-studyFaceXAtHeight(p.getY(first+j)));
   assert.ok(offsets.every(x=>Math.min(Math.abs(x+.045),Math.abs(x-.095))<1e-6));
   assert.ok(Math.min(...offsets)<-.044999&&Math.max(...offsets)>.094999);
   // The documented art aperture is not a cut through the existing shaft.
   const range=Array.from({length:end-first},(_,j)=>p.getX(first+j)-studyFaceXAtHeight(p.getY(first+j)));
   assert.ok(range.every(x=>x>-.045001&&x<.174001));
  }
 }finally{detailed.dispose();coarse.dispose();}
});

test('the dated façade adds only seated window-face vent and adjacent entry geometry at near distance',()=>{
 const original=makeNorthCapeDetachedStudy();
 const detail=makeNorthCapeDetachedStudy(true,'dated-facade');
 const far=makeNorthCapeDetachedStudy(false),farDated=makeNorthCapeDetachedStudy(false,'dated-facade');
 const components=['position','normal','color'] as const;
 try{
  assert.deepEqual(original.facadeDetails,[]);assert.deepEqual(farDated.facadeDetails,[]);
  for(const key of components){
   const before=original.exterior.geometry.attributes[key].array;
   const after=detail.exterior.geometry.attributes[key].array;
   assert.deepEqual(after.slice(0,before.length),before);
   assert.deepEqual(detail.panes.geometry.attributes[key].array,original.panes.geometry.attributes[key].array);
   assert.deepEqual(farDated.exterior.geometry.attributes[key].array,far.exterior.geometry.attributes[key].array);
   assert.deepEqual(farDated.panes.geometry.attributes[key].array,far.panes.geometry.attributes[key].array);
  }
  assert.equal(detail.exterior.material.map,null);
  assert.deepEqual(detail.facadeDetails.map(f=>[f.kind,f.face,f.end-f.first]),[['vent',0,72],['hooded-entry',1,195]]);
  assert.equal(detail.triangles-original.triangles,89);
  assert.equal(detail.group.children.length,2);
  const p=detail.exterior.geometry.attributes.position,n=detail.exterior.geometry.attributes.normal;
  for(const f of detail.facadeDetails){
   const d=[],y=[],z=[],c=f.face===0?1:Math.SQRT1_2,s=f.face===0?0:Math.SQRT1_2;
   for(let i=f.first;i<f.end;i++){
    y.push(p.getY(i));z.push(-s*p.getX(i)+c*p.getZ(i));
    d.push(c*p.getX(i)+s*p.getZ(i)-studyFaceXAtHeight(p.getY(i)));
   }
   assert.ok(Math.min(...d)<-.02&&Math.max(...d)>.08);
   if(f.kind==='hooded-entry'){
    assert.ok(Math.min(...y)>.21&&Math.max(...y)<2.47&&Math.max(...d)<.42);
    for(const i of [f.first+108,f.first+150])assert.ok(n.getY(i)>.65,'roof planes face the sky');
   }else{
    assert.ok(Math.min(...z)>.70&&Math.max(...z)<1.1);
    assert.ok(Math.min(...y)>4.06&&Math.max(...y)<4.37);
   }
  }
 }finally{original.dispose();detail.dispose();far.dispose();farDated.dispose();}
});
