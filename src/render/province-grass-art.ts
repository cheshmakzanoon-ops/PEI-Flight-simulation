import {DataTexture,LinearFilter,LinearMipmapLinearFilter,NoColorSpace,RepeatWrapping,RGBAFormat,UnsignedByteType} from 'three';

// Original optical material, not a species, density, land mask or width model.
export const GRASS_GRAIN_DIM=256,GRASS_GRAIN_METRES=2.72;
const sat=(x:number)=>Math.max(0,Math.min(1,x)),mix=(a:number,b:number,x:number)=>a+(b-a)*x;
const frac=(x:number)=>x-Math.floor(x);
const smooth=(x:number)=>x*x*(3-2*x);
function hash(x:number,y:number,k:number){
 const h=Math.imul(x+113,1597334677)^Math.imul(y+949,3812015801)^Math.imul(k+231,95828291);
 const q=Math.imul(h^(h>>>13),1274126177);
 return ((q^(q>>>16))>>>0)/4294967296;
}
const rmod=(a:number,b:number)=>((a%b)+b)%b;
function noise(u:number,v:number,scale:number,salt:number){
 const x=u*scale,y=v*scale,i=Math.floor(x),j=Math.floor(y),tx=smooth(frac(x)),ty=smooth(frac(y));
 return mix(mix(hash(rmod(i,scale),rmod(j,scale),salt),hash(rmod(i+1,scale),rmod(j,scale),salt),tx),
   mix(hash(rmod(i,scale),rmod(j+1,scale),salt),hash(rmod(i+1,scale),rmod(j+1,scale),salt),tx),ty);
}

/** R = visible fibres, G = tight basal occlusion, BA = signed metre-scale
 * slopes of a tiny optical height field. Repeating seams are periodic. Asset
 * is built once on the admitted optional art path, never per frame. */
export function originalGrassGrain(){
 const N=GRASS_GRAIN_DIM,M=GRASS_GRAIN_METRES;
 const height=new Float32Array(N*N),baseCover=new Float32Array(N*N),fibres=new Float32Array(N*N),out=new Uint8Array(4*N*N);
 const pix=M/N;
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const u=(x+.5)/N,v=(z+.5)/N,i=z*N+x;
  const loft=.56*noise(u,v,10,3)+.29*noise(u,v,19,14)+.13*noise(u,v,29,6)+.02*noise(u,v,72,31);
  const grain=.61*noise(u,v,98,13)+.39*noise(u,v,171,8);
  baseCover[i]=sat(.50+.89*(loft-.5)+.17*(grain-.5));
  height[i]=.0125*(loft-.5)+.0028*(grain-.5);
 }
 // Raster the shadowed/slender curved surface marks, not physical 3D plants.
 // Each local cluster point is jittered with an independent curl and azimuth.
 const K=43;
 for(let z=0;z<K;z++)for(let x=0;x<K;x++){
  const u=(x+.07+.86*hash(x,z,2))/K,v=(z+.07+.86*hash(x,z,5))/K;
  const dense=baseCover[(Math.floor(v*N))*N+Math.floor(u*N)];
  if(hash(x,z,7)>.40+.60*dense)continue;
  const a=hash(x,z,56)*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  const cu=u*M,cv=v*M,L=.040+.132*Math.pow(hash(x,z,27),1.7),W=.004+.010*hash(x,z,18);
  const curl=(hash(x,z,11)-.50)*.084,H=.002+.0073*hash(x,z,79),tint=.61+.37*hash(x,z,66);
  const D=Math.ceil((L+abs(curl)+W+.013)/pix);
  const ix=Math.floor(cu/pix),iz=Math.floor(cv/pix);
  for(let dy=-D;dy<=D;dy++)for(let dx=-D;dx<=D;dx++){
   const rx=(ix+dx+.5)*pix-cu,rz=(iz+dy+.5)*pix-cv,y=c*rx+s*rz,n=-s*rx+c*rz;
   const w=y/L;if(w<-.07||w>1.03)continue;
   const q=sat(w),travel=curl*q*q,r=abs(n-travel)/(W*(.42+.58*Math.sqrt(Math.max(0,1-q)))+.47*pix);
   const width=1-smooth(sat((r-.39)/.74)),taper=smooth(sat((1.02-w)/.22))*smooth(sat((w+.07)/.23));
   if(width<=0||taper<=0)continue;
   const index=rmod(iz+dy,N)*N+rmod(ix+dx,N),v=width*taper;
   fibres[index]=Math.max(fibres[index],(.50+.46*tint)*v);
   height[index]=Math.max(height[index],H*v*(.56+.44*q)+.011*(baseCover[index]-.5));
  }
 }
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const i=z*N+x,k=i*4;
  const sx=(height[z*N+rmod(x+1,N)]-height[z*N+rmod(x-1,N)])/(2*pix);
  const sz=(height[rmod(z+1,N)*N+x]-height[rmod(z-1,N)*N+x])/(2*pix);
  const v=baseCover[i],f=fibres[i];
  out[k]=Math.round(255*sat(.28+.117*(v-.5)+.64*f));
  out[k+1]=Math.round(255*sat(.49+.67*(v-.5)-f*.19));
  out[k+2]=Math.round(128+Math.max(-127,Math.min(127,sx*163)));
  out[k+3]=Math.round(128+Math.max(-127,Math.min(127,sz*163)));
 }
 const tex=new DataTexture(out,N,N,RGBAFormat,UnsignedByteType);
 tex.name='Original continuous pasture optics';
 tex.wrapS=tex.wrapT=RepeatWrapping;tex.minFilter=LinearMipmapLinearFilter;tex.magFilter=LinearFilter;
 tex.colorSpace=NoColorSpace;tex.generateMipmaps=true;tex.anisotropy=4;tex.needsUpdate=true;return tex;
}
function abs(x:number){return x<0?-x:x;}
export const provinceGrassArtGLSL=/*glsl*/`
uniform sampler2D sourceGrassArtMap;
// Same smooth world-space value noise as terrain, with an analytic gradient.
// Explicit UV footprints keep the warped canopy lookup stable even next to a mask edge.
vec3 grassDensitySlope(vec2 f){
   vec2 i=floor(f),t=fract(f),blend=t*t*(3.-2.*t),dBlend=6.*t*(1.-t);
   float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+1.);
   float l=mix(a,b,blend.x),r=mix(c,d,blend.x);
   return vec3(mix(l,r,blend.y),mix(b-a,d-c,blend.y)*dBlend.x,(r-l)*dBlend.y);
}
void sourceGrassArt(inout vec3 color,inout vec3 normal,vec3 ground,float d,float cover,vec2 footprintX,vec2 footprintZ){
 float fp=max(length(footprintX),length(footprintZ));
 vec2 u=ground.xz;
 // Non-row canopy floor, about 1.4-7.3 m bands, all centered on the source.
 // The extra midband texture is a continuous density field, not plant objects.
 const mat2 r0=mat2(.847998,-.529999,.529999,.847998);
 const mat2 r1=mat2(-.3697,.92911,-.92911,-.3697);
 vec3 rawA=grassDensitySlope((r0*u)*.147+vec2(62.7,-4.2));
 vec3 rawB=grassDensitySlope((r1*u)*.411+vec2(-51.8,40.37));
 float a=mix(.5,rawA.x,1.-smoothstep(1.60,4.7,fp));
 float b=mix(.5,rawB.x,1.-smoothstep(.55,1.88,fp));
 float med=1.-smoothstep(.39,1.33,fp),narrow=1.-smoothstep(.17,.73,fp);
 float c=.5;
 if(med>.0001)c=mix(.5,noise((r0*u)*.722+vec2(14.02,25.9)),med);
 float density=.50+.267*(a-.5)+.476*(b-.5)+.257*(c-.5);
 float feather=1.-smoothstep(.088,.269,fp);
 float gain=1.+.253*(density-.5)+.081*(c-.5);
 float canopy=smoothstep(.297,.704,density);
 float opticalHeight=0.;
 const float finePeriod=${GRASS_GRAIN_METRES.toFixed(6)};
 float mesofade=1.-smoothstep(.65,1.85,fp);
 if(mesofade>.001){
    // The change of scale stretches closely grouped optical leaf response into
    // dense mat clusters. It does not insert individual stems or road directions.
    mat2 stepR=mat2(.583,-.8124,.8124,.583);
    vec3 warpY=grassDensitySlope(u*.064+vec2(5.3,11.2));
    vec2 uu=(stepR*u)/7.63+vec2(.31*rawA.x+.08*rawB.x,.27*(warpY.x-.5)-.04*rawB.x);
    vec2 aD=transpose(r0)*rawA.yz*.147,bD=transpose(r1)*rawB.yz*.411;
    vec2 uxD=.31*aD+.08*bD,uzD=.27*.064*warpY.yz-.04*bD;
    vec2 dx=(stepR*footprintX)/7.63+vec2(dot(uxD,footprintX),dot(uzD,footprintX));
    vec2 dz=(stepR*footprintZ)/7.63+vec2(dot(uxD,footprintZ),dot(uzD,footprintZ));
    vec4 mat=textureGrad(sourceGrassArtMap,uu,dx*1.15,dz*1.15);
    opticalHeight=(mat.g-.449)*.0105;
    float valley=(mat.g-.449);
    float coverRelief=smoothstep(.244,.662,mat.g)-.52;
    gain+=mesofade*(.69+.50*canopy)*(.294*valley+.153*coverRelief);
    vec2 slope=transpose(stepR)*((mat.ba*255.-128.)/163.);
    vec3 bump=vec3(-slope.x,0.,-slope.y);
    // The second normal is broad, bounded, and fades with the pixel footprint.
    float relief=(.24+.20*density)*cover*mesofade*(.51+.49*narrow);
    normal=normalize(normal+(bump-normal*dot(normal,bump))*relief);
 }
 if(feather>.0001){
    vec2 uk=r0*u/finePeriod,ddx=r0*footprintX/finePeriod,ddy=r0*footprintZ/finePeriod;
    vec3 view=normalize(cameraPosition-ground);
    vec2 opticShift=(r0*view.xz)*(opticalHeight/max(.40,abs(view.y))/finePeriod)*feather;
    vec4 fiber=textureGrad(sourceGrassArtMap,uk+vec2(.425,.111)-opticShift,ddx*1.10,ddy*1.10);
    float f=fiber.r-.4039,shelter=fiber.g-.4489;
    gain+=(.426*f+.227*shelter)*feather*(.63+.57*canopy);
    vec2 slope=transpose(r0)*((fiber.ba*255.-128.)/163.);
    vec3 bump=vec3(-slope.x,0.,-slope.y);
    float surface=.72*feather*cover*(.76+.48*density);
    normal=normalize(normal+(bump-normal*dot(normal,bump))*surface);
    // Restrained small forward scatter from the close canopy only.
    float sunshine=max(0.,dot(view,-sun));
    float skim=pow(1.-clamp(abs(view.y),0.,1.),2.);
    gain+=max(0.,f)*.083*sunshine*skim*feather;
 }
 // Multiplication by a scalar keeps the inherited linear-RGB hue/chromaticity.
 color*=mix(1.,clamp(gain,.78,1.23),cover*.94);
}
`;
