/** Private, detached authoring only. No change to either standalone study. */
import * as T from 'three';
import {buildSourisTownHall} from './hall.ts';
import {buildDetachedEntrySteps} from './stairs-study.ts';
import {RUNS} from './stair-recipe.generated.ts';

/**
 * Compose two previously verified parts in their common metre frame.
 * This starts no renderer/loader and owns no floor, source or live placement.
 * The standard and individual authoring entry points remain untouched.
 */
export function buildSourisTownHallCombinedStudy(){
 const hall=buildSourisTownHall({textured:false,frontGable:true,rearSurvey:true});
 const geometries=new Set<T.BufferGeometry>();
 const materials=new Set<T.Material>();
 const own=(g:T.Group)=>{
  for(const object of g.children){
   if(!(object instanceof T.Mesh))continue;
   geometries.add(object.geometry);
   for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);
  }
 };
 own(hall);
 const root=new T.Group();
 let disposed=false;
 const dispose=()=>{
  if(disposed)return;
  disposed=true;root.removeFromParent();root.clear();
  for(const g of geometries)g.dispose();
  for(const m of materials)m.dispose();
 };
 try{
  const trim=hall.children.find(object=>object.name==='trim');
  if(!(trim instanceof T.Mesh)||!(trim.material instanceof T.MeshPhysicalMaterial))throw Error('missing original hall trim');
  // Pass the actual same material, not a lookalike clone or a second texture.
  const steps=buildDetachedEntrySteps(RUNS,trim.material,true);
  own(steps);
  root.name='Detached Souris Town Hall: measured lower rear and interpreted front entries';
  root.userData=Object.freeze({
   detached:true,reviewOnly:true,wholeRoofClaim:false,datumTransfer:false,accessClaim:false,
   sourceRoles:'original hall + measured 12.45 m² lower-rear core + previously authored two separate entry runs',
   held:'upper-east, actual rear wall/enclosure and joinery, centre terrace, whole-building seat',
  });
  root.add(hall,steps);
  return Object.freeze({root,hall,steps,dispose});
 }catch(error){
  dispose();throw error;
 }
}
