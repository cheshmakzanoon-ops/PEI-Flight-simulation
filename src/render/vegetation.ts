import {MONTAGUE_GROUND_ID} from '../sim/montague-bridge.ts';
import * as THREE from 'three';
import type {Terrain} from '../sim/terrain.ts';
import type {Cover} from '../sim/cover.ts';
import type {ForestHeights} from '../sim/forest-heights.ts';
import type {WoodlandVolume} from './woodland-volume.ts';
import type {World} from './world.ts';
import type {GroundedTreeShadows} from './grounded-tree-shadow.ts';
import type {HedgeStream} from '../sim/hedge-stream.ts';
import type {ForestStream} from '../sim/forest-stream.ts';
import {insideLighthouseYard} from '../sim/lighthouse-sites.ts';
import {runwayAt} from '../sim/places.ts';
import {TREE_PITCH as pitch,TREE_TILE_SIDE as side,treeRandom as rand} from '../sim/tree-layout.ts';
import {fillRoofTile} from '../sim/tree-clearance.ts';
const span=pitch*side,radius=1530,maxTrees=45000;
const pars=`
 attribute vec3 stem;attribute vec4 shape;varying vec2 vUV;varying vec3 param;
 #include <common>
 #include <logdepthbuf_pars_vertex>`;
const crownV=pars+`
 void main(){
  vec3 ray=normalize(cameraPosition-(stem+vec3(0.,shape.x*.5,0.)));
  vec3 right=normalize(vec3(ray.z+.00001,0.,-ray.x));vec3 up=normalize(cross(ray,right));
  float tilt=smoothstep(.19,.80,ray.y);float portrait=mix(shape.x*1.04,shape.y,tilt);
  vec3 center=stem+vec3(0.,shape.x*mix(.47,.65,tilt),0.);
  vec3 p=center+position.x*shape.y*right+position.y*portrait*up;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);vUV=uv;param=vec3(shape.z,tilt,shape.w);
 #include <logdepthbuf_vertex>
 }`;
const crownF=`
 varying vec2 vUV;varying vec3 param;uniform sampler2D canopy;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
 #include <logdepthbuf_fragment>
 vec2 uv=clamp(vUV,vec2(.004),vec2(.996));
 vec4 side=texture2D(canopy,vec2((param.x+uv.x)*.25,.50+.5*uv.y));
 vec4 top=texture2D(canopy,vec2((param.x+uv.x)*.25,.5*uv.y));
 float a=mix(side.a,top.a,param.y);if(a<.30)discard;
 vec3 c=mix(side.rgb*side.a,top.rgb*top.a,param.y)/max(a,.001);
 gl_FragColor=vec4(c*param.z,clamp((a-.30)*3.8,0.,1.));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
const shadowV=pars+`
 attribute vec4 hedgeGround;
 void main(){
  vec2 off=vec2(.43,.21)*shape.x;
  vec3 p=stem+vec3(off.x+position.x*shape.y*1.42,.46,off.y+position.y*shape.y*1.19);
  // Existing forest shadows retain their prior path. The appended hedge
  // support follows the same regular terrain triangles as the roots.
  if(any(notEqual(hedgeGround,vec4(0.)))){
   vec2 st=position.xy+.5;
   p.y=mix(mix(hedgeGround.x,hedgeGround.y,st.x),mix(hedgeGround.z,hedgeGround.w,st.x),st.y);
  }
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);vUV=uv;param=vec3(shape.z,0.,shape.w);
 #include <logdepthbuf_vertex>
 }`;
const shadowF=`
 varying vec2 vUV;varying vec3 param;uniform sampler2D canopy;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
 #include <logdepthbuf_fragment>
 float r=length((vUV-.5)*2.);float ramp=1.-smoothstep(.21,.98,r);if(ramp<.009)discard;
 float mask=texture2D(canopy,vec2((param.x+vUV.x)*.25,.5*vUV.y)).a;
 gl_FragColor=vec4(.015,.021,.012,ramp*(.10+.18*mask));
 }`;
/** Both elevation views of each tree are baked from the same original branching model.
 * ESA WorldCover determines forest distribution; stand density, species and individual stems are inferred. */
export class Vegetation {
 private crown:THREE.Mesh;private shade:THREE.Mesh;private geom:THREE.InstancedBufferGeometry;
 private stems=new THREE.InstancedBufferAttribute(new Float32Array(maxTrees*3),3).setUsage(THREE.DynamicDrawUsage);
 private shapes=new THREE.InstancedBufferAttribute(new Float32Array(maxTrees*4),4).setUsage(THREE.DynamicDrawUsage);
 private hedgeGround=new THREE.InstancedBufferAttribute(new Float32Array(maxTrees*4),4).setUsage(THREE.DynamicDrawUsage);
 private hedgeStart=0;
 private forestRevision=0;
 private volume?:WoodlandVolume;
 private groundedShadow?:GroundedTreeShadows;
 private hedgeRev=-1;private hedgeApply=0;private lastHedges=0;
 get hedgeCount(){return this.lastHedges;}
 private lastX=Infinity;private lastZ=Infinity;private cache=new Map<string,Float32Array>();
 constructor(scene:THREE.Scene,private t:Terrain,private cover:Cover,private forestHeights?:ForestHeights,private forestStream?:ForestStream,
  private hedges?:HedgeStream,private decorativeY?:(x:number,z:number)=>number,private plantedY?:(x:number,z:number)=>number|undefined){
  const g=new THREE.InstancedBufferGeometry(),plane=new THREE.PlaneGeometry(1,1);g.index=plane.index;g.setAttribute('position',plane.getAttribute('position'));g.setAttribute('uv',plane.getAttribute('uv'));
  g.setAttribute('stem',this.stems);g.setAttribute('shape',this.shapes);g.setAttribute('hedgeGround',this.hedgeGround);g.instanceCount=0;this.geom=g;
  const canopy=new THREE.TextureLoader().load(import.meta.env.BASE_URL+'art/canopy.webp');canopy.colorSpace=THREE.SRGBColorSpace;canopy.anisotropy=2;
  const uniforms={canopy:{value:canopy}};
  this.crown=new THREE.Mesh(g,new THREE.ShaderMaterial({vertexShader:crownV,fragmentShader:crownF,uniforms,side:THREE.DoubleSide,alphaToCoverage:true}));
  this.shade=new THREE.Mesh(g,new THREE.ShaderMaterial({vertexShader:shadowV,fragmentShader:shadowF,uniforms,side:THREE.DoubleSide,depthWrite:false,transparent:true,blending:THREE.NormalBlending,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
  this.crown.frustumCulled=this.shade.frustumCulled=false;this.crown.name='Mixed woodland canopies';this.shade.name='Canopy ground shadows';scene.add(this.crown,this.shade);
 }
 attachVolume(layer:WoodlandVolume,world?:World,scene?:THREE.Scene){
  this.volume=layer;this.geom.setAttribute('branchActive',layer.mask);
  const previous=this.crown.material as THREE.ShaderMaterial;
  const vert=`
    attribute float branchActive;uniform vec3 volumeFade;varying float branchWeight;
  `+crownV.replace('void main(){',`void main(){
    branchWeight=branchActive*volumeFade.z*(1.-smoothstep(volumeFade.x,volumeFade.y,length(stem.xz-cameraPosition.xz)));
  `);
  const frag='varying float branchWeight;\n'+crownF.replace('void main(){',`void main(){
    if(branchWeight>.997)discard;
  `).replace('clamp((a-.30)*3.8,0.,1.)','clamp((a-.30)*3.8,0.,1.)*(1.-branchWeight)');
  this.crown.material=new THREE.ShaderMaterial({vertexShader:vert,fragmentShader:frag,
    uniforms:{...previous.uniforms,volumeFade:layer.fade},side:THREE.DoubleSide,alphaToCoverage:true});
  previous.dispose();
  if(world&&scene){
   const oldShadow=this.shade.material as THREE.ShaderMaterial;
   const fitting=this.groundedShadow=layer.makeGroundedShadows(scene,world,oldShadow.uniforms.canopy.value,maxTrees);
   this.geom.setAttribute('groundedShadowActive',fitting.mask);
   const sv='attribute float groundedShadowActive; uniform vec3 volumeFade; varying float fittedShadowWeight;\n'+
     shadowV.replace('void main(){',`void main(){
      fittedShadowWeight=groundedShadowActive*volumeFade.z*
        (1.-smoothstep(volumeFade.x,volumeFade.y,length(stem.xz-cameraPosition.xz)));
     `);
   const sf='varying float fittedShadowWeight;\n'+shadowF.replace(
     'ramp*(.10+.18*mask)','ramp*(.10+.18*mask)*(1.-fittedShadowWeight)');
   this.shade.material=new THREE.ShaderMaterial({vertexShader:sv,fragmentShader:sf,
    uniforms:{...oldShadow.uniforms,volumeFade:layer.fade},side:THREE.DoubleSide,
    depthWrite:false,transparent:true,blending:THREE.NormalBlending,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
   oldShadow.dispose();
  }
 }
 updateVolume(x:number,z:number,agl:number){
  const v=this.volume;if(!v)return;
  v.update(this.stems.array as Float32Array,this.shapes.array as Float32Array,this.hedgeStart,x,z,agl,this.forestRevision);
  this.groundedShadow?.update(this.stems.array as Float32Array,this.shapes.array as Float32Array,
    v.mask.array as Float32Array,this.hedgeStart,v.rosterVersion);
 }
 get volumeCount(){return this.volume?.count??0;}
 get groundedShadowCount(){return this.groundedShadow?.count??0;}
 private readonly roofBits=new Uint32Array(8);
 private tile(tx:number,tz:number){
  const a:number[]=[],hasRoofHits=fillRoofTile(tx,tz,this.roofBits);
  for(let dz=0;dz<side;dz++)for(let dx=0;dx<side;dx++){
   const cell=dz*side+dx;
   if(hasRoofHits&&(this.roofBits[cell>>>5]&(1<<(cell&31))))continue;
   const i=tx*side+dx,j=tz*side+dz;
   const x=(i+rand(i,j,11))*pitch,z=(j+rand(i,j,84))*pitch;
   if(this.cover.sample(this.t,x,z)!==10||!this.t.isLand(x,z)||runwayAt(x,z))continue;
   if(this.cover.waterInsets.some(i=>i.intersects(x,z,x,z))&&this.cover.distance(this.t,x,z)<0)continue;
   const type=rand(i,j,43),variant=type<.15?3:type<.36?2:type<.68?1:0;
   const vary=rand(i,j,35),fallback=8.2+vary*10.8;
   const shapeRatio=.83+rand(i,j,9)*.35;
   if(insideLighthouseYard(x,z,fallback*shapeRatio*.5))continue;
   const pilot=this.forestHeights?.height(x,z,fallback,vary)??fallback;
   const h=this.forestStream?.height(x,z,pilot,vary)??pilot,w=h*shapeRatio;
   a.push(x,this.t.meshElevation(x,z)-.16,z,h,w,variant,.79+rand(i,j,21)*.45,rand(i,j,62));
  }
  return new Float32Array(a);
 }
 update(x:number,z:number,alt:number){
  this.crown.visible=this.shade.visible=alt<4200;
  if(!this.crown.visible)return;
  const move=Math.hypot(x-this.lastX,z-this.lastZ)>=135,now=performance.now(),hedgeRev=this.hedges?.revision??0;
  if(!move&&(hedgeRev===this.hedgeRev||now-this.hedgeApply<350))return;
  if(move){this.forestStream?.update(x,z);this.hedges?.move(x,z);}
  this.hedgeRev=hedgeRev;this.hedgeApply=now;
  this.lastX=x;this.lastZ=z;let count=0;const wanted=new Set<string>();
  for(let tz=Math.floor((z-radius)/span);tz<=Math.floor((z+radius)/span);tz++)for(let tx=Math.floor((x-radius)/span);tx<=Math.floor((x+radius)/span);tx++){
   const key=tx+':'+tz,rx=tx*span-x,rz=tz*span-z;
   if(Math.hypot(rx+span*.5,rz+span*.5)>radius+span*.72)continue;
   wanted.add(key);let a=this.cache.get(key);if(!a){a=this.tile(tx,tz);this.cache.set(key,a);}
   for(let i=0;i<a.length&&count<maxTrees;i+=8){
    const d=(a[i]-x)**2+(a[i+2]-z)**2;
    if(d>radius**2||(d>1120**2&&a[i+7]>.70))continue;
    const native=this.plantedY?.(a[i],a[i+2]);
    this.stems.setXYZ(count,a[i],native===undefined?a[i+1]:native-.16,a[i+2]);this.shapes.setXYZW(count,a[i+3],a[i+4],a[i+5],a[i+6]);count++;
   }
  }
  const originalCount=count;
  this.hedges?.draw(x,z,(hx,hz,h,style)=>{
   if(count>=maxTrees)return false;
   if(this.cover.distance(this.t,hx,hz)<6||runwayAt(hx,hz)||insideLighthouseYard(hx,hz,4))return true;
   if(this.t.coastalGrids.some(c=>c.spec.id!==MONTAGUE_GROUND_ID&&c.spec.tileX===Math.floor((hx-this.t.left)/(this.t.right-this.t.left)*32)&&
       c.spec.tileZ===Math.floor((hz-this.t.top)/(this.t.bottom-this.t.top)*22)))return true;
   const range=1-Math.max(0,Math.min(1,(Math.hypot(hx-x,hz-z)-1450)/370));
   const fade=range*range*(3-2*range);if(fade<.004)return true;
   const i=Math.floor(hx*2),j=Math.floor(hz*2),v=rand(i,j,43);
   const variant=style===1?(v<.64?0:1):v<.16?2:v<.53?1:v<.92?0:3;
   const span=h*(style===1?1.36+.32*rand(i,j,6):.87+.32*rand(i,j,6));
   const ground=this.decorativeY??((x:number,z:number)=>this.t.meshElevation(x,z));
   const y=ground(hx,hz)-(style===1?.22:.20);
   const height=h*fade,width=span*fade;
   const rx=hx+.43*height,rz=hz+.21*height,wx=width*.71,wz=width*.595;
   const y0=ground(rx-wx,rz-wz),y1=ground(rx+wx,rz-wz),y2=ground(rx-wx,rz+wz),y3=ground(rx+wx,rz+wz);
   // Render the quad against real sewn vertices. A sub-decimetre
   // receiver offset covers a small crossing of the land's own diagonal.
   const bias=.028+Math.max(0,Math.min(.12,ground(rx,rz)-Math.min((y1+y2)*.5,(y0+y3)*.5)));
   this.hedgeGround.setXYZW(count,y0+bias,y1+bias,y2+bias,y3+bias);
   this.stems.setXYZ(count,hx,y,hz);this.shapes.setXYZW(count,height,width,variant,.74+.42*rand(i,j,8));count++;return true;
  });
  // Re-used slots that become old forest instances cannot inherit stale
  // hedge shadow corners, including after a relocation.
  const changedStart=Math.min(originalCount,this.hedgeStart);
  if(originalCount>this.hedgeStart)(this.hedgeGround.array as Float32Array).fill(0,this.hedgeStart*4,originalCount*4);
  if(count>changedStart){
   this.hedgeGround.clearUpdateRanges();
   this.hedgeGround.addUpdateRange(changedStart*4,(count-changedStart)*4);
   this.hedgeGround.needsUpdate=true;
  }
  this.hedgeStart=originalCount;
  this.lastHedges=count-originalCount;
  for(const key of this.cache.keys())if(!wanted.has(key))this.cache.delete(key);
  this.forestRevision++;
  this.geom.instanceCount=count;this.stems.clearUpdateRanges();this.stems.addUpdateRange(0,count*3);this.stems.needsUpdate=true;
  this.shapes.clearUpdateRanges();this.shapes.addUpdateRange(0,count*4);this.shapes.needsUpdate=true;
 }
}
