import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {ReliefSeed} from '../../src/sim/relief-seed.ts';
import {adaptiveGround} from '../../src/render/adaptive-ground.ts';
const root='public/world/',dir=root+'terrain-adaptive/v1/';
const tr=JSON.parse(readFileSync(root+'terrain.json')),zip=gunzipSync(readFileSync(root+tr.file));
const terrain=new Terrain(tr,new Int16Array(zip.buffer,zip.byteOffset,zip.byteLength/2));
const catalog=JSON.parse(readFileSync(dir+'index.json'));
const out=[];
for(const id of ['11-11','13-16','22-20']){
 const q=catalog.tiles.find(a=>a.id===id),pack=readFileSync(dir+catalog.packs[q.pack].file);
 if(!q)throw Error('Expected protected sample tile not present');
 const raw=gunzipSync(pack.subarray(q.offset,q.offset+q.bytes)),sample=new ReliefSeed(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),true,q.cells);
 const [i,j]=id.split('-').map(Number),w=(terrain.right-terrain.left)/32,d=(terrain.bottom-terrain.top)/22;
 const x=terrain.left+i*w,z=terrain.top+j*d;
 const original=new THREE.PlaneGeometry(w,d,112,112);original.rotateX(-Math.PI/2);
 const a=original.getAttribute('position'),uv=original.getAttribute('uv');
 for(let k=0;k<a.count;k++){
  const px=x+w/2+a.getX(k),pz=z+d/2+a.getZ(k),[u,v]=terrain.uv(px,pz);
  a.setY(k,terrain.atlasElevation(px,pz)+.12);uv.setXY(k,u,v);
 }
 const timing=[];
 let shape;
 for(let r=0;r<25;r++){
  const now=performance.now(),p=adaptiveGround(original,sample,terrain,x,z,w,d);
  const time=performance.now()-now;
  if(r>=5)timing.push(time);
  shape={cells:p.relief.refinedCells,vertices:p.geometry.getAttribute('position').count,
    tris:p.geometry.index.count/3,originalTris:original.index.count/3,indexType:p.geometry.index.array.constructor.name,
    geometryArrayBytes:p.geometry.getAttribute('position').array.byteLength+p.geometry.getAttribute('uv').array.byteLength+p.geometry.index.array.byteLength,
    originalArrayBytes:original.getAttribute('position').array.byteLength+original.getAttribute('uv').array.byteLength+original.index.array.byteLength};
  p.geometry.dispose();
 }
 timing.sort((a,b)=>a-b);
 original.dispose();out.push({id,timing:{medianMS:timing[10],p95MS:timing[18],maxMS:timing.at(-1)},...shape});
}
console.log(JSON.stringify(out,null,2));
