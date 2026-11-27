/** Original illustrative plant workbench assembly. Never removes or mounts a live tile. */
import * as T from 'three';
import {createDetachedGeorgetownPrincipalPlant} from '../georgetown-plant-principal.ts';
import {GEORGETOWN_PLANT_WORKBENCH as B} from './georgetown-plant-workbench.generated.ts';

type V3=[number,number,number];
type UV=[number,number];
type Knot={p:V3;uv:UV};
const pName='Georgetown historical shore plant partial workbench assembly';
const UP=new T.Vector3(0,1,0);
const dif=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];

export const GEORGETOWN_PLANT_WORKBENCH_ART=Object.freeze({
 name:pName,signedOwner:'q11220/106',selectedGeometryBasis:B.geometryBasis,
 exactCoverageM2:B.status.workbenchUnionAreaM2,leftUnresolvedM2:B.status.unresolvedSignedSiteAreaM2,
 unqualifiedE15:B.status.unseenE15Enclosure,
 mounted:false,replaceStock:false,oldSceneUntouched:true,wetOrTrafficModel:false,
 authoritativeCurrentOutline:false,renderRoles:[0,1,2,3] as const,oneOpaqueDraw:true,
 geometryTruth:'Original physically connected classroom/workbench model with named open cuts, not a survey.',
});
export function createDetachedGeorgetownPlantWorkbenchAssembly(sun:T.Vector3){
 const oldArt=createDetachedGeorgetownPrincipalPlant(sun),m=oldArt.material;
 oldArt.geometry.dispose();
 const p:number[]=[],n:number[]=[],uv:number[]=[],part:number[]=[];
 const counts=[0,0,0,0], heights=B.heights.map(rows=>new Map<number,number>(rows));
 const room=(j:number,i:number)=>{
  const v=heights[j].get(i);
  if(v===undefined)throw Error('Missing physical sheet height adjacency '+j);
  return v;
 };
 const knot=(i:number,h:number):Knot=>{
  const [u,v,x,z]=B.model[i];
  return {p:[x,h,z],uv:[u,v]};
 };
 const put=(x:Knot,y:Knot,z:Knot,role:number,positive:T.Vector3)=>{
  let f=new T.Vector3(...dif(y.p,x.p)).cross(new T.Vector3(...dif(z.p,x.p)));
  if(f.dot(positive)<0){[y,z]=[z,y];f.negate();}
  if(!(f.lengthSq()>1e-13&&f.dot(positive)>0&&Number.isFinite(f.x+f.y+f.z)))
   throw Error('Degenerate known sheet or perimeter');
  f.normalize();
  for(const t of [x,y,z]){p.push(...t.p);n.push(...f.toArray());uv.push(...t.uv);part.push(role);}
  counts[role]++;
 };
 for(const [id,shade,keys0] of B.faces){
  const ids=Array.from(keys0) as number[];
  const sector=ids.map(j=>new T.Vector2(B.model[j][0],B.model[j][1]));
  const tris=T.ShapeUtils.triangulateShape(sector,[]);
  const occupied=new Set(tris.flat()),left=Array.from(ids.keys()).filter(i=>!occupied.has(i)),used=new Set<number>();
  const at=(k:number)=>knot(ids[k],room(ids[k],id));
  for(const q of tris){
   const ring=[];
   for(let c=0;c<3;c++){
    const a=q[c],b=q[(c+1)%3],end=sector[b].clone().sub(sector[a]),den=end.lengthSq();
    const rest=left.flatMap(i=>{
     const f=sector[i].clone().sub(sector[a]),s=f.dot(end)/den;
     return s>1e-8&&s<1-1e-8&&f.addScaledVector(end,-s).length()<1e-7?[[i,s] as const]:[];
    }).sort((a,b)=>a[1]-b[1]);
    ring.push(a,...rest.map(s=>s[0]));
    for(const [j] of rest)used.add(j);
   }
   if(ring.length===3){put(at(q[0]),at(q[1]),at(q[2]),shade,UP);continue;}
   const z=q.map(at);
   const c:Knot={p:z[0].p.map((_,i)=>Math.fround(z.reduce((a,b)=>a+b.p[i],0)/3)) as V3,
    uv:z[0].uv.map((_,i)=>z.reduce((a,b)=>a+b.uv[i],0)/3) as UV};
   for(let i=0;i<ring.length;i++)put(c,at(ring[i]),at(ring[(i+1)%ring.length]),shade,UP);
  }
  if(!tris.length||used.size!==left.length)throw Error('Lost exact chart perimeter stations');
 }
 function skin(a:number,b:number,lA:number,hA:number,lB:number,hB:number,role:number,norm:T.Vector3){
  const lines=[[a,lA,hA],[b,lB,hB]].map(([i,l,h])=>{
   if(!(h-l>.000001))throw Error('Historical shell or step inverted');
   const y=Array.from(new Set(heights[i].values())).filter(q=>q>l&&q<h).sort((a,b)=>a-b);
   return [l,...y,h].map(v=>knot(i,v));
  });
  const [a0,b0]=lines; let i=0,j=0;
  const t=(a:Knot[],i:number)=>(a[i].p[1]-a[0].p[1])/(a.at(-1)!.p[1]-a[0].p[1]);
  while(i<a0.length-1||j<b0.length-1){
   const v=i<a0.length-1?t(a0,i+1):Infinity, w=j<b0.length-1?t(b0,j+1):Infinity;
   if(v<=w){put(a0[i],b0[j],a0[i+1],role,norm);i++;}
   else{put(a0[i],b0[j],b0[j+1],role,norm);j++;}
  }
 }
 for(const [a,b,id,edge,d] of B.oldExt){
  const s=B.model[a][4],t=B.model[b][4];
  if(edge<0||edge>=32||s===null||t===null)throw Error('Unknown as-built old perimeter ownership');
  skin(a,b,s,room(a,id),t,room(b,id),3,new T.Vector3(...d));
 }
 for(const [a,b,lo,hi,,d] of B.realRises)
  skin(a,b,room(a,lo),room(a,hi),room(b,lo),room(b,hi),2,new T.Vector3(...d));
 if(p.length/9>288||counts.some(a=>!a))throw Error('Invalid detached assembly work budget');
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(n,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setAttribute('plantPart',new T.Float32BufferAttribute(part,1));
 g.computeBoundingBox();g.computeBoundingSphere();
 const mesh=new T.Mesh(g,m);mesh.name=pName;mesh.position.set(...B.geometryOrigin);
 mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.userData.georgetownPartialCompiledWorkbench=GEORGETOWN_PLANT_WORKBENCH_ART;
 mesh.userData.roleTriangles=Object.freeze(counts);
 return mesh;
}
