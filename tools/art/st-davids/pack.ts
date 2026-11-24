/** Off-line numerical exporter; never shipped in the game or run on arrival. */
import * as T from 'three';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildStDavids} from './author/church.ts';
import {makeTile,recipes,type Role} from './author/materials.ts';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const root=new URL('../../../',import.meta.url),artist=new URL('./',import.meta.url);const write=(p:string,data:string|Buffer)=>fs.writeFileSync(new URL(p,root),data);
const read=(p:string)=>fs.readFileSync(new URL(p,root));
for(const entry of fs.readFileSync(new URL('AUTHOR_SHA256.txt',artist),'utf8').trim().split('\n')){
 const [expected,x]=entry.split(/\s+/,2);if(sha(fs.readFileSync(new URL(x,artist)))!==expected)throw Error('unexpected detached author snapshot '+x);
}
if(new Uint16Array(new Uint8Array([1,0]).buffer)[0]!==1)throw Error('little-endian pack only');
const all=buildStDavids({procedural:false,includeRearPorch:false});
const stages=all.children as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[];
const head=Buffer.alloc(16);head.write('SDAV');head.writeUInt16LE(1,4);head.writeUInt16LE(stages.length,6);
const body=[head];const parts=[];
let n=0;
for(const [j,m]of stages.entries()){
 const q=m.geometry,ix=q.getIndex()!,p=q.getAttribute('position'),pRole=m.name as Role,r=recipes[pRole],tile=makeTile(pRole);
 const rec={name:m.name,nv:p.count,ni:ix.count,textureSize:tile?.size??0,rgb:r.colour,rough:r.roughness,metal:r.metalness,repeat:tile?.scale};parts.push(rec);
 const part=Buffer.alloc(16);part.writeUInt16LE(j,0);part.writeUInt16LE(p.count,2);part.writeUInt32LE(ix.count,4);part.writeUInt32LE(rec.textureSize,8);body.push(part);
 for(const k of ['position','normal','uv','color']){
  const v=q.getAttribute(k).array;
  if(!(v instanceof Float32Array))throw Error('unexpected geometry matrix');
  body.push(Buffer.from(v.buffer,v.byteOffset,v.byteLength));
 }
 if(!(ix.array instanceof Uint16Array)||p.count>=65536)throw Error('unexpected index size');
 body.push(Buffer.from(ix.array.buffer,ix.array.byteOffset,ix.array.byteLength));
 if(ix.count%2)body.push(Buffer.alloc(2));
 if(tile)body.push(Buffer.from(tile.samples));
 n+=ix.count/3;
}
const size=body.reduce((s,b)=>s+b.length,0);head.writeUInt32LE(size,8);
const raw=Buffer.concat(body),packed=zlib.gzipSync(raw,{level:9});
const file='st-davids-B3-v1.bin.gz';
const meta={file,raw:raw.length,wire:packed.length,rawSha:sha(raw),wireSha:sha(packed),triangles:n,parts,
 authorFreeze:'96da3942e311841da4d3c34070ece214ef9de04f7645788a8c0d08e12d8ce1e6'};
const module='// Verified authored B3, no detached porch, no donor imagery.\nexport const ST_DAVIDS_ART='+JSON.stringify(meta,null,1)+' as const;\n';
if(process.argv.includes('--write')){
 write('public/art/'+file,packed);write('src/render/st-davids/art.generated.ts',module);
}else if(!read('public/art/'+file).equals(packed)||read('src/render/st-davids/art.generated.ts').toString()!==module){
 throw Error('The checked-in artwork or manifest does not reproduce from the exact owner-only B3 artist source.');
}
console.log(JSON.stringify({...meta,parts:parts.length}));
