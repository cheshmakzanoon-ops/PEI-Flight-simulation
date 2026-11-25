import * as T from 'three';
import { SEACOW } from './seacow-exterior-seat.ts';

type P=[number,number,number];
type UV=[number,number];
type Batch={p:number[];uv:number[];colors:number[]};
type Floor=(x:number,z:number)=>number;
const tau=Math.PI*2,deg=Math.PI/180,ca=Math.cos(Math.PI/8);
const count=8,face0=5*deg,alpha0=face0-Math.PI/8,R=3.429/(2*Math.sin(Math.PI/8)),eave=13.76,topR=2.22;
const white=0xeae9e1,flashing=0xf0efe8,deep=0x77242b,paint=0xac3434,lip=0xbd463b,sash=0xa7a699;
const foundation=0xb8b1a6,windowGlass=0x586c70,metal=0x9ba1a1,roofTint=0xa53131;
const cache=new Map<number,T.Color>();
function color(c:number){let q=cache.get(c);if(!q){q=new T.Color(c);cache.set(c,q);}return q;}
const empty=():Batch=>({p:[],uv:[],colors:[]});
function vertex(B:Batch,p:P,c:number,uv:UV){const k=color(c);B.p.push(...p);B.colors.push(k.r,k.g,k.b);B.uv.push(...uv);}
function tri(B:Batch,a:P,b:P,c:P,tone:number,uvs?:[UV,UV,UV]){
 vertex(B,a,tone,uvs?.[0]??[0,0]);vertex(B,b,tone,uvs?.[1]??[0,0]);vertex(B,c,tone,uvs?.[2]??[0,0]);
}
function quad(B:Batch,a:P,b:P,c:P,d:P,tone:number,uvs?:[UV,UV,UV,UV]){
 tri(B,a,b,c,tone,uvs&&[uvs[0],uvs[1],uvs[2]]);tri(B,a,c,d,tone,uvs&&[uvs[0],uvs[2],uvs[3]]);
}
const radius=(y:number)=>R+(topR-R)*Math.max(0,Math.min(1,y/eave));
function perimeter(r:number,a:number,y:number):P{return [Math.sin(a)*r,y,-Math.cos(a)*r];}
function face(i:number,u:number,y:number,o=0):P{
 const a=face0+i*tau/8,h=radius(y)*ca+o;
 return [Math.sin(a)*h+Math.cos(a)*u,y,-Math.cos(a)*h+Math.sin(a)*u];
}
function band(B:Batch,n:number,r0:number,r1:number,y0:number,y1:number,c:number,a0=alpha0){
 for(let j=0;j<n;j++){
  const a=a0+tau*j/n,b=a+tau/n;
  quad(B,perimeter(r0,a,y0),perimeter(r1,a,y1),perimeter(r1,b,y1),perimeter(r0,b,y0),c);
 }
}
function disk(B:Batch,n:number,r:number,y:number,c:number,a0=alpha0){
 for(let j=0;j<n;j++)tri(B,[0,y,0],perimeter(r,a0+tau*(j+1)/n,y),perimeter(r,a0+tau*j/n,y),c);
}
function rod(B:Batch,A:P,Z:P,r:number,c:number,n=6){
 const a=new T.Vector3(...A),z=new T.Vector3(...Z),t=z.clone().sub(a),l=t.length();if(l<1e-6)return;
 t.divideScalar(l);const u=new T.Vector3().crossVectors(Math.abs(t.y)>.9?new T.Vector3(1,0,0):new T.Vector3(0,1,0),t).normalize();
 const v=new T.Vector3().crossVectors(t,u);
 const pts=(p:T.Vector3,j:number):P=>{const k=tau*j/n;return p.clone().addScaledVector(u,Math.cos(k)*r).addScaledVector(v,Math.sin(k)*r).toArray() as P;};
 for(let j=0;j<n;j++)quad(B,pts(a,j),pts(a,j+1),pts(z,j+1),pts(z,j),c);
}
function mesh(B:Batch,mat:T.Material,name:string){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(B.p,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(B.uv,2));g.setAttribute('color',new T.Float32BufferAttribute(B.colors,3));
 g.computeVertexNormals();g.computeBoundingSphere();
 const m=new T.Mesh(g,mat);m.name=name;return m;
}
/** Original filtered shaker relief. Uses metre UVs along the eight proper body planes;
 * no fetched texture, copied photograph or made-up bare/rotted wood. */
function siding(){
 const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.84,side:T.DoubleSide});
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 scCourse;').replace('#include <begin_vertex>','#include <begin_vertex>\nscCourse=uv;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 scCourse;').replace('#include <color_fragment>',`#include <color_fragment>
   vec2 metres=scCourse;
   float py=max(length(vec2(dFdx(metres.y),dFdy(metres.y))),.0002);
   float px=max(length(vec2(dFdx(metres.x),dFdy(metres.x))),.0002);
   float detail=1.-smoothstep(.052,.18,max(px,py));
   float line=metres.y/.128,course=floor(line);
   float v=fract(line)*.128;
   float x=metres.x+.119*mod(course,2.)+.043*sin(course*2.38);
   float id=floor(x/.243),u=fract(x/.243)*.243;
   float joint=(1.-smoothstep(.0008,.0036+min(px,.018),min(u,.243-u)))*(.0038/(.0038+px*.55));
   float lap=(1.-smoothstep(.0010,.0050+min(py,.018),min(v,.128-v)))*(.006/(.006+py*.46));
   float ridge=exp(-abs(v-.010)/.004)*(.008/(.008+py));
   float tile=fract(sin(dot(vec2(id,course),vec2(3.184,9.713)))*1758.41)-.5;
   diffuseColor.rgb*=1.+detail*(-.12*joint-.155*lap+.047*ridge+.035*tile);
  `);
 };
 m.customProgramCacheKey=()=>'seacow-original-shaker-v1';return m;
}

type Opening={i:number;lo:number;hi:number;w:number;door?:true};
/** Site-specific, original documentary art. All points are local metres relative to the
 * existing regular-draw grade, not sea datum. Only the nominal total height and base
 * side have published metric support. Other proportions and compass aspect are authored. */
export function makeSeacowExterior(ground:Floor){
 const [X,Z]=SEACOW.xz,gy=ground(X,Z);if(!Number.isFinite(gy))throw Error('Seacow: nonfinite site');
 const local=(p:P)=>ground(X+p[0],Z+p[2])-gy;
 const group=new T.Group();group.name='Seacow Head · tower exterior study';group.position.set(X,gy,Z);
 const shake=empty(),solid=empty(),glaze=empty(),glint=empty();
 const feet:P[]=[];
 for(let i=0;i<8;i++){
  const p=perimeter(R,alpha0+tau*i/8,0);p[1]=local(p);feet.push(p);
 }
 const min=Math.min(...feet.map(p=>p[1])),max=Math.max(...feet.map(p=>p[1]));
 if(!Number.isFinite(min+max)||max-min>.80||max>.55||min<-.55)throw Error('Seacow: unexpected original footing');
 const sill=max+.072;
 // A low tapered foundation wall follows the actual ground, not an invented flat apron.
 for(let i=0;i<8;i++){
  const a=feet[i],b=feet[(i+1)%8];for(let s=0;s<8;s++){
   const at=(j:number):P=>{const f=j/8,p:P=[a[0]+f*(b[0]-a[0]),0,a[2]+f*(b[2]-a[2])];p[1]=local(p)-.045;return p;};
   const c=at(s),d=at(s+1),h=radius(sill)/R;
   quad(solid,c,[c[0]*h,sill,c[2]*h],[d[0]*h,sill,d[2]*h],d,foundation);
  }
 }
 const doorFace=1;const doorFoot: P[]=[];
 for(const u of [-.62,0,.62])for(const o of [0,.42])doorFoot.push(face(doorFace,u,0,o));
 const threshold=Math.max(...doorFoot.map(local))+.11;
 const ops:Opening[]=[{i:doorFace,lo:threshold,hi:threshold+2.04,w:.96,door:true},
  {i:1,lo:5.09,hi:6.42,w:.78},{i:1,lo:11.16,hi:12.60,w:.79},
  {i:3,lo:1.33,hi:2.78,w:.81},{i:6,lo:8.18,hi:9.58,w:.79},{i:4,lo:10.98,hi:12.34,w:.77}];
 for(let i=0;i<8;i++){
  const list=ops.filter(q=>q.i===i).sort((a,b)=>a.lo-b.lo);
  const levels=[sill,...list.flatMap(q=>[Math.max(sill,q.lo),q.hi]),eave].sort((a,b)=>a-b);
  for(let k=1;k<levels.length;k++){
   const y0=levels[k-1],y1=levels[k];if(y1-y0<.0001)continue;
   const mid=(y0+y1)*.5,op=list.find(q=>mid>q.lo&&mid<q.hi);
   const f0=radius(y0)*Math.sin(Math.PI/8),f1=radius(y1)*Math.sin(Math.PI/8),c=op?op.w/2:0;
   const panel=(a0:number,a1:number,b0:number,b1:number)=>{
    quad(shake,face(i,a0,y0),face(i,a1,y1),face(i,b1,y1),face(i,b0,y0),white,
     [[a0+i*17,y0],[a1+i*17,y1],[b1+i*17,y1],[b0+i*17,y0]]);
   };if(op){panel(-f0,-f1,-c,-c);panel(c,c,f0,f1);}else panel(-f0,-f1,f0,f1);
  }
 }
 function panel(i:number,x0:number,y0:number,x1:number,y1:number,out:number,c:number){
  quad(solid,face(i,x0,y0,out),face(i,x0,y1,out),face(i,x1,y1,out),face(i,x1,y0,out),c);
 }
 function lipBox(i:number,x0:number,y0:number,x1:number,y1:number,back:number,front:number,c:number){
  panel(i,x0,y0,x1,y1,front,c);
  const p=(u:number,y:number,o:number)=>face(i,u,y,o);
  quad(solid,p(x0,y0,back),p(x0,y1,back),p(x0,y1,front),p(x0,y0,front),c);
  quad(solid,p(x1,y0,front),p(x1,y1,front),p(x1,y1,back),p(x1,y0,back),c);
  quad(solid,p(x0,y1,back),p(x1,y1,back),p(x1,y1,front),p(x0,y1,front),c);
  quad(solid,p(x0,y0,front),p(x1,y0,front),p(x1,y0,back),p(x0,y0,back),c);
 }
 for(const q of ops){
  const {i,lo,hi,w}=q,L=-w/2,H=w/2;
  // Physically recessed openings, not an office-window decal. Red shallow flashings and white triangular heads.
  panel(i,L,lo,H,hi,-.099,q.door?0xcac5b3:windowGlass);
  for(const u of [L,H])quad(solid,face(i,u,lo,-.104),face(i,u,hi,-.104),face(i,u,hi,.025),face(i,u,lo,.025),deep);
  for(const y of [lo,hi])quad(solid,face(i,L,y,-.104),face(i,L,y,.025),face(i,H,y,.025),face(i,H,y,-.104),deep);
  lipBox(i,L-.055,lo-.025,L+.035,hi+.03,0,.054,paint);
  lipBox(i,H-.035,lo-.025,H+.055,hi+.03,0,.054,paint);
  lipBox(i,L-.075,lo-.047,H+.075,lo+.026,-.01,.085,deep);
  lipBox(i,L-.08,hi-.017,H+.08,hi+.072,-.012,.082,paint);
  if(!q.door){
   // Six-over-six sash: three columns × two rows above and below the meeting rail.
   for(const f of [1/3,2/3]){const x=L+w*f;panel(i,x-.014,lo,x+.014,hi,-.071,sash);}
   for(const f of [.25,.5,.75]){const y=lo+f*(hi-lo),v=f===.5?.026:.014;panel(i,L,y-v,H,y+v,-.068,sash);}
  }else{
   for(const x of [L+.07,H-.07])panel(i,x-.012,lo+.08,x+.012,hi-.09,-.068,0xb8b3a7);
   rod(solid,face(i,H-.13,lo+.94,-.072),face(i,H-.13,lo+.94,.016),.030,metal,8);
  }
  const hw=H+.16,base=hi+.074,peak=base+(q.door?.36:.34);
  tri(solid,face(i,-hw,base,.046),face(i,0,peak,.046),face(i,hw,base,.046),flashing);
  for(let k=1;k<=3;k++){const v=k/5,y=base+(peak-base)*v,half=hw*(1-v);panel(i,-half,y-.006,half,y+.006,.051,0xc8c6bb);}
  for(const side of [-1,1]){
   const u=side*hw;
   quad(solid,face(i,u,base,-.026),face(i,0,peak,-.026),face(i,0,peak,.13),face(i,u,base,.13),paint);
   quad(solid,face(i,u,base,.13),face(i,0,peak,.13),face(i,0,peak-.045,.13),face(i,u,base-.045,.13),lip);
  }
 }
 // One restrained attached threshold, not a deck or a new path. Omit invented signage.
 const sf=(u:number,o:number):P=>{const p=face(doorFace,u,threshold,o);return p;};
 const sta=[sf(-.61,.03),sf(.61,.03),sf(.61,.40),sf(-.61,.40)];
 quad(solid,sta[0],sta[1],sta[2],sta[3],foundation);
 for(let i=0;i<4;i++){const a=sta[i],b=sta[(i+1)%4];quad(solid,[a[0],local(a)-.025,a[2]],a,b,[b[0],local(b)-.025,b[2]],foundation);}
 // Tiered gallery underside, real overhang, level open two-rail steel gallery.
 const cap=[ [13.70,2.22],[13.74,2.33],[13.82,2.38],[13.87,2.47],[13.96,2.50],[14.00,2.64],[14.12,2.69],[14.18,2.77],[14.25,2.77],[14.28,2.72] ];
 for(let i=1;i<cap.length;i++)band(solid,8,cap[i-1][1],cap[i][1],cap[i-1][0],cap[i][0],i%3===1?lip:i%3===0?deep:paint);
 disk(solid,8,2.72,14.28,deep);
 for(let i=0;i<8;i++){
  const a=alpha0+i*tau/8,b=a+tau/8,r=2.63;
  rod(solid,perimeter(r,a,14.28),perimeter(r,a,15.26),.032,paint,6);
  for(const y of [14.72,15.23])rod(solid,perimeter(r,a,y),perimeter(r,b,y),.027,paint,6);
 }
 // Round ventilated skirt, genuine glazed twelve-planed lantern, red pressed metal roof.
 const lanternA=face0-Math.PI/12;
 band(solid,36,1.59,1.59,14.28,14.92,paint,lanternA);
 band(solid,36,1.61,1.61,14.29,14.35,deep,lanternA);
 band(solid,36,1.62,1.62,14.88,14.95,lip,lanternA);
 for(let i=0;i<12;i++){
  const a=lanternA+i*tau/12,b=a+tau/12;
  quad(glaze,perimeter(1.54,a,14.93),perimeter(1.54,a,16.34),perimeter(1.54,b,16.34),perimeter(1.54,b,14.93),0xc0d4c8);
  rod(solid,perimeter(1.565,a,14.92),perimeter(1.565,a,16.40),.034,deep,7);
  // Discrete dark collars on the round red lower housing, not painted black window grids.
  const angle=a+tau/24,nx=Math.sin(angle),nz=-Math.cos(angle),tx=Math.cos(angle),tz=Math.sin(angle);
  const pt=(s:number,v:number,r:number):P=>[nx*r+s*tx,14.59+v,nz*r+s*tz];
  for(let k=0;k<9;k++){const aa=k*tau/9,bb=aa+tau/9;
   tri(solid,pt(0,0,1.596),pt(.035*Math.cos(aa),.035*Math.sin(aa),1.596),pt(.035*Math.cos(bb),.035*Math.sin(bb),1.596),0x583c38);}
 }
 disk(solid,36,1.59,14.94,0x714743,lanternA);
 band(solid,12,1.59,1.64,16.33,16.43,deep,lanternA);band(solid,12,1.64,1.68,16.43,16.64,paint,lanternA);
 band(solid,12,1.68,1.74,16.64,16.69,lip,lanternA);band(solid,12,1.74,.26,16.69,17.14,roofTint,lanternA);
 for(let i=0;i<12;i++){const a=lanternA+i*tau/12;rod(solid,perimeter(1.70,a,16.705),perimeter(.29,a,17.145),.014,lip,5);}
 for(let i=1;i<8;i++){const ys=[17.135,17.22,17.34,17.40,17.54,17.78,18.04,18.3],rs=[.27,.22,.21,.15,.18,.127,.103,.012];band(solid,12,rs[i-1],rs[i],ys[i-1],ys[i],i>5?metal:roofTint,lanternA);}
 disk(solid,12,.012,18.3,metal,lanternA);
 // Quiet physical optic behind the panes; no route cue, projected beam or real navigation claim.
 band(glint,24,.24,.30,14.94,15.45,0x65877d,lanternA);
 band(glint,24,.32,.43,15.45,15.76,0xc2d9c0,lanternA);band(glint,24,.43,.28,15.76,16.02,0xc3d5b9,lanternA);
 for(let k=0;k<6;k++)band(glint,24,.39,.39,15.55+k*.045,15.563+k*.045,0xd4e5ce,lanternA);
 group.add(mesh(shake,siding(),'Seacow · tapered white shaker shaft'),
  mesh(solid,new T.MeshStandardMaterial({vertexColors:true,roughness:.71,metalness:.085,side:T.DoubleSide}),'Seacow · cornice, portals and metalwork'),
  mesh(glint,new T.MeshStandardMaterial({vertexColors:true,roughness:.24,metalness:.24}),'Seacow · internal optic'),
  mesh(glaze,new T.MeshStandardMaterial({vertexColors:true,roughness:.19,metalness:.13,transparent:true,opacity:.43,depthWrite:false,side:T.FrontSide}),'Seacow · twelve lantern panes'));
 group.userData.seacowFootXZ=feet.map(p=>[p[0]+X,p[2]+Z]);group.userData.seacowThreshold=sta.map(p=>[p[0]+X,p[1]+gy,p[2]+Z]);
 return {group,dispose(){for(const item of group.children){const m=item as T.Mesh<T.BufferGeometry,T.Material>;m.geometry.dispose();m.material.dispose();}group.removeFromParent();}};
}
