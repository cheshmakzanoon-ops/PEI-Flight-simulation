import * as THREE from 'three';
import {PARENT_INTERVALS} from '../sim/relief-seed.ts';
import {adaptiveGround} from './adaptive-ground.ts';
import {surveyNormals} from './coastal-normals.ts';
import type {NativeBank} from '../sim/basin-bank-relief.ts';
import type {Terrain} from '../sim/terrain.ts';

/** Use only supported parent cells. Original zero-weight cells keep their
 * original triangles, or split an edge on the same plane for its neighbour. */
export function nativeBankMesh(original:THREE.BufferGeometry,bank:NativeBank,terrain:Terrain,
 x0:number,z0:number,w:number,d:number){
 const grid=bank.grid;
 const sample=(u:number,v:number)=>{
  const x=x0+u*w,z=z0+v*d;
  if(!grid.inside(x,z))return;
  return grid.height(x,z);
 };
 const {geometry,relief}=adaptiveGround(original,{accepts:(i,j)=>bank.acceptsParent(i,j),height:sample},
   terrain,x0,z0,w,d,grid.spec.sub,true);
 // Copy the same source normal/weight onto the retained high-detail lattice.
 // Original or stitched old triangles use just the derivative shading.
 const {normals,weight}=surveyNormals(grid);
 const size=geometry.getAttribute('position').count;
 const n=new Int16Array(size*3),strength=new Uint8Array(size);
 for(let i=0;i<size;i++){
  n[i*3+1]=32767;
  if(i<relief.originalVertices)continue;
  const u=relief.positions[i*3],v=relief.positions[i*3+2];
  const a=(u*PARENT_INTERVALS-grid.spec.firstX)*grid.spec.sub;
  const b=(v*PARENT_INTERVALS-grid.spec.firstZ)*grid.spec.sub;
  const x=Math.round(a),z=Math.round(b);
  if(x<0||x>=grid.nx||z<0||z>=grid.nz||Math.abs(x-a)>.001||Math.abs(z-b)>.001)continue;
  const j=z*grid.nx+x;
  n.set(normals.subarray(j*3,j*3+3),i*3);strength[i]=weight[j];
 }
 geometry.setAttribute('normal',new THREE.BufferAttribute(n,3,true));
 geometry.setAttribute('surveyWeight',new THREE.BufferAttribute(strength,1,true));
 return geometry;
}
