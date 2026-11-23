import {Color,ShapeUtils,Vector2} from 'three';
import {MONTAGUE_MACDONALD} from './montague-macdonald.generated.ts';

type P=readonly [number,number];
type XYZ=readonly [number,number,number]; // x, z, absolute y
type Vertex=Readonly<{x:number;z:number}>;
type Writer=(point:Vertex,y:number,color:Color,u:number,v:number,role:number,style:number)=>void;
export const MACDONALD_STYLE=48;
export const MACDONALD_ROLES={siding:50,stone:51,roof:52,lean:53,trim:54,glass:55,return:56,deck:57,annex:58};
const r=MACDONALD_ROLES;
// A subdued, independently authored treatment suggested by the 2007 public
// heritage reference, not a photographic texture or a current paint survey.
const plaster=new Color(0xb4a16e),frontPaint=new Color(0xb6a375),porchPaint=new Color(0x938259),
 stone=new Color(0x7d4843),frame=new Color(0x5b5244),inside=new Color(0x8c8270),
 glass=new Color(0x4c575a),painted=new Color(0xc7c5b9),deck=new Color(0x8b7e6d),
 brace=new Color(0xd1cdc1),asphalt=new Color(0x535760),lean=new Color(0x646765),annex=new Color(0x666965);
const plan=MONTAGUE_MACDONALD;
export function montagueMacdonaldModel(atlas:string|undefined,tile:string,ordinal:number,ring:readonly P[],holes?:readonly (readonly P[])[]){
 return atlas===plan.atlasSha256&&tile===plan.tile&&ordinal===plan.ordinal&&!holes?.length&&
  ring.length===plan.source.length&&ring.every((q,i)=>q[0]===plan.source[i][0]&&q[1]===plan.source[i][1])?plan:undefined;
}
export function emitMacdonaldShell(p:typeof plan,ground:(x:number,z:number)=>number,vertex:Writer){
 const [ox,oz]=p.originXZ;
 const world=([x,z]:P):Vertex=>({x:x+ox,z:z+oz});
 const emit=(q:XYZ,color:Color,role:number,uv:P=[q[0],q[1]])=>vertex(world([q[0],q[1]]),q[2],color,...uv,role,MACDONALD_STYLE);
 for(const [n,strip] of p.roofs){
  const cc=n===4?lean:n===5?annex:asphalt,role=n===4?r.lean:n===5?r.annex:r.roof;
  for(let j=1;j<strip.length-1;j++){
   // The convex roof partitions all follow the source outline winding.
   emit(strip[0],cc,role);emit(strip[j+1],cc,role);emit(strip[j],cc,role);
  }
 }
 for(const [a,b,c,d] of p.steps){
  const l=Math.hypot(b[0]-a[0],b[1]-a[1]),h=Math.min(a[2],b[2],c[2],d[2]);
  const v=(q:XYZ,u:number)=>emit(q,plaster,r.siding,[u,q[2]-h+2.7]);
  v(a,0);v(b,l);v(d,l);v(a,0);v(d,l);v(c,0);
 }
 // The seats and roof silhouette remain in the atlas plan. Sill, joinery
 // and the porch's dimensions are interpretive, not part of the LiDAR fit.
 const outline=p.outline;
 const gra=outline.map(x=>ground(x[0]+ox,x[1]+oz));
 const ordered=gra.slice().sort((a,b)=>a-b);
 const seat=Math.max((ordered[1]+ordered[2])*.5+.43,ordered[3]-.21);
 for(let edge=0;edge<outline.length;edge++){
  const a=outline[edge],b=outline[(edge+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),
     ux=dx/L,uz=dz/L;
  const isFront=edge===0,isSouth=edge===2,col=isFront?frontPaint:plaster;
  const xz=(u:number,d:number):P=>[a[0]+u*ux-d*uz,a[1]+u*uz+d*ux];
  const segs=(p.walls[edge] as readonly (readonly [XYZ,XYZ])[]).map(([P,Q])=>
   [(P[0]-a[0])*ux+(P[1]-a[1])*uz,(Q[0]-a[0])*ux+(Q[1]-a[1])*uz,P[2],Q[2]] as const);
  const roof=(u:number)=>{
   for(const [ua,ub,ya,yb] of segs)if(u>=ua-1e-5&&u<=ub+1e-5)
    return ya+(yb-ya)*Math.max(0,Math.min(1,(u-ua)/(ub-ua)));
   return 0;
  };
  type V=readonly [number,number,number]; // along, height, inset
  const V=(u:number,y:number,d=0):V=>[u,y,d];
  const tri=(a:V,b:V,c:V,colour:Color,role:number)=>{
   for(const [u,y,d] of [a,b,c]){
    const o=xz(u,d);
    emit([o[0],o[1],y],colour,role,[u,y-seat]);
   }
  };
  const quad=(a:V,b:V,c:V,d:V,col:Color,role:number)=>{tri(a,b,c,col,role);tri(a,c,d,col,role);};
  const tile=(u:number,w:number,lo:number,hi:number,d:number,colour:Color,role:number)=>{
   if(w-u>.0001&&hi-lo>.0001)quad(V(u,lo,d),V(u,hi,d),V(w,hi,d),V(w,lo,d),colour,role);
  };
  const flat=(u:number,w:number,y:number,n:number,d:number,col:Color,role:number)=>{
   quad(V(u,y,n),V(w,y,n),V(w,y,d),V(u,y,d),col,role);
  };
  type Open={u:number;w:number;lo:number;hi:number;door?:boolean};
  const G=(u:number)=>gra[edge]+(gra[(edge+1)%outline.length]-gra[edge])*u/L-.31;
  const course=seat+.026;
  type Ring=P[];
  const polygon=(a:Ring,holes:Ring[],inset:number,color:Color,role:number)=>{
   const pts=[a,...holes].flat();
   for(const [i,j,k] of ShapeUtils.triangulateShape(a.map(p=>new Vector2(...p)),holes.map(h=>h.map(p=>new Vector2(...p))))){
    const pt=(x:P)=>V(x[0],x[1],inset);
    tri(pt(pts[i]),pt(pts[j]),pt(pts[k]),color,role);
   }
  };
  const contour=({u,w,lo,hi}:Open):Ring=>[[u,lo],[w,lo],[w,hi],[u,hi]];
  const opening=(u:number,w:number,lo:number,hi:number,door=false):Open=>({u,w,lo:lo+seat,hi:hi+seat,door});
  const windows:Open[]=[];
  if(isFront){
   windows.push(opening(1.50,3.16,.80,2.07),opening(4.13,5.14,.055,2.28,true),
    opening(7.48,9.39,.81,2.11),opening(10.40,11.45,.99,2.28));
   // Do not derive window count from generic height rows. The center pane
   // sits under the actual cross-gable peak, with shorter separate lights.
   const peaks=segs.flatMap(([a,b,l,h])=>[[a,l],[b,h]] as P[]);
   const crown=peaks.filter(q=>q[0]>2.6&&q[0]<10.8).sort((a,b)=>b[1]-a[1])[0]?.[0]??L*.43;
   for(const [u,wide,rise,drop] of [[crown,1.12,1.57,.47],[3.40,.91,1.31,.34],[8.93,1.05,1.35,.38]] as const){
    const a=u-wide*.5,b=u+wide*.5,hi=Math.min(roof(a),roof(b))-drop;
    windows.push({u:a,w:b,lo:Math.max(seat+2.84,hi-rise),hi});
   }
  }else if(edge===3){
   windows.push(opening(2.40,3.47,.89,2.14),opening(6.5,7.76,.89,2.14),opening(4.80,5.90,3.29,4.78));
  }else if(edge===1){
   windows.push(opening(3.10,4.18,.85,2.12),opening(5.81,6.63,.90,2.14));
  }else if(isSouth){
   windows.push(opening(1.20,2.61,.87,2.18),opening(6.09,7.22,3.28,4.81),opening(9.80,10.86,3.31,4.82));
  }
  function window(o:Open,offset:number,total:number,after:Color){
   const {u,w,lo,hi}=o,sw=.022,uu=u+sw,ww=w-sw,l=lo+sw,h=hi-sw,lip=offset+.040;
   const st=total-.012,t=.049;
   quad(V(u,lo,offset),V(u,hi,offset),V(uu,h,lip),V(uu,l,lip),after,r.return);
   quad(V(w,hi,offset),V(w,lo,offset),V(ww,l,lip),V(ww,h,lip),after,r.return);
   quad(V(u,hi,offset),V(w,hi,offset),V(ww,h,lip),V(uu,h,lip),frame,r.return);
   quad(V(w,lo,offset),V(u,lo,offset),V(uu,l,lip),V(ww,l,lip),painted,r.return);
   quad(V(uu,l,lip),V(uu,h,lip),V(uu,h,total),V(uu,l,total),after,r.return);
   quad(V(ww,h,lip),V(ww,l,lip),V(ww,l,total),V(ww,h,total),after,r.return);
   flat(uu,ww,l,lip,total,painted,r.return);
   flat(uu,ww,h,lip,total,frame,r.return);
   tile(uu,ww,l,h,total,glass,r.glass);
   tile(uu,ww,l,l+(o.door?.126:t),st,painted,r.trim);tile(uu,ww,h-t,h,st,painted,r.trim);
   tile(uu,uu+t,l+t,h-t,st,painted,r.trim);tile(ww-t,ww,l+t,h-t,st,painted,r.trim);
   const d0=(uu+ww)*.5,mid=l+(h-l)*(o.door?.66:.55);
   tile(uu+t,ww-t,mid-.025,mid+.025,st-.005,painted,r.trim);
   if(ww-uu<1.24){tile(d0-.022,d0+.022,l+t,h-t,st-.007,painted,r.trim);}
   else for(const ratio of [.235,.765]){
    const m=uu+(ww-uu)*ratio;
    tile(m-.025,m+.025,l+t,h-t,st-.008,painted,r.trim);
   }
  }
  const safe=(q:Open)=>q.u>.50&&q.w<L-.50&&q.lo>course+.018&&q.hi<
   Math.min(roof(q.u),roof(q.w),...segs.filter(s=>s[0]>q.u&&s[0]<q.w).map(s=>s[2]),...segs.filter(s=>s[1]>q.u&&s[1]<q.w).map(s=>s[3]))-.22;
  if(isSouth&&L>10.7)windows.push(opening(3.74,L-.72,.107,2.77)); // bounded, inner covered porch
  const used=windows.filter(safe);
  const stairs=used.find(q=>isSouth&&q.w-q.u>6.6);
  const fascia=.128;
  const pts:Ring=[[0,course],[L,course]];
  for(const [u,w,lo,hi] of [...segs].reverse()){
   for(const q of [[Math.max(0,Math.min(L,w)),hi-fascia],[Math.max(0,Math.min(L,u)),lo-fascia]] as const){
    const last=pts.at(-1)!;
    if(Math.abs(q[0]-last[0])+Math.abs(q[1]-last[1])>1e-5)pts.push(q);
   }
  }
  polygon(pts,used.map(contour),0,col,r.siding);
  quad(V(0,G(0)),V(0,course),V(L,course),V(L,G(L)),stone,r.stone);
  for(const q of used)if(q!==stairs)window(q,0,.176,plaster);
  // Actual roof step joints change the fascia height; each band joins
  // the siding edge (no coplanar overlay or expansion of the plan).
  for(const [u,w,lo,hi] of segs)if(w-u>1e-5){
   quad(V(u,lo-fascia),V(u,lo-.024),V(w,hi-.024),V(w,hi-fascia),painted,r.trim);
   quad(V(u,lo-.024),V(u,lo),V(w,hi),V(w,hi-.024),frame,r.trim);
  }
  if(stairs){
   const {u,w,lo,hi}=stairs,depth=1.07;
   quad(V(u,lo),V(u,hi),V(u,hi,depth),V(u,lo,depth),inside,r.return);
   quad(V(w,hi),V(w,lo),V(w,lo,depth),V(w,hi,depth),inside,r.return);
   flat(u,w,lo,0.,depth,deck,r.deck);flat(u,w,hi,0.,depth,inside,r.return);
   const inner:Open[]=[opening(u+.88,u+2.20,.91,2.19),
    opening((u+w)*.5-.45,(u+w)*.5+.50,.16,2.38,true),
    opening(w-2.21,w-.86,.89,2.17)];
   polygon(contour(stairs),inner.map(contour),depth,porchPaint,r.siding);
   inner.forEach(q=>window(q,depth,depth+.123,inside));
   // Thin physical awning strip and open inboard framing. White diagonal
   // knee lattices occupy the top corners only; no ornaments are painted
   // onto the facade and no vertices extend past the survey footprint.
   tile(u+.045,w-.045,hi-.099,hi-.013,.062,painted,r.trim);
   flat(u+.045,w-.045,hi-.099,.062,.246,brace,r.trim);
   const piece=(a:P,b:P,width:number,inset:number)=>{
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=(a[1]-b[1])*width*.5/len,ny=(b[0]-a[0])*width*.5/len;
    const face=(d:number):[V,V,V,V]=>[V(a[0]+nx,a[1]+ny,d),V(a[0]-nx,a[1]-ny,d),
     V(b[0]-nx,b[1]-ny,d),V(b[0]+nx,b[1]+ny,d)];
    const q=face(inset),v=face(inset+.040);
    quad(...q,brace,r.trim);quad(...v,painted,r.trim);
    for(let i=0;i<4;i++){const j=(i+1)%4;quad(q[i],q[j],v[j],v[i],painted,r.trim);}
   };
   for(let i=0;i<5;i++){
    const x=u+.21+(w-u-.42)*i/4,d=.094,e=.179,cut=.102;
    for(const [ya,yb,n,h,rad] of [[lo,lo+cut,d-.015,e+.019,.064],[lo+cut,hi-cut,d,e,.043],[hi-cut,hi,d-.016,e+.018,.061]] as const){
     const a=x-rad,b=x+rad;
     tile(a,b,ya,yb,n,brace,r.trim);tile(a,b,ya,yb,h,painted,r.trim);
     quad(V(a,ya,n),V(a,ya,h),V(a,yb,h),V(a,yb,n),painted,r.trim);
     quad(V(b,ya,h),V(b,ya,n),V(b,yb,n),V(b,yb,h),painted,r.trim);
     if(rad>.06)flat(a,b,ya===lo?yb:ya,n,h,painted,r.trim);
    }
    for(const direction of [-1,1])if(i===0?direction>0:i===4?direction<0:true){
     const xx=(d:number)=>x+d*direction;
     piece([xx(.032),hi-.492],[xx(.225),hi-.256],.045,.101);
     piece([xx(.225),hi-.256],[xx(.439),hi-.088],.042,.101);
     piece([xx(.039),hi-.273],[xx(.209),hi-.112],.029,.125);
    }
   }
  }
 }
}
