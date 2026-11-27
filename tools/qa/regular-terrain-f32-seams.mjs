/** Source audit of model transform roundoff, not a pixel or collision test. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PlaneGeometry} from 'three';
import {project} from '../../src/sim/geo.ts';

const F=Math.fround;
const manifest=JSON.parse(readFileSync(new URL('../../public/world/terrain.json',import.meta.url),'utf8'));
const [west,south,east,north]=manifest.bounds;
const a=project(west,north),b=project(east,south);
const w=(b.x-a.x)/32,h=(b.z-a.z)/22;
let ext;
for(const n of [8,56,112]){
 const g=new PlaneGeometry(w,h,n,n).rotateX(-Math.PI/2),p=g.getAttribute('position');
 const e=[p.getX(0),p.getX(n),p.getZ(0),p.getZ(n*(n+1))];
 if(ext)assert.deepEqual(e,ext,'regular Three.js LODs share exact Float32 endpoint offsets');
 ext=e;g.dispose();
}
const dim=(lo,hi,cols,lower,upper)=>{
 const size=(hi-lo)/cols;
 const rows=Array.from({length:cols-1},(_,i)=>{
  const edge=i+1,mid=col=>lo+size*col+size/2;
  const left=F(F(mid(edge-1))+upper),right=F(F(mid(edge))+lower);
  return {edge,canonical:F(lo+size*edge),fromPrevious:left,fromNext:right,gapM:right-left};
 });
 return {positive:rows.filter(x=>x.gapM>0).length,overlap:rows.filter(x=>x.gapM<0).length,
  exact:rows.filter(x=>x.gapM===0).length,rows};
};
const x=dim(a.x,b.x,32,ext[0],ext[1]),z=dim(a.z,b.z,22,ext[2],ext[3]);
console.log(JSON.stringify({bounds:manifest.bounds,offsets:ext,worldTransform:{x,z},
 scope:'Only the stock regular mesh F32 placement axes; no claim about terrain grade, patched files, or which holes are visible.'},null,2));
