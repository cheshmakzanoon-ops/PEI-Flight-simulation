import {project} from '../sim/geo.ts';

type Pt=Readonly<{x:number;z:number}>;
const record=[
 [-63.12709,46.2337],
 [-63.12559,46.23464],
] as const;
const ends=record.map(([x,y])=>project(x,y));
const anchor=project(-63.1269576,46.2337761);
const tail=project(-63.1257269,46.2345471);
const size=Math.hypot(tail.x-anchor.x,tail.z-anchor.z);
const east=(tail.x-anchor.x)/size,south=(tail.z-anchor.z)/size;
const uv=([x,z]:readonly number[])=>[x*east+z*south,-x*south+z*east] as const;
export const VICTORIA_PAVER_ATLAS='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1';
export const VICTORIA_PAVER_FLAG=64;
export const VICTORIA_PAVER_KIND=84;
// Artwork is supported wholly within the lower surveyed strip. At two
// weak southern stations the existing southern edge is still materially
// inboard. Neither endpoint enters a crossing or guesses the full width.
export const VICTORIA_PAVER_LIMITS=[8.,120.,-2.88,2.49] as const;
const [start,stop,north,sc]=VICTORIA_PAVER_LIMITS;
const margins=[1.22,1.22,.33,.25] as const;
export function matchesVictoriaPaving(hash:string|undefined,ordinal:number,flags:number,points:readonly Pt[]){
 return hash===VICTORIA_PAVER_ATLAS&&ordinal===619&&flags===9&&points.length===ends.length&&
  points.every((p,i)=>p.x===ends[i].x&&p.z===ends[i].z);
}
export function victoriaPavingCoordinates(x:number,z:number){
 return uv([x-anchor.x,z-anchor.z]);
}
function smooth(a:number,b:number,x:number){
 const s=Math.min(1.,Math.max(0.,(x-a)/(b-a)));return s*s*(3.-2.*s);
}
export function victoriaPavingWeight(x:number,z:number){
 const [u,v]=victoriaPavingCoordinates(x,z);
 return smooth(start,start+margins[0],u)*(1.-smooth(stop-margins[1],stop,u))*
        smooth(north,north+margins[2],v)*(1.-smooth(sc-margins[3],sc,v));
}

const c=(x:number)=>x.toFixed(8);
/** Pavers are original. The known block and road alignment are not a source
 * for each individual stone: pattern, bevel and weathering are art choices. */
export const victoriaPavingGLSL=`
 vec2 victoriaLocal(vec2 p){
  p-=vec2(${c(anchor.x)},${c(anchor.z)});
  return vec2(${c(east)}*p.x+${c(south)}*p.y,${c(-south)}*p.x+${c(east)}*p.y);
 }
 float victoriaWeight(vec2 q){
  return smoothstep(${c(start)},${c(start+margins[0])},q.x)*
    (1.-smoothstep(${c(stop-margins[1])},${c(stop)},q.x))*
    smoothstep(${c(north)},${c(north+margins[2])},q.y)*
    (1.-smoothstep(${c(sc-margins[3])},${c(sc)},q.y));
 }
 vec3 victoriaPaver(vec2 s,float px,out vec3 tangent,out float rough){
  // Staggered 2:1 domino field, alternating axial placement on diagonal
  // chains. Integral seam widths approximate an ordinary chamfered paver.
  mat2 orient=mat2(.70710678,-.70710678,.70710678,.70710678);
  vec2 worldCell=orient*(s+vec2(.021,.033))/.096;
  vec2 last=floor(worldCell),brick=last;
  float lane=mod(last.x+last.y,4.);
  bool horizontal=lane<1.5;
  if(lane>0.5&&lane<1.5)brick.x-=1.;
  if(lane>2.5)brick.y-=1.;
  vec2 size=horizontal?vec2(2.,1.):vec2(1.,2.);
  vec2 middle=size*.5;
  vec2 dist=middle-abs(worldCell-brick-middle);
  // Use an explicit projected footprint: no heavy derivative operations
  // run inside a fragment branch over the pavement edge.
  float line=min(dist.x,dist.y);
  float pixel=clamp(px/.096*.35,.028,.76);
  float detail=1.-smoothstep(.040,.29,px);
  float grain=roadNoise(s*48.)-.5;
  float dust=roadNoise(s*.62+vec2(.49,3.24));
  float stain=roadNoise(vec2(s.x*.51,s.y*.36)+vec2(-4.51,2.64));
  float shade=roadHash(brick+vec2(17.,.3))-.5;
  float speck=roadNoise(s*135.+vec2(2.71,4.31))-.5;
  float seam=(1.-smoothstep(.018-pixel*.27,.061+pixel*.34,line))*detail;
  float bevel=(1.-smoothstep(.061,.106,line))*detail;
  // Neutral interlocking pavers read muted gray-brown, without attributing a quarry or material recipe.
  vec3 center=mix(vec3(.174,.166,.151),vec3(.149,.155,.152),dust*.66);
  center*=.925+.15*stain+.152*shade*detail+.151*grain*detail+.073*speck*detail;
  float shoulder=1.-smoothstep(.10,.54,min(s.y+2.88,2.32-s.y)+.25*(stain-.50));
  center=mix(center,vec3(.132,.133,.123),clamp(shoulder,0.,1.)*.51);
  vec3 sand=mix(vec3(.095,.095,.087),vec3(.137,.134,.122),dust);
  // Small directional relief, not an actual heightfield or new road camber.
  vec2 diff=dist.x<dist.y?vec2(sign(worldCell.x-brick.x-middle.x),0.):vec2(0.,sign(worldCell.y-brick.y-middle.y));
  vec2 local=transpose(orient)*diff;
  vec2 globe=vec2(${c(east)}*local.x+${c(-south)}*local.y,${c(south)}*local.x+${c(east)}*local.y);
  tangent=vec3(globe.x,0.,globe.y)*bevel*(.137+.045*grain)*(1.-.64*seam);
  rough=.88+.09*dust+.03*seam;
  return mix(center,sand,.72*seam);
 }
`;
