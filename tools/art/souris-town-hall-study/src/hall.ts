import * as T from 'three';
import {makeMaterials,roles,type Role} from './materials.ts';
import {ALL,DATUM,PLAN,at,area,partitions,roofAt,roofCells,type P2,type P3} from './survey.ts';
import {CORE_OUTLINE,coreJoints,clipCore,cutParameters,inCore,lowerY,type Sample} from './lower-core.ts';
export type HallOptions={textured?:boolean; frontGable?:boolean; rearSurvey?:boolean};
type Bucket={pos:number[];col:number[];uv:number[]};
const P=(u:number,y:number,v:number):P3=>[u,y-DATUM,-v];
const XZ=(q:P2,y:number)=>P(q[0],y,q[1]);
const cross=(p:P3,q:P3,r:P3)=>new T.Vector3(q[0]-p[0],q[1]-p[1],q[2]-p[2]).cross(new T.Vector3(r[0]-p[0],r[1]-p[1],r[2]-p[2]));
const vs=(a:P3)=>new T.Vector3(...a);
const ZFRONT: P3=[0,0,1],UP:P3=[0,1,0];
const rect=(u:number,w:number,y:number,h:number):P2[]=>[[u-w/2,y],[u+w/2,y],[u+w/2,y+h],[u-w/2,y+h]];
const simpleVector=(r:readonly P2[])=>r.map(p=>new T.Vector2(...p));
const shade=(h:number)=>.94+.065*Math.sin(h*443.13+22.);
const round=(u:number,w:number,bottom:number,spring:number,n=32):P2[]=>{
 const out:P2[]=[[u-w/2,bottom],[u+w/2,bottom]];
 for(let i=0;i<=n;i++){const a=Math.PI*i/n;out.push([u+w/2*Math.cos(a),spring+w/2*Math.sin(a)]);}
 return out;
};
function withPositiveNormals(ring:readonly P2[],holes:readonly (readonly P2[])[]=[]){
 const faces=T.ShapeUtils.triangulateShape(simpleVector(ring),holes.map(simpleVector));
 const all=[...ring,...holes.flat()];
 return faces.map(ix=>ix.map(i=>all[i]) as [P2,P2,P2]);
}
export function buildSourisTownHall(options:HallOptions={}){
 const hero=options.frontGable!==false,rear=options.rearSurvey===true,mat=makeMaterials(options.textured!==false),data=new Map<Role,Bucket>(roles.map(q=>[q,{pos:[],col:[],uv:[]}]));
 let exactRoofTris=0,isolatedPhotoGableTris=0;
 function tri(name:Role,p:P3,q:P3,r:P3,givenNormal:P3,c=1,tcoords?:(pos:P3)=>P2){
  const n=cross(p,q,r);if(n.lengthSq()<2e-16)return;
  const front=n.dot(vs(givenNormal));if(front<0.)[q,r]=[r,q];n.normalize();
  const a=data.get(name)!;
  const coords=tcoords??((p:P3):P2=>Math.abs(n.y)>.56?[p[0],-p[2]]:Math.abs(n.z)>.66?[p[0],p[1]]:[-p[2],p[1]]);
  for(const v of [p,q,r]){a.pos.push(...v);a.col.push(c,c,c);a.uv.push(...coords(v));}
 }
 function quad(m:Role,a:P3,b:P3,c:P3,d:P3,n:P3,col=1,uv?:(p:P3)=>P2){tri(m,a,b,c,n,col,uv);tri(m,a,c,d,n,col,uv);}
 function panel(m:Role,outline:readonly P2[],h:readonly (readonly P2[])[],f:(p:P2)=>P3,n:P3,col=1){
  for(const q of withPositiveNormals(outline,h))tri(m,f(q[0]),f(q[1]),f(q[2]),n,col);
 }
 const front=(z:number)=>([x,h]:P2)=>P(x,h,z);
 const shape=(m:Role,p:readonly P2[],z:number,c=1)=>panel(m,p,[],front(z),ZFRONT,c);
 type CloseFace={outline:P2[];v:number;depth:number;nested?:P2[];back?:Role};
 function reveal({outline,v,depth,nested,back='shadow'}:CloseFace){
  const pro=outline.reduce(([a,b],[x,y])=>[a+x/outline.length,b+y/outline.length],[0,0]);
  const end=nested??outline;
  for(let j=0;j<outline.length;j++){
   const i=(j+1)%outline.length,p=outline[j],q=outline[i];
   const n:P3=[pro[0]-(p[0]+q[0])/2.,pro[1]-(p[1]+q[1])/2.,0.];
   quad('trim',front(v)(p),front(v)(q),front(v+depth)(end[i]),front(v+depth)(end[j]),n,.78);
  }
  // Positive-area fully closed backing: a texture never masquerades as an aperture cover.
  shape(back,end,v+depth,.91);
 }
 function block(m:Role,lo:P3,hi:P3,tone=1){
  const [x,y,v]=lo,[b,c,e]=hi;
  if(b<=x||c<=y||e<=v)return;
  quad(m,P(x,y,v),P(b,y,v),P(b,c,v),P(x,c,v),[0,0,1],tone);
  quad(m,P(x,y,e),P(b,y,e),P(b,c,e),P(x,c,e),[0,0,-1],tone);
  quad(m,P(x,c,v),P(b,c,v),P(b,c,e),P(x,c,e),[0,1,0],tone);
  quad(m,P(x,y,v),P(b,y,v),P(b,y,e),P(x,y,e),[0,-1,0],tone);
  quad(m,P(x,y,v),P(x,c,v),P(x,c,e),P(x,y,e),[-1,0,0],tone);
  quad(m,P(b,y,v),P(b,c,v),P(b,c,e),P(b,y,e),[1,0,0],tone);
 }
 // Inset flanks approximately 0.26m from the measured ordered roof outline.
 // The contemporary 28 ft exterior width informs this nominal recess. The
 // fabricated dark eave uses only volume inside the measured cap, not a map extension.
 const wallBottom=12.44,faceSide=.317,faceCentre=.092,mid=2.105;
 const offsets=[.235,.206,.24,.259,faceSide,.259];
 const direction=(a:P2,b:P2):P2=>{const d=Math.hypot(b[0]-a[0],b[1]-a[1]);return [(b[0]-a[0])/d,(b[1]-a[1])/d];};
 const point=(a:P2,dir:P2,t:number):P2=>[a[0]+dir[0]*t,a[1]+dir[1]*t];
 const wallPlan:readonly P2[]=PLAN.map((p,i)=>{
  const previous=(i+PLAN.length-1)%PLAN.length;
  const before=direction(PLAN[previous],p),next=direction(p,PLAN[(i+1)%PLAN.length]);
  const a=point(p,[before[1],-before[0]],offsets[previous]);
  const b=point(p,[next[1],-next[0]],offsets[i]);
  const bx=b[0]-a[0],by=b[1]-a[1],det=before[0]*next[1]-before[1]*next[0];
  return point(a,before,(bx*next[1]-by*next[0])/det);
 });
 const frontL=wallPlan[5][0],frontR=wallPlan[4][0],frontLimit=Math.min(-frontL,frontR);
 const sampleFront=(u:number)=>roofAt([u,0],hero)-.164;
 const zoneDepth=(u:number)=>Math.abs(u)<mid?faceCentre:faceSide;
 const facePlanes=[[frontL,-mid,faceSide],[-mid,mid,faceCentre],[mid,frontR,faceSide]] as const;
 type Sq={type:'box';u:number;w:number;y:number;h:number;group:number};
 type Arch={type:'arch';u:number;w:number;y:number;spring:number};
 const windows:Sq[]=[
  {type:'box',u:-1.103,w:.49,y:14.48,h:1.84,group:1},
  {type:'box',u:0,w:1.14,y:14.42,h:1.97,group:1},
  {type:'box',u:1.103,w:.49,y:14.48,h:1.84,group:1},
  {type:'box',u:-3.12,w:.83,y:18.36,h:2.27,group:2},
  {type:'box',u:3.12,w:.83,y:18.36,h:2.27,group:2},
  {type:'box',u:-.45,w:.74,y:18.40,h:2.23,group:3},
  {type:'box',u:.45,w:.74,y:18.40,h:2.23,group:3},
  ...(hero?[{type:'box' as const,u:-.344,w:.552,y:23.785,h:1.103,group:4},{type:'box' as const,u:.344,w:.552,y:23.785,h:1.103,group:4}]:[]),
 ];
 const arches:Arch[]=[{type:'arch',u:-3.137,w:1.41,y:14.06,spring:16.25},{type:'arch',u:3.137,w:1.41,y:14.06,spring:16.25}];
 const holes=[...windows.map(z=>({u:z.u,cut:rect(z.u,z.w,z.y,z.h)})),...arches.map(z=>({u:z.u,cut:round(z.u,z.w,z.y,z.spring)}))];
 const joinBoard=(u0:number,u1:number,v0:number,v1:number,role:Role)=>{
  const n=partitions([u0,0],[u1,0],hero);
  for(let j=1;j<n.length;j++){
   const a=n[j-1][0],b=n[j][0],p=sampleFront(a),q=sampleFront(b);
   quad(role,P(a,p,v0),P(b,q,v0),P(b,q,v1),P(a,p,v1),[0,-1,0],.54);
  }
 };
 // Each bay is an independent original relief plane with real cut-out doors and windows.
 for(const [a,b,dep]of facePlanes){
  const cuts=partitions([a,0],[b,0],hero);
  const contour:P2[]=[[a,wallBottom],[b,wallBottom],...cuts.slice().reverse().map(q=>[q[0],sampleFront(q[0])] as P2)];
  const cutouts=holes.filter(z=>z.u>=a&&z.u<=b).map(z=>z.cut);
  panel('wall',contour,cutouts,front(dep),ZFRONT);
  joinBoard(a,b,0,dep,'wood');
 }
 for(const t of [-1,1]){
  const u=t*mid,top=sampleFront(u),n:P3=[t,0,0];
  quad('trim',P(u,wallBottom,faceCentre),P(u,wallBottom,faceSide),P(u,top,faceSide),P(u,top,faceCentre),n,.85);
 }
 // True complementary soffit triangles at the two reduced wall corners.
 // Their radial edges are exactly shared with the side oversail strips.
 for(const [outer,inner] of [[PLAN[5],wallPlan[5]],[PLAN[4],wallPlan[4]]]){
  const u=inner[0],e=sampleFront(outer[0]),h=sampleFront(u);
  tri('wood',P(outer[0],e,0),P(u,h,0),P(u,h,faceSide),[0,-1,0],.53);
 }
 for(const a of windows){
  const {u,w,y,h,group}=a,d=.244,wallV=zoneDepth(u);
  const open=rect(u,w,y,h),inner=rect(u,w-.071,y+.031,h-.063);
  reveal({outline:open,v:wallV,depth:d,nested:inner});
  const outerL=u-w/2,outerR=u+w/2,frame=.063;
  const s0=wallV+d-.055,s1=wallV+d-.003;
  block('wood',[outerL+.032,y+.023,s0],[outerL+.033+frame,y+h-.017,s1],.96);
  block('wood',[outerR-.032-frame,y+.023,s0],[outerR-.031,y+h-.017,s1],.96);
  for(const [t,thick] of [[.041,.062],[h*.51,.080],[h-.080,.057]]){
   block('wood',[outerL+.07,y+t,s0],[outerR-.07,y+t+thick,s1],.83);
  }
  for(const [p0,p1,dn]of [[.099,h*.51,.8],[h*.51+.08,h-.080,1.02]]){
   const gh=p1-p0;if(gh>0)shape('glass',rect(u,w-.18,y+p0,gh),s1-.004,dn+(u>0?.065:0));
  }
  // Freestone lintel, jambs and projecting sill sit inboard of the AEB face.
  const width=group===2?.151:group===1?.116:.106,matV=wallV-.066,outer=wallV+.032;
  const paired=group===3||group===4,wl=paired&&u>0?.055:width,wr=paired&&u<0?.055:width;
  if(!paired)block('trim',[outerL-width,y-.102,matV],[outerR+width,y+.008,outer],.86);
  block('trim',[outerL-wl,y+.011,matV+.010],[outerL,y+h+.07,outer],.92);
  block('trim',[outerR,y+.011,matV+.010],[outerR+wr,y+h+.07,outer],.935);
  if(group===2)for(const k of [-1,1]){
   const x=k===-1?outerL:outerR;
   const ll=k<0?x-width-.064:x,rr=k<0?x:x+width+.067;
   block('trim',[ll,y+h+.028,matV],[rr,y+h+.161,outer],.98);
  }
  if(!paired)block('trim',[outerL-width-.019,y+h+.01,matV],[outerR+width+.018,y+h+.120,outer],.97);
 }
 // Shared beam/sill details of the documented three-light lower and paired upper banks.
 for(const [a,b,wid] of [[16.51,.19,2.99],[14.342,.078,2.94],[20.63,.155,1.88],[18.304,.094,1.89],[24.890,.106,1.381],[23.698,.087,1.381]]){
  if(!hero&&a>23.0)continue;
  block('trim',[-wid/2,a,faceCentre-.056],[wid/2,a+b,faceCentre+.032],a===16.51?1.015:.94);
 }
 for(const a of arches){
  const {u,w,y,spring}=a,rad=w/2,wallV=zoneDepth(u),sV=wallV-.071,backdoor=wallV+.363,op=round(u,w,y,spring),inset=round(u,w-.081,y+.018,spring-.018);
  reveal({outline:op,v:wallV,depth:.363,nested:inset});
  // Individual shaped three-dimensional voussoirs, not a mask pasted to stone.
  const segments=15,fv=sV,back=wallV+.035;
  for(let j=0;j<segments;j++){
   const t0=j*Math.PI/segments+.005,t1=(j+1)*Math.PI/segments-.005;
   const tM=(t0+t1)/2.,rr=rad+.306+(j===7?.091:.022*Math.sin(j*4.1)),ri=rad-.008;
   const pos=(r:number,t:number):P2=>[u+r*Math.cos(t),spring+r*Math.sin(t)];
   const band=[pos(ri+.007,t0),pos(rr-.003,t0+.004),pos(rr,tM),pos(rr-.003,t1-.004),pos(ri+.007,t1),pos(ri,tM)];
   const variety=.89+.13*shade(j*1.171+u);shape('trim',band,fv,variety);
   for(let i=0;i<band.length;i++){
    const p=band[i],q=band[(i+1)%band.length];
    const n:P3=[q[1]-p[1],p[0]-q[0],0];
    quad('trim',front(fv)(p),front(back)(p),front(back)(q),front(fv)(q),n,.83*variety);
   }
  }
  // Buff surround lower blocks separate around door, inboard of eave area.
  const steps=8,si=(spring-y)/steps;
  for(let j=0;j<steps;j++)for(const s of [-1,1]){
   const w0=.276+.028*Math.sin(.31+j*3.02),mid=u+s*(rad+w0/2+.005);
   block('trim',[mid-w0/2,y+j*si+.009,sV+.008],[mid+w0/2,y+(j+1)*si-.007,wallV+.048],.84+.13*shade(j*.4+u+s));
  }
  const fv2=backdoor-.088;
  const w1=w-.238;
  shape('glass',round(u,w-.162,spring-.067,spring-.035,30),fv2,1.08);
  shape('glass',rect(u,w1,y+.42,spring-y-.51),fv2,.68);
  for(const s of [-1,1]){
   const x=u+s*w1/2.;block('wood',[x-.047,y+.018,fv2-.027],[x+.045,spring+.021,fv2+.037],.84);
  }
  block('wood',[u-.040,y+.05,fv2-.029],[u+.045,spring-.052,fv2+.035],.84);
  block('wood',[u-w1*.5,y+.046,fv2-.028],[u+w1*.5,y+.442,fv2+.035],.78);
  block('wood',[u-w1*.5,spring-.116,fv2-.046],[u+w1*.5,spring-.046,fv2+.035],.78);
  block('trim',[u-rad-.045,y-.071,sV+.006],[u+rad+.045,y+.018,backdoor-.02],.89);
 }
 // Railings and stairs deliberately excluded. Steps in the street photo
 // extend outside this isolated plan; the first deliverable has no access claim.
 const courseTone=(i:number)=>.91+.125*Math.sin(1+i*37.82)**2;
 for(let j=0;j<24;j++)for(const s of [-1,1]){
  const H=.376,from=wallBottom+j*H,to=from+H-.010;
  if(to>21.95)continue;
  const w=.265+.118*(j%2),corner=s*(frontLimit-.009);
  block('trim', [s<0?corner:corner-w,from,faceSide-.053], [s<0?corner+w:corner,to,faceSide+.016], courseTone(j));
 }
 for(const [atY,h]of [[13.57,.14],[17.91,.122],[21.61,.098]]){
  for(const [a,b,dep]of facePlanes){
   if(atY>21.5&&dep===faceCentre)continue;
   block('trim',[a+.013,atY,dep-.051],[b-.013,atY+h,dep+.045],.83);
  }
 }
 // Dated stone and original hand-authored dark hairlines, no photo sprites.
 if(hero){
  const plaque:P2[]=[[-.418,25.133],[-.441,25.202],[-.330,25.338],[-.195,25.47],[.195,25.47],[.330,25.338],[.441,25.202],[.418,25.133]];
  shape('trim',plaque,faceCentre-.039,1.04);
  const drawStroke=(q:readonly P2[],w:number)=>{
   for(let i=1;i<q.length;i++){
    const a=q[i-1],b=q[i],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(l<1e-5)continue;
    const p=-dy*w/l/2.,r=dx*w/l/2.;
    shape('letter',[[a[0]+p,a[1]+r],[a[0]-p,a[1]-r],[b[0]-p,b[1]-r],[b[0]+p,b[1]+r]],faceCentre-.042);
   }
  };
  const sy=25.264,ss=.231;
  const glyphs=[[[.10,.58],[.38,.80],[.38,.02],[.15,.02],[.58,.02]],[[.41,.43],[.07,.48],[.03,.68],[.17,.83],[.42,.81],[.53,.62],[.45,.19],[.29,.032],[.08,.018]],[[.3,.83],[.10,.76],[.035,.45],[.08,.14],[.25,.029],[.45,.13],[.535,.48],[.44,.76],[.3,.83]],[[.50,.82],[.15,.82],[.10,.50],[.32,.54],[.49,.43],[.51,.22],[.36,.052],[.10,.045],[.06,.12]]];
  for(const [i,q]of glyphs.entries())drawStroke(q.map(([x,y])=>[-.384+i*.196+x*ss,sy+(y-.40)*ss]),.026);
  // The known facade sign is deliberately omitted rather than guessing its current exact lettering/material.
 }
 // The validated much lower rear slice is clipped through roofs, inset wall
 // heads, and the corresponding soffit. The normal B2 card is exact with
 // the rear option withdrawn. No complete room/annex reconstruction implied.
 const normalSign=area(PLAN)<0?1:-1;
 const mix=(a:P2,b:P2,t:number):P2=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const merge=(a:readonly number[],b:readonly number[])=>[...a,...b].sort((u,w)=>u-w).filter((z,p,n)=>!p||z-n[p-1]>1e-7);
 const cuts=(a:P2,b:P2)=>{const d=Math.hypot(a[0]-b[0],a[1]-b[1]);return partitions(a,b,hero).map(q=>Math.hypot(q[0]-a[0],q[1]-a[1])/d);};
 for(let i=0;i<PLAN.length;i++){
  if(i===4)continue;
  const j0=(i+1)%PLAN.length,a=PLAN[i],b=PLAN[j0],ia=wallPlan[i],ib=wallPlan[j0];
  const q=partitions(a,b,hero);
  const dir=vs(XZ(ib,DATUM)).sub(vs(XZ(ia,DATUM))).normalize(),n:P3=[normalSign*dir.z,0,-normalSign*dir.x];
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const offsetY=(ix:number)=>ix===4||ix===5?sampleFront(wallPlan[ix][0])-sampleFront(PLAN[ix][0]):0.;
  const evaluateEdge=(p:P2)=>{
   const f=Math.hypot(p[0]-a[0],p[1]-a[1])/d;
   const inner=mix(ia,ib,f),rim=roofAt(p,hero)-.164,head=rim+offsetY(i)*(1-f)+offsetY(j0)*f;
   return {inner, rim, head};
  };
  if(!rear){ // Exact original B2 coordinates and draw ordering in neutral mode.
   for(let j=1;j<q.length;j++){
    const p=q[j-1],z=q[j],x=evaluateEdge(p),y=evaluateEdge(z);
    const timber=i<2&&.5*(x.head+y.head)<20.8;
    quad(timber?'wood':'wall',XZ(x.inner,13.32),XZ(y.inner,13.32),XZ(y.inner,y.head),XZ(x.inner,x.head),n,.92);
    quad('foundation',XZ(x.inner,wallBottom),XZ(y.inner,wallBottom),XZ(y.inner,13.32),XZ(x.inner,13.32),n,.78);
    quad('wood',XZ(p,x.rim),XZ(z,y.rim),XZ(y.inner,y.head),XZ(x.inner,x.head),[0,-1,0],.60);
   }
   continue;
  }
  // Complementary lower roof sections use actual intersections with the
  // original halo and independently with the inset body. No radial XZ shift.
  const original=cuts(a,b),innerTs=merge(original,cutParameters(ia,ib));
  for(let j=1;j<innerTs.length;j++){
   const t=innerTs[j-1],s=innerTs[j],p=mix(a,b,t),q=mix(a,b,s),x=evaluateEdge(p),y=evaluateEdge(q);
   const low=inCore(mix(ia,ib,(t+s)*.5)),hx=low?lowerY(x.inner)-.164:x.head,hy=low?lowerY(y.inner)-.164:y.head;
   const timber=i<2&&.5*(hx+hy)<20.8;
   quad(timber?'wood':'wall',XZ(x.inner,13.32),XZ(y.inner,13.32),XZ(y.inner,hy),XZ(x.inner,hx),n,.92);
   quad('foundation',XZ(x.inner,wallBottom),XZ(y.inner,wallBottom),XZ(y.inner,13.32),XZ(x.inner,13.32),n,.78);
  }
  for(let j=1;j<q.length;j++){
   const p=q[j-1],r=q[j],x=evaluateEdge(p),y=evaluateEdge(r);
   const P:Sample[]=[[...p,x.rim],[...r,y.rim],[...y.inner,y.head],[...x.inner,x.head]];
   for(const A of [[P[0],P[1],P[2]],[P[0],P[2],P[3]]])for(const {q,low} of clipCore(A,rear)){
    const v=q.map(([u,v,y])=>XZ([u,v],low?lowerY([u,v])-.164:y));
    for(let k=1;k<v.length-1;k++)tri('wood',v[0],v[k],v[k+1],[0,-1,0],.60);
   }
  }
 }
 // Exact external connected perimeter; new vertical joins below are smooth
 // plane intersections, not polygon render offsets or terrain fills.
 for(let i=0;i<PLAN.length;i++){
  const a=PLAN[i],b=PLAN[(i+1)%PLAN.length],q=partitions(a,b,hero);
  const T0=vs(XZ(b,DATUM)).sub(vs(XZ(a,DATUM))).normalize(),n:P3=[normalSign*T0.z,0,-normalSign*T0.x];
  if(!rear||i===4){
   for(let j=1;j<q.length;j++){
    const p=q[j-1],z=q[j],y0=roofAt(p,hero),y1=roofAt(z,hero),w=.164;
    quad('wood',XZ(p,y0-w),XZ(z,y1-w),XZ(z,y1+.004),XZ(p,y0+.004),n,.68);
   }
   continue;
  }
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]),tt=merge(q.map(p=>Math.hypot(p[0]-a[0],p[1]-a[1])/d),cutParameters(a,b));
  for(let j=1;j<tt.length;j++){
   const p=mix(a,b,tt[j-1]),z=mix(a,b,tt[j]),low=inCore(mix(a,b,(tt[j-1]+tt[j])*.5));
   const y0=low?lowerY(p):roofAt(p,hero),y1=low?lowerY(z):roofAt(z,hero),w=.164;
   quad('wood',XZ(p,y0-w),XZ(z,y1-w),XZ(z,y1+.004),XZ(p,y0+.004),n,.68);
  }
 }
 if(rear)for(const {a,b,normal} of coreJoints()){
  const p=partitions(a,b,hero);
  for(let i=1;i<p.length;i++){
   const l=p[i-1],m=p[i],h=roofAt(l,hero),k=roofAt(m,hero);
   quad('wood',XZ(l,lowerY(l)-.164),XZ(m,lowerY(m)-.164),XZ(m,k),XZ(l,h),normal,.94);
  }
 }
 // Restrained original dark wooden eave brackets, outside the photo-fit bank
 // but at a true measured height and never beyond the conservative plan.
 for(const s of [-1,1])for(let i=0;i<4;i++){
  const x=s*(2.43+i*.498),y=sampleFront(x);
  block('wood',[x-.086,y-.282,.168],[x+.087,y+.006,faceSide+.019],.65);
  const q:P2[]=[[x-.073,y-.275],[x+.074,y-.275],[x+.063,y-.058],[x-.061,y-.058]];
  shape('wood',q,.153,.82);
 }
 const roof=roofCells(withPositiveNormals(PLAN),hero);let lowerTris=0;
 for(const {q,plane} of roof){
  const d=ALL[plane],r:Role=plane===0||plane===6?'roofCrown':'roofSide';
  const uv=(p:P3):P2=>(Math.abs(d[1])>Math.abs(d[2])+.2?[-p[2],p[0]*Math.sqrt(1+d[1]*d[1])]:[p[0],-p[2]*Math.sqrt(1+d[2]*d[2])]);
  if(!rear){
   for(let j=1;j<q.length-1;j++){
    const xyz=[q[0],q[j],q[j+1]].map(p=>XZ(p,at(d,p))) as [P3,P3,P3];
    tri(r,...xyz,UP,.92,uv);
    if(plane>=7)isolatedPhotoGableTris++;else exactRoofTris++;
   }
   continue;
  }
  for(const {q:p,low} of clipCore(q.map(t=>[...t,at(d,t)]),rear)){
   for(let i=1;i<p.length-1;i++){
    const a=[p[0],p[i],p[i+1]].map(([u,v,y])=>XZ([u,v],low?lowerY([u,v]):y)) as [P3,P3,P3];
    // The low compartment is ONE surveyed plane: shared edge phases must not
    // inherit the piecewise tangent basis of the former higher roof faces.
    const lowUv=(point:P3):P2=>[point[0],-point[2]];
    tri(low?'roofCrown':r,...a,UP,.92,low?lowUv:uv);
    if(low)lowerTris++;else if(plane>=7)isolatedPhotoGableTris++;else exactRoofTris++;
   }
  }
 }
 const group=new T.Group();group.name='Souris Town Hall detached C, supported lower rear core';
 for(const [r,b]of data){
  if(!b.pos.length)continue;
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(b.col,3));geo.computeVertexNormals();geo.computeBoundingSphere();
  const m=new T.Mesh(geo,mat.get(r));m.name=r;m.castShadow=r!=='glass';m.receiveShadow=true;group.add(m);
 }
 group.userData={reviewOnly:true,sourceGrid:'2020 NRCan CGVD2013',planOwner:'q130331/72',floorDatum:DATUM,mainRoofTriangleCount:exactRoofTris,authoredGableTriangleCount:isolatedPhotoGableTris,lowerTris,lowerCore:rear?CORE_OUTLINE:undefined,
   exactFrontOpeningCount:holes.length,wallFaceDepths:[faceCentre,faceSide],nominalAtticSill:23.785,frontWallRange:[frontL,frontR],centralBayU:[-mid,mid],wallOutline:wallPlan,physicalStairs:false,unknownHighEastFeature:'held; measured, role/location not claimed',
   layerLimits:'no original photographs, no live surface or game asset; threshold and rear join extent remain authored; high-east cap held'};
 return group;
}
