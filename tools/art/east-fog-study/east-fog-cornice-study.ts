/** Detached art study. Qualitative reference: original painted rakes and
 * short eave returns on the East Point Fog Alarm Building. Numerical
 * trim section is an authored finish, not a measurement. No new aperture,
 * no surveyed roof-height, source, mesh-owner, shadow or placement change. */
import * as T from 'three';
import {makeFogGableShell,type FogBody,type FogShell,type FogRole} from './east-fog-gable-shell.ts';
type XYZ=readonly[number,number,number];
export type TrimRole='side-fascia'|'exposed-rake'|'eave-return';
type Span=Readonly<{body:FogRole;kind:TrimRole;outward:XYZ;first:number;end:number}>;
type Prism=Readonly<{body:FogRole;kind:TrimRole;first:number;end:number;frontLocal:readonly XYZ[];backLocal:readonly XYZ[];depth:number}>;
const stockTrim=new T.Color(0x9b302a);
const typecheck=(q:unknown,why:string)=>{if(!q)throw new Error(why);};
export const FOG_TRIM_METRES=Object.freeze({sideProjection:.042,rakeProjection:.038,verticalDepth:.143,
 topGap:.043,seamGap:.065,returnInside:.185,maxPlanOverhang:.061,sideBacking:.066,endBacking:.061,jointGap:.002});
function height(b:FogBody,u:number){return b.ridgeY-b.pitch*Math.abs(u-b.ridgeU);}
function positive(b:FogBody,p:XYZ){
 const [u0,u1,v0,v1]=b.box,{maxPlanOverhang:o}=FOG_TRIM_METRES;
 return p.every(Number.isFinite)&&Math.hypot(Math.max(u0-p[0],p[0]-u1,0),Math.max(v0-p[2],p[2]-v1,0))<o&&
  p[1]<=height(b,p[0])-.006+1e-9&&p[1]>=height(b,p[0])-.27;
}
/** Append fascia/rake faces while preserving every checked F32 bulk word.
 * This sampler owns its new geometry only. It neither mutates nor mounts
 * another Three.js object. The far silhouette choice remains independent. */
export function studyEastFogCornice(plan:FogShell){
 const bulk=makeFogGableShell(plan), streams={position:[] as number[],normal:[] as number[],color:[] as number[],clad:[] as number[]};
 const spans:Span[]=[],prisms:Prism[]=[];
 const p=plan.originXZ,[s,c]=[Math.sin(plan.yaw),Math.cos(plan.yaw)];
 const transform=(a:XYZ,offset=true)=>new T.Vector3((offset?p[0]:0)+c*a[0]+s*a[2],a[1],(offset?p[1]:0)-s*a[0]+c*a[2]);
 const loc=(u:number,y:number,v:number):XYZ=>[u,y,v];
 const addFace=(loop:XYZ[])=>{
  const points=loop.map(x=>transform(x)),n=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
  typecheck(n.length()>1e-7,'invalid prism face');n.normalize();
  for(const i of [0,1,2,0,2,3]){
   streams.position.push(points[i].x,points[i].y,points[i].z);streams.normal.push(n.x,n.y,n.z);
   streams.color.push(stockTrim.r,stockTrim.g,stockTrim.b);streams.clad.push(0);
  }
 };
 const firstArt=bulk.geo.getAttribute('position').count,f=FOG_TRIM_METRES;
 const emit=(b:FogBody,kind:TrimRole,faces:XYZ[][],out:XYZ)=>{
  const first=streams.clad.length;
  for(const loop0 of faces){
   const depth=kind==='side-fascia'?f.sideBacking:f.endBacking,normal=transform(out,false);
   const v=loop0.map(a=>transform(a)),n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
   typecheck(n.length()>1e-7&&Math.abs(n.clone().normalize().dot(normal))>.99999,'invalid front winding');
   const loop=n.dot(normal)<0?[...loop0].reverse():loop0;
   const back=loop.map(p=>loc(p[0]-out[0]*depth,p[1],p[2]-out[2]*depth));
   typecheck(loop.every(a=>positive(b,a))&&back.every(a=>positive(b,a)),'solid trim left independently fitted eave band');
   const from=firstArt+streams.clad.length;
   addFace(loop);addFace([...back].reverse());
   for(let k=0;k<4;k++){const j=(k+1)%4;addFace([loop[k],back[k],back[j],loop[j]]);}
   prisms.push(Object.freeze({body:b.id,kind,first:from,end:firstArt+streams.clad.length,
    frontLocal:Object.freeze(loop),backLocal:Object.freeze(back),depth}));
  }
  spans.push(Object.freeze({body:b.id,kind,outward:out,first:firstArt+first,end:firstArt+streams.clad.length}));
 };
 for(const b of plan.body){
  const [left,right,start,end]=b.box,onStart=b.id==='low-tower-side';
  const exposed=onStart?start:end,outV=onStart?-1:1;
  const vEdge=exposed+outV*f.rakeProjection;
  const mon=(u:number)=>height(b,Math.max(left,Math.min(right,u)))-f.topGap;
  const backV=vEdge-outV*f.endBacking;
  // Terminate the long board at the backed end assembly, leaving a
  // deliberate 2 mm butt seam and avoiding intersecting solid corners.
  const low=onStart?backV+f.jointGap:start+f.seamGap,
   high=onStart?end-f.seamGap:backV-f.jointGap;
  for(const d of [-1,1] as const){
   const e=d<0?left:right,u=e+d*f.sideProjection,y=height(b,e)-f.topGap;
   // The longitudinal fascia stops before the join and returns along
   // the exposed end; no overdraw inside the two-body seam.
   emit(b,'side-fascia',[[loc(u,y,low),loc(u,y-f.verticalDepth,low),
    loc(u,y-f.verticalDepth,high),loc(u,y,high)]],[d,0,0]);
   // Return follows the same true slope at its interior end, not the
   // projected old stock roof. The small rim sits below the long rake.
   const inner=e-d*f.returnInside;
   emit(b,'eave-return',[[u,e],[e,inner]].map(([a,z])=>{
    const A=mon(a)-f.verticalDepth,Z=mon(z)-f.verticalDepth;
    return [loc(a,A,vEdge),loc(z,Z,vEdge),loc(z,Z-.040,vEdge),loc(a,A-.040,vEdge)];
   }),[0,0,outV]);
  }
  for(const [lo,hi] of [[left-f.sideProjection,left],[left,b.ridgeU],[b.ridgeU,right],[right,right+f.sideProjection]]){
   const l=mon(lo),h=mon(hi);
   emit(b,'exposed-rake',[[loc(lo,l,vEdge),loc(hi,h,vEdge),loc(hi,h-f.verticalDepth,vEdge),loc(lo,l-f.verticalDepth,vEdge)]],[0,0,outV]);
  }
 }
 const geometry=bulk.geo.clone(),base=bulk.geo.getAttribute('position').count;
 for(const [name,item] of [['position',3],['normal',3],['color',3],['clad',1]] as const){
  const attr=bulk.geo.getAttribute(name);
  typecheck(attr instanceof T.BufferAttribute&&attr.array instanceof Float32Array&&attr.itemSize===item,'unsupported source stream');
  const combined=new Float32Array(attr.array.length+streams[name].length);
  combined.set(attr.array);combined.set(streams[name],attr.array.length);
  geometry.setAttribute(name,new T.BufferAttribute(combined,item));
 }
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {geometry,bulk:bulk.geo,base,spans:Object.freeze(spans),prisms:Object.freeze(prisms)};
}
