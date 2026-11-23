import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import * as THREE from 'three';
import {decodeRoads,Roads} from '../src/render/roads.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {project} from '../src/sim/geo.ts';
import {matchesVictoriaPaving,victoriaPavingCoordinates,victoriaPavingWeight,VICTORIA_PAVER_ATLAS,
 VICTORIA_PAVER_KIND,VICTORIA_PAVER_FLAG,VICTORIA_PAVER_LIMITS} from '../src/render/victoria-pavers.ts';

const file=(name:string)=>readFileSync(new URL('../public/world/'+name,import.meta.url));
const bytes=gunzipSync(file('roads.bin.gz'));
const hash=createHash('sha256').update(bytes).digest('hex');
const road=decodeRoads(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
test('only one paved NRN row with exact pinned digest, index, width class and endpoint order can opt in',()=>{
 assert.equal(hash,VICTORIA_PAVER_ATLAS);
 const indices=road.flatMap(({flags,points},i)=>matchesVictoriaPaving(hash,i,flags,points)?[i]:[]);
 assert.deepEqual(indices,[619]);
 const {flags,points}=road[619];
 assert(!matchesVictoriaPaving(hash,618,flags,points));
 assert(!matchesVictoriaPaving('0'.repeat(64),619,flags,points));
 assert(!matchesVictoriaPaving(undefined,619,flags,points));
 assert(!matchesVictoriaPaving(hash,619,flags|8<<1,points));
 assert(!matchesVictoriaPaving(hash,619,flags,points.slice().reverse()));
 assert(!matchesVictoriaPaving(hash,619,flags,[{x:points[0].x+.002,z:points[0].z},points[1]]));
});

test('positive weights stay inside the surveyed road core and far from both intersections',()=>{
 const a=project(-63.1269576,46.2337761),b=project(-63.1257269,46.2345471);
 const d=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/d,dz=(b.z-a.z)/d;
 const w=road[619].points.map(p=>victoriaPavingCoordinates(p.x,p.z));
 assert(VICTORIA_PAVER_LIMITS[0]-w[0][0]>21.);
 assert(w[1][0]-VICTORIA_PAVER_LIMITS[1]>22.);
 let within=0,outside=0;
 for(let t=-10;t<142;t+=.23)for(let q=-4;q<4;q+=.12){
  const x=a.x+dx*t-dz*q,z=a.z+dz*t+dx*q;
  const weight=victoriaPavingWeight(x,z);
  assert(Number.isFinite(weight)&&weight>=0&&weight<=1);
  if(t<=8||t>=120||q<=-2.88||q>=2.49){assert.equal(weight,0);outside++;}
  else{assert(weight>0);within++;}
 }
 assert(within>19000&&outside>12500);
 assert(VICTORIA_PAVER_LIMITS[2]>=-3.15+.26&&VICTORIA_PAVER_LIMITS[3]<=2.70-.2);
});

test('actual Three road strips preserve every position, color, edge, normal and seat value',()=>{
 const dem=JSON.parse(file('terrain.json').toString());
 const h=gunzipSync(file(dem.file));
 const terrain=new Terrain(dem,new Int16Array(h.buffer.slice(h.byteOffset,h.byteOffset+h.byteLength)));
 const W=Roads as any;
 const r=new W(new THREE.Scene(),new Map(),terrain,undefined,undefined,hash,{
  terrain,cover:{distance:()=>200}
 });
 const {flags,points:[a,b]}=road[619];
 const tile={x:7500,z:27500,segments:[a.x,a.z,b.x,b.z,flags]};
 const marked={...tile,segments:[a.x,a.z,b.x,b.z,flags|VICTORIA_PAVER_FLAG]};
 const shape=(t:typeof tile,seated:boolean,cooperate:boolean)=>{
  if(!cooperate)return r.mesh(t,[],seated).geometry as THREE.BufferGeometry;
  const it=r.meshSteps(t,[],seated,true);
  let n=it.next();while(!n.done)n=it.next();
  return n.value.geometry as THREE.BufferGeometry;
 };
 for(const [seated,cooperate] of [[false,false],[true,false],[true,true]]){
 const left=shape(tile,seated,cooperate),right=shape(marked,seated,cooperate);
 for(const [key,buf] of Object.entries(left.attributes)){
  const other=right.getAttribute(key);
  if(key!=='roadSurface')assert.deepEqual(other.array,(buf as THREE.BufferAttribute).array,key);
  else{
   const v=buf as THREE.BufferAttribute;
   const physical=seated?Math.fround:(n:number)=>n;
   assert(v.count>0);
   for(let i=0;i<v.count;i++){
    assert.equal(v.getX(i),other.getX(i));
    assert.equal(v.getY(i),physical(64/127));
    assert.equal(other.getY(i),physical(VICTORIA_PAVER_KIND/127));
   }
  }
 }
 assert.deepEqual(left.boundingSphere,right.boundingSphere);
 if(seated)assert(left.getAttribute('roadSeatDelta').array.some(x=>Math.abs(x)>.02));
 left.dispose();right.dispose();
 }
});
