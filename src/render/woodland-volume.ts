import * as THREE from 'three';
import {branchedCrown} from './woodland-volume-geometry.ts';
import type {World} from './world.ts';
import {GroundedTreeShadows} from './grounded-tree-shadow.ts';
// A 115.2m-wide interval intersects at most eleven 12m source cells in
// each axis. Include all queried stems so there is no density-rank cutoff.
const MAX_RANGE=50,QUERY_RADIUS=57.6;
export const WOODLAND_VOLUME_LIMIT=121;
const LIMIT=WOODLAND_VOLUME_LIMIT;
const v=`
 attribute vec3 treeStem;
 attribute vec4 treeShape;
 attribute vec2 treeSpin;
#ifdef BLC_PILOT
 attribute float crownLift;
 uniform float crownVertical;
#endif
 attribute vec2 branchDetail;
 uniform vec3 volumeFade;
 varying vec3 fWorld,fNormal;
 varying vec2 fCard,fDetail;
 varying float fFade,fVariant;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 vec3 spun(vec3 q){return vec3(q.x*treeSpin.x-q.z*treeSpin.y,q.y,q.x*treeSpin.y+q.z*treeSpin.x);}
 void main(){
  vec3 scale=vec3(treeShape.y,treeShape.x,treeShape.y);
  vec3 vertex=position;
#ifdef BLC_PILOT
  // Anchor the root and the upper quarter, including the original top.
  const float ceiling=.76;
  if(crownLift>0. && vertex.y>0. && vertex.y<ceiling){
   float t=vertex.y/ceiling;
   float amplitude=(crownLift/treeShape.x)*(1.-smoothstep(27.,38.,length(treeStem.xz-cameraPosition.xz)))*crownVertical;
   float u=1.-t;
   // t(1-t)^3 peaks at 27/256; this is a genuine maximum shift.
   float k=amplitude*(256./27.);
   vertex.y+=k*t*u*u*u;
   scale.y*=1.+k*u*u*(1.-4.*t)/ceiling;
  }
#endif
  fWorld=treeStem+spun(vertex*vec3(treeShape.y,treeShape.x,treeShape.y));
  fNormal=normalize(spun(normal/scale));
  fCard=uv;fDetail=vec2(branchDetail.x,branchDetail.y*treeShape.w);fVariant=treeShape.z;
  fFade=volumeFade.z*(1.-smoothstep(volumeFade.x,volumeFade.y,length(treeStem.xz-cameraPosition.xz)));
  gl_Position=projectionMatrix*viewMatrix*vec4(fWorld,1.);
 #include <logdepthbuf_vertex>
 }`;
const f=`
 varying vec3 fWorld,fNormal;
 varying vec2 fCard,fDetail;
 varying float fFade,fVariant;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 float branchHash(vec2 p){
  vec2 q=fract(p*vec2(.103,.139));return fract(dot(q.xy,q.yx+18.8)*41.6);
 }
 float leaves(vec2 p,bool needle,float seed){
  float mask=0.;
  for(int i=0;i<6;i++){
   float u=float(i),e=2.*mod(u,2.)-1.;
   float variation=fract(sin(u*11.44+seed*91.3)*1237.32);
   float y=-.69+u*.258+(variation-.5)*.093;
   float w=(1.-u*.086)*(.64+.35*variation);
   vec2 a=p-vec2(e*(.195+.098*variation)*w,y);
   float angle=e*(.35+.41*variation);
   float t=sin(angle),s=cos(angle);
   vec2 q=vec2(a.x*s+a.y*t,-a.x*t+a.y*s);
   q/=vec2((needle?.429:.39)*w,needle?.105:.171+variation*.054);
   float d=dot(q,q);
   if(!needle)d+=.015*sin(q.x*21.+q.y*13.+seed*6.)+.021*sin(q.y*16.-q.x*9.);
   mask=max(mask,1.-smoothstep(.69,1.10,d));
  }
  vec2 top=(p-vec2((seed-.5)*.13,.63))/vec2(.16,.29);
  return max(mask,1.-smoothstep(.77,1.12,dot(top,top)));
 }
 void main(){
 #include <logdepthbuf_fragment>
 if(fFade<.003)discard;
 vec3 n=normalize(fNormal),sun=normalize(vec3(-.60,.74,-.31));
 float fade=fFade,side=dot(n,sun),lift=.32+.22*abs(n.y);
 vec3 c;
 if(fDetail.x>.5){
  bool needle=fDetail.x>1.5;
  float seed=fract(fDetail.y*35.71);
  fade*=leaves(fCard,needle,seed);
  if(fade<.055)discard;
  float crisp=1.-smoothstep(.021,.115,length(fwidth(fWorld)));
  float tint=mix(seed,branchHash(floor(fWorld.xz*vec2(9.1,8.4)+fWorld.y*16.)),crisp);
  float axisShade=.83+.17*smoothstep(-.5,.79,fCard.y);
  // Keep the established original canopies' warm/cool families rather
  // than tinting every broadleaf or needle cluster one uniform green.
  vec3 broad=mix(vec3(.091,.127,.037),vec3(.048,.105,.028),step(.5,fVariant));
  vec3 needles=mix(vec3(.034,.080,.028),vec3(.028,.070,.025),step(2.5,fVariant));
  vec3 leaf=needle?needles:broad;
  c=leaf*fDetail.y*axisShade*(lift+.43*abs(side)+.215*tint);
  c+=vec3(.012,.021,.007)*max(0.,-side)*.24;
 }else{
  float grain=branchHash(vec2(floor(fCard.x*27.),floor(fWorld.y*15.)));
  float split=abs(fract(fCard.x*15.+floor(fWorld.y*1.1)*.127)-.5);
  c=mix(vec3(.041,.031,.019),vec3(.099,.081,.059),grain*.60+.35*split)*
   (.52+.47*max(0.,side));
 }
 gl_FragColor=vec4(c,fade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
type Group={geometry:THREE.InstancedBufferGeometry;stem:THREE.InstancedBufferAttribute;shape:THREE.InstancedBufferAttribute;
 spin:THREE.InstancedBufferAttribute;lift?:THREE.InstancedBufferAttribute;mesh:THREE.Mesh};
interface Candidate{slot:number;distance:number;}
export class WoodlandVolume{
 readonly fade={value:new THREE.Vector3(38,MAX_RANGE,0)};
 readonly mask:THREE.InstancedBufferAttribute;
 private readonly groups:Group[];
 private settledX=Infinity;private settledZ=Infinity;private forestRevision=-1;
 private prevCount=0;private selected=0;
 private roster=0;
 get rosterVersion(){return this.roster;}
 private readonly crownLift?: (x:number,z:number,height:number,slot:number)=>number;
 private crownAdmission=new Map<string,number>();
 private changed=0;
 private readonly crownVertical={value:0};
 constructor(scene:THREE.Scene,maxInstances:number,crownLift?: (x:number,z:number,height:number,slot:number)=>number){
  this.crownLift=crownLift;
  this.mask=new THREE.InstancedBufferAttribute(new Float32Array(maxInstances),1).setUsage(THREE.DynamicDrawUsage);
  const material=new THREE.ShaderMaterial({vertexShader:v,fragmentShader:f,side:THREE.DoubleSide,
    alphaToCoverage:true,uniforms:{volumeFade:this.fade}});
  this.groups=Array.from({length:4},(_,variant)=>{
   const template=branchedCrown(variant),geometry=new THREE.InstancedBufferGeometry();
   geometry.setIndex(template.index);
   for(const [k,a] of Object.entries(template.attributes))geometry.setAttribute(k,a);
   const attribute=(size:number)=>new THREE.InstancedBufferAttribute(new Float32Array(LIMIT*size),size).setUsage(THREE.DynamicDrawUsage);
   const stem=attribute(3),shape=attribute(4),spin=attribute(2);
   geometry.setAttribute('treeStem',stem);geometry.setAttribute('treeShape',shape);geometry.setAttribute('treeSpin',spin);
   geometry.instanceCount=0;
   const lift=(variant>=2&&crownLift)?attribute(1):undefined;
   let activeMaterial=material;
   if(lift){
    geometry.setAttribute('crownLift',lift);
    activeMaterial=new THREE.ShaderMaterial({vertexShader:v,fragmentShader:f,side:THREE.DoubleSide,alphaToCoverage:true,
     defines:{BLC_PILOT:1},uniforms:{volumeFade:this.fade,crownVertical:this.crownVertical}});
   }
   const mesh=new THREE.Mesh(geometry,activeMaterial);
   mesh.frustumCulled=false;mesh.visible=false;mesh.name='Near branched woodland '+variant;scene.add(mesh);
   return {geometry,stem,shape,spin,lift,mesh};
  });
 }
 update(stems:Float32Array,shapes:Float32Array,trees:number,x:number,z:number,agl:number,revision:number){
  this.fade.value.z=1-THREE.MathUtils.smoothstep(agl,39,112);
  if(this.crownLift)this.crownVertical.value=1-THREE.MathUtils.smoothstep(agl,18,39);
  const on=this.fade.value.z>0;
  for(const g of this.groups)g.mesh.visible=on&&g.geometry.instanceCount>0;
  if(!on){if(this.crownLift){this.crownAdmission.clear();this.changed=0;this.forestRevision=-1;}return;}
  if(revision===this.forestRevision&&Math.hypot(x-this.settledX,z-this.settledZ)<7.5)return;
  this.forestRevision=revision;this.settledX=x;this.settledZ=z;
  const p:Candidate[]=[];
  for(let i=0;i<trees;i++){
   const d2=(stems[i*3]-x)**2+(stems[i*3+2]-z)**2;
   if(d2<QUERY_RADIUS**2)p.push({slot:i,distance:Math.sqrt(d2)});
  }
  p.sort((a,b)=>a.distance-b.distance||a.slot-b.slot);
  // Membership can change only outside the 50 m fade and its maximum
  // 7.5 m translation before rescan; camera motion cannot cut a live stem.
  this.selected=0;this.changed=0;this.roster++;
  const nextAdmission=this.crownLift?new Map<string,number>():undefined;
  const bits=this.mask.array as Float32Array;
  bits.fill(0,0,Math.max(this.prevCount,trees));this.prevCount=trees;
  const l=[0,0,0,0];
  for(const q of p.slice(0,LIMIT)){
   const i=q.slot,j=i*4,k=i*3,variant=shapes[j+2]|0,g=this.groups[variant];
   if(!g)continue;
   const u=l[variant]++;
   const sx=stems[k],sz=stems[k+2],hash=Math.imul(Math.floor(sx*5),0x45d9f3b)^Math.imul(Math.floor(sz*5),0x119de1f3);
   const turn=(hash>>>0)*(2*Math.PI/4294967296);
   g.stem.setXYZ(u,sx,stems[k+1],sz);
   g.shape.setXYZW(u,shapes[j],shapes[j+1],variant,shapes[j+3]);g.spin.setXY(u,Math.cos(turn),Math.sin(turn));
   if(g.lift&&nextAdmission&&this.crownLift){
    const key=sx+','+sz+','+shapes[j];
    // A live stem never changes cohort during a delayed download. This
    // entry is readmitted only after passing the 57.6 m roster fence.
    const lift=this.crownAdmission.get(key)??this.crownLift(sx,sz,shapes[j],i);
    nextAdmission.set(key,lift);g.lift.setX(u,lift);
    if(lift>0)this.changed++;
   }
   bits[i]=1;this.selected++;
  }
  if(nextAdmission)this.crownAdmission=nextAdmission;
  this.mask.needsUpdate=true;
  for(const [i,g] of this.groups.entries()){
   g.geometry.instanceCount=l[i];g.mesh.visible=on&&l[i]>0;
   for(const a of [g.stem,g.shape,g.spin,g.lift]){
    if(!a)continue;
    a.clearUpdateRanges();a.addUpdateRange(0,l[i]*a.itemSize);a.needsUpdate=true;
   }
  }
 }
 makeGroundedShadows(scene:THREE.Scene,world:World,art:THREE.Texture,maxInstances:number){
  return new GroundedTreeShadows(scene,world,art,this.fade,maxInstances);
 }
 get crownCount(){return this.changed;}
 get count(){return this.fade.value.z>0?this.selected:0;}
}
