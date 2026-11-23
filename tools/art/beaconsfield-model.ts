import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
type P=[number,number,number];
type Plan=[number,number,number,number];
import {finishBeaconsfieldMaterial as finish,beaconsfieldPaints,type BeaconPaint as Paint} from '../../src/render/beaconsfield-review-material.ts';
// Detached art coordinates in a reference-local metre frame; not as-built placement.
// The named planar surfaces reuse the bounded class-6 measurements committed to the scout receipt.
export const heights={baseGradeCGVD:4.4713, porch:4.2147, wing:7.6857, top:11.7392, cupEave:14.45155, cupCap:15.6862} as const;
export function buildBeaconsfield(seated=false){
 const mats=Object.fromEntries(beaconsfieldPaints.map(k=>[k,finish(k)])) as Record<Paint,T.MeshStandardMaterial>;
 let parts=new Map<Paint,T.BufferGeometry[]>();
 const counts:Record<string,number>={};let role='body';
 function add(geometry:T.BufferGeometry,mat:Paint,uc?:number[]){
  const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();
  const p=g.getAttribute('position'),n=g.getAttribute('normal'),u=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));u[2*i]=ny>=Math.max(nx,nz)||nz>=nx?x:z;u[2*i+1]=ny>Math.max(nx,nz)?z:y;}
  if(uc)u.set(uc);
  g.setAttribute('uv',new T.BufferAttribute(u,2));
  counts[role]=(counts[role]??0)+p.count/3;
  if(!parts.has(mat))parts.set(mat,[]);parts.get(mat)!.push(g);
 }
 const poly=(mat:Paint,points:P[],uv?:number[])=>{const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.computeVertexNormals();add(g,mat,uv);};
 const quad=(mat:Paint,a:P,b:P,c:P,d:P,uv?:number[])=>poly(mat,[a,b,c,a,c,d],uv);
 const box=(mat:Paint,p:P,dx:number,dy:number,dz:number)=>{if(Math.min(dx,dy,dz)>.002)add(new T.BoxGeometry(dx,dy,dz).translate(...p),mat);};
 const plane=(r:Plan,h:(x:number,z:number)=>number,mat:Paint,underside=false)=>{const [l,R,n,s]=r;const p:[P,P,P,P]=[[l,h(l,s),s],[R,h(R,s),s],[R,h(R,n),n],[l,h(l,n),n]];if(underside)p.reverse();quad(mat,...p);};
 function jointTube(mat:Paint,a:P,b:P,width:number,thick=width){
  const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A);
  const g=new T.BoxGeometry(width,d.length(),thick).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize())).translate(...A.add(B).multiplyScalar(.5).toArray() as P);add(g,mat);
 }
 function ring(r:Plan,y:(x:number,z:number)=>number):[P,P,P,P]{const [l,R,n,s]=r;return [[l,y(l,s),s],[R,y(R,s),s],[R,y(R,n),n],[l,y(l,n),n]];}
 const expand=(r:Plan,x:number,z=x):Plan=>[r[0]-x,r[1]+x,r[2]-z,r[3]+z];
 function roofWalls(a:ReturnType<typeof ring>,b:ReturnType<typeof ring>,mat:Paint){
  for(let k=0;k<4;k++){
   const j=(k+1)%4,A=a[k],B=a[j],C=b[j],D=b[k],run=Math.hypot(B[0]-A[0],B[2]-A[2]),r2=Math.hypot(C[0]-D[0],C[2]-D[2]),off=(run-r2)*.5,h=Math.hypot(D[1]-A[1],D[0]-A[0],D[2]-A[2]);
   // Correct signed UV along each sloped roof face rather than treating it as a horizontal texture.
   quad(mat,A,B,C,D,[0,A[1],run,A[1],run-off,A[1]+h,0,A[1],run-off,A[1]+h,off,A[1]+h]);
  }
 }
 function hip(r:Plan,top:Plan,yl:number,yh:(x:number,z:number)=>number,mat:Paint){roofWalls(ring(r,()=>yl),ring(top,yh),mat);plane(top,yh,mat);}
 function listWindows(side:number){return side===0?[-4.57,-.61,3.56]:side===1?[-4.20,.08,3.70]:[-2.08,3.82];}
 function facadeSide(r:Plan,side:number){const [l,R,n,s]=r;return side===0?{lo:l,hi:R,map:(u:number,y:number,d=0):P=>[u,y,s+d],w:bXZ}:
    side===1?{lo:-R,hi:-l,map:(u:number,y:number,d=0):P=>[-u,y,n-d],w:bXZ}:
    side===2?{lo:n,hi:s,map:(u:number,y:number,d=0):P=>[l-d,y,u],w:bZX}:
    {lo:-s,hi:-n,map:(u:number,y:number,d=0):P=>[R+d,y,-u],w:bZX};}
 const bXZ=(mat:Paint,p:P,w:number,h:number,d:number)=>box(mat,p,w,h,d);
 const bZX=(mat:Paint,p:P,w:number,h:number,d:number)=>box(mat,p,d,h,w);
 type Face=ReturnType<typeof facadeSide>;
 type Opening={u:number,y:number,w:number,h:number,doubled?:boolean};
 function faceRect(f:Face,l:number,R:number,b:number,t:number,mat:Paint,d=0){quad(mat,f.map(l,b,d),f.map(R,b,d),f.map(R,t,d),f.map(l,t,d));}
 function wall(f:Face, y0:number,y1:number,holes:Opening[],mat:Paint='ochre'){
  const xs=[f.lo,f.hi],ys=[y0,y1];
  for(const a of holes){xs.push(a.u-a.w/2,a.u+a.w/2);ys.push(a.y,a.y+a.h);}
  xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
   const l=xs[i-1],r=xs[i],b=ys[j-1],t=ys[j],c=(l+r)*.5,cy=(b+t)*.5;
   if(r-l>.0001&&t-b>.0001&&!holes.some(a=>Math.abs(c-a.u)<a.w/2&&cy>a.y&&cy<a.y+a.h))faceRect(f,l,r,b,t,mat);
  }
 }
 function sash(f:Face,{u,y,w,h,doubled}:Opening){
  const l=u-w/2,r=u+w/2,t=y+h,D=-.151;
  quad('trim',f.map(l,y),f.map(l,y,D),f.map(l,t,D),f.map(l,t));quad('trim',f.map(r,y,D),f.map(r,y),f.map(r,t),f.map(r,t,D));
  quad('frame',f.map(l,y),f.map(r,y),f.map(r,y,D),f.map(l,y,D));quad('trim',f.map(l,t,D),f.map(r,t,D),f.map(r,t),f.map(l,t));
  faceRect(f,l+.063,r-.063,y+.063,t-.063,'glass',D-.046);
  for(const h0 of [y+.046,t-.046,y+.54*h])f.w('sash',f.map(u,h0,D-.023),w,.060,.045);
  for(const u0 of [l+.049,u,r-.049])f.w('sash',f.map(u0,y+h/2,D-.02),u0===u&&doubled?.104:.050,h,.056);
  if(doubled)for(const u0 of [u-w*.25,u+w*.25])f.w('sash',f.map(u0,y+h/2,D-.020),.028,h,.040);
  for(const u0 of [l-.060,r+.060])f.w('trim',f.map(u0,y+h*.5,.042),.136,h+.20,.118);
  f.w('frame',f.map(u,y-.069,.069),w+.35,.115,.283);
  f.w('trim',f.map(u,t+.085,.082),w+.36,.139,.276);
  f.w('frame',f.map(u,t+.178,.102),w+.40,.058,.312);
 }
 const main:Plan=[-7.18,6.16,-5.59,7.51],eave=8.52;
 const roofE=expand(main,.34), roofM=expand(main,-.22),roofT=expand(main,-.91);
 role='main clapboard and facade';
 box('foundation',[(-7.18+6.16)*.5,seated?-.285:.315,(-5.59+7.51)*.5],13.34,seated?1.83:.63,13.10);
 for(let side=0;side<4;side++){
  const f=facadeSide(main,side), chosen=listWindows(side);
  const windows:Opening[]=side===2?[{u:-3.33,y:1.13,w:1.22,h:2.05},{u:-3.65,y:4.74,w:1.90,h:2.12,doubled:true},{u:.66,y:4.73,w:1.19,h:2.10}]:[];
  for(const [i,u] of (side===2?[]:chosen).entries()){
   if(!(side===1&&i===1)) windows.push({u,y:1.14,w:i===0&&side<2?1.43:1.12,h:2.12,doubled:i===0&&side<2});
   if(!(side===1&&i===2))windows.push({u,y:4.73,w:i!==1&&side<2?1.90:1.13,h:2.10,doubled:i!==1&&side<2});
  }
  wall(f,.59,eave-.30,windows);windows.forEach(w=>sash(f,w));
  for(const u of [f.lo+.12,f.hi-.12])f.w('trim',f.map(u,4.42,.058),.168,7.58,.128);
  for(const [y,h,d] of [[.67,.16,.17],[eave-.50,.19,.38],[eave-.24,.23,.54],[eave-.07,.10,.68]])f.w('trim',f.map((f.lo+f.hi)*.5,y,.072),(f.hi-f.lo)+.18,h,d);
  for(let u=f.lo+.34;u<f.hi-.28;u+=.40)f.w('fret',f.map(u,eave-.415,.20),.065,.128,.148);
 }
 role='main mansard measured crown';
 const levels=[ring(roofE,()=>eave),ring(expand(main,.10),()=>8.66),ring(roofM,()=>9.25),ring(roofT,(x,z)=>11.736843-.000673395*x+.004254906*z)];
 for(let i=1;i<levels.length;i++)roofWalls(levels[i-1],levels[i],'slate');
 plane(roofT,(x,z)=>11.736843-.000673395*x+.004254906*z,'slate');
 for(let k=0;k<4;k++){const j=(k+1)%4; jointTube('zinc',levels[3][k],levels[3][j],.09,.125);}
 const wing:Plan=[.31,6.31,-18.07,-5.29],we=5.32;
 role='lower service wing';
 box('foundation',[3.31,seated?-.30:.30,-11.67],6.02,seated?1.80:.60,12.76);
 for(let side of [1,2,3]){
  const f=facadeSide(wing,side), ulist=side===1?[-5.01,-1.64]:side===2?[-15.6,-12.2,-8.42]:[8.31,12.18,15.56];
  const windows=ulist.map(u=>({u,y:1.13,w:1.04,h:2.06})); wall(f,.56,we-.13,windows);windows.forEach(w=>sash(f,w));
  for(const u of [f.lo+.105,f.hi-.105])f.w('trim',f.map(u,2.93,.050),.17,4.75,.10);
  f.w('trim',f.map((f.lo+f.hi)*.5,we-.11,.06),f.hi-f.lo+.07,.24,.37);
 }
 const wr=expand(wing,.26),wt=expand(wing,-.64);
 hip(wr,wt,we,(x,z)=>7.676325-.00406956*x-.00133267*z,'slate');
 // Cupola surface sits on the class-6 roof tiers. Arched lights are interpretation of the exterior references.
 role='belvedere';
 const cp:Plan=[-2.41346,1.44392,-.76264,3.12664], under=expand(cp,-.27);
 for(let side=0;side<4;side++){
  const f=facadeSide(under,side),mid=(f.lo+f.hi)*.5;
  const wnd:Opening[]=[{u:mid-.70,y:12.17,w:.61,h:1.25},{u:mid+.51,y:12.16,w:.61,h:1.25}];
  wall(f,11.69,14.31,wnd);wnd.forEach(w=>sash(f,w));
  f.w('trim',f.map(mid,14.27,.10),f.hi-f.lo+.21,.20,.27);
  for(let u=f.lo+.18;u<f.hi-.16;u+=.29) f.w('fret',f.map(u,14.14,.13),.055,.12,.12);
 }
 const crown:Plan=[-.61355,-.3560,1.0205,1.3435];
 // The nominal fit admits a vertical-offset/footprint degeneracy: translating all four
 // edges along the fitted planes preserves slope residuals. Use the contiguous lower
 // class-6 edge envelope (no isolated west clusters) to pick the physical slate break.
 const eaveY=14.255,dr=heights.cupEave-eaveY,eaves=expand(cp,dr/.68595983,dr/.69238425);
 hip(eaves,crown,eaveY,()=>heights.cupCap,'slate');
 const soffit=ring(eaves,()=>eaveY-.046),edge=ring(eaves,()=>eaveY);
 for(let k=0;k<4;k++){const j=(k+1)%4;quad('trim',soffit[k],soffit[j],edge[j],edge[k]);}
 for(let k=0;k<4;k++){const j=(k+1)%4,[a,b]=[soffit[k],soffit[j]], [d,c]=[ring(under,()=>eaveY-.046)[k],ring(under,()=>eaveY-.046)[j]];quad('trim',d,c,b,a);}
 jointTube('zinc',[-.48,heights.cupCap,1.18],[-.48,16.68,1.18],.037);
 for(const [x,z,h] of [[-5.29,-2.30,13.69],[3.52,-2.58,13.91],[4.91,4.17,13.52]]){
  box('brick',[x,(11.5+h)/2,z],.58,h-11.5,.63);box('brick',[x,h-.07,z],.73,.124,.75);box('zinc',[x,h+.040,z],.65,.055,.70);
 }
 // Physically arched dormer cutouts, returned into the visible lower mansard.
 role='round headed dormers';
 function dormer(f:Face,u:number,y:number,w:number,depth:number,round=true){
  const r=w*.5,shoulder=y+(round?.99:1.33),rim=.095,N=round?18:1;
  const front=.031,back=-depth;
  function point(j:number,extra=0,d=front):P{if(!round)return f.map(u+(j===0?-r:r)*(1+extra),shoulder+extra,d);const t=Math.PI-Math.PI*j/N;return f.map(u+(r+extra)*Math.cos(t),shoulder+(r+extra)*Math.sin(t),d);}
  faceRect(f,u-r,u+r,y,shoulder,'glass',front-.061);
  for(let j=0;j<N;j++){
   if(round)poly('glass',[f.map(u,shoulder,front-.061),point(j+1,0,front-.061),point(j,0,front-.061)]);
   const a=point(j,rim),b=point(j+1,rim),c=point(j+1,0),dd=point(j,0);
   quad('trim',dd,c,b,a);quad('zinc',a,b,point(j+1,rim,back),point(j,rim,back));
  }
  for(const s of [-1,1]){
   f.w('trim',f.map(u+s*(r+.041),(y+shoulder)*.5,front),.097,shoulder-y,.155);
   const left=f.map(u+s*(r+.055),y,front),right=f.map(u+s*(r+.055),y,back);
   quad('ochre',left,right,f.map(u+s*(r+.055),shoulder,back),f.map(u+s*(r+.055),shoulder,front));
  }
  f.w('trim',f.map(u,y-.039,front+.019),w+.27,.099,.257);
  f.w('sash',f.map(u,(y+shoulder)*.5,front-.046),.057,shoulder-y,.037);
  for(const a of [y+.034,y+.45,shoulder-.02])f.w('sash',f.map(u,a,front-.040),w-.10,.047,.04);
 }
 for(const side of [0,1,2]){
  const f=facadeSide(expand(main,.11),side);
  const us=side<2?[-4.34,-.57,3.69]:[-2.88,1.53,5.11];
  for(const u of us)dormer(f,u,8.93,1.05,1.26,true);
 }
 const east=facadeSide(expand(main,.105),3);for(const u of [-4.1,1.33])dormer(east,u,8.94,1.02,1.25,true);
 const wSide=facadeSide(expand(wing,.084),3);for(const u of [8.43,11.83,15.08])dormer(wSide,u,5.86,.82,.95,false);
 const westService=facadeSide(expand(wing,.087),2);for(const u of [-15.01,-9.26])dormer(westService,u,5.86,.80,.95,false);
 // Original east-side glazed bay, not projecting the veranda onto the unsupported east wall.
 role='east bay windows';
 const bay:Plan=[6.14,7.18,-3.02,-.19];
 for(const s of [0,1,3]){
  const f=facadeSide(bay,s),c=(f.lo+f.hi)*.5; const ar=[{u:c,y:1.18,w:s===3?1.34:.56,h:2.11},{u:c,y:4.76,w:s===3?1.35:.56,h:2.00}];
  wall(f,.62,7.36,ar); ar.forEach(a=>sash(f,a));
 }
 box('trim',[6.70,3.82,-1.605],1.11,.15,3.03);box('trim',[6.66,7.28,-1.605],1.12,.22,3.08);
 role='structural verandah';
 const deckY=.68,backLine=10.30,westLine=-9.43,southRise=(x:number,z:number)=>4.799739-.0005363*x-.06185418*z,westRise=(x:number,z:number)=>4.984606+.0800212*x-.00290845*z;
 const porchRects:Plan[]=[[westLine,8.10,7.30,backLine],[westLine,-7.10,-.63,7.30],[6.15,8.10,4.15,7.30]];
 for(const [i,r] of porchRects.entries()){
  const [l,R,n,s]=r,h=(x:number,z:number)=>i===0?southRise(x,z):i===1?westRise(x,z):4.23-.03*(x-6.2);
  if(seated){
   // The original verandah deck stays level with its authored door; visual support
   // is in plan. Only the upper .32m is the photographed dark timber lattice.
   box('foundation',[(l+R)*.5,-.438,(s+n)*.5],R-l,1.524,s-n);
   box('skirt',[(l+R)*.5,.416,(s+n)*.5],R-l+.013,.320,s-n+.013);
  }
  box('deck',[(l+R)*.5,deckY-.097,(s+n)*.5],R-l,.194,s-n);plane(r,h,'slate');plane(r,(x,z)=>h(x,z)-.135,'trim',true);
  const aa=ring(r,h),bb=ring(r,(x,z)=>h(x,z)-.13);
  for(let k=0;k<4;k++){const j=(k+1)%4;quad('trim',bb[k],bb[j],aa[j],aa[k]);}
 }
 // Repeated thin, genuinely perforated fretwork is visible against the shaded air behind the posts.
 function porchSide(f:Face,ends:number[],stairsAt:number){
  for(const u of ends){
   f.w('trim',f.map(u,2.39,.036),.193,3.42,.195);
   f.w('frame',f.map(u,.85,.045),.248,.29,.247);
   f.w('fret',f.map(u,3.83,.136),.239,.284,.058);
  }
  for(let i=1;i<ends.length;i++){
   let a=ends[i-1]+.092,b=ends[i]-.092;const mid=(a+b)*.5,len=b-a;if(len<.26)continue;
   const Y=3.79,crown=3.65,drop=.47;
   f.w('trim',f.map(mid,4.030,.067),len,.145,.149);
   f.w('trim',f.map(mid,Y+.12,.087),len,.095,.132);f.w('fret',f.map(mid,Y-.097,.088),len,.045,.102);
   for(let u=a+.09;u<b-.080;u+=.167){
    jointTube('fret',f.map(u-.051,Y-.078,.118),f.map(u+.054,Y+.096,.118),.031,.047);
    jointTube('fret',f.map(u-.051,Y+.096,.120),f.map(u+.054,Y-.078,.120),.031,.047);
   }
   let prev=f.map(a,crown-drop,.082);
   for(let n=1;n<=19;n++){
    const t=n/19, u=a+len*t,y=crown-drop*Math.pow(Math.abs(2*t-1),2.4);const q=f.map(u,y,.082);
    jointTube('frame',prev,q,.063,.12);prev=q;
   }
   if(i===stairsAt){const l=mid-.73,r=mid+.73;rail(a,l);rail(r,b);step(f,mid,1.49);}
   else rail(a,b);
   function rail(l:number,r:number){
    if(r-l<.21)return;
    f.w('frame',f.map((l+r)*.5,1.447,.077),r-l,.101,.133); f.w('trim',f.map((l+r)*.5,.771,.078),r-l,.076,.14);
    for(let u=l+.058;u<r-.044;u+=.114){
     const profile=[[0,.048],[.09,.071],[.20,.056],[.31,.036],[.44,.071],[.58,.054],[.636,.044]];
     for(let j=1;j<profile.length;j++){
      const [y,w]=profile[j-1],[y2,w2]=profile[j];quad('fret',f.map(u-w/2,y+.795,.100),f.map(u+w/2,y+.795,.100),f.map(u+w2/2,y2+.795,.100),f.map(u-w2/2,y2+.795,.100));
      quad('fret',f.map(u+w/2,y+.795,.061),f.map(u-w/2,y+.795,.061),f.map(u-w2/2,y2+.795,.061),f.map(u+w2/2,y2+.795,.061));
     }
    }
   }
   for(const d of [.03,-.08])f.w('foundation',f.map(mid,.318,d),len,.443,.02);
   for(let u=a+.11;u<b-.08;u+=.098)f.w('sash',f.map(u,.330,.052),.037,.398,.032);
  }
 }
 function step(f:Face,u:number,w:number){
  if(seated)return;
  for(let i=0;i<4;i++){
   const h=(4-i)*deckY/4;f.w('deck',f.map(u,h*.5,.135+i*.294),w+.12,h,.294);
  }
  for(const si of [-1,1]){
   const x=u+si*w*.52;
   f.w('trim',f.map(x,1.06,.081),.154,.93,.151);f.w('frame',f.map(x,.491,1.03),.167,.902,.157);
   jointTube('frame',f.map(x,1.491,.081),f.map(x,.946,1.04),.105,.103);
  }
 }
 porchSide(facadeSide([westLine,8.10,7.32,backLine],0),[-9.28,-6.66,-3.51,.06,3.54,6.39,7.99],3);
 porchSide(facadeSide([westLine,-7.1,-.63,backLine],2),[2.29,4.67,7.09,10.16],0);
 // The enclosed Kent Street vestibule (local X-) and arched sidelights are not just brown rectangles on the facade.
 role='Kent Street exterior entry';
 const door=facadeSide([westLine,-7.1,-.59,2.28],2),u=.820;
 box('trim',[-8.24,4.164,.836],2.50,.23,2.9);box('ochre',[-8.14,2.28,.836],2.24,3.18,2.82);
 box('trim',[-9.408,3.818,.835],.218,.31,2.97);
 for(let u=-.475;u<2.22;u+=.225)box('fret',[-9.484,3.902,u],.19,.132,.056);
 for(const k of [-1,1]){
  door.w('frame',door.map(u+k*.78,2.22,.058),.203,2.78,.145);
  const leaf=u+k*.334,w=.332,lo=leaf-w,hi=leaf+w,slot=.136,bottom=1.74,arch=bottom+.99,d=.087;
  // A real aperture inside each closed wood leaf, rather than drawing arch glass on top of an opaque slab.
  for(const [l,r] of [[lo,leaf-slot],[leaf+slot,hi]])faceRect(door,l,r,.71,3.39,'fret',d);
  faceRect(door,leaf-slot,leaf+slot,.71,bottom,'fret',d);
  for(let j=0;j<20;j++){
   const a=Math.PI-Math.PI*j/20,b=Math.PI-Math.PI*(j+1)/20,ax=leaf+slot*Math.cos(a),bx=leaf+slot*Math.cos(b);
   quad('fret',door.map(ax,arch+slot*Math.sin(a),d),door.map(bx,arch+slot*Math.sin(b),d),door.map(bx,3.39,d),door.map(ax,3.39,d));
  }
  for(const h of [.99,1.21,3.12])door.w('trim',door.map(leaf,h,.111),.422,.043,.037);
  dormer(door,leaf,bottom,.280,.095,true);
  dormer(door,u+k*1.02,1.46,.25,.10,true);
 }
 door.w('frame',door.map(u,3.53,.074),2.74,.146,.23);step(door,u,1.67);
 const model=flush('Beaconsfield Historic House, detached original exterior');
 role='unworked comparison shape';box('ochre',[-.1,6.0,1.4],14.6,10.8,14.5);box('slate',[-.1,12.2,1.4],14.6,.42,14.5);box('ochre',[3.3,3.67,-11.65],6.2,7.34,13.1);
 const simple=flush('unworked detached massing control');
 function flush(name:string){const q=new T.Group();q.name=name;for(const [k,gs] of parts){const combined=mergeGeometries(gs);if(!combined)throw Error(k);for(const a of gs)a.dispose();const o=new T.Mesh(combined,mats[k]);o.name=k;o.castShadow=!seated;o.receiveShadow=!seated;q.add(o);}parts=new Map();return q;}
 return {model,simple,counts,heights};
}
