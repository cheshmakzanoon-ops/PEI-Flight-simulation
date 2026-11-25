import * as THREE from 'three';
import {WOODLAND_STREAM_TAGS,WoodlandViewRows,woodlandEye,type WoodlandCullGroup,type WoodlandStreams} from './woodland-volume-cull.ts';
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
 #ifdef BARK_SCAN
 varying vec3 fBarkSpace;
 #endif
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
  vec3 local=spun(vertex*vec3(treeShape.y,treeShape.x,treeShape.y));
  fWorld=treeStem+local;
  fNormal=normalize(spun(normal/scale));
#ifdef BARK_SCAN
  // Horizontal components are the same rest surface through a vertical
  // warp. Local displayed Y agrees on joins, without a wrapped UV.
  fBarkSpace=local+vec3(2.174*treeSpin.x+.9,2.031*treeSpin.y+1.1,2.593*treeSpin.y-.79*treeSpin.x);
#endif
  fCard=uv;fDetail=vec2(branchDetail.x,branchDetail.y*treeShape.w);fVariant=treeShape.z;
  fFade=volumeFade.z*(1.-smoothstep(volumeFade.x,volumeFade.y,length(treeStem.xz-cameraPosition.xz)));
  gl_Position=projectionMatrix*viewMatrix*vec4(fWorld,1.);
 #include <logdepthbuf_vertex>
 }`;
const f=`
 #ifdef BARK_SCAN
 uniform sampler2D barkMap;
 uniform float barkGain;
 varying vec3 fBarkSpace;
 #endif
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
#ifdef BARK_SCAN
  // Form derivatives before per-fragment alpha/range branches diverge.
  vec3 barkDx=dFdx(fBarkSpace),barkDy=dFdy(fBarkSpace);
#endif
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
#ifdef BARK_SCAN
  float weight=barkGain*(1.-smoothstep(11.,25.,length(fWorld-cameraPosition)));
  if(weight>.001){
   vec2 w=pow(abs(n.xz),vec2(3.5));float denom=w.x+w.y;
   w+=vec2(.5*max(0.,.001-denom));w/=max(.001,denom);
   bool needle=fVariant>=1.5;
   float rate=needle?.62:1.23;
   vec2 pu=fBarkSpace.xy*rate,pv=fBarkSpace.zy*rate;
   vec4 u=textureGrad(barkMap,pu,barkDx.xy*rate,barkDy.xy*rate);
   vec4 v=textureGrad(barkMap,pv,barkDx.zy*rate,barkDy.zy*rate);
   vec4 sampleValue=u*w.y+v*w.x;
   float diffuse=clamp(side,0.,1.),l=clamp(needle?sampleValue.g:sampleValue.r,0.,1.);
   float occ=needle?sampleValue.a:sampleValue.b;
   vec3 low=needle?vec3(.029,.018,.009):vec3(.034,.026,.016);
   vec3 high=needle?vec3(.165,.104,.061):vec3(.177,.146,.106);
   vec3 resolved=mix(low,high,pow(l,.71))*(.68+.32*diffuse)*(.77+.23*occ);
   c=mix(c,resolved,weight*.96);
  }
#endif
 }
 gl_FragColor=vec4(c,fade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
type DrawContract={compile:THREE.ShaderMaterial['onBeforeCompile'];pos:THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
 posVersion:number;defines:Record<string,unknown>;keys:readonly string[]};
type Group=WoodlandCullGroup&{drawContract:DrawContract;rows?:WoodlandViewRows;donor:THREE.ShaderMaterial;geometry:THREE.InstancedBufferGeometry;stem:THREE.InstancedBufferAttribute;shape:THREE.InstancedBufferAttribute;
 spin:THREE.InstancedBufferAttribute;lift?:THREE.InstancedBufferAttribute;mesh:THREE.Mesh};
interface Candidate{slot:number;distance:number;}
export class WoodlandVolume{
 readonly fade={value:new THREE.Vector3(38,MAX_RANGE,0)};
 readonly mask:THREE.InstancedBufferAttribute;
 private readonly groups:Group[];
 private readonly viewFrustum=new THREE.Frustum();
 private readonly viewMatrix=new THREE.Matrix4();
 private readonly viewEligible:boolean;
 private viewEnabled:boolean;
 private viewActive=false;
 private readonly viewScene:THREE.Scene;
 private settledX=Infinity;private settledZ=Infinity;private forestRevision=-1;
 private prevCount=0;private selected=0;
 private roster=0;
 get rosterVersion(){return this.roster;}
 private readonly crownLift?: (x:number,z:number,height:number,slot:number)=>number;
 private crownAdmission=new Map<string,number>();
 private changed=0;
 private readonly crownVertical={value:0};
 private readonly barkMap={value:null as THREE.DataTexture|null};
 private readonly barkGain={value:0};
 private readonly barkLoader?:()=>Promise<THREE.DataTexture|undefined>;
 private barkStarted=false;
 private barkLast=0;
 get barkState(){return this.barkMap.value?'ready':this.barkStarted?'optional':'waiting';}
 constructor(scene:THREE.Scene,maxInstances:number,crownLift?: (x:number,z:number,height:number,slot:number)=>number,
  barkLoader?:()=>Promise<THREE.DataTexture|undefined>,useViewCull=true){
  this.viewEligible=this.viewEnabled=useViewCull;this.viewScene=scene;
  this.crownLift=crownLift;this.barkLoader=barkLoader;
  const barkDefines=barkLoader?{BARK_SCAN:1}:{};
  const barkUniforms:Record<string,THREE.IUniform>=barkLoader?{barkMap:this.barkMap,barkGain:this.barkGain}:{};
  this.mask=new THREE.InstancedBufferAttribute(new Float32Array(maxInstances),1).setUsage(THREE.DynamicDrawUsage);
  const material=new THREE.ShaderMaterial({vertexShader:v,fragmentShader:f,side:THREE.DoubleSide,
    alphaToCoverage:true,defines:barkDefines,uniforms:{volumeFade:this.fade,...barkUniforms}});
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
     defines:{BLC_PILOT:1,...barkDefines},uniforms:{volumeFade:this.fade,crownVertical:this.crownVertical,...barkUniforms}});
   }
   const mesh=new THREE.Mesh(geometry,activeMaterial);
   mesh.frustumCulled=false;mesh.visible=false;mesh.name='Near branched woodland '+variant;scene.add(mesh);
   template.computeBoundingBox();
   const pos=geometry.getAttribute('position'),defines={...activeMaterial.defines};
   const drawContract:DrawContract={compile:activeMaterial.onBeforeCompile,pos,posVersion:(pos as THREE.BufferAttribute).version,defines,keys:Object.keys(defines)};
   const g:Group={geometry,stem,shape,spin,lift,mesh,donor:activeMaterial,drawContract,sourceCount:0,
    streams:{treeStem:stem,treeShape:shape,treeSpin:spin,crownLift:lift},templateBox:template.boundingBox!,triangleCount:template.index!.count/3};
   if(useViewCull)g.rows=new WoodlandViewRows(g,LIMIT);
   return g;
  });
  if(useViewCull){
   // Three has updated the final camera here, including a same-tick turn or a changed viewport,
   // but has not yet collected/uploaded these instanced draw attributes. Never use a previous view.
   const previous=scene.onBeforeRender;
   scene.onBeforeRender=(...args)=>{
    previous.apply(scene,args);
    const [renderer,,camera,target]=args;
    this.updateView(!target&&!renderer.xr?.isPresenting?camera:undefined);
   };
  }
 }
 private bind(g:Group,s:WoodlandStreams,n:number){
  for(const k of WOODLAND_STREAM_TAGS){const a=s[k];if(a&&g.geometry.getAttribute(k)!==a)g.geometry.setAttribute(k,a);}
  g.geometry.instanceCount=n;
 }
 /** A source camera may change between draws without a forest re-scan. Reuse original, ordered
  * candidates; never touch billboard ownership, grounded shade receivers or per-tree lift admission. */
 updateView(camera?:THREE.Camera){
  const outer=this.fade.value.y;
  this.viewActive=this.viewEnabled&&this.count>0&&this.fade.value.x===38&&outer===MAX_RANGE&&this.fade.value.z<=1&&
    this.viewScene.overrideMaterial===null&&woodlandEye(camera,this.viewMatrix,this.viewFrustum)&&this.groups.every(g=>{
     const m=g.donor,d=g.drawContract,defs=m.defines;
     return g.mesh.geometry===g.geometry&&g.mesh.material===m&&m.vertexShader===v&&m.fragmentShader===f&&
      m.onBeforeCompile===d.compile&&m.uniforms.volumeFade===this.fade&&m.side===THREE.DoubleSide&&m.alphaToCoverage&&
      !m.transparent&&!m.wireframe&&!m.alphaHash&&m.alphaTest===0&&m.depthWrite&&m.blending===THREE.NormalBlending&&
      g.geometry.getAttribute('position')===d.pos&&(d.pos as THREE.BufferAttribute).version===d.posVersion&&
      defs&&Object.keys(defs).length===d.keys.length&&d.keys.every(k=>defs[k]===d.defines[k]);
    });
  if(!this.viewActive){
   for(const g of this.groups)this.bind(g,g.streams,g.sourceCount);
   return;
  }
  const w=camera!.matrixWorld.elements;
  for(const g of this.groups){
   const rows=g.rows!,n=rows.select(this.viewFrustum,w[12],w[14],outer,this.roster);
   if(n===g.sourceCount){this.bind(g,g.streams,n);continue;}
   rows.pack(n,this.roster);this.bind(g,rows.compact,n);
  }
 }
 /** Isolated rollback for this submission change. A command-line stock selection cannot enroll here. */
 setViewCull(on:boolean){this.viewEnabled=this.viewEligible&&on;if(!this.viewEnabled)this.updateView();}
 get viewState(){
  const admitted=this.count,submitted=admitted?this.groups.reduce((m,g)=>m+g.geometry.instanceCount,0):0;
  return {enabled:this.viewEnabled,active:this.viewActive&&admitted>0,admitted,submitted,
   submittedTriangles:admitted?this.groups.reduce((m,g)=>m+g.geometry.instanceCount*g.triangleCount,0):0};
 }
 update(stems:Float32Array,shapes:Float32Array,trees:number,x:number,z:number,agl:number,revision:number){
  if(this.barkLoader){
   if(!this.barkStarted&&agl<55&&this.selected>0){
    this.barkStarted=true;
    void this.barkLoader().then(t=>{if(t)this.barkMap.value=t;}).catch(()=>{});
   }
   const now=performance.now(),dt=Math.min(.12,Math.max(0,(now-this.barkLast)*.001));
   this.barkLast=now;
   if(this.barkMap.value)this.barkGain.value=Math.min(1,this.barkGain.value+dt/.45);
  }
  this.fade.value.z=1-THREE.MathUtils.smoothstep(agl,39,112);
  if(this.crownLift)this.crownVertical.value=1-THREE.MathUtils.smoothstep(agl,18,39);
  const on=this.fade.value.z>0;
  for(const g of this.groups)g.mesh.visible=on&&g.sourceCount>0;
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
   g.sourceCount=l[i];g.geometry.instanceCount=l[i];g.mesh.visible=on&&l[i]>0;
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
