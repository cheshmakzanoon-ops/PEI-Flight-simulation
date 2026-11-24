import * as T from 'three';
import type {BuildingShadows} from '../local-building-shadows.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {NEIGHBOUR as R} from './nearby-recipe.ts';
import {buildDetachedSourisEastNeighbour} from './nearby-study.ts';

/** This model is authored in the survey frame; no donor image pixels are used. */
type Receiver=Pick<BuildingShadows,'uniforms'>&{penumbra:string};
function localOcclusion(m:T.MeshPhysicalMaterial,casts:Receiver){
 m.customProgramCacheKey=()=> 'souris-east-local-shadow-v1';
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,casts.uniforms);
  s.vertexShader='varying vec3 sourisEastWorld;\n'+s.vertexShader.replace('#include <worldpos_vertex>',
   '#include <worldpos_vertex>\nsourisEastWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',
   '#include <common>\nvarying vec3 sourisEastWorld;\n'+casts.penumbra);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   vec3 sourisNormal=normalize(inverseTransformDirection(normal,viewMatrix));
   float sourisShadow=railBuildingShade(sourisEastWorld,sourisNormal,distance(sourisEastWorld,cameraPosition));
   reflectedLight.directDiffuse*=1.-sourisShadow;
   reflectedLight.directSpecular*=1.-sourisShadow;`);
 };
}

export function createSourisEastExterior(casts?:Receiver){
 const group=buildDetachedSourisEastNeighbour({textured:true,frontTreatment:'observed-2024'});
 const {O,U,V}=R.frame;
 group.matrixAutoUpdate=false;
 group.matrix.set(U[0],0,-V[0],O[0],0,1,0,R.pointDatum,U[1],0,-V[1],O[1],0,0,0,1);
 group.matrixWorldNeedsUpdate=true;
 group.name='77 Main Street · survey-backed exterior massing';
 // Keep the same physical materials and exact triangles, with one draw
 // per shared material rather than one per differing roof-role name.
 const batches=new Map<T.Material,T.Mesh<T.BufferGeometry,T.Material>[]>();
 for(const node of group.children)if(node instanceof T.Mesh&&!Array.isArray(node.material)){
  const list=batches.get(node.material);
  if(list)list.push(node);else batches.set(node.material,[node]);
 }
 for(const [material,nodes] of batches)if(nodes.length>1){
  const merged=mergeGeometries(nodes.map(node=>node.geometry));
  if(!merged)continue;
  merged.computeBoundingSphere();
  const batch=new T.Mesh(merged,material);batch.name=nodes.map(node=>node.name).join('+');
  for(const node of nodes){node.removeFromParent();node.geometry.dispose();}
  group.add(batch);
 }
 const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.MeshPhysicalMaterial>();
 group.traverse(node=>{
  if(node instanceof T.Mesh&&node.material instanceof T.MeshPhysicalMaterial){
   geometry.add(node.geometry);materials.add(node.material);
  }
 });
 let caster:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>|undefined;
 if(casts){
  // The shared depth roster copies translations only. Transform the exact
  // exterior vertices into the surveyed east/south basis here, not in GLSL.
  const count=[...geometry].reduce((n,g)=>n+(g.index?.count??g.getAttribute('position').count),0),positions=new Float32Array(count*3);
  let i=0;
  for(const g of geometry){
   const a=g.getAttribute('position');
   for(let j=0;j<(g.index?.count??a.count);j++){
    const k=g.index?.getX(j)??j,x=a.getX(k),z=a.getZ(k);
    positions[i++]=x*U[0]-z*V[0];positions[i++]=a.getY(k);positions[i++]=x*U[1]-z*V[1];
   }
  }
  const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3))
   .setAttribute('facadeStyle',new T.BufferAttribute(new Uint8Array(count),1));
  g.computeBoundingSphere();
  caster=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));
  caster.name='77 Main Street · exact opaque depth owner';
  caster.position.set(O[0],R.pointDatum,O[1]);caster.updateMatrixWorld(true);
  for(const m of materials)localOcclusion(m,casts);
 }
 let released=false;
 return {group,caster,dispose(){
  if(released)return;released=true;
  group.removeFromParent();
  caster?.geometry.dispose();caster?.material.dispose();
  for(const g of geometry)g.dispose();
  for(const m of materials){m.map?.dispose();m.dispose();}
 }};
}
