/** Check actual Three.js streamed batch, immutable neighbors and blind native roof hits. */
import * as THREE from 'three';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Buildings} from '../../src/render/buildings.ts';
import {WATER_STREET_PLAN as plan} from '../../src/render/water-street.generated.ts';
const bin=url=>readFileSync(new URL('../../public/world/'+url,import.meta.url));
const shape=url=>JSON.parse(bin(url));
const ts=shape('terrain.json'),bytes=gunzipSync(bin(ts.file)),terrain=new Terrain(ts,new Int16Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));
const atlas=shape('buildings/index.json'),tile=atlas.tiles.find(x=>x.id===plan.tile);
const raw=bin('buildings/tiles.pack'),p=JSON.parse(gunzipSync(raw.subarray(tile.offset,tile.offset+tile.bytes))).features;
const mask=new Set(plan.shells.map(r=>r.i)),unrelated=p.map((x,i)=>mask.has(i)?{...x,footprint:[]}:x);
const br=(enabled)=>{
 const scene=new THREE.Scene();if(enabled)scene.environment=new THREE.Texture();
 const z=new Buildings(scene,terrain,atlas.tiles,undefined,atlas.sha256);
 return (f)=>z.generate(f,z.tiles.find(t=>t.id===tile.id));
};
const render=br(true),prior=br(false);
const all=render(p),old=prior(p),control=prior(unrelated);
for(const m of [all,old,control])m.updateMatrixWorld();
const attrs=Object.keys(control.geometry.attributes),n=control.geometry.getAttribute('position').count;
const styles=all.geometry.getAttribute('facadeStyle');
const matched=[];
for(let i=0;i<styles.count;i++)if(styles.getX(i)<13)matched.push(i);
if(matched.length!==n)throw Error('Neighbor length mismatch');
for(const attribute of attrs){
 const a=all.geometry.getAttribute(attribute),b=control.geometry.getAttribute(attribute);
 for(let i=0;i<n;i++)for(let j=0;j<b.itemSize;j++){
  if(!Object.is(a.array[matched[i]*a.itemSize+j],b.array[i*b.itemSize+j]))throw Error(`Neighbor changed: ${attribute} ${i} ${j}`);
 }
}
const ray=new THREE.Raycaster(),a=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
const role=all.geometry.getAttribute('topFlag'),oldRole=old.geometry.getAttribute('topFlag');
const tests=JSON.parse(readFileSync(process.argv[2],'utf8'));
let misses=0,ties=0;
const out=[];
const p90=a=>a.slice().sort((x,y)=>x-y)[Math.floor((a.length-1)*.90)];
const hit=(m,r,newer)=>{
 let hs=ray.intersectObject(m).filter(x=>newer?r.getX(x.face.a)===21:r.getX(x.face.a)===1);
 return hs;
};
for(const [ord,src] of tests){
 const es=[],os=[],disp=[];
 for(const [x,z,h] of src){
  ray.set(a.set(x,62,z),down);
  const ha=hit(all,role,true),hb=hit(old,oldRole,false);
  if(!ha.length||!hb.length){misses++;continue;}
  if(ha.some(x=>Math.abs(x.point.y-ha[0].point.y)>.00025))ties++;
  es.push(Math.abs(ha[0].point.y-h));os.push(Math.abs(hb[0].point.y-h));
  disp.push({x,z,h,old:hb[0].point.y,next:ha[0].point.y});
 }
 out.push({ord,n:src.length,nUsed:es.length,oldP90:p90(os),newP90:p90(es)});
}
const report={tile:tile.id,neighbors:n,protectedAttributes:attrs,baseTriangles:old.geometry.getAttribute('position').count/3,
 newTriangles:styles.count/3,exactRoofFaces:Array.from(role.array).filter(x=>x===21).length/3,missing:misses,ties,out};
console.log(JSON.stringify(report,null,2));
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
if(misses||ties)process.exitCode=1;
