import * as THREE from 'three';
import {RUNWAYS} from '../sim/places.ts';
/** Markings live on the terrain material itself, so DEM interpolation cannot occlude them. */
export function runwayAtlas(){
 const c=document.createElement('canvas');c.width=384;c.height=2048;const g=c.getContext('2d')!;
 for(let i=0;i<RUNWAYS.length;i++){
  const r=RUNWAYS[i],w=128,x0=i*w,k=2048/r.length;
  g.save();g.translate(x0,0);g.fillStyle='#414546';g.fillRect(0,0,w,2048);
  g.fillStyle='#bcbeb6';g.fillRect(3,0,2,2048);g.fillRect(w-5,0,2,2048);
  for(let y=110;y<r.length-110;y+=58)g.fillRect(w/2-.9,y*k,1.8,26*k);
  for(let e=0;e<2;e++){
   g.save();if(e){g.translate(w,2048);g.rotate(Math.PI);}
   g.fillStyle='#d6d7c9';
   for(const xx of [12,22,32,42,82,92,102,112])g.fillRect(xx,9*k,5,27*k);
   g.font='bold 46px sans-serif';g.textAlign='center';g.textBaseline='middle';g.save();
   // The low end is at the bottom of the texture so the number is read when approaching along +along.
   g.translate(w/2,58*k);g.scale(1,1.0);g.fillText(r.ends[e],0,0,69);g.restore();
   for(const q of [27,94])g.fillRect(q,225*k,8,36*k);
   g.restore();
  }g.restore();
 }
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
 return {map:tex,orig:RUNWAYS.map(r=>new THREE.Vector4(r.p.x,r.p.z,r.dx,r.dz)),size:RUNWAYS.map(r=>new THREE.Vector2(r.length,r.width))};
}
