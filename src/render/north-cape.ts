import * as T from 'three';
import type {World} from './world.ts';
import {NORTH_CAPE_SITES as SITE,NORTH_CAPE_AZIMUTH as AZIMUTH,NORTH_CAPE_RPM,NORTH_CAPE_ROTATION_OFFSET} from './north-cape-shadow.ts';
import {NORTH_CAPE_HUB_M,NORTH_CAPE_ROTOR_OFFSET,northCapeMast,northCapeRotor} from './north-cape-geometry.ts';

const VISIBLE_M=7800,NEAR_M=1250;
const rotorSecs=60/NORTH_CAPE_RPM;
const TWOPI=Math.PI*2;
const CENTER=SITE[7],SPAN=Math.max(...SITE.map(s=>Math.hypot(s.x-CENTER.x,s.z-CENTER.z)));
const mask=(m:T.InstancedMesh,count:number)=>{m.count=count;m.visible=count!==0;if(count)m.instanceMatrix.needsUpdate=true;};

function northCapeMaterial(){
 const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.77,metalness:.11});
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 detailP,stationP;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   detailP=position;
   stationP=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;`);
  shader.fragmentShader='varying vec3 detailP,stationP;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float d=distance(cameraPosition,stationP);
   float fade=1.-smoothstep(34.,332.,d);
   float chalk=(sin(detailP.y*3.7+detailP.x*1.2)+sin(detailP.y*10.1-detailP.z*18.7))*.25;
   diffuseColor.rgb*=1.+chalk*.045*fade;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float haze=(1.-exp(-d*(.000013+.000008*exp(-max(stationP.y,0.)/1100.))));
   outgoingLight=mix(outgoingLight,vec3(.56,.68,.72),clamp(haze,0.,.91));
   #include <opaque_fragment>`);
 };
 return m;
}
export class NorthCapeScenery {
 readonly root=new T.Group();
 private readonly seat=new Float64Array(SITE.length);
 private lastEpoch=-1;
 private cooldownX=Infinity; private cooldownZ=Infinity;
 private readonly active=new Int8Array(SITE.length).fill(-1);
 private readonly q=new T.Quaternion();
 private readonly yaw=new T.Quaternion().setFromAxisAngle(T.Object3D.DEFAULT_UP,AZIMUTH);
 private readonly roll=new T.Quaternion();
 private readonly v=new T.Vector3(1,0,0);
 private readonly scale=new T.Vector3(1,1,1);
 private readonly pos=new T.Vector3();
 private readonly matrix=new T.Matrix4();
 private readonly mat=northCapeMaterial();
 private readonly lod=[true,false].map(far=>{
  const mast=new T.InstancedMesh(northCapeMast(far),this.mat,SITE.length);
  const rotor=new T.InstancedMesh(northCapeRotor(far),this.mat,SITE.length);
  for(const m of [mast,rotor]){
   m.count=0;m.visible=false;m.frustumCulled=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(m);
  }
  mast.name='North Cape V47 mast and nacelle '+(far?'cruise':'near');rotor.name='North Cape V47 original rotors '+(far?'cruise':'near');
  return {mast,rotor};
 });
 readonly mode=new Uint8Array(SITE.length);
 readonly counts={registered:0,near:0,cruise:0};
 private readonly world:Pick<World,'visualGroundEpoch'|'surface'|'visualGroundHeight'|'capeShadow'>;
 constructor(scene:T.Scene,world:Pick<World,'visualGroundEpoch'|'surface'|'visualGroundHeight'|'capeShadow'>){
  this.world=world;
  this.root.name='North Cape commercial wind farm';scene.add(this.root);this.root.visible=false;
 }
 dispose(){
  this.root.removeFromParent();
  for(const {mast,rotor} of this.lod){
   mast.dispose();rotor.dispose();mast.geometry.dispose();rotor.geometry.dispose();
  }
  this.mat.dispose();
 }
 private rest(){
  if(this.lastEpoch===this.world.visualGroundEpoch)return;
  this.lastEpoch=this.world.visualGroundEpoch;
  for(const [i,s] of SITE.entries()){
   const surface=this.world.surface(s.x,s.z);
   this.seat[i]=surface.land?this.world.visualGroundHeight(s.x,s.z):Number.NaN;
   this.world.capeShadow?.setBase(i,this.seat[i]);
  }
  this.counts.registered=this.seat.reduce((n,y)=>n+Number(Number.isFinite(y)),0);
 }
 update(eye:T.Vector3,time:number){
  if(Math.hypot(eye.x-CENTER.x,eye.z-CENTER.z)>VISIBLE_M+SPAN){
   this.root.visible=false;this.counts.near=this.counts.cruise=0;this.cooldownX=Infinity;return;
  }
  const changedGround=this.lastEpoch!==this.world.visualGroundEpoch;
  this.root.visible=true;this.rest();
  const reassign=changedGround||Math.hypot(eye.x-this.cooldownX,eye.z-this.cooldownZ)>9;
  if(reassign){
   this.cooldownX=eye.x;this.cooldownZ=eye.z;
   for(let i=0;i<SITE.length;i++){
    const s=SITE[i],d=Math.hypot(eye.x-s.x,eye.z-s.z);
    if(!Number.isFinite(this.seat[i])||d>VISIBLE_M){this.active[i]=-1;continue;}
    // Small visual hysteresis prevents near/cruise flapping on the boundary.
    this.mode[i]=Number(d<NEAR_M+(this.mode[i]?85:0));
    this.active[i]=this.mode[i];
   }
  }
  const ux=Math.cos(AZIMUTH),uz=-Math.sin(AZIMUTH);
  if(this.world.capeShadow)this.world.capeShadow.uniforms.capeClock.value=time;
  const phase=time%rotorSecs/rotorSecs*TWOPI;
  let cruise=0,near=0;
  for(let i=0;i<SITE.length;i++){
   const j=this.active[i];if(j<0)continue;
   const s=SITE[i],y=this.seat[i],at=j?near++:cruise++,m=this.lod[j];
   if(reassign){
    this.pos.set(s.x,y,s.z);
    m.mast.setMatrixAt(at,this.matrix.compose(this.pos,this.yaw,this.scale));
   }
   this.roll.setFromAxisAngle(this.v,-phase+i*NORTH_CAPE_ROTATION_OFFSET);
   this.q.copy(this.yaw).multiply(this.roll);
   this.pos.set(s.x+ux*NORTH_CAPE_ROTOR_OFFSET,y+NORTH_CAPE_HUB_M,s.z+uz*NORTH_CAPE_ROTOR_OFFSET);
   m.rotor.setMatrixAt(at,this.matrix.compose(this.pos,this.q,this.scale));
  }
  for(const [i,m] of this.lod.entries()){
   const n=i?near:cruise;
   if(reassign)mask(m.mast,n);
   mask(m.rotor,n);
  }
  this.counts.cruise=cruise;this.counts.near=near;
 }
}
