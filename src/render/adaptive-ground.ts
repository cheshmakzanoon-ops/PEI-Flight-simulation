import * as THREE from 'three';
import {AdaptiveRelief} from '../sim/adaptive-relief.ts';
import {PARENT_INTERVALS,ReliefSeed} from '../sim/relief-seed.ts';
import {GROUND_LIFT} from '../sim/coastal-terrain.ts';
import type {Terrain} from '../sim/terrain.ts';

/** One indexed replacement; the original terrain owner and material survive. */
export function adaptiveGround(original:THREE.BufferGeometry,seed:ReliefSeed,s:Terrain,
  x0:number,z0:number,w:number,d:number,split=4){
 const old=original.getAttribute('position'),oldUV=original.getAttribute('uv');
 const n=PARENT_INTERVALS;
 if(old.count!==(n+1)**2||oldUV.count!==old.count)throw Error('Adaptive terrain requires the untouched near lattice');
 const baseline=Float32Array.from({length:old.count},(_,i)=>old.getY(i));
 const relief=new AdaptiveRelief({n,split,baseline,canRefine:(i,j)=>i>=2&&j>=2&&i<n-2&&j<n-2&&seed.accepts(i,j),
  survey:(u,v)=>{const y=seed.height(u,v);return y===undefined?undefined:y+GROUND_LIFT;}});
 const pos=new Float32Array(relief.positions.length),uv=new Float32Array(pos.length/3*2);
 // Reproduce the actual old XYZ and UV buffers exactly outside changed triangles.
 pos.set(old.array);uv.set(oldUV.array);
 const step=n+1,cx=x0+w/2,cz=z0+d/2;
 const axes=(q:number,x:boolean)=>{
  const k=q*n,r=Math.round(k);
  // Unit-space float encoding can be a few millionths of a coarse cell
  // off an exact lattice coordinate. Snap inherited integer coordinates
  // to the original GPU buffer before writing the re-used seam vertices.
  const get=(i:number)=>x?old.getX(i):old.getZ(i*step);
  if(Math.abs(k-r)<1e-5)return get(r);
  const i=Math.floor(k),a=get(i);
  return a+(get(i+1)-a)*(k-i);
 };
 for(let p=old.count;p<pos.length/3;p++){
  const k=p*3,uu=relief.positions[k],vv=relief.positions[k+2];
  pos[k]=axes(uu,true);pos[k+1]=relief.positions[k+1];pos[k+2]=axes(vv,false);
  const [a,b]=s.uv(cx+pos[k],cz+pos[k+2]);uv[p*2]=a;uv[p*2+1]=b;
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 const indices=pos.length/3<=65536?Uint16Array.from(relief.indices):relief.indices;
 geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingSphere();
 return {geometry,relief};
}
