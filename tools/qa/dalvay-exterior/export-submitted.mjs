/** Export the exact unrolled five decoded render batches, their true world transforms and
 * semantic triangle IDs. No external source, photographic reference or survey Z. */
import {readFileSync as R,writeFileSync as W,mkdirSync} from 'node:fs';import{createHash}from'node:crypto';import{gunzipSync as G}from'node:zlib';import{resolve,join}from'node:path';import{fileURLToPath}from'node:url';
import{DALVAY_PACKET as A}from'../../../src/render/dalvay-manor.generated.ts';import{decodeDalvay}from'../../../src/render/dalvay-art-packet.ts';
import{Terrain}from'../../../src/sim/terrain.ts';import{regularRoadGround}from'../../../src/render/road-contact.ts';import{makeDalvayExterior}from'../../../src/render/dalvay-exterior-art.ts';
const root=fileURLToPath(new URL('../../..',import.meta.url)),out=resolve(process.argv[2]??'/tmp/pei-dalvay-render-export'),sha=b=>createHash('sha256').update(b).digest('hex');
const wire=R(join(root,'public/art',A.file)),raw=G(wire);if(sha(wire)!==A.wireHash||sha(raw)!==A.rawHash)throw Error('Asset hash');
const art=decodeDalvay(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));if(!art)throw Error('Invalid');
const world=join(root,'public/world'),t=JSON.parse(R(join(world,'terrain.json'))),q=G(R(join(world,t.file))),terrain=new Terrain(t,new Int16Array(q.buffer,q.byteOffset,q.byteLength/2)),native=makeDalvayExterior(regularRoadGround(terrain)),data=native.group.userData.dalvayGeometry;
const sources=[];mkdirSync(out,{recursive:true});art.group.updateMatrixWorld(true);
for(const [i,m]of art.group.children.entries()){
 const gt=m.geometry,base=native.group.children[i].geometry,ix=gt.index.array,attrs={};
 for(const name of['position','normal','color','uv']){const a=gt.getAttribute(name),n=a.itemSize,v=a.array,expanded=new Float32Array(ix.length*n);
  for(let j=0;j<ix.length;j++)for(let k=0;k<n;k++)expanded[j*n+k]=v[ix[j]*n+k];
  const b=Buffer.from(expanded.buffer),orig=base.getAttribute(name).array;if(!b.equals(Buffer.from(orig.buffer,orig.byteOffset,orig.byteLength)))throw Error('Changed original '+name);
  W(join(out,i+'-'+name+'.f32'),b);attrs[name]={components:n,expandedSHA:sha(b)};
 }
 W(join(out,i+'-index.u16'),Buffer.from(ix.buffer,ix.byteOffset,ix.byteLength));sources.push({role:m.name,matrixWorld:m.matrixWorld.toArray(),vertices:gt.getAttribute('position').count,triangles:ix.length/3,attrs});
}
const feet=data.groundFeatures.map(g=>{const m=art.group.children[0],geo=m.geometry,p=geo.getAttribute('position'),index=geo.index;
 const actual=ids=>ids.map(k=>{const id=index.getX(k);return {indexOffset:k,actualIndexedVertex:id,actualRelativeXYZ:[p.getX(id),p.getY(id),p.getZ(id)]};});
 return {role:g.role,part:0,firstTriangle:g.firstTriangle,triangles:g.triangles,lower:actual(g.lowerVertices),upperFront:g.upperEdgeVertices?actual(g.upperEdgeVertices):undefined};});
W(join(out,'submitted.json'),JSON.stringify({source:'Exact authenticated package, native expanded attributes & true matrixWorld. All triangle ranges refer to sequential draw triangles within the named part. Foot positions are actual Float32 attribute values, not construction guide points. World y = relative y + supplied world translation (original game terrain, not a new geodetic datum).',pack:A,parts:sources,seatFeatures:feet,architecturalFeatures:data.architecturalFeatures,roofForms:data.roofForms,wallRanges:data.wallRanges,roofRanges:data.roofTriangleRanges},null,2)+'\n');
console.log(sha(R(join(out,'submitted.json'))),feet.length,sources.map(q=>q.triangles));art.dispose();native.dispose();
