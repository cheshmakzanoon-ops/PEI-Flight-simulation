/** Rebuild this original, unquantized five-part authored mesh from the unchanged
 * game's regular N112 grade. No third-party imagery, external service or new survey. */
import {readFileSync as read,writeFileSync as write,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {Terrain} from '../../src/sim/terrain.ts';
import {regularRoadGround} from '../../src/render/road-contact.ts';
import {makeDalvayExterior} from '../../src/render/dalvay-exterior-art.ts';
const root=fileURLToPath(new URL('../..',import.meta.url)),out=resolve(process.argv[2]??join(root,'public/art')),w=join(root,'public/world'),sha=b=>createHash('sha256').update(b).digest('hex');
const spec=JSON.parse(read(join(w,'terrain.json'))),r=gunzipSync(read(join(w,spec.file)));
const terrain=new Terrain(spec,new Int16Array(r.buffer,r.byteOffset,r.byteLength/2)),art=makeDalvayExterior(regularRoadGround(terrain)),chunks=[],manifest=[],header=Buffer.alloc(16),name='dalvay-manor-exterior-v2.dvx';
header.write('DVX1');header.writeUInt32LE(1,4);header.writeUInt32LE(5,8);chunks.push(header);
for(const [i,m] of art.group.children.entries()){
 const geom=m.geometry,triAttrs=['position','normal','color','uv'].map(s=>geom.getAttribute(s));
 const input=triAttrs.map(a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)),unrolled=triAttrs[0].count;
 const offsets=[3,3,3,2],unique=new Map(),gather=[[],[],[],[]],indices=[];
 for(let j=0;j<unrolled;j++){
  const values=input.map((a,k)=>a.subarray(j*4*offsets[k],(j+1)*4*offsets[k]));
  const key=Buffer.concat(values).toString('base64');let slot=unique.get(key);
  if(slot===undefined){slot=unique.size;unique.set(key,slot);for(let k=0;k<4;k++)gather[k].push(values[k]);}
  indices.push(slot);
 }
 if(unique.size>=65535||indices.length%3)throw Error('Mesh too large');
 const tag=Buffer.alloc(16);tag.writeUInt32LE(i,0);tag.writeUInt32LE(unique.size,4);tag.writeUInt32LE(indices.length,8);
 const attrs=gather.map(s=>Buffer.concat(s)),ind=Buffer.alloc(Math.ceil(indices.length/2)*4);indices.forEach((idx,k)=>ind.writeUInt16LE(idx,k*2));
 // Independently re-expand every IEEE component before writing the packet.
 for(let k=0;k<4;k++){const out=Buffer.alloc(input[k].length),size=4*offsets[k];indices.forEach((id,j)=>attrs[k].copy(out,j*size,id*size,(id+1)*size));if(!out.equals(input[k]))throw Error('Not a lossless reconstruction');}
 chunks.push(tag,...attrs,ind);manifest.push({material:m.name.slice('Dalvay · '.length),vertices:unique.size,indices:indices.length,expandedSHA256:input.map(sha)});
}
const raw=Buffer.concat(chunks);raw.writeUInt32LE(raw.length,12);const wire=gzipSync(raw,{level:9});
mkdirSync(out,{recursive:true});write(join(out,name),wire);console.log(JSON.stringify({file:name,wire:wire.length,raw:raw.length,wireHash:sha(wire),rawHash:sha(raw),origin:art.group.position.toArray(),parts:manifest},null,2));art.dispose();
