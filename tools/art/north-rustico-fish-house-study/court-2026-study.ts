import {BufferAttribute,BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,type Material} from 'three';
import {makeCourtFishHouseStudy,originalCourtCore,type CourtMaterialFactory} from './court-fishhouse-study.ts';
import {courtFinish} from './court-finish.ts';

/** Limited visual comparison inspired by a September 2026 travel post.
 * The local floor and the old scene are not controlled by this detached asset.
 * Materials are original approximate swatches, not source RGB. */
export const COURT_2026_SWATCH=Object.freeze({
 'landward-yellow':0xd9b64a,'weathered-southeast':0xc5b775,'red-leaf':0x95473b,
 'annex-paint':0xd0b251,'annex-roof':0x5c5951,'annex-fascia':0xd2cbbc,
});
export type Court2026Options=Readonly<{paint?:boolean;redDoor?:boolean;annex?:boolean;otherMaterial?:CourtMaterialFactory}>;
type P2=readonly [number,number];
type P3=readonly [number,number,number];
type Attrs={p:number[];n:number[];uv:number[]};
type Vert={p:P3;n:P3;uv:P2};
type Draw=Mesh<BufferGeometry,Material>;
const ID={
 sourceNE:'court / period/plywood', sourceSE:'court / period/shingle',
 paintedSE:'court / 2026 weathered SE',doorTrim:'court / 2026 NE red-door surround',
 door:'court / 2026 opaque red leaf', annexGroup:'court / 2026 schematic projection only',
 annexWall:'court / 2026 bounded annex wall shell',annexTop:'court / 2026 bounded annex lean cap',
 annexSoffit:'court / 2026 detached annex underside',annexFascia:'court / 2026 bounded annex fascia',
} as const;
export const COURT_2026_NAMES=Object.freeze({...ID});
const bounds=originalCourtCore().cornersUV;
const FROM=bounds[3],TO=bounds[0], DU=TO[0]-FROM[0], DV=TO[1]-FROM[1],L=Math.hypot(DU,DV);
const uFace=(v:number)=>FROM[0]+DU*(v-FROM[1])/DV;
const surface=(s:number,y:number,d=0):P3=>[FROM[1]+DV/L*s+DU/L*d,y,-FROM[0]-DU/L*s+DV/L*d];
const c=L*.70;
const D0=c-.445,D1=c+.445,Y0=.056,Y1=1.966,RECESS=.106,TRIM=.045;
const L0=D0-TRIM,L1=D1+TRIM,B0=Y0-TRIM,B1=Y1+TRIM;
const ANNEX_2026={v0:-3.2,v1:-.8,max:1.,seatOverlap:.024,yBack:2.34,yFront:2.13,fascia:.09} as const;
export function court2026Restraints(){
 return {cameraLocal:true,wallFrom:FROM,wallTo:TO,coreWidth:L,
  redDoor:{outer:[L0,L1,B0,B1],inner:[D0,D1,Y0,Y1],recess:RECESS},
  annex:{...ANNEX_2026,backV:[ANNEX_2026.v0,ANNEX_2026.v1]}};
}
const attr=():Attrs=>({p:[],n:[],uv:[]});
const v3=(a:BufferAttribute,n:number):P3=>[a.getX(n),a.getY(n),a.getZ(n)];
function vertex(a:BufferGeometry,i:number):Vert{
 const u=a.getAttribute('uv') as BufferAttribute;
 return {p:v3(a.getAttribute('position') as BufferAttribute,i),n:v3(a.getAttribute('normal') as BufferAttribute,i),uv:[u.getX(i),u.getY(i)]};
}
function copy(a:Attrs,v:Vert){ a.p.push(...v.p);a.n.push(...v.n);a.uv.push(...v.uv); }
const dist=(a:P3,b:P3)=>Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
function cross(a:P3,b:P3,c:P3):P3{
 const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],i=c[0]-a[0],j=c[1]-a[1],k=c[2]-a[2];
 return [y*k-z*j,z*i-x*k,x*j-y*i];
}
function addPolygon(a:Attrs,v:readonly Vert[]){
 for(let i=1;i+1<v.length;i++){
  const A=v[0],B=v[i],C=v[i+1];
  if(Math.hypot(...cross(A.p,B.p,C.p))>1e-8){copy(a,A);copy(a,B);copy(a,C);}
 }
}
function interp(a:Vert,b:Vert,t:number):Vert{
 const q=(a:number,b:number)=>a+(b-a)*t;
 return {p:[q(a.p[0],b.p[0]),q(a.p[1],b.p[1]),q(a.p[2],b.p[2])],
  n:[q(a.n[0],b.n[0]),q(a.n[1],b.n[1]),q(a.n[2],b.n[2])],uv:[q(a.uv[0],b.uv[0]),q(a.uv[1],b.uv[1])]};
}
function clip(a:readonly Vert[],d:(n:Vert)=>number){
 const b:Vert[]=[];for(let i=0;i<a.length;i++){
  const p=a[i],q=a[(i+1)%a.length],v=d(p),w=d(q);
  if(v>=0)b.push(p);
  if(v*w<0)b.push(interp(p,q,v/(v-w)));
 }return b;
}
function geometry(a:Attrs){
 const g=new BufferGeometry();
 g.setAttribute('position',new Float32BufferAttribute(a.p,3));g.setAttribute('uv',new Float32BufferAttribute(a.uv,2));
 if(a.n.length===a.p.length)g.setAttribute('normal',new Float32BufferAttribute(a.n,3));else g.computeVertexNormals();
 g.computeBoundingSphere();return g;
}
function add(g:Group,a:Attrs,m:Material,name:string){
 const draw=new Mesh(geometry(a),m);draw.name=name;draw.userData.scope='detached September-2026 comparison only';g.add(draw);return draw;
}
function sealed(g:Group,name:string,expected:number):Draw{
 const m=g.getObjectByName(name) as Draw|undefined;
 if(!m?.isMesh||m.geometry.index||m.geometry.getAttribute('position').count!==expected||
  m.geometry.getAttribute('uv').count!==expected||m.geometry.getAttribute('normal').count!==expected)
  throw Error('Unexpected detached 2009 witness: '+name);
 return m;
}
function change(m:Draw,v:Attrs){const old=m.geometry;m.geometry=geometry(v);old.dispose();}
/** Does not copy any photo color into an attribute or mutate older materials. */
function sourceTone(role:'shingle'|'plywood',tone:number){
 const m=courtFinish(role);m.color.set(tone);return m;
}
function simple(name:string,tone:number,roughness=.88){
 return new MeshStandardMaterial({name,color:tone,metalness:0,roughness});
}
function splitSide(g:Group,source:Draw){
 const se=attr(),older=attr(),a=bounds[0],b=bounds[1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
 const on=(p:P3)=>Math.abs((b[0]-a[0])*(p[0]-a[1])-(b[1]-a[1])*(-p[2]-a[0]))/len<1e-6;
 for(let i=0;i<546;i+=3){
  const q=[vertex(source.geometry,i),vertex(source.geometry,i+1),vertex(source.geometry,i+2)];
  addPolygon(q.every(v=>on(v.p))?se:older,q);
 }
 if(se.p.length===0||older.p.length===0||older.p.length+se.p.length!==546*3)
  throw Error('Unsigned SE source split');
 change(source,older);
 add(g,se,sourceTone('shingle',COURT_2026_SWATCH['weathered-southeast']),ID.paintedSE);
}
function quad(g:Attrs,p:readonly [P3,P3,P3,P3],uv:readonly [P2,P2,P2,P2],reverse=false){
 for(const i of reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3]){ g.p.push(...p[i]);g.uv.push(...uv[i]); }
}
function plane(g:Attrs,s0:number,y0:number,s1:number,y1:number,depth:number){
 quad(g,[surface(s0,y0,depth),surface(s1,y0,depth),surface(s1,y1,depth),surface(s0,y1,depth)],
  [[s0,y0],[s1,y0],[s1,y1],[s0,y1]],true);
}
function door(g:Group,source:Draw){
 const body=attr(),trim=attr(),leaf=attr();
 const x0=(v:Vert)=>v.uv[0]-L0,x1=(v:Vert)=>L1-v.uv[0];
 const y0=(v:Vert)=>v.uv[1]-B0,y1=(v:Vert)=>B1-v.uv[1];
 let removed=0;
 for(let i=0;i<96;i+=3){
  const q=[vertex(source.geometry,i),vertex(source.geometry,i+1),vertex(source.geometry,i+2)];
  if(clip(clip(clip(clip(q,x0),x1),y0),y1).length<3){q.forEach(v=>copy(body,v));continue;}
  removed++;
  const main=clip(clip(q,x0),x1);
  addPolygon(body,clip(q,v=>-x0(v)));addPolygon(body,clip(q,v=>-x1(v)));
  addPolygon(body,clip(main,v=>-y0(v)));addPolygon(body,clip(main,v=>-y1(v)));
 }
 if(!removed)throw Error('Period red door is not on the old blank wall');
 change(source,body);
 plane(trim,L0,B0,D0,B1,0);plane(trim,D1,B0,L1,B1,0);
 plane(trim,D0,B0,D1,Y0,0);plane(trim,D0,Y1,D1,B1,0);
 const h=[[D0,Y0],[D1,Y0],[D1,Y1],[D0,Y1]] as const;
 for(let i=0;i<4;i++){
  const a=h[i],b=h[(i+1)%4],w=Math.hypot(b[0]-a[0],b[1]-a[1]),c=surface(a[0],a[1]),d=surface(b[0],b[1]);
  quad(trim,[c,d,surface(b[0],b[1],RECESS),surface(a[0],a[1],RECESS)],[[0,0],[w,0],[w,RECESS],[0,RECESS]],true);
 }
 plane(leaf,D0,Y0,D1,Y1,RECESS);
 add(g,trim,courtFinish('trim'),ID.doorTrim);
 add(g,leaf,simple('Period matte reddish single leaf (no hardware)',COURT_2026_SWATCH['red-leaf'],.79),ID.door);
}
function lowProjection(g:Group){
 const q=ANNEX_2026,p=new Group();p.name=ID.annexGroup;
 p.userData={scope:'Illustrative opaque low silhouette; not surveyed height, fabric, doors or seat'};
 const wall=attr(),roof=attr(),fascia=attr(),floor=attr();
 const footprint=[
  [uFace(q.v0)-q.seatOverlap,q.v0],[uFace(q.v1)-q.seatOverlap,q.v1],
  [uFace(q.v1)+q.max,q.v1],[uFace(q.v0)+q.max,q.v0],
 ] as const;
 const lift=([u,v]:P2,y:number):P3=>[v,y,-u];
 const y=[q.yBack,q.yBack,q.yFront,q.yFront];
 const low=footprint.map(p=>lift(p,0)),high=footprint.map((p,i)=>lift(p,y[i])),strip=footprint.map((p,i)=>lift(p,y[i]-q.fascia));
 for(let i=0;i<4;i++){
  const j=(i+1)%4,w=dist(low[i],low[j]);
  quad(wall,[low[i],low[j],strip[j],strip[i]],[[0,0],[w,0],[w,y[j]-q.fascia],[0,y[i]-q.fascia]]);
  quad(fascia,[strip[i],strip[j],high[j],high[i]],[[0,0],[w,0],[w,q.fascia],[0,q.fascia]]);
 }
 const w=dist(high[0],high[1]),l=dist(high[0],high[3]);
 const uv=[[0,l],[w,l],[w,0],[0,0]] as const;
 quad(roof,[high[0],high[1],high[2],high[3]],uv);
 quad(floor,[low[0],low[1],low[2],low[3]],uv,true);
 add(p,wall,sourceTone('plywood',COURT_2026_SWATCH['annex-paint']),ID.annexWall);
 add(p,roof,simple('Detached graphite-brown annex cap',COURT_2026_SWATCH['annex-roof']),ID.annexTop);
 add(p,fascia,simple('Detached weathered cream fascia',COURT_2026_SWATCH['annex-fascia']),ID.annexFascia);
 add(p,floor,simple('Detached closed slab, no pier',0x786e5d),ID.annexSoffit);
 g.add(p);
}
/** Recreates the immutable 2009 mesh for each comparison. No shared live actors,
 * photo resources, scene imports, map changes or program mutation. */
export function makeCourt2026Study(o:Court2026Options={}){
 const g=makeCourtFishHouseStudy('documented-2009',o.otherMaterial);
 const north=sealed(g,ID.sourceNE,96),southEast=sealed(g,ID.sourceSE,546);
 if(o.paint){
  north.material=sourceTone('plywood',COURT_2026_SWATCH['landward-yellow']);
  splitSide(g,southEast);
 }
 if(o.redDoor)door(g,north);
 if(o.annex)lowProjection(g);
 g.name='Quintin Court Fish House · detached September 2026 view comparison';
 g.userData={
  era:'September 2026 published visit (capture day unverified)',
  compare:{paint:o.paint===true,redDoor:o.redDoor===true,annex:o.annex===true},
  contact:'no dock, pier, terrain, water, footprint replacement or mount',
 };
 return g;
}
