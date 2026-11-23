import {splitWalkCap,sidewalkGrid} from './sidewalks.ts';
import type {World} from './world.ts';
import {RUNWAYS} from '../sim/places.ts';
type V={x:number;z:number;u:number;v:number};
type Crown={x:number;y:number;z:number;height:number;width:number;variant:number};
type Box=readonly [number,number,number,number];
const LIFT=.024;
export function shadowFootprint(tree:Crown){
 const x=tree.x+.43*tree.height,z=tree.z+.21*tree.height;
 const w=tree.width*.71,d=tree.width*.595;
 return [
  {x:x-w,z:z-d,u:0,v:0},{x:x+w,z:z-d,u:1,v:0},{x:x+w,z:z+d,u:1,v:1},{x:x-w,z:z+d,u:0,v:1},
 ] as const;
}

/** Seat the original forest-shadow footprint, with no new trees, coverage
 * or occlusion layout. Dividing against facets keeps every face affine. */
export function groundedShadow(tree:Crown,g:ReturnType<typeof sidewalkGrid>,height:(x:number,z:number)=>number,
 emit:(x:number,y:number,z:number,u:number,v:number,t:number)=>void){
 const points=shadowFootprint(tree);
 for(const c of splitWalkCap([...points],g)){
  for(let i=1;i<c.length-1;i++){
   const [a,b,d]=[c[0],c[i],c[i+1]];
   if(Math.abs((b.x-a.x)*(d.z-a.z)-(b.z-a.z)*(d.x-a.x))<1e-7)continue;
   for(const p of [a,d,b])emit(p.x,height(p.x,p.z)+LIFT,p.z,p.u,p.v,tree.variant);
  }
 }
}
export function groundedShadowGuard(world:World){
 const t=world.terrain;
 const boxes:Box[]=world.terrain.surveyGrids.map(g=>[g.x0-55,g.z0-55,g.x1+55,g.z1+55]);
 for(const q of RUNWAYS){
  const pad=q.width+22;
  boxes.push([Math.min(q.p.x,q.q.x)-pad,Math.min(q.p.z,q.q.z)-pad,
    Math.max(q.p.x,q.q.x)+pad,Math.max(q.p.z,q.q.z)+pad]);
 }
 const safe=(box:Box)=>{
  if(boxes.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]))return false;
  if(world.cover.harbour?.intersects(...box)||world.bankGroundTouches?.(...box))return false;
  if(world.adaptiveState?.active.length&&world.visualGroundSignature(box).includes('*'))return false;
  // Leave a conservative buffer from water. The entire candidate area is
  // also checked by each subdivided polygon against this elevation gate.
  return [[box[0],box[1]],[box[2],box[1]],[box[0],box[3]],[box[2],box[3]]].every(([x,z])=>world.cover.distance(t,x,z)>45);
 };
 return safe;
}

import * as THREE from 'three';
import {regularRoadGround} from './road-contact.ts';

const shadowVert=`
 attribute vec3 shadeSupport; // root x,z, then the original canopy variant
 uniform vec3 volumeFade;
 varying vec2 shadeUV;
 varying vec2 shadeValue;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
  gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);
  shadeUV=uv;
  shadeValue=vec2(shadeSupport.z,volumeFade.z*(1.-smoothstep(volumeFade.x,volumeFade.y,
      length(shadeSupport.xy-cameraPosition.xz))));
 #include <logdepthbuf_vertex>
 }`;
const shadowFrag=`
 uniform sampler2D canopy;
 varying vec2 shadeUV,shadeValue;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
 #include <logdepthbuf_fragment>
 if(shadeValue.y<.002)discard;
 float r=length((shadeUV-.5)*2.);float ramp=1.-smoothstep(.21,.98,r);if(ramp<.009)discard;
 float mask=texture2D(canopy,vec2((shadeValue.x+shadeUV.x)*.25,.5*shadeUV.y)).a;
 gl_FragColor=vec4(.015,.021,.012,ramp*(.10+.18*mask)*shadeValue.y);
 }`;
export class GroundedTreeShadows{
 readonly mask:THREE.InstancedBufferAttribute;
 readonly mesh:THREE.Mesh;
 readonly fade:{value:THREE.Vector3};
 private readonly grid:ReturnType<typeof sidewalkGrid>;
 private readonly sceneWorld:World;
 private readonly receiver:(x:number,z:number)=>number;
 private readonly admissible:(b:Box)=>boolean;
 private checked=-1;
 private reliefVersion='';
 private previousCount=0;
 private built=0;
 constructor(scene:THREE.Scene,world:World,art:THREE.Texture,fade:{value:THREE.Vector3},maximum:number){
  this.grid=sidewalkGrid(world.terrain);this.sceneWorld=world;
  // The source canopy shader only blends within 50m of the eye; those
  // source points and their footprint live inside regular near terrain.
  this.receiver=regularRoadGround(world.terrain);
  this.admissible=groundedShadowGuard(world);
  this.fade=fade;
  this.mask=new THREE.InstancedBufferAttribute(new Float32Array(maximum),1).setUsage(THREE.DynamicDrawUsage);
  const m=new THREE.ShaderMaterial({vertexShader:shadowVert,fragmentShader:shadowFrag,
   uniforms:{canopy:{value:art},volumeFade:fade},side:THREE.DoubleSide,depthWrite:false,transparent:true,
   blending:THREE.NormalBlending,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
  this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),m);
  this.mesh.name='Seated near forest shadow footprints';this.mesh.frustumCulled=false;this.mesh.visible=false;
  scene.add(this.mesh);
 }
 update(stem:Float32Array,shape:Float32Array,states:Float32Array,num:number,revision:number){
  const on=this.fade.value.z>0;
  this.mesh.visible=on&&this.built>0;
  if(!on)return;
  // The adaptive option may keep a previously admitted 16m terrain tile
  // through descent. Re-check only the active set, not distant LOD churn.
  const relief=(this.sceneWorld.adaptiveState?.active??[]).slice().sort().join(';');
  if(revision===this.checked&&relief===this.reliefVersion)return;
  this.checked=revision;this.reliefVersion=relief;
  const current=this.mask.array as Float32Array;
  current.fill(0,0,Math.max(this.previousCount,num));this.previousCount=num;
  const points:number[]=[],coords:number[]=[],attrs:number[]=[];
  let n=0;
  for(let i=0;i<num;i++)if(states[i]>0){
   const k=i*3,t=i*4;
   const tree={x:stem[k],y:stem[k+1],z:stem[k+2],height:shape[t],width:shape[t+1],variant:shape[t+2]};
   const [a,,c]=shadowFootprint(tree);
   if(!this.admissible([a.x,a.z,c.x,c.z]))continue;
   const limit=points.length;
   groundedShadow(tree,this.grid,this.receiver,(x,y,z,u,v,m)=>{
    points.push(x,y,z);coords.push(u,v);attrs.push(tree.x,tree.z,m);
   });
   if(points.length>limit){n++;current[i]=1;}
  }
  this.mask.needsUpdate=true;
  this.built=n;this.mesh.visible=on&&n>0;
  const old=this.mesh.geometry,g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(coords,2));
  g.setAttribute('shadeSupport',new THREE.Float32BufferAttribute(attrs,3));
  this.mesh.geometry=g;old.dispose();
 }
 get count(){return this.mesh.visible?this.built:0;}
}
