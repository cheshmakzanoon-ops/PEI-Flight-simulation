import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeMaterial,palette,type Colour as C} from './cityhall-materials.ts';
import {surveyed as s} from './cityhall-survey.ts';
export const y=(raw:number)=>raw-s.base;
type P=[number,number,number];
type Rect=[number,number,number,number];
type Band={u:number;y:number;w:number;h:number;arch?:number;trim?:boolean;door?:boolean};
type Level=(x:number,z:number)=>number;
const immutableRoof=(a:readonly number[],x:number,z:number)=>y(a[0]+a[1]*x+a[2]*z);
export function buildCityHall(historicalAnnex=false){
 const m=Object.fromEntries(Object.keys(palette).map(c=>[c,makeMaterial(c as C)])) as Record<C,T.MeshStandardMaterial>;
 let parts=new Map<string,{color:C,data:T.BufferGeometry[]}>();
 let stage='main';const count:Record<string,number>={};
 const push=(src:T.BufferGeometry,color:C,custom?:number[])=>{
  const g=src.index?src.toNonIndexed():src;if(g!==src)src.dispose();
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
   const [x,y,z]=[p.getX(i),p.getY(i),p.getZ(i)],[nx,ny,nz]=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
   uv[2*i]=nz>=nx||ny>=Math.max(nx,nz)?x:z;uv[2*i+1]=ny>=Math.max(nx,nz)?z:y;
  }
  if(custom)uv.set(custom);
  g.setAttribute('uv',new T.BufferAttribute(uv,2));const key=stage+'/'+color;
  if(!parts.has(key))parts.set(key,{color,data:[]});parts.get(key)!.data.push(g);count[stage]=(count[stage]??0)+p.count/3;
 };
 const polygon=(col:C,v:P[],u?:number[])=>{
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(v.flat(),3));g.computeVertexNormals();push(g,col,u);
 };
 const quad=(col:C,a:P,b:P,c:P,d:P,u?:number[])=>polygon(col,[a,b,c,a,c,d],u);
 const box=(col:C,x:number,y:number,z:number,a:number,b:number,d:number)=>{
  if(Math.min(a,b,d)<.001)return;
  push(new T.BoxGeometry(a,b,d).translate(x,y,z),col);
 };
 const tube=(col:C,a:P,b:P,n:number,o=n)=>{
  const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);
  if(v.length()<.0001)return;
  const h=new T.BoxGeometry(n,v.length(),o);
  h.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));h.translate(...p.add(q).multiplyScalar(.5).toArray());push(h,col);
 };
 const xy=(r:Rect,side:number)=>{
  const [l,h,b,t]=r;
  if(side===0)return {lo:l,hi:h,map:(u:number,y:number,d=0):P=>[u,y,t+d],solid:(c:C,p:P,w:number,h:number,d:number)=>box(c,...p,w,h,d)};
  if(side===1)return {lo:-h,hi:-l,map:(u:number,y:number,d=0):P=>[-u,y,b-d],solid:(c:C,p:P,w:number,h:number,d:number)=>box(c,...p,w,h,d)};
  if(side===2)return {lo:b,hi:t,map:(u:number,y:number,d=0):P=>[l-d,y,u],solid:(c:C,p:P,w:number,h:number,d:number)=>box(c,...p,d,h,w)};
  return {lo:-t,hi:-b,map:(u:number,y:number,d=0):P=>[h+d,y,-u],solid:(c:C,p:P,w:number,h:number,d:number)=>box(c,...p,d,h,w)};
 };
 type Face=ReturnType<typeof xy>;
 const band=(f:Face,col:C,l:number,r:number,b:number,t:number,d=0)=>{
  if(l>=r||b>=t)return;
  quad(col,f.map(l,b,d),f.map(r,b,d),f.map(r,t,d),f.map(l,t,d));
 };
 const mould=(f:Face,col:C,u:number,yy:number,span:number,h:number,depth:number,offset:number)=>f.solid(col,f.map(u,yy,offset),span,h,depth);
 function ring2d(w:Band,n=12):T.Vector2[]{
  const L=w.u-w.w*.5,R=w.u+w.w*.5,A=w.y,B=A+w.h,arch=w.arch??0;
  const v=[new T.Vector2(L,A),new T.Vector2(R,A),new T.Vector2(R,B-arch)];
  if(arch)for(let i=1;i<=n;i++){const t=i*Math.PI/n;v.push(new T.Vector2(w.u+w.w*.5*Math.cos(t), B-arch+arch*Math.sin(t)));}
  else v.push(new T.Vector2(L,B));
  return v;
 }
 function wall(f:Face,edge:T.Vector2[],windows:Band[],col:C='brick'){
  const holes=windows.map(v=>ring2d(v)),arr=[edge,...holes].flat();
  for(const q of T.ShapeUtils.triangulateShape(edge,holes)){
   const p=q.map(i=>f.map(arr[i].x,arr[i].y));
   const u=q.map(i=>arr[i]);if((u[1].x-u[0].x)*(u[2].y-u[0].y)-(u[2].x-u[0].x)*(u[1].y-u[0].y)<0)p.reverse();
   polygon(col,p);
  }
 }
 const wallRect=(f:Face,start:number,end:number,windows:Band[],col:C='brick')=>wall(f,[
  new T.Vector2(f.lo,start),new T.Vector2(f.hi,start),new T.Vector2(f.hi,end),new T.Vector2(f.lo,end)
 ],windows,col);
 function glazed(f:Face,w:Band,isInset=false){
  const outer=ring2d(w),inner=ring2d({...w,u:w.u,y:w.y+.059,w:w.w-.118,h:w.h-.109,arch:w.arch?Math.max(.055,w.arch-.036):0});
  const depth=w.door?.232:.165;
  const low=w.y,top=w.y+w.h,ww=w.w,L=w.u-ww*.5,R=w.u+ww*.5;
  for(let i=0;i<outer.length;i++){
   const j=(i+1)%outer.length,a=outer[i],b=outer[j];quad(w.trim?'ashlar':'arch',f.map(a.x,a.y),f.map(b.x,b.y),f.map(b.x,b.y,-depth),f.map(a.x,a.y,-depth));
   const c=inner[i],d=inner[j];quad('sash',f.map(a.x,a.y,-depth-.006),f.map(b.x,b.y,-depth-.006),f.map(d.x,d.y,-depth-.005),f.map(c.x,c.y,-depth-.005));
  }
  const pane=T.ShapeUtils.triangulateShape(inner,[]);
  for(const t of pane){const [a,b,c]=t.map(i=>inner[i]);polygon(w.door?'wood':'glass',[a,b,c].map(v=>f.map(v.x,v.y,-depth-.045)));}
  if(!w.door){
   mould(f,'sash',w.u,low+w.h*.47,ww-.076,.047,.047,-depth-.010);
   if(ww>.96)mould(f,'sash',w.u,low+w.h*.51,.033,w.h-.14,.042,-depth-.010);
  }else{
   const w1=ww*.72,h1=w.h*.39,top2=top-(w.arch??0)-.15;
   band(f,'glass',w.u-w1/2,w.u+w1/2,top2-h1,top2,-depth-.027);
   mould(f,'wood',w.u,top2-h1*.50,.040,h1,.046,-depth+.005);
   const bot=low+.103,plankH=Math.min(.92,Math.max(.28,top2-h1-bot-.157));
   for(const q of [-1,1]){
    const u=w.u+q*ww*.229,a=u-ww*.140,b=u+ww*.140;
    band(f,'shadow',a,b,bot+.062,bot+plankH,-depth-.020);
    for(const yy of [bot+.046,bot+plankH])mould(f,'wood',u,yy,ww*.317,.053,.046,-depth+.006);
    for(const left of [a-.018,b+.018])mould(f,'wood',left,bot+plankH*.523,.052,plankH-.027,.043,-depth+.004);
   }
   mould(f,'wood',w.u,bot+(top2-bot)*.49,.045,top2-bot,.054,-depth+.009);
   mould(f,'copperBright',w.u+.28,low+w.h*.48,.059,.084,.040,-depth+.023);
  }
  const si=w.door?.12:.091;
  if(!isInset){
   mould(f,'ashlar',w.u,low-si*.43,ww+.24,si,.256,.041);
   if(!w.arch)mould(f,'ashlar',w.u,top+.045,ww+.18,.105,.136,.034);
  }
  if(w.arch){
   const n=w.door?15:11,rad=ww*.5,ra=w.arch;
   const rim=w.trim?.206:.105;
   const T1=(t:number,d=0,front=.069)=>f.map(w.u+(rad+d)*Math.cos(t),top-ra+(ra+d)*Math.sin(t), w.trim?front:.033);
   for(let i=0;i<n;i++){
    const a=(i+.064)*Math.PI/n,b=(i+.930)*Math.PI/n;
    quad(w.trim?'ashlar':'arch',T1(a),T1(a,rim),T1(b,rim),T1(b));
    if(w.trim){
     quad('ashlar',T1(a,rim,0),T1(b,rim,0),T1(b,rim),T1(a,rim));
     quad('foundation',T1(a,0),T1(b,0),T1(b,0,0),T1(a,0,0));
    }
   }
   if(w.door)for(const q of [L-rim*.52,R+rim*.52])
    mould(f,'ashlar',q,low+(w.h-ra)*.5,rim,w.h-ra,.169,.046);
  }
 }
 const planar=(r:Rect,lev:Level,col:C,back=false)=>{
  const [l,h,b,t]=r, v:[P,P,P,P]=[[l,lev(l,t),t],[h,lev(h,t),t],[h,lev(h,b),b],[l,lev(l,b),b]];if(back)v.reverse();quad(col,...v);
 };
 const rectangle=(r:Rect,lev:Level):P[]=>{
  const [l,h,b,t]=r;return [[l,lev(l,t),t],[h,lev(h,t),t],[h,lev(h,b),b],[l,lev(l,b),b]];
 };
 function shirt(a:P[],b:P[],col:C){
  for(let i=0;i<a.length;i++){const j=(i+1)%a.length, A=a[i],B=a[j],C=b[j],D=b[i],span=Math.hypot(B[0]-A[0],B[2]-A[2]),w=Math.hypot(C[0]-D[0],C[2]-D[2]),e=(span-w)*.5,dx=Math.hypot(D[0]-A[0],D[1]-A[1],D[2]-A[2]);
   quad(col,A,B,C,D,[0,A[1],span,A[1],span-e,A[1]+dx,0,A[1],span-e,A[1]+dx,e,A[1]+dx]);
  }
 }
 const extend=(r:Rect,k:number):Rect=>[r[0]-k,r[1]+k,r[2]-k,r[3]+k];
 function roof(lip:Rect,top:Rect,lower:number,H:Level,surface:C='slate',topMat:C='membrane'){
  const e=rectangle(lip,()=>lower),t=rectangle(top,H);
  shirt(e,t,surface);planar(top,H,topMat);
  for(let i=0;i<4;i++){
   const j=(i+1)%4; tube('aluminum',e[i],e[j],.074,.094);
   tube('aluminum',t[i],t[j],.053,.070);
  }
 }
 const main:Rect=[-7.55,19.84,-6.63,8.91],west:Rect=[-15.13,-7.52,-8.55,9.76],mainE=y(20.14),westE=y(20.36);
 function building(r:Rect,start:number,e:number,facades:Partial<Record<number,Band[]>>,sides:number[],style='main'){
  for(const side of sides){
   const f=xy(r,side), openings=(facades[side]??[]).map(w=>{
    if(w.door)return {...w,h:w.h+.17};
    if(w.y>5&&w.y<7)return {...w,y:w.y+.755,h:w.h+.128};
    if(w.y>1.81&&w.y<3)return {...w,y:w.y+.322,h:w.h+.152};
    return w;
   });
   const lev=1.32;
   wallRect(f,start,lev,openings.filter(o=>o.y<lev&&o.y+o.h<lev),'foundation');
   wallRect(f,lev,e,openings.filter(o=>o.y>=lev));
   for(const w of openings)glazed(f,w);
   mould(f,'ashlar',(f.lo+f.hi)/2,lev,f.hi-f.lo+.06,.161,.194,.029);
   mould(f,'ashlar',(f.lo+f.hi)/2,e-.204,f.hi-f.lo+.13,.190,.248,.035);
   mould(f,'aluminum',(f.lo+f.hi)/2,e-.062,f.hi-f.lo+.20,.088,.325,.042);
   for(const line of (style==='main'?[5.31,9.245]:[]))
    mould(f,'ashlar',(f.lo+f.hi)/2,line,f.hi-f.lo+.061,.077,.112,.018);
   for(const u of [f.lo+.20,f.hi-.20]){
    for(let j=0;j<10;j++)mould(f,j%2?'foundation':'ashlar',u,start+.042+j*.143,j%2?.407:.37,.119,.153,.039);
    for(let j=0;j<12;j++)mould(f,'arch',u,lev+.248+j*.68,j%2?.41:.34,.155,.106,.037);
   }
  }
 }
 const windows=(u:number[],lev:number,w:number,h:number,arch=0)=>u.map(u=>({u,y:lev,w,h,arch}));
 stage='historic brick body';
 const pavilion:Rect=[2.01,9.23,main[2],main[3]+.32];
 const paired=(centre:number,level:number,wa:number,wb:number,h:number,arch=.08,dist=1.0):Band[]=> [
  {u:centre-dist*.5,y:level,w:wa,h,arch},{u:centre+dist*.5,y:level,w:wb,h,arch}
 ];
 const triple=(mid:number,lev:number,w:number,midWidth:number,h:number,arc:number,dx:number):Band[]=>[
  {u:mid-dx,y:lev,w,h,arch:arc},{u:mid,y:lev,w:midWidth,h,arch:arc},{u:mid+dx,y:lev,w,h,arch:arc}
 ];
 // Compact rhythm from the two distinct documented elevations, not the
 // proposed replacement windows, ramp, stairs, or a survey of the present facade.
 building(main,-.09,mainE,{
  1:[...windows([-17.25,-14.45,-11.53,-8.51,-5.55,-2.59,1.44,4.60],5.62,1.10,1.84,.078),
   ...windows([-17.45,-14.65,-11.56,-8.65,-5.72,-2.71,1.54,4.67],2.16,.86,1.69,.12)],
  3:[...windows([-6.55,-2.3,2.11,4.91],2.13,.91,1.68,.12),...windows([-6.5,-2.31,2.12,5.02],5.55,1.02,1.92,.081)]
 },[1,3]);
 // Projected bay between two physically joined return walls, two roofs same
 // source plane. Slight relief is intentionally not a placed plan correction.
 building([main[0],pavilion[0],main[2],main[3]],-.09,mainE,{0:[
  ...windows([-5.31,-1.31],5.39,1.02,2.07,.071),...windows([-5.34,-1.34],1.97,.98,2.02,.083)
 ]},[0]);
 const southDoor:Band={u:5.63,y:1.331,w:1.92,h:3.21,arch:.641,trim:true,door:true};
 building(pavilion,-.09,mainE,{0:[southDoor,...triple(5.61,5.44,.81,1.18,2.08,.064,1.39)]},[0]);
 for(const side of [2,3]){
  const f=xy(pavilion,side),u=side===2?main[3]:-pavilion[3],v=side===2?pavilion[3]:-main[3];
  band(f,'brick',u,v,1.32,mainE+.02);
  band(f,'foundation',u,v,-.09,1.32);
  mould(f,'ashlar',(u+v)*.5,1.32,v-u+.030,.140,.12,.016);
 }
 for(const [L,R] of [[main[3],pavilion[3]]] as const)
  planar([pavilion[0],pavilion[1],L,R],()=>mainE+.021,'slate');
 const entrance=xy(pavilion,0);
 for(const q of [3.02,8.18]){
  mould(entrance,'brick',q,4.64,.323,6.44,.239,.123);
  mould(entrance,'ashlar',q,1.43,.47,.26,.276,.129);
  mould(entrance,'ashlar',q,7.94,.492,.17,.296,.134);
  mould(entrance,'foundation',q,8.055,.42,.056,.244,.133);
 }
 building([pavilion[1],main[1],main[2],main[3]],-.09,mainE,{0:[
  ...windows([10.96,13.53,15.83,18.21],1.97,.87,2.07,.109),
  ...windows([10.85,13.51,15.81,18.15],5.42,.98,2.05,.077)
 ]},[0]);
 stage='west masonry volume';
 const doors=[-5.06,6.23].map(u=>({u,y:1.331,w:1.47,h:2.89,arch:.61,trim:true,door:true} as Band));
 building(west,-.09,westE,{
  0:[...windows([-13.65,-10.40],2.23,.87,1.68,.16),...windows([-13.59,-10.41],5.47,1.12,2.15,.15),...windows([-11.88],8.38,.90,1.38,.10)],
  1:[...windows([9.15,13.01],2.05,.96,1.87,.14),...windows([9.31,13.03],5.55,1.15,2.13,.12)],
  2:[...doors,...triple(-.57,2.12,.665,1.23,2.05,.092,1.31),...triple(-.57,5.49,.686,1.23,2.15,.091,1.33),
   ...windows([-5.36],5.48,.82,2.11,.126),...paired(6.15,5.48,.76,.75,2.11,.089,1.09)]
 },[0,1,2]);
 const westF=xy(west,2);
 for(const u of [-3.10,2.15])for(const [Y,w,h,id] of [[1.48,.273,.23,'ashlar'],[5.37,.271,.092,'ashlar'],[6.50,.206,3.31,'brick']] as const)
  mould(westF,id,u,Y,w,h,.201,.095);
 // Datumed measured flat reaches plus the clear public chart silhouette, no mechanical roof equipment.
 stage='main measured membrane and slate';
 roof(extend(main,.085),[-6.37,17.80,-4.74,6.36],mainE,(x,z)=>immutableRoof(s.mainMembrane,x,z));
 stage='lower west slate';
 roof(extend(west,.072),[-14.05,-8.05,-6.6,7.61],westE,()=>y(23.03),'slate','slate');
 const high:Rect=[-11.35,-8.70,-4.63,1.71];
 const highBase:Rect=[-12.33,-7.64,-5.75,2.68];
 // Measured west plateau; author continuous slate cheeks down into the existing lower west roof.
 const lowStep:Rect=[-12.90,-7.23,-6.10,3.10];
 const lower=rectangle(lowStep,()=>y(22.93)),upper=rectangle(highBase,()=>y(25.42));
 shirt(lower,upper,'slate');
 roof(highBase,high,y(25.42),(x,z)=>immutableRoof(s.westMezzanine,x,z),'slate','membrane');
 function gable(f:Face,centre:number,width:number,eave:number,top:number,zRear:number,motif:number,rearApex=top-.044){
  const L=centre-width*.5,R=centre+width*.5;
  const foot=eave-.025, wTop=top-1.67;
  const W:Band[]=motif===0?windows([centre-.94,centre+.94],eave+.58,.82,1.48,.053):
   motif===1?windows([centre],eave+.54,1.22,1.63,.37):
   motif===2?triple(centre,eave+.58,.613,.745,1.24,.051,.847):[];
  wall(f,[new T.Vector2(L,foot),new T.Vector2(R,foot),new T.Vector2(centre,top)],W);
  for(const w of W)glazed(f,w);
  for(const j of [-1,1]){
   const A=f.map(centre+j*width*.5,foot,.018),B=f.map(centre,top,.037);
   const sheet:[P,P,P,P]=[A,f.map(centre+j*width*.5,foot,-zRear),f.map(centre,rearApex,-zRear),B];
   if(j<0)sheet.reverse();
   quad('slate',...sheet);
   tube('ashlar',A,B,.083,.147);
   tube('aluminum',f.map(centre+j*width*.5,foot+.104,.061),f.map(centre,top+.094,.049),.072,.144);
  }
  if(motif===1)mould(f,'ashlar',centre,wTop,width*.22,.087,.085,.034);
 }
 stage='triangular historic gables';
 gable(xy(pavilion,0),5.62,7.608,mainE,y(25.81),3.27,2,y(23.22));
 gable(xy(west,2),-.73,7.330,westE,y(27.55),3.45,2);
 gable(xy(west,1),11.27,7.42,westE,y(27.16),4.71,0);
 function dormer(side:number,pos:number,r:Rect,fl:number,top:number,w:number,d:number){
  const base=xy(r,side),f={...base,lo:pos-w*.5,hi:pos+w*.5,map:(u:number,Y:number,D=0)=>base.map(u,Y,-.25+D)};
  const win={u:pos,y:fl+.16,w:w*.59,h:1.06,arch:.045};
  wallRect(f,fl,top,[win]);glazed(f,win,true);
  const L=pos-w*.5,R=pos+w*.5;
  for(const u of [L,R]){
   const cheek:[P,P,P,P]=[f.map(u,fl),f.map(u,fl,-d),f.map(u,top-.18,-d),f.map(u,top)];
   if(u===L)cheek.reverse();quad('brick',...cheek);
  }
  for(const u of [L-.12,R+.12]){
   const sheet:[P,P,P,P]=[f.map(u,top-.15,.105),f.map(u,top-.145,-d),f.map(pos,top+.30,-d),f.map(pos,top+.34,.113)];
   if(u<pos)sheet.reverse();quad('slate',...sheet);
   tube('aluminum',f.map(u,top-.142,.111),f.map(pos,top+.343,.120),.060,.075);
  }
  polygon('arch',[f.map(L,top-.16),f.map(R,top-.16),f.map(pos,top+.336)]);
 }
 stage='recessed roof dormers';
 for(const [p,w0] of [[-3.76,1.92],[11.05,2.09],[15.38,2.08]])dormer(0,p,main,y(20.54),y(22.19),w0,1.57);
 for(const [p,w0] of [[-15.66,2.33],[-3.36,2.14]])dormer(1,p,main,y(20.53),y(22.09),w0,1.59);
 dormer(3,.53,main,y(20.54),y(22.07),2.75,1.60);
 dormer(2,-5.47,west,y(20.67),y(22.63),1.65,1.58);
 dormer(2,6.08,west,y(20.67),y(22.63),1.64,1.57);
 stage='square chimneys';
 box('brick',-.97,y(24.1),5.86,.85,7.23,.83);
 box('arch',-.97,y(27.65),5.86,1.02,.26,1.01);
 box('ashlar',-.97,y(27.83),5.86,1.10,.11,1.07);
 box('shadow',-.97,y(27.895),5.86,.49,.023,.46);
 box('brick',12.18,y(24.0),-2.98,.69,1.79,.67);
 box('ashlar',12.18,y(24.96),-2.98,.80,.116,.79);
 // Art-supported clock; exact location of exterior furnishings, finishes and weather in the
 // historic archive are not current claims. Dated unclassified height returns constrain the cap.
 stage='clock tower slate plinth';
 const tx=-12.59,tz=-.407, square=(a:number,b=a):Rect=>[tx-a,tx+a,tz-b,tz+b];
 const wide=square(2.31,2.49),mid=square(1.23,1.20);
 roof(wide,mid,y(23.22),()=>y(30.21),'slate','slate');
 for(const side of [0,1,2,3]){
  const f=xy(mid,side),m=(f.lo+f.hi)*.5,win=windows([m-.41,m+.41],y(29.45),.42,.64,.06);
  wallRect(f,y(28.83),y(30.25),win,'slate');win.forEach(x=>glazed(f,x,true));
 }
 stage='clockwork patinated copper';
 const cabinet=square(1.438,1.525);
 for(const side of [0,1,2,3]){
  const f=xy(cabinet,side), mid=(f.lo+f.hi)*.5;
  wallRect(f,y(30.18),y(32.43),[],'copper');
  for(const [Y,w,h,d] of [[30.20,3.02,.135,.28],[30.37,2.98,.114,.206],[30.52,2.91,.139,.112],[32.26,3.15,.159,.205],[32.43,3.16,.073,.303]]){
   mould(f,'copper',mid,y(Y),w,h,d,.024);
  }
  for(const u of [f.lo+.126,f.hi-.126]){
   mould(f,'copperBright',u,y(31.46),.174,1.91,.115,.064);
   mould(f,'copper',u,y(30.66),.206,.272,.159,.092);
   mould(f,'copper',u,y(32.30),.199,.283,.170,.092);
  }
  // Oxidized, shadowed punch-louver apron documented below the clock faces.
  band(f,'shadow',mid-.877,mid+.877,y(30.565),y(30.826),.065);
  for(let k=-8;k<=8;k++){
   mould(f,'copperBright',mid+k*.101,y(30.690),.041,.238,.071,.087);
  }
  mould(f,'copper',mid,y(30.835),1.84,.044,.077,.078);
  const faceY=y(31.58), D=.112, r=.654, N=48;
  const point=(t:number,R:number,depth:number)=>f.map(mid+R*Math.cos(t),faceY+R*Math.sin(t),depth);
  for(let i=0;i<N;i++){
   const a=i*2*Math.PI/N,b=(i+1)*2*Math.PI/N;
   polygon('clock',[f.map(mid,faceY,D),point(a,r-.019,D),point(b,r-.019,D)]);
   quad('copperBright',point(a,r,D+.023),point(a,r+.121,D+.034),point(b,r+.121,D+.034),point(b,r,D+.023));
   quad('copper',point(a,r+.121,D+.034),point(a,r+.143,.073),point(b,r+.143,.073),point(b,r+.121,D+.034));
  }
  // Thin brass casting outlines, not printed clock art. Twelve fixed ticks and a single illustrative time.
  for(let i=0;i<60;i++){
   const a=i*2*Math.PI/60, major=i%5===0;
   tube('hands',point(a,major?.468:.522,D+.027),point(a,.560,D+.027),major?.028:.010,major?.018:.011);
  }
  for(const [t,L,w] of [[2.48,.375,.050],[.81,.506,.035]]){
   tube('hands',point(t,-.103,D+.055),point(t,L,D+.057),w,.026);
  }
  mould(f,'copperBright',mid,faceY,.069,.073,.036,D+.054);
  // The casing keeps the visible copper hood around the black-green register.
  for(let i=0;i<18;i++){
   const a=Math.PI*i/18,b=Math.PI*(i+1)/18;
   const outer=(t:number,k:number,d:number)=>f.map(mid+(r+.18+k)*Math.cos(t),faceY+(r+.24+k)*Math.sin(t),d);
   quad('copper',outer(a,.054,.058),outer(b,.054,.058),outer(b,0,D+.080),outer(a,0,D+.080));
  }
 }
 // Bounded architectural fit to the observed sector of unclassified 2020 returns.
 // This authored copper hood should not be called a whole independently surveyed tower.
 const eaveX=1.665,eaveZ=1.812;
 const hood=(r:number):Rect=>{
  const dx=.223*(1-r),dz=-.10*(1-r);
  return [tx+dx-eaveX*r,tx+dx+eaveX*r,tz+dz-eaveZ*r,tz+dz+eaveZ*r];
 };
 const hoodCourse=(r:number)=>y(32.24+1.616*Math.pow(1-r,.68));
 const hoodCorners=(r:number):P[]=>{
  const [l,h,b,t]=hood(r),cut=.103,k=(h-l)*cut*.5,v=(t-b)*cut*.5,Y=hoodCourse(r);
  return [[l+k,Y,t],[h-k,Y,t],[h,Y,t-v],[h,Y,b+v],[h-k,Y,b],[l+k,Y,b],[l,Y,b+v],[l,Y,t-v]];
 };
 const tiers=[1,.939,.798,.621,.447,.280,.131,.040].map(hoodCorners);
 for(let i=1;i<tiers.length;i++)shirt(tiers[i-1],tiers[i],'copper');
 const crown=tiers.at(-1)!;for(let j=1;j<crown.length-1;j++)polygon('copper',[crown[0],crown[j],crown[j+1]]);
 for(let j=0;j<8;j++){
  const k=(j+1)%8;
  for(const f of j%2===0?[.018,.223,.465,.71,.972]:[.54])for(let i=1;i<tiers.length;i++){
   const a=tiers[i-1][j],b=tiers[i-1][k],c=tiers[i][j],d=tiers[i][k];
   const p=a.map((v,n)=>v+f*(b[n]-v)+(n===1?.008:0)) as P,Q=c.map((v,n)=>v+f*(d[n]-v)+(n===1?.008:0)) as P;
   tube('copperBright',p,Q,.011,.010);
  }
 }
 push(new T.CylinderGeometry(.022,.036,.31,8).translate(tx+.214,y(33.936),tz-.096),'copper');
 push(new T.SphereGeometry(.057,10,7).translate(tx+.214,y(34.04),tz-.096),'copperBright');
 // Optional detached 2020 annex only if explicitly asked for in the private study.
 // Approval for demolition is not a claim it actually occurred, so no current default model.
 if(historicalAnnex){
  stage='historical 2020 annex';
  const [x0,x1,z0,z1,e,cap,xs,zs]=s.annexHippedSlates,r:Rect=[x0,x1,Math.max(z0,8.1),z1];
  const zRear=e+(r[2]-z0)*zs, y0=()=>y(e),lev=(X:number,Z:number)=>y(Math.min(cap,e+(X-x0)*xs,e+(x1-X)*xs,e+(Z-z0)*zs,e+(z1-Z)*zs));
  const slope:Rect=[x0+(cap-e)/xs,x1-(cap-e)/xs,Math.max(r[2],z0+(cap-e)/zs),z1-(cap-e)/zs];
  if(slope[0]<slope[1]&&slope[2]<slope[3]){
   const rr=rectangle(r,lev);shirt(rr,rectangle(slope,()=>y(cap)),'slate');planar(slope,()=>y(cap),'slate');
  }
  const wa=xy(r,2),wb=xy(r,3),w=xy(r,0);wallRect(w,-.08,y0(),windows([(x0+x1)*.5],1.74,.87,1.59,.25));
  windows([(x0+x1)*.5],1.74,.87,1.59,.25).forEach(o=>glazed(w,o));
  for(const f of [wa,wb]){
   const holes=windows([(f.lo+f.hi)/2-1.82,(f.lo+f.hi)/2+1.83],1.83,.82,1.57,.24);
   wallRect(f,-.083,y(e),holes);holes.forEach(o=>glazed(f,o));mould(f,'ashlar',(f.lo+f.hi)*.5,1.46,f.hi-f.lo,.106,.158,.039);
  }
  wallRect(xy(r,1),0,y(zRear),[]);
 }
 const model=new T.Group();
 for(const [name,{color,data}] of parts){
  const b=mergeGeometries(data);for(const g of data)g.dispose();
  if(!b)throw Error('Summer City Hall art batch '+name);
  const mesh=new T.Mesh(b,m[color]);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);
 }
 model.name='Summerside City Hall · detached art study';
 return {model,count,materials:m};
}
