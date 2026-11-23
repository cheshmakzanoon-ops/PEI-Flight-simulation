import * as THREE from 'three';
import {OCEAN_Y} from '../sim/terrain.ts';
import {GROUND_LIFT} from '../sim/coastal-terrain.ts';
import {APPROACH_START,APPROACH_STOP,BRIDGE_STOP,BRIDGE_STATIONS,BRIDGE_CROSS,MONTAGUE_PIER,
 approachDelta,measuredDeck,montagueSection,roadEdges,transitionWeight,walkDelta} from '../sim/montague-bridge.ts';
import {addBridgeConcrete} from './bridge-concrete.ts';

type XYZ=readonly [number,number,number];
type Contact=(x:number,z:number)=>number;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const range=(a:number,b:number,pitch:number)=>Array.from({length:1+Math.ceil((b-a)/pitch)},(_,i)=>mix(a,b,i/Math.ceil((b-a)/pitch)));
const sorted=(q:number[])=>q.sort((a,b)=>a-b).filter((a,i)=>!i||a-q[i-1]>1e-7);
const way=[-5.600,6.53] as const; // Supported tops, keeping outside rail inboard.
const pier=MONTAGUE_PIER.station;
const span=BRIDGE_STOP;
const lift=GROUND_LIFT+.012;
const asphaltShade=new THREE.Color(0x54534f);
const oldRoadShade=new THREE.Color(0x5e5b52);

class BridgeBuffer {
 readonly xyz:number[]=[];readonly color:number[]=[];readonly extra:number[]=[];
 quad(a:XYZ,b:XYZ,c:XYZ,d:XYZ,side?:readonly number[],shade?:THREE.Color){
  this.xyz.push(...a,...b,...c,...a,...c,...d);
  if(side&&shade)for(const i of [0,1,2,0,2,3]){
   this.color.push(shade.r,shade.g,shade.b);this.extra.push(side[i],64/127);
  }
 }
 mesh(material:THREE.Material,name:string,anchor:XYZ,smooth=false){
  const g=new THREE.BufferGeometry();
  const p=Float32Array.from(this.xyz,(v,i)=>v-anchor[i%3]);
  g.setAttribute('position',new THREE.BufferAttribute(p,3));
  g.computeVertexNormals();g.computeBoundingSphere();
  if(smooth){
   const normals=g.getAttribute('normal');
   const shared=new Map<string,THREE.Vector3>();
   const rounds=(i:number)=>[p[i*3],p[i*3+1],p[i*3+2]].map(x=>Math.round(x*900)).join(',');
   const n=new THREE.Vector3(),fallback=new THREE.Vector3();
   for(let i=0;i<normals.count;i++){
    const k=rounds(i),own=n.fromBufferAttribute(normals,i),v=shared.get(k);
    if(v)v.add(own);else shared.set(k,own.clone());
   }
   for(let i=0;i<normals.count;i++){
    const v=shared.get(rounds(i))!;
    if(v.lengthSq()>1e-10){n.copy(v).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
    else{fallback.fromBufferAttribute(normals,i);normals.setXYZ(i,fallback.x,fallback.y,fallback.z);}
   }
  }
  if(this.color.length){
   g.setAttribute('color',new THREE.Float32BufferAttribute(this.color,3));
   g.setAttribute('roadSurface',new THREE.Float32BufferAttribute(this.extra,2));
   g.setAttribute('roadSeatDelta',new THREE.BufferAttribute(new Float32Array(p.length/3),1));
  }
  const obj=new THREE.Mesh(g,material);
  obj.name=name;return obj;
 }
}
function block(g:BridgeBuffer,a:XYZ,b:XYZ,c:XYZ,d:XYZ,e:XYZ,f:XYZ,h:XYZ,j:XYZ){
 g.quad(a,b,c,d);g.quad(e,j,h,f);g.quad(a,e,f,b);g.quad(b,f,h,c);g.quad(c,h,j,d);g.quad(d,j,e,a);
}
function surface(color:number,roughness:number,metalness=0){
 return new THREE.MeshStandardMaterial({color,roughness,metalness,side:THREE.DoubleSide});
}
/**
 * Local review model. The deck samples are surveyed; public photos only
 * corroborate the two-span design, near-central pier, walks and rail silhouette.
 * The depicted landward abutments/steel shapes and pier are not as-built plans.
 * No mesh in this group is registered for flight, water or vehicle collision.
 */
export function buildMontagueBridge(asphaltMaterial:THREE.Material,height:Contact,landDistance:Contact){
 const root=new THREE.Group();root.name='Montague Bridge (opt-in feasibility)';
 const centre=montagueSection(pier),anchor=[centre.x,0,centre.z] as const;
 root.position.set(...anchor);
 const top=new BridgeBuffer(),concrete=new BridgeBuffer(),girders=new BridgeBuffer(),rails=new BridgeBuffer(),
  central=new BridgeBuffer(),bank=new BridgeBuffer(),yellow=new BridgeBuffer(),fog=new BridgeBuffer();
 function at(s:number,d:number,h:number):XYZ{
  const p=montagueSection(s);return [p.x+p.nx*d,h,p.z+p.nz*d];
 }
 function deckAt(s:number,d:number):number {return measuredDeck(s,d)+lift;}
 function roadAt(s:number,d:number):XYZ{
  const y=deckAt(s,d),p=at(s,d,y);
  if(s>=0&&s<=span)return p;
  const m=transitionWeight(s),ss=s<0?-s:s-span,k=Math.min(1,ss/9);
  // Where dry survey is available, seat above the rendered shared ground.
  // The photographed raised ends are supported by the bounded massing below,
  // not by lifting or declaring water cells to be land.
  const seated=Math.max(y+approachDelta(s),height(p[0],p[2])+lift+.006);
  const q=montagueSection(s);
  const original=height(q.x,q.z)+.55;
  return [p[0],mix(original,mix(y+approachDelta(s),seated,k),m),p[2]];
 }
 const extraWalk=[-12.4,span+13.0] as const;
 function walkWidth(s:number,side:number){
  const g=s<0?s-extraWalk[0]:extraWalk[1]-s;
  const reach=Math.min(1,Math.max(0,g/3.6));
  return reach*reach*(3-2*reach)*(side<0?1.50:1.68);
 }
 function shortWalk(s:number,u:number,side:number):XYZ{
  const edge=roadEdges(s)[side<0?0:1],d=edge+side*u*walkWidth(s,side);
  const portal=s<=0?0:span;
  const floor=at(s,d,deckAt(portal,d)+walkDelta(s,side));
  const reach=Math.min(1,Math.abs(s-portal)/6);
  const terrainY=height(floor[0],floor[2])+GROUND_LIFT+.017;
  return [floor[0],mix(floor[1],Math.max(floor[1],terrainY),reach),floor[2]];
 }
 const landWalkRanges:[number,number][]=[];
 const joints=sorted([...range(APPROACH_START,0,.72),...range(0,span,.76),...range(span,APPROACH_STOP,.72),
  ...BRIDGE_STATIONS,...extraWalk,0,span,pier]);
 const fullCross=sorted([...BRIDGE_CROSS.filter(x=>x>way[0]&&x<way[1]),...way,...roadEdges(0)]);
 // Retain exact walk/road joins and all adaptive knots needed for ≤7mm
 // transverse interpolation error. The heldout witness verifies the mesh.
 function reduce(lo:number,hi:number):number[]{
  if(hi<=lo+1)return [fullCross[lo],fullCross[hi]];
  let j=lo+1,error=0;
  const a=fullCross[lo],b=fullCross[hi],y=deckAt(0,a),z=deckAt(0,b);
  for(let i=lo+1;i<hi;i++){
   const d=fullCross[i],residual=Math.abs(deckAt(0,d)-mix(y,z,(d-a)/(b-a)));
   if(residual>error){error=residual;j=i;}
  }
  return error>.007?[...reduce(lo,j).slice(0,-1),...reduce(j,hi)]:[a,b];
 }
 const [laneA,laneB]=roadEdges(0);
 const j0=fullCross.indexOf(laneA),j1=fullCross.indexOf(laneB);
 const deckCross=sorted([...reduce(0,j0),...reduce(j0,j1),...reduce(j1,fullCross.length-1)]);
 function actualCross(s:number,f:number){
   const [l,r]=roadEdges(s);
   // Normalization is relative to the current road edges, preserving the
   // complete endpoint crossline of the old 9.6m road ribbon.
   return mix(l,r,(1+f)*.5);
 }
 const pavedFractions=sorted([-1,1,...deckCross.filter(d=>d>laneA&&d<laneB).map(d=>2*(d-laneA)/(laneB-laneA)-1)]);
 const walkFractions=[
  deckCross.filter(d=>d<=laneA).map(d=>(d-laneA)/(way[0]-laneA)).reverse(),
  deckCross.filter(d=>d>=laneB).map(d=>(d-laneB)/(way[1]-laneB))
 ];
 const widthRoad=(u:number,s:number) => actualCross(s,u);
 const paint=(g:BridgeBuffer,a:number,b:number,d:number,wide:number)=>{
  const h=(s:number,d:number)=>deckAt(s,d)+.011;
  const l=d-wide/2,r=d+wide/2;
  g.quad(at(a,l,h(a,l)),at(b,l,h(b,l)),at(b,r,h(b,r)),at(a,r,h(a,r)));
 };
 function steelBar(g:BridgeBuffer,a:number,b:number,d:number,w:number,yl:number,yt:number,continuous=false){
  const p=(s:number,v:number,h:number)=>at(s,v,deckAt(s,d)+h);
  const x=d-w/2,z=d+w/2;
  const A=p(a,x,yt),B=p(b,x,yt),C=p(b,z,yt),D=p(a,z,yt),E=p(a,x,yl),F=p(b,x,yl),G=p(b,z,yl),H=p(a,z,yl);
  if(!continuous){block(g,A,B,C,D,E,F,G,H);return;}
  g.quad(A,B,C,D);g.quad(E,H,G,F);g.quad(A,E,F,B);g.quad(C,G,H,D);
  if(Math.abs(a)<1e-7)g.quad(D,H,E,A);
  if(Math.abs(b-span)<1e-7)g.quad(B,F,G,C);
 }
 for(let i=1;i<joints.length;i++){
  const a=joints[i-1],b=joints[i],deck=a>=0&&b<=span;
  const shade=oldRoadShade.clone().lerp(asphaltShade,transitionWeight((a+b)*.5)*.63);
  for(let j=1;j<pavedFractions.length;j++){
   const u=pavedFractions[j-1],v=pavedFractions[j];
   top.quad(roadAt(a,widthRoad(u,a)),roadAt(b,widthRoad(u,b)),roadAt(b,widthRoad(v,b)),roadAt(a,widthRoad(v,a)),[u,u,v,v],shade);
  }
  if(!deck){
   const sides=a>=extraWalk[0]&&b<=extraWalk[1];
   if(sides)for(const side of [-1,1]){
    const mid=(a+b)/2,ow=walkFractions[side<0?0:1];
    if([shortWalk(a,0,side),shortWalk(b,0,side),shortWalk(b,1,side),shortWalk(a,1,side),shortWalk(mid,.5,side)]
      .every(q=>landDistance(q[0],q[2])>=.35)){
     const offset=concrete.xyz.length/3;
     for(let j=1;j<ow.length;j++){
      const l=shortWalk(a,ow[j-1],side),m=shortWalk(b,ow[j-1],side),
       n=shortWalk(b,ow[j],side),o=shortWalk(a,ow[j],side);
      if(side>0)concrete.quad(l,m,n,o);else concrete.quad(o,n,m,l);
     }
     // Actual raised curb; keep connection to the measured asphalt at every station.
     concrete.quad(shortWalk(a,0,side),shortWalk(b,0,side),roadAt(b,roadEdges(b)[side<0?0:1]),roadAt(a,roadEdges(a)[side<0?0:1]));
     landWalkRanges.push([offset,concrete.xyz.length/3]);
    }
   }
   if(a>=-11&&b<=span+11)for(const d of [-.095,.095]){
    const point=(s:number,v:number):XYZ=>{const r=roadAt(s,v);return [r[0],r[1]+.012,r[2]];};
    yellow.quad(point(a,d-.048),point(b,d-.048),point(b,d+.048),point(a,d+.048));
   }
   continue;
  }
  for(let j=1;j<deckCross.length;j++){
   const d=deckCross[j-1],e=deckCross[j];
   if(e<=laneA||d>=laneB)concrete.quad(at(a,d,deckAt(a,d)),at(b,d,deckAt(b,d)),at(b,e,deckAt(b,e)),at(a,e,deckAt(a,e)));
  }
  // Two visible outer plate-girder profiles, not a claim of the hidden beam count.
  for(const d of [-4.77,5.75]){
   steelBar(girders,a,b,d,.178,-1.11,-.40,true);
   steelBar(girders,a,b,d,.394,-1.16,-1.095,true);
  }
  for(const d of way){
   const topA=deckAt(a,d),topB=deckAt(b,d);
   concrete.quad(at(a,d,topA),at(b,d,topB),at(b,d,topB-.42),at(a,d,topA-.42));
  }
  const undersurface=(s:number,d:number)=>at(s,d,deckAt(s,0)-.44);
  girders.quad(undersurface(a,way[0]),undersurface(b,way[0]),undersurface(b,way[1]),undersurface(a,way[1]));
  for(const d of [-5.44,6.36]){
   steelBar(rails,a,b,d,.104,.89,.998,true);
   steelBar(rails,a,b,d,.068,.55,.647,true);
   steelBar(rails,a,b,d,.065,.25,.331,true);
  }
  for(const c of [-.095,.095])paint(yellow,a,b,c,.096);
  for(const c of [-3.82,4.55])paint(fog,a,b,c,.095);
 }
 // Slim open galvanized railing, plus seated square mounting shoes. Public
 // reference informs proportions; no exact manufacturer/rail standard claim.
 for(const s of range(.65,span-.65,2.35)){
  for(const d of [-5.44,6.36]){
   steelBar(rails,s-.044,s+.044,d,.115,.027,.904);
   steelBar(rails,s-.114,s+.114,d,.190,.008,.042);
  }
 }
 // One visually corroborated in-stream pier. The bottom stops at the water
 // plane and is not a bathymetric foundation. Approximate scale only.
 const spanSupport=(s:number,d:number,y:number)=>at(s,d,y);
 const topY=deckAt(pier,0)-1.15,base=OCEAN_Y-.095;
 const low=[pier-1.01,pier+1.01],high=[pier-.82,pier+.82];
 const d0=-4.72,d1=5.38;
 block(central,spanSupport(high[0],d0,topY),spanSupport(high[1],d0,topY),
  spanSupport(high[1],d1,topY),spanSupport(high[0],d1,topY),
  spanSupport(low[0],d0+.12,base),spanSupport(low[1],d0+.12,base),
  spanSupport(low[1],d1-.12,base),spanSupport(low[0],d1-.12,base));
 const cap=(s:number,d:number,y:number)=>spanSupport(s,d,topY+y);
 block(central,cap(pier-1.11,d0-.16,.15),cap(pier+1.11,d0-.16,.15),cap(pier+1.11,d1+.16,.15),cap(pier-1.11,d1+.16,.15),
  cap(pier-1.03,d0-.13,-.24),cap(pier+1.03,d0-.13,-.24),cap(pier+1.03,d1+.13,-.24),cap(pier-1.03,d1+.13,-.24));
 // Render-only retained approach silhouettes inside confirmed current land.
 // Never form a panel across open water, nor draw an invented extra pier.
 const returns:[number,number][]=[[-6.8,7.2],[51.6,69.4]];
 for(const [lo,hi] of returns){
  const spanEdges=range(lo,hi,.36);
  for(let i=1;i<spanEdges.length;i++)for(const side of [-1,1]){
   const s=spanEdges[i-1],t=spanEdges[i],m=(s+t)/2;
   const edge=(st:number)=>{
    const still=st>=0&&st<=span;
    const d=(side<0?way[0]:way[1]);
    if(still)return at(st,d,deckAt(st,d)-.26);
    const hand=(st<0?-st:st-span);
    const [a,b]=roadEdges(st),q=mix(d,side<0?a:b,Math.min(1,hand/9));
    const p=roadAt(st,q);return [p[0],p[1]-.095,p[2]] as const;
   };
   const a=edge(s),b=edge(t),p=edge(m);
   const dry=(q:XYZ)=>landDistance(q[0],q[2])>=.39;
   if(![a,p,b].every(dry))continue;
   // Seat visible fill along the existing local slope instead of painting
   // a long vertical grey plaque. There is no geometry outside dry cover.
   const offset=(st:number,q:XYZ,d:number):XYZ=>{
    const {nx,nz}=montagueSection(st),x=q[0]+nx*side*d,z=q[2]+nz*side*d;
    return [x,Math.min(q[1]-.006,height(x,z)+GROUND_LIFT-.07),z];
   };
   for(const spread of [1.54,.99,.56,.20,0]){
    const q=offset(s,a,spread),r=offset(t,b,spread),c=offset(m,p,spread);
    if(![q,c,r].every(dry))continue;
    const a0=offset(s,a,spread*.47),b0=offset(t,b,spread*.47),p0=offset(m,p,spread*.47);
    if(![a0,b0,p0].every(dry))continue;
    if(Math.max(a[1]-q[1],b[1]-r[1])>.075)bank.quad(a,b,r,q);
    break;
   }
  }
 }
 const walk=surface(0x9e9b8f,.91),shaft=surface(0x858477,.96),abutment=surface(0x857768,.98);
 addBridgeConcrete(walk,'deck');addBridgeConcrete(shaft,'shaft');addBridgeConcrete(abutment,'shield');
 root.add(top.mesh(asphaltMaterial,'surveyed deck and approaches',anchor),
  concrete.mesh(walk,'paired raised concrete walks',anchor),
  girders.mesh(surface(0x424c50,.82,.24),'curved steel span profiles',anchor),
  rails.mesh(surface(0x9caaa7,.59,.35),'open galvanized railing',anchor),
  central.mesh(shaft,'single visible pier: approximate form',anchor),
  bank.mesh(abutment,'land-qualified approach skirts',anchor,true),
  yellow.mesh(surface(0xba8841,.88),'paired yellow deck lines',anchor),
  fog.mesh(surface(0xb0afa1,.91),'curb-edge markings',anchor));
 root.userData.dryApproachWalkRanges=landWalkRanges;
 return root;
}
