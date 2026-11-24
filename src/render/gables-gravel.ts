import {project} from '../sim/geo.ts';

/** Dated guide evidence corroborates a gravel walk here. The centreline is
 * mapped; the narrow authorial visibility strip is not a measured width. */
export const GABLES_GRAVEL_NODES=[
 [-63.3819114,46.4882988],[-63.3818888,46.4884252],[-63.3818595,46.4884939],
] as const;
export const GABLES_GRAVEL_PINS={
 terrain:'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
 cover:'46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863',
 coverRaw:'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
 roads:'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1',
 buildings:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
} as const;
export function gablesGravelAtlasMatches(terrain?:string,cover?:string,raw?:string){
 const p=GABLES_GRAVEL_PINS;
 return p.terrain===terrain&&p.cover===cover&&p.coverRaw===raw;
}
export function gablesGravelGeometryMatches(roads?:string,buildings?:string){
 return GABLES_GRAVEL_PINS.roads===roads&&GABLES_GRAVEL_PINS.buildings===buildings;
}
const world=GABLES_GRAVEL_NODES.map(pt=>project(pt[0],pt[1]));
const MID=world[1],z=world.map(p=>[p.x-MID.x,p.z-MID.z] as const);
export const GABLES_GRAVEL_CLEARANCE=0.70;
/** Direct bare-ground support is qualified in the summer 2020 native
 * survey only from 7.500 to 15.625 m along this particular way.
 * Recess that interval another 0.125 m at each end. */
export const GABLES_GRAVEL_STATIONS=[7.625,15.50] as const;
const nativeJunction=14.306,nativeLength=22.351;
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const at=(a:readonly [number,number],b:readonly [number,number],t:number)=>
 [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t] as const;
const P=[at(z[0],z[1],GABLES_GRAVEL_STATIONS[0]/nativeJunction),z[1],
 at(z[1],z[2],(GABLES_GRAVEL_STATIONS[1]-nativeJunction)/(nativeLength-nativeJunction))] as const;
const b=GABLES_GRAVEL_CLEARANCE;
const firstLength=distance(P[0],P[1]),secondLength=distance(P[1],P[2]);
export function gablesGravelIntersects(left:number,top:number,right:number,bottom:number){
 return P.some((p,i)=>i>0&&
  right>=MID.x+Math.min(P[i-1][0],p[0])-b&&left<=MID.x+Math.max(P[i-1][0],p[0])+b&&
  bottom>=MID.z+Math.min(P[i-1][1],p[1])-b&&top<=MID.z+Math.max(P[i-1][1],p[1])+b);
}
function linePoint(x:number,z:number,a:readonly [number,number],c:readonly [number,number]){
 const dx=c[0]-a[0],dz=c[1]-a[1],px=x-a[0],pz=z-a[1];
 const along=Math.max(0,Math.min(1,(px*dx+pz*dz)/(dx*dx+dz*dz)));
 return Math.hypot(px-along*dx,pz-along*dz);
}
export function gablesGravelDistance(x:number,z:number){
 const a=x-MID.x,c=z-MID.z;
 return Math.min(linePoint(a,c,P[0],P[1]),linePoint(a,c,P[1],P[2]));
}
const f=(x:number)=>x.toFixed(8),vec=(p:readonly number[])=>'vec2('+f(p[0])+','+f(p[1])+')';
export const gablesGravelGLSL=/*glsl*/`
uniform float localGravelStrength;
vec2 localGravelLine(vec2 p,vec2 a,vec2 b,float metreSpan){
 vec2 v=b-a,r=p-a;
 float along=clamp(dot(r,v)/dot(v,v),0.,1.);
 return vec2(length(r-v*along),along*metreSpan);
}
void paintGablesGravel(inout vec3 color,vec3 xyz,float d,float validCoast){
 // No receiving-normal or collision changes. Mapped endpoints are
 // recessed; the thin inboard painted support never follows a road.
 if(localGravelStrength<=0.||d>210.||validCoast<35.)return;
 vec2 xy=xyz.xz-${vec([MID.x,MID.z])};
 if(abs(xy.x)>10.||abs(xy.y)>20.)return;
 vec2 a=localGravelLine(xy,${vec(P[0])},${vec(P[1])},${f(firstLength)});
 vec2 b=localGravelLine(xy,${vec(P[1])},${vec(P[2])},${f(secondLength)});
 b.y+=${f(firstLength)};
 vec2 along=a.x<b.x?a:b;
 float endpoints=smoothstep(0.,1.65,along.y)*smoothstep(0.,1.65,${f(firstLength+secondLength)}-along.y);
 float mask=(1.-smoothstep(.43,.70,along.x))*(1.-smoothstep(92.,180.,d))*endpoints;
 if(mask<=0.)return;
 // Layer a compact matrix with small-scale warm grit, not pavement-like
 // clusters. The final centimetre grains fade before aliasing in flight.
 float packing=noise(xy*3.8+vec2(1.21,9.31));
 float grain=(noise(xy*13.1+vec2(7.41,0.83))-.5)*(1.-smoothstep(32.,69.,d));
 float grit=(noise(xy*43.9+vec2(7.93,12.81))-.5)*(1.-smoothstep(14.,34.,d));
 vec3 dry=mix(vec3(.119,.109,.093),vec3(.153,.138,.117),packing)+grain*.025+grit*.033;
 color=mix(color,dry,mask*.69*localGravelStrength);
}
`;
