import * as THREE from 'three';
import { BAYWALK_ANCHOR } from '../sim/baywalk-native.ts';
import type { BaywalkNative } from '../sim/baywalk-native.ts';
import type { Cover } from '../sim/cover.ts';
import type { Terrain } from '../sim/terrain.ts';
import type { World } from './world.ts';
import { splitWalkCap } from './sidewalks.ts';
import { ROAD_CONTACT_LIFT } from './road-contact.ts';

export type RoadPoint={x:number;z:number};
const half=2.8,totalSections=4;
const unit=(x:number,z:number)=>{const l=Math.hypot(x,z);return {x:x/l,z:z/l};};
const smooth=(a:number)=>{const t=Math.min(1,Math.max(0,a));return t*t*(3-2*t);};
const normal=(a:RoadPoint,b:RoadPoint)=>unit(b.z-a.z,a.x-b.x);
function sections(points:readonly RoadPoint[]){
 if(points.length!==5)return;
 const a=points[1],b=points[2],c=points[3],ab=normal(a,b),bc=normal(b,c);
 const mid=unit(ab.x+bc.x,ab.z+bc.z);
 const miter=Math.min(1.06,1/Math.max(.1,mid.x*ab.x+mid.z*ab.z));
 const A=normal(points[0],a),C=normal(c,points[4]);
 const n=[A,{x:mid.x*miter,z:mid.z*miter},C],p=[a,b,c];
 const S=[0,Math.hypot(b.x-a.x,b.z-a.z)];
 S.push(S[1]+Math.hypot(c.x-b.x,c.z-b.z));
 return {n,p,S};
}
export function verifiedBaywalkRoadSupport(points:readonly RoadPoint[],prior:Cover,T:Terrain,bank:BaywalkNative){
 const q=sections(points);if(!q)return false;
 // Full stock width and both approach cross-sections must be supported,
 // not simply a dry centreline crossing a low quay or disconnected island.
 for(let i=0;i<2;i++){
  const a=q.p[i],b=q.p[i+1],p=q.n[i],r=q.n[i+1],L=q.S[i+1]-q.S[i];
  const count=Math.ceil(L/.16);
  for(let n=0;n<=count;n++){
   const f=n/count,dx=p.x+f*(r.x-p.x),dz=p.z+f*(r.z-p.z);
   for(let k=-totalSections;k<=totalSections;k++){
    const off=k*half/totalSections,x=a.x+(b.x-a.x)*f+dx*off,z=a.z+(b.z-a.z)*f+dz*off;
    const old=prior.beforeBaywalk(T,x,z);
    if(old<.045&&bank.signed(x,z)<.045)return false;
   }
  }
 }
 return true;
}
type Point={x:number;z:number;u:number;v:number;};
export type BaywalkRoad={mesh:THREE.Mesh;sync:()=>void};
export function buildBaywalkRoad(points:readonly RoadPoint[],world:World,material:THREE.Material,color:THREE.Color):BaywalkRoad|undefined{
 const bounds=world.baywalkBounds,reg=sections(points);if(!bounds||!reg)return;
 const q=reg,{p,n,S}=q,total=S[2];
 const T=world.terrain;
 const firstY=T.atlasElevation(p[0].x,p[0].z)+.55,lastY=T.atlasElevation(p[2].x,p[2].z)+.55;
 const middle=T.atlasElevation(p[1].x,p[1].z)+.55;
 const legacy=(s:number)=>s<S[1]?firstY+(middle-firstY)*s/S[1]:middle+(lastY-middle)*(s-S[1])/(total-S[1]);
 // Vertex heights carry the measured terrain plane except in short pads
 // joining the unchanged packed road approaches. Plans and widths are
 // not shifted and no paint, lane assignment or traffic is inferred.
 const v:number[]=[],attrs:number[]=[],C:number[]=[],station:number[]=[],P:Point[]=[];
 const grid={x0:bounds[0],z0:bounds[1],dx:.5,dz:.5};
 const point=(i:number,side:number):Point=>({x:p[i].x+n[i].x*half*side,z:p[i].z+n[i].z*half*side,u:127*side,v:S[i]});
 function faces(a:Point,b:Point,c:Point){
  for(const face of splitWalkCap([a,b,c],grid)){
   for(let i=1;i+1<face.length;i++){
    const a=face[0],b=face[i],c=face[i+1];
    const area=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
    if(Math.abs(area)<1e-9)continue;
    for(const x of area>0?[a,c,b]:[a,b,c]){
     P.push(x);v.push(x.x-BAYWALK_ANCHOR.x,0,x.z-BAYWALK_ANCHOR.z);
     attrs.push(Math.round(x.u),64);C.push(color.r,color.g,color.b);station.push(x.v);
    }
   }
  }
 }
 for(let i=0;i<2;i++){
  const a=point(i,1),b=point(i,-1),c=point(i+1,1),d=point(i+1,-1);
  faces(a,b,c);faces(c,b,d);
 }
 const G=new THREE.BufferGeometry(),pos=new THREE.Float32BufferAttribute(v,3).setUsage(THREE.DynamicDrawUsage);
 G.setAttribute('position',pos);G.setAttribute('roadSurface',new THREE.Int8BufferAttribute(attrs,2,true));
 G.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
 G.setAttribute('roadSeatDelta',new THREE.BufferAttribute(new Float32Array(P.length),1));
 const mesh=new THREE.Mesh(G,material);mesh.position.set(BAYWALK_ANCHOR.x,0,BAYWALK_ANCHOR.z);
 mesh.name='Summerside restored registered NRN street seam';
 let prior:string|undefined;
 function sync(){
  const signature=world.visualGroundSignature([Math.min(p[2].x,p[0].x)-4,Math.min(p[2].z,p[0].z)-4,
    Math.max(p[2].x,p[0].x)+4,Math.max(p[2].z,p[0].z)+4]);
  if(signature===prior)return;
  for(let i=0;i<P.length;i++){
   const s=station[i],q=P[i],ground=world.visualGroundHeight(q.x,q.z)+ROAD_CONTACT_LIFT;
   const a=smooth(s/15)*smooth((total-s)/10.5);
   pos.setY(i,legacy(s)*(1-a)+ground*a);
  }
  pos.needsUpdate=true;G.computeVertexNormals();G.computeBoundingSphere();prior=signature;
 }
 sync();return {mesh,sync};
}
