import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {project} from '../../sim/geo.ts';
import {GROUND_LIFT} from '../../sim/coastal-terrain.ts';
import {RUSTICO_GRADE} from '../../sim/rustico-grade.generated.ts';
import {landmarkSeatFailure,type LandmarkSeatProbe} from '../../sim/landmark-seat.ts';
import type {World} from '../world.ts';
import {DATUM,WALL0,rearU,farU,negV,posV} from './frame.ts';
import {buildRusticoModel} from './model.ts';
import {rusticoShade} from './shade.ts';
import {RUSTICO_SHADE} from './shade.generated.ts';
import {makeRusticoMaterials} from './materials.ts';
import type {BoundedGrade} from '../../sim/bounded-grade.ts';
import type {Terrain} from '../../sim/terrain.ts';
import type {Cover} from '../../sim/cover.ts';

const o=project(-63.291964738182266,46.45530404141915);
const n=project(-63.291955162471346,46.45531014013396);
const w=project(-63.29197356252845,46.45531065942009);
const u=[n.x-o.x,n.z-o.z],v=[w.x-o.x,w.z-o.z];
const mapPoint=(a:number,b:number)=>({x:o.x+a*u[0]+b*v[0],z:o.z+a*u[1]+b*v[1]});
const l=rearU(WALL0),r=farU(WALL0),f=negV(WALL0),b=posV(WALL0);
const foot:LandmarkSeatProbe[]=[];
for(let i=0;i<=16;i++){
 const a=l+(r-l)*i/16,c=f+(b-f)*i/16;
 for(const [u,v]of [[a,f],[a,b],[l,c],[r,c]])foot.push({...mapPoint(u,v),low:2.63,high:3.07,minDryDistance:20});
}
const bounds=[o.x-15,o.z-17,o.x+18,o.z+16] as const;

export function prototypeRusticoFit(g:BoundedGrade,t:Terrain,c:Cover){
 const visual=(x:number,z:number)=>g.visualY(x,z)??NaN,
  dry=(x:number,z:number)=>c.distance(t,x,z);
 return foot.every(p=>g.weight(p.x,p.z)===1)
  &&landmarkSeatFailure(RUSTICO_GRADE.id,foot,{gradeInstalled:()=>true,dryDistance:dry,visualY:visual,contactY:visual})===undefined;
}

/** Opaque art parts share a draw only with exactly the same material.
 * Transparent lantern panes keep their own sort order. Source rays are
 * evaluated against the unmerged authored meshes. */
function batchOpaque(group:T.Group){
 const parts=new Map<T.Material,T.Mesh[]>();
 for(const c of group.children){
  if(!(c instanceof T.Mesh)||Array.isArray(c.material)||c.material.transparent)continue;
  const p=parts.get(c.material);
  if(p)p.push(c);
  else parts.set(c.material,[c]);
 }
 for(const [material,p] of parts)if(p.length>1){
  const geometry=mergeGeometries(p.map(c=>c.geometry));
  if(!geometry)continue;
  geometry.computeBoundingSphere();
  const merged=new T.Mesh(geometry,material);
  merged.name=p.map(c=>c.name).join(', ');
  group.remove(...p).add(merged);
  for(const c of p)c.geometry.dispose();
 }
 return group;
}

export function createRusticoExterior(g:BoundedGrade){
 const mats=makeRusticoMaterials(),shell=new T.Group(),lod=new T.LOD();
 const near=batchOpaque(buildRusticoModel('hero',mats)),far=batchOpaque(buildRusticoModel('flight',mats));
 near.userData.lod='near';far.userData.lod='flight';
 lod.addLevel(near,0);lod.addLevel(far,270,.10);lod.addLevel(new T.Group(),3750,.08);
 shell.matrix.set(u[0],0,-v[0],o.x,0,1,0,DATUM+GROUND_LIFT,u[1],0,-v[1],o.z,0,0,0,1);
 shell.matrixAutoUpdate=false;shell.matrixWorldNeedsUpdate=true;shell.name='North Rustico Harbour Light · 2020 exterior';
 shell.add(lod);shell.visible=false;
 return (scene:T.Scene,world:World)=>{
  const shade=rusticoShade(g,Uint8Array.from(atob(RUSTICO_SHADE.alpha),ch=>ch.charCodeAt(0)),RUSTICO_SHADE);
  scene.add(shell,shade);
  const surface={
   gradeInstalled:(id:string)=>world.groundGradeInstalled(id),
   dryDistance:(x:number,z:number)=>world.cover.distance(world.terrain,x,z),
   visualY:(x:number,z:number)=>world.visualGroundHeight(x,z),
   contactY:(x:number,z:number)=>world.groundHeight(x,z),
  };
  let key='',state='not near';
  return {get state(){return {seat:state,visible:shell.visible};},
   hide(){shell.visible=shade.visible=false;},
   update(camera:T.Vector3){
   if(Math.hypot(camera.x-o.x,camera.z-o.z)>3890){shell.visible=shade.visible=false;return;}
   const revision=world.visualGroundSignature(bounds);
   if(revision!==key){
    key=revision;
    state=landmarkSeatFailure(RUSTICO_GRADE.id,foot,surface)??'verified';
   }
   shell.visible=state==='verified';
   shade.visible=shell.visible&&Math.hypot(camera.x-o.x,camera.z-o.z)<500;
  }};
 };
}
