/** Reproduce the exact original O'Leary study. No source photo, network, CAD scan or extra terrain. */
import {readFileSync as R,writeFileSync as W,mkdirSync}from'node:fs';import{fileURLToPath}from'node:url';import{resolve,join}from'node:path';
import{gunzipSync as G,gzipSync as Z}from'node:zlib';import{createHash}from'node:crypto';
import{Terrain}from'../../src/sim/terrain.ts';import{makeOlearyExterior}from'../../src/render/oleary-railway/exterior.ts';
const root=fileURLToPath(new URL('../..',import.meta.url)),world=join(root,'public/world'),dst=resolve(process.argv[2]??'/tmp/oleary-packet');
const s=JSON.parse(R(join(world,'terrain.json'))),buf=G(R(join(world,s.file))),T=new Terrain(s,new Int16Array(buf.buffer,buf.byteOffset,buf.length/2)),model=makeOlearyExterior(T);
const file='oleary-railway-exterior-v1.olx',sha=b=>createHash('sha256').update(b).digest('hex'),keys=['position','normal','color','uv'],widths=[3,3,3,2],lanes=['foundation','clapboard','timber','roof','glazing'];
const hdr=Buffer.alloc(16),chunks=[hdr],parts=[];hdr.writeUInt32LE(0x31584c4f,0);hdr.writeUInt32LE(1,4);hdr.writeUInt32LE(5,8);
for(const [i,q]of model.group.children.entries()){
 const g=q.geometry,attr=keys.map(k=>g.getAttribute(k).array),bits=attr.map(p=>new Uint32Array(p.buffer,p.byteOffset,p.length));
 const n=g.getAttribute('position').count,index=new Uint16Array(n),out=keys.map(()=>[]),memo=new Map();
 for(let j=0;j<n;j++){
  const key=bits.map((p,k)=>p.subarray(j*widths[k],(j+1)*widths[k]).join(',')).join('|');
  let a=memo.get(key);if(a===undefined){a=memo.size;if(a>=65535)throw Error('Keep the asset on the bounded U16 lane');
   memo.set(key,a);for(const [k,p]of bits.entries())out[k].push(...p.subarray(j*widths[k],(j+1)*widths[k]));
  }index[j]=a;
 }
 const head=Buffer.alloc(16);head.writeUInt32LE(i,0);head.writeUInt32LE(memo.size,4);head.writeUInt32LE(n,8);
 const ix=Buffer.alloc((n+(n%2))*2);for(let j=0;j<n;j++)ix.writeUInt16LE(index[j],j*2);
 chunks.push(head,...out.map(a=>Buffer.from(Uint32Array.from(a).buffer)),ix);
 parts.push({id:lanes[i],vertices:memo.size,indices:n,expandedSourceSHA256:attr.map(v=>sha(Buffer.from(v.buffer,v.byteOffset,v.byteLength)))});
}
const raw=Buffer.concat(chunks);raw.writeUInt32LE(raw.length,12);
const packed=Z(raw,{level:9});if(packed.length>320000||raw.length>1200000)throw Error('Exceeds estate payload budget');
const receipt={file,bytes:packed.length,raw:raw.length,packedSHA256:sha(packed),rawSHA256:sha(raw),origin:model.group.position.toArray(),parts};
mkdirSync(dst,{recursive:true});W(join(dst,file),packed);
W(join(dst,'packet.generated.ts'),'/** Original authored game mesh; reproduce with tools/art/pack-oleary-exterior.mjs. */\nexport const OLEARY_PACKET='+JSON.stringify(receipt)+' as const;\n');
console.log(JSON.stringify(receipt,null,2));model.dispose();
