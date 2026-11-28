/** A detached one-face replacement, no runtime imports or loader. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Float32BufferAttribute,ShapeUtils,Vector2,Vector3} from 'three';

export function gradeFaceProof({plane,witness,rows,coords,D,tx,tz,packedHeight,stockUV,lift}) {
 assert.deepEqual(witness,{face:20152,window:[201,138,223,156],area:437});
 const {face,window:[c0,r0,c1,r1]}=witness,nx=c1-c0+1,nz=r1-r0+1;
 const previous=plane.index.array,position=plane.attributes.position;
 const oldN=position.count,original=Array.from(previous.slice(face*3,face*3+3));
 const point=(c,r)=>coords[r*D+c],near=(c,r)=>{
  const q=point(c,r);return [q.x-tx,q.z-tz];
 };
 const ring=[near(c0,r0),near(c1,r0),near(c1,r1),near(c0,r1)];
 const P=Array.from(position.array),originalUv=plane.attributes.uv.array,originalNormal=plane.attributes.normal.array;
 const U=Array.from(originalUv);
 const fade=s=>{const t=Math.min(1,s/4);return t*t*(3-2*t);};
 const mix=(a,b,t)=>a+(b-a)*t,maxima={projection:0,boundaryHeight:0,coreHeight:0};
 let core=0;const shift=[];
 for(let r=0;r<nz;r++)for(let c=0;c<nx;c++){
  const u=c/(nx-1),v=r/(nz-1),edge=Math.min(r,c,nx-c-1,nz-r-1),i=(r+r0)*D+c+c0;
  const p=ring[0].map((a,k)=>Math.fround(mix(mix(a,ring[1][k],u),mix(ring[3][k],ring[2][k],u),v)));
  maxima.projection=Math.max(maxima.projection,Math.hypot(p[0]+tx-coords[i].x,p[1]+tz-coords[i].z));
  const stock=packedHeight(p[0]+tx,p[1]+tz);
  assert.equal(stock.face,face);
  const y=Math.fround(mix(stock.y,rows[i].m+lift,fade(edge)));
  P.push(p[0],y,p[1]);U.push(...stockUV(p[0]+tx,p[1]+tz));shift.push(y-stock.y);
  if(edge===0)maxima.boundaryHeight=Math.max(maxima.boundaryHeight,Math.abs(y-stock.y));
  if(edge>=4){core++;maxima.coreHeight=Math.max(maxima.coreHeight,Math.abs(y-(rows[i].m+lift)));}
 }
 assert.ok(maxima.projection<.002&&maxima.boundaryHeight<.000001&&maxima.coreHeight<.000001);
 const at=(c,r)=>oldN+r*nx+c;
 const border=[
  Array.from({length:nx},(_,c)=>at(c,0)),
  Array.from({length:nz},(_,r)=>at(nx-1,r)),
  Array.from({length:nx},(_,c)=>at(nx-1-c,nz-1)),
  Array.from({length:nz},(_,r)=>at(0,nz-1-r)),
 ];
 const interior=border.map(edge=>edge[0]);
 const all=[...original,...interior];
 const get2=id=>new Vector2(P[id*3],P[id*3+2]);
 const tris=ShapeUtils.triangulateShape(original.map(get2),[interior.map(get2)]).map(tr=>tr.map(k=>all[k]));
 const ringTris=[],surfaceTris=[],edges=new Set();
 const signed=(a,b,c)=>{
  const p=get2(a),q=get2(b),r=get2(c);
  return (r.x-p.x)*(q.y-p.y)-(q.x-p.x)*(r.y-p.y);
 };
 const add=(list,a,b,c)=>{
  const n=signed(a,b,c);assert.ok(Math.abs(n)>.001);
  list.push(n>0?[a,b,c]:[a,c,b]);
 };
 for(const tri of tris){
  const squares=border.filter(b=>tri.includes(b[0])&&tri.includes(b.at(-1)));
  assert.ok(squares.length<=1);
  if(!squares.length){add(ringTris,...tri);continue;}
  const [sub]=squares,a=tri.find(i=>i!==sub[0]&&i!==sub.at(-1));
  assert.ok(!edges.has(sub[0]));edges.add(sub[0]);
  for(let i=1;i<sub.length;i++)add(ringTris,a,sub[i-1],sub[i]);
 }
 assert.equal(edges.size,4);
 for(let r=0;r<nz-1;r++)for(let c=0;c<nx-1;c++){
  add(surfaceTris,at(c,r),at(c,r+1),at(c+1,r));
  add(surfaceTris,at(c,r+1),at(c+1,r+1),at(c+1,r));
 }
 const replacement=[...ringTris,...surfaceTris];
 // Every introduced edge is directed and paired. Only the same three old outer edges remain.
 const census=new Map(),key=(a,b)=>a<b?a+'/'+b:b+'/'+a;
 for(const t of replacement)for(let i=0;i<3;i++){
  const a=t[i],b=t[(i+1)%3],k=key(a,b),[count,balance]=census.get(k)??[0,0];
  census.set(k,[count+1,balance+(a<b?1:-1)]);
 }
 const stockBoundary=new Map(original.map((a,i)=>{
  const b=original[(i+1)%3];return [key(a,b),a<b?1:-1];
 }));
 for(const [k,[n,s]] of census)if(stockBoundary.has(k))
  assert.deepEqual([n,s],[1,stockBoundary.get(k)]);else assert.deepEqual([n,s],[2,0]);
 for(const k of stockBoundary.keys())assert.ok(census.has(k));
 const projectedArea=replacement.reduce((s,t)=>s+signed(...t)/2,0);
 const oldArea=signed(...original)/2;
 assert.ok(Math.abs(projectedArea-oldArea)<1e-8);

 const writeback=plane.clone(),I=[...previous.slice(0,face*3),...replacement.flat(),...previous.slice(face*3+3)];
 writeback.setAttribute('position',new Float32BufferAttribute(P,3));
 writeback.setAttribute('uv',new Float32BufferAttribute(U,2));
 writeback.deleteAttribute('normal');writeback.setIndex(I);writeback.computeVertexNormals();
 const normals=writeback.attributes.normal;
 normals.array.set(originalNormal);
 const originalUp=original.map(id=>[originalNormal[id*3],originalNormal[id*3+1],originalNormal[id*3+2]]);
 assert.deepEqual(originalUp[0],originalUp[1]);assert.deepEqual(originalUp[0],originalUp[2]);
 for(const id of new Set(border.flat()))normals.setXYZ(id,...originalUp[0]);
 assert.equal(normals.count,writeback.attributes.position.count);
 assert.equal(writeback.attributes.uv.count,writeback.attributes.position.count);
 for(let i=oldN;i<normals.count;i++){
  assert.ok(normals.getY(i)>.85);
  assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<1e-6);
 }
 for(let i=originalUv.length;i<U.length;i++)assert.ok(U[i]>=0&&U[i]<=1);
 assert.deepEqual(writeback.attributes.uv.array.slice(0,originalUv.length),originalUv);
 assert.deepEqual(normals.array.slice(0,originalNormal.length),originalNormal);
 writeback.computeBoundingSphere();
 const before=writeback.index.array;
 assert.deepEqual(before.slice(0,face*3),previous.slice(0,face*3));
 assert.deepEqual(before.slice(face*3+replacement.length*3),previous.slice(face*3+3));
 assert.deepEqual(writeback.attributes.position.array.slice(0,oldN*3),position.array);
 for(const id of original)assert.ok(new Vector3().fromBufferAttribute(writeback.attributes.position,id)
  .equals(new Vector3().fromBufferAttribute(position,id)));
 const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
 const hash=a=>createHash('sha256').update(bytes(a)).digest('hex');
 const round=v=>Number(v.toFixed(9));
 const result={
  caveat:'Detached CPU Three.js mesh; no GPU, land material qualification, survey placement, shadows or collision data.',
  witness,originalIndices:original,addedVertices:P.length/3-oldN,coreSourceVertices:core,
  exactUntouchedStockVertices:oldN,exactUntouchedStockFaces:previous.length/3-1,
  replacementFaces:replacement.length,patchFaces:surfaceTris.length,joinFaces:ringTris.length,
  projectionAreaM2:round(projectedArea),projectionAreaMismatchM2:round(Math.abs(oldArea-projectedArea)),
  maximumMappedCentreOffsetM:round(maxima.projection),maximumBoundaryHeightErrorM:round(maxima.boundaryHeight),
  maximumCoreSourceHeightErrorM:round(maxima.coreHeight),minMaxDisplacementM:[round(Math.min(...shift)),round(Math.max(...shift))],
  positionSHA256:hash(writeback.attributes.position.array),indicesSHA256:hash(writeback.index.array),
  uvSHA256:hash(writeback.attributes.uv.array),normalSHA256:hash(normals.array),
 };
 writeback.dispose();
 return result;
}
