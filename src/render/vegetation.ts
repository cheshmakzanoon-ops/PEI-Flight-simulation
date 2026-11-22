import * as THREE from 'three';
import type {Terrain} from '../sim/terrain.ts';
import type {Cover} from '../sim/cover.ts';
import {insideLighthouseYard} from '../sim/lighthouse-sites.ts';
import {runwayAt} from '../sim/places.ts';
const pitch=12,side=16,span=pitch*side,radius=1530,maxTrees=45000;
function rand(x:number,z:number,s=0){let n=Math.imul(x^s,2246822519)^Math.imul(z,3266489917);n=Math.imul(n^(n>>>15),2246822519);return ((n^(n>>>13))>>>0)/4294967296;}
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
 void main(){
  vec2 off=vec2(.43,.21)*shape.x;
  vec3 p=stem+vec3(off.x+position.x*shape.y*1.42,.46,off.y+position.y*shape.y*1.19);
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
 private lastX=Infinity;private lastZ=Infinity;private cache=new Map<string,Float32Array>();
 constructor(scene:THREE.Scene,private t:Terrain,private cover:Cover){
  const g=new THREE.InstancedBufferGeometry(),plane=new THREE.PlaneGeometry(1,1);g.index=plane.index;g.setAttribute('position',plane.getAttribute('position'));g.setAttribute('uv',plane.getAttribute('uv'));
  g.setAttribute('stem',this.stems);g.setAttribute('shape',this.shapes);g.instanceCount=0;this.geom=g;
  const canopy=new THREE.TextureLoader().load(import.meta.env.BASE_URL+'art/canopy.webp');canopy.colorSpace=THREE.SRGBColorSpace;canopy.anisotropy=2;
  const uniforms={canopy:{value:canopy}};
  this.crown=new THREE.Mesh(g,new THREE.ShaderMaterial({vertexShader:crownV,fragmentShader:crownF,uniforms,side:THREE.DoubleSide,alphaToCoverage:true}));
  this.shade=new THREE.Mesh(g,new THREE.ShaderMaterial({vertexShader:shadowV,fragmentShader:shadowF,uniforms,side:THREE.DoubleSide,depthWrite:false,transparent:true,blending:THREE.NormalBlending,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
  this.crown.frustumCulled=this.shade.frustumCulled=false;this.crown.name='Mixed woodland canopies';this.shade.name='Canopy ground shadows';scene.add(this.crown,this.shade);
 }
 private tile(tx:number,tz:number){
  const a:number[]=[];
  for(let dz=0;dz<side;dz++)for(let dx=0;dx<side;dx++){
   const i=tx*side+dx,j=tz*side+dz;
   const x=(i+rand(i,j,11))*pitch,z=(j+rand(i,j,84))*pitch;
   if(this.cover.sample(this.t,x,z)!==10||!this.t.isLand(x,z)||runwayAt(x,z))continue;
   const type=rand(i,j,43),variant=type<.15?3:type<.36?2:type<.68?1:0;
   const h=8.2+rand(i,j,35)*10.8,w=h*(.83+rand(i,j,9)*.35);
   if(insideLighthouseYard(x,z,w*.5))continue;
   a.push(x,this.t.meshElevation(x,z)-.16,z,h,w,variant,.79+rand(i,j,21)*.45,rand(i,j,62));
  }
  return new Float32Array(a);
 }
 update(x:number,z:number,alt:number){
  this.crown.visible=this.shade.visible=alt<4200;
  if(!this.crown.visible||Math.hypot(x-this.lastX,z-this.lastZ)<135)return;
  this.lastX=x;this.lastZ=z;let count=0;const wanted=new Set<string>();
  for(let tz=Math.floor((z-radius)/span);tz<=Math.floor((z+radius)/span);tz++)for(let tx=Math.floor((x-radius)/span);tx<=Math.floor((x+radius)/span);tx++){
   const key=tx+':'+tz,rx=tx*span-x,rz=tz*span-z;
   if(Math.hypot(rx+span*.5,rz+span*.5)>radius+span*.72)continue;
   wanted.add(key);let a=this.cache.get(key);if(!a){a=this.tile(tx,tz);this.cache.set(key,a);}
   for(let i=0;i<a.length&&count<maxTrees;i+=8){
    const d=(a[i]-x)**2+(a[i+2]-z)**2;
    if(d>radius**2||(d>1120**2&&a[i+7]>.70))continue;
    this.stems.setXYZ(count,a[i],a[i+1],a[i+2]);this.shapes.setXYZW(count,a[i+3],a[i+4],a[i+5],a[i+6]);count++;
   }
  }
  for(const key of this.cache.keys())if(!wanted.has(key))this.cache.delete(key);
  this.geom.instanceCount=count;this.stems.clearUpdateRanges();this.stems.addUpdateRange(0,count*3);this.stems.needsUpdate=true;
  this.shapes.clearUpdateRanges();this.shapes.addUpdateRange(0,count*4);this.shapes.needsUpdate=true;
 }
}
