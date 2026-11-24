import * as THREE from 'three';
import type {World} from '../world.ts';
import {INDIAN_RIVER_SOURCE as S} from './indian-river-source.generated.ts';
import {churchMaterials} from './materials.ts';
import {buildChurch} from './model.ts';
export function prepareChurchArt(){
 const materials=churchMaterials(),group=new THREE.Group(),lod=new THREE.LOD();
 lod.addLevel(buildChurch('hero',materials),0);
 lod.addLevel(buildChurch('flight',materials),155,.10);
 group.matrix.set(...S.modelTransform as Parameters<THREE.Matrix4['set']>);
 group.matrixAutoUpdate=false;group.matrixWorldNeedsUpdate=true;
 group.visible=false;group.name='St Mary’s Indian River · LiDAR-supported exterior';
 group.add(lod);
 const x=S.modelTransform[3],z=S.modelTransform[11];
 const inRange=(camera:THREE.Vector3)=>Math.hypot(camera.x-x,camera.z-z)<3900;
 let gate=false;
 return {
  group,inRange,
  setView(camera:THREE.Vector3,world:World,gradeId:string,shadowReady:boolean){
   gate=inRange(camera)&&shadowReady&&world.groundGradeInstalled(gradeId);
  },
  active:()=>gate,
 };
}
export type ChurchArt=ReturnType<typeof prepareChurchArt>;
