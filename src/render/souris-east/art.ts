import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {NEIGHBOUR as R} from './nearby-recipe.ts';
import {buildDetachedSourisEastNeighbour} from './nearby-study.ts';

/** This model is authored in the survey frame; no donor image pixels are used. */
export function createSourisEastExterior(){
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
 return {group,dispose(){
  group.removeFromParent();
  for(const g of geometry)g.dispose();
  for(const m of materials){m.map?.dispose();m.dispose();}
 }};
}
