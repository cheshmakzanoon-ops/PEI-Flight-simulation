import {Color,ShapeUtils,Vector2} from 'three';
import {VICTORIA_ROW} from './victoria-row.generated.ts';

type Point=Readonly<{x:number;z:number}>;
type Position=readonly [number,number];
type Plane=readonly [number,number,number];
type Wall=readonly [Position,Position,number,number,number,number];
type Step=readonly [Position,Position,Position,Position];
type Roof=Readonly<{p:readonly (readonly (readonly Position[])[])[];y:Plane;variant:number}>;
type Row=Readonly<{source:readonly Position[];originXZ:Position;roofs:readonly Roof[];
 walls:readonly Wall[];steps:readonly Step[]}>;
type Writer=(p:Point,y:number,color:Color,u:number,v:number,role:number,style:number)=>void;
const MODEL:Row=VICTORIA_ROW;
export const VICTORIA_TILE=VICTORIA_ROW.tile,VICTORIA_ATLAS=VICTORIA_ROW.atlasSha256;
export const VICTORIA_ROLES={wall:0,roof:31,riser:32,stone:33,reveal:34,glass:35,paint:36,base:37,joinery:38,shopGlass:39};
const role=VICTORIA_ROLES;
// A muted, original design palette for documented regional architectural
// families. The styles are not a claim that a given parcel has these colours.
const masonry=[0x918278,0x8c5b46,0x805141,0x975c43,0x886353,0x8d5241,0x905642,0x8c4d38,0x8d503d,0x98664b].map(c=>new Color(c));
const stones=[0x958b7c,0xbeab8e,0x9f937e,0xc3b498,0xb7aa93,0xac977d,0xab967f,0xb2a086,0xa69581,0xc1ab89].map(c=>new Color(c));
const frames=[0x4d473c,0x4c5242,0x4c423a,0x493a34,0x424c50,0x4d5342,0x485044,0x51413a,0x50464e,0x594a39].map(c=>new Color(c));
const lower=[0x5b4f3e,0x35453b,0x694341,0x635345,0x536669,0x414e43,0x445043,0x6c4a3d,0x47444b,0x655448].map(c=>new Color(c));
const roofing=[0x535651,0x62635b,0x5d5751,0x6d6961,0x646561,0x585655,0x66635e,0x5d5c57,0x655d56,0x6c6053].map(c=>new Color(c));
const base=new Color(0x827c6e),glass=new Color(0x616c70);
const settings=[
 // preferred bay spacing, upper clear width, arch rise, storefront style
 [2.64,.44,0,0],[2.77,.43,.19,2],[2.50,.44,.24,1],[2.81,.48,.38,2],
 [2.88,.49,.04,3],[2.67,.43,.22,1],[2.67,.43,.22,1],[2.79,.49,.32,3],
 [2.79,.48,.22,2],[2.75,.48,.05,3],
] as const;
const clamp=(x:number,l:number,h:number)=>Math.max(l,Math.min(h,x));
const az=([x,z]:Position,p:Plane)=>p[0]+p[1]*x+p[2]*z;
export function victoriaRowModel(hash:string|undefined,tile:string,ordinal:number,fp:readonly Position[],holes?:readonly (readonly Position[])[]){
 if(hash!==VICTORIA_ATLAS||tile!==VICTORIA_TILE||ordinal!==VICTORIA_ROW.ordinal||holes?.length)return;
 if(fp.length===MODEL.source.length&&fp.every((p,i)=>p[0]===MODEL.source[i][0]&&p[1]===MODEL.source[i][1]))return MODEL;
}

/** Partition-correct measured roof plus original modeled masonry joinery.
 * The outside nominal face and roof subdivisions come from sealed geo data.
 * Jambs, cornices, transoms and bays are art, all mounted inboard of that shell. */
export function emitVictoriaRow(q:Row,ground:(x:number,z:number)=>number,write:Writer){
 const [ox,oz]=q.originXZ,world=([x,z]:Position):Point=>({x:ox+x,z:oz+z});
 const K=(v:number)=>32+v;
 const tri=(p:Point,q:Point,r:Point,a:number,b:number,c:number,
   uv:[Position,Position,Position],tint:Color,f:number,style:number)=>{
  write(p,a,tint,...uv[0],f,style);write(q,b,tint,...uv[1],f,style);write(r,c,tint,...uv[2],f,style);
 };
 for(const {p,y,variant} of q.roofs){
  for(const rings of p){
   const pts=rings.map(r=>r.map(([x,z])=>new Vector2(x,z))),flat=rings.flat();
   for(const [i,j,k] of ShapeUtils.triangulateShape(pts[0],pts.slice(1))){
    const A=flat[i],B=flat[j],C=flat[k];
    const area=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);
    if(Math.abs(area)<1e-9)continue;
    const b=area<0?B:C,c=area<0?C:B;
    tri(world(A),world(b),world(c),az(A,y),az(b,y),az(c,y),[A,b,c],roofing[variant],role.roof,K(variant));
   }
  }
 }
 for(const [a,b,u,v] of q.steps){
  const A=world(a),B=world(b),l=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const lo0=Math.min(u[0],v[0]),lo1=Math.min(u[1],v[1]),hi0=Math.max(u[0],v[0]),hi1=Math.max(u[1],v[1]);
  const U:Position=[0,0],V:Position=[l,0],I:Position=[0,hi0-lo0],J:Position=[l,hi1-lo1];
  tri(A,A,B,lo0,hi0,hi1,[U,I,J],masonry[0],role.riser,K(0));
  tri(A,B,B,lo0,hi1,lo1,[U,J,V],masonry[0],role.riser,K(0));
 }
 // Test look-in direction against the original exact whole-shell plan.
 // The short inboard reveal never becomes a projecting recess at a corner.
 const src=q.walls;
 const within=(x:number,z:number)=>{
  let inZone=false;
  for(const [a,b] of src)if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inZone=!inZone;
  return inZone;
 };
 for(const [idx,[a,b,Y0,Y1,variant,front]] of src.entries()){
  const du=b[0]-a[0],dv=b[1]-a[1],L=Math.hypot(du,dv);
  if(L<.00004)continue;
  const dx=du/L,dz=dv/L,roleStyle=K(variant);
  const edge=(u:number,d=0):Position=>[a[0]+dx*u-dz*d,a[1]+dz*u+dx*d];
  const foot=(u:number)=>{
   const [x,z]=edge(u);return ground(ox+x,oz+z);
  };
  const g0=foot(0),g1=foot(L),street=Math.max(g0,g1)+.03,roof=(u:number)=>Y0+(Y1-Y0)*u/L;
  const stepTop=Math.min(Y0,Y1),h=stepTop-street;
  const f0=(u:number)=>g0+(g1-g0)*u/L-.42;
  const body=masonry[variant],stone=stones[variant],frame=frames[variant],wood=lower[variant];
  const roofBottom=Math.min(front?(variant===4||variant===9?.49:.385):.235,Math.max(0.,h*.15));
  const safe=(u:number,d:number)=>{const [x,z]=edge(u,d);return within(x,z);};
  // Pin inward setbacks to zero where an original edge is very short or
  // stands in a notch. Even the richest frontage leaves original exterior
  // roof/collar geometry and adjacent masonry untouched.
  const inboard=front&&L>2.2&&safe(.32,.142)&&safe(L-.32,.142)&&safe(L*.5,.142);
  const setback=inboard?.142:0.;
  // Only trim the shallow shell washout at corners. Deeper glass and
  // joinery have their own footprint checks and must stay genuinely planar;
  // tapering these by u artifacts a bright diagonal through a pane.
  const de=(u:number,d:number)=>d>setback+.025?d:Math.min(d,Math.min(u,L-u)*.44);
  type V=readonly [number,number,number];
  const vtx=(u:number,y:number,d=0):V=>[u,y,d];
  const T=(a:V,b:V,c:V,col:Color,r:number)=>{
   const P=(p:V)=>world(edge(p[0],p[2]));
   tri(P(a),P(b),P(c),a[1],b[1],c[1],
        [[a[0],a[1]-street],[b[0],b[1]-street],[c[0],c[1]-street]],col,r,roleStyle);
  };
  const quad=(a:V,b:V,c:V,d:V,col:Color,r:number)=>{T(a,b,c,col,r);T(a,c,d,col,r);};
  const bill=(u:number,v:number,low:number,high:number,depth:number,col:Color,r:number)=>{
   if(v-u<.0001||high-low<.0001)return;
   quad(vtx(u,low,de(u,depth)),vtx(u,high,de(u,depth)),vtx(v,high,de(v,depth)),vtx(v,low,de(v,depth)),col,r);
  };
  const cap=(u:number,v:number,ya:number,yb:number,d0:number,d1:number,col:Color,r:number)=>{
   quad(vtx(u,ya,de(u,d0)),vtx(u,ya,de(u,d1)),vtx(v,yb,de(v,d1)),vtx(v,yb,de(v,d0)),col,r);
  };
  const vertical=(u:number,v:number,ya:number,yb:number,ha:number,hb:number,d:number,col:Color,r:number)=>{
   if(v-u<.0001||Math.max(ha-ya,hb-yb)<1e-5)return;
   quad(vtx(u,ya,de(u,d)),vtx(u,ha,de(u,d)),vtx(v,hb,de(v,d)),vtx(v,yb,de(v,d)),col,r);
  };
  const returnCuts=setback?[0,.329,L-.329,L]:[0,L];
  const minRoom=front?2.2:4.2;
  if(h<1.8||L<minRoom){
   vertical(0,L,f0(0),f0(L),Y0,Y1,0,body,role.wall);continue;
  }
  // A mounted stone foundation follows the surveyed terrain ends. Lower
  // rows close to grade regardless of the footprint centroid's elevation.
  const footTop=street+(front?.28:.35);
  for(let i=0;i<returnCuts.length-1;i++){
   const u=returnCuts[i],v=returnCuts[i+1];
   vertical(u,v,f0(u),f0(v),footTop,footTop,setback,base,role.base);
  }
  const [pitch,upperWidth,arch,shopStyle]=settings[variant];
  const margin=front?.30:.36,usable=L-margin*2;
  const num=Math.max(1,Math.round(usable/(front?pitch:4.85)));
  const bay=usable/num;
  type Hole={contour:Position[];retail:boolean;depth:number;arch:number;u:number;v:number;lo:number;hi:number;door:boolean};
  const holes:Hole[]=[];
  const profile=(u:number,v:number,lo:number,hi:number,rise:number):Position[]=>{
   const r=[ [u,lo],[v,lo],[v,hi-rise] ] as Position[];
   if(rise>0){
    const m=(u+v)*.5,d=(v-u)*.5;
    for(let j=1;j<=8;j++){const t=Math.PI*j/8;r.push([m+d*Math.cos(t),hi-rise+rise*Math.sin(t)]);}
   }
   return r.length>3?r:[...r,[u,hi]];
  };
  const openings=(lo:number,hi:number,currentArch:number,retail=false,storey=0)=>{
   if(hi-lo<.53||stepTop-hi<Math.max(.29,roofBottom+.10))return;
   for(let j=0;j<num;j++){
    const mid=margin+(j+.5)*bay;
    const fac=retail?(shopStyle===1?.79:shopStyle===3?.67:.74):upperWidth;
    const breadth=clamp(bay*fac,.46,retail?2.54:1.42);
    const u=mid-breadth/2,v=mid+breadth/2;
    if(u<.18||L-v<.18)continue;
    const depth=retail?(shopStyle===1?.51:shopStyle===3?.42:.47):front?.292:.204;
    if(!safe(u,depth)||!safe(v,depth)||!safe(mid,depth))continue;
    const door=retail&&(j===(variant+idx)%num)&&(num>1||L>3.1);
    if(!front&&((idx+j+storey)%4===0||storey>2))continue;
    const bottom=door?footTop+.025:lo;
    holes.push({contour:profile(u,v,bottom,hi,currentArch),retail,depth,arch:currentArch,u,v,lo:bottom,hi,door});
   }
  };
  if(front)openings(street+(shopStyle===2?.71:.59),Math.min(street+(shopStyle===3?3.05:3.38),stepTop-.61),shopStyle===2?.31:0.,true);
  else openings(street+1.24,street+2.46,0.,false);
  // The continuous roof profile governs available facade heights. Original
  // art storey placement is not released as surveyed floor-specific data.
  const floorRise=variant===3?3.10:variant===2?3.13:variant===4?2.76:2.91;
  const y1=front?(shopStyle===3?3.98:4.19):4.12;
  for(let i=0;i<4;i++){
   const lo=street+y1+i*floorRise,hi=lo+(front?(variant===2?1.76:1.54):1.32);
   if(hi>stepTop-.63)break;
   openings(lo,hi,front&&i!==3?arch:0,false,i+1);
  }

  const endFace=roofBottom+.025;
  const outer:Position[]=[...returnCuts.map(u=>[u,footTop] as Position),
       ...returnCuts.slice().reverse().map(u=>[u,roof(u)-endFace] as Position)];
  const ring=[outer,...holes.map(o=>o.contour)];
  const flattened=ring.flat();
  for(const [a,b,c] of ShapeUtils.triangulateShape(ring[0].map(p=>new Vector2(...p)),ring.slice(1).map(r=>r.map(p=>new Vector2(...p))))){
   const q=(p:Position)=>vtx(p[0],p[1],de(p[0],setback));
   T(q(flattened[a]),q(flattened[b]),q(flattened[c]),body,role.wall);
  }
  for(let i=0;i<returnCuts.length-1;i++){
   const u=returnCuts[i],v=returnCuts[i+1],Y0=roof(u),Y1=roof(v);
   const cornice=front?endFace:Math.min(endFace,.24);
   vertical(u,v,Y0-endFace,Y1-endFace,Y0-cornice*.59,Y1-cornice*.59,setback,body,role.wall);
   // A real cornice overhang projects to the original line, not through it.
   if(front){
    const a=Y0-cornice*.60,b=Y1-cornice*.60,c=Y0-cornice*.25,d=Y1-cornice*.25;
    cap(u,v,a,b,setback*.25,setback,stone,role.stone);
    vertical(u,v,a,b,c,d,setback*.25,stone,role.stone);
    cap(u,v,c,d,0,setback*.25,stone,role.stone);
    vertical(u,v,c,d,Y0,Y1,0,stone,role.stone);
   }else vertical(u,v,Y0-cornice*.62,Y1-cornice*.62,Y0,Y1,0,stone,role.stone);
  }
  if(inboard&&front){
   // Original open-joint brick corbels and a continuous belt course stay
   // behind the exact footprint. They cast a real geometric return, not a decal.
   const belt=(height:number,width:number,finish:Color,inset:number)=>{
    if(height<footTop+.02||height>=stepTop-.61)return;
    const u=.035,v=L-.035,a=height-width*.53,b=height+width*.47;
    bill(u,v,a,b,inset,finish,role.stone);
    cap(u,v,a,a,inset,setback,finish,role.stone);
    cap(u,v,b,b,inset,setback,finish,role.stone);
   };
   const course=street+(shopStyle===3?3.47:3.76);
   if(course<stepTop-.74){
    belt(course,variant===4||variant===9?.185:.136,stone,.013);
    if(variant===4||variant===9||variant===1)belt(course-.19,.062,stone,.033);
   }
   if(L>4.1&&h>4.1){
    if(variant===4||variant===9||variant===7){
     // Stone strip/quoin treatment selected only on these original families.
     const y=street+y1-.18;
     belt(y,.081,stone,.028);
     belt(y+floorRise,.076,stone,.040);
    }
    for(let j=0,n=Math.floor((L-.52)/.41);j<n;j++){
     if(variant===4||variant===9)break;
     const u=.26+((j+.5)/n)*(L-.52),v=u+.065,l=u-.065;
     const y=roof(u)-(.30+roofBottom*.38);
     vertical(l,v,y-.103,y-.103,y+.03,y+.03,.035,body,role.wall);
     cap(l,v,y-.102,y-.102,.035,setback,body,role.wall);
    }
   }
   if((variant===5||variant===6)&&L>5.1){
    const u=L*.5,cy=roof(u)-.885,rr=.17;
    if(!holes.some(o=>o.u-.18<u&&o.v+.18>u&&o.hi+.19>cy)){
     const C=vtx(u,cy,.044);
     for(let j=0;j<12;j++){
      const a=j*Math.PI/6,b=(j+1)*Math.PI/6;
      const A=vtx(u+rr*Math.cos(a),cy+rr*Math.sin(a),.052);
      const B=vtx(u+rr*Math.cos(b),cy+rr*Math.sin(b),.052);
      T(C,A,B,j%2?stone:body,role.stone);
     }
    }
   }
  }
  for(const o of holes){
   const {u,v,lo,hi,depth,arch,retail,contour,door}=o;
   const bridge=(p:Position,d:number)=>vtx(p[0],p[1],de(p[0],d));
   for(let i=0;i<contour.length;i++){
    const a=contour[i],b=contour[(i+1)%contour.length];
    quad(bridge(a,setback),bridge(b,setback),bridge(b,depth),bridge(a,depth),retail?wood:stone,role.reveal);
   }
   const profileV=contour.map(p=>bridge(p,depth));
   for(let i=1;i<profileV.length-1;i++)T(profileV[0],profileV[i],profileV[i+1],glass,retail?role.shopGlass:role.glass);
   const thick=retail?.098:.058,d=depth-.011,trim=retail?wood:frame;
   const ringW=(v-u)*(retail?.076:.089),f=clamp(ringW,.056,.133);
   const head=hi-arch;
   bill(u,u+thick,lo,head,d,trim,role.paint);
   bill(v-thick,v,lo,head,d,trim,role.paint);
   bill(u,v,lo,lo+thick,d,trim,role.paint);
   if(arch===0)bill(u,v,hi-thick,hi,d,trim,role.paint);
   else{
    const arc=contour.slice(2),m=(u+v)*.5;
    for(let i=0;i<arc.length-1;i++){
     const a=arc[i],b=arc[i+1];
     const recess=(p:Position):Position=>[m+(p[0]-m)*(1.-thick/((v-u)*.5)),head+(p[1]-head)*(1.-thick/Math.max(.16,arch))];
     quad(bridge(a,d),bridge(b,d),bridge(recess(b),d),bridge(recess(a),d),trim,role.paint);
    }
   }
   const mid=(u+v)*.5;
   if(v-u>.56){
    const w=retail?.038:.027;
    const x=door?mid-.13:mid;
    bill(x-w,x+w,lo,hi-.075,d-.003,frame,role.paint);
    const transom=retail?head-.42:lo+(head-lo)*.59;
    bill(u+thick,v-thick,transom-.027,transom+.031,d-.004,trim,role.paint);
    if(retail&&v-u>1.24){
     const t=u+(v-u)*.26,j=u+(v-u)*.74;
     bill(t-.018,t+.018,transom,head-.037,d-.006,trim,role.paint);
     bill(j-.018,j+.018,transom,head-.037,d-.006,trim,role.paint);
    }
   }
   if(retail&&door){
    const m=mid+.10;
    bill(m-.045,m+.045,lo+.80,lo+.84,d-.006,stone,role.stone);
   }
   if(!retail){
    const outward=setback*.31;
    bill(u-f*.52,v+f*.52,lo-.103,lo-.045,outward,stone,role.stone);
    cap(u-f*.52,v+f*.52,lo-.045,lo-.045,outward,setback,stone,role.stone);
    if(arch>0&&inboard){
     const outerArc=profile(u-f,v+f,lo,hi+f,arch+f).slice(2),arc=contour.slice(2);
     for(let j=0;j<arc.length-1;j++){
      const col=(j===3||j===4)&&variant%3===0?stone:body;
      const r=col===stone?role.stone:role.wall;
      const A=outerArc[j],B=outerArc[j+1],C=arc[j+1],E=arc[j];
      if(A&&B){quad(bridge(A,outward),bridge(B,outward),bridge(C,outward),bridge(E,outward),col,r);
       quad(bridge(E,outward),bridge(C,outward),bridge(C,setback),bridge(E,setback),col,role.reveal);}
     }
    }
   }else if(inboard){
    const p=u-f*.91,q=v+f*.91;
    const low=door?lo:Math.max(footTop+.025,lo-.34),d=.022;
    const casing=shopStyle===3?stone:wood,caser=shopStyle===3?role.stone:role.joinery;
    const side=(a:number,b:number)=>{
     bill(a,b,low,hi-arch,d,casing,caser);
     bill(a+.21*(b-a),b-.21*(b-a),low+.13,hi-arch-.09,.006,casing,caser);
     cap(a,b,low,low,d,setback,casing,caser);
    };
    side(p,u);side(v,q);
    if(arch===0){
     bill(p,q,hi,hi+.138,.026,casing,caser);
     cap(p,q,hi+.138,hi+.138,.026,setback,casing,caser);
     bill(p,q,hi+.138,hi+.184,.009,stone,role.stone);
    }else{
     const outer=profile(p,q,lo,hi+.106,arch+.106).slice(2),inner=contour.slice(2);
     for(let i=0;i<inner.length-1;i++){
      quad(bridge(outer[i],d),bridge(outer[i+1],d),bridge(inner[i+1],d),bridge(inner[i],d),casing,caser);
      quad(bridge(inner[i],d),bridge(inner[i+1],d),bridge(inner[i+1],setback),bridge(inner[i],setback),casing,role.reveal);
     }
    }
    if(!door){
     bill(u,v,low,lo,.061,wood,role.joinery);
     bill(u,v,lo-.045,lo,.029,wood,role.joinery);
     if(v-u>.80){
      const a=u+.075,b=v-.075;
      bill(a,b,low+.073,Math.max(low+.079,lo-.108),.031,wood,role.joinery);
     }
    }
   }
  }
 }
}
