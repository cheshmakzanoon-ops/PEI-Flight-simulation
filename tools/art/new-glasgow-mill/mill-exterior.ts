import * as T from 'three';
type P = readonly [number,number,number];
type U = readonly [number,number];
type Cut = Readonly<{l:number;r:number;b:number;t:number}>;
const join=(a:P,b:P,s:number):P=>[a[0]+s*(b[0]-a[0]),a[1]+s*(b[1]-a[1]),a[2]+s*(b[2]-a[2])];
const minus=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const norm=(a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add=(a:P,b:P):P=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const crop=(l:number,r:number,b:number,t:number):Cut=>({l,r,b,t});
const cutPlan=(a:Cut):U[]=>[[a.l,a.b],[a.r,a.b],[a.r,a.t],[a.l,a.t]];
const R={wood:0,shingleRoof:1,paint:2,joint:3,glass:4,lining:5,base:6,studio:7,shed:8} as const;
type Role=typeof R[keyof typeof R];
class Batch{
 p:number[]=[]; n:number[]=[]; uv:number[]=[]; role:number[]=[]; members:Record<string,number>={};
 face(a:P,b:P,c:P,want:P,role:Role,tag:string){
  let n=norm(minus(b,a),minus(c,a)),l=Math.hypot(...n);
  if(!(l>1e-8))throw Error('zero-area surface '+tag);
  if(dot(n,want)<0){[b,c]=[c,b];n=n.map(v=>-v) as unknown as P;}
  const N=n.map(x=>x/l) as unknown as P,plan=Math.abs(N[1])>.58;
  for(const q of [a,b,c]){
   this.p.push(...q);this.n.push(...N);this.role.push(role);
   this.uv.push(...(plan?[q[2],Math.abs(N[0])>.1?q[0]/Math.max(.4,N[1]):q[0]]:
      [Math.abs(N[0])>.55?q[2]:q[0],q[1]]));
  }
  this.members[tag]=(this.members[tag]??0)+1;
 }
 quad(a:P,b:P,c:P,d:P,n:P,r:Role,k:string){this.face(a,b,c,n,r,k);this.face(a,c,d,n,r,k);}
 panel(outer:U[],holes:U[][],to:(p:U)=>P,n:P,m:Role,key:string){
  const vec=(a:U[])=>a.map(x=>new T.Vector2(...x));
  const I=T.ShapeUtils.triangulateShape(vec(outer),holes.map(vec));
  const all=outer.concat(...holes);
  if(!I.length)throw Error('Triangulation refused '+key);
  for(const [a,b,c] of I)this.face(to(all[a]),to(all[b]),to(all[c]),n,m,key);
 }
 box(l:number,r:number,b:number,t:number,z:number,d:number,m:Role,k:string){
  if(l===r||b===t||z===d)throw Error('empty structural box');
  const a:P=[l,b,z],c:P=[r,b,d],p:P=[r,b,z],q:P=[l,b,d],
   e:P=[l,t,z],f:P=[r,t,z],u:P=[l,t,d],v:P=[r,t,d];
  this.quad(a,p,c,q,[0,-1,0],m,k);this.quad(e,u,v,f,[0,1,0],m,k);
  this.quad(a,q,u,e,[-1,0,0],m,k);this.quad(p,f,v,c,[1,0,0],m,k);
  this.quad(a,e,f,p,[0,0,-1],m,k);this.quad(q,c,v,u,[0,0,1],m,k);
 }
 geometry(){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));
  g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));
  g.setAttribute('millRole',new T.Float32BufferAttribute(this.role,1));
  g.computeBoundingSphere();g.computeBoundingBox();return g;
 }
}
export const MILL_RELATIVE_PLAN=Object.freeze({
 body:Object.freeze({x0:-8.78,x1:2.02,z0:-3.68,z1:10.82}),
 riverRoom:Object.freeze({x0:1.94,x1:6.49,z0:-3.58,z1:10.73}),
 primaryEaveY:5.57,ridgeY:10.97,ridgeX:-3.38,
 bodyFloorY:.43,bayFloorY:.46,
 observedDormers:Object.freeze([
  Object.freeze({z:-.023,w:1.58,panes:1,central:false}),
  Object.freeze({z:3.60,w:2.37,panes:2,central:true}),
  Object.freeze({z:7.28,w:1.58,panes:1,central:false})
 ]),
});
type Plane = {
 to:(u:number,y:number,offset:number)=>P;n:P;
 box:(l:number,r:number,b:number,t:number,d0:number,d1:number,m:Role,name:string)=>void;
};
function side(b:Batch,axis:'x'|'z',value:number,dir:number):Plane{
 if(axis==='x')return {to:(u,y,d)=>[value+dir*d,y,u],n:[dir,0,0],
  box:(l,r,b0,t,d0,d1,m,k)=>b.box(value+Math.min(d0*dir,d1*dir),value+Math.max(d0*dir,d1*dir),b0,t,l,r,m,k)};
 return {to:(u,y,d)=>[u,y,value+dir*d],n:[0,0,dir],
  box:(l,r,b0,t,d0,d1,m,k)=>b.box(l,r,b0,t,value+Math.min(d0*dir,d1*dir),value+Math.max(d0*dir,d1*dir),m,k)};
}
/** Deep fitted, opaque reflective sashes. All trim members contact the closed
 * interior reveal. Coordinates are an independent reconstruction, not copying pixels. */
function glazedSash(b:Batch,p:Plane,a:Cut,id:string,type:'dormer'|'porch'|'gable'){
 const W=a.r-a.l,H=a.t-a.b, w=type==='porch'?.057:.062;
 const pole=(l:number,r:number,base:number,top:number,z0:number,z1:number,m:Role,k:string)=>
  p.box(l,r,base,top,z0,z1,m,id+k);
 for(const k of [a.l,a.r-w])pole(k,k+w,a.b,a.t,-.117,.028,R.paint,'-jamb');
 for(const k of [a.b,a.t-w])pole(a.l+w,a.r-w,k,k+w,-.117,.023,R.paint,'-jamb');
 // A shadowed interior lip makes genuine band-separation without falsely cut-out black rectangles.
 const e=.018,l=a.l+w,r=a.r-w,f=a.b+w,t=a.t-w;
 for(const k of [l,r-e])pole(k,k+e,f,t,-.115,-.019,R.joint,'-recess');
 for(const k of [f,t-e])pole(l+e,r-e,k,k+e,-.115,-.021,R.joint,'-recess');
 pole(l+e*.8,r-e*.8,f+e*.8,t-e*.8,-.086,-.073,R.glass,'-opaque-glass');
 const y=type==='porch'?a.t-.335:a.b+H*.50;
 pole(l+e,r-e,y-.023,y+.023,-.075,-.007,R.paint,'-meeting-rail');
 const low=type==='porch'?y+.021:f+.015,upper=t-e;
 const col=type==='gable'?2:4;
 for(let j=1;j<col;j++){
  const u=a.l+W*j/col;
  pole(u-.009,u+.009,low,upper,-.073,-.016,R.paint,'-light-muntins');
 }
 const count=type==='porch'?2:type==='gable'?3:6;
 for(let j=1;j<count;j++){
  const v=low+(upper-low)*j/count;
  if(Math.abs(v-y)<.027)continue;
  pole(l+e,r-e,v-.008,v+.008,-.073,-.017,R.paint,'-light-muntins');
 }
 // A mitered/fall-away sill band extends just beyond the casing corners.
 pole(a.l-.061,a.r+.061,a.b-.047,a.b+.007,-.021,.088,R.paint,'-sloped-sill-edge');
}
function faceStrip(b:Batch,a:P,c:P,d:P,n:P,m:Role,k:string){
 b.quad(a,c,add(c,d),add(a,d),n,m,k);
}
/** Original study: one main mass, the photographed river-shore shed and three
 * dormers. NW unseen details and unknown grade/stairs are unbuilt. */
export function millShape(){
 const B=new Batch(),s=MILL_RELATIVE_PLAN,A=s.body,C=s.riverRoom;
 const {x0:a,x1:d,z0:l,z1:r}=A,f=s.bodyFloorY,E=s.primaryEaveY,H=s.ridgeY,h=s.ridgeX;
 const D=.239,dx=d+D,wx=a-D,lo=l-.218,hi=r+.218;
 const slope=(H-E)/(dx-h),YS=(x:number)=>H-(x-h)*slope;
 const XT=(y:number)=>h+(H-y)/slope;
 const oldN=[0,1,0] as const,wallPlate=E+D*slope-.016;
 const nearZ=side(B,'z',l,-1),farZ=side(B,'z',r,1);
 const thisGable=[crop(a+3.17,a+4.10,5.025,6.48),crop(a+6.1,a+7.03,5.025,6.48)];
 const gableOutline:U[]=[[a,f],[d,f],[d,wallPlate],[h,H-.016],[a,wallPlate]];
 for(const [P,z,k,holes] of [[nearZ,l,'north',thisGable],[farZ,r,'south',[]]] as const){
  B.panel(gableOutline,holes.map(cutPlan),([x,y])=>P.to(x,y,0),P.n,R.wood,k+'-gable');
  for(const [i,Q] of holes.entries())glazedSash(B,P,Q,k+'-upper-'+i,'gable');
 }
 B.panel(cutPlan(crop(l,r,f,wallPlate)),[],([z,y])=>[a,y,z],[-1,0,0],R.wood,'road-cladding-no-invented-openings');
 B.panel(cutPlan(crop(l,r,f,wallPlate)),[],([z,y])=>[d,y,z],[1,0,0],R.wood,'rear-loadbearing-wall');
 B.box(a,d,0,f,l,r,R.base,'studio-closure-not-surveyed-foundation');
 // Subtle painted corner casing/rake trim is visible in both photographs.
 for(const z of [l,r])for(const x of [a,d])
  B.box(x-.040,x+.040,f,E,z-.034,z+.034,R.paint,'main-corner-board');
 // Main rear roof exact holes remove the opaque roof under all dormers.
 const holes:U[][]=[],junctions:{z:number;w:number;frontX:number;base:number;plate:number;top:number;heel:number;peakLink:number;containsHostCavity:boolean;clearance:number}[]=[];
 for(const [j,R0] of s.observedDormers.entries()){
  const {z,w,panes,central}=R0;
  const xF=d-.732, base=YS(xF),plate=base+(central?1.805:1.532),top=plate+(central?.91:.671);
  const zL=z-w/2,zR=z+w/2,xP=XT(plate),xK=XT(top);
  if(!(xK>h+.44&&xF<dx-.26&&lo<zL&&zR<hi&&xP>xK))throw Error('Dormer no longer fits actual host cut');
  holes.push([[xF,zL],[xP,zL],[xK,z],[xP,zR],[xF,zR]]);
  const id='dormer'+j,p=side(B,'x',xF,1);
  const count=panes,lightW=central?.761:.764,spacing=central?.865:0,by=base+.212,ty=plate-.174;
  const open:Array<Cut>=Array.from({length:count},(_,i)=>{
   const zz=z+(i-(count-1)*.5)*spacing;
   return crop(zz-lightW/2,zz+lightW/2,by,ty);
  });
  B.panel([[zL,base],[zR,base],[zR,plate],[z,top],[zL,plate]],open.map(cutPlan),
    ([u,y])=>p.to(u,y,0),p.n,R.wood,id+'-face');
  for(const [i,o] of open.entries())glazedSash(B,p,o,id+'-sash'+i,'dormer');
  B.face([xF,base,zL],[xP,plate,zL],[xF,plate,zL],[0,0,-1],R.wood,id+'-seat-cheek');
  B.face([xF,base,zR],[xF,plate,zR],[xP,plate,zR],[0,0,1],R.wood,id+'-seat-cheek');
  B.quad([xF,plate,zL],[xF,top,z],[xK,top,z],[xP,plate,zL],oldN,R.shingleRoof,id+'-interlocked-roof');
  B.quad([xF,top,z],[xF,plate,zR],[xP,plate,zR],[xK,top,z],oldN,R.shingleRoof,id+'-interlocked-roof');
  const rim=.148;
  for(const [j2,q]of [[zL,plate],[zR,plate]]as const){
   const a0:P=[xF,q,j2],a1:P=[xF,top,z],f0:P=[xF+rim,q,j2],f1:P=[xF+rim,top,z];
   B.quad(a0,f0,f1,a1,oldN,R.shingleRoof,id+'-rake-extension');
   faceStrip(B,f0,f1,[0,-.101,0],[1,0,0],R.paint,id+'-pale-rake');
   B.quad(f0,[xF+rim,q-.1,j2],[xF,q-.1,j2],a0,[0,0,j2===zL?-1:1],R.paint,id+'-rake-closed-return');
  }
  B.box(xF-.017,xF+.042,base,base+.068,zL+.02,zR-.02,R.paint,id+'-sill-apron');
  junctions.push({z,w,frontX:xF,base,plate,top,heel:xP,peakLink:xK,containsHostCavity:true,
    clearance:Math.min(xK-h,dx-xF,zL-lo,hi-zR)});
 }
 const east:U[]=[[h,lo],[dx,lo],[dx,hi],[h,hi]];
 B.panel(east,holes,([x,z])=>[x,YS(x),z],oldN,R.shingleRoof,'east-roof-with-3-negative-openings');
 B.quad([wx,E,lo],[h,H,lo],[h,H,hi],[wx,E,hi],oldN,R.shingleRoof,'west-roof-unnamed');
 for(const z of [lo,hi]){
  const n:P=[0,0,z===lo?-1:1];
  faceStrip(B,[wx,E,z],[h,H,z],[0,-.155,0],n,R.paint,'full-gable-rake');
  faceStrip(B,[h,H,z],[dx,E,z],[0,-.155,0],n,R.paint,'full-gable-rake');
  // The under-rake returns to the facing wall, not detached white paint.
  const inside=z===lo?l:r;
  for(const [p,q,y0,y1]of [[wx,h,E-.155,H-.155],[h,dx,H-.155,E-.155]]){
   B.quad([p,y0,z],[p,y0,inside],[q,y1,inside],[q,y1,z],[0,-1,0],R.lining,'under-rake-return');
  }
 }
 for(const [x,k,n]of [[wx,a,-1],[dx,d,1]]as const){
  faceStrip(B,[x,E,lo],[x,E,hi],[0,-.137,0],[n,0,0],R.paint,'long-fascia');
  B.quad([x,E-.137,lo],[k,E-.137,lo],[k,E-.137,hi],[x,E-.137,hi],[0,-1,0],R.lining,'soffit');
 }
 // Narrow ridge caps, following the same host-slope plan.
 for(const sign of [-1,1])B.quad([h,H+.022,lo],[h+.10*sign,H-.082,lo],
  [h+.10*sign,H-.082,hi],[h,H+.022,hi],oldN,R.shingleRoof,'ridge-cap');
 // Dated broad visible river room: single low shed with three grouped banks
 // of glazing. Not the disputed beyond-main-footprint extension wing.
 const E2=3.995,top=E-.174,roofX=C.x1+.245,bx=C.x0-.053,shift=(top-E2)/(roofX-bx);
 const GY=(x:number)=>E2+(roofX-x)*shift;
 const zA=C.z0-.254,zB=C.z1+.254,Yf=s.bayFloorY,loom=side(B,'x',C.x1,1);
 B.quad([bx,top,zA],[roofX,E2,zA],[roofX,E2,zB],[bx,top,zB],oldN,R.shed,'verandah-shed');
 faceStrip(B,[roofX,E2,zA],[roofX,E2,zB],[0,-.142,0],[1,0,0],R.paint,'verandah-fascia');
 B.quad([roofX,E2-.142,zA],[C.x1,GY(C.x1)-.142,zA],[C.x1,GY(C.x1)-.142,zB],
   [roofX,E2-.142,zB],[0,-1,0],R.lining,'verandah-soffit');
 for(const z of [C.z0,C.z1]){
  B.quad([C.x0,Yf,z],[C.x1,Yf,z],[C.x1,GY(C.x1),z],[C.x0,GY(C.x0),z],[0,0,z===C.z0?-1:1],R.wood,'verandah-gable-return');
 }
 B.box(C.x0,C.x1,0,Yf,C.z0,C.z1,R.base,'porch-studio-closed-base');
 const cuts:Cut[]=[],banks=[-1.17,3.55,8.26],winPitch=.995;
 for(const z of banks)for(let i=0;i<4;i++){
  const u=z+(i-1.5)*winPitch;
  cuts.push(crop(u-.448,u+.448,2.37,3.687));
 }
 B.panel(cutPlan(crop(C.z0,C.z1,Yf,GY(C.x1))),cuts.map(cutPlan),([z,y])=>loom.to(z,y,0),
  [1,0,0],R.wood,'verandah-wall-cut-glazing-bank');
 for(const [i,o] of cuts.entries())glazedSash(B,loom,o,'verandah-'+i,'porch');
 for(const z of [C.z0,C.z1])B.box(C.x1-.025,C.x1+.047,Yf,GY(C.x1),z-.030,z+.037,R.paint,'verandah-corner-casing');
 return {geometry:B.geometry(),junctions,members:B.members,roofHolesXZ:holes,riverSashBankCentres:banks};
}
const vertex=/* glsl */`
 attribute float millRole;
 varying vec3 millW,millN,millLocal,millLocalSun;
 varying vec2 millUV;
 varying float millFinish;
 uniform vec3 millSun;
 void main(){
  vec4 p=modelMatrix*vec4(position,1.);
  millW=p.xyz;millN=normalize(mat3(modelMatrix)*normal);
  millUV=uv;millFinish=millRole;
  millLocal=position;millLocalSun=normalize(inverse(mat3(modelMatrix))*millSun);
  gl_Position=projectionMatrix*viewMatrix*p;
 }
`;
const frag=/* glsl */`
 varying vec3 millW,millN,millLocal,millLocalSun;
 varying vec2 millUV;
 varying float millFinish;
 uniform vec3 millSun;
 uniform vec4 millDormerCast[3]; // x-front, along centre, half-width, crest
 uniform vec4 millDormerIncline[3]; // daughter half-pitch, host pitch, host intercept, reserved
 // Clip a solar ray against the same five-corner dormer footprint and
 // sloping shell. This is scale-local self shading, not an external cast.
 bool halfspace(float p,float q,inout float nearT,inout float farT){
  if(abs(q)<1.e-6)return p<=0.;
  if(q>0.)farT=min(farT,-p/q);else nearT=max(nearT,-p/q);
  return nearT<farT;
 }
 float roofVisibility(vec3 p,vec3 L){
  float lit=1.;
  for(int k=0;k<3;k++){
   vec4 A=millDormerCast[k],B=millDormerIncline[k];
   float z=p.z-A.y,x=p.x-A.x;
   if(x>2.||x < -8.||abs(z)>4.)continue;
   float lo=.036,hi=19.;
   if(!halfspace(x,L.x,lo,hi))continue;
   if(!halfspace(z-A.z,L.z,lo,hi))continue;
   if(!halfspace(-z-A.z,-L.z,lo,hi))continue;
   if(!halfspace(p.y+B.x*z-A.w,L.y+B.x*L.z,lo,hi))continue;
   if(!halfspace(p.y-B.x*z-A.w,L.y-B.x*L.z,lo,hi))continue;
   if(!halfspace(B.z-B.y*p.x-p.y,-B.y*L.x-L.y,lo,hi))continue;
   lit=min(lit,1.-smoothstep(.012,.145,hi-lo)*.88);
  }
  return lit;
 }
 float hashM(vec2 u){
  vec3 t=fract(vec3(u.xyx)*.1031);
  t+=dot(t,t.yzx+33.33);
  return fract((t.x+t.y)*t.z);
 }
 float sm(vec2 x){
  vec2 b=floor(x),d=fract(x);d=d*d*(3.-2.*d);
  return mix(mix(hashM(b),hashM(b+vec2(1,0)),d.x),mix(hashM(b+vec2(0,1)),hashM(b+1.),d.x),d.y);
 }
 float edgeAt(float c,float row){return c+.44*(hashM(vec2(c+31.7,row*6.61))-.5);}
 vec3 weatheredPanels(vec2 uv,vec2 pixel,float surf){
  bool roof=surf>0.;
  float rise=roof?.151:.162,w=roof?.293:.211;
  float y=uv.y/rise,j=floor(y),stagger=hashM(vec2(j*.83,12.39));
  float X=uv.x/w+stagger,i=floor(X);
  float l=edgeAt(i,j),r=edgeAt(i+1.,j);
  if(X<l){r=l;i-=1.;l=edgeAt(i,j);}
  else if(X>r){l=r;i+=1.;r=edgeAt(i+1.,j);}
  float tile=hashM(vec2(.87*i, j)),v=fract(y);
  float fade=1.-smoothstep(.025,.141,max(pixel.x,pixel.y));
  float verticalLine=1.-smoothstep(.004,.056,min(X-l,r-X));
  float horzLine=1.-smoothstep(.004,.045,v);
  float fiberBlend=1.-smoothstep(.010,.050,max(pixel.x,pixel.y));
  float grain=(sm(uv*vec2(48.,3.7))-.5)*.116*fiberBlend;
  float n=(tile-.5)*(roof?.130:.149)*fade+grain-
   (horzLine*.104+verticalLine*.092)*fade;
  vec2 longgrain=roof?vec2(.63,.92):vec2(1.26,.36);
  float weather=(sm(uv*longgrain+15.9)-.5)*.155+(sm(uv*.34+2.1)-.5)*.145;
  vec3 drift=surf>.6?vec3(.114,.102,.086):roof?vec3(.085,.081,.074):vec3(.157,.165,.156);
  float dryWarm=roof?0.:smoothstep(.45,.82,sm(uv*vec2(.51,.38)+29.3));
  return drift*(1.+n+weather)*(1.+dryWarm*vec3(.067,.013,-.052));
 }
 // Shallow structural contact, evaluated against actual tops/recesses. No
 // fake stroke on the real ground or broad unmeasured wall shape change.
 float wallContact(vec3 p){
  float y=1.;
  if(abs(p.x-6.49)<.08){
   y=min(y,.73+.27*smoothstep(.015,.42,4.065-p.y));
  }
  if(p.x<2.05&&p.x>-8.84){
   float line=10.954-.9576166*abs(p.x+3.38);
   if(abs(p.z+3.68)<.08||abs(p.z-10.82)<.08)
    y=min(y,.80+.2*smoothstep(.035,.31,line-p.y));
   if(abs(p.x+8.78)<.078)
    y=min(y,.79+.21*smoothstep(.045,.44,5.78-p.y));
  }
  if(abs(p.x-1.288)<.060){
   for(int k=0;k<3;k++){
    vec4 a=millDormerCast[k],b=millDormerIncline[k];
    float rz=abs(p.z-a.y);
    if(rz<=a.z+.011&&p.y>6.3)
     y=min(y,.72+.28*smoothstep(.015,.38,a.w-b.x*rz-p.y));
   }
  }
  return y;
 }
 float studioSeat(vec2 p){
  vec2 e0=max(vec2(-8.78,-3.68)-p,p-vec2(2.02,10.82));
  vec2 e1=max(vec2(1.94,-3.58)-p,p-vec2(6.49,10.73));
  float f=min(length(max(e0,0.)),length(max(e1,0.)));
  return 1.-.19*exp(-f*2.25);
 }
 void main(){
  vec3 N=normalize(millN),L=normalize(millSun),E=normalize(cameraPosition-millW),c=vec3(.58,.57,.51);
  float m=floor(millFinish+.3),sun=max(dot(N,L),0.);
  vec2 pix=abs(dFdx(millUV))+abs(dFdy(millUV));
  float hemi=.44+.29*max(N.y,0.)+.045*max(0.,-N.z),rough=.72;
  if(m<1.5||m>7.5){
   c=weatheredPanels(millUV,pix,m>7.5?1.:m>.5?.45:0.);
   rough=m>.5?.91:.96;
   if(m>.5&&millLocal.x>-3.37&&millLocal.y>3.96)sun*=roofVisibility(millLocal,normalize(millLocalSun));
   if(m<.5)c*=wallContact(millLocal);
  }else if(m<2.5){
   c=vec3(.637,.638,.573)*(1.+.034*(sm(millUV*.63)-.5));
   rough=.62;
  }else if(m<3.5){c=vec3(.041,.048,.041);rough=.83;}
  else if(m<4.5){
   vec3 r=reflect(-E,N);
   float plane=max(dot(N,E),0.),F=.053+.70*pow(1.-plane,4.2);
   float horizon=smoothstep(-.321,.252,r.y);
   float cloud=sm(vec2(r.x,r.z)*2.91+r.y*.77);
   vec3 field=mix(vec3(.095,.124,.092),vec3(.179,.194,.152),cloud);
   vec3 sky=mix(field,vec3(.58,.669,.714),horizon);
   float behind=smoothstep(.06,.92,sm(millUV*vec2(.79,.53)+9.));
   vec3 interior=mix(vec3(.029,.036,.035),vec3(.066,.073,.069),behind);
   c=(1.-F)*interior+F*sky;
   hemi=.89; rough=.23;
  }else if(m<5.5){c=vec3(.103,.106,.087);rough=.95;}
  else if(m<6.5){c=vec3(.101,.096,.085)*(1.+.12*(sm(millUV*.88)-.5));rough=.93;}
  else{c=vec3(.167,.177,.168)*studioSeat(millLocal.xz);rough=.96;}
  vec3 H=normalize(L+E);
  float spec=(1.-rough)*pow(max(0.,dot(N,H)),4.+42.*(1.-rough))*.09;
  vec3 rgb=c*(hemi+.67*sun*vec3(1.04,1.01,.946))+.009*(1.-rough)+spec;
  gl_FragColor=vec4(rgb,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;
const M=MILL_RELATIVE_PLAN;
export function millArtMaterial(junctions:ReturnType<typeof millShape>['junctions']){
 if(junctions.length!==3)throw Error('exact 3 detached dormers required');
 const tilt=(M.ridgeY-M.primaryEaveY)/(M.body.x1+.239-M.ridgeX);
 return new T.ShaderMaterial({vertexShader:vertex,fragmentShader:frag,uniforms:{
   millSun:{value:new T.Vector3(-.285,.862,.414).normalize()},
   millDormerCast:{value:junctions.map(q=>new T.Vector4(q.frontX,q.z,q.w/2,q.top))},
   millDormerIncline:{value:junctions.map(q=>new T.Vector4((q.top-q.plate)/(q.w/2),tilt,M.ridgeY+tilt*M.ridgeX,0))}},
   side:T.FrontSide,transparent:false,depthWrite:true,depthTest:true
 });
}
/** A detachable daylight exhibit only, no glTF loader, geography or app work. */
export function makeMillDetached(){
 const art=millShape(),material=millArtMaterial(art.junctions),mesh=new T.Mesh(art.geometry,material);
 mesh.name='Original New Glasgow Mill river elevations (interpretive)';
 return {...art,mesh,material,dispose(){art.geometry.dispose();material.dispose();}};
}
export function millStudioFloor(){
 const B=new Batch();
 B.quad([-85.,-.026,-85.],[85.,-.026,-85.],[85.,-.026,85.],[-85.,-.026,85.],[0,1,0],R.studio,'comparison-floor');
 return B.geometry();
}
