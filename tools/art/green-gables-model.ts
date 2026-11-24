import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {paints,greenPaint,type GreenPaint as C} from '../../src/render/green-gables-materials.ts';

export const GG_REFERENCE_Y=13.929;
type V=[number,number];type P=[number,number,number];type R=[number,number,number,number];
type Plane=readonly [number,number,number];
type Open={u:number,w:number,y:number,h:number,shutters?:boolean,cols?:number,door?:boolean,transom?:boolean};
const yy=(x:number)=>x-GG_REFERENCE_Y;
const planes={
 mainNorth:[16.93678504,-.05073604,.95754965],mainSouth:[26.91626883,.03536731,-.96134911],
 kitchenWest:[20.46371946,1.11820355,.05013716],kitchenEast:[23.55209464,-1.04314296,-.06182262],
} as const;
const main=[-1.14,8.82,1.39,9.54] as R,wing=[-2.51,5.62,-6.82,5.31] as R;
const mainWalls=[-.88,8.48,1.64,9.22] as R,wingWalls=[-2.20,5.35,-6.52,1.78] as R;
const cl=(p:Plane,x:number,z:number)=>yy(p[0]+p[1]*x+p[2]*z);
const ht=(a:Plane,b:Plane,x:number,z:number)=>Math.min(cl(a,x,z),cl(b,x,z));
const shape=(r:R):V[]=>[[r[0],r[3]],[r[1],r[3]],[r[1],r[2]],[r[0],r[2]]];
const inside=(r:R,x:number,z:number)=>x>r[0]&&x<r[1]&&z>r[2]&&z<r[3];
const wrap=(p:V[],fn:(x:number,z:number)=>number):V[]=>{
 if(!p.length)return [];let a=p[p.length-1],da=fn(...a);const r:V[]=[];
 for(const b of p){
  const db=fn(...b);if((da>=0)!==(db>=0)){const s=da/(da-db);r.push([a[0]+s*(b[0]-a[0]),a[1]+s*(b[1]-a[1])]);}
  if(db>=0)r.push(b);a=b;da=db;
 }
 return r;
};
type F=(x:number,z:number)=>number;
const enclosure=(r:R):F[]=>[(x)=>x-r[0],x=>r[1]-x,(_x,z)=>z-r[2],(_x,z)=>r[3]-z];
const cut=(subject:V[],constraints:F[])=>{
 const out:V[][]=[];let p=subject;
 for(const f of constraints){
  const a=wrap(p,(x,z)=>-f(x,z));if(a.length>=3)out.push(a);
  p=wrap(p,f);if(p.length<3)break;
 }
 return out;
};
export function buildGreenGables(opts:{vestibule?:boolean,stairs?:boolean,foundationToe?:number}={}){
 const vestibule=opts.vestibule??true,stairs=opts.stairs??true,depth=opts.foundationToe??.10;
 const mats=Object.fromEntries(Object.keys(paints).map(k=>[k,greenPaint(k as C)])) as Record<C,T.MeshStandardMaterial>;
 const meshes=new Map<string,{type:C,geo:T.BufferGeometry[]}>();
 const count:Record<string,number>={};let part='body';
 const adv=(g:T.BufferGeometry,k:C,custom?:number[])=>{
  const a=g.index?g.toNonIndexed():g;if(g!==a)g.dispose();
  const p=a.getAttribute('position'),n=a.getAttribute('normal'),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
   uv[2*i]=nz>=nx||ny>Math.max(nx,nz)?x:z;uv[2*i+1]=ny>Math.max(nx,nz)?z:y;
  }
  if(custom)uv.set(custom);a.setAttribute('uv',new T.BufferAttribute(uv,2));
  const id=part+'/'+k;let m=meshes.get(id);if(!m)meshes.set(id,m={type:k,geo:[]});m.geo.push(a);count[part]=(count[part]??0)+p.count/3;
 };
 const tri=(c:C,a:P,b:P,d:P,uv?:number[])=>{
  const p0=new T.Vector3(...a),p1=new T.Vector3(...b),p2=new T.Vector3(...d);
  if(p1.sub(p0).cross(p2.sub(p0)).lengthSq()<1e-10)return;
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([...a,...b,...d],3));g.computeVertexNormals();adv(g,c,uv);
 };
 const face=(c:C,a:P,b:P,d:P,e:P)=>{tri(c,a,b,d);tri(c,a,d,e);};
 const cube=(c:C,p:P,x:number,y:number,z:number)=>{
  if(Math.min(x,y,z)>.001)adv(new T.BoxGeometry(x,y,z).translate(...p),c);
 };
 const tube=(c:C,a:P,b:P,w:number,h=w)=>{
  const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A);
  if(d.length()<.003)return;
  const g=new T.BoxGeometry(w,d.length(),h).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize())).translate(...A.add(B).multiplyScalar(.5).toArray());
  adv(g,c);
 };
 const mapping=(r:R,edge:number)=>{
  if(edge===0)return {l:r[0],u:r[1],move:(x:number,y:number,d=0):P=>[x,y,r[3]+d],solid:(c:C,p:P,w:number,h:number,d:number)=>cube(c,p,w,h,d),inverse:0};
  if(edge===1)return {l:-r[1],u:-r[0],move:(x:number,y:number,d=0):P=>[-x,y,r[2]-d],solid:(c:C,p:P,w:number,h:number,d:number)=>cube(c,p,w,h,d),inverse:1};
  if(edge===2)return {l:r[2],u:r[3],move:(x:number,y:number,d=0):P=>[r[0]-d,y,x],solid:(c:C,p:P,w:number,h:number,d:number)=>cube(c,p,d,h,w),inverse:0};
  return {l:-r[3],u:-r[2],move:(x:number,y:number,d=0):P=>[r[1]+d,y,-x],solid:(c:C,p:P,w:number,h:number,d:number)=>cube(c,p,d,h,w),inverse:1};
 };
 type Wall=ReturnType<typeof mapping>;
 const mold=(f:Wall,c:C,x:number,y:number,w:number,h:number,v:number,o=0)=>f.solid(c,f.move(x,y,o),w,h,v);
 const panel=(f:Wall,c:C,a:number,b:number,y:number,Y:number,d=0)=>face(c,f.move(a,y,d),f.move(b,y,d),f.move(b,Y,d),f.move(a,Y,d));
 const corners=(w:Open):V[]=>[[w.u-w.w*.5,w.y],[w.u+w.w*.5,w.y],[w.u+w.w*.5,w.y+w.h],[w.u-w.w*.5,w.y+w.h]];
 function wallPolygon(f:Wall,k:C,r:V[],holes:Open[]){
  const h=holes.map(corners),p=[r,...h].flat();
  for(const t of T.ShapeUtils.triangulateShape(r.map(i=>new T.Vector2(...i)),h.map(g=>g.map(i=>new T.Vector2(...i))))){
   let [a,b,c]=t.map(i=>p[i]);if((b[0]-a[0])*(c[1]-a[1])<(b[1]-a[1])*(c[0]-a[0]))[b,c]=[c,b];
   tri(k,f.move(...a),f.move(...b),f.move(...c));
  }
 }
 function shutter(f:Wall,center:number,y0:number,w:number,h:number){
  const c='greenTrim',pane=1.5*Math.min(h,w),n=Math.max(3,Math.ceil(h/.064));
  mold(f,c,center,y0+h*.5,w,h,.050,.055);
  const left=center-w*.5,right=center+w*.5;
  for(const x of [left+.034,right-.034])mold(f,'green',x,y0+h*.5,.068,h,.028,.085);
  for(const t of [y0+.052,y0+h*.47,y0+h-.051])mold(f,'green',center,t,w-.098,.082,.392/16,.089);
  for(let q=1;q<n;q++){
   const Y=y0+q*h/n;if(Y-y0<.10||y0+h-Y<.108||Math.abs(Y-y0-h*.47)<.048)continue;
   face('green',f.move(left+.063,Y+.012,.091),f.move(right-.065,Y+.012,.091),f.move(right-.065,Y-.022,.115),f.move(left+.063,Y-.022,.115));
  }
  for(const t of [y0+.19,y0+h-.19])mold(f,'hardware',center+w*.36,t,.056,.028,.031,.110);
  void pane;
 }
 function window(f:Wall,w:Open){
  const a=w.u-w.w*.5,b=w.u+w.w*.5,y=w.y,Y=w.y+w.h,D=w.door?.184:.128, trim=w.door?'greenTrim':'whiteframe';
  for(const [l,L] of [[a,b],[b,a]] as const){
   if(l===a)face('soffit',f.move(l,y),f.move(l,y,-D),f.move(l,Y,-D),f.move(l,Y));
   else face('soffit',f.move(l,y,-D),f.move(l,y),f.move(l,Y),f.move(l,Y,-D));
   mold(f,trim,l+(l===a?-.032:.032),(y+Y)*.5,.082,w.h+.103,.083,.042);
   void L;
  }
  face('soffit',f.move(a,y),f.move(b,y),f.move(b,y,-D),f.move(a,y,-D));
  face('soffit',f.move(b,Y),f.move(a,Y),f.move(a,Y,-D),f.move(b,Y,-D));
  mold(f,trim,w.u,Y+.038,w.w+.177,.087,.144,.057);
  mold(f,'whiteframe',w.u,y-.032,w.w+.176,.076,.223,.058);
  const inset=.042,l=a+inset,r=b-inset;
  if(w.door){
   panel(f,'door',l,r,y+.037,Y-.047,-D-.062);
   if(w.transom){
    const bot=Y-.268,top=Y-.060;panel(f,'glass',l+.012,r-.012,bot,top,-D-.041);
    const n=3;for(let i=0;i<=n;i++)mold(f,'whiteframe',l+(r-l)*i/n,(bot+top)*.5,.019,top-bot,.026,-D-.032);
    for(const d of [bot,top])mold(f,'whiteframe',w.u,d,r-l,.022,.028,-D-.036);
   }
   mold(f,'greenTrim',w.u,y+w.h*.41,.051,w.h*.78,.062,-D-.033);
   for(const dis of [-1,1]){
    const u=w.u+dis*w.w*.209,bottom=y+.18,middle=y+w.h*.60,L=u-w.w*.136,R=u+w.w*.136;
    panel(f,'dark',L,R,bottom,middle,-D-.042);
    for(const edge of [L,R])mold(f,'green',edge,(bottom+middle)*.5,.034,middle-bottom+.039,.039,-D-.025);
    for(const t of [bottom,middle])mold(f,'green',u,t,R-L,.043,.049,-D-.024);
   }
   mold(f,'hardware',w.u+w.w*.257,y+w.h*.45,.051,.081,.049,-D-.020);
   return;
  }
  panel(f,'glass',l,r,y+inset,Y-inset,-D-.054);
  const m=w.cols??3;
  for(let j=0;j<=m;j++)mold(f,j===0||j===m?'greenTrim':'whiteframe',l+(r-l)*j/m,y+w.h*.50,j===0||j===m?.034:.020,w.h-2*inset,.028,-D-.021);
  for(let j=0;j<=4;j++){const h=y+inset+(w.h-2*inset)*j/4; mold(f,'whiteframe',w.u,h,r-l+.020,j===2?.056:.022,.032,-D-.018);}
  if(w.shutters){const width=w.w*.443;
   shutter(f,a-width*.5-.082,y+.002,width,w.h+.03);
   shutter(f,b+width*.5+.082,y+.002,width,w.h+.03);
  }
 }
 function roofTri(c:C,p:V[],coef:Plane,under=0){
  if(p.length<3)return;
  const ps=p.map(([x,z]):P=>[x,cl(coef,x,z)-under,z]),sigma=Math.hypot(coef[1],coef[2]),ux=-coef[2]/sigma,uz=coef[1]/sigma,
   vx=coef[1]/sigma*Math.sqrt(1+sigma*sigma),vz=coef[2]/sigma*Math.sqrt(1+sigma*sigma);
  const uv=(v:P)=>[v[0]*ux+v[2]*uz,v[0]*vx+v[2]*vz];
  for(let i=1;i<ps.length-1;i++){const [a,b,d]=[ps[0],ps[i],ps[i+1]];if(under>0)tri(c,a,d,b,[...uv(a),...uv(d),...uv(b)]);else tri(c,a,b,d,[...uv(a),...uv(b),...uv(d)]);}
 }
 // The further kitchen slope rises into the main roof only within the two
 // overlapping volumes. Do not emit an unsupported shelf for the whole wing.
 const apron=[main[0],wing[1],1.92,wing[3]] as R,north=[wing[0],wing[1],wing[2],1.92] as R;
 const wingRim:V[]=[[wing[0],1.92],[main[0],1.92],[main[0],wing[3]],[wing[1],wing[3]],
  [wing[1],wing[2]],[wing[0],wing[2]]];
 const roofs=[
  {r:main,domain:[main],rim:shape(main),a:planes.mainNorth,b:planes.mainSouth},
  {r:wing,domain:[north,apron],rim:wingRim,a:planes.kitchenWest,b:planes.kitchenEast}
 ];
 for(const [i,p] of roofs.entries()){
  part=i===0?'main surveyed roof':'kitchen surveyed roof';
  for(const u of [p.a,p.b]){
   const v=u===p.a?p.b:p.a;
   let leaves=p.domain.map(r=>wrap(shape(r),(x,z)=>cl(v,x,z)-cl(u,x,z)));
   const o=roofs[1-i];
   for(const h of [o.a,o.b])for(const r of o.domain){
    const d=h===o.a?o.b:o.a;
    leaves=leaves.flatMap(q=>cut(q,[...enclosure(r),(x,z)=>cl(d,x,z)-cl(h,x,z),(x,z)=>cl(h,x,z)-cl(u,x,z)-.00015]));
   }
   for(const q of leaves){
    roofTri('roof',q,u);
    // A pitched roof is not an infinitely thin skin. Continue its exact
    // clipped outline underneath into the faces of the inset gable walls.
    // In particular, retain the roof/trim silhouette and close the line of
    // sight to the sky between the fascia and wall at low approach angles.
    roofTri('soffit',q,u,.096);
   }
  }
  const r=p.rim,o=roofs[1-i];
  for(let i=0;i<r.length;i++){
   const a=r[i],b=r[(i+1)%r.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const pts=new Set<number>([0,1]);const k=(x:number,z:number)=>cl(p.a,x,z)-cl(p.b,x,z);
   const ka=k(...a),kb=k(...b);if(ka*kb<0)pts.add(ka/(ka-kb));
   for(const r of o.domain)for(const [u,v] of [r.slice(0,2),r.slice(2)].entries()){
    const dx=b[u]-a[u];
    if(Math.abs(dx)>1e-5)for(const x of v){const q=(x-a[u])/dx;if(q>0&&q<1)pts.add(q);}
   }
   const cuts=[...pts].sort((a,b)=>a-b);const at=(t:number):P=>{
    const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;return [x,ht(p.a,p.b,x,z),z];
   };
   for(let j=1;j<cuts.length;j++){
    const A=at(cuts[j-1]),B=at(cuts[j]),cx=(A[0]+B[0])*.5,cz=(A[2]+B[2])*.5;
    if(o.domain.some(r=>inside(r,cx,cz))&&ht(o.a,o.b,cx,cz)>(A[1]+B[1])*.5-.037)continue;
    tube('greenTrim',[A[0],A[1]-.056,A[2]],[B[0],B[1]-.056,B[2]],.120,.153);
    tube('whiteframe',[A[0],A[1]+.010,A[2]],[B[0],B[1]+.010,B[2]],.055,.078);
   }
   void len;
  }
 }
 function boxFoundation(r:R){
  const [l,u,n,s]=r;cube('stone',[(l+u)/2,(.36-depth)/2,(n+s)/2],u-l,.36+depth,s-n);
 }
 function shell(r:R,other:R,p:Plane,q:Plane,details:Open[][]){
  boxFoundation(r);
  for(let s=0;s<4;s++){
   const wall=mapping(r,s),h=(x:number)=>{const [X,_,Z]=wall.move(x,0);return ht(p,q,X,Z)-.043;};
   const xh=(x:number)=>{const [X,_,Z]=wall.move(x,0);return cl(p,X,Z)-cl(q,X,Z);};
   const edges=[wall.l,wall.u,...(s<2?other.slice(0,2):other.slice(2)).map(x=>wall.inverse?-x:x)]
    .filter(x=>x>=wall.l&&x<=wall.u).sort((a,b)=>a-b);
   const br=edges.filter((v,i)=>!i||v>edges[i-1]+.001);
   for(let j=1;j<br.length;j++){
    const a=br[j-1],b=br[j],mid=(a+b)/2,[x,_,z]=wall.move(mid,0,.020);
    if(inside(other,x,z))continue;
    const tt=xh(a),uu=xh(b),cuts=[a];
    if(tt*uu<0)cuts.push(a+(b-a)*tt/(tt-uu));
    cuts.push(b);
    const holes=details[s].filter(k=>k.u-k.w/2>a+.008&&k.u+k.w/2<b-.008&&k.y+k.h<h(k.u)-.04);
    const verticalCut=s===2||s===3&&r===mainWalls?6.06: (r===wingWalls&&s===1?5.89:Infinity);
    const top:V[]=cuts.map(x=>[x,h(x)]);
    const ground:V[]=[[a,.24],[b,.24],...top.slice().reverse()];
    if(top.some(v=>v[1]>verticalCut+.011)){
     const bottom=wrap(ground,(_x,y)=>verticalCut-y),g=wrap(ground,(_x,y)=>y-verticalCut);
     if(bottom.length>=3)wallPolygon(wall,'whitewood',bottom,holes.filter(x=>x.y+x.h<verticalCut-.005));
     if(g.length>=3)wallPolygon(wall,'green',g,holes.filter(x=>x.y>verticalCut+.005));
     const line:gLine=[];
     type gLine=Array<number>;
     for(const p of g)if(Math.abs(p[1]-verticalCut)<1e-6)line.push(p[0]);
     if(line.length>=2)mold(wall,'greenTrim',(Math.min(...line)+Math.max(...line))/2,verticalCut,Math.max(...line)-Math.min(...line),.055,.049,.023);
    }else wallPolygon(wall,'whitewood',ground,holes);
    for(const k of holes)window(wall,k);
    const d=.05;
    for(const k of [a+d,b-d])mold(wall,'whiteframe',k,(h(k)+.32)/2,.082,h(k)-.32,.064,.026);
    mold(wall,'greenTrim',(a+b)/2,.31,b-a,.094,.116,.031);
   }
  }
 }
 const w=(u:number,y:number,w:number,h:number,shutters=true,cols=3):Open=>({u,y,w,h,shutters,cols});
 part='main shingled body';
 shell(mainWalls,wingWalls,planes.mainNorth,planes.mainSouth,[
  [w(1.46,.86,.81,1.35),w(3.12,.86,.81,1.35)],
  [],[w(4.10,.89,.83,1.32),w(7.14,.90,.81,1.30),w(4.13,3.75,.85,1.37),w(7.11,3.76,.87,1.38),w(5.36,6.42,.39,.61,false,2)],
  [w(-7.65,.94,.86,1.35),w(-5.64,.93,.91,1.37),w(-7.44,3.82,.81,1.34),w(-4.88,3.78,.86,1.38)],
 ]);
 part='kitchen shingled ell';
 shell(wingWalls,mainWalls,planes.kitchenWest,planes.kitchenEast,[
  [],
  [w(-2.97,.92,.83,1.28),w(-.89,.92,.85,1.32),w(-.54,3.70,.79,1.26),w(-2.59,3.71,.80,1.27)],
  [w(-5.44,.92,.83,1.27),w(-1.82,.92,.81,1.29),{u:-.09,w:.89,y:.29,h:2.10,door:true}],
  [w(.45,.92,.83,1.24),w(4.33,.88,.78,1.18)],
 ]);
 // Survey-backed secondary blue-green dormer on each opposite sloping wing face.
 function dormer(edge:number,u:number,front:number,base:number,ledge:number,peak:number,half:number,depth:number){
  part=edge===3?'east kitchen dormer':'west kitchen dormer';
  const r=edge===3?[0,front,-u-half,-u+half]:[front,0,u-half,u+half],f=mapping(r as R,edge);
  const ww=w(u,base+.176,.624,ledge-base-.204,false,2);
  wallPolygon(f,'whitewood',[[u-half,base],[u+half,base],[u+half,ledge],[u,peak],[u-half,ledge]],[ww]);
  window(f,ww);
  for(const s of [-1,1]){
   const x=u+s*half;const cheek:[P,P,P,P]=[f.move(x,base),f.move(x,base+.31,-depth),f.move(x,ledge-.12,-depth),f.move(x,ledge)];
   if(s<0)cheek.reverse();face('whitewood',...cheek);
   const lip:[P,P,P,P]=[f.move(x+s*.098,ledge+.027,.092),f.move(x+s*.098,ledge-.02,-depth),f.move(u,peak+.040,-depth),f.move(u,peak+.055,.096)];
   if(s<0)lip.reverse();face('roof',...lip);
   tube('greenTrim',f.move(x+s*.102,ledge+.010,.100),f.move(u,peak+.013,.102),.104,.111);
  }
  mold(f,'whiteframe',u,base+.084,2*half+.05,.081,.14,.031);
 }
 dormer(3,1.40,5.30,yy(18.10),yy(19.51),yy(20.164),.637,2.10);
 dormer(2,-2.56,-2.22,yy(17.97),yy(19.53),yy(20.18),.591,2.30);
 part='surveyed chimneys';
 for(const [x,z,h,w,d] of [[3.96,5.664,22.69,.523,.548],[1.86,-3.47,22.84,.601,.586]]){
  cube('brick',[x,yy(h-.75),z],w,1.496,d);
  cube('brick',[x,yy(h-.15),z],w+.097,.142,d+.090);
  cube('capstone',[x,yy(h-.019),z],w+.134,.100,d+.125);
  cube('dark',[x,yy(h+.035),z],w*.59,.018,d*.63);
  cube('hardware',[x,yy(h-1.15),z],w+.143,.103,d+.132);
 }
 part='public entry vestibule';
 if(vestibule){
  const rr=[8.454,10.197,2.11,4.51] as R, lip=[8.31,10.315,1.994,4.647] as R;
  const base=yy(16.710),upper=yy(17.372),f=mapping(rr,3),u=(f.l+f.u)/2;
  const roof=[8.72,9.67,2.895,3.48] as R;
  const visible=[{u,w:1.092,y:.24,h:2.145,door:true,transom:true} as Open];
  boxFoundation(rr);
  for(const side of [0,1,3]){
   const v=mapping(rr,side),open=side===3?visible:[];wallPolygon(v,'whitewood',[[v.l,.22],[v.u,.22],[v.u,base],[v.l,base]],open);
   for(const a of open)window(v,a);
   for(const x of [v.l+.060,v.u-.060])mold(v,'whiteframe',x,(base+.31)*.5,.090,base-.31,.081,.030);
   mold(v,'greenTrim',(v.l+v.u)*.5,base-.033,v.u-v.l+.093,.116,.132,.036);
  }
  const L=shape(lip),H=shape(roof);const pt=(a:V,y:number):P=>[a[0],y,a[1]];
  for(let i=0;i<4;i++){
   const j=(i+1)%4;face('porchRoof',pt(L[i],base),pt(L[j],base),pt(H[j],upper),pt(H[i],upper));
   tube('greenTrim',pt(L[i],base-.032),pt(L[j],base-.032),.096,.118);
  }
  face('porchRoof',pt(H[0],upper),pt(H[1],upper),pt(H[2],upper),pt(H[3],upper));
  if(stairs){
   mold(f,'threshold',u,.111,1.319,.163,.423,.121);
   mold(f,'threshold',u,.035,1.348,.069,.487,.292);
  }
 }
 const o=new T.Group();
 for(const [tag,{type,geo}] of meshes){
  const all=mergeGeometries(geo);for(const a of geo)a.dispose();if(!all)throw Error('Green Gables artwork combine '+tag);
  const m=new T.Mesh(all,mats[type]);m.name=tag;m.castShadow=true;m.receiveShadow=true;o.add(m);
 }
 o.name='Green Gables House · original exterior';return {model:o,count};
}
