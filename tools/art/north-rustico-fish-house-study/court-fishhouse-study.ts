import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,type Material} from 'three';

/**
 * Detached q03330/633 study; no terrain/deck datum, asset URL, world position,
 * lights, collision, texture downloads or mount API.
 *
 * X = registered cross-roof V (SE-facing positive); Z = negative registered
 * ridge U (NE-facing negative). Y = schematic body-floor reference ONLY.
 * UV are in metres; every decorative depression is strictly inward.
 */
type V2=readonly [number,number];
type V3=readonly [number,number,number];
type UV=readonly [number,number];
type Role='shingle'|'plywood'|'roof'|'trim'|'door'|'glazing'|'soffit';
type Grip='east'|'south'|'west'|'north';
type Tier='core'|'period';
type Sash='door'|'single'|'6'|'8+8'|'2+1'|'dormer';
type Hole=Readonly<{id:string;fraction:number;y:number;width:number;height:number;sash:Sash}>;
type Face={
 grip:string;start:V2;end:V2;len:number;inward:V2;
 top:(s:number)=>number;bot:(s:number)=>number;breaks:readonly number[];
 uvOrigin?:number;
};
type Recipe={batches:Map<string,{role:Role;tier:Tier;position:number[];uv:number[]}>};
const EDGES:readonly V2[]=[
 // EPSG:3979 exact original atlas corners in the frozen UV frame, no eave widening.
 [6.195537375269416,3.4696341085572113],[-6.275282668354416,3.469637110883501],
 [-6.195533051796595,-3.469637110883501],[6.275278344881594,-3.4696341085572113],
];
const U_FALL=-0.00891417111109894,V_FALL=-0.7476722170465618,CROWN_V=.15;
const COARSE_RISE=-V_FALL*3.4696356097201463; // study use of difference, no raw orthometric placement.
const EAVE=3.72; // source row minHeight as a schematic floor-to-eave reference, not a verified floor.
const RIDGE=EAVE+COARSE_RISE;
const fullRoof=(u:number,v:number)=>RIDGE+U_FALL*u+V_FALL*Math.abs(v-CROWN_V);
export const COURT_FISH_HOUSE_STUDY=Object.freeze({
 name:'Quintin Court Fish House · detached historic study',
 role:'q03330/633 analytical detached shell',
 exactRoofSource:'PEI 2020 direct DSM, 34 author cells (14 withheld); 2009 aperture interpretation remains separately schematic',
 localFloorAuthority:'none',
 omissions:Object.freeze(['south deck and balcony support','pier count and foundation','rear annex geometry','western upper aperture arrangement','ventilator and signage','current exterior photo match','all site/ground/water/collision/flight']),
});
const hole=(id:string,fraction:number,y:number,width:number,height:number,sash:Sash):Hole=>({id,fraction,y,width,height,sash});
/** Registry counts are factual, while these positions, sizes, recess and profiles are ORIGINAL schematic estimates. */
const openings:Readonly<Record<Grip,readonly Hole[]>>={
 east:[hole('e-l-a',.20,1.51,.46,.56,'single'),hole('e-l-b',.49,1.47,.60,.64,'6'),hole('e-l-c',.76,1.52,.46,.56,'single')],
 south:[hole('s-ground-door',.53,.05,.96,2.08,'door'),hole('s-upper-door',.51,3.27,.87,1.71,'door'),
  hole('s-upper-west',.25,3.40,.55,.86,'8+8'),hole('s-upper-east',.77,3.40,.55,.86,'8+8')],
 west:[hole('w-l-a',.35,1.52,.47,.57,'single'),hole('w-l-b',.70,1.54,.49,.56,'single')],
 north:[hole('n-upper-a',.33,3.49,.54,.88,'2+1'),hole('n-upper-b',.68,3.49,.54,.88,'2+1')],
};
export const courtDocumentedOpeningNames=Object.freeze([
 ...Object.values(openings).flatMap(q=>q.map(a=>a.id)), 'e-dormer-a','e-dormer-b',
]);
export type CourtFinishRole=Role;
export type CourtMaterialFactory=(role:CourtFinishRole)=>Material|undefined;
export function originalCourtCore(){
 return Object.freeze({cornersUV:EDGES.map(q=>Object.freeze([...q] as V2)),ridgeV:CROWN_V,ridgeY:RIDGE,du:U_FALL,dv:V_FALL});
}
function makeFace(grip:string,start:V2,end:V2,top:(s:number)=>number,
 bot:(s:number)=>number=()=>0,breaks:readonly number[]=[]):Face{
 const dU=end[0]-start[0],dV=end[1]-start[1],len=Math.hypot(dU,dV);
 if(!(len>.1))throw Error('Broken facade edge');
 return {grip,start,end,len,inward:[dU/len,dV/len],top,bot,breaks};
}
function point(f:Face,s:number,y:number,depth=0):V3{
 const t=s/f.len;return [f.start[1]+(f.end[1]-f.start[1])*t+depth*f.inward[0],y,
  -f.start[0]-(f.end[0]-f.start[0])*t+depth*f.inward[1]];
}
function mix(a:V2,b:V2,t:number):V2{return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
function geo(a:V2,y:number):V3{return [a[1],y,-a[0]];}
function tCross(a:V2,b:V2,v:number){return (v-a[1])/(b[1]-a[1]);}
function tri(r:Recipe,tier:Tier,role:Role,points:readonly [V3,V3,V3],uv:readonly [UV,UV,UV]){
 const [a,b,c]=points, p=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],q=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 const area=Math.hypot(p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]);
 if(!Number.isFinite(area))throw Error('Non-finite face');
 if(area<1e-8)return;
 const key=tier+'/'+role;
 let list=r.batches.get(key);
 if(!list){list={tier,role,position:[],uv:[]};r.batches.set(key,list);}
 for(let i=0;i<3;i++){list.position.push(...points[i]);list.uv.push(...uv[i]);}
}
function facePoly(r:Recipe,tier:Tier,f:Face,role:Role,poly:readonly V2[],depth=0){
 for(let i=1;i+1<poly.length;i++){
  const as=[poly[0],poly[i+1],poly[i]] as const;
  const xyz=(q:V2)=>point(f,q[0],q[1],depth), uv=(q:V2):UV=>[q[0],q[1]-(f.uvOrigin??0)];
  tri(r,tier,role,[xyz(as[0]),xyz(as[1]),xyz(as[2])],[uv(as[0]),uv(as[1]),uv(as[2])]);
 }
}
function box2(x0:number,y0:number,x1:number,y1:number):V2[]{return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];}
function clip(poly:readonly V2[],inside:(q:V2)=>number):V2[]{
 const ret:V2[]=[];for(let j=0;j<poly.length;j++){
  const a=poly[j],b=poly[(j+1)%poly.length],p=inside(a),q=inside(b);
  if(p>=0)ret.push(a);if((p>0&&q<0)||(p<0&&q>0))ret.push(mix(a,b,p/(p-q)));
 }
 return ret;
}
type Open={source:Hole;s0:number;s1:number;y0:number;y1:number;border:number};
const BAR=0.021,DIVIDER=.049;
function inner(r:Recipe,f:Face,h:Open){
 const {source,s0,s1,y0,y1}=h,depth=source.sash==='door'?.148:.122;
 const t='period',p0=box2(s0,y0,s1,y1),lengthX=s1-s0,lengthY=y1-y0;
 // Slender reveals lead to opaque closures (nothing is open into the model).
 for(let j=0;j<4;j++){
  const k=(j+1)%4,a=p0[j],b=p0[k],da=point(f,a[0],a[1]),db=point(f,b[0],b[1]),
   ea=point(f,a[0],a[1],depth),eb=point(f,b[0],b[1],depth),l=Math.hypot(b[0]-a[0],b[1]-a[1]);
  tri(r,t,'trim',[da,eb,db],[[0,0],[l,depth],[l,0]]);
  tri(r,t,'trim',[da,ea,eb],[[0,0],[0,depth],[l,depth]]);
 }
 if(source.sash==='door'){
  // No invented hinge hardware, shop lettering or interior view.
  facePoly(r,t,f,'door',p0,depth);return;
 }
 const rect=(a:number,b:number,c:number,d:number,role:Role,dd:number)=>facePoly(r,t,f,role,box2(a,b,c,d),dd);
 const surface='glazing',rail=depth-.021;
 const pane=(a:number,b:number,c:number,d:number,nx:number,ny:number)=>{
  rect(a,b,c,d,surface,depth);
  for(let i=1;i<nx;i++){const z=a+(c-a)*i/nx;rect(z-BAR*.5,b,z+BAR*.5,d,'trim',rail);}
  for(let j=1;j<ny;j++){const z=b+(d-b)*j/ny;rect(a,z-BAR*.5,c,z+BAR*.5,'trim',rail+.001);}
 };
 if(source.sash==='8+8'||source.sash==='2+1'){
  const mid=y0+lengthY*.51;
  pane(s0,y0,s1,mid,source.sash==='8+8'?4:1,source.sash==='8+8'?2:1);
  pane(s0,mid,s1,y1,source.sash==='8+8'?4:2,source.sash==='8+8'?2:1);
  rect(s0,mid-DIVIDER*.5,s1,mid+DIVIDER*.5,'trim',rail);
 }else pane(s0,y0,s1,y1,source.sash==='6'?3:1,source.sash==='6'?2:1);
 // Perimeter sash is slightly proud of the inset neutral glass, not the wall.
 const w=Math.min(.037,lengthX*.10,lengthY*.10);
 rect(s0,y0,s0+w,y1,'trim',rail-.001);rect(s1-w,y0,s1,y1,'trim',rail-.001);
 rect(s0+w,y0,s1-w,y0+w,'trim',rail-.001);rect(s0+w,y1-w,s1-w,y1,'trim',rail-.001);
}
const uniq=(a:number[])=>[...new Set(a)].sort((x,y)=>x-y);
function wall(r:Recipe,tier:Tier,f:Face,faceRole:Role,open:readonly Hole[],facesTrim:boolean){
 const border=.048,corner=.102;
 const holes=open.map(source=>{
  const mid=source.fraction*f.len,h={source,s0:mid-source.width*.5,s1:mid+source.width*.5,y0:source.y,y1:source.y+source.height,border};
  if(h.s0<border||h.s1>f.len-border||
    Math.max(f.bot(h.s0-border),f.bot(h.s1+border))+border>h.y0+1e-9||
    Math.min(f.top(h.s0-border),f.top(h.s1+border))-border<h.y1-1e-9)throw Error('Aperture outside bounded role: '+source.id);
  return h;
 });
 const S=uniq([0,f.len,...f.breaks,...(facesTrim?[corner,f.len-corner]:[]),...holes.flatMap(h=>[h.s0,h.s1,h.s0-border,h.s1+border])]);
 const floor=Math.min(...S.map(f.bot)),ceiling=Math.max(...S.map(f.top));
 for(let j=1;j<S.length;j++){
  const a=S[j-1],b=S[j],s=(a+b)*.5;
  // Only Y cuts for apertures with a span on this strip. Adjacent
  // non-aperture areas keep large planar triangles (no grid overdraw).
  const local=holes.filter(h=>s>h.s0-border&&s<h.s1+border);
  const Y=uniq([floor,ceiling,...local.flatMap(h=>[h.y0,h.y1,h.y0-border,h.y1+border])]);
  for(let i=1;i<Y.length;i++){
   const c=Y[i-1],d=Y[i],y=(c+d)*.5;
   if(local.some(h=>s>h.s0&&s<h.s1&&y>h.y0&&y<h.y1))continue;
   const trim=local.some(h=>y>h.y0-border&&y<h.y1+border)||facesTrim&&(s<corner||s>f.len-corner);
   const clipped=clip(clip(box2(a,c,b,d),p=>f.top(p[0])-p[1]),p=>p[1]-f.bot(p[0]));
   facePoly(r,tier,f,trim?'trim':faceRole,clipped);
  }
 }
 for(const h of holes)inner(r,f,h);
}
function roofPlane(r:Recipe,role:Role,tier:Tier,q:readonly [V2,V2,V2,V2],height:(a:V2)=>number){
 const vertices=q.map(v=>geo(v,height(v))) as [V3,V3,V3,V3];
 const vec=(a:V3,b:V3):V3=>[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
 const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const unit=(v:V3):V3=>{const a=Math.hypot(...v);return [v[0]/a,v[1]/a,v[2]/a];};
 const along=unit(vec(vertices[0],vertices[1]));
 const to=vec(vertices[0],vertices[3]),t=dot(to,along);
 const across=unit([to[0]-t*along[0],to[1]-t*along[1],to[2]-t*along[2]]);
 const coords=vertices.map(p=>{const d=vec(vertices[0],p);return [dot(d,along),dot(d,across)] as UV;});
 for(const p of [[0,1,2],[0,2,3]]){
  const a=vec(vertices[p[0]],vertices[p[1]]),b=vec(vertices[p[0]],vertices[p[2]]);
  if(a[2]*b[0]-a[0]*b[2]<0)p.reverse();
  tri(r,tier,role,p.map(i=>vertices[i]) as [V3,V3,V3],p.map(i=>coords[i]) as [UV,UV,UV]);
 }
}
function foot(r:Recipe,tier:Tier,q:readonly [V2,V2,V2,V2],height:(a:V2)=>number){
 for(const p of [[0,1,2],[0,2,3]]){
  const a=q[p[0]],b=q[p[1]],c=q[p[2]];
  // XZ positive UV handedness; constrain downward normal of the sealed core bottom.
  const y=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(y<0)p.reverse();
  const [i,j,k]=p;const g=(a:V2)=>geo(a,height(a));
  tri(r,tier,'soffit',[g(q[i]),g(q[j]),g(q[k])],[q[i],q[j],q[k]]);
 }
}
function dormer(r:Recipe){
 // Contained original 2009-era schematic. Position / width / lean roof
 // dimensions expressly not recovered by 1m DSM. Separately removable.
 const q:readonly [V2,V2,V2,V2]=[[2.05,2.49],[-.18,2.49],[-.18,.78],[2.05,.78]];
 const top=([u,v]:V2)=>fullRoof(u,.78)+.093-.20*(v-.78);
 const below=([u,v]:V2)=>fullRoof(u,v)-.042;
 roofPlane(r,'roof','period',q,top);foot(r,'period',q,below);
 for(let i=0;i<4;i++){
  const a=q[i],b=q[(i+1)%4];
  const f=makeFace('east dormer role',a,b,s=>top(mix(a,b,s/Math.hypot(a[0]-b[0],a[1]-b[1]))),s=>below(mix(a,b,s/Math.hypot(a[0]-b[0],a[1]-b[1]))));
  if(i===0){
   f.uvOrigin=Math.min(below(a),below(b));
   const y=Math.max(below(a),below(b))+.125;
   wall(r,'period',f,'shingle',[hole('e-dormer-a',.32,y,.52,.68,'dormer'),hole('e-dormer-b',.68,y,.52,.68,'dormer')],true);
  }else wall(r,'period',f,'shingle',[],false);
 }
}
function fallback(role:Role):Material{
 const palette:Record<Role,number>={shingle:0xd5d0ba,plywood:0xc4c1ad,roof:0x343942,trim:0xdcdbca,door:0x9a947c,glazing:0x303532,soffit:0x71675b};
 return new MeshStandardMaterial({name:'court · '+role,color:palette[role],roughness:role==='glazing'?.36:.89,metalness:0});
}
/** Caller controls whether the verified core or interpreted era wall variant is present. No automatic scene promotion. */
export function makeCourtFishHouseStudy(era:'roof-core'|'documented-2009'='roof-core',materialFor?:CourtMaterialFactory){
 const r:Recipe={batches:new Map()},group=new Group();
 group.name=COURT_FISH_HOUSE_STUDY.name;group.userData={...COURT_FISH_HOUSE_STUDY,era};
 const withPeriod=era==='documented-2009',tier=withPeriod?'period':'core';
 const [a,b,c,d]=EDGES;
 const p=mix(b,c,tCross(b,c,CROWN_V)),s=mix(d,a,tCross(d,a,CROWN_V));
 const h=(q:V2)=>fullRoof(...q);
 roofPlane(r,'roof','core',[a,b,p,s],h);
 roofPlane(r,'roof','core',[c,d,s,p],h);
 foot(r,'core',[a,b,c,d],()=>0);
 const labels:readonly Grip[]=['east','south','west','north'];
 for(let i=0;i<4;i++){
  const v=EDGES[i],w=EDGES[(i+1)%4],len=Math.hypot(v[0]-w[0],v[1]-w[1]),grip=labels[i];
  const crossing=(v[1]-CROWN_V)*(w[1]-CROWN_V)<0?[tCross(v,w,CROWN_V)*len]:[];
  const f=makeFace(grip,v,w,s=>h(mix(v,w,s/len)),()=>0,crossing);
  wall(r,tier,f,grip==='north'?'plywood':'shingle',withPeriod?openings[grip]:[],withPeriod);
 }
 if(withPeriod)dormer(r);
 const materials=new Map<Role,Material>();
 for(const [key,input] of r.batches){
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(input.position,3));
  g.setAttribute('uv',new Float32BufferAttribute(input.uv,2));g.computeVertexNormals();g.computeBoundingSphere();
  if(!materials.has(input.role))materials.set(input.role,materialFor?.(input.role)??fallback(input.role));
  const m=new Mesh(g,materials.get(input.role)!);m.name='court / '+key;
  m.userData={tier:input.tier,role:input.role};group.add(m);
 }
 return group;
}
