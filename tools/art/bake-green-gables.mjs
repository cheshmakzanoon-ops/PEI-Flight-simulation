/** Bake original authored Green Gables exterior. Source points and photo pixels are not included.
 * Run at project root: node --experimental-strip-types tools/art/bake-green-gables.mjs */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {buildGreenGables} from './green-gables-model.ts';
import {paints} from '../../src/render/green-gables-materials.ts';
import {GREEN_GABLES_REVIEW as S} from '../../src/render/green-gables-review-spec.ts';
const colors=Object.keys(paints),model=buildGreenGables({stairs:false,foundationToe:1.09}).model;
const fields=['position','normal','uv'],parts=[],names=[],sums=[0,0],roles={};
const h=Buffer.alloc(16);h.write('GGB2');h.writeUInt16LE(2,6);
for(const [paint,key] of colors.entries()){
 const children=model.children.filter(m=>m.name.endsWith('/'+key));
 if(!children.length)continue;
 const idx=[],old=[],lookup=new Map();
 for(const m of children){
  const a=fields.map(k=>m.geometry.attributes[k].array),count=a[0].length/3,start=idx.length;
  if(!Number.isInteger(count)||count%3||a[1].length!==count*3||a[2].length!==count*2)throw Error('Bad authored attributes');
  const w=a.map(n=>new Uint32Array(n.buffer,n.byteOffset,n.length));
  for(let i=0;i<count;i++){
   const p=i*3,uv=i*2,[x,y,z]=a[0].slice(p,p+3);
   if(!Number.isFinite(x+y+z)||S.maximumXZ[0][0]>x||x>S.maximumXZ[0][1]||S.maximumXZ[1][0]>z||z>S.maximumXZ[1][1]||y< -1.091||y>9.1)throw Error(['Unqualified extent',m.name,x,y,z].join(' '));
   const bits=[w[0][p],w[0][p+1],w[0][p+2],w[1][p],w[1][p+1],w[1][p+2],w[2][uv],w[2][uv+1]],tie=bits.join(',');
   let q=lookup.get(tie);if(q===undefined){q=old.length;lookup.set(tie,q);old.push(bits);}idx.push(q);
  }
  if(Object.hasOwn(roles,m.name))throw Error('Unqualified duplicate semantic batch: '+m.name);
  roles[m.name]=[key,start/3,idx.length/3];
 }
 if(old.length>65535||old.length<3)throw Error('Art batch overflow');
 const part=Buffer.alloc(12+old.length*32+Math.ceil(idx.length*2/4)*4);
 part.writeUInt16LE(paint);part.writeUInt16LE(parts.length,2);part.writeUInt16LE(old.length,4);part.writeUInt32LE(idx.length,8);
 let at=12;for(let i=0;i<8;){const stop=i+(i<6?3:2);for(const v of old)for(let j=i;j<stop;j++){part.writeUInt32LE(v[j],at);at+=4;}i=stop;}
 for(const q of idx){part.writeUInt16LE(q,at);at+=2;}
 parts.push(part);names.push(key);sums[0]+=old.length;sums[1]+=idx.length/3;
}
h.writeUInt16LE(parts.length,4);h.writeUInt32LE(16+parts.reduce((x,p)=>x+p.length,0),8);
const raw=Buffer.concat([h,...parts]),packed=gzipSync(raw,{level:9});const sha=b=>createHash('sha256').update(b).digest('hex');
const fingerprint={asset:'green-gables-v3.bin.gz',wireBytes:packed.length,decodedBytes:raw.length,sha:sha(raw),wireSha:sha(packed),vertices:sums[0],triangles:sums[1],materials:names};
mkdirSync('public/art',{recursive:true});mkdirSync('test/fixtures',{recursive:true});
writeFileSync('public/art/'+fingerprint.asset,packed);
writeFileSync('src/render/green-gables-review-asset.ts','// Original art compiled offline; no donor images or point cloud bytes.\nexport const GREEN_GABLES_ASSET='+JSON.stringify(fingerprint)+' as const;\n');
writeFileSync('test/fixtures/green-gables-triangle-ranges.json',JSON.stringify(roles,null,2)+'\n');
console.log(JSON.stringify(fingerprint,null,2));
