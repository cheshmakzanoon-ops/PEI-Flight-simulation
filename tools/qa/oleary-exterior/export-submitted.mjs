/** Export the exact owned five native index batches plus their true world transforms to a private output folder.
 * No project source pixels, surveyed GeoZ, or other station/ground, pressure/physics variant is opened or emitted.
 */
import {readFileSync as R,writeFileSync as W,mkdirSync}from'node:fs';import{join,resolve}from'node:path';import{fileURLToPath}from'node:url';
import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import assert from'node:assert/strict';
import{OLEARY_PACKET as P}from'../../../src/render/oleary-railway/packet.generated.ts';
import{decodeOleary}from'../../../src/render/oleary-railway/packet.ts';import{Terrain}from'../../../src/sim/terrain.ts';
import{makeOlearyExterior}from'../../../src/render/oleary-railway/exterior.ts';
const root=fileURLToPath(new URL('../../..',import.meta.url)),dir=join(root,'public/world'),out=resolve(process.argv[2]??'/tmp/oleary-submitted');
const bytes=R(join(root,'public/art',P.file)),raw=gunzipSync(bytes),h=b=>createHash('sha256').update(b).digest('hex');
const s=JSON.parse(R(join(dir,'terrain.json'))),old=gunzipSync(R(join(dir,s.file)));
assert.equal(h(bytes),P.packedSHA256);assert.equal(h(raw),P.rawSHA256);
const actual=decodeOleary(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.length)),expected=makeOlearyExterior(new Terrain(s,new Int16Array(old.buffer,old.byteOffset,old.length/2)));
assert(actual?.intact());actual.group.updateMatrixWorld(true);mkdirSync(out,{recursive:true});
const ranges=expected.group.userData.olearyProof,parts=[];
for(const [i,q]of actual.group.children.entries()){
 const geo=q.geometry,g=expected.group.children[i].geometry,ix=geo.index.array,attrs={};
 const b=Buffer.from(ix.buffer,ix.byteOffset,ix.byteLength);W(join(out,i+'-index.u16'),b);
 for(const key of['position','normal','color','uv']){
  const a=geo.getAttribute(key),n=a.itemSize,v=new Float32Array(ix.length*n);
  for(let j=0;j<ix.length;j++)for(let w=0;w<n;w++)v[j*n+w]=a.array[ix[j]*n+w];
  assert.deepEqual(v,g.getAttribute(key).array);
  const b=Buffer.from(v.buffer);W(join(out,i+'-'+key+'.f32'),b);attrs[key]={expandedSHA:h(b),components:n};
 }
 parts.push({role:q.name,matrixWorld:q.matrixWorld.toArray(),indices:ix.length,triangles:ix.length/3,attributes:attrs});
}
const supports=ranges.supports.map(x=>{
 const j=ranges.ownedMaterialOrder.indexOf(x.lane),g=actual.group.children[j].geometry;
 return {role:x.role,part:j,...Object.fromEntries(['lower','optionalUpperNosing'].filter(k=>x[k]).map(k=>[k,x[k].map(n=>{
  const q=g.index.getX(n),p=g.getAttribute('position');return {decodedIndexOffset:n,actualRelativeXYZ:[p.getX(q),p.getY(q),p.getZ(q)]};
 })]))};
});
W(join(out,'submitted.json'),JSON.stringify({description:'Verified runtime indexed submissions; Float32 expansion checked byte-for-byte against original recipe and game grade.',packet:P,parts,supports,features:ranges.features},null,2)+'\n');
console.log(h(R(join(out,'submitted.json'))),parts.map(p=>p.triangles));actual.dispose();expected.dispose();
