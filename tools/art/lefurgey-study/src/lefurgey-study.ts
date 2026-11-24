/** Original 2020 exterior interpretation. Detached Three geometry only; no app actor or access. */
import * as T from 'three';
import {LEFURGEY as Q} from './lefurgey-survey.generated.ts';
import {box,trim,planTriangles,roofPatches,hOn,caps,shoe,at,nominalPorchAt,lerp,signedArea,signedPlanDistance,sub,type V,type F} from './lefurgey-roof.ts';
export const colours={
 shingle:0x66635e,soffit:0x68705f,ochre:0xcbac6c,wood:0x657364,darkWood:0x414f46,
 red:0x7f463d,quietCream:0xbeb187,glass:0x4f626d,stone:0x6d6256,brick:0x765a4c,
 porchFloor:0x70645b,roofCopper:0x646461
};
type R=keyof typeof colours;type P=T.Vector3;
const Y=new T.Vector3(0,1,0),EPS=1e-8;
export function buildLefurgeyAuthoringStudy(){
 const data={} as Record<R,number[]>;
 for(const n of Object.keys(colours) as R[])data[n]=[];
 function tri(role:R,a:P,b:P,c:P,normal?:P){
  const n=b.clone().sub(a).cross(c.clone().sub(a));
  if(n.lengthSq()<1e-18)return;
  if(normal&&n.dot(normal)<0)[b,c]=[c,b];
  for(const q of [a,b,c])data[role].push(q.x,q.y,q.z);
 }
 const quad=(m:R,a:P,b:P,c:P,d:P,n?:P)=>{tri(m,a,b,c,n);tri(m,a,c,d,n)};
 function cap(role:R,poly:readonly V[],fn:(p:V)=>number,upside=1){
  if(poly.length<3)return;
  const b=poly.map(p=>shoe(p,fn(p))),n=Y.clone().multiplyScalar(upside);
  for(let i=1;i+1<b.length;i++)tri(role,b[0],b[i],b[i+1],n);
 }
 const board=(role:R,a:V,b:V,lo0:number,lo1:number,hi0:number,hi1:number,n?:P)=>
    quad(role,shoe(a,lo0),shoe(b,lo1),shoe(b,hi1),shoe(a,hi0),n);
 const turn=(a:V,b:V,sign:number)=>new T.Vector3(sign*(b[1]-a[1]),0,sign*(b[0]-a[0])).normalize();
 const allTerms=roofPatches.flatMap(p=>[...p.domain]);
 for(let i=0;i<roofPatches.length;i++)for(let j=i+1;j<roofPatches.length;j++)allTerms.push(sub(roofPatches[i].face,roofPatches[j].face));
 const v=(p:F,a:V)=>p[0]+p[1]*a[0]+p[2]*a[1];
 function stops(a:V,b:V){
  const out=[0,1];
  for(const p of allTerms){const x=v(p,a),y=v(p,b);if((x<0)!==(y<0)&&Math.abs(x-y)>EPS)out.push(x/(x-y));}
  return out.sort((c,d)=>c-d).filter((f,i,z)=>!i||f-z[i-1]>1e-6);
 }
 for(const f of caps()){
  const poly=f.polygon,ml=f.patch.group==='lower'?.105:.134;
  const y=(p:V)=>hOn(f.patch,p);cap('shingle',poly,y);cap('soffit',poly,p=>y(p)-ml,-1);
  const s=Math.sign(signedArea(poly));
  for(const [i,a]of poly.entries()){
   const b=poly[(i+1)%poly.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<.018)continue;
   const n=turn(a,b,s),p=lerp(a,b,.5),x:V=[p[0]+n.x*.006,p[1]-n.z*.006];
   const near=signedPlanDistance(x)<0?-Infinity:at(x).y;
   if(y(p)-near>.035)board('wood',a,b,y(a)-ml,y(b)-ml,y(a),y(b),n);
  }
 }
 // Interpretive wall offsets beneath the measured-domain caps, not an as-built survey.
 const main:V[]=[[2.31,1.07],[11.53,1.07],[11.53,13.24],[9.68,13.24],[8.89,14.69],[2.31,14.69]];
 const north:V[]=[[11.53,6.02],[19.82,6.02],[19.82,13.23],[11.53,13.23]];
 const southGable:V[]=[[.94,6.27],[2.33,6.27],[2.33,10.13],[.94,10.13]];
 const frontBay:V[]=[[1.11,7.01],[1.11,9.04],[1.38,9.40],[2.32,9.40],[2.32,6.65],[1.38,6.65]];
 const raisedRear:V[]=[[8.14,7.43],[11.11,7.43],[11.11,10.26],[8.14,10.26]];
 function body(p:V[],a:number,roofPad:number,fac:R,capBottom=false){
  const z=Math.sign(signedArea(p));
  for(const [i,u]of p.entries()){
   const w=p[(i+1)%p.length],n=turn(u,w,z),t=stops(u,w);
   for(let i=1;i<t.length;i++){
    const c=lerp(u,w,t[i-1]),d=lerp(u,w,t[i]),mid=lerp(c,d,.5);
    if(signedPlanDistance(mid)<-1e-7)continue;
    const top=at(mid,false),plane=roofPatches.find(x=>x.label===top.label);
    if(!plane)continue;
    const h0=hOn(plane,c)-roofPad,h1=hOn(plane,d)-roofPad;
    if(Math.min(h1,h0)>a+.018)board(fac,c,d,a,a,h0,h1,n);
   }
  }
  if(capBottom)cap(fac,p,()=>a,-1);
 }
 body(main,11.33,.093,'ochre');body(north,11.29,.095,'ochre');
 body(southGable,17.52,.106,'ochre');body(raisedRear,19.00,.092,'ochre');
 function plinth(p:V[],lo:number,hi:number,m:R) {
  const s=Math.sign(signedArea(p));
  for(const [i,a]of p.entries()){
   const b=p[(i+1)%p.length];
   if(signedPlanDistance(lerp(a,b,.5))>=-EPS)board(m,a,b,lo,lo,hi,hi,turn(a,b,s));
  }
 }
 plinth(main,10.24,11.329,'brick');plinth(north,10.27,11.289,'stone');
 const wx=(m:R,u:number,V:number,y:number,w:number,h:number,r:number)=>{
  const p:V[]=[[u-w*.5,V-r*.5],[u+w*.5,V-r*.5],[u+w*.5,V+r*.5],[u-w*.5,V+r*.5]];
  if(p.some(x=>signedPlanDistance(x)<.007))return;
  cap(m,p,()=>y+h*.5);cap(m,p,()=>y-h*.5,-1);plinth(p,y-h*.5,y+h*.5,m);
 };
 // Bounded, unstepped deck. No circulation, exterior stairs or access.
 const deckTop=11.315;
 const deckRects:[[number,number,number,number],[number,number,number,number]]=[
  [.651,2.308,.54,16.46],[2.308,7.324,14.68,16.46]];
 for(const rect of deckRects)for(const p0 of planTriangles){
  const p=trim(p0,box(...rect));if(p.length<3)continue;
  cap('porchFloor',p,()=>deckTop);cap('soffit',p,()=>deckTop-.145,-1);
  const sign=Math.sign(signedArea(p));for(const [i,a]of p.entries()){
   const b=p[(i+1)%p.length],n=turn(a,b,sign),m=lerp(a,b,.5),q:V=[m[0]+n.x*.005,m[1]-n.z*.005];
   if(deckRects.some(([a,b,c,d])=>q[0]>a+EPS&&q[0]<b-EPS&&q[1]>c+EPS&&q[1]<d-EPS)&&signedPlanDistance(q)>0)continue;
   board('soffit',a,b,11.154,11.154,deckTop,deckTop,n);
  }
 }
 plinth([[.681,.58],[2.307,.58],[2.307,16.39],[.681,16.39]],10.25,11.154,'brick');
 plinth([[2.307,14.71],[7.279,14.71],[7.279,16.39],[2.307,16.39]],10.26,11.151,'brick');
 plinth(frontBay,15.69,17.56,'ochre');
 function column(u:number,v:number,y:number,t:number){
  if(signedPlanDistance([u,v])<.19||t<y+.45)return;
  const n=12,R=.102,L=.084;
  const ring=(z:number)=>Array.from({length:n},(_,k)=>[u+z*Math.cos(k*2*Math.PI/n),v+z*Math.sin(k*2*Math.PI/n)] as V);
  const course=[[y,.151],[y+.085,.151],[y+.145,R],[y+.48,R],[t-.184,L],[t-.136,.118],[t-.083,.127],[t,.129]];
  for(let i=1;i<course.length;i++){
   const [b,r]=course[i-1],[c,s]=course[i],Lo=ring(r),Hi=ring(s);
   for(let k=0;k<n;k++){const l=(k+1)%n,a=Lo[k],d=Lo[l],x=Hi[l],w=Hi[k];
    quad('wood',shoe(a,b),shoe(d,b),shoe(x,c),shoe(w,c),turn(a,d,1));}
  }
 }
 for(const z of [.84,3.49,6.95,9.16,12.19,15.03]){
  const co:V=[.824,z],h=nominalPorchAt(co);if(h<16.5&&Number.isFinite(h))column(...co,deckTop,h-.106);
 }
 for(const u of [1.86,4.22,6.92]){
  const z=16.20,h=nominalPorchAt([u,z]);
  if(h<16.4&&Number.isFinite(h)&&signedPlanDistance([u,z])>.195)column(u,z,deckTop,h-.109);
 }
 function fascia(a:V,b:V){
  const ss=stops(a,b);const n=turn(a,b,1);
  for(let i=1;i<ss.length;i++){
   const u=lerp(a,b,ss[i-1]),v=lerp(a,b,ss[i]),h0=nominalPorchAt(u),h1=nominalPorchAt(v);
   if(Number.isFinite(h0+h1)&&signedPlanDistance(lerp(u,v,.5))>.024)
    board('wood',u,v,h0-.194,h1-.194,h0-.072,h1-.072,n);
  }
 }
 fascia([.682,15.54],[.682,.66]);fascia([6.99,16.31],[.84,16.31]);
 function southWindow(v:number,y:number,w:number,h:number,u=2.296,division=2){
  wx('wood',u,v,y,.083,h+.171,w+.192);
  wx('red',u-.050,v,y,.059,h+.055,w+.068);
  wx('glass',u-.083,v,y,.028,h-.063,w-.061);
  for(let k=1;k<division;k++)wx('red',u-.103,v-w*.5+k*w/division,y,.022,h,.032);
  wx('red',u-.111,v,y+.083,.029,.044,w-.014);
  wx('quietCream',u-.106,v,y-h*.5-.057,.068,.060,w+.173);
 }
 function panelDoor(v:number,w:number){
  const u=2.291,y=12.484,h=2.181;
  wx('wood',u,v,y,.11,h+.114,w+.179);
  wx('red',u-.064,v,y,.048,h,w);
  wx('glass',u-.095,v,y+.276,.026,.875,w*.69);
  wx('red',u-.116,v,y+.277,.027,.909,.028);
  for(const q of [-.183,.183])wx('darkWood',u-.096,v+w*q,y-.524,.026,.567,w*.24);
  wx('quietCream',u-.110,v,y-h*.5-.019,.144,.055,w+.205);
 }
 for(const z of [2.94,5.32,10.77,13.00])southWindow(z,12.745,1.184,1.726,2.293,3);
 for(const z of [3.66,11.98])southWindow(z,16.761,1.20,1.667,2.293,2);
 panelDoor(8.056,1.28);
 for(const z of [7.38,8.067,8.758])southWindow(z,16.644,.561,1.392,1.105,1);
 southWindow(8.06,19.500,1.31,1.674,.933,2);
 // Decorative original balcony plate. It is not traversable or exact.
 wx('wood',.833,8.063,18.581,.426,.115,1.805);
 wx('wood',.751,8.063,19.215,.105,.093,1.835);
 for(let i=0;i<11;i++)wx(i%2===0?'darkWood':'wood',.755,7.24+.164*i,18.906,.076,.578,.041);
 function westWindow(u:number,y:number,w:number,h:number,V=1.064){
  wx('red',u,V,y,w+.090,h+.111,.076);wx('glass',u,V-.046,y,w-.059,h-.071,.028);
  wx('red',u,V-.065,y+.089,w,.041,.025);wx('red',u,V-.066,y,.038,h,.024);
 }
 for(const x of [4.02,7.82,10.51]){westWindow(x,12.656,1.246,1.63);westWindow(x,16.367,1.117,1.626);}
 for(const x of [13.47,16.37,18.86]){westWindow(x,12.628,1.11,1.32,6.014);westWindow(x,15.377,1.04,1.35,6.014);}
 function stick(m:R,a:P,b:P,w:number,d:number){
  const dv=b.clone().sub(a),f=dv.length();if(f<1e-6)return;
  const x=new T.BoxGeometry(w,f,d).rotateX(0);
  x.applyQuaternion(new T.Quaternion().setFromUnitVectors(Y,dv.normalize()));x.translate(...a.clone().lerp(b,.5).toArray());
  const index=x.index!,p=x.attributes.position;
  for(let i=0;i<index.count;i+=3){
   const a=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index.getX(i+k)));
   if(a.some(t=>signedPlanDistance([t.x,-t.z])<.003))continue;
   tri(m,a[0],a[1],a[2]);
  }x.dispose();
 }
 const x=.921,rv=Q.knownSouthGableRidgeV[0]+Q.knownSouthGableRidgeV[1]*x;
 for(const s of [-1,1]as const){
  const A:V=[x,rv],B:V=[x,rv+s*2.035];
  for(let i=0;i<28;i++){
   const t=i/28,w=(i+1)/28,a=lerp(A,B,t),b=lerp(A,B,w);
   const h=(p:V,g:number)=>at(p).y-.13-.138*(1.-Math.cos(g*Math.PI*30))/2;
   const p=shoe(a,h(a,t)),q=shoe(b,h(b,w));
   if(Number.isFinite(p.y+q.y))stick('quietCream',p,q,.078,.058);
  }
 }
 // Observed octagonal lantern cap. Body/windows and fascia dimensions are authored.
 const O=Q.capNominalOctagon,[ou,ov,T0,k,s1,s2,yaw]=O.nativeFit;
 const R8=(r:number,phase=Math.PI/8)=>Array.from({length:8},(_,i)=>{
  const a=i*Math.PI/4+phase+yaw,f=r/Math.cos(Math.PI/8);
  return[ou+f*Math.cos(a),ov+f*Math.sin(a)] as V;
 });
 const hR=(r:number)=>T0-s1*Math.min(r,k)-s2*Math.max(0,r-k);
 const e=R8(O.rEave),knot=R8(k),top=R8(O.rTop),wall=R8(O.rBody),rim=hR(O.rEave);
 cap('roofCopper',top,()=>hR(O.rTop));
 for(const [a,b,p0,p1,m]of [[e,knot,rim,hR(k),'roofCopper'],[knot,top,hR(k),hR(O.rTop),'roofCopper']]as const){
  for(let i=0;i<8;i++){const j=(i+1)%8;quad(m,shoe(a[i],p0),shoe(a[j],p0),shoe(b[j],p1),shoe(b[i],p1),Y);}
 }
 for(let i=0;i<8;i++){
  const a=wall[i],b=wall[(i+1)%8],normal=turn(a,b,1);
  // Closed under-seat on the modeled roof. B2-R's nominal 21.70m
  // cutoff left ~.346m daylight at a ring corner; the new base lies
  // below the adjoining modeled roof, and changes neither cap nor plan.
  board('quietCream',a,b,21.13,21.13,rim-.077,rim-.077,normal);
  const o=e[i],p=e[(i+1)%8];
  quad('soffit',shoe(o,rim-.083),shoe(p,rim-.083),shoe(b,rim-.083),shoe(a,rim-.083),Y.clone().negate());
  board('wood',o,p,rim-.083,rim-.083,rim,rim,turn(o,p,1));
  const out=(p:V,w:number):V=>[p[0]+normal.x*w,p[1]-normal.z*w];
  const l=out(lerp(a,b,.145),.011),r=out(lerp(a,b,.855),.011);
  board('red',l,r,22.91,22.91,rim-.146,rim-.146,normal);
  const j=out(lerp(a,b,.252),.021),m=out(lerp(a,b,.748),.021);
  board('glass',j,m,23.012,23.012,rim-.246,rim-.246,normal);
  const sk=(p:V,q:V,y0:number,y1:number,y2:number,y3:number)=>board('quietCream',p,q,y0,y1,y2,y3,normal);
  sk(out(lerp(a,b,.478),.032),out(lerp(a,b,.522),.032),23.01,23.01,rim-.21,rim-.21);
  sk(out(lerp(a,b,.248),.033),out(lerp(a,b,.752),.033),23.571,23.571,23.614,23.614);
 }
 const chimney=Q.measuredOneChimney,up=chimney.topComparator,boot=at(chimney.UV).y-.30;
 wx('brick',chimney.UV[0],chimney.UV[1],(up+boot)/2,chimney.nominalCrossSection[0],up-boot,chimney.nominalCrossSection[1]);
 wx('stone',chimney.UV[0],chimney.UV[1],up-.10,.47,.163,.46);
 const G=new T.Group();G.name='Lefurgey Cultural Centre — detached authored study';
 for(const [m,positions] of Object.entries(data) as [R,number[]][]){
  if(!positions.length)continue;
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geom.computeVertexNormals();geom.computeBoundingSphere();
  const mat=new T.MeshStandardMaterial({color:colours[m],roughness:m==='glass'?.34:m==='roofCopper'?.75:.87});
  const o=new T.Mesh(geom,mat);o.name=m;o.castShadow=o.receiveShadow=true;G.add(o);
 }
 G.userData={owner:Q.owner,locationEnabled:false,datum:Q.CGVD2013Datum,noGarden:true,noAccess:true,nominalCutProfiles:true};
 return G;
}
