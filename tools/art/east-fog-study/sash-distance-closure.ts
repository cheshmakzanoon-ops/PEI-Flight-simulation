/** A detached repair for a real far raster witness. No draw mount or gameplay. */
import type {FogShell} from './east-fog-gable-shell.ts';
import type {SolidTuckPlan} from './solid-lod-math.ts';
import {patchDetachedFogRetirement} from './secondary-fog-vertex-program.ts';

type V3=readonly [number,number,number];
type R=Readonly<{first:number;end:number;anchor:V3}>;
function pin(first:number,end:number,anchor:V3):R{
 return Object.freeze({first,end,anchor:Object.freeze(anchor)});
}
/** Exact station-local Float32 role anchors, ~25mm behind the verified wall
 * plane with a separate floor, v-edge and roof interior reserve. */
export const FROZEN_SASH_CLOSURES=Object.freeze([
 pin(5853,6645,[18.01136589050293,1.9426020383834839,-1.715299367904663]),
 pin(6645,7437,[23.203105926513672,1.9426020383834839,-3.431199789047241]),
 pin(8157,8949,[16.185306549072266,1.93593430519104,-1.1117758750915527]),
] as const);
export const SASH_CLOSURE_DISTANCE=Object.freeze({unchangedAtMost:500,fullyClosedAtLeast:600});
const yaw=1.89;
const inward=[Math.cos(yaw),-Math.sin(yaw)] as const;
const clip=(x:number)=>Math.max(0,Math.min(1,x));
const cubic=(x:number)=>x*x*(3-2*x);
export function sashClosurePosition(x:V3,j:number,n:8157|8949,d:number):V3{
 if(!Number.isFinite(d)||!Number.isInteger(j)||j<0||j>=n||n!==8157&&n!==8949)return x;
 const a=FROZEN_SASH_CLOSURES.find(q=>j>=q.first&&j<q.end);
 const t=Math.fround(d);
 if(!a||t<=500)return x;
 if(t>=600)return a.anchor;
 const m=.14*cubic(clip((t-500)/140)),
  // Squaring the eased blend keeps a visible authored partial aperture on
  // approach when supported, with zero slope at each end.
  f=cubic((t-500)/100)**2;
 const u=x[0]+m*inward[0],v=x[2]+m*inward[1],w=1-f;
 return [Math.fround(w*u+f*a.anchor[0]),Math.fround(w*x[1]+f*a.anchor[1]),Math.fround(w*v+f*a.anchor[2])];
}
/** Reuse the prior body/trim program verbatim. Only the literal signed
 * sash suffix receives an interior contraction. No alpha/discard. */
export function patchDetachedFogSashClosure(source:string,plan:FogShell,cornice:SolidTuckPlan,n:8157|8949){
 if(source.includes('eastFogSashClosure'))return;
 const old=patchDetachedFogRetirement(source,plan,cornice,n);
 if(!old)return;
 const mark='   transformed.xz+=.14*eastFogSecondaryInset*vec2('+
  inward[0].toFixed(13)+','+inward[1].toFixed(13)+');';
 if(old.split(mark).length!==2)return;
 const dot=(a:V3)=>'vec3('+a.join(',')+')';
 const [a,b,c]=FROZEN_SASH_CLOSURES.map(r=>dot(r.anchor));
 const selector=n===8949?
  `gl_VertexID<6645?${a}:(gl_VertexID<7437?${b}:${c})`:`gl_VertexID<6645?${a}:${b}`;
 return old.replace(mark,mark+`
   vec3 eastFogSashClosurePivot=${selector};
   // Use an exact fixed position at the endpoint. Every triangle in a
   // given window role becomes the same point, even with fragment depth.
   if(eastFogSecondaryRange>=600.)transformed=eastFogSashClosurePivot;
   else{
    float eastFogSashClosure=smoothstep(500.,600.,eastFogSecondaryRange);
    transformed=mix(transformed,eastFogSashClosurePivot,eastFogSashClosure*eastFogSashClosure);
   }`);
}
