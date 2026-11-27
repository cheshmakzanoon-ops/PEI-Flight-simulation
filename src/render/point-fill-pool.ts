import * as T from 'three';
type Centre={readonly x:number;readonly y:number;readonly point:readonly [number,number,number]};
const CELL=[-38866.87246486078,27761.663306623333,-38819.27066147455,27809.070239400728];
const last='#include <logdepthbuf_vertex>';
const H='peiBordenSkyFill';

/** Bounded reusable GPU stream. This does not perform source, renderer or
 * late-colour admission; its output must remain disabled without that lease. */
export class PointFillPool{
 readonly mesh:T.Points<T.BufferGeometry,T.ShaderMaterial>;
 private readonly geometry=new T.BufferGeometry();
 private readonly position:T.BufferAttribute;
 private readonly screen:T.BufferAttribute;
 private readonly scalar={value:0};
 private readonly used=new Set<number>();
 private readonly capacity:number;
 private dead=false;
 private readonly material:T.ShaderMaterial;
 private readonly pin:readonly unknown[];
 private stamp?:readonly [number,number,number];
 constructor(source:T.ShaderMaterial,capacity=1024){
  if(!Number.isInteger(capacity)||capacity<1||capacity>1024||source.vertexShader.split(last).length!==2||
     !source.fragmentShader.includes('gl_FragDepth=1.0;')||!Object.hasOwn(source.uniforms,H)||
     source.depthFunc!==T.EqualDepth||source.depthWrite||source.transparent||!source.depthTest||!source.colorWrite||
     source.stencilWrite||source.uniformsGroups.length||source.clippingPlanes?.length){
   throw new TypeError('incompatible detached point material');
  }
  this.capacity=capacity;
  this.position=new T.BufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage);
  this.screen=new T.BufferAttribute(new Float32Array(capacity*2),2).setUsage(T.DynamicDrawUsage);
  this.geometry.setAttribute('position',this.position);
  this.geometry.setAttribute('peiBordenCentreClip',this.screen);
  this.geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(capacity*2),2));
  const bridge=Object.create(source) as T.ShaderMaterial;
  Object.defineProperty(bridge,'uniforms',{value:Object.freeze({})});
  const m=new T.ShaderMaterial().copy(bridge);
  m.uniforms={...source.uniforms,[H]:this.scalar};
  m.vertexShader='attribute vec2 peiBordenCentreClip;\n'+source.vertexShader.replace(last,
   'gl_Position.xy=peiBordenCentreClip*gl_Position.w;gl_PointSize=1.0;\n '+last);
  this.material=m;this.pin=this.materialState();
  this.mesh=new T.Points(this.geometry,m);this.mesh.name='Reusable signed centre stream';
  this.mesh.frustumCulled=false;this.clear();
 }
 private materialState(){
  const m=this.material;
  return [m.vertexShader,m.fragmentShader,m.version,m.side,m.blending,m.transparent,m.depthTest,m.depthWrite,
   m.depthFunc,m.colorWrite,m.stencilWrite,m.polygonOffset,m.alphaToCoverage,m.forceSinglePass,m.visible,
   m.allowOverride,m.clippingPlanes,m.uniforms,m.uniforms[H],m.onBeforeCompile,m.customProgramCacheKey,m.onBeforeRender];
 }
 owns(m:T.Material,g:T.BufferGeometry){
  const s=this.stamp,d=this.geometry.drawRange;
  return !this.dead&&!!s&&this.mesh.visible&&m===this.material&&m===this.mesh.material&&
   g===this.geometry&&g===this.mesh.geometry&&g.index===null&&!g.groups.length&&g.indirect===null&&
   g.getAttribute('position')===this.position&&g.getAttribute('peiBordenCentreClip')===this.screen&&
   d.start===0&&d.count===s[0]&&this.position.version===s[1]&&this.screen.version===s[2]&&
   this.materialState().every((item,i)=>item===this.pin[i]);
 }
 clear(){
  this.stamp=undefined;this.scalar.value=0;this.vetoDraw();this.mesh.visible=false;
  this.mesh.material.uniformsNeedUpdate=true;
 }
 stage(width:number,height:number,proof:readonly Centre[]){
  this.clear();
  if(this.dead||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||width>4096||height<=0||height>3072||
     proof.length>this.capacity||!proof.length)return false;
  this.used.clear();
  for(let j=0;j<proof.length;j++){
   const {x,y,point}=proof[j];const k=y*width+x;
   if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height||this.used.has(k)||
      !point.every(Number.isFinite)||point[0]<=CELL[0]||point[0]>=CELL[2]||point[2]<=CELL[1]||point[2]>=CELL[3]||
      point[1]<-.056||point[1]>6)return false;
   this.used.add(k);
   this.position.setXYZ(j,...point);
   this.screen.setXY(j,2*(x+.5)/width-1,1-2*(y+.5)/height);
  }
  this.position.clearUpdateRanges();this.screen.clearUpdateRanges();
  this.position.addUpdateRange(0,proof.length*3);this.screen.addUpdateRange(0,proof.length*2);
  this.position.needsUpdate=true;this.screen.needsUpdate=true;
  this.stamp=[proof.length,this.position.version,this.screen.version];
  this.geometry.setDrawRange(0,proof.length);this.mesh.visible=true;
  return true;
 }
 vetoDraw(){this.geometry.setDrawRange(this.position.count+1,0);}
 admit(on:boolean){
  this.scalar.value=Number(on&&!this.dead&&this.mesh.visible&&this.geometry.drawRange.count>0);
  this.mesh.material.uniformsNeedUpdate=true;
 }
 dispose(){
  if(this.dead)return;
  this.dead=true;this.clear();this.mesh.removeFromParent();
  this.geometry.dispose();this.mesh.material.dispose();
 }
}
