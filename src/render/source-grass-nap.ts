import {DataTexture,LinearFilter,LinearMipmapLinearFilter,NoColorSpace,RepeatWrapping,RGBAFormat,UnsignedByteType} from 'three';
const N=256,SPAN=2.52,H=.093;
const fract=(x:number)=>x-Math.floor(x);
const sat=(x:number)=>Math.min(1,Math.max(0,x));
const smooth=(t:number)=>t*t*(3-2*t);
const mix=(a:number,b:number,x:number)=>a+(b-a)*x;
const at=(x:number,n:number)=>((x%n)+n)%n;
function hash(x:number,y:number,k:number){
 let h=Math.imul(x+107,374761393)^Math.imul(y+211,668265263)^Math.imul(k+19,889523592);
 h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
function noise(u:number,v:number,a:number,k:number){
 const x=u*a,y=v*a,X=Math.floor(x),Y=Math.floor(y);
 const fx=smooth(fract(x)),fy=smooth(fract(y));
 const r=(i:number,j:number)=>hash(at(i,a),at(j,a),k);
 return mix(mix(r(X,Y),r(X+1,Y),fx),mix(r(X,Y+1),r(X+1,Y+1),fx),fy);
}
/** Original metric short-canopy height/normal field. No new imagery, mask,
 * species, or season claims. Periodic data with a filtered metre-scale warp. */
export function* shortGrassNapSteps(){
 const ht=new Float32Array(N*N),leaf=new Float32Array(N*N),body=new Float32Array(N*N);
 const px=SPAN/N, K=16;
 for(let z=0;z<N;z++){for(let x=0;x<N;x++){
  const u=(x+.5)/N,v=(z+.5)/N,i=z*N+x;
  const d=.59*noise(u,v,9,2)+.29*noise(u,v,19,9)+.12*noise(u,v,41,19);
  body[i]=d;
  ht[i]=.006+.009*d;
 }yield;}
 for(let z=0;z<K;z++){for(let x=0;x<K;x++){
  yield;
  const u=(x+.14+.72*hash(x,z,112))/K,v=(z+.14+.72*hash(x,z,37))/K;
  const shade=noise(u,v,9,2);
  if(hash(x,z,39)>.61+.37*shade)continue;
  const bx=u*SPAN,bz=v*SPAN, phase=3.25*noise(u,v,5,68)+2.47*hash(x,z,68);
  const gain=.71+.5*hash(x,z,4);
  for(let k=0;k<8;k++){
   const a0=phase+3.1*(hash(x,z,310+k)-.50)+2.39996*(k%3==0?1:0);
   const c=Math.cos(a0),s=Math.sin(a0);
   const off=.004+.030*hash(x,z,k+95),move=.043+.178*Math.pow(hash(x,z,k+29),1.13);
   const crest=(.016+.065*Math.pow(hash(x,z,k+115),1.23))*gain;
   const W=.0065+.0077*hash(x,z,k+82);
   const curve=(hash(x,z,k+12)-.5)*.062;
   const rx=bx+c*off,rz=bz+s*off;
   const D=Math.ceil((move+W+Math.abs(curve)+2*px)/px);
   const u0=Math.floor(rx/px),v0=Math.floor(rz/px),tint=hash(x,z,k+341);
   for(let v=-D;v<=D;v++)for(let u=-D;u<=D;u++){
    const x0=(u0+u+.5)*px-rx,z0=(v0+v+.5)*px-rz;
    const d=(x0*c+z0*s)/move;if(d<-.16||d>1.04)continue;
    const q=sat(d),wang=curve*q*(.25+.75*q);
    const r=Math.abs(-x0*s+z0*c-wang)/(W*(.36+.64*Math.sqrt(1.-q))+.53*px);
    const wedge=1-smooth(sat((r-.28)/.86));
    const taper=smooth(sat((1.04-d)/.22))*smooth(sat((d+.16)/.44));
    if(wedge*taper<.002)continue;
    const i=at(v0+v,N)*N+at(u0+u,N);
    const profile=.29+.71*Math.sin(Math.PI*Math.pow(q,.85)*.86);
    const f=wedge*taper*profile;
    ht[i]=Math.max(ht[i],f*crest+.010+.003*shade);
    leaf[i]=Math.max(leaf[i],(.54+.45*tint)*f);
   }
  }
 }
 }
 const out=new Uint8Array(N*N*4);
 for(let z=0;z<N;z++){for(let x=0;x<N;x++){
  const i=z*N+x,o=i*4;
  const sx=(ht[z*N+at(x+1,N)]-ht[z*N+at(x-1,N)])/(2*px);
  const sz=(ht[at(z+1,N)*N+x]-ht[at(z-1,N)*N+x])/(2*px);
  const f=leaf[i], l=noise(x/N,z/N,76,990);
  out[o]=Math.round(255*sat(ht[i]/H));
  out[o+1]=Math.round(128+112*sx/(Math.abs(sx)+1.05));
  out[o+2]=Math.round(128+112*sz/(Math.abs(sz)+1.05));
  out[o+3]=Math.round(255*sat(.247+.60*f+.11*body[i]+.036*l));
 }yield;}
 const t=new DataTexture(out,N,N,RGBAFormat,UnsignedByteType);
 t.name='Original short turf relief phase';t.colorSpace=NoColorSpace;t.wrapS=t.wrapT=RepeatWrapping;
 t.minFilter=LinearMipmapLinearFilter;t.magFilter=LinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;
 return t;
}
export function makeShortGrassNap(){
 const steps=shortGrassNapSteps();
 for(;;){const next=steps.next();if(next.done)return next.value;}
}
export function shortGrassHeightFade(h:number){
 if(!Number.isFinite(h)||h<.62||h>=6.85)return 0;
 return smooth(sat((h-.62)/.35))*(1-smooth(sat((h-3.52)/3.33)));
}
export const sourceGrassNapGLSL=/*glsl*/`
 uniform sampler2D shortGrassNapMap;
 uniform float shortGrassNapMix;
 varying vec3 shortGrassMetric;
 float shortGrassNapAuthority(vec2 p){return smoothstep(.72,.94,matureGrassCoverage(p));}
 void sourceGrassNap(inout vec3 col,vec3 n,vec3 p,float d,float coast,float admitted,
                     float competing,vec2 ex,vec2 ez){
  // Gradients are the original pre-discard metric land samples. Neither the
  // parallax steps nor the author mask move or raymarch the source imagery.
  float footprint=max(length(ex),length(ez));
  if(shortGrassNapMix<=0.001||d>18.||coast<82.||n.y<.76||
     competing>.23||footprint>.62)return;
  vec3 view=normalize(cameraPosition-p);
  float ndv=dot(n,view);
  if(ndv<=.065)return;
  float strength=shortGrassNapMix*admitted*(1.-smoothstep(10.4,18.,d))*(1.-smoothstep(.19,.62,footprint));
  if(strength<.003)return;
  mat2 rm=mat2(.8147,.5799,-.5799,.8147);
  const float period=${SPAN.toFixed(6)}, depth=${H.toFixed(6)};
  vec2 m=p.xz*.302;
  vec2 warp=(vec2(noise(m+vec2(10.3,7.1)),noise(m-vec2(26.4,11.2)))-.5)*.28;
  vec2 xy=rm*p.xz/period+warp, dx=rm*ex/period,dz=rm*ez/period;
  vec2 delta=rm*(view.xz/max(ndv,.13)-n.xz)*(depth/period);
  delta*=min(1.,.195/max(length(delta),.0001));
  float a=1.,lo=0.;vec4 t=textureGrad(shortGrassNapMap,xy+delta,dx,dz);
  // Six bounding samples + one interpolated tap, all fixed footprints.
  for(int k=1;k<=6;k++){
   float l=1.-float(k)/6.;
   vec4 q=textureGrad(shortGrassNapMap,xy+delta*l,dx,dz);
   if(q.r>=l){
    float penetr=(a-t.r)/(max(.0001,a-t.r+q.r-l));
    lo=mix(a,l,clamp(penetr,0.,1.));break;
   }
   a=l;t=q;
  }
  t=textureGrad(shortGrassNapMap,xy+delta*lo,dx*1.16,dz*1.16);
  vec2 slope=transpose(rm)*((t.gb*255.-128.)/112.);
  vec3 high=normalize(n+vec3(-slope.x,0.,-slope.y)*.83);
  float wave=.157*(t.r-.278)+.481*(t.a-.356);
  vec2 sunlight=rm*(sun.xz/max(.39,dot(n,sun))-n.xz)*(.028/period);
  float blocker=textureGrad(shortGrassNapMap,xy+delta*lo+sunlight,dx*1.21,dz*1.21).r;
  float softShadow=smoothstep(.165,.43,blocker-t.r);
  float forward=pow(max(0.,dot(view,-sun)),2.);
  wave+=.59*(max(0.,dot(high,sun))-max(0.,dot(n,sun))) - .088*softShadow;
  wave+=.045*forward*max(0.,t.a-.375);
  // Slightly longer blades in every third microcluster are clipped by the
  // same stable optical footprint; no surface tint or seasonal swap.
  // Low, soft cavity value and directional highlight are multiplicative.
  // Brown or dark ground stays in its exact existing macro color family.
  float surface=clamp(1.+wave,.79,1.255);
  col*=mix(1.,surface,strength*.96);
 }
`;
