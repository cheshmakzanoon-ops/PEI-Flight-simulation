import {BASIN_WHARF_TOE} from './basin-wharf-toe.generated.ts';
const {anchor,toNative,profile}=BASIN_WHARF_TOE;
const mix=(a:number,b:number,f:number)=>a+(b-a)*f;
export function wharfToeDistance(x:number,z:number){
 const dx=x-anchor[0],dz=z-anchor[1],s=dx*toNative[0][0]+dz*toNative[0][1],t=dx*toNative[1][0]+dz*toNative[1][1];
 if(s<=1.65||s>=48.47)return Infinity;
 let edge=profile[0][1] as number;
 for(let k=1;k<profile.length;k++){
  const p=profile[k-1],q=profile[k];
  if(s<=q[0]){edge=mix(p[1],q[1],(s-p[0])/(q[0]-p[0]));break;}
 }
 return Math.max(1.65-s,s-48.47,edge+.148-t,t-edge-3.05);
}
export function mergeWharfToe(old:number,x:number,z:number){
 const d=wharfToeDistance(x,z);return d<0?Math.min(old,d):old;
}

const gl=(v:number)=>v.toFixed(7);
export const wharfToeGLSL=`
#ifdef BASIN_WHARF_TOE
 vec2 wharfNative(vec2 p){
 vec2 d=p-vec2(${gl(anchor[0])},${gl(anchor[1])});
 vec2 q=vec2(dot(d,vec2(${gl(toNative[0][0])},${gl(toNative[0][1])})),
             dot(d,vec2(${gl(toNative[1][0])},${gl(toNative[1][1])})));
  return q;
 }
 float wharfLip(vec2 q){
 float e=0.;
 ${profile.slice(1).map((r,k)=>`${k?'else ':''}if(q.x<=${gl(r[0])})e=mix(${gl(profile[k][1])},${gl(r[1])},(q.x-${gl(profile[k][0])})/${gl(r[0]-profile[k][0])});`).join('\n')}
  return e;
 }
#endif
float mergeWharfToe(float old,vec2 p){
#ifdef BASIN_WHARF_TOE
 vec2 q=wharfNative(p);
 if(q.x<=1.65||q.x>=48.47)return old;
 float e=wharfLip(q);
 float v=max(max(1.65-q.x,q.x-48.47),max(e+.148-q.y,q.y-e-3.05));
 if(v<0.)return min(old,v);
#endif
 return old;
}
#if defined(BASIN_WHARF_TOE) && defined(BASIN_WHARF_FACADE)
 bool rayHitsFacade(vec2 q,vec2 dir,float y,float dy,float s0,float e0,float s1,float e1){
  float slope=(e1-e0)/(s1-s0);
  float divisor=dir.y-slope*dir.x;
  if(abs(divisor)<1.e-5)return false;
  float lambda=(e0+slope*(q.x-s0)+.155-q.y)/divisor;
  float station=q.x+lambda*dir.x, h=y+lambda*dy;
  // The wall shell has a little more depth than this guarded interval.
  return lambda>=-.018 && lambda<=.15 && station>=s0+.016 && station<=s1-.016 && h>-.18 && h<1.87;
 }
#endif
bool underWharfFacade(vec3 at,vec3 eye){
#if defined(BASIN_WHARF_TOE) && defined(BASIN_WHARF_FACADE)
 vec2 q=wharfNative(at.xz),c=wharfNative(eye.xz);
 // The art culls at 3.1km from its own centre. Keep a conservative
 // distance guard so the old skirt remains visible beyond that art.
 if(dot(c,c)>2980.*2980.)return false;
 if(q.x<2.18||q.x>47.97||at.y<-.10||at.y>1.91)return false;
 float lip=wharfLip(q);
 // Cameras on the channel side only. The old dirt curtain is retained
 // at the exposed ends and beyond the surveyed frontage support.
 if(c.y<=lip+.46||abs(q.y-lip-.155)>=.31)return false;
 vec2 dir=q-c;float dy=at.y-eye.y;
 // Cull only a truly redundant wall. A grazing ray can pass the end of
 // the measured crop even while its old intercept is within the crop.
 return ${profile.slice(1).map((r,k)=>`rayHitsFacade(q,dir,at.y,dy,${gl(profile[k][0])},${gl(profile[k][1])},${gl(r[0])},${gl(r[1])})`).join(' ||\n')};
#else
 return false;
#endif
}
`;
