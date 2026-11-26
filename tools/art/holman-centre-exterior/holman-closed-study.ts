/** Original, unmounted q132 public-exterior architectural study; no imagery or surveyed degree. */
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,ShapeUtils,Vector2,Vector3,type Material} from 'three'
import {makeHolmanFinish,type HolmanFinish} from './holman-exterior-finish.ts'
import {HOLMAN_PLAN as P} from './holman-plan.generated.ts'

type UV=readonly [number,number]
type XYZ=readonly [number,number,number]
type Role=HolmanFinish
interface Packet {p:number[];n:number[];uv:number[];part:number[];faceRole:string[];rolesCount:Record<string,number>}
const C=1e-7,localY=2.5,baseTop=4.88,lip=.28
const point=(p:UV,y:number):XYZ=>[p[0],y,p[1]]
const num=(x:number)=>Math.round(x*1e8)/1e8
const L=(a:UV,b:UV,t:number):UV=>[num(a[0]+(b[0]-a[0])*t),num(a[1]+(b[1]-a[1])*t)]
const A=(a:UV,b:UV)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const add=(a:XYZ,b:XYZ)=>a.map((x,i)=>x+b[i]) as [number,number,number]
const s=(a:XYZ,f:number)=>a.map(x=>x*f) as [number,number,number]
const key=(p:UV)=>`${p[0]},${p[1]}`
function clip(points:readonly UV[],u:number,which:number):UV[]{
 const out:UV[]=[]
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],da=(a[0]-u)*which,db=(b[0]-u)*which
  if(da>=-C)out.push(a)
  if((da>C&&db< -C)||(da< -C&&db>C)){
   const p=L(a,b,(u-a[0])/(b[0]-a[0]));out.push([u,p[1]])
  }
 }
 return out.filter((x,i)=>!i||key(x)!==key(out[i-1])).filter((x,i,a)=>i===0||i!==a.length-1||key(x)!==key(a[0]))
}
const stock=P.contour as readonly UV[]
const below=(a:UV,b:UV,p:UV)=>Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))/A(a,b)<2e-6&&
  (p[0]-a[0])*(p[0]-b[0])+(p[1]-a[1])*(p[1]-b[1])<2e-6
const stockEdge=(a:UV,b:UV)=>stock.findIndex((p,i)=>below(p,stock[(i+1)%stock.length],a)&&below(p,stock[(i+1)%stock.length],b))
const mkV=(a:UV)=>new Vector2(...a)
const tess=(outer:UV[],holes:UV[][]=[])=>ShapeUtils.triangulateShape(outer.map(mkV),holes.map(h=>h.map(mkV)))

const roofBy=(name:'west'|'main'|'east',a:UV)=>{
 if(name==='west'){const {beta,origin}=P.west;return beta[0]+beta[1]*(a[1]-origin[1])-localY}
 if(name==='east')return P.east.beta[0]-localY
 const {beta,origin,knots}=P.main;return beta[0]+beta[1]*(a[0]-origin[0])+beta[2]*(a[1]-origin[1])+beta[3]*Math.abs(a[0]-knots[0])-localY
}
interface Opening {shape:UV[]; finish:'glazing'|'curtain';track:string}
const loop=(x:number,min:number,width:number,height:number,arch:number):UV[]=>{
 const r=width*.5,top=min+height-arch,pts:UV[]=[[x-r,min],[x+r,min],[x+r,top]]
 if(arch>0){ for(let k=1;k<=8;k++){const t=k*Math.PI/8;pts.push([x+r*Math.cos(t),top+arch*Math.sin(t)])} }
 else pts.push([x-r,top]);return pts
}
const bounds=[-1,12.8,33,61.5,83] as const
const partRoles=['west','main','main','east'] as const
const alongCenter=(p:UV,q:UV)=>Math.abs(p[0]-q[0])

export function makeHolmanDetached(materialFor:(role:Role)=>Material=makeHolmanFinish){
 const batches=new Map<Role,Packet>(),roles=new Map<string,number>();const spans:{part:number;edge:number;from:number;to:number;area:number}[]=[]
 let currentPart=-1
 const active=(role:Role)=>{let b=batches.get(role);if(!b){b={p:[],n:[],uv:[],part:[],faceRole:[],rolesCount:{}};batches.set(role,b)}return b}
 const emit=(role:Role,ps:readonly [XYZ,XYZ,XYZ],uv:readonly [UV,UV,UV],direction:XYZ,track:string)=>{
  const xy=ps.map(x=>new Vector3(...x));let n=xy[1].clone().sub(xy[0]).cross(xy[2].clone().sub(xy[0]));
  if(n.lengthSq()<2e-18)return
  const orient=n.dot(new Vector3(...direction));const order=orient<0?[0,2,1]:[0,1,2];if(orient<0)n.negate();n=n.normalize()
  const b=active(role);b.part.push(currentPart);b.faceRole.push(track);for(const i of order){b.p.push(...ps[i].map(num));b.n.push(n.x,n.y,n.z);b.uv.push(...uv[i])}
  b.rolesCount[track]=(b.rolesCount[track]??0)+1;roles.set(track,(roles.get(track)??0)+1)
 }
 const panel=(role:Role,qs:XYZ[],uv:UV[],dir:XYZ,track:string)=>{
  for(const ii of tess(uv)){const [a,b,c]=ii;emit(role,[qs[a],qs[b],qs[c]],[uv[a],uv[b],uv[c]],dir,track)}
 }
 const band=(role:Role,out:UV[],holes:Opening[],o:XYZ,x:XYZ,normal:XYZ,scaleU:number,source:string)=>{
  const at=(p:UV,inset=0)=>add(add(o,s(x,p[0])),[normal[0]*-inset,p[1],normal[2]*-inset]);
  const flat=[...out,...holes.flatMap(q=>q.shape)]; const uvAt=(p:UV):UV=>[p[0]+scaleU,p[1]]
  for(const [a,b,c] of tess(out,holes.map(q=>q.shape))){
   // Earcut can bridge collinear adjacent aperture corners using a long segment.
   // Conform every such edge to all exact source aperture positions before writing
   // Float32, or the expanded reveal and opaque wall produce T-junctions.
   const triangle=[a,b,c];const border:UV[]=[];
   for(let i=0;i<3;i++){
    const j=triangle[i],k=triangle[(i+1)%3],p=flat[j],q=flat[k],dx=q[0]-p[0],dy=q[1]-p[1],den=dx*dx+dy*dy;
    border.push(p);if(!(den>0))continue;
    const on=flat.map((r,l)=>({r,l,t:((r[0]-p[0])*dx+(r[1]-p[1])*dy)/den}))
      .filter(({r,l,t})=>l!==j&&l!==k&&t>1e-9&&t<1-1e-9&&Math.abs((r[1]-p[1])*dx-(r[0]-p[0])*dy)<1e-8)
      .sort((a,b)=>a.t-b.t);
    border.push(...on.map(o=>o.r));
   }
   if(border.length===3)emit(role,[at(border[0]),at(border[1]),at(border[2])],[uvAt(border[0]),uvAt(border[1]),uvAt(border[2])],normal,source)
   else{
    const ctr:UV=[(flat[a][0]+flat[b][0]+flat[c][0])/3,(flat[a][1]+flat[b][1]+flat[c][1])/3];
    for(let i=0;i<border.length;i++){
     const p=border[i],q=border[(i+1)%border.length];emit(role,[at(ctr),at(p),at(q)],[uvAt(ctr),uvAt(p),uvAt(q)],normal,source)
    }
   }
  }
  for(const h of holes){
   const q=h.shape,center:[number,number]=[q.reduce((a,b)=>a+b[0],0)/q.length,(Math.min(...q.map(q=>q[1]))+Math.max(...q.map(q=>q[1])))*.5];
   const curtain=h.finish==='curtain';const inner=q.map(([x,y])=>[center[0]+(x-center[0])*(curtain?.964:.815),center[1]+(y-center[1])*(curtain?.986:.849)] as const)
   const d0=curtain?.125:.115,depth=curtain?.191:.218;
   const quad=(role:Role,i:number,j:number,a:UV,b:UV,p:XYZ,q:XYZ,r:XYZ,t:XYZ,track:string)=>{
    const uv=[uvAt(a),uvAt(b),uvAt(inner[j]),uvAt(inner[i])] as const;
    emit(role,[p,q,r],[uv[0],uv[1],uv[2]],normal,track);emit(role,[p,r,t],[uv[0],uv[2],uv[3]],normal,track)
   }
   for(let i=0;i<q.length;i++){
    const j=(i+1)%q.length;
    quad(curtain?'metal':'stoneDetail',i,j,q[i],q[j],at(q[i]),at(q[j]),at(inner[j],d0),at(inner[i],d0),`${h.track}-reveal`)
    // The exact roof planes and shell have no through holes; recessed panes are opaque.
    // Width is not claimed as observed measurement. Tiny planar shadow jambs face aperture interior.
    const p=at(inner[i],d0),u=at(inner[j],d0),v=at(inner[j],depth),w=at(inner[i],depth),
      d3:[number,number,number]=[
       x[0]*(inner[i][1]-inner[j][1]),inner[j][0]-inner[i][0],x[2]*(inner[i][1]-inner[j][1])];
    const jm=curtain?'metal':'stoneDetail';
    const [a,b]=[uvAt(inner[i]),uvAt(inner[j])];
    emit(jm,[p,u,v],[a,b,b],d3,`${h.track}-jamb`);emit(jm,[p,v,w],[a,b,a],d3,`${h.track}-jamb`)
   }
   panel(h.finish,inner.map(p=>at(p,depth)),inner.map(uvAt),normal,h.track)
  }
 }
 const series=(a:UV,b:UV,edge:number,part:number,topMin:number,base:boolean):Opening[]=>{
  // Original approximate near-recognizable rhythm. No millimetric historic window positions, and no new east traffic/street works.
  if(edge<0||![0,1,2,3,4].includes(edge))return [];
  const countLength=A(a,b),holes:Opening[]=[];if(countLength<3.9)return holes;
  const first=stock[edge],end=stock[(edge+1)%stock.length];const sourceLength=A(first,end);
  const at=(t:number)=>t-A(first,a)
  const addLoop=(x:number,y:number,w:number,h:number,c:number,t:string)=>{if(x-w*.5>.59&&x+w*.5<countLength-.59&&y>.29&&y+h<(base?baseTop-.26:topMin-.67))holes.push({shape:loop(x,y,w,h,c),finish:'glazing',track:t})}
  const spacing=edge===0?3.9:edge===1?2.68:edge===2?3.32:edge===4?3.8:2.78;
  const skipCurtain=(x:number,w:number)=>edge===2&&[x-w*.5,x+w*.5].map(d=>a[0]+(b[0]-a[0])*d/countLength).sort((a,b)=>a-b) .every((val,i)=>i===0?val<61.16:val>57.85)
  let t=spacing*.63;
  for(;t<sourceLength-spacing*.48;t+=spacing){
    const x=at(t);if(skipCurtain(x,2.4))continue
    if(base){
     if(edge===0)addLoop(x,1.02,Math.min(spacing*.71,2.80),2.87,0,'waterfront-upper-street-shop')
     else if(edge===1)addLoop(x,1.61,.96,1.83,0,'spring-lower-recess')
     else if(edge===2||edge===4){if(Math.floor(t/spacing)%2===0)addLoop(x,1.10,1.68,2.23,(edge===4)?.46:.22,'trail-lower-masonry-recess')}
    }else {
     const topBlocks=part===0?[6.05]:edge===1?[6.12,9.14,12.10]:edge===0?[6.17,9.45,12.30]:[6.90,10.35];
     for(const [i,y]of topBlocks.entries())addLoop(x,y,edge===0?1.55:edge===1?.95:1.08,edge===0?2.17:1.96,(edge===0&&i>=1)?.43:0,edge===0?'water-street-arch':'harbour-and-spring-timber-case');
    }
  }
  if(edge===2&&alongCenter(a,b)>1.){
   const l=(u:number)=>(u-a[0])*countLength/(b[0]-a[0]);const u=[l(57.85),l(61.16)].sort((a,b)=>a-b);
   if(u[0]>.18&&u[1]<countLength-.18){
    // Ground-to-roof insert observed from two separate dated public views. Its panel modules and placement are approximate.
    const cols=4,ys=base?[.74,baseTop-.31]:[baseTop+.14,topMin-.50];
    for(let k=0;k<cols;k++){
     const w=(u[1]-u[0])/cols, x=u[0]+(k+.5)*w;
     holes.push({shape:loop(x,ys[0],w-.075,ys[1]-ys[0],0),finish:'curtain',track:'modern-south-dark-insert'})
    }
   }
  }
  return holes
 }
 const pieces=partRoles.map((name,idx)=>{
  currentPart=idx
  const ring=clip(clip(stock,bounds[idx],1),bounds[idx+1],-1);
  if(ring.length<3)throw Error('Empty original envelope part');
  const roof=(p:UV)=>roofBy(name,p);
  const pts=ring.map(x=>point(x,roof(x))),bottom=ring.map(x=>point(x,0));
  panel('roof',pts,ring,[0,1,0],`roof-${name}-${idx}`);panel('stoneBase',bottom,ring,[0,-1,0],`sealed-base-${idx}`)
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],len=A(a,b),h0=roof(a),h1=roof(b),m=Math.min(h0,h1),outer=stockEdge(a,b),o=point(a,0),
    dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,x:[number,number,number]=[dx,0,dz],n:[number,number,number]=[dz,0,-dx];
   if(!(len>1.e-6&&m>baseTop+2.))throw Error('Invalid signed envelope cut')
   if(outer<0){
    band('brick',[[0,0],[len,0],[len,baseTop],[0,baseTop]],[],o,x,n,0,'opaque-internal-existing-footprint')
    band('brick',[[0,baseTop],[len,baseTop],[len,h1-lip],[0,h0-lip]],[],o,x,n,0,'opaque-internal-existing-footprint')
    band('brick',[[0,h0-lip],[len,h1-lip],[len,h1],[0,h0]],[],o,x,n,0,'opaque-internal-coping'); continue
   }
   const prior=A(stock[outer],a),footRole=outer===0?'brick':outer<=4?'stoneBase':'brick'
   const ground=series(a,b,outer,idx,m,true),up=series(a,b,outer,idx,m,false)
   band(footRole,[[0,0],[len,0],[len,baseTop],[0,baseTop]],ground,o,x,n,prior,`facade-${outer}-base`)
   band('brick',[[0,baseTop],[len,baseTop],[len,h1-lip],[0,h0-lip]],up,o,x,n,prior,`facade-${outer}-upper`)
   band('stoneDetail',[[0,h0-lip],[len,h1-lip],[len,h1],[0,h0]],[],o,x,n,prior,`facade-${outer}-pale-coping`)
   if(outer===2)spans.push({part:idx,edge:outer,from:a[0],to:b[0],area:len*(h0+h1)*.5})
  }
  return {index:idx,role:name,ring,extents:[Math.min(...ring.map(x=>roof(x))),Math.max(...ring.map(x=>roof(x)))]}
 });
 const group=new Group();group.name='Holman-Centre-exterior-detached-relative-only';
 let triangles=0;
 for(const [role,b]of batches){
  const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(b.p,3)).setAttribute('normal',new Float32BufferAttribute(b.n,3)).setAttribute('uv',new Float32BufferAttribute(b.uv,2));
  g.computeBoundingBox();g.computeBoundingSphere();g.userData.role=role;g.userData.subroles=b.rolesCount;g.userData.part=Uint8Array.from(b.part);g.userData.faceRole=b.faceRole;
  const mesh=new Mesh(g,materialFor(role));mesh.name=role;group.add(mesh);triangles+=b.p.length/9;
 }
 return {group,pieces,spans,roleTriangles:Object.fromEntries(roles),triangles,draws:batches.size,oldOutline:stock,rulerNotDatum:localY,authoredCutsNotMeasured:[12.80,61.50]}
}
