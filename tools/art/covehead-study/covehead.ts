/** Original, detached interpretation of Covehead Harbour Lighthouse, PEI.
 * Geometry units are metres. +Z faces the documented single-door elevation;
 * geographic selection is provisional and is never done by this module.
 * See provenance and unknowns in the companion README. No source pixels.
 */
import * as T from 'three';
export type Vec3 = readonly [number, number, number];
type Vec2 = readonly [number, number];
type Role = keyof typeof PALETTE;
export type Tier = 'heritage'|'flight';
export const DATA = Object.freeze({
 groundDatumCGVD2013:4.48, bearingBottomCGVD2013:4.24, wallFootCGVD2013:4.53,
 wallBaseWidth:3.62, wallUpperWidth:2.42, galleryWidth:4.70,
 galleryTopCGVD2013:10.20, galleryUnderCGVD2013:10.016,
 capHalfWidth:1.32, capApexCGVD2013:12.981794, capPitch:.66369927,
 worldXZ:Object.freeze([4364.74982553,7774.17132536]),
 yawClockwiseIntoSouthXZDegrees:12.81047435,
 currentPlacement:false as const
});
const PALETTE={
 paint: ['#e1e0d3',.86,0],
 warmWood:['#d5d0bb',.86,0],
 red:['#922c30',.78,0],
 rail:['#8e292d',.69,.11],
 shingle:['#77342f',.87,0],
 trimDark:['#432a25',.87,0],
 opaque:['#292c29',.91,0],
 glass:['#35464a',.29,.16],
 whiteMark:['#ebe4cb',.88,0],
 iron:['#403d36',.60,.24]
} as const;
export const MATERIAL_RECIPES = PALETTE;
const y0=DATA.groundDatumCGVD2013, y=(a:number)=>a-y0;
const foot=y(DATA.wallFootCGVD2013), belly=.5*DATA.wallBaseWidth, atDeck=.5*DATA.wallUpperWidth, floor=y(DATA.galleryTopCGVD2013);
const underside=y(DATA.galleryUnderCGVD2013), capA=y(DATA.capApexCGVD2013), H=DATA.capHalfWidth, capE=capA-H*DATA.capPitch;
const mix=(a:number,b:number,f:number)=>a+(b-a)*f;
const half=(height:number)=>mix(belly,atDeck,(Math.min(Math.max(height,foot),underside)-foot)/(underside-foot));
const range=(n:number)=>Array.from({length:n},(_,i)=>i);
const V=(x:number,y:number,z:number):Vec3=>[x,y,z];
const N:readonly Vec3[]=Object.freeze([V(0,0,1),V(1,0,0),V(0,0,-1),V(-1,0,0)]);
const add=(a:Vec3,b:Vec3):Vec3=>V(a[0]+b[0],a[1]+b[1],a[2]+b[2]);
const sub=(a:Vec3,b:Vec3):Vec3=>V(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const mul=(a:Vec3,s:number):Vec3=>V(a[0]*s,a[1]*s,a[2]*s);
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>V(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]);
const mag=(a:Vec3)=>Math.hypot(...a);
const norm=(a:Vec3)=>mul(a,1/mag(a));
function face(s:number,t:number,a:number,h:number):Vec3{
 if(s===0)return V(t,a,h);
 if(s===1)return V(h,a,-t);
 if(s===2)return V(-t,a,-h);
 return V(-h,a,t);
}
interface Part {p:number[];uv:number[];c:number[];}
class Forms{
 buckets:Map<Role,Part>=new Map();
 readonly tier:Tier;
 constructor(tier:Tier){this.tier=tier;}
 part(r:Role){
  let g=this.buckets.get(r);
  if(!g){g={p:[],uv:[],c:[]};this.buckets.set(r,g);}
  return g;
 }
 tri(r:Role,pts:readonly [Vec3,Vec3,Vec3],n:Vec3,uv?:readonly Vec2[],tone=1){
  const q=this.part(r),axis=cross(sub(pts[1],pts[0]),sub(pts[2],pts[0]));
  if(mag(axis)<1e-10)throw new Error('Covehead authoring degenerate face: '+r);
  const dirs=dot(axis,n)>=0?[0,1,2]:[0,2,1];
  for(const i of dirs){const a=pts[i]; const p=uv?.[i]??[a[0]+.271*a[2],a[1]+.231*a[2]];q.p.push(...a);q.uv.push(...p);q.c.push(tone,tone,tone);}
 }
 quad(r:Role,a:Vec3,b:Vec3,c:Vec3,d:Vec3,n:Vec3,tone=1,uv?:readonly Vec2[]){
  this.tri(r,[a,b,c],n,uv?[uv[0],uv[1],uv[2]]:undefined,tone);
  this.tri(r,[a,c,d],n,uv?[uv[0],uv[2],uv[3]]:undefined,tone);
 }
 skin(r:Role,w0:number,w1:number,b:number,t:number){
  const vs=range(4).map(i=>face(i,-w0,b,w0)),top=range(4).map(i=>face(i,-w1,t,w1));
  for(let s=0;s<4;s++){
   const j=(s+1)%4;
   this.quad(r,vs[s],vs[j],top[j],top[s],N[s],.97,
     [[-w0,b],[w0,b],[w1,t],[-w1,t]]);
  }
  this.quad(r,vs[0],vs[1],vs[2],vs[3],V(0,-1,0));
  this.quad(r,top[0],top[1],top[2],top[3],V(0,1,0));
 }
 extrusion(r:Role,s:number,c:readonly Vec2[],out:(u:number,a:number)=>number,back:(u:number,a:number)=>number,tone=1){
  const v=(f:typeof out,i:number)=>face(s,c[i][0],c[i][1],f(...c[i]));
  const triangles=T.ShapeUtils.triangulateShape(c.map(([u,y])=>new T.Vector2(u,y)),[]);
  for(const [i,j,k] of triangles){
   this.tri(r,[v(out,i),v(out,j),v(out,k)],N[s],[c[i],c[j],c[k]],tone);
   this.tri(r,[v(back,i),v(back,j),v(back,k)],mul(N[s],-1),[c[i],c[j],c[k]],tone);
  }
  for(const i of range(c.length)){
   const j=(i+1)%c.length,m0=v(out,i),m1=v(out,j),ab=v(back,i),b=v(back,j);
   const middle=face(s,(c[i][0]+c[j][0])*.5,(c[i][1]+c[j][1])*.5,0);
   const t=face(s,c.reduce((a,x)=>a+x[0],0)/c.length,c.reduce((a,x)=>a+x[1],0)/c.length,0);
   this.quad(r,m0,m1,b,ab,sub(middle,t),tone*.93);
  }
 }
 beam(r:Role,a:Vec3,b:Vec3,halfW:number,halfD=halfW,round=0,tone=1){
  const d=norm(sub(b,a)),u=norm(cross(d,Math.abs(d[1])>.92?V(0,0,1):V(0,1,0))),v=norm(cross(d,u));
  const M=round||4,start=round?0:Math.PI/4;
  const p=(c:Vec3,i:number)=>{
   const f=round?1:Math.SQRT2,t=i*2*Math.PI/M+start;
   return add(c,add(mul(u,f*halfW*Math.cos(t)),mul(v,f*halfD*Math.sin(t))));
  };
  for(let i=0;i<M;i++){
   const j=(i+1)%M,m=p(a,i),n=p(a,j),w=p(b,i),z=p(b,j);
   this.quad(r,m,n,z,w,sub(mul(add(m,n),.5),a),tone);
  }
  for(let i=1;i+1<M;i++){
   this.tri(r,[p(a,0),p(a,i),p(a,i+1)],mul(d,-1),undefined,tone);
   this.tri(r,[p(b,0),p(b,i),p(b,i+1)],d,undefined,tone);
  }
 }
 rect(r:Role,s:number,a:number,b:number,l:number,t:number,outer:(u:number,h:number)=>number,inner:(u:number,h:number)=>number,tone=1){
  this.extrusion(r,s,[[a,l],[b,l],[b,t],[a,t]],outer,inner,tone);
 }
 planar(r:Role,side:number,shell:Vec2[],cuts:Vec2[][],depth:(a:number)=>number,tone=1){
  const a=shell.concat(...cuts);
  const tess=T.ShapeUtils.triangulateShape(shell.map(([u,h])=>new T.Vector2(u,h)),cuts.map(c=>c.map(([u,h])=>new T.Vector2(u,h))));
  for(const ids of tess){
   const w=ids.map(i=>a[i]) as [Vec2,Vec2,Vec2];
   this.tri(r,w.map(([u,h])=>face(side,u,h,depth(h))) as [Vec3,Vec3,Vec3],N[side],w,tone);
  }
 }
 finish(mats:ReadonlyMap<Role,T.Material>){
  const G=new T.Group();G.name='Covehead Harbour Lighthouse · detached';
  for(const [role,q] of this.buckets){
   if(q.p.length<9||!q.p.every(Number.isFinite)||!q.uv.every(Number.isFinite)||!mats.has(role))
    throw new Error('Covehead authoring invalid ' + role);
   const g=new T.BufferGeometry();
   g.setAttribute('position',new T.Float32BufferAttribute(q.p,3));
   g.setAttribute('uv',new T.Float32BufferAttribute(q.uv,2));
   g.setAttribute('color',new T.Float32BufferAttribute(q.c,3));
   g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
   const o=new T.Mesh(g,mats.get(role)!);
   o.name=role;o.userData.appearanceRole=role;o.castShadow=role!=='glass';o.receiveShadow=true;G.add(o);
  }
  return G;
 }
}
const hash=(x:number,y:number)=>{let n=Math.imul(x|0,73856093)^Math.imul(y|0,19349663);n=Math.imul(n^(n>>>15),0x2c1b3c6d);return ((n^(n>>>12))>>>0)/4294967295;};
const frac=(a:number)=>a-Math.floor(a);
const sm=(x:number)=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
export function originalMaps(res=256){
 if(!Number.isInteger(res)||res<64||res>512||(res&(res-1))!==0)throw Error('Map size outside detached limit');
 const c:Array<{role:'paint'|'shingle',pixels:Uint8Array,normal:Uint8Array,repeat:readonly [number,number]}>=[];
 for(const role of ['paint','shingle'] as const){
  const rgb=new Uint8Array(res*res*4),normal=new Uint8Array(rgb.length);
  const repeat:readonly [number,number]=role==='paint'?[1/4,1/.80]:[1/1.92,1/1.5];
  const tile=(u:number,v:number)=>{
   const rowN=role==='paint'?6:9,nn=v*rowN,fx=frac(nn),row=((Math.floor(nn)%rowN)+rowN)%rowN,
    g=Math.sin(2*Math.PI*(13*u+row*.13))*.30 + Math.sin(2*Math.PI*(27*u+.35*Math.sin(2*Math.PI*v)))*.34;
   if(role==='paint'){
    const lap=1-sm(fx/.13),belly=Math.sin(Math.PI*sm((fx-.025)/.90))*.19;
    const fine=hash(Math.floor(u*res)%res,Math.floor(v*res)%res)-.5;
    return [ .956+(hash(37,row)-.5)*.047-.126*lap+.015*g+.022*fine, .67*lap+belly-.21*fx+.03*g ];
   }
   const vv=u*12+(row%2)*.5+hash(33,row)*.20,ch=Math.floor(vv),block=(ch%12+12)%12,ss=frac(vv);
   const h=(1-sm(fx/.12))*.70+(1-sm(Math.min(ss,1-ss)/.048))*.43;
   const color=.904+(hash(block,row)-.50)*.171+g*.026-h*.175;
   return [color,.48-.67*h+g*.085];
  };
  for(let j=0;j<res;j++)for(let i=0;i<res;i++){
   const u=(i+.5)/res,v=(j+.5)/res,k=(j*res+i)*4;const [r]=tile(u,v);
   const sx=(tile(u-.65/res,v)[1]-tile(u+.65/res,v)[1])*.22,
     sy=(tile(u,v-.65/res)[1]-tile(u,v+.65/res)[1])*.42;
   const col=Math.max(0,Math.min(1,r));rgb[k]=Math.round(col*255);rgb[k+1]=Math.round(Math.min(1,col*.995+.005)*255);rgb[k+2]=Math.round(Math.min(1,col*.984+.016)*255);rgb[k+3]=255;
   const n=norm(V(sx,sy,1));normal[k]=Math.round((n[0]*.5+.5)*255);normal[k+1]=Math.round((n[1]*.5+.5)*255);normal[k+2]=Math.round((n[2]*.5+.5)*255);normal[k+3]=255;
  }
  c.push({role,pixels:rgb,normal,repeat});
 }
 return c;
}
function materials(near:boolean){
 const x=new Map<Role,T.Material>();
 for(const [r,a] of Object.entries(PALETTE) as [Role,typeof PALETTE[Role]][]){
  x.set(r,new T.MeshStandardMaterial({name:r,color:a[0],roughness:a[1],metalness:a[2],vertexColors:true,envMapIntensity:r==='glass'?.73:1}));
 }
 if(near)for(const v of originalMaps()){
  const mat=x.get(v.role) as T.MeshStandardMaterial,res=Math.sqrt(v.pixels.length/4);
  for(const isMap of [true,false]){
   const m=new T.DataTexture(isMap?v.pixels:v.normal,res,res);m.name='original Covehead '+v.role+(isMap?' color':' tangent');
   if(isMap)m.colorSpace=T.SRGBColorSpace;m.wrapS=m.wrapT=T.RepeatWrapping;
   m.repeat.set(...v.repeat);m.generateMipmaps=true;m.minFilter=T.LinearMipmapLinearFilter;
   m.magFilter=T.LinearFilter;m.needsUpdate=true;
   if(isMap)mat.map=m;else{mat.normalMap=m;mat.normalScale.set(.8,.7);}
  }
 }
 return x;
}
type Opening={u:number,b:number,w:number,h:number,kind:'door'|'window'};
const openFront:Opening={u:0,b:foot+.105,w:1.04,h:2.47,kind:'door'};
const sideWindows:Opening[]=[
 {u:0,b:y(6.21),w:.60,h:.98,kind:'window'}, {u:0,b:y(8.11),w:.69,h:.91,kind:'window'},
 {u:0,b:y(6.33),w:.58,h:.96,kind:'window'}
];
const rectangle=(a:number,b:number,l:number,t:number):Vec2[]=>[[a,l],[b,l],[b,t],[a,t]];
function hood(f:Forms,s:number,a:Opening,near:boolean){
 const l=a.u-a.w*.5-.20,r=a.u+a.w*.5+.20,m=a.u,b=a.b+a.h+.05,h=b+(a.kind==='door'?.435:.285);
 const back=(u:number,t:number)=>half(t)-.009;
 const front=(u:number,t:number)=>half(t)+(a.kind==='door'?.33:.253);
 const triangle:Vec2[]=[[l,b],[r,b],[m,h]];
 f.extrusion('warmWood',s,triangle,front,back,.91);
 const A=face(s,l,b,back(l,b)),B=face(s,m,h,back(m,h)),C=face(s,r,b,back(r,b)),
   P=face(s,l,b,front(l,b)+.031),K=face(s,m,h,front(m,h)+.031),D=face(s,r,b,front(r,b)+.031);
 f.quad('shingle',A,P,K,B,V(0,1,0),.92,[[l,0],[l,.38],[m,.38],[m,0]]);
 f.quad('shingle',B,K,D,C,V(0,1,0),.92,[[m,0],[m,.38],[r,.38],[r,0]]);
 const G=(u:number,t:number)=>front(u,t)+.030;
 for(const [q,t] of [[l,m],[m,r]]) {
  const p=q===l?b:h,z=t===r?b:h;
  f.extrusion('red',s,[[q,p-.068],[t,z-.068],[t,z+.015],[q,p+.015]],G,front,.92);
 }
 if(near){
  const d=(u:number,t:number)=>front(u,t)+.026;
  f.extrusion('trimDark',s,[[l+.061,b-.079],[m,h-.079],[r-.061,b-.079],[r-.061,b-.057],[m,h-.057],[l+.061,b-.057]],d,front,.76);
 }
}
function opening(f:Forms,s:number,a:Opening,near:boolean){
 const l=a.u-a.w*.5,r=a.u+a.w*.5,b=a.b,t=a.b+a.h;
 const cut=rectangle(l,r,b,t), z=(k:number,h:number)=>half(h), inside=(k:number,h:number)=>z(k,h)-.125;
 for(const i of range(4)){
  const j=(i+1)%4,[c,d]=cut[i],[e,g]=cut[j];
  f.quad('warmWood',face(s,c,d,z(c,d)),face(s,e,g,z(e,g)),face(s,e,g,inside(e,g)),face(s,c,d,inside(c,d)),
   sub(face(s,a.u,(b+t)*.5,0),face(s,(c+e)*.5,(d+g)*.5,0)),i===2?.53:.69);
 }
 // Closed cavity. The full opening, not a smaller frame, has an opaque back.
 const closed=(x:number,h:number)=>inside(x,h);
 f.rect(a.kind==='door'?'paint':'opaque',s,l,r,b,t,closed,(x,h)=>closed(x,h)-.024,.87);
 const outer=(x:number,h:number)=>z(x,h)+.035, back=(x:number,h:number)=>z(x,h)-.019;
 const w=a.kind==='door'?.084:.062;
 f.rect('red',s,l-w,l+.014,b-.018,t+w,outer,back,.97);
 f.rect('red',s,r-.014,r+w,b-.018,t+w,outer,back,.97);
 f.rect('red',s,l+.014,r-.014,t-.012,t+w,outer,back,.96);
 f.rect(a.kind==='door'?'warmWood':'red',s,l+.014,r-.014,b-.042,b+.026,outer,back,.90);
 if(a.kind==='window'){
  const glass=(x:number,h:number)=>closed(x,h)+.008;
  f.rect('glass',s,l+.049,r-.049,b+.053,t-.052,glass,(x,h)=>glass(x,h)-.003,.85);
  const v=(x:number,h:number)=>glass(x,h)+.018;
  // Nominal multi-light sash; no inferred interior behind the glass.
  f.rect('warmWood',s,l+.043,r-.043,(b+t)*.5-.011,(b+t)*.5+.011,v,glass,.85);
  if(near)f.rect('warmWood',s,a.u-.012,a.u+.012,b+.042,t-.046,v,glass,.81);
 }else if(near){
  const p=(x:number,h:number)=>closed(x,h)+.007;
  f.rect('warmWood',s,l+.068,r-.068,b+.09,b+.114,p,closed,1);
  f.rect('warmWood',s,l+.068,r-.068,t-.122,t-.097,p,closed,1);
  const k=a.u+a.w*.31,m=b+1.02;
  f.beam('iron',face(s,k,m,closed(k,m)),face(s,k,m,closed(k,m)+.053),.027,.027,8);
 }
 hood(f,s,a,near);
 return cut;
}
const LETTERS:Record<string,string[]> = {
 C:['91 72 22 01 09 29 79 99'],O:['22 72 91 99 79 29 09 01 22'],V:['01 49 93'],
 E:['91 01 09 99','03 72'],H:['01 09','91 99','05 95'],A:['09 41 61 99','25 75'],
 D:['01 61 93 97 69 09 01'],L:['01 09 99'],I:['11 91','51 59','19 99'],
 G:['91 81 21 01 09 29 79 99 95 56'],T:['01 91','51 59'],
 U:['01 07 29 79 97 91'],S:['91 21 02 04 37 85 97 99 29 09']
};
function letteredPublicBoard(f:Forms,near:boolean){
 const s=0,mid=y(8.36),w=.516,dm=(k:number,h:number)=>half(h);
 const outside=(k:number,h:number)=>dm(k,h)+.032;
 // Original paint rendering of the photographed generic place name; no Parks logos.
 f.rect('red',s,-w,w,mid-.165,mid+.165,outside,(k,h)=>dm(k,h)-.006,.87);
 if(!near)return;
 for(const [text,t,step]of [['COVEHEAD',mid+.024,.083],['LIGHTHOUSE',mid-.105,.078]]as const){
  const run=step*text.length;
  for(const [i,l]of [...text].entries())for(const path of LETTERS[l]){
   const pts=path.split(' ').map(raw=>[i*step-run*.5+Number(raw[0])*step*.078,t+(.111-.012*Number(raw[1]))]as Vec2);
   for(let j=1;j<pts.length;j++){
    const [x,v]=pts[j-1],[u,h]=pts[j],d=.0048/Math.hypot(u-x,h-v),a=(v-h)*d,b=(u-x)*d;
    const z=(p:number,q:number)=>face(s,p,q,outside(p,q)+.0014);
    f.quad('whiteMark',z(x+a,v+b),z(u+a,h+b),z(u-a,h-b),z(x-a,v-b),N[s],.86);
   }
  }
 }
}
function bracket(f:Forms,i:number,t:number,near:boolean){
 const a=underside-1.28,b=underside-.046;
 f.beam('warmWood',face(i,t,a,half(a)+.019),face(i,t,b,half(b)+.008),.037,.063,0,.93);
 f.beam('paint',face(i,t,a+.16,half(a+.16)+.056),face(i,t,b,2.027),.045,.058,0,.94);
 f.beam('warmWood',face(i,t,b,half(b)-.017),face(i,t,b,2.145),.066,.065,0,.82);
 if(near)for(const s of [a+.12,a+.37]){
  f.beam('iron',face(i,t,s,half(s)+.058),face(i,t,s,half(s)+.072),.011,.011,6,.84);
 }
}
function maple(f:Forms,side:number,Y:number,half:number){
 const m:Vec2[]=[[.00,-.18],[.031,-.074],[.156,-.096],[.138,-.047],[.244,.037],[.192,.052],[.207,.112],
 [.125,.09],[.097,.144],[.049,.045],[.07,.20],[.032,.173],[.0,.242],[-.032,.173],[-.07,.20],
 [-.049,.045],[-.097,.144],[-.125,.09],[-.207,.112],[-.192,.052],[-.244,.037],[-.138,-.047],
 [-.156,-.096],[-.031,-.074],[-.021,-.17]];
 const t=m.map(([u,h]):Vec2=>[u*.90,Y+h*.90]);
 f.extrusion('whiteMark',side,t,()=>half+.008,()=>half-.002,.97);
}
export function buildCovehead(tier:Tier='heritage',textures=tier==='heritage'){
 const f=new Forms(tier),near=tier==='heritage',floorHW=DATA.galleryWidth*.5;
 const down=y(DATA.bearingBottomCGVD2013);
 f.skin('opaque',belly-.052,belly,down,foot); // concealed bearing study, no claimed pedestal
 for(let s=0;s<4;s++){
  const cut=opening(f,s,s===0?openFront:sideWindows[s-1],near);
  const shell:Vec2[]=[[-belly,foot],[belly,foot],[atDeck,underside],[-atDeck,underside]];
  f.planar('paint',s,shell,[cut],half,s===2?.95:1.0);
  // Case boards are thin beam sides, not strips lying on the lap face.
  for(const k of [-1,1]){
   if(k!==1)continue; // one full corner from each side
   const a=face(s,k*(belly-.031),foot,belly-.009),b=face(s,k*(atDeck-.032),underside,atDeck-.008);
   f.beam('red',a,b,.047,.037,0,.96);
  }
  for(const t of [-.61,.61])bracket(f,s,t,near);
 }
 letteredPublicBoard(f,near);
 f.skin('warmWood',floorHW-.031,floorHW,underside,floor-.073);
 f.skin('warmWood',floorHW,floorHW,floor-.073,floor);
 for(let s=0;s<4;s++){
  const o=floorHW-.082;
  const A=(u:number,h:number)=>face(s,u,h,o);
  for(const h of [.449,.887])f.beam('rail',A(-o,floor+h),A(o,floor+h),near?.016:.021,near?.016:.021,near?8:5);
  for(const t of [-o,-o/3,o/3])f.beam('rail',A(t,floor-.017),A(t,floor+.907),near?.018:.022,near?.018:.022,near?8:5);
 }
 // Closed lower lantern skirt, pale and slightly tapered in photographs.
 const lanternHalf=1.018, skirtTop=floor+.64, carvedBase=floor, shoulder=1.18;
 f.skin('paint',shoulder,lanternHalf,carvedBase,skirtTop);
 const b=skirtTop,t=capE-.038;
 f.skin('trimDark',lanternHalf-.106,lanternHalf-.110,b,t);
 for(let s=0;s<4;s++){
  const out=()=>lanternHalf,bk=()=>lanternHalf-.019;
  const cut=s?rectangle(-.845,.845,b+.073,t-.095):undefined;
  f.planar('red',s,rectangle(-lanternHalf,lanternHalf,b,t),cut?[cut]:[],out,.94);
  if(cut){
   const win=(x:number,h:number)=>lanternHalf-.069;
   const w=.845,l=b+.073,u=t-.095;
   f.rect('glass',s,-w,w,l,u,win,(x,h)=>win(x,h)-.012,.87);
   // True layered opening around the existing closed lantern form.
   for(let j=0;j<4;j++){
    const [a,v]=cut[j],[c,k]=cut[(j+1)%4];
    f.quad('warmWood',face(s,a,v,out()),face(s,c,k,out()),face(s,c,k,win(c,k)),face(s,a,v,win(a,v)),sub(face(s,0,(l+u)*.5,0),face(s,(a+c)*.5,(v+k)*.5,0)),.76);
   }
   const frame=()=>lanternHalf+.003;
   for(const p of [-w,w])f.rect('warmWood',s,p-.018,p+.018,l,u,frame,bk,.84);
   if(near)f.rect('warmWood',s,-w,w,l-.021,l+.011,frame,bk,.86);
  }else maple(f,s,b+(t-b)*.62,lanternHalf);
  const joint=()=>lanternHalf+.022;
  for(const k of [-1])f.rect('warmWood',s,k*(lanternHalf-.044)-.021,k*(lanternHalf-.044)+.021,b+.004,t-.056,joint,bk,.91);
 }
 const corners=range(4).map(i=>face(i,-H,capE,H)),under=capE-.051;
 const below=corners.map(([x,z,w])=>V(x,under,w));
 f.quad('warmWood',below[0],below[1],below[2],below[3],V(0,-1,0),.87);
 for(let s=0;s<4;s++){
  const j=(s+1)%4;
  f.quad('warmWood',below[s],below[j],corners[j],corners[s],N[s],.94);
  f.tri('shingle',[corners[s],corners[j],V(0,capA,0)],V(0,1,0),[[-H,0],[H,0],[0,Math.hypot(capA-capE,H)]],1.0);
 }
 f.beam('iron',V(0,capA-.016,0),V(0,capA+.292,0),near?.034:.045,near?.034:.045,near?8:5,.92);
 if(near){
  f.beam('iron',V(0,capA+.026,0),V(0,capA+.126,0),.080,.078,8,1.0);
  const p:Vec2[]=[[-.14,capA+.365],[-.073,capA+.374],[.063,capA+.360],[.123,capA+.355],
   [.252,capA+.423],[.223,capA+.337],[.096,capA+.308],[.020,capA+.298],[-.039,capA+.299],
   [-.075,capA+.321],[-.174,capA+.321]];
  f.extrusion('iron',0,p,()=>.013,()=>-.013,.95);
 }else{
  f.beam('iron',V(-.16,capA+.328,0),V(.235,capA+.357,0),.016,.037,4,.95);
 }
 const g=f.finish(materials(textures));
 g.userData.covehead={tier, datumCGVD2013: y0, textures, detached:true};
 return g;
}
