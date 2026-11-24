/** Review-only exact Three.js meshes and generated texels. No app or browser runtime. */
import * as T from 'three';
import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
import {deflateSync} from 'node:zlib';
import {buildRailStation} from '../src/station.ts';
import {makeTile,recipes,roles} from '../src/materials.ts';
import {DATUM} from '../src/survey.ts';
const out=process.env.RAIL_EXPORT??fileURLToPath(new URL('../review/native-input/',import.meta.url));
const path=pathToFileURL(resolve(out)+sep);
fs.mkdirSync(path,{recursive:true});
const g=buildRailStation(false);
function crc32(a:Buffer){
 let x=~0;
 for(const b of a){x^=b;for(let k=0;k<8;k++)x=x>>>1^(-(x&1)&0xedb88320);}
 return ~x>>>0;
}
function chunk(name:string,a:Buffer){
 const h=Buffer.alloc(8),end=Buffer.alloc(4);h.writeUInt32BE(a.length);h.write(name,4,'ascii');
 const id=Buffer.concat([h.subarray(4),a]);end.writeUInt32BE(crc32(id));
 return Buffer.concat([h,a,end]);
}
function png(samples:Uint8Array,size:number){
 const h=Buffer.alloc(13);h.writeUInt32BE(size);h.writeUInt32BE(size,4);h[8]=8;h[9]=6;
 const strain=size*4,d=Buffer.alloc((strain+1)*size);
 for(let y=0;y<size;y++)d.set(samples.subarray((size-y-1)*strain,(size-y)*strain),y*(strain+1)+1);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(d,{level:8})),chunk('IEND',Buffer.alloc(0))]);
}
const palette=Object.fromEntries(roles.map(r=>{
 const tile=makeTile(r);if(tile)fs.writeFileSync(new URL(r+'.png',path),png(tile.samples,tile.size));
 return [r,{...recipes[r],scale:tile?.scale,src:tile?(r+'.png'):undefined}];
}));
const data=(g.children as T.Mesh[]).map(m=>{
 const q=m.geometry as T.BufferGeometry;
 return {name:m.name,xyz:Array.from(q.getAttribute('position').array),normal:Array.from(q.getAttribute('normal').array),
  uv:Array.from(q.getAttribute('uv').array),tone:Array.from(q.getAttribute('color').array),ix:Array.from(q.getIndex()!.array)};
});
fs.writeFileSync(new URL('three-buffer-export.json',path),JSON.stringify({datum:DATUM,palette,data})+'\n');
console.log(data.length,'exact Three.js material groups, original generated texture review inputs');
