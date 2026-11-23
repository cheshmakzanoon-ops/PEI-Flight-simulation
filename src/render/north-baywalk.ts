import * as THREE from 'three';
import { BAYWALK_ANCHOR } from '../sim/baywalk-native.ts';
import { BAYWALK_COURT } from '../sim/baywalk-native.generated.ts';
import { project } from '../sim/geo.ts';
import { SPINNAKERS_DECK } from './spinnakers-deck.generated.ts';
import { weatheredTimber } from './spinnakers-deck.ts';
import type { WharfSurface } from './spinnakers-shells.ts';
import type { World } from './world.ts';

const end=project(...BAYWALK_COURT.guideEnd),start=BAYWALK_ANCHOR;
const dx=end.x-start.x,dz=end.z-start.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
const cx=-uz,cz=ux,origin=project(...SPINNAKERS_DECK.anchor);
const QUADS=7,RUN=34,HALF=.72,AXIS_OFFSET=.33;
const shore=(s:number,t:number)=>({x:start.x+ux*s+cx*t,z:start.z+uz*s+cz*t});
const smooth=(u:number)=>{const a=Math.max(0,Math.min(1,u));return a*a*(3-2*a);};
const fit=(s:number)=>2.59690-.045630*s*(12.59/length);
export type NorthBaywalk={group:THREE.Group;sync:()=>void;surface:THREE.Mesh};

export function buildNorthBaywalk(deck:WharfSurface,world:World):NorthBaywalk|undefined{
 if(!world.baywalkActive)return;
 const seam:number[]=[],footX:number[]=[],top0:number[]=[];
 for(let k=0;k<=QUADS;k++){
  const t=AXIS_OFFSET+HALF*(2*k/QUADS-1);
  const at=(s:number)=>{const p=shore(s,t);return deck(p.x-origin.x,p.z-origin.z);};
  if(at(-.4)===undefined||at(.54)!==undefined)return;
  let a=-.4,b=.54;
  for(let j=0;j<27;j++){const m=(a+b)*.5;if(at(m)===undefined)b=m;else a=m;}
  // Meet every entering column at the actual irregular platform edge, not
  // one nominal OSM node. The tuck lets both physical caps cover the seam.
  const board=a-.018,base=at(board);
  if(base===undefined||Math.abs(base-fit(board))>.19)return;
  seam.push(board);top0.push(base+.002);footX.push(t);
 }
 const bowl=()=>{
  const foot:number[]=[];
  for(const t of footX){
   const p=shore(length,t),h=world.restoredBaywalkY(p.x,p.z);
   if(h===undefined||Math.abs(h+.004-fit(length))>.27)return;
   foot.push(h+.004);
  }
  if(Math.max(...foot)-Math.min(...foot)>.13)return;
  return foot;
 };
 const floor=bowl();if(!floor)return;
 const point=(u:number,i:number,feet:number[])=>{
  const s=seam[i]+u*(length-seam[i]),q=shore(s,footX[i]),f=fit(s);
  const y=f+(top0[i]-fit(seam[i]))*(1-smooth((s-seam[i])/1.05))
    +(feet[i]-fit(length))*smooth((s-(length-3.24))/3.24);
  return new THREE.Vector3(q.x-start.x,y,q.z-start.z);
 };
 // Construction gate on practical gradients and a real near-ground ramp.
 const lead=(feet:number[])=>{
  for(let i=0;i<=QUADS;i++){
   for(let k=1;k<=RUN;k++){
    const a=point((k-1)/RUN,i,feet),b=point(k/RUN,i,feet);
    if(Math.abs(a.y-b.y)/Math.hypot(a.x-b.x,a.z-b.z)>.155)return false;
    const x=start.x+b.x,z=start.z+b.z;
    const ground=world.restoredBaywalkY(x,z);
    if(ground===undefined||b.y<ground-.015)return false;
   }
  }
  return true;
 };
 if(!lead(floor))return;
 const group=new THREE.Group();group.name='Supported north Summerside Baywalk ramp';group.position.set(start.x,0,start.z);
 const pos=new Float32Array((RUN+1)*(QUADS+1)*3),top=new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage),idx:number[]=[];
 for(let j=0;j<RUN;j++)for(let i=0;i<QUADS;i++){
  const a=j*(QUADS+1)+i,b=a+1,c=a+QUADS+1,d=c+1;idx.push(a,b,c,b,d,c);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',top);g.setIndex(idx);
 const surface=new THREE.Mesh(g,weatheredTimber('deck'));surface.name='North Baywalk fitted wooden walking cap';group.add(surface);
 const span=Math.floor(length/1.72),spindles=Math.floor(length/.149);
 const cab=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),weatheredTimber('rail'),2*((span+1)+spindles+2*RUN));
 cab.name='Interpreted north ramp post-and-picket rails';group.add(cab);
 const supports=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),weatheredTimber('post'),16);
 supports.name='Interpreted ground-seated Baywalk timber bents';
 group.add(supports);
 const side=new THREE.BufferGeometry();
 const verge=new THREE.Mesh(side,weatheredTimber('edge'));verge.name='Continuous ramp timber side trim';group.add(verge);
 const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),Z=new THREE.Vector3(0,0,1);
 const spanV=new THREE.Vector3(),size=new THREE.Vector3();
 let signature='';
 function place(feet:number[]){
  for(let j=0;j<=RUN;j++)for(let i=0;i<=QUADS;i++){
   const q=point(j/RUN,i,feet);top.setXYZ(j*(QUADS+1)+i,q.x,q.y,q.z);
  }
  top.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  const faces:number[]=[];let k=0;
  const upright=(p:THREE.Vector3,h:number,w:number)=>{
   rotation.identity();p.y+=h*.5;
   matrix.compose(p,rotation,size.set(w,h,w));cab.setMatrixAt(k++,matrix);
  };
  for(const side of [0,QUADS]){
   for(let j=0;j<RUN;j++){
    const a=point(j/RUN,side,feet),b=point((j+1)/RUN,side,feet);
    faces.push(a.x,a.y,a.z,b.x,b.y,b.z,a.x,a.y-.193,a.z,
     b.x,b.y,b.z,b.x,b.y-.193,b.z,a.x,a.y-.193,a.z);
    for(const h of [.202,.946]){
     spanV.subVectors(b,a);const l=spanV.length();rotation.setFromUnitVectors(Z,spanV.normalize());
     const center=a.clone().lerp(b,.5);center.y+=h;
     matrix.compose(center,rotation,size.set(.074,.058,l+.024));cab.setMatrixAt(k++,matrix);
    }
   }
   for(let i=0;i<=span;i++)upright(point(.019+.959*i/span,side,feet),1.01,.10);
   for(let i=0;i<spindles;i++){
    const p=point((i+.5)/spindles,side,feet);p.y+=.20;upright(p,.748,.038);
   }
  }
  cab.instanceMatrix.needsUpdate=true;cab.computeBoundingSphere();
  // A few visible dark timber bents under the actual ramp. The 2020
  // elevations establish the floor and physical support points, not
  // the exact original carpentry or any below-surface structure.
  let bents=0;
  for(const u of [.224,.369,.523,.676,.841]){
   const A=point(u,1,feet),B=point(u,QUADS-1,feet);
   const g0=world.restoredBaywalkY(start.x+A.x,start.z+A.z),g1=world.restoredBaywalkY(start.x+B.x,start.z+B.z);
   if(g0===undefined||g1===undefined||Math.min(A.y-g0,B.y-g1)<.32)continue;
   for(const [q,g] of [[A,g0],[B,g1]] as const){
    const bottom=g-.016,top=q.y-.135;
    rotation.identity();matrix.compose(new THREE.Vector3(q.x,(bottom+top)*.5,q.z),rotation,size.set(.126,top-bottom,.126));
    supports.setMatrixAt(bents++,matrix);
   }
   spanV.subVectors(B,A);const len=spanV.length();rotation.setFromUnitVectors(Z,spanV.normalize());
   const center=A.clone().lerp(B,.5);center.y-=.118;
   matrix.compose(center,rotation,size.set(.148,.176,len+.167));supports.setMatrixAt(bents++,matrix);
  }
  supports.count=bents;supports.instanceMatrix.needsUpdate=true;supports.computeBoundingSphere();
  side.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));side.computeVertexNormals();side.computeBoundingSphere();
 }
 place(floor);
 return {group,surface,sync:()=>{
  const rect=world.baywalkBounds;
  if(!rect)return;
  const next=world.visualGroundSignature(rect);
  if(signature===next)return;
  const feet=bowl();
  if(feet&&lead(feet)){place(feet);group.visible=true;}else group.visible=false;
  signature=next;
 }};
}
