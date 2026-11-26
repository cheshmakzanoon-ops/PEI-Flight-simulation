import { BufferGeometry, Float32BufferAttribute, Group, Mesh, type Material } from 'three';
import { makeBoardwalkTimber, timberRelief, TIMBER_TERMINAL_U_TAG, type TimberVariant } from './boardwalk-timber.ts';

export type WalkPoint=readonly [x:number,z:number];
export type WalkFootprint=readonly [WalkPoint,WalkPoint,WalkPoint];
export type BoardwalkInput={
 /** Registered positions in the native metre coordinate system, in order.
  * No datum inference, relocation, road offsets or source asset reads. */
 centerline:readonly WalkPoint[];
 width:number;
 /** Return the unchanged VISUAL ground in metres. Unknown is undefined. */
 ground:(x:number,z:number)=>number|undefined;
 /** Return literal true only if the ENTIRE emitted triangle is qualified
  * dry, including its edge. Sampling three corners is not this contract. */
 dry:(triangle:WalkFootprint)=>boolean;
 timber?:TimberVariant;
};
type RefuseCode='input'|'length'|'bend'|'self-overlap'|'unsupported'|'wet'|'grade'|'degenerate';
export type BoardwalkResult=
 |{ok:false;reason:RefuseCode;station?:number}
 |{ok:true;group:Group;origin:readonly [number,number,number];receipt:BoardwalkReceipt};
export type BoardwalkReceipt=Readonly<{
 stationLength:number;
 rows:number;
 miterJoins:number;
 bevelJoins:number;
 dryTriangles:number;
 visualGroundSamples:number;
 outlineM2:number;
 sampledMinCapClearance:number;
 sampledMaxCapClearance:number;
 triangles:number;
 draws:2;
}>;
type Node={p:WalkPoint;u:number;v:number};
type Row={n:Node[];part:string;s:number};
type V={x:number;y:number;z:number;u:number;v:number};
type Trio<T>=readonly [T,T,T];
type Section={row:Row;top:V[];low:V[]};
// Nominal timber thickness is a design-era visual comparison only. A shallow
// cap mostly inset into unchanged flat ground is not a new bedding or level.
const EDGE=.022, SHOULDER_DROP=.011, THICKNESS=.0762, CAP_RISE=.041;
const MAX_SPAN=1.25, MAX_MITER=1.38, MAX_GRADE=.21, MAX_LENGTH=2000, MAX_KNOTS=2048;
const LOW_CLEAR=.012, HIGH_CLEAR=.106, EPS=1e-7, CELL=4.0;
const MAX_CELLS_TESTS=180000;
class Refused extends Error{
 readonly code:RefuseCode;
 readonly station?:number;
 constructor(code:RefuseCode,station?:number){super(code);this.code=code;this.station=station;}
}
function refusal(code:RefuseCode,station?:number):never {throw new Refused(code,station);}
const add=(a:WalkPoint,b:WalkPoint,k:number):WalkPoint=>[a[0]+k*b[0],a[1]+k*b[1]];
const diff=(a:WalkPoint,b:WalkPoint):WalkPoint=>[b[0]-a[0],b[1]-a[1]];
const dot=(a:WalkPoint,b:WalkPoint)=>a[0]*b[0]+a[1]*b[1];
const det=(a:WalkPoint,b:WalkPoint)=>a[0]*b[1]-a[1]*b[0];
const dist=(a:WalkPoint,b:WalkPoint)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const left=(d:WalkPoint):WalkPoint=>[-d[1],d[0]];
const same=(a:WalkPoint,b:WalkPoint)=>a[0]===b[0]&&a[1]===b[1];
const fpoint=(p:WalkPoint):WalkPoint=>[Math.fround(p[0]),Math.fround(p[1])];
const lp=(a:number,b:number,t:number)=>a+(b-a)*t;
const plan=(a:V):WalkPoint=>[a.x,a.z];

function simplePolygon(edges:readonly WalkPoint[]){
 // The swept ends and banks must form one simple ring. Grid-index the real
 // projected edges so a province-sized chain doesn't make this a global
 // pairwise scan. Nonadjacent opposite points touching is also a refusal.
 const n=edges.length, grid=new Map<string,number[]>();
 if(n<4)refusal('degenerate');
 let pairs=0,signedArea2=0;
 const isOn=(a:WalkPoint,b:WalkPoint,p:WalkPoint)=>{
  const e=3e-7;
  return p[0]>=Math.min(a[0],b[0])-e&&p[0]<=Math.max(a[0],b[0])+e&&
   p[1]>=Math.min(a[1],b[1])-e&&p[1]<=Math.max(a[1],b[1])+e;
 };
 const meet=(a:WalkPoint,b:WalkPoint,c:WalkPoint,d:WalkPoint)=>{
  const signs=(u:WalkPoint,v:WalkPoint,w:WalkPoint)=>{const x=det(diff(u,v),diff(u,w));return Math.abs(x)<3e-7?0:Math.sign(x);};
  const o=signs(a,b,c),p=signs(a,b,d),q=signs(c,d,a),r=signs(c,d,b);
  return (o*p<0&&q*r<0)||(!o&&isOn(a,b,c))||(!p&&isOn(a,b,d))||(!q&&isOn(c,d,a))||(!r&&isOn(c,d,b));
 };
 for(let i=0;i<n;i++){
  const a=edges[i],b=edges[(i+1)%n];signedArea2+=det(a,b);
  const scan=new Set<number>();
  const keys:string[]=[];
  for(let x=Math.floor((Math.min(a[0],b[0])-1e-6)/CELL);x<=Math.floor((Math.max(a[0],b[0])+1e-6)/CELL);x++){
   for(let z=Math.floor((Math.min(a[1],b[1])-1e-6)/CELL);z<=Math.floor((Math.max(a[1],b[1])+1e-6)/CELL);z++){
    const key=x+','+z;keys.push(key);
    for(const j of grid.get(key)??[])scan.add(j);
   }
  }
  for(const j of scan){
   if(i-j===1||(j===0&&i===n-1))continue;
   if(++pairs>MAX_CELLS_TESTS)refusal('self-overlap');
   if(meet(a,b,edges[j],edges[(j+1)%n]))refusal('self-overlap');
  }
  for(const k of keys){const existing=grid.get(k);if(existing)existing.push(i);else grid.set(k,[i]);}
 }
 if(!(signedArea2>0))refusal('degenerate');
 return signedArea2*.5;
}

function planRows(p:WalkPoint[],half:number){
 const n=p.length,s=[0],d:WalkPoint[]=[];
 for(let i=1;i<n;i++){
  const e=diff(p[i-1],p[i]),l=Math.hypot(...e);
  if(l<.08||!Number.isFinite(l))refusal('input',s[i-1]);
  s.push(s[i-1]+l);d.push([e[0]/l,e[1]/l]);
 }
 if(s[n-1]>MAX_LENGTH)refusal('length',s[n-1]);
 const rail=[-half,-half+EDGE,0,half-EDGE,half];
 const simple=(c:WalkPoint,normal:WalkPoint,idx:number):Row=>({
  n:rail.map(u=>({p:add(c,normal,u),u,v:s[idx]})),part:'k'+idx,s:s[idx]
 });
 const first=simple(p[0],left(d[0]),0),last=simple(p[n-1],left(d[n-2]),n-1);
 const turns:{before:Row;after:Row}[]=[{before:first,after:first}];
 let miter=0,bevel=0;
 for(let i=1;i<n-1;i++){
  const a=d[i-1],b=d[i],q=dot(a,b),t=det(a,b);
  if(q<-.63)refusal('bend',s[i]); // no hairpin; never fold strip back on itself
  const na=left(a),nb=left(b);
  const bisect=add(na,nb,1),f=1/dot(bisect,nb);
  const cut:WalkPoint=[bisect[0]*f,bisect[1]*f];
  if(Math.hypot(...cut)<=MAX_MITER){
   const common=simple(p[i],cut,i);
   if(Math.abs(t)>1e-6)miter++;
   turns.push({before:common,after:common});continue;
  }
  // Two station rows only on the outer corner. The inner widths share the
  // actual miter and UV and produce no duplicate or zero-area triangles.
  const outer=t>0?-1:1,shunt=half*Math.sqrt(Math.max(0,(1-q)*.5));
  const split=(normal:WalkPoint,sign:number):Row=>({
   n:rail.map(u=>u*outer>0?
    {p:add(p[i],normal,u),u,v:s[i]+sign*shunt*(Math.abs(u)/half)}:
    {p:add(p[i],cut,u),u,v:s[i]}),
   part:'k'+i,s:s[i],
  });
  turns.push({before:split(na,-1),after:split(nb,1)});bevel++;
 }
 turns.push({before:last,after:last});
 const rows:Row[]=[first];
 for(let i=0;i<n-1;i++){
  const a=turns[i].after,b=turns[i+1].before,len=s[i+1]-s[i];
  // Each real rail has to advance. Even a modest angle can invert a very
  // short original segment near the inside of successive bends.
  for(let j=0;j<5;j++)if(dot(diff(a.n[j].p,b.n[j].p),d[i])<.017||b.n[j].v-a.n[j].v<.012)refusal('bend',s[i]);
  const spans=Math.ceil(len/MAX_SPAN);
  for(let j=1;j<spans;j++){
   const t=j/spans;
   rows.push({n:a.n.map((q,k)=>({
    p:[lp(q.p[0],b.n[k].p[0],t),lp(q.p[1],b.n[k].p[1],t)],
    u:q.u,v:lp(q.v,b.n[k].v,t),
   })),part:'s'+i+':'+j,s:lp(s[i],s[i+1],t)});
  }
  rows.push(b);
  if(b!==turns[i+1].after)rows.push(turns[i+1].after);
 }
 return {rows:rows.map(row=>({...row,n:row.n.map(q=>({p:fpoint(q.p),u:Math.fround(q.u),v:Math.fround(q.v)}))})),
  length:s[n-1],miter,bevel};
}

class Writer{
 readonly pos:number[]=[];
 readonly uv:number[]=[];
 readonly ind:number[]=[];
 private readonly ids=new Map<string,number>();
 add(v:V,label:string){
  const key=JSON.stringify([label,v.x,v.y,v.z,v.u,v.v]);
  const old=this.ids.get(key);if(old!==undefined)return old;
  const id=this.pos.length/3;this.pos.push(v.x,v.y,v.z);this.uv.push(v.u,v.v);this.ids.set(key,id);
  return id;
 }
 tri(v:Trio<V>,label:string){this.ind.push(...v.map(q=>this.add(q,label)));}
 build(){
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(this.pos,3));
  g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));
  g.setIndex(this.ind);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  return g;
 }
}
function attach(group:Group,shape:Writer,material:Material,role:'deck'|'edge'){
 const mesh=new Mesh(shape.build(),material);
 mesh.name='Detached timber cap / '+role;mesh.userData={role,visualOnly:true};
 group.add(mesh);
}
function build(input:BoardwalkInput):BoardwalkResult {
 if(!input||!Array.isArray(input.centerline)||input.centerline.length<2||input.centerline.length>MAX_KNOTS||
  !Number.isFinite(input.width)||input.width<.65||input.width>5.0||typeof input.ground!=='function'||typeof input.dry!=='function'||
  (input.timber!==undefined&&input.timber!=='flat'&&input.timber!=='tone'&&input.timber!=='full'&&!timberRelief(input.timber)))refusal('input');
 const {ground,dry,width,timber}=input, raw:WalkPoint[]=Array.from(input.centerline,k=>{
  const valid=(f:unknown)=>typeof f==='number'&&Number.isFinite(f)&&Math.abs(f)<1e7;
  if(!Array.isArray(k)||k.length!==2||!valid(k[0])||!valid(k[1]))refusal('input');
  return [k[0],k[1]];
 });
 // 32-bit anchor keeps relative buffers stable at true island-scale X/Z,
 // while requiring exact dry qualification of the eventual local triangles.
 const ox=Math.fround(raw[0][0]),oz=Math.fround(raw[0][1]);
 const p:WalkPoint[]=raw.map(k=>[k[0]-ox,k[1]-oz]);
 const f=planRows(p,width*.5), rows=f.rows;
 const heights=new Map<string,number>();
 function lookup(pt:WalkPoint,station:number){
  const x=pt[0]+ox,z=pt[1]+oz,key=x+','+z;
  const prev=heights.get(key);if(prev!==undefined)return prev;
  let y:number|undefined;
  try {y=ground(x,z);}catch {refusal('unsupported',station);}
  if(typeof y!=='number'||!Number.isFinite(y)||Math.abs(y)>1e4)refusal('unsupported',station);
  heights.set(key,y);return y;
 }
 const oy=Math.fround(lookup(fpoint(p[0]),0)),rowTop=new Map<string,number>();
 for(const r of rows){
  const max=Math.max(...r.n.map(q=>lookup(q.p,r.s)));
  rowTop.set(r.part,Math.max(rowTop.get(r.part)??-Infinity,max+CAP_RISE));
 }
 const sections:Section[]=rows.map(row=>{
  const base=rowTop.get(row.part)!-oy;
  const q=(n:Node,y:number):V=>({x:n.p[0],y:Math.fround(y),z:n.p[1],u:n.u,v:n.v});
  return {row,
   top:row.n.map((n,k)=>q(n,base-(k===0||k===4?SHOULDER_DROP:0))),
   low:row.n.map(n=>q(n,base-THICKNESS)),
  };
 });
 // Include the profile across both open ends, not a straight shoulder chord.
 const ring:{high:V;low:V;section:Section}[]=[];
 const addRing=(r:Section,c:number)=>{
  const item={high:r.top[c],low:r.low[c],section:r};
  if(ring.length&&same(plan(ring[ring.length-1].high),plan(item.high)))return;
  ring.push(item);
 };
 for(const r of sections)addRing(r,0);
 for(let c=1;c<5;c++)addRing(sections[sections.length-1],c);
 for(let k=sections.length-2;k>=0;k--)addRing(sections[k],4);
 for(let c=3;c>0;c--)addRing(sections[0],c);
 const area=simplePolygon(ring.map(r=>plan(r.high)));
 const deck=new Writer(),edge=new Writer();
 let tested=0,minGap=Infinity,maxGap=-Infinity,topArea2=0;
 const probes:Trio<number>[]=[[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[.5,0,.5],[0,.5,.5],[1/3,1/3,1/3]];
 function charge(top:Trio<V>,low:Trio<V>,s:number){
  const [a,b,c]=top.map(plan), area=-det(diff(a,b),diff(a,c));
  if(same(a,b)||same(b,c)||same(c,a))return; // shared inner bevel seam
  if(!(area>EPS))refusal('degenerate',s);
  const world=(q:WalkPoint):WalkPoint=>Object.freeze([q[0]+ox,q[1]+oz]);
  const footprint:WalkFootprint=Object.freeze([world(a),world(b),world(c)]);
  let accept:boolean;
  try{accept=dry(footprint);}catch {refusal('unsupported',s);}
  if(accept!==true)refusal('wet',s);
  for(const [u,v,w] of probes){
   const point:WalkPoint=[u*a[0]+v*b[0]+w*c[0],u*a[1]+v*b[1]+w*c[1]];
   const y=u*top[0].y+v*top[1].y+w*top[2].y+oy;
   const gap=y-lookup(point,s);
   if(gap<LOW_CLEAR||gap>HIGH_CLEAR)refusal('grade',s);
   minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);
  }
  topArea2+=area;
  tested++;deck.tri(top,'top');edge.tri([low[0],low[2],low[1]],'under');
 }
 for(let k=1;k<sections.length;k++){
  const a=sections[k-1],b=sections[k],span=b.row.s-a.row.s;
  if(span>0&&Math.abs(a.top[2].y-b.top[2].y)>MAX_GRADE*span)refusal('grade',b.row.s);
  for(let c=0;c<4;c++){
   const high=[a.top[c],a.top[c+1],b.top[c+1],b.top[c]];
   const low=[a.low[c],a.low[c+1],b.low[c+1],b.low[c]];
   charge([high[0],high[1],high[2]],[low[0],low[1],low[2]],b.row.s);
   charge([high[0],high[2],high[3]],[low[0],low[2],low[3]],b.row.s);
  }
 }
 if(!tested||Math.abs(topArea2*.5-area)>Math.max(2e-5,area*1e-7))refusal('degenerate');
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  const end=timberRelief(timber)&&a.section===b.section&&
   (a.section===sections[0]||a.section===sections[sections.length-1]);
  const q=(v:V,lo:number):V=>end?{...v,u:v.u+TIMBER_TERMINAL_U_TAG,v:v.y-lo}:{...v,u:v.y-lo};
  const A=q(a.high,a.low.y),B=q(b.high,b.low.y),C=q(b.low,b.low.y),D=q(a.low,a.low.y);
  edge.tri([A,B,C],'side/'+i);edge.tri([A,C,D],'side/'+i);
 }
 const group=new Group();
 group.name='Detached timber cap';group.userData={visualOnly:true,installAuthority:false,footprintProof:'caller'};
 attach(group,deck,makeBoardwalkTimber('deck',timber),'deck');
 attach(group,edge,makeBoardwalkTimber('edge',timber),'edge');
 const receipt=Object.freeze({stationLength:f.length,rows:sections.length,miterJoins:f.miter,bevelJoins:f.bevel,
  dryTriangles:tested,visualGroundSamples:heights.size,outlineM2:area,sampledMinCapClearance:minGap,
  sampledMaxCapClearance:maxGap,triangles:(deck.ind.length+edge.ind.length)/3,draws:2 as const});
 return {ok:true,group,origin:Object.freeze([ox,oy,oz]),receipt};
}
/** Pure detached preview constructor. No fetch, scene placement, collider,
 * physics, parent transform, route, roads, terrain, grade or water editing. */
export function buildBoardwalkCap(input:BoardwalkInput):BoardwalkResult{
 try{return build(input);}
 catch(err){if(err instanceof Refused)return {ok:false,reason:err.code,...(err.station===undefined?{}:{station:err.station})};throw err;}
}
