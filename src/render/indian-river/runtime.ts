import {ST_MARYS_FAR_LOD,buildStMarysFar,useStMarysFar} from './far.ts';
import {projectedVerticalPixels} from './screen-size.ts';
import * as THREE from 'three';
import type {World} from '../world.ts';
import {INDIAN_RIVER_SOURCE as S} from './indian-river-source.generated.ts';
import {churchMaterials} from './materials.ts';
import {buildChurch} from './model.ts';
export function prepareChurchArt(){
 const materials=churchMaterials(),group=new THREE.Group(),lod=new THREE.LOD();
 lod.addLevel(buildChurch('hero',materials),0);
 const flight=buildChurch('flight',materials);
 lod.addLevel(flight,155,.10);
 const far=buildStMarysFar();far.visible=false;
 const fit=new THREE.Box3().setFromObject(flight),scratch=new THREE.Vector3();
 const samples:THREE.Vector3[]=[];
 group.matrix.set(...S.modelTransform as Parameters<THREE.Matrix4['set']>);
 group.matrixAutoUpdate=false;group.matrixWorldNeedsUpdate=true;
 group.visible=false;group.name='St Mary’s Indian River · LiDAR-supported exterior';
 group.add(lod,far);
 for(const x of [fit.min.x,fit.max.x])for(const y of [fit.min.y,fit.max.y])for(const z of [fit.min.z,fit.max.z])
  samples.push(new THREE.Vector3(x,y,z).applyMatrix4(group.matrix));
 const centre=fit.getCenter(new THREE.Vector3()).applyMatrix4(group.matrix);
 const x=S.modelTransform[3],z=S.modelTransform[11];
 const inRange=(camera:THREE.Vector3)=>Math.hypot(camera.x-x,camera.z-z)<3900;
 const meshes=new Set<THREE.BufferGeometry>(),finishes=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 group.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;
  meshes.add(o.geometry);
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   finishes.add(m);
   for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);
  }
 });
 let gate=false,farActive=false,spanPx=Infinity,closed=false;
 return {
  group,inRange,
  setView(camera:THREE.Vector3,world:World,gradeId:string,shadowReady:boolean){
   gate=!closed&&inRange(camera)&&shadowReady&&world.groundGradeInstalled(gradeId);
  },
  updateDetail(camera:THREE.PerspectiveCamera,deviceHeight:number){
   if(closed)return;
   const distance=camera.position.distanceTo(centre);
   spanPx=gate?projectedVerticalPixels(samples,camera,deviceHeight,scratch):Infinity;
   farActive=gate&&distance<=ST_MARYS_FAR_LOD.validatedThrough&&useStMarysFar(farActive,distance,spanPx);
   far.visible=farActive;lod.visible=!farActive;
  },
  get detail(){return gate?{tier:farActive?'far':lod.getCurrentLevel()===0?'hero':'flight',spanPx}:null;},
  active:()=>gate,
  dispose(){
   if(closed)return;
   closed=true;gate=false;group.visible=false;group.removeFromParent();
   for(const g of meshes)g.dispose();
   for(const m of finishes)m.dispose();
   for(const t of textures)t.dispose();
  },
 };
}
export type ChurchArt=ReturnType<typeof prepareChurchArt>;
