import * as T from 'three';
import {makeVertexFootprint,makeClipExcluder} from './screen-sweep.ts';
import {CANOPY_SHADOW_VERTEX} from './canopy-vertex-pin.ts';
type V3=readonly [number,number,number];
const G12=12*2**-24/(1-12*2**-24);
const normal=(a:readonly number[])=>a.every(Number.isFinite);
function array(a:T.BufferAttribute|T.InterleavedBufferAttribute|undefined,n:number,instanced=true){
 if(!a||!(a instanceof T.BufferAttribute)||!(a.array instanceof Float32Array)||
    (instanced&&(!(a instanceof T.InstancedBufferAttribute)||a.meshPerAttribute!==1))||
    a.normalized||a.itemSize!==n)return;
 return a;
}
function safeBox(axis:number,input:number,lo:number,hi:number){
 // World expressions are binary32 vertex operations. Bound products,
 // additions, division-free hedge interpolation and the outward float cast.
 const e=(Math.abs(axis)+Math.abs(input)+Math.max(Math.abs(lo),Math.abs(hi))+1)*G12+.003;
 return [Math.fround(lo-e),Math.fround(hi+e)] as const;
}

/** This is for the one identified, stock-instanced q351 vegetation pass,
 * not a generic permission for ShaderMaterials to skip bound checks. */
export function provenCanopyShadowBounds(o:T.Mesh,g:T.BufferGeometry,m:T.Material, camera:T.PerspectiveCamera,
 region:T.Box2,width:number,height:number){
 const u=m instanceof T.ShaderMaterial?m.uniforms:null;
 const uniforms=u&&Object.hasOwn(u,'canopy')&&Object.keys(u).every(k=>k==='canopy'||k==='canopySun')&&
  !['projectionMatrix','viewMatrix','modelViewMatrix','modelMatrix','cameraPosition','normalMatrix',
    'isOrthographic','logDepthBufFC'].some(k=>k in u);
 if(!uniforms||o.name!=='Canopy ground shadows'||!(m instanceof T.ShaderMaterial)||m.vertexShader!==CANOPY_SHADOW_VERTEX||
    (m.precision!==null&&m.precision!=='highp')||!m.transparent||m.depthWrite||!m.depthTest||!m.colorWrite||m.stencilWrite||!m.polygonOffset||
    m.onBeforeCompile!==T.Material.prototype.onBeforeCompile||m.customProgramCacheKey!==T.Material.prototype.customProgramCacheKey||
    m.onBeforeRender!==T.Material.prototype.onBeforeRender||
    o.onBeforeRender!==T.Object3D.prototype.onBeforeRender||o.onAfterRender!==T.Object3D.prototype.onAfterRender||
    Object.keys(m.defines??{}).length||!(g instanceof T.InstancedBufferGeometry)||
    o.geometry!==g||o.material!==m||g.groups.length||g.indirect!==null||Object.keys(g.morphAttributes).length)
  return {ok:false,reason:'canopy owner or exact stage source not admitted',n:0};
 const n=g.instanceCount,source=array(g.getAttribute('position'),3,false),idx=g.index;
 const stem=array(g.getAttribute('stem'),3),shape=array(g.getAttribute('shape'),4),hedge=array(g.getAttribute('hedgeGround'),4);
 if(!source||source.count!==4||!idx||idx.count!==6||g.drawRange.start!==0||g.drawRange.count!==Infinity||
    !stem||!shape||!hedge||!Number.isInteger(n)||n<0||n>512||n>Math.min(stem.count,shape.count,hedge.count))
  return {ok:false,reason:'canopy input layout/cost not admitted',n};
 const corners=new Set();
 for(let i=0;i<4;i++){
  const x=source.getX(i),y=source.getY(i),z=source.getZ(i);
  if((x!==-.5&&x!==.5)||(y!==-.5&&y!==.5)||z!==0)
   return {ok:false,reason:'canopy quad not exact unit',n};
  corners.add(x+','+y);
 }
 if(corners.size!==4||Array.from(idx.array).some(k=>k<0||k>=4))
  return {ok:false,reason:'canopy index out of scope',n};
 const footprint=makeVertexFootprint(camera.projectionMatrix.elements,camera.matrixWorldInverse.elements,width,height);
 if(!footprint)return {ok:false,reason:'unverified canopy camera',n};
 const excluder=makeClipExcluder(camera.projectionMatrix.elements,camera.matrixWorldInverse.elements,
  [region.min.x,region.min.y,region.max.x,region.max.y],width,height);
 if(!excluder)return {ok:false,reason:'unverified canopy clip bounds',n};
 const b=new T.Box2();
 let fast=0;
 for(let i=0;i<n;i++){
  const x=stem.getX(i),y=stem.getY(i),z=stem.getZ(i),h=shape.getX(i),w=shape.getY(i);
  const heights=[hedge.getX(i),hedge.getY(i),hedge.getZ(i),hedge.getW(i)];
  if(!normal([x,y,z,h,w,...heights])||h<0||h>200||w<=0||w>200||
     [x,y,z,...heights].some(v=>Math.abs(v)>250_000))return {ok:false,reason:'canopy slot number outside signed budget',n,slot:i};
  const use=heights.some(v=>v!==0);
  const X=safeBox(x,h+w,x+.43*h-.71*w,x+.43*h+.71*w);
  const Y=safeBox(y,0,use?Math.min(...heights):y+.46,use?Math.max(...heights):y+.46);
  const Z=safeBox(z,h+w,z+.21*h-.595*w,z+.21*h+.595*w);
  if(excluder([X,Y,Z])){fast++;continue;}
  b.makeEmpty();
  for(let k=0;k<8;k++){
   const p:V3=[X[k&1?1:0],Y[k&2?1:0],Z[k&4?1:0]],a=footprint(p);
   if(!a)return {ok:false,reason:'canopy quad not wholly projectable',n,slot:i};
   b.min.x=Math.min(b.min.x,2*a.x[0]/width-1);b.max.x=Math.max(b.max.x,2*a.x[1]/width-1);
   b.min.y=Math.min(b.min.y,1-2*a.y[1]/height);b.max.y=Math.max(b.max.y,1-2*a.y[0]/height);
  }
  if(b.intersectsBox(region))return {ok:false,reason:'canopy colour could overlap',n,slot:i};
 }
 return {ok:true,reason:'every exact canopy instance is outside protection',n,fast};
}
