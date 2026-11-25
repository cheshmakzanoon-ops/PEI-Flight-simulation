import * as T from 'three';
import {makeSurface,scalar} from './surfaces.ts';
import {drawOrwellName} from './lettering.ts';
type V=[number,number,number]; type UV=[number,number];
type Part='clapboard'|'return-shingles'|'decorated-timber'|'portal-timber'|'masonry'|'deck'|'glazing'|'interior-shadow'|'painted-lettering'|'fasteners';
const vec=(x:number,y:number,z:number):V=>[x,y,z],col=(hex:number,variance=0,v=.5)=>new T.Color(hex).multiplyScalar(1+(v-.5)*variance);
const scale=(x:V,f:number):V=>[x[0]*f,x[1]*f,x[2]*f],add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const C0:UV=[0,0],C1:UV=[1,1];
class Batch{
 position:number[]=[];uv:number[]=[];color:number[]=[];
 triangle(a:V,b:V,c:V,k:T.Color,ta:UV,tb:UV,tc:UV,tones:[number,number,number]=[1,1,1]){
  const vv=[a,b,c],tt=[ta,tb,tc];for(let i=0;i<3;i++){
   this.position.push(...vv[i]);this.uv.push(...tt[i]);this.color.push(k.r*tones[i],k.g*tones[i],k.b*tones[i]);
  }
 }
 quad(a:V,b:V,c:V,d:V,k:T.Color,s:UV=C0,e:UV=C1,tones:[number,number,number,number]=[1,1,1,1]){
  const q:UV=[e[0],s[1]],w:UV=[s[0],e[1]];this.triangle(a,b,c,k,s,q,e,[tones[0],tones[1],tones[2]]);this.triangle(a,c,d,k,s,e,w,[tones[0],tones[2],tones[3]]);
 }
 box(c:V,X:V,Y:V,Z:V,k:T.Color,axis:'x'|'y'|'z',id:number){
  const f=(a:number,b:number,d:number)=>add(c,add(scale(X,a*.5),add(scale(Y,b*.5),scale(Z,d*.5))));
  const A=f(-1,-1,1),B=f(1,-1,1),C=f(1,1,1),D=f(-1,1,1),a=f(-1,-1,-1),b=f(1,-1,-1),d=f(-1,1,-1),e=f(1,1,-1);
  const n=scalar(id,4),m=scalar(id,19),w=Math.hypot(...X),h=Math.hypot(...Y),z=Math.hypot(...Z);
  const f2=(a:V,b:V,c:V,d:V,swap:boolean,u:number,v:number)=>{
   if(swap)this.quad(b,c,d,a,k,[n,m],[n+v*.70,m+u*.88]);else this.quad(a,b,c,d,k,[n,m],[n+u*.70,m+v*.88]);
  };
  f2(A,B,C,D,axis==='y',w,h);f2(b,a,d,e,axis==='y',w,h);f2(B,b,e,C,axis==='y',z,h);f2(a,A,D,d,axis==='y',z,h);f2(D,C,e,d,axis==='z',w,z);f2(a,b,B,A,axis==='z',w,z);
 }
}
type Page={tag:string;x:number;y:number;z:number;col:number;row:number};
const PARTS:Part[]=['clapboard','return-shingles','decorated-timber','portal-timber','masonry','deck','glazing','interior-shadow','painted-lettering','fasteners'];
export const BOARDS=[-5.125,5.125],FACE_HEIGHT=4.01,PLINTH=.25;
type Rect={l:number;r:number;b:number;t:number;id:string};
const L:Rect={l:-4.083,r:-2.700,b:.78,t:3.40,id:'display-left'},
 W:Rect={l:-2.10,r:-.067,b:.34,t:2.48,id:'door'},
 R:Rect={l:.435,r:1.756,b:.78,t:3.40,id:'display-right'},
 X:Rect={l:-1.66,r:-.508,b:2.57,t:3.30,id:'transom'},
 S:Rect={l:3.185,r:4.055,b:1.19,t:2.929,id:'right-sash'};
const RECT=[L,W,R,X,S] as const;
function subtract(a:number,b:number,cut:Rect[]){
 const out:[number,number][]=[];let x=a;
 for(const slot of [...cut].sort((p,q)=>p.l-q.l)){
  if(slot.r<=x||slot.l>=b)continue;if(slot.l>x)out.push([x,Math.min(slot.l,b)]);x=Math.max(x,slot.r);
 }
 if(x<b)out.push([x,b]);return out;
}
export function makeClarkeFront(){
 const batches=Object.fromEntries(PARTS.map(k=>[k,new Batch()])) as Record<Part,Batch>,panes:Page[]=[];
 let i=2;
 const B=(mat:Part,x:number,y:number,z:number,w:number,h:number,d:number,k:number,grain:'x'|'y'|'z'='x',variance=0)=>{
  if(Math.min(w,h,d)<=0)throw Error(`Nonpositive geometry width ${mat}: ${w},${h},${d}`);
  batches[mat].box(vec(x,y,z),vec(w,0,0),vec(0,h,0),vec(0,0,d),col(k,variance,scalar(i,1)),grain,i++);
 };
 // Cut backing around the photo-confirmed openings. Shade seat and interior blackout never lie in front of the glazing.
 const wallY=[.25,...RECT.flatMap(o=>[o.b,o.t]),3.61].sort((a,b)=>a-b);
 for(let i=0;i+1<wallY.length;i++){
  const y0=wallY[i],y1=wallY[i+1];if(y1-y0<1e-7)continue;
  const active=RECT.filter(q=>y1>q.b+1e-8&&y0<q.t-1e-8);
  for(const [x0,x1]of subtract(...BOARDS as [number,number],active)){
   B('interior-shadow',(x0+x1)*.5,(y0+y1)*.5,-.133,x1-x0,y1-y0,.12,0x8a795e);
  }
 }
 // Clapboards run uninterrupted into the framing but have genuine lapped profiles and taper under the next course.
 const pitch=.129;
 for(let row=0;row<26;row++){
  const y=.251+row*pitch,jitter=(scalar(row,7)-.5)*.008,top=Math.min(3.638,y+pitch+.017),v=.037+(scalar(row,1)-.5)*.005;
  if(top<=y)continue;
  const margin=.010,active=RECT.filter(q=>top>q.b-margin&&y<q.t+margin);
  const paint=col(0xd3c4a6,.080,scalar(row,19));
  for(const [x0,x1]of subtract(...BOARDS as [number,number],active)){
   let x=x0;
   while(x<x1-.0001){
    const len=Math.min(x1-x,1.35+2.65*scalar(row,i)),xx=x+len,tipDrift=(scalar(row,i+41)-.5)*.0052,tilt=(scalar(i,12)-.5)*.005;
    const offset=scalar(row,i+15),grain:[UV,UV]=[[scalar(i,8),offset],[scalar(i,8)+len*.54,offset+.16]];
    const a=vec(x,y+jitter,v),b=vec(xx,y+jitter+tilt,v+tipDrift),c=vec(xx,top,.003),d=vec(x,top,.003);
    batches.clapboard.quad(a,b,c,d,paint,grain[0],grain[1],[.966,.952,1,1]);
    batches.clapboard.quad(vec(x,y+jitter+.001,.010),vec(xx,y+jitter+tilt+.001,.010),b,a,paint.clone().multiplyScalar(.84));
    x=xx+.0014;i++;
   }
  }
 }
 // The narrow, photo-supported right return demonstrates shorter staggered shingle cladding.
 // It stops at a studio cut rather than pretending to be the attached dwelling or full unseen elevation.
 const outer=BOARDS[1]+.006;
 B('interior-shadow',outer-.04,1.908,-.613,.08,3.31,1.213,0x8b795f,'y');
 for(let row=0;row<27;row++){
  const y=.255+row*.123,top=y+.136,id=row*131+70;
  let z=-1.23-.15*scalar(id,9);
  for(let n=0;z<.012;n++){
   const w=.125+.108*scalar(id,n*23),l=Math.max(-1.23,z+.0016),r=Math.min(.012,z+w-.0016);
   if(r-l>.006){
    const tip=.031+.005*scalar(id,n),c=col(0xd0c5aa,.117,scalar(id,n*59)),a=vec(outer+tip,y,r),b=vec(outer+tip+.004*(scalar(id,n*3)-.5),y+.002,l);
    const d=vec(outer+.005,top,r),cc=vec(outer+.005,top,l);batches['return-shingles'].quad(a,b,cc,d,c,[scalar(n,id),scalar(id,n+9)],[scalar(n,id)+w*1.5,scalar(id,n+9)+.22],[.965,.97,1,1]);
    batches['return-shingles'].quad(vec(outer+.006,y,r),vec(outer+.006,y+.002,l),b,a,c.clone().multiplyScalar(.81));
   }
   z+=w;
  }
 }
 // Horizontal dressed sill and the three physically distinct entablature profiles.
 // The return ends cleanly behind the surface; no fabricated outline of the actual roof.
 const w=BOARDS[1]-BOARDS[0];
 B('decorated-timber',0,.294,.017,w,.091,.166,0xb6a789);
 B('decorated-timber',0,3.563,.081,w+.026,.119,.202,0xcec3ac);
 B('decorated-timber',0,3.602,.164,w+.075,.039,.071,0xe5dbc5);
 B('decorated-timber',0,3.713,.063,w+.070,.235,.172,0xded3bb);
 B('decorated-timber',0,3.832,.142,w+.119,.052,.208,0xd8cdb5);
 B('decorated-timber',0,3.881,.184,w+.164,.054,.241,0xe4dac5);
 B('decorated-timber',0,3.943,.158,w+.203,.078,.277,0xd4c9af);
 B('decorated-timber',0,3.995,.211,w+.224,.034,.319,0xe6dcc6);
 // The profiled bands lap across a continuous side frieze, not separate floating slats.
 B('decorated-timber',5.095,3.771,-.635,.128,.422,1.281,0xd4c7ae,'z');
 for(const yy of [.296,3.563,3.721,3.883,3.987]){
  const cap=yy>3.5;B('decorated-timber',5.097,yy,-.628,cap?.184:.117,cap?.057:.086,1.317,cap?0xdad0b7:0xbcae90,'z');
 }
 // Pilasters are layered faces, base blocks, shafts and restrained cap relief, not white vertical paint stripes.
 for(const [j,x]of [-4.785,-2.393,.154,2.783,4.520,5.042].entries()){
  const weight=j===5?.14:.215;
  B('decorated-timber',x,1.926,.069,weight,3.21,.166,0xd2c6af,'y',.037);
  B('decorated-timber',x,1.963,.158,weight*.76,2.903,.051,0xe2d6bf,'y',.035);
  B('decorated-timber',x-weight*.344,1.963,.184,.021,2.904,.018,0xeae0cc,'y');
  B('decorated-timber',x+weight*.355,1.963,.170,.018,2.904,.017,0xc4b69c,'y');
  for(const [y,k,m]of [[.385,.082,1.14],[.438,.042,1.05],[3.414,.075,1.08],[3.487,.071,1.24]])B('decorated-timber',x,y,.094,weight*m,k,.203,0xd9ccb5);
 }
 function trim(o:Rect,depth:number){
  const w=o.r-o.l,h=o.t-o.b,x=(o.r+o.l)*.5,y=(o.t+o.b)*.5,side=o.id==='transom'?.074:.090;
  for(const a of [o.l,o.r]){
   B('decorated-timber',a,y,.050,side,h+.094,.104,0xdad0b8,'y');
   B('decorated-timber',a+(a===o.r?-.020:.020),y,.100,.027,h+.071,.039,0xe4dac7,'y');
   // Reveal boards between facade and frame, turned inwards into the wall opening.
   B('decorated-timber',a+(a===o.r?-.026:.026),y,depth*.5,.028,h-.022,-depth+.018,0xbcad95,'y');
  }
  B('decorated-timber',x,o.t+.018,.056,w+.116,.093,.141,0xd9cdb5);
  B('decorated-timber',x,o.t+.062,.078,w+.141,.022,.143,0xe7dbc5);
  B('decorated-timber',x,o.b-.013,.061,w+.130,.073,.180,0xcabea4);
  B('decorated-timber',x,o.b+.020,.096,w+.119,.019,.135,0xe6dac3);
 }
 function grid(o:Rect,spec:{columns:number;rows:number;depth:number;x0:number;x1:number;y0:number;y1:number;shift:number;weight:number}){
  const {columns:n,rows:m,depth:z,x0,x1,y0,y1,shift,weight}=spec,w=(x1-x0)/n,h=(y1-y0)/m;
  const f=o.id==='transom'?0xc1b69f:0xd0c7af;
  for(let y=0;y<m;y++)for(let x=0;x<n;x++){
   const a=x0+(x+.5)*w,b=y0+(y+.5)*h;
   B('glazing',a,b,z-.028,w-.008,h-.008,.003,0x2b3936,'x',.079);
   panes.push({tag:o.id,x:a,y:b,z:z-.0265,col:x,row:y+shift});
  }
  for(let j=0;j<=n;j++){
   const p=x0+j*w,edge=j===0||j===n,k=edge?weight*1.6:weight;
   B('decorated-timber',p,(y0+y1)*.5,z,k,y1-y0+.042,.064,f,'y',.045);
   if(!edge)B('decorated-timber',p+.001,(y0+y1)*.5,z+.034,k*.38,y1-y0+.009,.010,0xe6decd,'y');
  }
  for(let j=0;j<=m;j++){
   const p=y0+j*h,edge=j===0||j===m,k=edge?weight*1.6:weight;
   B('decorated-timber',(x0+x1)*.5,p,z,x1-x0+.047,k,.063,f,'x',.045);
   if(j!==0)B('decorated-timber',(x0+x1)*.5,p+.002,z+.035,x1-x0+.008,k*.41,.010,0xe6decb);
  }
 }
 for(const o of [L,R,X,S]){
  const z=o===X?-.128:-.096;trim(o,z);
  const l=o.l+.062,r=o.r-.062,b=o.b+.064,t=o.t-.061;
  B('interior-shadow',(l+r)*.5,(b+t)*.5,-.433,r-l+.10,t-b+.08,.033,0x292824);
  if(o===S){
   const mid=(b+t)*.5;grid(o,{columns:3,rows:2,depth:z,x0:l,x1:r,y0:b,y1:mid,shift:0,weight:.019});
   grid(o,{columns:3,rows:2,depth:z-.014,x0:l,x1:r,y0:mid,y1:t,shift:2,weight:.021});
   B('decorated-timber',(l+r)*.5,mid,z+.027,r-l+.039,.043,.074,0xcfc6af);
  }else grid(o,{columns:o===X?6:3,rows:o===X?2:3,depth:z,x0:l,x1:r,y0:b,y1:t,shift:0,weight:o===X?.021:.027});
 }
 // Recessed joinery of the central wagon entrance: outside edge, inner jamb,
 // painted twin timber leaves, lower flush panels, top rails, and simple landing.
 trim(W,-.38);const cx=(W.r+W.l)*.5,yb=W.b+.05,yt=W.t-.07,span=W.r-W.l-.114;
 // Opaque internal shadow stop sits behind the leaves; it is a stage cut, not museum interior.
 B('interior-shadow',cx,(W.b+W.t)*.5,-.496,W.r-W.l+.02,W.t-W.b+.02,.027,0x242019);
 for(const k of [-1,1]){
  const x=cx+k*span*.25;
  B('portal-timber',x,(yb+yt)*.5,-.391,span*.5-.023,yt-yb,.065,0x4a3027,'y',.08);
  for(const sign of [-1,1])B('portal-timber',x+span*.206*sign,(yb+yt)*.5,-.344,.127,yt-yb,.061,0x57372a,'y',.12);
  for(const [j,at]of [yb+.065,yb+(yt-yb)*.52,yt-.057].entries())B('portal-timber',x,at,-.334,span*.47,j===1?.109:.138,.081,j===1?0x654233:0x563729,'x',.07);
  for(const [j,y0,y1]of [[0,yb+.148,yb+(yt-yb)*.47],[1,yb+(yt-yb)*.57,yt-.132]]){
   const x0=x-(span*.5-.298)*.5,x1=x+(span*.5-.298)*.5,z=-.349,z0=-.333,c=col(j===0?0x59392e:0x423027);
   const p=.023;
   batches['portal-timber'].quad(vec(x0,y0,z0),vec(x1,y0,z0),vec(x1-p,y0+p,z),vec(x0+p,y0+p,z),c.clone().multiplyScalar(.9));
   batches['portal-timber'].quad(vec(x1,y1,z0),vec(x0,y1,z0),vec(x0+p,y1-p,z),vec(x1-p,y1-p,z),c.clone());
   batches['portal-timber'].quad(vec(x0,y0,z0),vec(x0+p,y0+p,z),vec(x0+p,y1-p,z),vec(x0,y1,z0),c.clone().multiplyScalar(1.10));
   batches['portal-timber'].quad(vec(x1-p,y0+p,z),vec(x1,y0,z0),vec(x1,y1,z0),vec(x1-p,y1-p,z),c.clone().multiplyScalar(.92));
   B('portal-timber',x,(y0+y1)*.5,z-.014,x1-x0-p*2,y1-y0-p*2,.024,j===0?0x4d332b:0x493028,'y',.06);
  }
 }
 B('portal-timber',cx,1.342,-.307,.043,1.939,.039,0x593a2c,'y');
 // Closed timber throat: joins the visible trim to the leaves and prevents an impossible
 // studio-sky opening between the door head and the separate transom.
 B('portal-timber',cx,W.t-.040,-.180,span+.143,.072,.382,0x463a2d,'x',.032);
 B('portal-timber',cx,W.b+.031,-.175,span+.132,.059,.400,0x655141,'x',.046);
 for(const x of [W.l+.035,W.r-.035])B('portal-timber',x,(W.t+W.b)*.5,-.178,.052,W.t-W.b-.023,.376,0x66503b,'y',.038);
 // No unsupported advertisements, museum objects or house interior are modelled. A small generic iron keeper is illustrative.
 B('fasteners',cx+.106,1.306,-.278,.045,.201,.016,0x4b4536,'y');
 B('fasteners',cx+.139,1.325,-.254,.093,.030,.043,0x77705f);
 for(let j=0;j<3;j++){
  const vv=[.097,.202,.334][j],zz=1.318-j*.425,l=2.43-j*.13,d=j===2?.68:.462;
  B('deck',cx,vv-.037,zz,l,.076,d,0x8c684b,'x',.095);
  B('deck',cx,vv-.084,zz+d*.42,l-.025,.125,.043,0x695041,'x',.078);
  B('deck',cx,vv-.011,zz+d*.488,l+.035,.031,.048,0x987451,'x',.064);
 }
 B('deck',cx,.304,-.075,span+.30,.059,.684,0x735743,'x',.13);
 // Plain photographed stair rail, illustrated rather than as-built; darkened wood is not iron.
 const rx=cx+1.003;
 for(const [y,z,h]of [[.318,1.433,.578],[.591,.542,.575]]){
  B('portal-timber',rx,y,z,.047,h,.057,0x634937,'y',.08);
  B('portal-timber',rx,y+h*.49,z,.066,.030,.069,0x74604a);
 }
 const rail=vec(0,.284,-.921);
 batches['portal-timber'].box(vec(rx,.768,.984),vec(.061,0,0),vec(0,.025,-.095),rail,col(0x755747),'z',512);
 // Low Island sandstone where the register describes the material. Each piece has its own
 // broken silhouette, warping and bedding; render low contrast rather than a high-contrast brick grid.
 B('interior-shadow',0,.134,-.060,w,.271,.244,0x6e6150);B('masonry',5.059,.118,-.655,.148,.241,1.201,0x836f60,'z');
 for(let band=0;band<2;band++){
  let x=BOARDS[0]-.35*scalar(9,band),bandY=band===0?.007:.126,h=band===0?.129:.135;
  for(let st=0;x<BOARDS[1];st++){
   const k=band*331+st*23,w=.22+.42*scalar(k,88),a=Math.max(BOARDS[0],x+.0017),b=Math.min(BOARDS[1],x+w-.0027);
   if(b-a>.013){
    const g=.041*scalar(k,19)+.083,y0=bandY+(scalar(k,81)-.5)*.012,c=[0x8d7d71,0x8e7769,0x9a8371,0x827066,0x928774][Math.floor(scalar(k,41)*5)],t=h+.013*(scalar(k,73)-.5);
    const xcut=.013+.014*scalar(k,97),of=scalar(k,106),uv0:UV=[scalar(k,4),of],uv1:UV=[scalar(k,4)+(b-a)*.89,of+.29],
       a0=vec(a,y0+.018,g-.016),b0=vec(b,y0+.018,g-.012),a1=vec(a,y0+t-.016,g-.014),b1=vec(b,y0+t-.019,g-.019),
       p=vec(a+xcut,y0+.006+.004*scalar(k,49),g),q=vec(b-xcut,y0+.012+.006*scalar(k,39),g+.004),r=vec(b-xcut,y0+t-.013+.005*scalar(k,4),g+.009),s=vec(a+xcut,y0+t-.009-.005*scalar(k,2),g+.002),paint=col(c,.07,scalar(k,36));
    batches.masonry.quad(p,q,r,s,paint,uv0,uv1,[.84,.90,1,.97]);
    batches.masonry.quad(a0,p,s,a1,paint.clone().multiplyScalar(.94),uv0,uv1);
    batches.masonry.quad(q,b0,b1,r,paint.clone().multiplyScalar(.93),uv0,uv1);
    batches.masonry.quad(s,r,b1,a1,paint.clone().multiplyScalar(1.06),uv0,uv1);
   }
   x+=w;
  }
 }
 drawOrwellName((a,b,h,k)=>{
  const dy=b[1]-a[1],dx=b[0]-a[0],l=Math.hypot(dx,dy);if(l<1e-6)return;
  const x=-dy/l*h*.5,y=dx/l*h*.5,z=.1538;
  batches['painted-lettering'].quad(vec(a[0]-x,a[1]-y,z),vec(b[0]-x,b[1]-y,z),vec(b[0]+x,b[1]+y,z),vec(a[0]+x,a[1]+y,z),col(0x40362b,.07,scalar(k,19)));
 });
 const paints={
  paint:makeSurface('paint'),door:makeSurface('door'),wood:makeSurface('wood'),stone:makeSurface('stone')
 };
 const group=new T.Group();group.name='Orwell Clarke storefront · normalized exterior study';
 for(const k of PARTS){
  const b=batches[k],geo=new T.BufferGeometry();
  if(!b.position.length)throw Error(`Empty partition: ${k}`);
  geo.setAttribute('position',new T.Float32BufferAttribute(b.position,3));geo.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(b.color,3));geo.computeVertexNormals();geo.computeBoundingSphere();
  const base={vertexColors:true,roughness:.90};
  const material=k==='glazing'?new T.MeshPhysicalMaterial({...base,roughness:.142,metalness:0,clearcoat:.82,clearcoatRoughness:.095,specularIntensity:1,ior:1.51,envMapIntensity:1.59})
   :k==='interior-shadow'||k==='painted-lettering'||k==='fasteners'
     ?new T.MeshStandardMaterial({...base,roughness:k==='fasteners'?.67:.9,metalness:k==='fasteners'?.15:0})
     :new T.MeshStandardMaterial({...base,...(k==='masonry'?paints.stone:k==='deck'?paints.wood:k==='portal-timber'?paints.door:paints.paint),normalScale:new T.Vector2(k==='masonry'?.77:k==='decorated-timber'?.20:.38,k==='masonry'?.72:.38)});
  const o=new T.Mesh(geo,material);o.name=k;o.castShadow=!(k==='painted-lettering'||k==='glazing');o.receiveShadow=true;group.add(o);
 }
 group.userData.panes=panes;group.userData.claim='normalized positive exterior observations, not measured placement';return group;
}
