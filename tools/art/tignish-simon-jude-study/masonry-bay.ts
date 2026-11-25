// Tignish east-façade visual vocabulary, isolated and normalized.
// +Z outward into the workshop. No world transform or measured altitude/width.
import * as T from 'three';
import {type P,type V,type Cut,lancet,gothicHalf,rect,leafLobe,planarTriangles,clipped,insetShape,area,plus,scale} from './arch-shapes.ts';
import {tignishMaterial,rand} from './surface.ts';
type Mat='brick'|'arch'|'mortar'|'masonry-reveal'|'stone'|'tracery'|'bevel'|'glass'|'shade';
const names:Mat[]=['brick','arch','mortar','masonry-reveal','stone','tracery','bevel','glass','shade'];
const V=(x:number,y:number,z:number):V=>[x,y,z];
const c=(k:number,t=1)=>new T.Color(k).multiplyScalar(t);
const at=(a:P,z:number):V=>[a[0],a[1],z];
class Parts{
 p:number[]=[];uv:number[]=[];co:number[]=[];
 tri(a:V,b:V,d:V,k:T.Color,P0:P,P1:P,P2:P,w=[1,1,1]){
  for(const [i,q]of [a,b,d].entries()){
   this.p.push(...q);this.uv.push(...[P0,P1,P2][i]);this.co.push(k.r*w[i],k.g*w[i],k.b*w[i]);
  }
 }
 q(a:V,b:V,d:V,e:V,k:T.Color,u=.0,v=.0,du=1,dv=1,w=[1,1,1,1]){
  const A:P=[u,v],B:P=[u+du,v],C:P=[u+du,v+dv],D:P=[u,v+dv];
  this.tri(a,b,d,k,A,B,C,[w[0],w[1],w[2]]);this.tri(a,d,e,k,A,C,D,[w[0],w[2],w[3]]);
 }
 box(pos:V,X:V,Y:V,Z:V,k:T.Color,id:number){
  const make=(a:number,b:number,d:number)=>plus(pos,plus(scale(X,a*.5),plus(scale(Y,b*.5),scale(Z,d*.5))));
  const A=make(-1,-1,1),B=make(1,-1,1),C=make(1,1,1),D=make(-1,1,1),a=make(-1,-1,-1),b=make(1,-1,-1),d=make(-1,1,-1),e=make(1,1,-1),s=rand(id,9),t=rand(id,17),x=Math.hypot(...X),y=Math.hypot(...Y),z=Math.hypot(...Z);
  this.q(A,B,C,D,k,s,t,x,y);this.q(b,a,d,e,k,s,t,x,y);this.q(B,b,e,C,k,s,t,z,y);this.q(a,A,D,d,k,s,t,z,y);this.q(D,C,e,d,k,s,t,x,z);this.q(a,b,B,A,k,s,t,x,z);
 }
 polygon(p:P[],z:number,col:T.Color,holes:P[][]=[],sx=1,sy=1,ox=0,oy=0){
  const uv=(q:P):P=>[ox+q[0]*sx,oy+q[1]*sy];
  for(const [a,b,d]of planarTriangles(p,holes))this.tri(at(a,z),at(b,z),at(d,z),col,uv(a),uv(b),uv(d));
 }
}
type Seg={w:number,b:number,s:number,r:number,cx:number};
const A:Seg={w:.685,b:1.012,s:3.47,r:1.245,cx:-.665},F:Seg={w:.581,b:1.12,s:3.485,r:1.115,cx:A.cx};
const curve=(s:Seg)=>lancet(s.w,s.b,s.s,s.r,s.cx,20);
const widen=(s:Seg,amount:number):Seg=>({w:s.w+amount,b:s.b-amount*.36,s:s.s+amount*.07,r:s.r+amount*.89,cx:s.cx});
const limits={left:-2.332,right:2.332,base:.368,top:5.045};
function onArch(a:Seg,y:number){
 if(y<a.b||y>a.s+a.r)return 0;
 if(y<=a.s)return a.w;
 // Consistent chord approximation across bricks and the molded arch to avoid exposed backing slivers.
 const n=20,t=(y-a.s)/a.r*n,i=Math.floor(t),f=t-i,h=(x:number)=>gothicHalf(a.s+x*a.r/n,a.w,a.s,a.r);
 return (1-f)*h(i)+f*h(i+1);
}
function cutBrick(poly:P[],a:Seg,y0:number,y1:number){
 const md=(y0+y1)/2;if(md<a.b||md>a.s+a.r)return [poly];
 const low=onArch(a,y0),high=onArch(a,y1),k=(high-low)/(y1-y0);
 const x=(y:number)=>low+(y-y0)*k;
 return [clipped(poly,([u,v])=>u-a.cx+x(v)),clipped(poly,([u,v])=>a.cx+x(v)-u)].filter(p=>p.length>2&&Math.abs(area(p))>2e-6);
}
export function makeTignishBay(){
 const b=Object.fromEntries(names.map(k=>[k,new Parts()])) as Record<Mat,Parts>;
 let id=8207;
 function box(tag:Mat,x:number,y:number,z:number,w:number,h:number,d:number,k:number,drift=1){
  if(Math.min(w,h,d)<.001)throw Error(`Invalid ${tag} bounds`);
  b[tag].box(V(x,y,z),V(w,0,0),V(0,h,0),V(0,0,d),c(k,drift),id++);
 }
 const wall=widen(A,.113),o=curve(wall),opening=curve(A),frame=curve(F);
 b.mortar.polygon(rect(limits.left,limits.right,limits.base,limits.top),.011,c(0xa0887f),[o],.51,.56);
 // A short dead-dark setback proves the opening is genuinely hollow. No church interior is made.
 b.shade.polygon(curve(widen(A,.04)),-.515,c(0x231f20));
 // Exact tiny wall thickness on the cut sides, never continued into an invented full building.
 b.mortar.q(V(limits.right,limits.base,.009),V(limits.right,limits.base,-.226),V(limits.right,limits.top,-.226),V(limits.right,limits.top,.009),c(0x89766e),.1,.3,.8,3);
 b.mortar.q(V(limits.left,limits.base,-.226),V(limits.left,limits.base,.009),V(limits.left,limits.top,.009),V(limits.left,limits.top,-.226),c(0x89766e),.6,.3,.8,3);
 b.stone.q(V(limits.left,limits.top,.006),V(limits.right,limits.top,.006),V(limits.right,limits.top,-.226),V(limits.left,limits.top,-.226),c(0x98796f),.3,.2,4,.4);
 function raisedBrick(p:P[],seed:number,power:number){
  const a=Math.abs(area(p));if(a<.00005)return;
  const n=p.length,pivot:P=[p.reduce((s,q)=>s+q[0],0)/n,p.reduce((s,q)=>s+q[1],0)/n];
  const brickPalette=[0x965d4e,0x985d50,0xa16354,0x905749,0xa36855,0x935b51,0x92594f,0xa26453,0x9b6053],vers=rand(seed,11);
  const brick=c(brickPalette[Math.floor(brickPalette.length*vers)],.976+.096*rand(seed,14));brick.r*=power;brick.b*=Math.min(1.12,power+.05);
  const bevel=.964+.015*rand(seed,29),inner=insetShape(p,pivot,bevel),z=.020+.012*rand(seed,59),u=rand(seed,23),v=rand(seed,48);
  b.brick.polygon(inner,z,brick,[],1.50,2.9,u,v);
  for(let k=0;k<n;k++){
   const j=(k+1)%n;
   b.brick.q(at(p[k],.013),at(p[j],.013),at(inner[j],z),at(inner[k],z),brick.clone().multiplyScalar(k===2?.94:.96),u,v,.37,.1);
  }
 }
 const Y=[limits.base,wall.b,wall.s+wall.r,limits.top];
 for(let y=limits.base;y<limits.top;y+=.102)Y.push(y);
 const YS=[...new Set(Y.filter(x=>x>=limits.base&&x<=limits.top))].sort((a,b)=>a-b)
 for(let i=0;i+1<YS.length;i++){
  const yl=YS[i],yh=YS[i+1];if(yh-yl<.007)continue;
  const course=Math.floor((yl-limits.base)/.102+1e-6),y0=yl+.004,y1=yh-.0032;if(y1<=y0+.002)continue;
  // The true body joints remain large enough to hold in a low pass, but no repeated billboard mortar pattern.
  const jointed=course%5===3,offset=.12*(course%2);
  let x=limits.left-.276+offset;
  for(let j=0;x<limits.right;j++){
   const seed=course*1223+j*103+319,w=(jointed&&j%6===2?.138:.262)+.014*(rand(seed,39)-.5);
   const l=Math.max(limits.left,x+.0037),r=Math.min(limits.right,x+w-.0038);
   if(r-l>.005){
    const p:P[]=[[l,y0+.001*rand(seed,32)],[r,y0+.0019*rand(seed,12)],[r,y1-.0018*rand(seed,18)],[l,y1-.001*rand(seed,3)]];
    const tone=.976+.06*rand(seed,38)-(y0<.7?.014:0);
    for(const q of cutBrick(p,wall,yl,yh))raisedBrick(q,seed,tone);
   }
   x+=w;
  }
 }
 function shell(inner:P[],outer:P[],front:number,bottom:number,t:Mat,key:number){
  for(let k=0;k<inner.length;k++){
   const j=(k+1)%inner.length,color=c(key,.93+.134*rand(k,id));
   b[t].q(at(inner[k],front),at(outer[k],bottom),at(outer[j],bottom),at(inner[j],front),color,rand(k,88),rand(k,81),.31,.24);
  }
  id++;
 }
 // Stagger two jamb depths and cut the segmented outer brick course to the pointed arch.
 // Geometric narrow joins, not black stripes, separate the proposed voussoirs.
 const inner=widen(A,.008),mid=widen(A,.048),ri=curve(inner),rm=curve(mid);
 shell(rm,o,.061,.013,'arch',0x936053);shell(ri,rm,.048,.061,'arch',0x9b6051);
 const z=.064;
 // A soft relief face runs on each molded brick; 2% in-segment course gaps retain the darker shell behind.
 for(let k=0;k<rm.length;k++){
  const j=(k+1)%rm.length;if(k===rm.length-1)continue;
  const a=rm[k],d=o[k],e=o[j],g=rm[j],midpoint=(p:P,q:P,f:number):P=>[(1-f)*p[0]+f*q[0],(1-f)*p[1]+f*q[1]];
  const run=Math.hypot(a[0]-g[0],a[1]-g[1]),m=run>.78?Math.ceil(run/.105):1;
  for(let s=0;s<m;s++){
   const u=(s+.033)/m,v=(s+.967)/m,i=211+k*41+s;
   b.arch.q(at(midpoint(a,g,u),z),at(midpoint(d,e,u),z-.013),at(midpoint(d,e,v),z-.013),at(midpoint(a,g,v),z),c(0x9e6253,.89+.20*rand(i,7)),rand(i,8),rand(i,17),.26,.14);
  }
 }
 // The splayed jamb is individually faced deep red-clay, not a painted wood plane.
 // Its material-bearing radial wedges and upright return ends carry actual relief.
 shell(frame,opening,-.247,.045,'masonry-reveal',0x746058);
 const blend=(a:P,b:P,f:number):P=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
 for(let e=0;e<opening.length-1;e++){
  const a=opening[e],d=opening[e+1],o=frame[e],n=frame[e+1],L=Math.hypot(d[0]-a[0],d[1]-a[1]);
  const detail=Math.max(1,Math.round(L/.103));
  for(let r=0;r<detail;r++){
   const u=(r+.028)/detail,v=(r+.966)/detail,seed=e*157+r*31,outerA=blend(a,d,u),outerB=blend(a,d,v),innerA=blend(o,n,u),innerB=blend(o,n,v);
   const col=c([0x905347,0x995c4e,0x945b51,0x875344,0x9e6358][Math.floor(5*rand(seed,97))],.93+.15*rand(seed,22));
   const J=rand(seed,123);
   // Break the depth row with a shallow inner return face and small darker joint.
   const a1=blend(innerA,outerA,.407),b1=blend(innerB,outerB,.407),a2=blend(innerA,outerA,.438),b2=blend(innerB,outerB,.438);
   b['masonry-reveal'].q(at(a2,-.116),at(outerA,.049),at(outerB,.049),at(b2,-.116),col,.2+J,.4*J,.77,.26);
   b['masonry-reveal'].q(at(innerA,-.243),at(a1,-.127),at(b1,-.127),at(innerB,-.243),col.clone().multiplyScalar(.91),.02+J,.11+J,.59,.3);
  }
 }
 const cut:Cut[]=[];
 const cols=[[-.525,-.194],[-.153,.151],[.192,.525]],rows=[[1.196,2.128],[2.192,2.924],[2.977,3.444]];
 for(const [row,[l,h]]of rows.entries())for(const [co,[a,z]]of cols.entries()){
  const L=A.cx+a,R=A.cx+z;cut.push({tag:`light/${co}/${row}`,center:[(L+R)*.5,(l+h)*.5],outline:rect(L,R,l,h)});
 }
 for(const [k,x]of [-.363,0,.363].entries()){
  const center:P=[A.cx+x,3.598],outline=lancet(.094,3.507,3.579,.174,center[0],9);
  cut.push({tag:`cusp/${k}`,center,outline});
 }
 for(const [k,[x,y,rx,ry]]of [[-.214,4.011,.178,.192],[.214,4.011,.178,.192],[.0,4.372,.105,.134]].entries()){
  const center:P=[A.cx+x,y];cut.push({tag:`trefoil/${k}`,center,outline:leafLobe(center,rx,ry)});
 }
 const cream=c(0xddd8c9);
 b.tracery.polygon(frame,-.235,cream,cut.map(q=>q.outline),.47,.52);
 for(const [k,p]of cut.entries()){
  const inward=insetShape(p.outline,p.center,k<9?.955:.93),outer=p.outline;
  shell(inward,outer,-.263,-.2346,'bevel',0xc5c4bb);
  const glass=insetShape(p.outline,p.center,k<9?.944:.91),type=k<9?0x43535c:k<12?0x546872:0x5c6771;
  b.glass.polygon(glass,-.276,c(type,.92+.15*rand(k,17)),[],.30,.33);
 }
 // Sill: a gently raked top, a projecting moulded lip and restrained sandstone inset.
 const sill=A.w+.063,p0=A.cx-sill,p1=A.cx+sill;
 b.stone.q(V(p0,.974,-.03),V(p1,.974,-.03),V(p1,1.024,.139),V(p0,1.024,.139),c(0xa38e82),.4,.4,1.5,.35);
 box('stone',A.cx,.977,.060,2*sill,.096,.180,0x9b8880,.98);
 b.stone.q(V(p0,1.024,.138),V(p1,1.024,.138),V(p1,1.068,-.255),V(p0,1.068,-.255),c(0xb5a090),.3,.7,1.55,.35);
 // Low foundation band. It is a study boundary, not a statement about site altitude or thickness.
 box('mortar',0,.207,-.072,4.660,.321,.36,0x796c66);
 for(let i=0,x=limits.left;x<limits.right;i++){
  const step=Math.min(limits.right-x,.295+.306*rand(i,781));if(step<.007)break;
  box('stone',x+step*.5,.209,.069,step-.005,.326,.123,0x957d73,.88+.192*rand(i,97));x+=step;
 }
 box('stone',0,.378,.026,4.703,.077,.196,0xa79489);
 // Standalone fragment of the documented stepped side-buttress vocabulary, not a claim that
 // this particular nave buttress and entrance window share any precise site spacing.
 const bx=1.657;
 const levels=[
  {y0:.30,y1:1.326,w:.660,z:.566},
  {y0:1.412,y1:2.715,w:.585,z:.438},
  {y0:2.804,y1:3.969,w:.490,z:.308},
  {y0:4.056,y1:4.791,w:.396,z:.172},
 ];
 for(const [j,l]of levels.entries()){
  const left=bx-l.w*.5,right=bx+l.w*.5,front=l.z,back=.027;
  const T0=0x958079,lo=l.y0,hi=l.y1;
  box('mortar',bx,(lo+hi)*.5,(front+back)*.5,l.w,hi-lo,front-back,T0);
  const n=Math.round((hi-lo)/.098),step=(hi-lo)/n;
  for(let row=0;row<n;row++){
   const y=lo+(row+.5)*step;
   const v=l.w-(row%2?.002:.001),next=l.w/(2+(row%3===2?1:0)),z=front+.009;
   const patch=[0x955247,0x8d4d42,0xa06053,0x9c574c][Math.floor(rand(row,j*13)*4)];
   for(let k=0;k<v/next-.03;k++){
    const width=Math.min(next,v-k*next),p=left+.5*width+k*next;
    box('brick',p,y,z,width-.006,step-.006,.025,patch,.87+.20*rand(row,k+13*j));
   }
   for(const [k,x]of [left-.004,right+.004].entries()){
    const count=Math.ceil((front-back)/.234),dx=(front-back)/count;
    for(let i=0;i<count;i++)box('brick',x,y,back+(i+.5)*dx,.017,step-.006,dx-.006,patch,.89+.17*rand(j*15+row,k*30+i));
   }
  }
  const w=l.w+.032,x0=bx-w*.5,x1=bx+w*.5,z0=levels[j+1]?.z??.028,bottom=hi-.026,top=(levels[j+1]?.y0??hi+.072)+.003;
  b.stone.q(V(x0,bottom,z0),V(x1,bottom,z0),V(x1,bottom,front+.017),V(x0,bottom,front+.017),c(0x9e887f),.1,.1,.53,.22);
  b.stone.q(V(x0,bottom,front+.017),V(x1,bottom,front+.017),V(x1,hi+.016,front+.019),V(x0,hi+.016,front+.019),c(0xa39489),.2,.4,.52,.11);
  b.stone.q(V(x0,hi+.016,front+.019),V(x1,hi+.016,front+.019),V(x1,top,z0),V(x0,top,z0),c(0xaa9b91),.5,.4,.63,.29);
  b.stone.q(V(x0,bottom,z0),V(x0,bottom,front+.017),V(x0,hi+.016,front+.019),V(x0,top,z0),c(0xa69488),.4,.6,.18,.21);
  b.stone.q(V(x1,bottom,front+.017),V(x1,bottom,z0),V(x1,top,z0),V(x1,hi+.016,front+.019),c(0xa28b81),.17,.4,.27,.26);
 }
 const mats={brick:tignishMaterial('red-clay'),lime:tignishMaterial('lime'),stone:tignishMaterial('stone'),paint:tignishMaterial('paint')};
 const G=new T.Group();G.name='Tignish lancet and buttress · detached workshop';
 for(const n of names){
  const p=b[n],geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(p.p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(p.uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(p.co,3));geo.computeVertexNormals();geo.computeBoundingSphere();
  const mat=n==='glass'?new T.MeshPhysicalMaterial({vertexColors:true,roughness:.17,ior:1.52,clearcoat:.55,clearcoatRoughness:.12,envMapIntensity:1.30}):
   n==='shade'?new T.MeshBasicMaterial({vertexColors:true}):
   new T.MeshStandardMaterial({vertexColors:true,roughness:n==='tracery'?.82:.97,normalScale:new T.Vector2(n==='brick'||n==='arch'||n==='masonry-reveal'?.56:.41,n==='brick'||n==='arch'||n==='masonry-reveal'?.55:.35),...(n==='brick'||n==='arch'||n==='masonry-reveal'?mats.brick:n==='mortar'?mats.lime:n==='tracery'||n==='bevel'?mats.paint:mats.stone)});
  const m=new T.Mesh(geo,mat);m.name=n;m.castShadow=n!=='glass'&&n!=='shade';m.receiveShadow=true;G.add(m);
 }
 G.userData.apertures=cut.map(q=>({tag:q.tag,center:q.center}));return G;
}
