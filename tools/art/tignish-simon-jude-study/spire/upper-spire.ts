/** Original *dimensionless* architectural specimen. No world/asset/flight coupling. */
import * as T from 'three';
type P=readonly [number,number,number];
type Q=readonly [number,number];
type Color=readonly [number,number,number];
type Batch='sheet'|'masonry';
type Depth=number|((p:Q)=>number);
type Slat=Readonly<{role:string;face:number;row:number;side:number;span:readonly [number,number] }>;
type Hood=Readonly<{face:number;yBand:readonly [number,number];maxHalf:number;hoodSpan:readonly [number,number];rakeSpan:readonly [number,number]}>;
export type Tri=Readonly<{p:readonly[P,P,P]; rgb:Color; role:string; batch:Batch}>;
type Face=Readonly<{u:P;n:P;label:string}>;
export const DESIGN=Object.freeze({
 units:'normalized detached specimen; never metres', registered:false, stageMount:false,
 skirtTop:.794, lipHalf:.5, neckHalf:.269, bevelAtNeck:.152,
 needleTop:2.45, topHalf:.022, interfaceY:0, cropY:-.955,
 materials:2, maxTriangles:2800, faceSamples:3,
});
const F:readonly Face[]=[
 {u:[1,0,0],n:[0,0,1],label:'entry-facing example'},
 {u:[0,0,-1],n:[1,0,0],label:'one observed flank example'},
 {u:[-1,0,0],n:[0,0,-1],label:'unobserved plain closure'},
 {u:[0,0,1],n:[-1,0,0],label:'reciprocal flank example'},
];
const C={
 sheet:[.239,.370,.326],neck:[.180,.313,.270],broach:[.203,.339,.291],shadow:[.073,.139,.115],
 seam:[.136,.262,.224],brick:[.421,.180,.137],clay:[.333,.112,.095],
 shadeClay:[.246,.081,.059],pale:[.722,.698,.605],trim:[.855,.818,.722],
 dark:[.058,.075,.064],terminal:[.083,.102,.088],sill:[.462,.399,.328],
} satisfies Record<string,Color>;
const cross=(a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=(a:P)=>Math.hypot(...a);
const scale=(a:P,k:number):P=>[k*a[0],k*a[1],k*a[2]];
const sum=(a:P,b:P):P=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const blend=(x:number,y:number,t:number)=>x+(y-x)*t;
const mix=(x:P,y:P,t:number):P=>[blend(x[0],y[0],t),blend(x[1],y[1],t),blend(x[2],y[2],t)];
const pt=(f:Face,p:Q,n:number):P=>[p[0]*f.u[0]+n*f.n[0],p[1],p[0]*f.u[2]+n*f.n[2]];
const tint=(c:Color,s:number):Color=>[c[0]*s,c[1]*s,c[2]*s];
const rect=(a:number,b:number,h:number):Q[]=>[[-h,a],[h,a],[h,b],[-h,b]];
const square=(y:number,a:number):P[]=>[[-a,y,a],[a,y,a],[a,y,-a],[-a,y,-a]];
const oct=(y:number,a:number,b:number):P[]=>[[-b,y,a],[b,y,a],[a,y,b],[a,y,-b],[b,y,-a],[-b,y,-a],[-a,y,-b],[-a,y,b]];
const readDepth=(p:Q,n:Depth)=>typeof n==='number'?n:n(p);
const motif=(w:number,base:number,spring:number,peak:number,n=6):Q[]=>{
 const r:Q[]= [[-w,base],[w,base],[w,spring]];
 for(let i=1;i<=n;i++){const t=i/n;r.push([w*(1-t*t),blend(spring,peak,t)]);}
 for(let i=n-1;i>=0;i--){const t=i/n;r.push([-w*(1-t*t),blend(spring,peak,t)]);}
 return r;
};
export const skinSeatN=(h:number)=>h<DESIGN.skirtTop?
 blend(DESIGN.lipHalf,DESIGN.neckHalf,clamp(h/DESIGN.skirtTop)):
 blend(DESIGN.neckHalf,DESIGN.topHalf,clamp((h-DESIGN.skirtTop)/(DESIGN.needleTop-DESIGN.skirtTop)));
// Lower facet continued behind the knee is strictly inward from the real upper face.
const hoodBackN=(y:number)=>blend(DESIGN.lipHalf,DESIGN.neckHalf,y/DESIGN.skirtTop)-.018;
const hoodDepth=(n:number)=>((p:Q)=>n-.066*(p[1]-.136));
export function triangles(){
 const tris:Tri[]=[],slats:Slat[]=[],hoods:Hood[]=[];
 function tri(t:readonly[P,P,P],rgb:Color,batch:Batch,role:string,want?:P){
  const n=cross(sub(t[1],t[0]),sub(t[2],t[0]));
  if(!Number.isFinite(norm(n))||norm(n)<1e-10)throw Error('degenerate '+role);
  const p=want&&dot(n,want)<0?[t[0],t[2],t[1]] as const:t;
  tris.push({p,rgb,batch,role});
 }
 const quad=(t:readonly[P,P,P,P],rgb:Color,batch:Batch,role:string,want?:P)=>{
  tri([t[0],t[1],t[2]],rgb,batch,role,want);
  tri([t[0],t[2],t[3]],rgb,batch,role,want);
 };
 const cap=(v:P[],rgb:Color,batch:Batch,role:string,up:boolean)=>{
  for(let i=1;i<v.length-1;i++)tri([v[0],v[i],v[i+1]],rgb,batch,role,[0,up?1:-1,0]);
 };
 const layer=(a:P[],b:P[],c:Color,batch:Batch,role:string)=>{
  if(a.length!==b.length)throw Error('mismatched rings');
  for(let i=0;i<a.length;i++){const j=(i+1)%a.length;quad([a[i],a[j],b[j],b[i]],c,batch,role);}
 };
 const solid=(a:P[],b:P[],c:Color,batch:Batch,role:string)=>{
  layer(a,b,c,batch,role);cap(a,c,batch,role,false);cap(b,c,batch,role,true);
 };
 function surface(f:Face,outer:Q[],holes:Q[][],depth:Depth,c:Color,batch:Batch,role:string,want=f.n){
  const plan=(a:Q[])=>a.map(p=>new T.Vector2(...p));
  const p=[...outer,...holes.flat()];
  const cells=T.ShapeUtils.triangulateShape(plan(outer),holes.map(plan));
  const point=(q:Q)=>pt(f,q,readDepth(q,depth));
  for(const [i,j,k] of cells)tri([point(p[i]),point(p[j]),point(p[k])],c,batch,role,want);
 }
 const backSeat=(f:Face,p:Q)=>pt(f,p,hoodBackN(p[1]));
 function profileSide(f:Face,a:Q[],to:(p:Q)=>P,from:(p:Q)=>P,c:Color,batch:Batch,role:string,back=false){
  for(let i=0;i<a.length;i++){
   const j=(i+1)%a.length,s=a[i],e=a[j],dy=e[1]-s[1],dt=e[0]-s[0];
   const n:P=[f.u[0]*dy,-dt,f.u[2]*dy];
   quad([to(s),to(e),from(e),from(s)],c,batch,role,back?scale(n,-1):n);
  }
 }
 function rim(f:Face,a:Q[],b:Q[],forward:Depth,inner:Depth,c:Color,batch:Batch,role:string){
  if(a.length!==b.length)throw Error('mismatched aperture');
  const p=(q:Q,n:Depth)=>pt(f,q,readDepth(q,n));
  for(let i=0;i<a.length;i++){
   const j=(i+1)%a.length;
   quad([p(a[i],forward),p(a[j],forward),p(b[j],inner),p(b[i],inner)],c,batch,role,f.n);
  }
 }
 function seatBoard(f:Face,plan:Q[],front:Depth,back:Depth,c:Color,batch:Batch,role:string){
  const area=plan.reduce((s,p,i)=>{const q=plan[(i+1)%plan.length];return s+p[0]*q[1]-q[0]*p[1];},0);
  const shape=area>0?plan:[...plan].reverse();
  surface(f,shape,[],front,c,batch,role);
  profileSide(f,shape,q=>pt(f,q,readDepth(q,front)),q=>pt(f,q,readDepth(q,back)),c,batch,role);
  surface(f,shape,[],back,c,batch,role,scale(f.n,-1));
 }
 function slat(f:Face,id:number,row:number,side:number,y:number){
  const [u,v]=[.005,.105].map(x=>x*side).sort((a,b)=>a-b);
  const prefix='bay:'+id+':';
  const first=tris.length;
  const seat:readonly Q[]=[[y-.007,.4455],[y+.011,.4275],[y+.011,.4215],[y-.007,.4395]];
  const at=(x:number,a:Q)=>pt(f,[x,a[0]],a[1]);
  const a=seat.map(q=>at(u,q)),b=seat.map(q=>at(v,q));
  quad([a[0],a[1],a[2],a[3]],C.pale,'masonry',prefix+'slat end cap',scale(f.u,-1));
  quad([b[0],b[1],b[2],b[3]],C.pale,'masonry',prefix+'slat end cap',f.u);
  for(const [i,n] of [f.n,[0,1,0] as const,scale(f.n,-1),[0,-1,0] as const].entries()){
   const j=(i+1)%4;
   const names=['tilted slat','slat top','slat underside','slat nose'];
   quad([a[i],b[i],b[j],a[j]],i===2?C.dark:tint(C.pale,1-.014*(row%3)),'masonry',prefix+names[i],n);
  }
  slats.push({role:prefix+'tilted slat',face:id,row,side,span:[first,tris.length]});
 }
 function block(f:Face,x:number,y0:number,y1:number,w:number,n0:number,n1:number,c:Color,batch:Batch,role:string){
  const a=rect(y0,y1,w).map(p=>[p[0]+x,p[1]] as const);
  surface(f,a,[],n1,c,batch,role);
  for(const [i,s] of a.entries()){
   const j=(i+1)%a.length,e=a[j],dy=e[1]-s[1],dt=e[0]-s[0];
   quad([pt(f,s,n1),pt(f,e,n1),pt(f,e,n0),pt(f,s,n0)],c,batch,role,[f.u[0]*dy,-dt,f.u[2]*dy]);
  }
  const [i,j,k,l]=a.map(p=>pt(f,p,n0));
  quad([i,j,k,l],c,batch,role,scale(f.n,-1));
 }
 const base=square(0,DESIGN.lipHalf),waist=oct(DESIGN.skirtTop,DESIGN.neckHalf,DESIGN.bevelAtNeck),
  top=oct(DESIGN.needleTop,DESIGN.topHalf,.0095);
 // One watertight square-to-octagonal topological hypothesis: four rising corner broaches.
 cap(base,C.sheet,'sheet','core:base',false);
 for(let i=0;i<4;i++){
  const j=(i+1)%4,m=waist[2*i],n=waist[2*i+1];
  quad([base[i],base[j],n,m],tint(C.sheet,1+i*.01),'sheet','core:skirt');
  tri([base[j],waist[(2*i+2)%8],n],C.broach,'sheet','core:broach');
 }
 for(let i=0;i<8;i++){
  const j=(i+1)%8;
  quad([waist[i],waist[j],top[j],top[i]],tint(C.neck,1+((i*17)%7-3)*.05),'sheet','core:needle');
  // Restrained raised seams, new geometry only. Local exact panel projection.
  const normal=cross(sub(waist[j],waist[i]),sub(top[i],waist[i]));
  const off=scale(normal,.00036/norm(normal));
  const slide=(u:number,t:number)=>sum(mix(mix(waist[i],waist[j],u),mix(top[i],top[j],u),t),off);
  quad([slide(.488,.035),slide(.512,.035),slide(.512,.94),slide(.488,.94)],C.seam,'sheet','sheet laps');
  for(const y of [.18,.35,.54,.70,.83])
   quad([slide(.032,y),slide(.968,y),slide(.968,y+.0017),slide(.032,y+.0017)],tint(C.seam,1.045),'sheet','sheet laps');
 }
 cap(top,C.neck,'sheet','core:top',true);
 solid(square(-.050,.498),square(0,.502),C.shadow,'sheet','rolled lip');
 solid(square(-.096,.483),square(-.050,.498),C.clay,'masonry','upper masonry cornice');
 solid(square(-.109,.477),square(-.096,.489),C.brick,'masonry','upper masonry cornice');
 // A dark little terminal, not a duplicate of photographed ironwork.
 solid(oct(2.447,.020,.010),oct(2.481,.036,.021),C.terminal,'sheet','terminal socket');
 solid(oct(2.478,.036,.021),oct(2.510,.019,.010),C.shadow,'sheet','terminal shoulder');
 block(F[0],0,2.506,2.647,.006,-.005,.005,C.terminal,'sheet','terminal stem');
 block(F[0],0,2.594,2.604,.048,-.004,.004,C.terminal,'sheet','terminal cross arm');
 const surveys:{role:string;face:number;hostCover:number;returnPress:number;windowCross:P;ventHalf:number;louverCross:P}[]=[];
 const loftHalf=.477, bodyTop=-.107, bodyBottom=DESIGN.cropY;
 cap(square(bodyTop,loftHalf),C.clay,'masonry','clipped belfry top',true);
 cap(square(bodyBottom,loftHalf),C.shadeClay,'masonry','section cut, not foundation',false);
 for(const [id,f] of F.entries()){
  const extent=rect(bodyBottom,bodyTop,loftHalf);
  if(id===2){
   surface(f,extent,[],loftHalf,C.brick,'masonry','unseen neutral section closure');continue;
  }
  const profile:Q[]=[[-.087,.136],[.087,.136],[.087,.565],[0,.822],[-.087,.565]];
  const outer=motif(.055,.199,.535,.666),inset=motif(.039,.216,.516,.621);
  const front=hoodDepth(.483),bevel=hoodDepth(.474),pocket=hoodDepth(.455);
  const label='profile:'+id,from=tris.length;
  surface(f,profile,[outer],front,tint(C.pale,.76),'masonry',label+':hood face');
  // Rake the front slightly inward toward the upper needle; unchanged slot and a
  // planar buried back that stays inside both sides of the convex skirt fold.
  profileSide(f,profile,q=>pt(f,q,front(q)),q=>backSeat(f,q),C.shadow,'sheet',label+':attached cheek');
  surface(f,profile,[],p=>hoodBackN(p[1]),C.shadow,'sheet',label+':buried back',scale(f.n,-1));
  rim(f,outer,inset,front,bevel,C.trim,'masonry',label+':pale reveal');
  profileSide(f,inset,q=>pt(f,q,bevel(q)),q=>pt(f,q,pocket(q)),C.pale,'masonry',label+':interior bevel',true);
  surface(f,inset,[],pocket,C.dark,'sheet',label+':shadowed backstop');
  const end=tris.length;
  const rake:Q[]=[[-.084,.565],[0,.817],[.084,.565],[.071,.565],[0,.79],[-.071,.565]];
  seatBoard(f,rake,hoodDepth(.4855),hoodDepth(.4785),C.trim,'masonry',label+':seated rake');
  hoods.push({face:id,yBand:[.136,.822],maxHalf:.087,hoodSpan:[from,end],rakeSpan:[end,tris.length]});
  // Upper belfry slice: an open Gothic pointed pierce with paired inclined slats.
  const opening=motif(.134,-.787,-.402,-.201),brickReveal=motif(.122,-.770,-.415,-.22),
   inner=motif(.095,-.753,-.435,-.254);
  const paleN=.459,depth=.394;
  surface(f,extent,[opening],loftHalf,C.brick,'masonry','bay:'+id+':brick face');
  rim(f,opening,brickReveal,loftHalf,paleN,C.shadeClay,'masonry','bay:'+id+':brick jamb');
  rim(f,brickReveal,inner,paleN,paleN-.012,C.trim,'masonry','bay:'+id+':timber arch');
  profileSide(f,inner,q=>pt(f,q,paleN-.012),q=>pt(f,q,depth),C.shadeClay,'masonry','bay:'+id+':inner reveal',true);
  surface(f,inner,[],depth,C.dark,'masonry','bay:'+id+':recess backstop');
  // Local illustrative timber bearings. Outboard rails cross the straight .095 recess
  // jambs. The heel/head bars take both ends of the rails and the centre mullion.
  block(f,0,-.771,-.747,.121,.402,.452,C.clay,'masonry','bay:'+id+':bearing heel');
  block(f,0,-.455,-.439,.121,.402,.452,C.pale,'masonry','bay:'+id+':bearing head');
  for(const s of [-1,1])
   block(f,s*.105,-.767,-.443,.014,.408,.449,C.sill,'masonry','bay:'+id+':bearing liner:'+s);
  block(f,0,-.767,-.443,.008,.414,.451,C.pale,'masonry','bay:'+id+':mullion');
  for(let j=0;j<8;j++)for(const s of [-1,1])slat(f,id,j,s,-.735+j*.037);
  block(f,0,-.808,-.791,.142,.469,.492,C.sill,'masonry','bay:'+id+':sill');
  for(const s of [-1,1]){
   block(f,s*.345,-.955,-.363,.041,.471,.502,C.clay,'masonry','upper pier sample');
   const roof:Q[]=[[s*.345-.041,-.363],[s*.345+.041,-.363],[s*.345,-.312]];
   surface(f,roof,[],.502,C.clay,'masonry','upper pier sample');
   profileSide(f,roof,p=>pt(f,p,.502),p=>pt(f,p,.471),C.sill,'masonry','upper pier cap');
  }
  surveys.push({role:f.label,face:id,
   hostCover:Math.min(...inset.map(p=>pocket(p)-skinSeatN(p[1]))),
   returnPress:.018,
   windowCross:pt(f,[0,.39],.75),ventHalf:.039,
   louverCross:pt(f,[.039,-.49],.68)});
 }
 return {tris,surveys,slats,hoods};
}
export function detachedUpperSpire(){
 const {tris,surveys,slats,hoods}=triangles(),root=new T.Group();
 root.name='Illustrative broached spire and belfry cut — unattached, unitless';
 root.userData={metric:false,artOnly:true,sceneSupport:false};
 for(const batch of ['sheet','masonry'] as const){
  const part=tris.filter(t=>t.batch===batch);
  const xyz=new Float32Array(part.length*9),rgb=new Float32Array(xyz.length);
  part.forEach((face,i)=>{for(let j=0;j<3;j++){
   xyz.set(face.p[j],i*9+3*j);
   // Input author tints are sRGB triples; output stores linear vertex colors.
   const col=new T.Color().setRGB(...face.rgb,T.SRGBColorSpace);
   rgb.set([col.r,col.g,col.b],i*9+3*j);
  }});
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(xyz,3));
  g.setAttribute('color',new T.BufferAttribute(rgb,3));g.computeVertexNormals();g.computeBoundingSphere();
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:batch==='sheet'?.74:.93,
   metalness:batch==='sheet'?.23:0});
  const m=new T.Mesh(g,mat);m.name=batch;
  m.castShadow=false;m.receiveShadow=false;
  root.add(m);
 }
 return {root,tris,surveys,slats,hoods,design:DESIGN,dispose:()=>root.children.forEach(a=>{
  const m=a as T.Mesh<T.BufferGeometry,T.Material>;
  m.geometry.dispose();m.material.dispose();
 })};
}
