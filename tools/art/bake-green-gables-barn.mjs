/** Bake the terrain-seated visual exterior. No survey cloud or image pixels
 * enter the runtime, and no procedural model is built while in flight.
 * Run at repository root: node --experimental-strip-types tools/art/bake-green-gables-barn.mjs
 */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {buildBarn} from './green-gables-barn-model.ts';
import {barnOutline} from './green-gables-barn-model.ts';
import {greenGablesBarnSeat} from './green-gables-barn-seat.ts';
import {paints} from '../../src/render/green-gables-barn-materials.ts';
const original=buildBarn(),artifact=buildBarn(greenGablesBarnSeat);
const stockRoof=original.model.children.filter(m=>m.name==='roof'||m.name==='soffit'||m.name==='roofEdge');
for(const a of stockRoof){
 const next=artifact.model.children.find(m=>m.name===a.name);
 // Door reveals reuse these materials, but the roof cap, soffit and
 // perimeter fascia are emitted first and keep their exact attributes.
 const n=a.name==='roofEdge'?original.counts['outer roof edge']*3:stockRoof[0].geometry.getAttribute('position').count;
 for(const key of ['position','normal','uv']){
  const x=next.geometry.getAttribute(key),y=a.geometry.getAttribute(key);
  assert.deepEqual(x.array.subarray(0,n*x.itemSize),y.array.subarray(0,n*y.itemSize),'roof silhouette and underside must remain exact');
 }
}
assert.equal(artifact.unpaired,0);
const colors=Object.keys(paints),names=[],parts=[],sums=[0,0];
const header=Buffer.alloc(16);header.write('GGBN');header.writeUInt16LE(1,6);
const [a,b,c,d]=[
 Math.min(...barnOutline.map(q=>q[0]))-.0001,Math.max(...barnOutline.map(q=>q[0]))+.0001,
 Math.min(...barnOutline.map(q=>q[1]))-.0001,Math.max(...barnOutline.map(q=>q[1]))+.0001
];
for(const [id,mesh] of artifact.model.children.entries()){
 const color=colors.indexOf(mesh.name);
 if(color<0)throw Error('Unsupported Barn material '+mesh.name);
 let g=mesh.geometry;
 if(g.index)g=g.toNonIndexed();
 const at=['position','normal','uv'].map(k=>g.getAttribute(k).array);
 const m=at[0].length/3;
 assert.equal(m%3,0);assert.equal(at[1].length,m*3);assert.equal(at[2].length,m*2);
 const r=[],idx=[],lookup=new Map(),P=at.map(p=>new Uint32Array(p.buffer,p.byteOffset,p.length));
 for(let j=0;j<m;j++){
  const t=3*j,u=2*j;
  const [x,y,z]=at[0].subarray(t,t+3);
  assert.ok(x>=a&&x<=b&&z>=c&&z<=d&&y>=-2&&y<=9.29);
  const k=[P[0][t],P[0][t+1],P[0][t+2],P[1][t],P[1][t+1],P[1][t+2],P[2][u],P[2][u+1]];
  assert.ok([...at[1].subarray(t,t+3),...at[2].subarray(u,u+2)].every(Number.isFinite));
  const key=k.join(',');
  let i=lookup.get(key);if(i===undefined){i=r.length;lookup.set(key,i);r.push(k);}idx.push(i);
 }
 assert.ok(r.length<65536);
 const part=Buffer.alloc(12+r.length*32+4*Math.ceil(idx.length/2));
 part.writeUInt16LE(color);part.writeUInt16LE(id,2);part.writeUInt16LE(r.length,4);part.writeUInt32LE(idx.length,8);
 let p=12;
 for(let k=0;k<8;){
  const e=k+(k<6?3:2);
  for(const v of r)for(let q=k;q<e;q++){part.writeUInt32LE(v[q],p);p+=4;}
  k=e;
 }
 for(const v of idx){part.writeUInt16LE(v,p);p+=2;}
 names.push(mesh.name);parts.push(part);
 sums[0]+=r.length;sums[1]+=m/3;
}
header.writeUInt16LE(names.length,4);header.writeUInt32LE(16+parts.reduce((s,p)=>s+p.length,0),8);
const raw=Buffer.concat([header,...parts]);
const zipped=gzipSync(raw,{level:9}),sha=b=>createHash('sha256').update(b).digest('hex');
const record={asset:'green-gables-barn-v1.bin.gz',wireBytes:zipped.length,decodedBytes:raw.length,
 wireSha:sha(zipped),sha:sha(raw),vertices:sums[0],triangles:sums[1],materials:names,localXZ:[a,b,c,d]};
mkdirSync('public/art',{recursive:true});
writeFileSync('public/art/'+record.asset,zipped);
writeFileSync('src/render/green-gables-barn-asset.ts','// Original authored numerical art. No photographs or raw point cloud data.\nexport const GREEN_GABLES_BARN_ASSET='+JSON.stringify(record)+' as const;\n');
console.log(JSON.stringify(record,null,2));
