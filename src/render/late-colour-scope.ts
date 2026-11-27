import type {BordenCanopyResident,BordenPropResident} from './borden-canopy-resident.ts';
import {provenCanopyShadowBounds} from './canopy-late-scope.ts';
import {makeVertexFootprint} from './screen-sweep.ts';
import * as T from 'three';
type Draw={readonly object:T.Object3D;readonly material:T.Material;readonly geometry:T.BufferGeometry|null};
type Cache={readonly position:T.BufferAttribute;readonly version:number;readonly box:T.Box3};
const plain=(m:T.Material):boolean=>
 [T.MeshBasicMaterial,T.MeshStandardMaterial,T.MeshPhysicalMaterial].some(c=>m.constructor===c);

/** Detached, conservative custody check for the colour drawers that follow
 * the opaque clear-depth pair. It is not a generic proof for custom objects.
 * Unknown programmable deformations and near-plane crossings are held. */
export class LateColourScope{
 private readonly bounds=new WeakMap<T.BufferGeometry,Cache>();
 private readonly mv=new T.Matrix4();
 private readonly rect=new T.Box2();
 tracks(list:readonly Draw[],camera:T.PerspectiveCamera,protectedRegion:T.Box2,width:number,height:number,canopy:BordenCanopyResident,prop:BordenPropResident){
  if(T.REVISION!=='187'||list.length>128||protectedRegion.isEmpty()||width<=0||height<=0)return {ok:false,reason:'unsafe list extent',n:list.length};
  let canopySlots=0,canopyFast=0;
  for(const entry of list){
   const {object:o,geometry:g,material:m}=entry;
   if(g&&o instanceof T.Mesh&&o.name==='Canopy ground shadows'){
    const forest=provenCanopyShadowBounds(o,g,m,camera,protectedRegion,width,height);
    if(forest.ok&&!canopy.matches(o,g,m,forest.n))return {ok:false,reason:'canopy GPU words not authenticated',n:list.length};
    if(!forest.ok)return {ok:false,reason:forest.reason,n:list.length,forest};
    canopySlots=forest.n;canopyFast=forest.fast??0;continue;
   }
   if(!(o instanceof T.Mesh)||!g||o.geometry!==g||o.material!==m||
      o instanceof T.SkinnedMesh||o instanceof T.InstancedMesh||o instanceof T.BatchedMesh||
      o.onBeforeRender!==T.Object3D.prototype.onBeforeRender||o.onAfterRender!==T.Object3D.prototype.onAfterRender||
      m.onBeforeCompile!==T.Material.prototype.onBeforeCompile||m.customProgramCacheKey!==T.Material.prototype.customProgramCacheKey||
      m.onBeforeRender!==T.Material.prototype.onBeforeRender||
      Object.keys(g.morphAttributes).length||g.indirect!==null||
      !plain(m)||
      ('displacementMap' in m&&!!m.displacementMap)||!o.matrixWorld.elements.every(Number.isFinite)){
     return {ok:false,reason:'unverified later colour position',object:o.type,objectName:o.name,material:m.type,
       materialName:m.name,attributes:g?Object.keys(g.attributes):[],geometry:g?.type??null,
       count:g instanceof T.InstancedBufferGeometry?g.instanceCount:0,
       shader:m instanceof T.ShaderMaterial?{vertex:m.vertexShader,uniforms:Object.keys(m.uniforms)}:null,
       before:o.onBeforeRender!==T.Object3D.prototype.onBeforeRender,after:o.onAfterRender!==T.Object3D.prototype.onAfterRender,
       n:list.length};
   }
   if(!prop.matches(o,g,m))
    return {ok:false,reason:'unregistered later colour or stale GPU words',objectName:o.name,n:list.length};
   if(!m.colorWrite)continue;
   const p=g.getAttribute('position');
   if(!(p instanceof T.BufferAttribute)||!(p.array instanceof Float32Array)||p.itemSize!==3||p.normalized||
      p.count<=0||p.count>120_000){
    return {ok:false,reason:'unverified transparent geometry',object:o.type,material:m.type,n:list.length};
   }
   let hit=this.bounds.get(g);
   if(!hit||hit.position!==p||hit.version!==p.version){
    const box=new T.Box3().setFromBufferAttribute(p);
    if(box.isEmpty()||![...box.min,...box.max].every(Number.isFinite))return {ok:false,reason:'nonfinite late bounds',n:list.length};
    hit={position:p,version:p.version,box};this.bounds.set(g,hit);
   }
   this.mv.multiplyMatrices(camera.matrixWorldInverse,o.matrixWorld);
   const footprint=makeVertexFootprint(camera.projectionMatrix.elements,this.mv.elements,width,height);
   if(!footprint)return {ok:false,reason:'nonfinite later matrix',n:list.length};
   this.rect.makeEmpty();
   const {min,max}=hit.box;
   for(let i=0;i<8;i++){
    const bound=footprint([i&1?max.x:min.x,i&2?max.y:min.y,i&4?max.z:min.z]);
    if(!bound)return {ok:false,reason:'later bounds not wholly projectable',n:list.length};
    this.rect.min.x=Math.min(this.rect.min.x,2*bound.x[0]/width-1);
    this.rect.min.y=Math.min(this.rect.min.y,1-2*bound.y[1]/height);
    this.rect.max.x=Math.max(this.rect.max.x,2*bound.x[1]/width-1);
    this.rect.max.y=Math.max(this.rect.max.y,1-2*bound.y[0]/height);
   }
   if(this.rect.intersectsBox(protectedRegion))return {ok:false,reason:'later colour could overlap',
    object:o.type,objectName:o.name,material:m.type,n:list.length,
    rect:[this.rect.min.x,this.rect.min.y,this.rect.max.x,this.rect.max.y],
    protect:[protectedRegion.min.x,protectedRegion.min.y,protectedRegion.max.x,protectedRegion.max.y]};

  }
  return {ok:true,reason:'all eligible later colour bounds disjoint',n:list.length,canopySlots,canopyFast};
 }
}
