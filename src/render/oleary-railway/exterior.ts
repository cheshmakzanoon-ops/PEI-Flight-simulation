import * as T from 'three';
import {regularRoadGround} from '../road-contact.ts';
import type {Terrain} from '../../sim/terrain.ts';
import {olearyFinish,type OlearyFinish} from './finish.ts';

type Point=[u:number,y:number,v:number];
type UV=[s:number,t:number];
type Basis={point:(along:number,y:number,out?:number)=>Point;normal:UV};
export const OLEARY_FRAME={
 // Stock footprint planar centroid and the mean axes of its opposing long
 // edges. All other coordinates below are original documentary art, not an
 // as-built dimension, site survey, physical datum, or traced photograph.
 origin:[-78729.85614635695,-23078.19701513572],
 u:[.7912953278002122,-.6114341372556452],v:[.6114341372556452,.7912953278002122]
} as const;
function planar(u:number,v:number):UV{const q=OLEARY_FRAME;return[u*q.u[0]+v*q.v[0],u*q.u[1]+v*q.v[1]];}
const timber=0xc8c3a7,light=0xd8d3bc,trim=0xb4b69e,green=0x40493e,recess=0x343d35,
 deck=0x8d8070,foundation=0x929197,root=0x7d7975,roof=0x914b40,glass=0x536668;
const msk:readonly OlearyFinish[]=['foundation','clapboard','timber','roof','glazing'];
const color=new Map<number,T.Color>();
const winding=(a:Point,b:Point,c:Point)=>[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
 (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
type Lane={positions:number[];colors:number[];uv:number[]};
const empty=():Lane=>({positions:[],colors:[],uv:[]});
class Kit{
 readonly parts:Record<OlearyFinish,Lane>={foundation:empty(),clapboard:empty(),timber:empty(),roof:empty(),glazing:empty()};
 at(m:OlearyFinish){return this.parts[m].positions.length/9;}
 tri(m:OlearyFinish,a:Point,b:Point,c:Point,n:number,uv?:[UV,UV,UV]){
  const lane=this.parts[m];let rgb=color.get(n);if(!rgb){rgb=new T.Color(n);color.set(n,rgb);}
  for(const [i,p]of[a,b,c].entries()){const q=planar(p[0],p[2]);lane.positions.push(q[0],p[1],q[1]);lane.colors.push(rgb.r,rgb.g,rgb.b);lane.uv.push(...(uv?.[i]??[p[0],p[2]]));}
 }
 quad(m:OlearyFinish,a:Point,b:Point,c:Point,d:Point,n:number,uv?:[UV,UV,UV,UV]){
  this.tri(m,a,b,c,n,uv&&[uv[0],uv[1],uv[2]]);this.tri(m,a,c,d,n,uv&&[uv[0],uv[2],uv[3]]);
 }
 plate(m:OlearyFinish,b:Basis,l:number,r:number,lo:number,hi:number,n:number,shift=0){
  if(r-l<1.e-7||hi-lo<1.e-7)return;
  const uv:[UV,UV,UV,UV]=[[l,lo],[r,lo],[r,hi],[l,hi]];
  const [A,B,C,D]=uv.map(([s,t])=>b.point(s,t,shift)),[nx,,nz]=winding(A,B,C);
  if(nx*b.normal[0]+nz*b.normal[1]>=0)this.quad(m,A,B,C,D,n,uv);
  else this.quad(m,A,D,C,B,n,[uv[0],uv[3],uv[2],uv[1]]);
 }
 facingUp(m:OlearyFinish,p:[Point,Point,Point]|[Point,Point,Point,Point],t:number,uv?:UV[]){
  const ordered=winding(p[0],p[1],p[2])[1]>0?p.map((_,i)=>i):[0,...p.slice(1).map((_,i)=>p.length-1-i)];
  const [A,B,C,D]=ordered.map(i=>p[i]),[a,b,c,d]=ordered.map(i=>uv?.[i]);
  if(p.length===3)this.tri(m,A,B,C,t,a&&b&&c?[a,b,c]:undefined);
  else this.quad(m,A,B,C,D,t,a&&b&&c&&d?[a,b,c,d]:undefined);
 }
 box(m:OlearyFinish,x0:number,x1:number,z0:number,z1:number,y0:number,y1:number,n:number){
  const a:Point=[x0,y0,z0],b:Point=[x1,y0,z0],c:Point=[x1,y0,z1],d:Point=[x0,y0,z1],
    A:Point=[x0,y1,z0],B:Point=[x1,y1,z0],C:Point=[x1,y1,z1],D:Point=[x0,y1,z1];
  this.quad(m,a,A,B,b,n,[[x0,y0],[x0,y1],[x1,y1],[x1,y0]]);
  this.quad(m,b,B,C,c,n,[[z0,y0],[z0,y1],[z1,y1],[z1,y0]]);
  this.quad(m,c,C,D,d,n,[[x1,y0],[x1,y1],[x0,y1],[x0,y0]]);
  this.quad(m,d,D,A,a,n,[[z1,y0],[z1,y1],[z0,y1],[z0,y0]]);
  this.quad(m,A,D,C,B,n);this.quad(m,a,b,c,d,n);
 }
 timber(a:Point,b:Point,n:UV,width:number,thick:number,tint=timber){
  const A=new T.Vector3(...a),B=new T.Vector3(...b),D=B.clone().sub(A);
  if(D.lengthSq()<1e-9)return;D.normalize();
  const axis=new T.Vector3(n[0],0,n[1]),J=new T.Vector3().crossVectors(D,axis);
  if(J.lengthSq()<.05)axis.set(-n[1],0,n[0]);
  J.crossVectors(D,axis).normalize().multiplyScalar(width*.5);
  const K=new T.Vector3().crossVectors(D,J).normalize().multiplyScalar(thick*.5);
  const corner=(s:T.Vector3,i:number):Point=>s.clone().addScaledVector(J,i===0||i===3?1:-1).addScaledVector(K,i<2?1:-1).toArray() as Point;
  for(let k=0;k<4;k++){const i=(k+1)%4;this.quad('timber',corner(A,k),corner(A,i),corner(B,i),corner(B,k),tint);}
  this.quad('timber',corner(A,0),corner(A,3),corner(A,2),corner(A,1),tint);
  this.quad('timber',corner(B,0),corner(B,1),corner(B,2),corner(B,3),tint);
 }
 finish(group:T.Group){
  for(const m of msk){const lane=this.parts[m],g=new T.BufferGeometry();
   g.setAttribute('position',new T.Float32BufferAttribute(lane.positions,3));g.setAttribute('color',new T.Float32BufferAttribute(lane.colors,3));
   g.setAttribute('uv',new T.Float32BufferAttribute(lane.uv,2));g.computeVertexNormals();g.computeBoundingSphere();
   const material=olearyFinish(m),q=new T.Mesh(g,material);q.name=material.name;group.add(q);
  }
 }
}
const face=(axis:'u'|'v',value:number,dir:-1|1):Basis=>axis==='u'?{point:(s,y,d=0)=>[value+dir*d,y,s],normal:[dir,0]}:
 {point:(s,y,d=0)=>[s,y,value+dir*d],normal:[0,dir]};
type Opening={x:number;w:number;bottom:number;top:number;kind:'sash'|'entry'|'freight'|'passage';two?:boolean};
const sash=(x:number,w=1.05,bottom=1.54,top=3.09,two=false):Opening=>({x,w,bottom,top,kind:'sash',two});
const entry=(x:number,w=1.04,bottom=.78,top=3.04):Opening=>({x,w,bottom,top,kind:'entry'});
type Support={role:string;lane:OlearyFinish;lower:number[];optionalUpperNosing?:number[];feature?:string};
const floorOfDeck=.79,eave=3.86;
export function makeOlearyExterior(terrain:Terrain){
 const a=new Kit(),g=new T.Group(),floor=regularRoadGround(terrain),O=OLEARY_FRAME.origin,H=floor(...O);
 if(!Number.isFinite(H))throw Error('Incompatible station game grade');
 const supports:Support[]=[],features:{role:string;parts:Partial<Record<OlearyFinish,[number,number]>>}[]=[];
 g.position.set(O[0],H,O[1]);g.name='O’Leary Railway Station · original documentary exterior';
 const take=(role:string,doit:()=>void)=>{
  const starts=msk.map(k=>a.at(k));doit();const parts:Partial<Record<OlearyFinish,[number,number]>>={};
  msk.forEach((k,i)=>{const n=a.at(k)-starts[i];if(n)parts[k]=[starts[i],n];});features.push({role,parts});
 };
 const h=(p:Point)=>{const [x,z]=planar(p[0],p[2]),d=floor(O[0]+x,O[1]+z)-H;if(!Number.isFinite(d)||Math.abs(d)>1)throw Error('Unproven local N112 surface');return d;};
 function seat(b:Basis,l:number,r:number,cap:number,tint=foundation,role='main foundation',lane:OlearyFinish='foundation'){
  const q=b.point(l,0),z=b.point(r,0),A=b.point(l,h(q)-.075),B=b.point(r,h(z)-.075),C=b.point(r,cap),D=b.point(l,cap),k=a.at(lane)*3;
  const [nx,,nz]=winding(A,D,C),forward=nx*b.normal[0]+nz*b.normal[1]>0;
  if(forward)a.quad(lane,A,D,C,B,tint,[[l,A[1]],[l,cap],[r,cap],[r,B[1]]]);
  else a.quad(lane,A,B,C,D,tint,[[l,A[1]],[r,B[1]],[r,cap],[l,cap]]);
  supports.push({role,lane,lower:[k,k+(forward?5:1)]});
 }
 const member=(b:Basis,s:number,y:number,t:number,z:number,w:number,tint=timber,shift=.025,depth=.065)=>a.timber(b.point(s,y,shift),b.point(t,z,shift),b.normal,w,depth,tint);
 function aperture(b:Basis,w:Opening){
  const l=w.x-w.w*.5,r=w.x+w.w*.5,lo=w.bottom,hi=w.top,depth=.118;
  if(w.kind==='passage')return;
  a.quad('timber',b.point(l,lo),b.point(l,hi),b.point(l,hi,-depth),b.point(l,lo,-depth),trim);
  a.quad('timber',b.point(r,lo,-depth),b.point(r,hi,-depth),b.point(r,hi),b.point(r,lo),trim);
  a.quad('timber',b.point(l,hi),b.point(r,hi),b.point(r,hi,-depth),b.point(l,hi,-depth),0x999985);
  a.quad('timber',b.point(l,lo,-depth),b.point(r,lo,-depth),b.point(r,lo),b.point(l,lo),light);
  for(const s of[l-.037,r+.037])member(b,s,lo-.022,s,hi+.039,.071,light,.025,.092);
  member(b,l-.072,hi+.035,r+.073,hi+.035,.089,light,.053,.125);
  member(b,l-.065,lo-.038,r+.068,lo-.038,.079,w.kind==='sash'?light:trim,.06,.151);
  if(w.kind==='sash'){
   const cross=lo+(hi-lo)*.48;
   a.plate('glazing',b,l,r,lo,hi,glass,-depth);
   a.plate('glazing',b,l+.047,r-.047,cross+.039,hi-.058,0x617371,-depth+.010);
   member(b,l,lo+.019,r,lo+.019,.057,trim,-.092,.043);member(b,l,cross,r,cross,.062,light,-.087,.045);
   if(w.two)member(b,w.x,lo,w.x,hi,.077,light,-.07,.069);
   else member(b,w.x,cross+.028,w.x,hi,.026,trim,-.086,.034);
   return;
  }
  const leaf=(A:number,B:number,freight:boolean)=>{
   a.plate('timber',b,A,B,lo+.011,hi-.013,freight?0x51473b:0x474b40,-depth);
   const rail=lo+(hi-lo)*.61;
   for(const s of[A+.034,B-.034])member(b,s,lo+.028,s,hi-.033,.069,freight?0x8d8270:0x697263,-depth+.042,.038);
   member(b,A,rail,B,rail,.091,freight?0x8a8170:trim,-depth+.044,.047);
   a.plate('glazing',b,A+.116,B-.116,rail+.08,hi-.15,glass,-depth+.013);
   a.plate('timber',b,A+.112,B-.112,lo+.132,rail-.105,freight?0x6d604e:0x606454,-depth+.012);
   if(freight)member(b,A+.1,lo+.13,B-.1,rail-.13,.061,0x958b78,-depth+.037,.037);
  };
  if(w.kind==='freight'){leaf(l,w.x-.017,true);leaf(w.x+.017,r,true);member(b,w.x,lo,w.x,hi,.047,trim,-depth+.042,.05);}
  else{leaf(l,r,false);member(b,r-.21,lo+.85,r-.21,lo+1.02,.032,0x9b8d70,-depth+.074,.034);}
 }
 function wall(b:Basis,l:number,r:number,lo:number,hi:number,windows:Opening[],tint=green){
  const ofs=windows.flatMap(w=>[w.x-w.w/2,w.x+w.w/2]).filter(v=>v>l&&v<r),breaks=windows.flatMap(w=>[w.bottom,w.top]).filter(v=>v>lo&&v<hi);
  const x=[...new Set([l,...ofs,r])].sort((l,r)=>l-r),y=[...new Set([lo,...breaks,hi])].sort((l,r)=>l-r);
  for(let i=1;i<x.length;i++)for(let j=1;j<y.length;j++){
   const cx=(x[i]+x[i-1])*.5,cy=(y[j]+y[j-1])*.5;
   if(!windows.some(v=>Math.abs(cx-v.x)<v.w*.5&&cy>v.bottom&&cy<v.top))a.plate('clapboard',b,x[i-1],x[i],y[j-1],y[j],tint);
  }
  for(const w of windows)aperture(b,w);
 }
 const hp=(u:number,y:number,v:number):Point=>[u,y,v];
 const shell={west:-3.18,east:3.11,north:-6.47,south:7.00,lower:.79,cap:3.82};
 const faces={w:face('u',shell.west,-1),e:face('u',shell.east,1),n:face('v',shell.north,-1),s:face('v',shell.south,1)};
 take('main body and documented west paired freight entry',()=>{
  for(const [b,l,r,role] of[[faces.w,shell.north,shell.south,'west stem'],[faces.e,shell.north,shell.south,'east stem'],
     [faces.n,shell.west,shell.east,'north stem'],[faces.s,shell.west,shell.east,'south stem']] as const)seat(b,l,r,shell.lower,foundation,role);
  wall(faces.w,shell.north,shell.south,shell.lower,shell.cap,[sash(-4.92),entry(-2.73),sash(-.65),sash(1.53),
   {x:4.40,w:2.29,bottom:.795,top:3.06,kind:'freight'}],green);
  wall(faces.e,shell.north,shell.south,shell.lower,shell.cap,[sash(-5.13,.96),{x:-1.73,w:2.52,bottom:shell.lower,top:3.28,kind:'passage'},
   sash(1.47,.98),entry(3.60,1.11),sash(5.56,1.14,1.53,3.08,true)],0x424c40);
  wall(faces.n,shell.west,shell.east,shell.lower,shell.cap,[sash(-2.20,.96),
   {x:.34,w:2.04,bottom:shell.lower,top:2.48,kind:'passage'},sash(2.17,.98)],0x40483c);
  wall(faces.s,shell.west,shell.east,shell.lower,shell.cap,[sash(-1.76,1.07),entry(.06,1.14),sash(1.95,1.20,1.58,3.08,true)],0x444d41);
  for(const b of[faces.w,faces.e])for(const y of[.868,3.49])member(b,shell.north,y,shell.south,y,y<1?.087:.123,trim,.055,.101);
  for(const b of[faces.s,faces.n])for(const y of[.87,3.49])member(b,shell.west,y,shell.east,y,y<1?.09:.13,trim,.052,.102);
  for(const u of[shell.west+.012,shell.east-.012])for(const v of[shell.north+.011,shell.south-.011])
   a.box('timber',u-.063,u+.063,v-.062,v+.062,.81,3.79,trim);
 });
 const RW=4.996,N=-9.18,S=9.216,Y=6.77,RN=-4.18,RS=4.22;
 take('true shelter roof: four joined hip planes, eave board and separate continuous soffit',()=>{
  const A:Point=[-RW,eave,N],B:Point=[RW,eave,N],C:Point=[RW,eave,S],D:Point=[-RW,eave,S],L:Point=[.018,Y,RN],R:Point=[.018,Y,RS];
  const surface=(p:[Point,Point,Point]|[Point,Point,Point,Point],q:readonly number[],ridgeTint:number)=>{
   const uv=p.map((x):UV=>[x[q[0]],x[q[1]]+(x[1]-eave)*.40]);
   a.facingUp('roof',p,ridgeTint,uv);
  };
  surface([A,B,L],[0,2],0x925044);surface([B,C,R,L],[2,0],0x934b40);
  surface([C,D,R],[0,2],0x8e493e);surface([D,A,L,R],[2,0],roof);
  for(const [p,q]of[[A,B],[B,C],[C,D],[D,A]]){
   const pp=hp(p[0],eave-.147,p[2]),qq=hp(q[0],eave-.147,q[2]);a.quad('timber',p,q,qq,pp,light);
  }
  a.quad('timber',hp(-RW,3.712,N),hp(RW,3.712,N),hp(RW,3.712,S),hp(-RW,3.712,S),0xabaa93);
  // A shallow joined ridge and timbers held clear of the signed outer hem.
  a.timber([.018,6.772,RN+.02],[.018,6.772,RS-.02],[1,0],.081,.112,0x82493d);
 });
 take('small single documented rooftop stack silhouette',()=>{
  a.box('foundation',-.53,.04,-3.98,-3.41,6.42,7.54,0x806359);
  for(let i=1;i<=8;i++){const y=6.43+i*.125;a.box('foundation',-.533,.043,-3.983,-3.407,y-.006,y+.006,0x9c8675);}
  a.box('foundation',-.61,.13,-4.06,-3.33,7.47,7.62,0x725d51);
  a.box('foundation',-.47,-.01,-3.93,-3.47,7.6201,7.648,0x4b443f);
 });
 take('east station-agent office: physical square projection, actual returned window recesses',()=>{
  const f=face('u',4.011,1),v0=-2.99,v1=-.47;
  seat(f,v0,v1,.82,foundation,'east bay foundation');
  for(const [s,n]of[[v0,-1],[v1,1]] as const){const p=face('v',s,n);seat(p,3.11,4.01,.82,foundation,'east bay cheek');
   wall(p,3.111,4.011,.82,3.44,[sash(3.60,.48,1.62,3.05)],0x434e42);}
  wall(f,v0,v1,.82,3.44,[sash(-1.73,1.74,1.58,3.13,true)],0x485448);
  for(const s of[v0+.055,v1-.055])member(f,s,.84,s,3.43,.117,trim,.035,.124);
  member(f,v0,3.44,v1,3.44,.112,trim,.06,.129);member(f,v0,.87,v1,.87,.073,trim,.065,.107);
  a.box('timber',3.08,4.078,v0-.076,v1+.076,3.42,3.53,0xaca790);
 });
 take('north separate low projection and authentic subordinate reddish weather cap family',()=>{
  const l=-.68,r=1.36,back=-6.47,front=-8.18,c=face('v',front,-1);
  seat(c,l,r,.76,foundation,'north projection face');
  for(const [u,n]of[[l,-1],[r,1]]as const){const b=face('u',u,n);seat(b,front,back,.76,foundation,'north projection return');wall(b,front,back,.76,2.56,[],0x465044);}
  wall(c,l,r,.76,2.56,[],0x4e5548);
  for(const y of[.82,1.43,2.37])member(c,l,y,r,y,.086,trim,.05,.102);
  for(const u of[l+.04,r-.04])member(c,u,.85,u,2.5,.087,light,.037,.09);
  const T=hp(l-.135,2.58,front-.14),U=hp(r+.14,2.58,front-.14),A=hp(l-.09,2.66,back+.01),B=hp(r+.09,2.66,back+.01),
   K=hp(l+.39,2.96,back+.03),M=hp(r-.39,2.96,back+.03);
  a.facingUp('roof',[T,A,K],0x88493e);a.facingUp('roof',[T,U,M,K],0x8b4b40);a.facingUp('roof',[U,M,B],0x864539);
  const q=face('v',front-.13,-1);member(q,l-.128,2.54,r+.128,2.54,.082,trim,0,.12);
 });
 type Brace={b:Basis;s:number;reach:number;drop:number;color?:number};
 function bracket({b,s,reach,drop,color:t=timber}:Brace){
  const f=b.point(s,3.71,reach),wall=b.point(s,3.71,.036),low=b.point(s,3.72-drop,.039);
  // Every diagonal contributes simultaneous wall- and soffit-contacting
  // geometry; a non-structural window surround never substitutes for a brace.
  a.timber(wall,f,b.normal,.135,.11,t);a.timber(low,wall,b.normal,.116,.107,t);a.timber(low,f,b.normal,.115,.097,t);
  a.timber(b.point(s,3.748,reach-.19),b.point(s,3.748,reach+.16),b.normal,.14,.15,trim);
 }
 take('individual deep timber bracket triangles under the unbroken hip eaves',()=>{
  for(const s of[-5.94,-3.91,-1.66,.46,2.71,6.20])bracket({b:faces.w,s,reach:1.53,drop:1.06});
  for(const s of[-6.09,-3.75,.45,2.33,4.74,6.26])bracket({b:faces.e,s,reach:1.57,drop:1.09});
  for(const s of[-2.58,-1.16,1.88,2.75])bracket({b:faces.n,s,reach:2.30,drop:1.22,color:light});
  for(const s of[-2.67,-.88,1.14,2.61])bracket({b:faces.s,s,reach:1.91,drop:1.09});
 });
 function deckRun(u0:number,u1:number,v0:number,v1:number,direction:'u'|'v'){
  const s0=direction==='u'?u0:v0,s1=direction==='u'?u1:v1,l=direction==='u'?v0:u0,r=direction==='u'?v1:u1;
  const count=Math.ceil((s1-s0)/.158),dx=(s1-s0)/count;
  const p=(s:number,k:number):Point=>direction==='u'?[s,floorOfDeck,k]:[k,floorOfDeck,s];
  for(let j=0;j<count;j++){const e=s0+j*dx,z=s0+(j+1)*dx,t=(j*17+j*j*3)%7,shade=[0x8b7f6d,0x918573,0x8e8271,0x8c8171,0x918673,0x8a8070,0x8b8370][t];
   a.facingUp('timber',[p(e+.004,l),p(z-.004,l),p(z-.004,r),p(e+.004,r)],shade,[[0,l],[dx,l],[dx,r],[0,r]]);
  }
  // A continuous closed underside below the tiny plank gaps, not stacked top surfaces.
  a.quad('timber',hp(u0,.762,v0),hp(u1,.762,v0),hp(u1,.762,v1),hp(u0,.762,v1),0x665e54);
 }
 function railing(axis:'u'|'v',value:number,from:number,to:number,dir:-1|1){
  const b=face(axis,value,dir),n=Math.ceil((to-from)/.197),top=1.60,base=.84;
  for(let i=0;i<=n;i++){const s=from+(to-from)*i/n,w=i===0||i===n||i%11===0?.092:.043;
   member(b,s,base+.043,s,top-.049,w,i%7===1?timber:light,0,w*.82);}
  member(b,from,top,to,top,.102,light,0,.128);member(b,from,base+.075,to,base+.075,.072,trim,0,.081);
 }
 const left=-4.79,right=4.71,south=8.93,north=-7.08,join=7.00,partEast=3.33;
 take('real raised partial deck: west, south and only part of east',()=>{
  deckRun(left,-3.18,north,join,'v');deckRun(left,right,join,south,'u');deckRun(3.11,right,partEast,join,'v');
  const west=face('u',left,-1),east=face('u',right,1),base=face('v',south,1),stop=face('v',partEast,-1);
  seat(west,north,south,.76,0xa69b83,'west raised deck skirt');
  seat(east,partEast,south,.76,0xa29780,'partial east raised deck skirt');
  seat(base,left,right,.76,0xa2967e,'south raised deck skirt');
  seat(stop,3.11,right,.76,0xa19680,'partial east deck finishes before office bay');
  for(const [b,l,r]of[[west,north,south],[east,partEast,south],[base,left,right],[stop,3.11,right]]as const)
   member(b,l,.746,r,.746,.087,deck,0,.047);
  railing('u',left+.07,north+.078,south-.07,-1);
  railing('v',south-.07,left+.118,right-.097,1);
  railing('u',right-.07,partEast+.075,south-.120,1);
  railing('v',partEast+.065,3.227,right-.122,-1);
 });
 take('five rooted west-end visual entry treads; illustrative not a count survey',()=>{
  const U0=left+.04,U1=-3.21,S0=-8.61,S1=north,steps=5;
  const fallback=Math.min(h(hp(U0,0,S0)),h(hp(U1,0,S0)))+.17;
  for(let i=0;i<steps;i++){
   const z=S0+(S1-S0)*i/steps,next=S0+(S1-S0)*(i+1)/steps,y=fallback+(floorOfDeck-fallback)*i/(steps-1),fr=face('v',z,-1);
   seat(fr,U0,U1,y,foundation,'stair riser '+i);
   const k=a.at('timber')*3;
   a.facingUp('timber',[hp(U0,y,z),hp(U1,y,z),hp(U1,y,next),hp(U0,y,next)],deck);
   supports.push({role:'stair tread height '+i,lane:'timber',lower:[],optionalUpperNosing:[k,k+5]});
   for(const [u,d]of[[U0,-1],[U1,1]]as const)seat(face('u',u,d),z,next,y,root,'stair cheek '+i);
  }
  // No handrails beyond the verified envelope. Original access path is not changed.
 });
 a.finish(g);
 g.userData.olearyProof={soleRow:'q20213/431',sourceDimensions:'Original documentary game model; not as-built or geodetic dimensions.',inputs:['Register 20441 / 2013 C. Stewart east-north and west','2017 Larry observation, CC BY 2.0'],supports,features,
  hippedRoofUV:[[-RW,N],[RW,N],[RW,S],[-RW,S]],roofRidge:[hp(.018,Y,RN),hp(.018,Y,RS)],ownedMaterialOrder:msk};
 return {group:g,dispose(){for(const q of g.children){const m=q as T.Mesh<T.BufferGeometry,T.Material>;m.geometry.dispose();m.material.dispose();}g.removeFromParent();}};
}
