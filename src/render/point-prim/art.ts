/**
 * Original editable exterior of the public Point Prim tower, computationally isolated.
 * Metres, native vertical datum 4.725m CGVD2013. X east, Z south. Only exterior.
 * Main taper, gallery and cap heights calibrated against 2020 training-only returns.
 * Window/cast trim positions, cowl/ring orientation, bracket profiles and paint nominal:
 * see dated exterior and uncertainty notes. Does not create navigation or ground systems.
 */
import * as T from 'three';
export const POINT_PRIM=Object.freeze({
 origin3979:[2400368.2680197088,286138.33867007116] as const,
 datum:4.725,
 fitRadiusAtDatum:3.6811237276343616, dr:-.13087611158696733,
 deck:19.7935, deckRadius:3.233, lightBodyRadius:1.727,
 capEave:22.816, capR:2.058, capTop:23.522,
 gameOwner:'q100/266',
 bounds:[-3.76,-.285,3.76,19.68] as const
});
export type Tier='close'|'flight';
type P=[number,number,number];
type UV=[number,number];
type Role='shingle'|'foundation'|'ivory'|'reveal'|'sash'|'red'|'redShade'|'metal'|'lantern'|'deck';
type W={y0:number,y1:number,a0:number,a1:number,name:'door'|'mesh'|'pane'};
export const STYLES:Record<Role,readonly [string,number,number]>={
 shingle:['#e7e4db',.88,0], foundation:['#a09c89',.96,0], ivory:['#e4e4d9',.79,0],
 reveal:['#c8c4b1',.83,0], sash:['#344448',.42,.05],
 red:['#a83b31',.53,.21], redShade:['#7a2d27',.62,.14],
 metal:['#373e3c',.56,.43], lantern:['#80928e',.31,.22], deck:['#958474',.81,.02]
};
type Data={p:number[],n:number[],uv:number[],col:number[]};
const D=POINT_PRIM.datum, tau=Math.PI*2, PHI=-Math.PI/12;
const crownR=(h:number)=>POINT_PRIM.fitRadiusAtDatum+POINT_PRIM.dr*(h-D);
const around=(r:number,h:number,a:number):P=>[r*Math.cos(a),h-D,r*Math.sin(a)];
const A=(i:number,n=12)=>PHI+tau*i/n;
const east=[1,0,0] as P, up=[0,1,0] as P;
const white=[1,1,1] as P;
const add=(a:P,b:P):P=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
 mul=(a:P,s:number):P=>[a[0]*s,a[1]*s,a[2]*s], dot=(a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross=(a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 unit=(a:P):P=>mul(a,1/(Math.hypot(...a)||1));
const vuv=(p:P):UV=>[p[0],p[1]];
const gvec=(a:number):P=>[Math.cos(a),0,Math.sin(a)];
const lrp=(a:P,b:P,t:number)=>add(a,mul(sub(b,a),t));
const fnormal=(r:number)=>unit([Math.cos(r),-POINT_PRIM.dr,Math.sin(r)]);
const ST=Array.from({length:12},(_,i)=>i);
const rang=(a:number,b:number,n:number)=>Array.from({length:n+1},(_,j)=>a+(b-a)*j/n);
const sorted=(a:number[])=>[...new Set(a)].sort((a,b)=>a-b);
function material(role:Role, textured:boolean) {
 const [c,r,m]=STYLES[role];
 const q=new T.MeshStandardMaterial({color:c,roughness:r,metalness:m,vertexColors:true,side:T.FrontSide});
 q.name=role;
 if(role==='shingle'&&textured){q.color.set(0xffffff);q.map=makePaintMap();}
 return q;
}
class Maker {
 public readonly by=new Map<Role,Data>();
 tri(role:Role,a:P,b:P,c:P,n?:P,UVS?:UV[], NS?:P[], C?:P[]) {
  let f=cross(sub(b,a),sub(c,a)); if(Math.hypot(...f)<1e-10)return;
  if(n&&dot(f,n)<0){[b,c]=[c,b];if(UVS)[UVS[1],UVS[2]]=[UVS[2],UVS[1]];if(NS)[NS[1],NS[2]]=[NS[2],NS[1]];if(C)[C[1],C[2]]=[C[2],C[1]];f=mul(f,-1);}
  f=unit(f);const t=this.by.get(role)??{p:[],n:[],uv:[],col:[]};
  if(!this.by.has(role))this.by.set(role,t);
  for(const [i,v] of [a,b,c].entries()){
   t.p.push(...v);t.n.push(...(NS?.[i]??f));t.uv.push(...(UVS?.[i]??vuv(v)));t.col.push(...(C?.[i]??white));
  }
 }
 quad(role:Role,a:P,b:P,c:P,d:P,n?:P,C?:[P,P,P,P], UVS?:[UV,UV,UV,UV], NS?:[P,P,P,P]){
  this.tri(role,a,b,d,n,UVS&&[UVS[0],UVS[1],UVS[3]],NS&&[NS[0],NS[1],NS[3]],C&&[C[0],C[1],C[3]]);
  this.tri(role,b,c,d,n,UVS&&[UVS[1],UVS[2],UVS[3]],NS&&[NS[1],NS[2],NS[3]],C&&[C[1],C[2],C[3]]);
 }
 // 12-gon in U/V; use n=12/24/48 multiples so gallery joints share vertices.
 band(role:Role,ra:number,h0:number,rb:number,h1:number,n=12){
  for(let i=0;i<n;i++){
   const a=A(i,n),b=A(i+1,n);
   this.quad(role,around(ra,h0,a),around(ra,h0,b),around(rb,h1,b),around(rb,h1,a),gvec((a+b)/2));
  }
 }
 flat(role:Role,ri:number,ro:number,h:number,top:boolean,n=12){
  for(let i=0;i<n;i++){
   const a=A(i,n),b=A(i+1,n);
   this.quad(role,around(ri,h,a),around(ri,h,b),around(ro,h,b),around(ro,h,a),mul(up,top?1:-1));
  }
 }
 tube(role:Role,a:P,b:P,r0:number,r1:number,n=6){
  const q=unit(sub(b,a)),s=unit(cross(q,Math.abs(q[1])>.95?east:up)),v=cross(q,s);
  const both=(k:number,r:number,p:P)=>add(p,add(mul(s,r*Math.cos(tau*k/n)),mul(v,r*Math.sin(tau*k/n))));
  for(let i=0;i<n;i++){
   const A0=both(i,r0,a),A1=both(i+1,r0,a),B1=both(i+1,r1,b),B0=both(i,r1,b);
   this.quad(role,A0,A1,B1,B0,unit(sub(lrp(A0,A1,.5),a)));
   this.tri(role,a,A1,A0,mul(q,-1));this.tri(role,b,B0,B1,q);
  }
 }
 group(tier:Tier,textured:boolean){
  const g=new T.Group();g.name='Detached Point Prim '+tier+' exterior';
  for(const [k,v]of this.by){
   const x=new T.BufferGeometry();
   x.setAttribute('position',new T.Float32BufferAttribute(v.p,3));x.setAttribute('normal',new T.Float32BufferAttribute(v.n,3));
   x.setAttribute('uv',new T.Float32BufferAttribute(v.uv,2));x.setAttribute('color',new T.Float32BufferAttribute(v.col,3));x.computeBoundingBox();x.computeBoundingSphere();
   const o=new T.Mesh(x,material(k,textured));o.name=k;o.castShadow=true;o.receiveShadow=true;g.add(o);
  }
  g.updateMatrixWorld(true);return g;
 }
}
const window=(y0:number,y1:number,w:number,a:number,name:W['name']):W=>{
 const theta=Math.asin(w/(2*crownR((y0+y1)/2)));return {y0,y1,a0:a-theta,a1:a+theta,name};
};
// No approach/stairs. Lowest screened west window and three groups of painted sash are visible reference facts.
const openings:readonly W[]=[
 window(4.875,6.978,.93,.0,'door'),window(6.285,7.651,.84,Math.PI,'mesh'),
 window(10.101,11.239,.82,Math.PI,'pane'),window(13.450,14.547,.79,Math.PI,'pane'),
 window(16.911,18.002,.75,Math.PI,'pane')
];
function shaft(q:Maker,tier:Tier){
 const t0=-Math.PI/2;
 const curves=sorted([...rang(t0,t0+tau,tier==='close'?96:40),...ST.map(i=>{const a=A(i);return a<t0?a+tau:a>=t0+tau?a-tau:a}),...openings.flatMap(o=>[o.a0,o.a1])]).filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>1e-10);
 const H=sorted([4.875,19.515,...openings.flatMap(o=>[o.y0,o.y1])]);
 const cut=.147,rim=3.710;
 const S=(h:number,t:number,d=0)=>around(crownR(h)-d,h,t);
 for(let i=0;i<curves.length-1;i++){
  const a=curves[i],b=curves[i+1],t=(a+b)/2;
  // Continuous original parged plinth; matching top radius and same exact xz at the course split.
  q.quad('foundation',around(rim,4.47,a),around(rim,4.47,b),around(rim,4.725,b),around(rim,4.725,a),gvec(t));
  q.quad('foundation',around(rim,4.725,a),around(rim,4.725,b),S(4.875,b),S(4.875,a),gvec(t));
  q.tri('foundation',around(0,4.47,a),around(rim,4.47,a),around(rim,4.47,b),mul(up,-1));
  for(let j=0;j<H.length-1;j++){
   const y=H[j],Y=H[j+1],m=(y+Y)*.5, om=openings.find(w=>w.a0<t&&t<w.a1&&w.y0<m&&m<w.y1);
   if(om){
    if(y===om.y0)q.quad('reveal',S(y,a),S(y,b),S(y,b,cut),S(y,a,cut),up);
    if(Y===om.y1)q.quad('reveal',S(Y,a),S(Y,b),S(Y,b,cut),S(Y,a,cut),mul(up,-1));
    // Fully closed lower sash / door back with denser subdivisions at the body seam.
    q.quad(om.name==='pane'?'sash':om.name==='door'?'redShade':'metal',S(y,a,cut),S(y,b,cut),S(Y,b,cut),S(Y,a,cut),gvec(t));
    continue;
   }
   const tex=(h:number,t:number):UV=>[(t-t0)/tau,(h-4.875)/(19.515-4.875)];
   q.quad('shingle',S(y,a),S(y,b),S(Y,b),S(Y,a),gvec(t),undefined,
    [tex(y,a),tex(y,b),tex(Y,b),tex(Y,a)],[fnormal(a),fnormal(b),fnormal(b),fnormal(a)]);
  }
 }
 for(const w of openings){
  const {a0,a1,y0,y1}=w,aw=a1-a0,m=(a0+a1)/2;
  const T=(d:number,h:number,z:number)=>S(h,a0+aw*d,z);
  q.quad('reveal',S(y0,a0),S(y0,a0,cut),S(y1,a0,cut),S(y1,a0),gvec(a0+Math.PI/2));
  q.quad('reveal',S(y0,a1),S(y0,a1,cut),S(y1,a1,cut),S(y1,a1),gvec(a1-Math.PI/2));
  function insert(role:Role,d0:number,d1:number,y:number,Y:number,dep:number,sp=3,c?:[P,P,P,P]){
   const u=rang(d0,d1,sp);
   for(let i=0;i<u.length-1;i++)q.quad(role,T(u[i],y,dep),T(u[i+1],y,dep),T(u[i+1],Y,dep),T(u[i],Y,dep),gvec(m),c);
  }
  if(w.name==='door'){
   // Dimensional painted panel door with two inset fields and a rain hood; no copied plaque.
   insert('red',.04,.96,y0+.038,y1-.07,.111);
   insert('redShade',.15,.85,y0+.25,y0+.91,.095);insert('redShade',.15,.85,y0+1.11,y1-.255,.095);
   insert('red',-.075,1.075,y1-.035,y1+.082,-.028);
   insert('ivory',-.024,.025,y0+.035,y1+.018,.013);insert('ivory',.975,1.025,y0+.035,y1+.018,.013);
   q.quad('red',T(-.075,y1+.082,-.021),T(1.075,y1+.082,-.021),T(1.075,y1+.084,.116),T(-.075,y1+.084,.116),up);
   q.tube('metal',T(.77,y0+.963,.084),T(.77,y0+.963,.052),.025,.024,6);
  }else{
   insert('ivory',.015,.073,y0+.022,y1-.018,.039);
   insert('ivory',.927,.984,y0+.022,y1-.018,.039);
   insert('ivory',.019,.981,y1-.093,y1-.016,.041);
   insert('red',-.045,1.045,y0-.022,y0+.046,-.035,4);
   const foot=7;
   for(let i=0;i<foot;i++){
    const a=-.045+i*1.09/foot,b=-.045+(i+1)*1.09/foot;
    q.quad('red',T(a,y0+.046,-.035),T(b,y0+.046,-.035),T(b,y0+.055,.101),T(a,y0+.055,.101),up);
   }
   if(w.name==='pane'){
    const c0=[.81,.86,.87] as P,c1=[1.10,1.13,1.12] as P;
    insert('sash',.073,.927,y0+.067,y1-.10,.126,4,[c0,c0,c1,c1]);
    for(const u of [1/3,2/3])insert('ivory',u-.019,u+.019,y0+.061,y1-.085,.092,1);
    for(const a of [.329,.665]){const h=y0+(y1-y0)*a;insert('ivory',.068,.932,h-.019,h+.021,.083);}
   }else if(tier==='close'){
    for(const a of rang(.13,.87,16))insert('metal',a-.005,a+.005,y0+.075,y1-.13,.108,1);
    for(const a of rang(.15,.89,12))insert('reveal',.12,.88,y0+a*(y1-y0)-.009,y0+a*(y1-y0)+.009,.112,4);
   }
  }
 }
 // Shaft capture never pretends to resolve geometry of individual small air slots.
 if(tier==='close')for(let i=0;i<24;i++){
  const a=A(i,24)+.031,y0=18.162,y1=18.215,delta=.016;
  q.quad('reveal',S(y0-.013,a-delta*1.45,-.024),S(y0-.013,a+delta*1.45,-.024),S(y1+.013,a+delta*1.45,-.024),S(y1+.013,a-delta*1.45,-.024),gvec(a));
  q.quad('metal',S(y0,a-delta,-.028),S(y0,a+delta,-.028),S(y1,a+delta,-.028),S(y1,a-delta,-.028),gvec(a));
 }
 // Under-deck annular seal meets the finer barrel at the shared silhouette.
 for(let i=0;i<curves.length-1;i++){
  const a=curves[i],b=curves[i+1],rad=(t:number)=>{
   const idx=Math.floor((t-PHI)/(tau/12)),normal=A(idx)+tau/24;
   return 3.019*Math.cos(Math.PI/12)/Math.cos(t-normal);
  };
  q.quad('ivory',S(19.515,a),S(19.515,b),around(rad(b),19.515,b),around(rad(a),19.515,a),mul(up,-1));
 }
}
function bracket(q:Maker,a:number,tier:Tier){
 const foot=(y:number)=>crownR(y)-.045;
 const d=tier==='close'?[
  [foot(18.465),18.465],[1.989,18.461],[2.032,18.515],[2.074,18.712],
  [2.233,18.995],[2.417,19.214],[2.695,19.363],[2.91,19.405],[3.026,19.510],
  [foot(19.54),19.54]
 ]:[[foot(18.465),18.465],[2.,18.461],[2.120,18.81],[2.440,19.240],[3.006,19.510],[foot(19.54),19.54]];
 const left=gvec(a-Math.PI/2), right=mul(left,-1), radial=gvec(a);
 const W=(r:number,h:number,sign:number)=>add(around(r,h,a),mul(left,sign*(.063+(h-18.4)*.019)));
 const V=d.map(c=>new T.Vector2(c[0],c[1])),tri=T.ShapeUtils.triangulateShape(V,[]);
 for(const [i,j,k]of tri){
  q.tri('ivory',W(...d[i] as [number,number],1),W(...d[j] as [number,number],1),W(...d[k] as [number,number],1),left);
  q.tri('ivory',W(...d[i] as [number,number],-1),W(...d[j] as [number,number],-1),W(...d[k] as [number,number],-1),right);
 }
 const how=d.reduce((sum,p,i)=>{const b=d[(i+1)%d.length];return sum+p[0]*b[1]-b[0]*p[1];},0)<0?-1:1;
 for(let i=0;i<d.length;i++){
  const s=d[i] as [number,number],t=d[(i+1)%d.length] as [number,number];
  q.quad('ivory',W(...s,1),W(...t,1),W(...t,-1),W(...s,-1),
   mul(add(mul(radial,t[1]-s[1]),mul(up,s[0]-t[0])),how));
 }
}
function lantern(q:Maker,tier:Tier){
 const R=POINT_PRIM.deckRadius, g=POINT_PRIM.deck, L=POINT_PRIM.lightBodyRadius, br=3.088;
 // Main y values match the training plate; small fascia/trim levels are intentionally nominal.
 q.band('ivory',3.019,19.515,R-.039,19.594);
 q.band('redShade',R-.039,19.594,R-.015,19.664);
 q.band('red',R-.015,19.664,R,19.757);
 q.band('ivory',R,19.757,R-.015,g);
 q.flat('deck',L+.036,R-.015,g,true);
 for(const i of ST)bracket(q,A(i)+Math.PI/12,tier);

 q.band('redShade',L+.036,g,L+.036,19.952);
 q.band('red',L+.036,19.952,L,20.393);
 q.band('redShade',L,20.393,L+.013,20.538);
 q.flat('redShade',L,L+.013,20.538,true);
 const topH=22.571, botH=20.538, roofR=POINT_PRIM.capR, edge=POINT_PRIM.capEave, endH=POINT_PRIM.capTop;
 for(const i of ST){
  const a=A(i),b=A(i+1),t=(a+b)/2, n=gvec(t);
  const enc=(u:number,y:number,r:number=L)=>lrp(around(r,y,a),around(r,y,b),u);
  const dark=(i===0||i===1);
  const darkLow=[.73,.77,.78] as P,darkHigh=[1.07,1.10,1.14] as P;
  q.quad(dark?'red':'lantern',enc(0,botH),enc(1,botH),enc(1,topH),enc(0,topH),n,dark?undefined:[darkLow,darkLow,darkHigh,darkHigh]);
  if(!dark){
   q.quad('metal',enc(0,botH-.009,L+.012),enc(1,botH-.009,L+.012),enc(1,botH+.064,L+.012),enc(0,botH+.064,L+.012),n);
   q.quad('metal',enc(0,topH-.064,L+.013),enc(1,topH-.064,L+.013),enc(1,topH+.003,L+.013),enc(0,topH+.003,L+.013),n);
  }
  if(tier==='close'){
   // Modest bolted cast-panel inset and outer flange, original suggestion of observed red spandrel shape.
   const y1=20.323,y0=19.968;
   for(let k=0;k<3;k++){
    const [u,v]=[.18+k*.205,.18+(k+1)*.205],shape=(h:number)=>h+((k===0||k===2)?-.036:0);
    q.quad('redShade',enc(u,y0,L+.022),enc(v,y0,L+.022),enc(v,shape(y1),L+.022),enc(u,shape(y1),L+.022),n);
    q.quad('red',enc(u+.008,y0+.023,L+.026),enc(v-.008,y0+.023,L+.026),enc(v-.008,shape(y1)-.034,L+.026),enc(u+.008,shape(y1)-.034,L+.026),n);
   }
   if(dark)q.quad('redShade',enc(.09,botH+.05,L+.015),enc(.106,botH+.05,L+.015),enc(.106,topH-.064,L+.015),enc(.09,topH-.064,L+.015),n);
  }
  q.tube(dark?'redShade':'metal',around(L+.014,botH-.005,a),around(L+.014,topH+.033,a),.025,.025,tier==='close'?6:4);
  // Guard rails and the fine even-pitch diagonal stay rods in the documented gallery.
  const bars=tier==='close'?6:4;
  q.tube('red',around(br,g-.005,a),around(br,20.708,a),.029,.027,bars);
  for(const h of [20.176,20.680])q.tube('red',around(br,h,a),around(br,h,b),.027,.027,bars);
  if(tier==='close'||i%2===0)q.tube('redShade',around(br,20.675,a),around(L+.080,22.706,a),.015,.014,bars);
  if(tier==='close'){
   q.tube('red',around(roofR-.018,edge+.032,a),around(.25,endH+.021,a),.009,.010,4);
  }
 }
 q.band('red',L,topH,L+.095,22.746);
 q.band('redShade',L+.095,22.746,roofR,22.776);
 q.band('red',roofR,22.776,roofR,edge);
 q.band('red',roofR,edge,.275,endH);
 // Mechanical-looking silhouette only, not a lamp, alignment or functioning navigation aid.
 q.band('redShade',.275,endH,.279,endH+.065);
 q.flat('redShade',.188,.279,endH+.065,true);
 q.band('red',.188,endH+.065,.173,23.983);
 q.flat('red',0,.173,23.983,true);
 const v0=unit([.31,0,-.951]),v1=cross(v0,up);
 const fin=(s:number,h:number,t:number):P=>add([0,h-D,0],add(mul(v0,s),mul(v1,t)));
 const hh=24.106;
 q.tube('red',fin(-.282,hh-.07,0),fin(.210,hh,0),.022,.176,tier==='close'?8:6);
 const cc=fin(.223,hh+.095,0), rc=.167, N=tier==='close'?16:10;
 for(let k=0;k<N;k++){
  const angle=tau*k/N,b=tau*(k+1)/N;
  const cv=(t:number,f:number)=>add(cc,add(mul(up,rc*Math.sin(t)),add(mul(v0,rc*Math.cos(t)),mul(v1,.014*f))));
  q.tri('red',add(cc,mul(v1,.014)),cv(angle,1),cv(b,1),v1);
  q.tri('red',add(cc,mul(v1,-.014)),cv(angle,-1),cv(b,-1),mul(v1,-1));
  q.quad('redShade',cv(angle,-1),cv(b,-1),cv(b,1),cv(angle,1),add(mul(up,Math.sin((angle+b)/2)),mul(v0,Math.cos((angle+b)/2))));
 }
 q.tube('metal',fin(.222,24.361,0),fin(.222,24.383,0),.011,.005,4);
}
/** Original deterministic RGBA. One OPTIONAL 1024² surface (4.0MiB base, ~5.33MiB with mips), no photo or load. */
export function paintPixels(w=1024,h=1024){
 const result=new Uint8Array(w*h*4);
 function hsh(x:number,y:number){
  let s=Math.imul(x+319,1597334677)^Math.imul(y+791,3812015801);
  s=Math.imul(s^(s>>>15),2246822519);return ((s^(s>>>13))>>>0)/4294967295;
 }
 for(let j=0;j<h;j++){
  const v=(j+.5)/h,height=14.64*v,row=Math.floor(height/.111),r=height/.111-row;
  const n=Math.max(43,Math.round(tau*crownR(4.875+height)/.203)); // periodic irregularity follows physical course circumference
  const f=hsh(row,593)*.87;
  for(let i=0;i<w;i++){
   const u=(i+.5)/w, s=u*n+f, ix=((Math.floor(s)%n)+n)%n,d=s-Math.floor(s);
   const k1=hsh(ix,row),k2=hsh(ix+193,row);
   const ab=(k1-.5)*.032+(hsh(row,328)-.5)*.013;
   const lap=.107*Math.exp(-r/.056) + .026*Math.exp(-r/.176);
   const joint=(1.0-Math.min(1,Math.min(d,1-d)/(.037+.025*k2)))*(.014+.012*k1)*(1-.68*r);
   const weather=.024*Math.exp(-height/1.02)*(0.65+.35*Math.sin(tau*(3*u+.16)))+.014*Math.sin(tau*(5*u+.31*v))*(.52+.48*Math.sin(tau*(u*.0+v*1.09)));
   const gain=1+ab-lap-joint-weather, off=(j*w+i)*4;
   result[off]=Math.round(233*gain);result[off+1]=Math.round(232*gain);result[off+2]=Math.round(224*gain);result[off+3]=255;
  }
 }
 return result;
}
export function makePaintMap(){
 const t=new T.DataTexture(paintPixels(),1024,1024,T.RGBAFormat);t.name='Original procedural painted cedar';
 t.colorSpace=T.SRGBColorSpace;t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;
 t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}
export function buildPointPrim(tier:Tier='close',textured=false){
 const q=new Maker();
 shaft(q,tier);lantern(q,tier);
 return q.group(tier,textured);
}
