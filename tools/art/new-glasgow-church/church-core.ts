import * as T from 'three';

/** Independent original reconstruction of the February 2012 photographed front and visible flank.
 * Local coordinates are illustrative; this is neither a georeferenced nor a current whole building. */
type P=readonly [number,number,number];
type Q=readonly [number,number];
const R={siding:0,trim:1,roof:2,spire:3,lining:4,glass:5,plinth:6,iron:7,floor:8} as const;
type Role=typeof R[keyof typeof R];
const Xp:P=[1,0,0],Xm:P=[-1,0,0],Yp:P=[0,1,0],Ym:P=[0,-1,0],Zp:P=[0,0,1],Zm:P=[0,0,-1];
const sc=(a:P,s:number):P=>[a[0]*s,a[1]*s,a[2]*s];
const ad=(a:P,b:P):P=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:P,b:P):P=>ad(a,sc(b,-1));
const dot=(a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:P):P=>sc(a,1/Math.hypot(...a));
const rect=(l:number,r:number,f:number,b:number):Q[]=>[[l,f],[r,f],[r,b],[l,b]];
const tau=2*Math.PI;

class Shell {
 position:number[]=[]; normal:number[]=[]; uv:number[]=[]; role:number[]=[];
 sections:Record<string,number>={}; runs:Record<string,[number,number][]>={};
 tri(a:P,b:P,c:P,w:P,m:Role,k:string){
   let n=cross(sub(b,a),sub(c,a)); const s=Math.hypot(...n);
   if(!(s>1e-10))throw Error('zero triangle: '+k);
   if(dot(n,w)<0){[b,c]=[c,b];n=sc(n,-1);}
   n=sc(n,1/s);
   this.sections[k]=(this.sections[k]??0)+1;
   const row=this.position.length/3, ranges=this.runs[k]??(this.runs[k]=[]);
   const last=ranges.at(-1);
   if(last?.[1]===row)last[1]=row+3;else ranges.push([row,row+3]);
   for(const p of [a,b,c]){
     this.position.push(...p);this.normal.push(...n);this.role.push(m);
     this.uv.push(...(Math.abs(n[1])>.42 ? [p[2],p[0]/Math.max(.52,Math.abs(n[1]))] :
            Math.abs(n[0])>.51 ? [p[2],p[1]]:[p[0],p[1]]));
   }
 }
 quad(a:P,b:P,c:P,d:P,w:P,m:Role,k:string){this.tri(a,b,c,w,m,k);this.tri(a,c,d,w,m,k);}
 panel(out:Q[],holes:Q[][],map:(p:Q)=>P,w:P,m:Role,k:string){
   const vec=(v:Q[])=>v.map(x=>new T.Vector2(...x));
   const all=out.concat(...holes), ix=T.ShapeUtils.triangulateShape(vec(out),holes.map(vec));
   if(!ix.length)throw Error('panel: '+k);
   for(const [i,j,l] of ix)this.tri(map(all[i]),map(all[j]),map(all[l]),w,m,k);
 }
 box(x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,m:Role,k:string){
   const a:P=[x0,y0,z0], b:P=[x1,y0,z0], c:P=[x1,y0,z1], d:P=[x0,y0,z1];
   const e:P=[x0,y1,z0], f:P=[x1,y1,z0], g:P=[x1,y1,z1], h:P=[x0,y1,z1];
   this.quad(a,b,c,d,Ym,m,k); this.quad(e,h,g,f,Yp,m,k);
   this.quad(a,e,f,b,Zm,m,k); this.quad(d,c,g,h,Zp,m,k);
   this.quad(a,d,h,e,Xm,m,k); this.quad(b,f,g,c,Xp,m,k);
 }
 tube(points:P[],radius:number,m:Role,k:string,steps=16){
   const curve=new T.CatmullRomCurve3(points.map(x=>new T.Vector3(...x)),false,'centripetal');
   const geo=new T.TubeGeometry(curve,steps,radius,6,false);
   try{
     const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),ix=geo.index!;
     const get=(v:T.BufferAttribute|T.InterleavedBufferAttribute,i:number):P=>[v.getX(i),v.getY(i),v.getZ(i)];
     for(let i=0;i<ix.count;i+=3){
       const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);
       this.tri(get(p,a),get(p,b),get(p,c),ad(get(n,a),ad(get(n,b),get(n,c))),m,k);
     }
     for(const [i,t,k0] of [[0,0,-1],[steps*7,1,1]] as const){
       const q=curve.getPointAt(t).toArray(), n0=sc(curve.getTangentAt(t).toArray(),k0);
       for(let s=0;s<6;s++)this.tri(q,get(p,i+s),get(p,i+(s+1)%6),n0,m,k);
     }
   }finally{geo.dispose();}
 }
 geometry(){
   const g=new T.BufferGeometry();
   for(const [k,d,s] of [['position',this.position,3],['normal',this.normal,3],
       ['uv',this.uv,2],['churchRole',this.role,1]] as const)
     g.setAttribute(k,new T.Float32BufferAttribute(d,s));
   g.computeBoundingBox();g.computeBoundingSphere();return g;
 }
}

type Plane={at:(q:Q,d:number)=>P;n:P};
const F=(z:number):Plane=>({n:Zm,at:([x,y],d)=>[x,y,z-d]});
const S=(x:number):Plane=>({n:Xp,at:([z,y],d)=>[x+d,y,z]});
const PANE=(s:Shell,p:Plane,q:Q[],d:number,m:Role,k:string)=>
 s.panel(q,[],(v)=>p.at(v,d),p.n,m,k);
function pointed(c:number,w:number,b:number,t:number,kind=.28){
  // Two independent jambs and a continuous pointed shoulder. All concentric reveal
  // rings share the same node count; zero-length apex/corner edges are never emitted.
  const h=t-b, a=h*kind, d=w/2;
  const q:Q[]=[[c-d,b],[c+d,b],[c+d,t-a]];
  for(let i=1;i<=8;i++){const s=i/8;q.push([c+d*(1-.55*s*s-.45*s*s*s),t-a+a*s]);}
  for(let i=7;i>=0;i--){const s=i/8;q.push([c-d*(1-.55*s*s-.45*s*s*s),t-a+a*s]);}
  return q;
}
function circle(cx:number,cy:number,r:number):Q[]{
 return Array.from({length:24},(_,i)=>[cx+r*Math.cos(i*tau/24),cy+r*Math.sin(i*tau/24)]);
}
function strip(s:Shell,p:Plane,a:Q[],b:Q[],d0:number,d1:number,r:Role,tag:string){
 for(let i=0;i<a.length;i++){
   const j=(i+1)%a.length, aa=p.at(a[i],d0),ab=p.at(a[j],d0),ba=p.at(b[i],d1),bb=p.at(b[j],d1);
   // Same projected area can have actual depth; choose normals consistent with
   // inward reveals. Outward-facing front rings use the plane's forward normal.
   const inner=dot(cross(sub(ab,aa),sub(bb,aa)),p.n);
   const outward=Math.abs(inner)>3e-8?p.n:unit(sub(ba,aa));
   s.quad(aa,ab,bb,ba,outward,r,tag);
 }
}
interface Opening {
 readonly id:string; readonly c:number; readonly w:number; readonly b:number; readonly t:number;
 readonly kind:'main'|'lancet'|'oculus'|'tower'|'louver';
}
function oculusHood(s:Shell,p:Plane,a:Opening){
 const cy=(a.b+a.t)/2,r=.393;
 const arc=(rad:number,i:number):Q=>{
   const theta=Math.PI*(-.087+1.174*i/18);
   return [a.c+rad*Math.cos(theta),cy+rad*Math.sin(theta)];
 };
 for(let i=0;i<18;i++){
   const j=i+1, A=arc(r,i),B=arc(r,j),C=arc(r+.038,j),D=arc(r+.038,i);
   const h0=.052,h1=-.007,w=p.n;
   const a=p.at(A,h0),b=p.at(B,h0),c=p.at(C,h0),d=p.at(D,h0);
   s.quad(a,b,c,d,w,R.trim,'oculus raised pale hood');
   s.quad(p.at(A,h1),p.at(B,h1),p.at(C,h1),p.at(D,h1),sc(w,-1),R.trim,'oculus hood buried attachment');
   s.quad(p.at(A,h1),p.at(B,h1),b,a,[a[0]-(d[0]+a[0])*.5,a[1]-(d[1]+a[1])*.5,0],R.lining,
     'oculus hood shadow underside');
   s.quad(d,c,p.at(C,h1),p.at(D,h1),[d[0]-a[0],d[1]-a[1],0],R.trim,'oculus hood outer return');
   if(i===0)s.quad(a,d,p.at(D,h1),p.at(A,h1),[1,-1,0],R.trim,'oculus hood solid end');
   if(j===18)s.quad(b,c,p.at(C,h1),p.at(B,h1),[-1,-1,0],R.trim,'oculus hood solid end');
 }
}
function window(s:Shell,p:Plane,a:Opening):Q[]{
 const small=a.kind==='louver'||a.kind==='oculus', broad=a.kind==='main'||a.kind==='tower';
 const arch=a.kind==='oculus'?(z:number)=>circle(a.c,(a.b+a.t)/2,a.w*.5-z):
       (z:number)=>pointed(a.c,a.w-2*z,a.b+z,a.t-z,broad?.40:.28);
 const r=small?.03:broad?.056:.046;
 const a0=arch(0),a1=arch(-.030),a2=arch(r),a3=arch(r+.014),outer=arch(-.055);
 strip(s,p,a0,outer,0,.021,R.lining,a.id+'/attached outline outer');
 strip(s,p,outer,a1,.021,.039,R.lining,a.id+'/attached outline lip');
 strip(s,p,a1,a2,.039,.035,R.trim,a.id+'/frontal rim');
 strip(s,p,a2,a3,.035,-.093,R.lining,a.id+'/inset reveal');
 PANE(s,p,a3,-.093,a.kind==='louver'||a.kind==='oculus'?R.lining:R.glass,a.id+'/opaque backing');
 if(a.kind==='main'||a.kind==='tower'){
   const width=a.w*(a.kind==='main'?.249:.248), floor=a.b+r+.016, crossbar=a.t-(a.t-a.b)*.21;
   // Two slender mullions and original reduced branch strokes divide the single
   // deep opening, while remaining secondary to the genuinely observed arch.
   for(const dr of [-1,1]){
      const u=a.c+dr*width;
      PANE(s,p,rect(u-.022,u+.022,floor,crossbar),-.047,R.trim,a.id+'/split');
      s.tube([p.at([u,crossbar-.018],-.044),p.at([ (u+a.c)*.5,crossbar+.10],-.044),
        p.at([a.c,a.t-r-.029],-.044)],.020,R.trim,a.id+'/branch',7);
      s.tube([p.at([u,crossbar-.07],-.043),p.at([u+dr*.12,crossbar+.042],-.043),
        p.at([u+dr*.19,crossbar+.034],-.043)],.017,R.trim,a.id+'/branch',5);
   }
   const mid=a.b+(a.t-a.b)*.40;
   PANE(s,p,rect(a.c-a.w*.5+r+.015,a.c+a.w*.5-r-.015,mid-.016,mid+.016),-.05,R.trim,a.id+'/crossbar');
 }
 if(a.kind==='oculus')oculusHood(s,p,a);
 if(a.kind==='louver')for(let i=0;i<4;i++){
    const y=a.b+.065+i*.063, f=(a.w/2-r-.018)*(1-i*.083);
    PANE(s,p,rect(a.c-f,a.c+f,y,y+.023),-.049,R.trim,a.id+'/inner laths');
 }
 // The 2012 frontal view positively shows a closed light door below the
 // arched section, but neither the exact access height nor a placement.
 if(a.kind==='tower'){
   const w=a.w/2,c=a.c,l=c-w,r=c+w,b=.382,t=a.b-.015;
   for(const [u,v] of [[l,l+.066],[r-.066,r]]){
     PANE(s,p,rect(u,v,b,a.b),.028,R.trim,'door outer jamb');
     strip(s,p,rect(u,v,b,t),rect(u+.013,v-.013,b+.018,t-.018),.028,-.068,
        R.lining,'door recessed edge');
   }
   PANE(s,p,rect(l-.004,r+.004,b-.004,t+.041),-.106,R.lining,'concealed portal back');
   PANE(s,p,rect(l+.062,r-.062,b,t),-.085,R.siding,'closed pale door');
   for(const [u,v] of [[l+.087,c-.019],[c+.019,r-.087]]){
     PANE(s,p,rect(u,v,b+.094,t-.105),-.066,R.trim,'quiet inset door panel');
   }
   PANE(s,p,rect(l,r,b-.022,b+.016),.016,R.trim,'illust. door threshold not site steps');
   return a0.map((q,i)=>i<2?[q[0],b] as Q:q);
 }
 return a0;
}

export const CHURCH_CORE_PLAN=Object.freeze({
  nave:Object.freeze({x0:-1,x1:5.75,z0:-12.85,z1:-.70,eave:3.96,ridge:6.75}),
  tower:Object.freeze({x0:-2.95,x1:-.55,z0:-13.20,z1:-10.80,shaft:5.71}),
  spireShoulder:6.17,spireStemSocket:11.23,finialTop:12.224,
  visibleFlankLances:4, ornament:'original visual interpretation of photographed iron Scotch thistle',
  planUse:'Only the visible historical core, away from unseen extension; no absolute height or site fit'
});
function roof(s:Shell){
 const {nave:n,tower:t}=CHURCH_CORE_PLAN; const xc=(n.x0+n.x1)/2,d=.083;
 const h=(x:number)=>n.ridge-(n.ridge-n.eave)*Math.abs(x-xc)/(n.x1-xc);
 const left:Q[]=[[n.x0-d,t.z1],[t.x1,n.z0-d],[xc,n.z0-d],[xc,n.z1+d],[n.x0-d,n.z1+d]];
 // Insert the two literal wrapped tower steps (not a diagonal bevel/spurious exposed gap).
 left.splice(1,0,[t.x1,t.z1]);
 const right:Q[]=rect(xc,n.x1+d,n.z0-d,n.z1+d);
 const level=(dz:number)=>([x,z]:Q):P=>[x,h(x)+dz,z];
 for(const [j,q] of [left,right].entries()){
   s.panel(q,[],level(.033),Yp,R.roof,'steep roof');
   s.panel(q,[],level(-.027),Ym,R.siding,'roof underside');
   for(let i=0;i<q.length;i++){
      const k=(i+1)%q.length, a=q[i],b=q[k];
      if(a[0]===xc&&b[0]===xc)continue;
      const N=unit(cross(sub(level(.033)(a),level(.033)(b)),Yp));
      const center:[number,number]=[q.reduce((v,p)=>v+p[0],0)/q.length,q.reduce((v,p)=>v+p[1],0)/q.length];
      const desired=j===0&&Math.abs(a[1]-b[1])<1e-7&&Math.abs(a[1]-t.z1)<1e-7?Zm:
          dot(N,sub(level(.033)(a),level(.033)(center)))>0?N:sc(N,-1);
      s.quad(level(.033)(a),level(.033)(b),level(-.027)(b),level(-.027)(a),desired,
        R.trim,'trimmed rake/eave');
   }
 }
}
function gableRakes(s:Shell,p:Plane){
 const {nave:n,tower:t}=CHURCH_CORE_PLAN,xc=(n.x0+n.x1)/2,m=(n.ridge-n.eave)/(n.x1-xc);
 const h=(x:number)=>n.ridge-m*Math.abs(x-xc);
 for(const [l,r] of [[t.x1,xc],[xc,n.x1]]){
   const line=(d:number,w:number):Q[]=>[[l,h(l)-d-w],[r,h(r)-d-w],[r,h(r)-d],[l,h(l)-d]];
   const inner=line(.112,.052),outer=line(.027,.070);
   PANE(s,p,inner,.014,R.lining,'recessed dark gable line');
   PANE(s,p,outer,.039,R.trim,'primary raised pale gable rake');
   for(const [q,e0,e1,role,k] of [[inner,0,.014,R.lining,'gable line seated returns'],
        [outer,0,.039,R.trim,'gable rake seated returns']] as const){
     for(let i=0;i<q.length;i++){
       const j=(i+1)%q.length;
       const a=p.at(q[i],e0),b=p.at(q[j],e0),c=p.at(q[j],e1),d=p.at(q[i],e1);
       s.quad(a,b,c,d,sc(cross(sub(b,a),sub(c,a)),-1),role,k);
     }
   }
 }
}
function towerFrieze(s:Shell,p:Plane){
 const t=CHURCH_CORE_PLAN.tower,l=t.x0+.068,r=t.x1-.068,b=3.192,a=3.559;
 const shape=rect(l,r,b,a),open=rect(l+.018,r-.018,b+.021,a-.020);
 strip(s,p,shape,open,0,-.056,R.trim,'frieze shallow cover');
 PANE(s,p,open,-.056,R.lining,'closed dark frieze back');
 const count=19,w=(r-l-.056)/count;
 for(let i=0;i<count;i++){
   const u=l+.028+(i+.5)*w;
   s.box(u-.017,u+.017,b+.007,a-.007,t.z0-.024,t.z0+.052,
      R.trim,'original vertical frieze slats (count illustrative)');
 }
 return shape;
}
function section(s:Shell,a:P[],b:P[],center:P,m:Role,k:string){
 for(let i=0;i<a.length;i++){
    const j=(i+1)%a.length,w:P=[(a[i][0]+a[j][0])*.5-center[0],0,(a[i][2]+a[j][2])*.5-center[2]];
    s.quad(a[i],a[j],b[j],b[i],w,m,k);
 }
}
function spire(s:Shell){
 const {tower:t}=CHURCH_CORE_PLAN, cx=(t.x0+t.x1)/2,cz=(t.z0+t.z1)/2;
 const sq=(r:number,y:number):P[]=>[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]].map(
   ([x,z])=>[cx+r*x,y,cz+r*z] as P
 );
 const oct=(r:number,y:number):P[]=>Array.from({length:8},(_,i)=>[cx+r*Math.cos(i*tau/8),y,cz+r*Math.sin(i*tau/8)]);
 const c:P=[cx,0,cz];
 const base=[sq(1.2,t.shaft),sq(1.275,5.74),sq(1.275,5.825),sq(1.23,5.88),
   oct(.98,6.17),oct(.95,6.32),oct(.752,6.76),oct(.589,7.47),oct(.384,8.64),
   oct(.211,9.89),oct(.062,11.08),oct(.039,11.23)];
 for(let i=0;i+1<base.length;i++)section(s,base[i],base[i+1],c,
    i<3?R.trim:R.spire,i<4?'torus and swept shoulder':'swept spire panels');
 for(let i=0;i<8;i++)s.tri([cx,11.23,cz],base.at(-1)![i],base.at(-1)![(i+1)%8],Yp,R.iron,'spire cap');
 for(let i=0;i<8;i++){
   const q=base.slice(4).map(line=>{
     const v=line[i];const n=unit([v[0]-cx,0,v[2]-cz]);
     return ad(v,sc(n,.003));
   });
   s.tube(q,.0075,R.lining,'subtle spire arris',16);
 }
 const q=(x:number,y:number,z=0):P=>[cx+x,y,cz+z];
 s.tube([q(0,11.204),q(0,11.64),q(0,12.152)],.0185,R.iron,'forged stem',9);
 for(const k of [-1,1]){
   const scrol=(y:number,w:number,h:number)=>{
     const Q:P[]=[q(0,y+.045),q(k*w*.39,y-.04),q(k*w*.76,y-.008),q(k*w,y+h*.39),
        q(k*w*.88,y+h*.83),q(k*w*.48,y+h),q(k*w*.29,y+h*.76),q(k*w*.40,y+h*.62)];
     s.tube(Q,.0113,R.iron,'independent paired scrolls',15);
   };
   scrol(11.394,.27,.196);scrol(11.692,.193,.145);
   const y=11.868,w=.181;
   s.tube([q(0,y),q(k*.068,y+.054),q(k*w*.8,y+.120),q(k*w,y+.215)],.01,R.iron,'thistle foliage stem',9);
   // Two x-monotone serrated banks with a shared root and tip; the
   // simple outline is extruded into a closed original metal ribbon.
   const leaf:Q[]=[[0,.010],[.052,.037],[.074,.063],[.104,.074],[.122,.108],
      [.146,.114],[.158,.148],[.176,.161],[.190,.218],[.179,.203],
      [.165,.186],[.154,.165],[.137,.166],[.126,.141],[.106,.146],
      [.094,.116],[.079,.121],[.066,.087],[.053,.096],[.035,.057],[.023,.051]];
   for(const dz of [-.008,.008])
     s.panel(leaf,[],([x,h])=>q(k*(x+.004),y+h,dz),dz<0?Zm:Zp,R.iron,'forged leaf silhouettes');
   for(let i=0;i<leaf.length;i++){
     const [a,b]=leaf[i],[c,d]=leaf[(i+1)%leaf.length],h:P=[k*(d-b),a-c,0];
     s.quad(q(k*(a+.004),y+b,-.008),q(k*(c+.004),y+d,-.008),q(k*(c+.004),y+d,.008),q(k*(a+.004),y+b,.008),h,R.iron,'closed thistle leaf edges');
   }
 }
 const bulb=[oct(.021,12.101),oct(.034,12.158),oct(.031,12.189),oct(.018,12.211)];
 for(let i=0;i+1<bulb.length;i++)section(s,bulb[i],bulb[i+1],c,R.iron,'thistle flower');
 for(let i=0;i<8;i++){
   s.tri(q(0,12.224),bulb[3][i],bulb[3][(i+1)%8],Yp,R.iron,'thistle flower tip');
   s.tri(q(0,12.101),bulb[0][i],bulb[0][(i+1)%8],Ym,R.iron,'thistle socket closure');
 }
}
export function churchCoreGeometry(){
 const s=new Shell(),{nave:n,tower:t}=CHURCH_CORE_PLAN,xc=(n.x0+n.x1)/2;
 const gf=F(n.z0),side=S(n.x1),tf=F(t.z0),base=.235;
 const mains:Opening[]=[
   {id:'west front lancet',c:.18,w:.43,b:.46,t:2.87,kind:'lancet'},
   {id:'front triplet',c:xc,w:1.48,b:.44,t:3.31,kind:'main'},
   {id:'east front lancet',c:4.66,w:.43,b:.46,t:2.87,kind:'lancet'},
   {id:'front oculus',c:xc,w:.665,b:4.53,t:5.195,kind:'oculus'},
 ];
 const flanks:Opening[]=[-11.394,-9.24,-7.06,-4.875].map((c,i)=>(
   {id:'observed flank lancet '+(i+1),c,w:.51,b:.66,t:3.06,kind:'lancet'}
 ));
 const towers:Opening[]=[
   {id:'tower lower arched light',c:-1.75,w:1.017,b:1.34,t:2.63,kind:'tower'},
   {id:'tower upper louver recess',c:-1.75,w:.637,b:4.32,t:5.013,kind:'louver'},
 ];
 s.panel([[t.x1,base],[n.x1,base],[n.x1,n.eave],[xc,n.ridge],[t.x1,n.eave+.45*(n.ridge-n.eave)/(n.x1-xc)]],
    mains.map(a=>window(s,gf,a)),q=>gf.at(q,0),Zm,R.siding,'visible front clapboards');
 s.panel(rect(n.z0,n.z1,base,n.eave),flanks.map(a=>window(s,side,a)),q=>side.at(q,0),Xp,R.siding,'visible flank clapboards');
 s.panel(rect(t.z1,n.z1,base,n.eave),[],([z,y])=>[n.x0,y,z],Xm,R.siding,'unseen wall envelope');
 s.panel([[n.x0,base],[n.x1,base],[n.x1,n.eave],[xc,n.ridge],[n.x0,n.eave]],[],
    ([x,y])=>[x,y,n.z1],Zp,R.siding,'unseen gable closure');
 s.box(n.x0,n.x1,0,base,n.z0,n.z1,R.plinth,'neutral illustrative lower edge');
 const roy=n.eave+(t.x1-n.x0)*(n.ridge-n.eave)/(n.x1-xc);
 s.panel(rect(t.x0,t.x1,base,t.shaft),[...towers.map(a=>window(s,tf,a)),towerFrieze(s,tf)],
    q=>tf.at(q,0),Zm,R.siding,'square offset tower');
 s.panel(rect(t.z0,t.z1,base,t.shaft),[],([z,y])=>[t.x0,y,z],Xm,R.siding,'square offset tower');
 s.panel([[t.z0,base],[n.z0,base],[n.z0,roy],[t.z1,roy],[t.z1,t.shaft],[t.z0,t.shaft]],
    [],([z,y])=>[t.x1,y,z],Xp,R.siding,'body-joined turret east');
 s.panel([[t.x0,base],[n.x0,base],[n.x0,n.eave],[t.x1,roy],[t.x1,t.shaft],[t.x0,t.shaft]],
    [],([x,y])=>[x,y,t.z1],Zp,R.siding,'body-joined turret rear');
 for(const [bottom,top,out] of [[3.144,3.193,.037],[3.558,3.621,.049],[5.373,5.480,.053]]){
   const x0=t.x0-out,x1=t.x1+out,z0=t.z0-out,z1=t.z1+out;
   // Closed projecting all-around layer above the attached wall where exposed.
   s.box(x0,x1,bottom,top,z0,z1,R.trim,'trimmed tower divisions');
 }
 s.box(t.x0,t.x1,0,base,t.z0,t.z1,R.plinth,'neutral illustrative lower edge');
 roof(s);gableRakes(s,gf);spire(s);
 return {geometry:s.geometry(),sections:Object.freeze(s.sections),runs:Object.freeze(s.runs)};
}

const vertexShader=`
attribute float churchRole;
varying vec3 p;
varying vec3 wp;
varying vec3 n;
varying vec2 st;
varying float role;
void main(){
 vec4 w=modelMatrix*vec4(position,1.);
 p=position; wp=w.xyz;
 n=normalize(mat3(modelMatrix)*normal);
 st=uv; role=churchRole;
 gl_Position=projectionMatrix*viewMatrix*w;
}`;
const fragmentShader=`
uniform vec3 churchSun;
varying vec3 p;
varying vec3 wp;
varying vec3 n;
varying vec2 st;
varying float role;
float hs(vec2 q){
 vec3 k=fract(vec3(q.xyx)*.1031); k+=dot(k,k.yzx+33.33);
 return fract((k.x+k.y)*k.z);
}
float tex(vec2 q){
 vec2 a=floor(q),f=fract(q);f=f*f*(3.-2.*f);
 return mix(mix(hs(a),hs(a+vec2(1.,0.)),f.x),mix(hs(a+vec2(0.,1.)),hs(a+1.),f.x),f.y);
}
float boxDist(vec2 p,vec2 lo,vec2 hi){
 vec2 q=max(lo-p,p-hi);
 return length(max(vec2(0.),q))+min(max(q.x,q.y),0.);
}
void main(){
 vec3 N=normalize(n), V=normalize(cameraPosition-wp);
 float D=max(0.,dot(N,churchSun)),soft=.55+.45*D;
 float w=max(fwidth(st.y),.0001);
 float seam=1.-smoothstep(.018,.120,fract(st.y/.151+.095));
 float board=1.-.142*seam*(1.-smoothstep(.023,.094,w));
 float paint=(tex(st*.52)-.5)*.056;
 vec3 C=vec3(.766,.743,.681)*(board+paint)*soft;
 if(role<.5){
   float head=1.-.14*exp(-17.*abs(p.y-3.95))-.065*exp(-9.*max(p.y-.235,0.));
   // Small relief shadow from the exact detached gable trim projection.
   // This is not a game light or an actual time-of-day observation.
   if(n.z<-.98&&abs(p.z+12.85)<.001){
     float t=.039/max(-churchSun.z,.05), rx=p.x+t*churchSun.x;
     float dy=p.y+t*churchSun.y-(6.75-abs(rx-2.375)*(.826666667));
     float shade=smoothstep(-.104,-.094,dy)*(1.-smoothstep(-.028,-.018,dy));
     shade*=smoothstep(-.55,-.53,rx)*(1.-smoothstep(5.73,5.75,rx));
     head*=1.-.23*shade;
   }
   C*=head;
 } else if(role<1.5){
   C=vec3(.844,.813,.747)*(soft+paint*.43);
 } else if(role<2.5){
   float fine=(tex(st*vec2(2.8,6.4))-.5)*(1.-smoothstep(.04,.17,w))*.049;
   float runoff=(tex(st*vec2(1.61,.29))-.5)*.118;
   float broad=(tex(st*vec2(.31,.50))-.5)*.079;
   C=vec3(.187,.213,.217)*(soft+paint+fine+runoff+broad);
 } else if(role<3.5){
   C=vec3(.601,.622,.598)*(soft+paint*.84);
 } else if(role<4.5){
   C=vec3(.046,.056,.057)*(.70+.25*D);
 } else if(role<5.5){
   float fres=pow(1.-clamp(dot(V,N),0.,1.),3.);
   vec3 rv=reflect(-V,N);
   float sky=smoothstep(-.10,.47,rv.y), bank=tex(vec2(st.x*.41,st.y*.91));
   C=mix(vec3(.024,.042,.053),vec3(.104,.159,.190),(.13+.70*fres)*(.49+.51*sky));
   C+=vec3(.010,.016,.018)*(bank-.34)+vec3(.017,.023,.017)*smoothstep(.5,2.9,st.y);
 } else if(role<6.5){
   C=vec3(.171,.166,.149)*(soft+(tex(p.xz*.79)-.5)*.15);
 } else if(role<7.5){
   C=vec3(.023,.029,.028)*(soft+.26*pow(max(dot(reflect(-churchSun,N),V),0.),21.));
 } else {
   float q=min(boxDist(p.xz,vec2(-1.,-12.85),vec2(5.75,-.70)),
               boxDist(p.xz,vec2(-2.95,-13.20),vec2(-.55,-10.80)));
   vec2 z=p.xz+vec2(2.19,-1.42);
   float t=min(boxDist(z,vec2(-1.,-12.85),vec2(5.75,-.70)),
               boxDist(z,vec2(-2.95,-13.20),vec2(-.55,-10.80)));
   float contact=.30*exp(-1.42*max(q,0.))+.17*exp(-.49*max(t,0.));
   C=vec3(.374,.378,.351)*(1.-contact+(tex(p.xz*.17)-.5)*.069);
 }
 gl_FragColor=vec4(C,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 if(role>7.5)gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.478,.551,.595),smoothstep(36.,139.,length(cameraPosition-wp)));
}`;
export function makeChurchDetached(){
 const g=churchCoreGeometry(), material=new T.ShaderMaterial({
    vertexShader,fragmentShader,uniforms:{churchSun:{value:new T.Vector3(.45,.79,-.49).normalize()}},
    side:T.FrontSide,transparent:false,depthWrite:true,depthTest:true
 });
 const mesh=new T.Mesh(g.geometry,material);
 mesh.name='New Glasgow Christian Church • 2012 observed core (detached original study)';
 return {...g,mesh,material,dispose(){g.geometry.dispose();material.dispose();}};
}
export function churchStudioGround(){
 const s=new Shell();
 s.quad([-100,-.002,-100],[-100,-.002,100],[100,-.002,100],[100,-.002,-100],Yp,R.floor,'studio only');
 return s.geometry();
}
