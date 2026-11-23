/** Export actual Three cap coverage, ghost/alias guards and a dynamic seating witness. */
import * as THREE from 'three';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {MAPPED_PARKING} from '../../src/render/parking-surfaces.generated.ts';
import {decodeParkingSurfaces,parkingGeometry,seatParking} from '../../src/render/parking-surfaces.ts';
import {sidewalkGrid} from '../../src/render/sidewalks.ts';
import {RUNWAYS} from '../../src/sim/places.ts';
import {addBasilica} from '../../src/render/basilica.ts';

const root=new URL('../../public/world/',import.meta.url);
const open=name=>readFileSync(new URL(name,root));
const packet=gunzipSync(open(MAPPED_PARKING.asset));
const copy=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const tiles=decodeParkingSurfaces(copy(packet));
const sp=JSON.parse(open('terrain.json')),terrain=new Terrain(sp,new Int16Array(copy(gunzipSync(open(sp.file)))));
const c=JSON.parse(open('cover.json')),cover=new Cover(c.width,c.height,gunzipSync(open(c.file)));
const [rows,point]=[[],new THREE.Vector3()];
const scene=new THREE.Scene(),special=addBasilica(scene,terrain);
special.updateMatrixWorld(true);
const pts=[];
for(const o of special.children)if(o.isMesh){
 const a=o.geometry.getAttribute('position');
 for(let j=0;j<a.count;j++){point.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld);pts.push([point.x,point.z]);}
}
function hull(p){
 p.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const A=[],B=[];
 const det=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 let previous=[];
 for(const r of p){
  if(previous[0]===r[0]&&previous[1]===r[1])continue;
  while(A.length>=2&&det(A.at(-2),A.at(-1),r)<=0)A.pop();
  A.push(r);previous=r;
 }
 previous=[];
 for(const r of p.slice().reverse()){
  if(previous[0]===r[0]&&previous[1]===r[1])continue;
  while(B.length>=2&&det(B.at(-2),B.at(-1),r)<=0)B.pop();
  B.push(r);previous=r;
 }
 return A.slice(0,-1).concat(B.slice(0,-1));
}
const extra=[['authored cathedral',hull(pts)]];
for(const [i,r] of RUNWAYS.entries()){
 const [x,z]=[r.p.x,r.p.z],ex=x+r.dx*r.length,ez=z+r.dz*r.length,
  u=r.dz*r.width*.5,v=-r.dx*r.width*.5;
 extra.push(['runway '+i,[[x+u,z+v],[x-u,z-v],[ex-u,ez-v],[ex+u,ez+v]]]);
}
let faces=0,flips=0,maxSeatError=0,points=0;
for(const tile of tiles){
 const model=parkingGeometry(tile,terrain,(x,z)=>cover.distance(terrain,x,z)>=.55);
 const p=model.geometry.getAttribute('position'),a=model.geometry.getAttribute('parkLayer'),tot=p.count/3;
 const areas=new Array(7).fill(0);
 faces+=tot;points+=p.count;
 const grid=sidewalkGrid(terrain);
 const h=(i,j)=>4*Math.cos(i*.43)+1.4*Math.sin(j*.82)+5*Math.sin(i*.71+j*.44);
 for(const ratio of [1,2,14]){
  const ground=(x,z)=>{
   const a=(x-grid.x0)/(grid.dx*ratio),b=(z-grid.z0)/(grid.dz*ratio),i=Math.floor(a),j=Math.floor(b),u=a-i,v=b-j;
   return u+v<=1?h(i,j)*(1-u-v)+h(i+1,j)*u+h(i,j+1)*v:
    h(i+1,j+1)*(u+v-1)+h(i+1,j)*(1-v)+h(i,j+1)*(1-u);
  };
  seatParking(model,tile,ground);
  const n=model.geometry.getAttribute('normal');
  for(let i=0;i<p.count;i+=3){
   const x=p.getX(i),z=p.getZ(i),dx=p.getX(i+1)-x,dz=p.getZ(i+1)-z,ex=p.getX(i+2)-x,ez=p.getZ(i+2)-z;
   if(ratio===1)areas[a.getX(i)]+=Math.abs(dx*ez-dz*ex)*.5;
   if(n.getY(i)<=0&&Math.abs(dx*ez-dz*ex)>1e-6)flips++;
   const t=(q)=>q(i)*.23+q(i+1)*.38+q(i+2)*.39;
   const X=tile.ox+t(k=>p.getX(k)),Z=tile.oz+t(k=>p.getZ(k)),Y=t(k=>p.getY(k)),lift=t(k=>model.lift[k]);
   maxSeatError=Math.max(maxSeatError,Math.abs(Y-ground(X,Z)-lift));
  }
 }
 rows.push({id:tile.id,ox:tile.ox,oz:tile.oz,lots:tile.lots,areas,triangles:tot});
}
const stat={tiles:tiles.length,faces,points,maxSeatError,flips,biggestTile:Math.max(...rows.map(a=>a.triangles))};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({stat,extra,rows})+'\n');
console.log(JSON.stringify(stat));
if(flips||maxSeatError>.002)process.exitCode=1;
