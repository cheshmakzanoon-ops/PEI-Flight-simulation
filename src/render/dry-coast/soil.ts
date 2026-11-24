// Original low maritime loam. This is an opt-in optical material, not a terrain or ecology dataset.
import * as T from 'three';
import type {BoundedGrade} from '../../sim/bounded-grade.ts';

type V2=readonly [number,number];
export const DRY_FRAME={
 origin:[-7059.451783730272,4968.451195266424],
 u:[.7350564016815042,-.67793974813776],
 v:[-.6773796960051186,-.7356641573842353],
 center:[-4.1,1.85],
 radius:[17.5,14.4],
 tile:[14,12],
} as const;
const g=DRY_FRAME;
const det=g.u[0]*g.v[1]-g.u[1]*g.v[0];
const inverseU:V2=[g.v[1]/det,-g.v[0]/det],inverseV:V2=[-g.u[1]/det,g.u[0]/det];
export function worldToDry(x:number,z:number):V2{
 const a=x-g.origin[0],b=z-g.origin[1];return [a*inverseU[0]+b*inverseU[1],a*inverseV[0]+b*inverseV[1]];
}
export function dryToWorld(u:number,v:number):V2{return [g.origin[0]+u*g.u[0]+v*g.v[0],g.origin[1]+u*g.u[1]+v*g.v[1]];}
const clamp=(x:number)=>Math.max(0,Math.min(1,x)),fr=(x:number)=>x-Math.floor(x),lerp=(x:number,y:number,t:number)=>x+(y-x)*t;
export const cubic=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function h(x:number,y:number){
 const a=fr(x*.1031),b=fr(y*.1031),c=a,j=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);
 return fr((a+b+2*j)*(c+j));
}
export function n(x:number,y:number){
 const [i,j]=[Math.floor(x),Math.floor(y)],s=cubic(0,1,fr(x)),t=cubic(0,1,fr(y));
 return lerp(lerp(h(i,j),h(i+1,j),s),lerp(h(i,j+1),h(i+1,j+1),s),t);
}
export const soilEnvelope=(u:number,v:number)=>{
 const r=Math.hypot((u-g.center[0])/g.radius[0],(v-g.center[1])/g.radius[1]);
 return 1-cubic(.40,1,r);
};
export const soilPlantPattern=(u:number,v:number)=>{
 const x=u+n(u*.074+15.7,v*.074-5.8)*2.9,y=v+n(u*.081-8.4,v*.081+22.3)*2.7;
 const w=.59*n(x*.213+8.2,y*.213-2.3)+.30*n(x*.57-3.2,y*.57+9.8)+.11*n(x*1.35+26.,y*1.35+13.);
 return cubic(.445,.658,w);
};
export function drySupport(u:number,v:number,category:number,coast:number,absoluteY:number,slopeY:number,gradeWeight:number){
 if(category!==30||absoluteY<=1.90||coast<=26||slopeY<=.89||gradeWeight<=.49)return 0;
 return soilEnvelope(u,v)*cubic(1.90,2.34,absoluteY)*cubic(26,43,coast)*cubic(.89,.967,slopeY)*cubic(.49,.99,gradeWeight);
}
function hash(x:number,y:number,s:number){
 const q=Math.imul(374761393,x+6259)^Math.imul(668265263,y+3137)^Math.imul(2246822519,s+2141);
 const r=Math.imul(q^(q>>>13),1274126177);
 return ((r^(r>>>16))>>>0)/4294967296;
}
function periodic(x:number,y:number,s:number,c:number){
 const U=x*c,V=y*c, i=Math.floor(U),j=Math.floor(V),u=cubic(0,1,fr(U)),v=cubic(0,1,fr(V)),k=(a:number)=>((a%c)+c)%c;
 return lerp(lerp(hash(k(i),k(j),s),hash(k(i+1),k(j),s),u),lerp(hash(k(i),k(j+1),s),hash(k(i+1),k(j+1),s),u),v);
}

/** Four channels carry packed original grains, clast presence and signed relief
 * slopes. This is not a copy of any source pixel. Repeat period is 1.92 m. */
export function makeDryGrains(){
 const N=192,b=new Uint8Array(N*N*4),height=new Float32Array(N*N);
 const cell=13;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const x=(i+.5)/N,y=(j+.5)/N,u=x*cell,v=y*cell,iu=Math.floor(u),iv=Math.floor(v);
  let k0=0,sk=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const cx=iu+dx,cy=iv+dy,ix=(cx+cell)%cell,iz=(cy+cell)%cell;
   if(hash(ix,iz,12)>.53)continue;
   const xx=u-cx-(.15+.70*hash(ix,iz,13)), yy=v-cy-(.15+.70*hash(ix,iz,14));
   const angle=hash(ix,iz,15)*6.28318531,t=Math.cos(angle),s=Math.sin(angle);
   const sz=.063+.28*Math.pow(hash(ix,iz,17),2.4),rx=(xx*t+yy*s)/sz,ry=(-xx*s+yy*t)/(sz*(.47+.57*hash(ix,iz,18)));
   const dist=Math.max(Math.abs(ry)*.94,Math.abs(rx)*.87+.32*Math.abs(ry))+.085*periodic(x,y,2,52);
   const z=1-cubic(.55,1.13,dist);
   if(z>k0){k0=z;sk=.52+.47*hash(ix,iz,30);}
  }
  const f=periodic(x,y,43,54)-.5,p=periodic(x,y,73,96)-.5,g=periodic(x,y,11,19)-.5;
  const k=j*N+i,o=k*4;
  b[o]=Math.round(255*clamp(.50+.40*f+.25*p+.21*g));
  b[o+1]=Math.round(255*k0*sk);
  height[k]=.0039*f+.0008*p+.0029*g+k0*.0061*sk;
 }
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const x0=(i+N-1)%N,x1=(i+1)%N,y0=(j+N-1)%N,y1=(j+1)%N;
  const k=(j*N+i)*4,scale=N/(2*1.92);
  b[k+2]=Math.round(255*clamp(.5+(height[j*N+x1]-height[j*N+x0])*scale*.66));
  b[k+3]=Math.round(255*clamp(.5+(height[y1*N+i]-height[y0*N+i])*scale*.66));
 }
 const map=new T.DataTexture(b,N,N,T.RGBAFormat,T.UnsignedByteType);
 map.wrapS=T.RepeatWrapping;map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipMapLinearFilter;
 map.generateMipmaps=true;map.anisotropy=4;map.colorSpace=T.NoColorSpace;map.needsUpdate=true;
 return map;
}

export function makeDrySoilUniforms(grade:BoundedGrade){
 const q=grade.grid,r=new Uint8Array(q.nx*q.nz);
 for(let j=0;j<q.nz;j++)for(let i=0;i<q.nx;i++)r[j*q.nx+i]=Math.round(255*grade.weight(q.x0+i*q.stepX,q.z0+j*q.stepZ));
 const mask=new T.DataTexture(r,q.nx,q.nz,T.RedFormat,T.UnsignedByteType);mask.magFilter=mask.minFilter=T.NearestFilter;mask.needsUpdate=true;
 const texture=makeDryGrains();
 return {drySoilMix:{value:0},drySoilGrade:{value:mask},drySoilGrid:{value:new T.Vector4(q.x0,q.z0,1/q.stepX,1/q.stepZ)},
   drySoilDims:{value:new T.Vector2(q.nx,q.nz)},drySoilGrain:{value:texture}};
}
const pv=(q:V2)=>'vec2('+q.map(t=>t.toFixed(12)).join(',')+')';

export const drySoilGLSL=/*glsl*/`
uniform float drySoilMix;
uniform sampler2D drySoilGrade,drySoilGrain;
uniform vec4 drySoilGrid;
uniform vec2 drySoilDims;
vec2 drySoilNative(vec2 xz){
 vec2 d=xz-${pv(g.origin)};
 return vec2(dot(d,${pv(inverseU)}),dot(d,${pv(inverseV)}));
}
float drySoilHeightSupport(vec2 xz){
 vec2 q=(xz-drySoilGrid.xy)*drySoilGrid.zw;
 if(any(lessThan(q,vec2(0.)))||any(greaterThanEqual(q,drySoilDims-1.)))return 0.;
 ivec2 i=ivec2(floor(q));vec2 f=fract(q);
 float b=texelFetch(drySoilGrade,i,0).r,c=texelFetch(drySoilGrade,i+ivec2(1,0),0).r;
 float d=texelFetch(drySoilGrade,i+ivec2(0,1),0).r,e=texelFetch(drySoilGrade,i+ivec2(1,1),0).r;
 return f.x+f.y<=1.?b+(c-b)*f.x+(d-b)*f.y:e+(d-e)*(1.-f.x)+(c-e)*(1.-f.y);
}
float drySoilPatch(vec2 q){
 vec2 t=q+vec2(noise(q*.074+vec2(15.7,-5.8))*2.9,noise(q*.081+vec2(-8.4,22.3))*2.7);
 float w=.59*noise(t*.213+vec2(8.2,-2.3))+.30*noise(t*.57+vec2(-3.2,9.8))+.11*noise(t*1.35+vec2(26.,13.));
 return smoothstep(.445,.658,w);
}
vec3 lowMaritimeSoil(vec3 old,vec3 pW,vec3 nW,float coast,float d,vec2 coverUV,sampler2D dryCover){
 if(drySoilMix<=0.)return old;
 vec2 q=drySoilNative(pW.xz),ddx=dFdx(q),ddy=dFdy(q);
 if(coast<=26.||pW.y<=1.90||pW.y>=6.||nW.y<=.89||d>=258.)return old;
 vec2 db=(q-${pv(g.center)})/${pv(g.radius)};
 if(dot(db,db)>=1.)return old;
 // Same nearest-index categorical control as Cover.sample(); exclude every other class.
 ivec2 sz=textureSize(dryCover,0);
 ivec2 cc=clamp(ivec2(floor(coverUV*vec2(sz))),ivec2(0),sz-1);
 if(int(round(texelFetch(dryCover,cc,0).r*255.))!=30)return old;
 float support=drySoilHeightSupport(pW.xz);
 if(support<=.49)return old;
 float r=length(db);
 float amt=(1.-smoothstep(.40,1.,r))*smoothstep(1.90,2.34,pW.y)*smoothstep(.89,.967,nW.y)*
     smoothstep(.49,.99,support)*smoothstep(26.,43.,coast)*(1.-smoothstep(119.,248.,d));
 if(amt<=.0001)return old;
 // Low + high channels share derivatives original in world space, not a screen-space pattern.
 float px=max(length(ddx),length(ddy));
 float medium=1.-smoothstep(.073,.44,px),fine=1.-smoothstep(.016,.15,px);
 float turf=drySoilPatch(q);
 float lumps=noise(q*.189+vec2(12.8,-2.31));
 float lo=.71*lumps+.29*noise(q*.441+vec2(-5.6,9.7));
 float ridges=mix(.5,noise(q*2.83+vec2(-8.6,9.7)),medium);
 float coked=mix(.5,noise(q*8.91+vec2(-27.,15.)),fine);
 vec3 soil=mix(vec3(.171,.089,.047),vec3(.306,.176,.094),lo);
 vec3 clay=mix(vec3(.228,.114,.066),vec3(.339,.206,.132),ridges);
 soil=mix(soil,clay,pow(lo,2.)*.55);
 soil*=.86+.21*ridges+.062*coked;
 if(fine>.001){
  const mat2 m=mat2(.835,-.55,.55,.835);
  vec2 wq=m*q;
  vec4 tex=textureGrad(drySoilGrain,wq/1.92,(m*ddx)/1.92,(m*ddy)/1.92);
  float stone=smoothstep(.20,.83,tex.g);
  float ore=mix(.55,noise(wq*3.96+.84),medium);
  float relief=dot(tex.ba-.5,m*vec2(dot(sun.xz,${pv(g.u)}),dot(sun.xz,${pv(g.v)})));
  vec3 rock=mix(vec3(.234,.114,.076),vec3(.335,.232,.157),ore);
  rock*=1.+.40*(tex.r-.5)-1.8*relief;
  soil=mix(soil,rock,stone*.48*fine);
  soil*=1.+fine*(.400*(tex.r-.5)-1.22*relief-.12*smoothstep(.1,.28,tex.g)*(1.-stone));
 }
 float shade=pow(turf,1.54);
 float mottle=mix(.50,noise(q*4.75+vec2(31.,52.5)),medium);
 float soilSwirl=mix(.5,noise(q*1.04+vec2(26.9,-52.9)),medium);
 vec3 olive=mix(vec3(.089,.108,.050),vec3(.179,.197,.089),lo*.54+.29*mottle+.17*soilSwirl);
 olive=mix(olive,vec3(.195,.163,.088),smoothstep(.61,.92,lumps)*.55);
 olive*=.825+.243*mottle+.075*coked;
 // Match the inherited image's coarse illumination and retain its large footprint.
 // Derive the gain from the macro palette (not the fine signal, which remains genuine detail).
 const vec3 luma=vec3(.2126,.7152,.0722);
 vec3 baseMatrix=mix(mix(vec3(.171,.089,.047),vec3(.306,.176,.094),lo),mix(vec3(.097,.119,.054),vec3(.192,.219,.098),lo),shade*.76);
 float baseY=dot(old,luma),palY=dot(baseMatrix,luma);
 float gain=clamp((baseY*.91+.019)/max(palY,.035),.40,1.22);
 vec3 coverColor=mix(soil,olive,shade*(.60+.16*soilSwirl))*gain;
 // Dissolve broad hue before the finest material edge, avoiding the appearance of a colored disc.
 float hueFoot=(1.-smoothstep(.36,1.00,r+.09*(lumps-.5)));
 float farDetail=mix(.54,1.,hueFoot);
 vec3 neighborMemory=old*(1.+amt*hueFoot*medium*(ridges-.5)*.069*drySoilMix);
 return mix(neighborMemory,coverColor,amt*(.43+.45*farDetail)*drySoilMix);
}
`;
