import * as THREE from 'three';
import {RUNWAYS} from '../sim/places.ts';
export const mainRunwayIndex=RUNWAYS.findIndex(r=>r.id==='CYYG03');
export const mainRunwaySwatch=[mainRunwayIndex*128+60,1024] as const;
export const princeRunwayIndex=RUNWAYS.findIndex(r=>r.id==='CYSU05');
export const princeRunwaySwatch=[princeRunwayIndex*128+60,1024] as const;
export const runwayAtlasSize=[384,2048] as const;
export function mainRunwayIntersects(x0:number,z0:number,x1:number,z1:number){
 return runwayIntersects(mainRunwayIndex,x0,z0,x1,z1);
}
export function princeRunwayIntersects(x0:number,z0:number,x1:number,z1:number){
 return runwayIntersects(princeRunwayIndex,x0,z0,x1,z1);
}
function runwayIntersects(index:number,x0:number,z0:number,x1:number,z1:number){
 const r=RUNWAYS[index];if(!r)return false;
 const {x,z}=r.p,ex=x+r.dx*r.length,ez=z+r.dz*r.length;
 const hx=Math.abs(r.dz)*r.width*.5,hz=Math.abs(r.dx)*r.width*.5;
 return x0<=Math.max(x,ex)+hx&&x1>=Math.min(x,ex)-hx&&
        z0<=Math.max(z,ez)+hz&&z1>=Math.min(z,ez)-hz;
}
/** Markings live on the terrain material itself, so DEM interpolation cannot occlude them. */
export function runwayAtlas(){
 const c=document.createElement('canvas');c.width=runwayAtlasSize[0];c.height=runwayAtlasSize[1];const g=c.getContext('2d')!;
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
 const swatchReady=(index:number,expected:number,swatch:readonly [number,number])=>{
  if(index!==expected||RUNWAYS.length!==3)return false;
  try{
   // Test both centre rows; Canvas upload flips Y for the GPU texel.
   const q=g.getImageData(swatch[0],swatch[1]-1,1,2).data;
   return [65,69,70,255,65,69,70,255].every((v,i)=>q[i]===v);
  }catch{return false;}
 };
 return {map:tex,mainSwatchReady:()=>swatchReady(mainRunwayIndex,0,mainRunwaySwatch),princeSwatchReady:()=>swatchReady(princeRunwayIndex,2,princeRunwaySwatch),orig:RUNWAYS.map(r=>new THREE.Vector4(r.p.x,r.p.z,r.dx,r.dz)),size:RUNWAYS.map(r=>new THREE.Vector2(r.length,r.width))};
}
