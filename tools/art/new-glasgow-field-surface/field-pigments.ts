import * as THREE from 'three';
export const FIELD_BOUNDS = Object.freeze([-14307.7421875,10702.86328125,-14253.33984375,10755.1953125] as const);
export const PIXELS=128;
export const ENCODE=.085;
type Band = readonly [minWave:number,maxWave:number,targetInterdecile:number,seed:number];
const BANDS:readonly Band[]= [[6,11,.0220,52521],[3,6,.0190,1887],[1.25,3,.0320,56216]];
const dims= [FIELD_BOUNDS[2]-FIELD_BOUNDS[0],FIELD_BOUNDS[3]-FIELD_BOUNDS[1]];
const tau=2*Math.PI;
type Cell = {x:number;z:number;core:boolean;weight:number};
function rnd(s:number){
 return ()=>{s|=0;s=(s+0x6d2b79f5)|0;let a=Math.imul(s^(s>>>15),s|1);a^=a+Math.imul(a^(a>>>7),a|61);return ((a^(a>>>14))>>>0)/4294967296;};
}
function qtile(sorted:readonly number[],p:number){const x=(sorted.length-1)*p,k=Math.floor(x);return sorted[k]+(x-k)*(sorted[Math.min(k+1,sorted.length-1)]-sorted[k]);}
const sat=(x:number)=>Math.min(1,Math.max(0,x));
const smooth=(x:number)=>{const k=sat(x);return k*k*(3-2*k);};
function spect(b:Band,pts:readonly Cell[]){
 const [lo,hi,target,seed]=b, random=rnd(seed);
 // Nonharmonic wavevectors and independently chosen phases. Never tile this
 // finite world-ground patch and don't align modes with the grid or a row.
 const wave=Array.from({length:32},(_,i)=>{
  const theta=i*(Math.PI*(Math.sqrt(5)-1))+.33*(random()-.5), w=tau/(lo*Math.pow(hi/lo,(i+.1+.8*random())/32));
  return [w*Math.cos(theta),w*Math.sin(theta),tau*random(),.65+.55*random()];
 });
 const values=pts.map(c=>wave.reduce((a,w)=>a+Math.sin(c.x*w[0]+c.z*w[1]+w[2])*w[3],0.));
 const sorted=values.filter((_,i)=>pts[i].core).sort((x,y)=>x-y);
 const gain=target/(qtile(sorted,.90)-qtile(sorted,.10));
 // Mean is calibrated only on this independent procedural field, never on mapped radiance.
 let mean=0,w=0;
 for(let i=0;i<values.length;i++){mean+=values[i]*pts[i].weight;w+=pts[i].weight;}
 return values.map(v=>(v-mean/w)*gain);
}
export function originalFieldPigment(){
 const centres:Cell[]=[];
 for(let j=0;j<PIXELS;j++)for(let i=0;i<PIXELS;i++){
  const x=(i+.5)*dims[0]/PIXELS,z=(j+.5)*dims[1]/PIXELS;
  const near=Math.min(x,z,dims[0]-x,dims[1]-z);
  centres.push({x,z,core:near>=12.,weight:smooth((near-4.)/8.)});
 }
 const [L,M,F]=BANDS.map(b=>spect(b,centres)), raw=new Uint8Array(PIXELS**2*2);
 let maxCoarse=0,maxFine=0,mean0=0,mean1=0,weight=0;
 for(let i=0;i<centres.length;i++){
  const x=L[i]+M[i],y=F[i],c=centres[i].weight;
  maxCoarse=Math.max(maxCoarse,Math.abs(x));maxFine=Math.max(maxFine,Math.abs(y));
  if(Math.abs(x)>ENCODE||Math.abs(y)>ENCODE)throw Error('Original palette exceeds fixed reflectance range');
  raw[2*i]=Math.round(127.5*(1+x/ENCODE));
  raw[2*i+1]=Math.round(127.5*(1+y/ENCODE));
  mean0+=c*ENCODE*(raw[2*i]*2/255-1);mean1+=c*ENCODE*(raw[2*i+1]*2/255-1);weight+=c;
 }
 const audit=[L,M,F].map(a=>{
  const core=a.filter((_,i)=>centres[i].core).sort((a,b)=>a-b);
  return qtile(core,.90)-qtile(core,.10);
 });
 return {raw,audit,maxCoarse,maxFine,mean:[mean0/weight,mean1/weight]};
}
export function makeFieldPigmentTexture(){
 const a=originalFieldPigment(), texture=new THREE.DataTexture(a.raw,PIXELS,PIXELS,THREE.RGFormat,THREE.UnsignedByteType);
 texture.colorSpace=THREE.NoColorSpace;texture.internalFormat='RG8';
 texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 texture.generateMipmaps=true;texture.anisotropy=1;texture.flipY=false;texture.unpackAlignment=1;texture.needsUpdate=true;
 texture.name='Detached New Glasgow muted field pigments';
 return {texture,...a};
}
const authGLSL=/* glsl */`
 uniform highp sampler2D ngFieldPigments;
 uniform float ngFieldStrength;
 uniform float ngFieldDiagnostic;
 const vec4 ngFieldProofBox=vec4(-14307.7421875,10702.86328125,-14253.33984375,10755.1953125);
 float ngFieldRole(vec2 xz, vec2 dx, vec2 dy,float coast, float distanceToEye){
   if(ngFieldStrength!=1.||coast<253.75||distanceToEye>=420.)return 0.;
   // Conservative centre-based footprint reserve and fixed inboard taper.
   // Exact current-native exterior still needs independent same-frame QA.
   vec2 edge=min(xz-ngFieldProofBox.xy,ngFieldProofBox.zw-xz)-.85*(abs(dx)+abs(dy));
   float f=max(length(dx),length(dy));
   if(f>=7.5||min(edge.x,edge.y)<=4.)return 0.;
   return smoothstep(4.,12.,min(edge.x,edge.y))*(1.-smoothstep(255.,420.,distanceToEye))*(1.-smoothstep(4.2,7.5,f));
 }
 vec3 ngFieldDiffuseFactor(vec2 xz,vec2 dx,vec2 dy){
   vec2 span=ngFieldProofBox.zw-ngFieldProofBox.xy;
   vec2 a=textureGrad(ngFieldPigments,(xz-ngFieldProofBox.xy)/span,dx/span,dy/span).rg;
   float f=max(length(dx),length(dy));
   vec2 m=(a*2.-1.)*.085;
   m.y*=1.-smoothstep(.7,2.25,f);
   float light=m.x+m.y, pigment=.115*m.x+.155*m.y;
   return vec3(1.+light)+vec3(.55,-.085,-.79)*pigment;
 }
 `;
const anchor=' void main(){';
const actor=' col*=1.+detailFade*(.13*(noise(p.xz*.46)-.5));';
const last=' gl_FragColor=vec4(mist(col,d,p.y),1.);';
const once=(s:string,t:string)=>s.split(t).length===2;
/** Program comparison only; this never acquires, recolors or installs a live actor. */
export function fieldPigmentFragment(stock:string,marker=false){
 if(stock.includes('ngFieldPigments')||![anchor,actor,last,' float d=distance(cameraPosition,p);','uniform sampler2D imageMap,coverMap,detailMap,paintMap;'].every(x=>once(stock,x)))return;
 return stock.replace(anchor,authGLSL+anchor+`
 vec2 ngFieldDx=vec2(0.),ngFieldDy=vec2(0.);
 if(ngFieldStrength==1.){
  ngFieldDx=dFdx(p.xz);ngFieldDy=dFdy(p.xz);
 }
 `).replace(actor,`
 float ngFieldUse=ngFieldRole(p.xz,ngFieldDx,ngFieldDy,coast,d);
 if(ngFieldUse>.002){
  float oldGenericGrain=1.+detailFade*(.13*(noise(p.xz*.46)-.5));
  col*=mix(vec3(oldGenericGrain),ngFieldDiffuseFactor(p.xz,ngFieldDx,ngFieldDy),ngFieldUse);
 }else{${actor}}
 `).replace(last,last+(marker?`
 if(ngFieldUse>.002&&ngFieldDiagnostic>=0.){gl_FragColor.rgb=vec3(ngFieldDiagnostic);return;}
 `:''));
}
type Programs={vertexShader:string;fragmentShader:string};
export function detachedFieldMaterials(stock:THREE.ShaderMaterial,exact:Readonly<Programs>){
 const v=stock.vertexShader,f=stock.fragmentShader;
 if(v!==exact.vertexShader||f!==exact.fragmentShader||stock.transparent||stock.side!==THREE.FrontSide||
    !stock.depthTest||!stock.depthWrite||!stock.colorWrite||stock.alphaTest!==0||
    !stock.uniforms.imageMap?.value?.isTexture||!stock.uniforms.coverMap?.value?.isTexture)return;
 const proposed=fieldPigmentFragment(f);
 if(!proposed)return;
 const {texture}=makeFieldPigmentTexture(), strength={value:0};
 // Do not Three.clone() old material; existing textures and their Source
 // heights/properties stay borrowed. This is a detached fixture primitive.
 const material=new THREE.ShaderMaterial({
  vertexShader:v,fragmentShader:proposed,defines:{...stock.defines},
  uniforms:{...stock.uniforms,ngFieldPigments:{value:texture},ngFieldStrength:strength,ngFieldDiagnostic:{value:-1}},
  transparent:false,side:THREE.FrontSide,depthWrite:true,depthTest:true,depthFunc:stock.depthFunc,
  colorWrite:stock.colorWrite,dithering:stock.dithering,toneMapped:stock.toneMapped,
  polygonOffset:stock.polygonOffset,polygonOffsetFactor:stock.polygonOffsetFactor,polygonOffsetUnits:stock.polygonOffsetUnits,
  blending:stock.blending,premultipliedAlpha:stock.premultipliedAlpha
 });
 let owns=true;
 return {material,strength,texture,dispose(){if(owns){owns=false;strength.value=0;material.dispose();texture.dispose();}}};
}
