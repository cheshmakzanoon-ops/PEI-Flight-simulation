import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {project} from '../sim/geo.ts';
import {basilicaStoneStudy} from './basilica-original-stone.ts';
import {basilicaRoofStudy} from './basilica-original-roof.ts';
import type {Terrain} from '../sim/terrain.ts';

const site=project(-63.125295,46.233718);
export const BASILICA_ART_REFERENCE={x:site.x,z:site.z,yaw:Math.PI-.827,stockSummit:50.05} as const;
type Surface='stone'|'trim'|'slate'|'spire'|'copper'|'iron'|'glass'|'wood'|'recess';
type V3=[number,number,number];
type Opening={x:number,y:number,w:number,h:number,k?:number,kind:'glass'|'door'|'louvers'|'blind';mullions?:number};
const TAU=Math.PI*2;
const stoneColors:Record<Surface,[number,number,number]>={
 stone:[0x9f8771,.93,0],trim:[0xb7a186,.88,0],slate:[0x53505a,.79,.08],copper:[0x617f73,.73,.19],
 spire:[0x615d68,.75,.14],iron:[0x343736,.72,.16],glass:[0x536b76,.36,.13],wood:[0x3c302c,.89,.02],recess:[0x413c35,.95,0]
};
function plane(points:V3[],idx:number[]){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));
 g.setIndex(idx);g.computeVertexNormals();return g;
}
function path(w:number,h:number,spring:number,steps=7){
 const r=w*.5, y0=h*spring, rise=h-y0, q:T.Vector2[]=[new T.Vector2(-r,0),new T.Vector2(-r,y0)];
 for(let i=1;i<=steps;i++){const a=Math.PI*i/(3*steps);q.push(new T.Vector2(r-w*Math.cos(a),y0+rise*Math.sin(a)/Math.sin(Math.PI/3)));}
 for(let i=steps-1;i>=0;i--){const a=Math.PI*i/(3*steps);q.push(new T.Vector2(-r+w*Math.cos(a),y0+rise*Math.sin(a)/Math.sin(Math.PI/3)));}
 q.push(new T.Vector2(r,0));return q;
}
function loop(q:T.Vector2[],ox=0,oy=0){const p=new T.Path();q.forEach((v,i)=>{if(!i)p.moveTo(v.x+ox,v.y+oy);else p.lineTo(v.x+ox,v.y+oy);});p.closePath();return p;}
function shape(q:T.Vector2[]){const s=new T.Shape();q.forEach((v,i)=>{if(!i)s.moveTo(v.x,v.y);else s.lineTo(v.x,v.y);});s.closePath();return s;}
function extrusion(s:T.Shape,depth:number){return new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:4});}
const V=(x:number,y:number,z:number):V3=>[x,y,z];

/** Qualitative exterior study. Dimensions other than the retained *game* summit/root are original artistic choices.
 * No point-cloud fitting, historical height conversion, sampled image pixels, surveyed ground or copied architectural plan. */
export function addBasilicaExterior(scene:T.Scene, terrain:Pick<Terrain,'elevation'>,groundAt:(x:number,z:number)=>number){
 const g=new T.Group();g.name='St. Dunstan’s Basilica';g.position.set(site.x,terrain.elevation(site.x,site.z)+.10,site.z);
 g.rotation.y=BASILICA_ART_REFERENCE.yaw;
 const mats={} as Record<Surface,T.MeshStandardMaterial>;
 const blocks=new Map<Surface,{geo:T.BufferGeometry,scope:string}[]>();
 for(const key of Object.keys(stoneColors) as Surface[]){
  const [color,roughness,metalness]=stoneColors[key];
  const m=key==='stone'||key==='trim'?basilicaStoneStudy(key==='stone'?'sandstone':'dressing'):
   key==='slate'?basilicaRoofStudy('slate'):key==='spire'?basilicaRoofStudy('aged-sheet'):
   key==='copper'?basilicaRoofStudy('verdigris-cap'):new T.MeshStandardMaterial({color,roughness,metalness});
  if(key==='stone'||key==='trim')m.color.setHex(color);
  m.name='basilica-exterior:'+key;mats[key]=m;blocks.set(key,[]);
 }
 let scope='';const rot=new T.Quaternion(),euler=new T.Euler(),mat=new T.Matrix4(),pos=new T.Vector3(),unit=new T.Vector3(1,1,1);
 function part(geo:T.BufferGeometry,surf:Surface,x:number,y:number,z:number,ry=0,rx=0,rz=0){
  const p=geo.index?geo.toNonIndexed():geo;if(p!==geo)geo.dispose();
  if(!p.attributes.normal)p.computeVertexNormals();p.deleteAttribute('uv');
  rot.setFromEuler(euler.set(rx,ry,rz,'YXZ'));mat.compose(pos.set(x,y,z),rot,unit);p.applyMatrix4(mat);blocks.get(surf)!.push({geo:p,scope});
 }
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:Surface='stone',r=0)=>part(new T.BoxGeometry(w,h,d),m,x,y,z,r);
 // Geometry stays in the existing landmark’s local metric frame.
 function beam(a:V3,b:V3,r:number,surf:Surface,n=5){
  const aa=new T.Vector3(...a),bb=new T.Vector3(...b),dir=bb.clone().sub(aa),l=dir.length();if(l<.001)return;
  const mid=aa.add(bb).multiplyScalar(.5),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
  const p=new T.CylinderGeometry(r,r,l,n,1,false).toNonIndexed();p.deleteAttribute('uv');p.applyMatrix4(new T.Matrix4().compose(mid,q,unit));blocks.get(surf)!.push({geo:p,scope});
 }
 function placed(x:number,z:number,ry:number,u:number,y:number,off:number):V3{return [x+Math.cos(ry)*u+Math.sin(ry)*off,y,z-Math.sin(ry)*u+Math.cos(ry)*off];}
 function moulding(x:number,y:number,z:number,ry:number,w:number,h:number,k:number,border:number,depth:number,surf:Surface){
  // The two arched profiles leave a real recessed opening. The inner opening is never a flat decal.
  const outer=path(w+2*border,h+border*1.15,k),inner=path(w,h,k),pts:V3[]=[],ids:number[]=[];
  // The back of a trim strip faces only the underlying stone. Preserve the visible outer
  // bevel, narrow leading face and inner jamb, without submitting a second hidden back cap.
  for(let i=0;i<inner.length;i++){
   const o=outer[i],n=inner[i],bx=n.x*.27+o.x*.73,by=n.y*.27+(o.y-border*.1)*.73;
   pts.push(V(o.x,o.y-border*.1,0),V(bx,by,.84*depth),V(n.x,n.y,depth),V(n.x,n.y,-.025));
  }
  for(let i=0;i<inner.length;i++){const a=i*4,b=((i+1)%inner.length)*4;
   // Path winds clockwise viewed from +Z. Front/slope and inward-facing jamb only.
   for(let j=0;j<3;j++)ids.push(a+j,b+j+1,b+j,a+j,a+j+1,b+j+1);
  }
  part(plane(pts,ids),surf,x,y,z,ry);
 }
 function lightTrace(x:number,y:number,z:number,ry:number,curve:T.Vector2[],half:number){
  // A continuous shallow V-profile unlike separate capped cylinders; rays still see a real raised astragal.
  const pts:V3[]=[],ids:number[]=[];
  for(let i=0;i<curve.length;i++){
   const a=curve[Math.max(0,i-1)],b=curve[Math.min(curve.length-1,i+1)],d=b.clone().sub(a).normalize(),c=curve[i];
   pts.push(V(c.x-d.y*half,c.y+d.x*half,0),V(c.x,c.y,half*.95),V(c.x+d.y*half,c.y-d.x*half,0));
   if(i){const p=3*(i-1),j=p+3;ids.push(p,p+1,j,p+1,j+1,j,p+1,p+2,j+1,p+2,j+2,j+1);}
  }
  part(plane(pts,ids),'trim',x,y,z,ry);

 }
 function plate(x:number,z:number,ry:number,w:number,y0:number,top:number,peak:number,holes:Opening[],depth=.55){
  const q=[new T.Vector2(-w/2,y0),new T.Vector2(w/2,y0),new T.Vector2(w/2,top)];
  if(peak>top)q.push(new T.Vector2(0,peak));q.push(new T.Vector2(-w/2,top));
  const s=shape(q);for(const o of holes)s.holes.push(loop(path(o.w,o.h,o.k??.62),o.x,o.y));
  const at=placed(x,z,ry,0,0,-depth);part(extrusion(s,depth),'stone',...at,ry);
  for(const o of holes){
   const k=o.k??.62, at=(u:number,y:number,d:number)=>placed(x,z,ry,o.x+u,o.y+y,d);
   const d=(m:number)=>at(0,0,m), back=o.kind==='blind'?'recess':o.kind==='door'?'wood':o.kind==='louvers'?'recess':'glass';
   part(new T.ShapeGeometry(shape(path(o.w+.08,o.h+.04,k))),back,...d(-depth-.012),ry);
   const pOuter=d(-.015);moulding(...pOuter,ry,o.w,o.h,k,Math.max(.08,Math.min(.22,o.w*.085)),.19,'trim');
   if(o.w>=1.4)moulding(...d(-depth*.48),ry,o.w*.954,o.h*.984,k,.072,.11,'recess');
   if(o.kind==='glass'){
    const n=o.mullions??(o.w>2.8?3:o.w>1.1?2:1);
    for(let i=1;i<n;i++){const u=(i/n-.5)*o.w;beam(at(u,.08,-depth+.075),at(u,o.h*(k+.10),-depth+.075),o.w>=2?.048:.031,'trim',5);}
    if(o.w>1.25){
     beam(at(-o.w*.478,o.h*k*.48,-depth+.05),at(o.w*.478,o.h*k*.48,-depth+.05),.042,'iron',4);
     for(let i=0;i<n;i++){const u=(i+.5)/n*o.w-o.w/2;
      const ww=o.w/n,hh=o.h*.24;const curve=path(ww*.89,hh,.23,4).slice(1,-1);
      const pp=at(u,o.h*k-.12,-depth+.085);lightTrace(...pp,ry,curve,.045);
     }
    }
   }else if(o.kind==='door'){
    beam(at(0,.04,-depth+.04),at(0,o.h*.70,-depth+.04),.035,'iron',4);
    for(const u of [-.24,.24])for(const v of [.22,.50]){
     const pp=at(u*o.w,v*o.h,-depth+.035);box(o.w*.37,o.h*.22,.071,...pp,'wood',ry);
    }
   }else if(o.kind==='louvers'){
    for(let i=0;i<5;i++){const yy=.17+o.h*.122*i,pp=at(0,yy,-depth+.08);box(o.w*.93,.086,.15,...pp,'trim',ry);}
   }
  }
 }
 function prism(x:number,z:number,ring:number[][],base:number,top:number,roofPeak:number){
  const A=ring.map(([u,v])=>V(x+u,base,z+v)),B=ring.map(([u,v])=>V(x+u,top,z+v));
  const pts:V3[]=[],ii:number[]=[];
  for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length,k=pts.length;pts.push(A[i],A[j],B[j],B[i]);ii.push(k,k+1,k+2,k,k+2,k+3);}
  part(plane(pts,ii),'stone',0,0,0);
  const C=V(x,roofPeak,z),rp:V3[]=[],ri:number[]=[];
  for(let i=0;i<ring.length;i++){const k=rp.length;rp.push(B[i],B[(i+1)%ring.length],C);ri.push(k,k+1,k+2);}
  part(plane(rp,ri),'slate',0,0,0);
 }
 function roof(x:number,z:number,w:number,len:number,y:number,rise:number,ry=0){
  const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,rise);s.closePath();
  const gg=extrusion(s,len);gg.translate(0,0,-len/2);part(gg,'slate',x,y,z,ry);
 }
 function gableEdge(x:number,z:number,w:number,y:number,top:number,ry=0){
  const p=(a:number,b:number)=>placed(x,z,ry,a,b,.06);
  beam(p(-w/2,y),p(0,top),.14,'copper',5);beam(p(0,top),p(w/2,y),.14,'copper',5);
 }
 // Below-grade tails at relocated opaque vertical faces; do not displace terrain or alter any receiver.
 const foot=-2.0;
 const groundProbes: {localXZ:readonly[number,number],worldXZ:readonly[number,number],groundY:number}[]=[];
 const topGround=(u:number,v:number)=>{
  const ca=Math.cos(g.rotation.y),sa=Math.sin(g.rotation.y), x=site.x+ca*u+sa*v,z=site.z-sa*u+ca*v;
  const groundY=groundAt(x,z);
  if(!Number.isFinite(groundY))throw Error('Missing Basilica existing near-ground receiver');
  groundProbes.push({localXZ:[u,v],worldXZ:[x,z],groundY});return groundY-g.position.y;
 };
 const frontZ=23.80, landingZ=24.53, steps=6, tread=.44, width=13.12,lFront=landingZ+.60;
 // Fixed, symmetric entrance geometry; its lowest step is seated to the current game's
 // N112 land surface, never a historical stair datum. No ground or obstruction is moved.
 const toe=lFront+steps*tread;
 const toeGround=[-width*.5,0,width*.5].map(x=>topGround(x,toe));
 const landingY=Math.max(...toeGround)+.06+steps*.15;
 if(Math.max(...toeGround)-Math.min(...toeGround)>.28)throw Error('Unsupported Basilica entrance ground');
 g.userData.basilicaGroundWitness=groundProbes;g.userData.basilicaLandingY=g.position.y+landingY;
 scope='nave';const naveFront=23.0,naveRear=-17.6,naveLen=naveFront-naveRear;
 // Keep the eaves/ridge and original horizontal datum; expose a real clerestory above separate aisle roofs.
 for(const side of [-1,1]){
  const rotation=side*Math.PI/2;const z=(naveRear+naveFront)/2;
  const hs:Opening[]=[-11,-6,-1,4,9,14,19].map(zz=>({x:(z-zz)*side,y:10.9,w:1.44,h:2.56,kind:'glass',mullions:2}));
  plate(7.5*side,z,rotation,naveLen,foot,14,14,hs,.44);
 }
 roof(0,(naveFront+naveRear)/2,15.45,naveLen+.24,14,10);
 scope='aisles';
 for(const side of [-1,1]){
  const z=2.75,len=29.5,ang=side*Math.PI/2,x=12.36*side;
  const hs:Opening[]=[-8,-2,4,10,15.4].map(zz=>({x:(z-zz)*side,y:2.4,w:1.56,h:4.15,kind:'glass',mullions:2}));
  plate(x,z,ang,len,foot,8.15,8.15,hs);
  for(const zz of [-11.7,-5.2,.9,7,13,17]){box(.57,8.15,1.04,side*12.41,3.8,zz,'stone');box(.75,.24,1.16,side*12.42,7.9,zz,'trim');}
  // Sloping single aisle roof meets the nave, rather than intersecting a row of duplicate gables.
  const s=new T.Shape();s.moveTo(-2.6,0);s.lineTo(2.6,0);s.lineTo(-2.6*side,3.0);s.closePath();
  const a=extrusion(s,len+.2);a.translate(0,0,-(len+.2)/2);part(a,'slate',side*9.96,8.15,z);
  for(const zz of [z-len/2,z+len/2])box(4.8,8.15-foot,.44,side*9.9,(8.15+foot)/2,zz);
 }
 scope='transepts';const crossZ=-6.6;
 for(const side of [-1,1]){
  const ang=side*Math.PI/2,x=side*13.65;
  plate(x,crossZ,ang,10.5,foot,13.1,20.2,[{x:0,y:6.45,w:3.5,h:6.45,kind:'glass',mullions:3}],.5);
  gableEdge(x,crossZ,10.7,13.22,20.42,ang);
  for(const dz of [-1,1])box(6.34,13.1-foot,.45,side*10.5,(13.1+foot)/2,crossZ+dz*5.23);
 }
 roof(0,crossZ,10.9,27.5,13.1,7.4,Math.PI/2);
 scope='western-sanctuary';
 // The apse is connected to the *back* of the nave and terminates inside the original occupied
 // western limit. A rigid whole-model half turn would run into a separately retained AEB building.
 const rr:number[][]=[];const rx=7.05,rz=6.05;
 for(let i=0;i<8;i++){const a=(Math.PI/8)+i*TAU/8;rr.push([rx*Math.sin(a),rz*Math.cos(a)]);}
 // Increasing sine/cosine parameter winds clockwise in XZ: upward faces are front-facing.
 prism(0,-17.95,rr,foot,13.1,21.2);
 for(const side of [-1,1]){
  const ang=side*Math.PI/2;plate(side*8.80,-18.15,ang,8.1,foot,7.3,7.3,
    [{x:-1.85,y:2.1,w:1.05,h:2.6,kind:'glass'},{x:1.85,y:2.1,w:1.05,h:2.6,kind:'glass'}],.38);
  box(3.8,7.3-foot,.4,side*6.95,(7.3+foot)/2,-22.0);roof(side*6.95,-18,4.25,8.35,7.3,1.65);
 }
 scope='crossing-lantern';
 part(new T.CylinderGeometry(1.45,2.06,1.3,8), 'slate',0,24.0,crossZ);
 part(new T.CylinderGeometry(.94,1.13,1.72,8), 'trim',0,25.28,crossZ);
 part(new T.ConeGeometry(1.32,4.35,8),'copper',0,28.18,crossZ);
 box(.10,.78,.10,0,30.52,crossZ,'iron');
 scope='east-front';
 // Three separate openings, deep reveals and tall central pointed tracery. A circular rose is
 // associated with the western altar; it is not copied to this Great George entrance.
 plate(0,frontZ,0,10.35,foot,16.5,22.6,[
  {x:-3.02,y:landingY,w:1.57,h:3.48,k:.64,kind:'door'},{x:0,y:landingY,w:2.03,h:4.15,k:.60,kind:'door'},
  {x:3.02,y:landingY,w:1.57,h:3.48,k:.64,kind:'door'},{x:0,y:8.0,w:3.62,h:8.1,k:.65,kind:'glass',mullions:3},
  {x:-3.57,y:8.4,w:1.15,h:4.75,k:.66,kind:'glass',mullions:1},{x:3.57,y:8.4,w:1.15,h:4.75,k:.66,kind:'glass',mullions:1},
  {x:0,y:17.7,w:1.17,h:2.07,kind:'blind'}],.78);
 // Place planar filled panels *only* in the narrow thickness between the central narthex and nave,
 // leaving the three carved door voids optically open.
 for(const side of [-1,1])box(.38,16.4-foot,1.09,side*5.05,(16.4+foot)/2,23.28);
 gableEdge(0,frontZ,10.65,16.58,22.92);
 for(const ux of [-4.95,-2.10,2.10,4.95]){
  box(.46,15.65,.62,ux,7.77,frontZ+.12,'stone');box(.65,.26,.79,ux,6.24,frontZ+.14,'trim');
 }
 box(9.80,.28,.48,0,6.4,frontZ+.05,'trim');
 beam(V(0,22.56,frontZ+.06),V(0,23.86,frontZ+.06),.095,'iron');
 beam(V(-.41,23.42,frontZ+.06),V(.41,23.42,frontZ+.06),.083,'iron');
 const towerZ=20.48, towerX=7.49, baseW=6.0, baseD=6.86;
 for(const side of [-1,1]){
  scope=side<0?'east-left-tower':'east-right-tower';
  const x=side*towerX;const front=towerZ+baseD/2;
  const rows:Opening[]=[{x:0,y:8.1,w:3.05,h:7.9,k:.67,kind:'glass',mullions:3}];
  for(const uu of [-1.32,0,1.32])rows.push({x:uu,y:2.65,w:.90,h:3.22,kind:'glass',mullions:1});
  plate(x,front,0,baseW,foot,17.1,21.05,rows,.70);
  gableEdge(x,front,baseW+.26,17.12,21.18);
  plate(x,towerZ-baseD/2,Math.PI,baseW,foot,18.5,18.5, [{x:0,y:11.0,w:1.65,h:4.45,kind:'glass'}],.45);
  for(const s of [-1,1]){
   plate(x+s*baseW/2,towerZ,s*Math.PI/2,baseD,foot,18.85,18.85,
     [{x:-1.47,y:9.35,w:1.56,h:4.86,kind:'glass'},{x:1.47,y:9.35,w:1.56,h:4.86,kind:'glass'}],.55);
  }
  part(new T.CylinderGeometry(2.55,3.30,2.7,8,1,false,Math.PI/8),'stone',x,19.2,towerZ);
  // Octagonal lantern and bell register. Each opening is a physical cut and a backplane
  // for glass or five slats; rotating them leaves negative space rather than a black sticker.
  const r=2.58,faceD=r*Math.cos(Math.PI/8),fw=2*r*Math.sin(Math.PI/8);
  for(let a=0;a<8;a++){
   const ang=a*Math.PI/4,px=x+Math.sin(ang)*faceD,pz=towerZ+Math.cos(ang)*faceD;
   plate(px,pz,ang,fw+.012,20.2,26.75,26.75,[{x:0,y:21.05,w:fw*.64,h:4.52,kind:'glass',mullions:2}],.31);
   plate(px,pz,ang,fw+.012,26.73,30.34,31.04,[{x:0,y:27.16,w:fw*.60,h:2.50,k:.63,kind:'louvers'}],.30);
  }
  for(const [yy,radius,h] of [[20.48,2.74,.30],[26.80,2.70,.27],[30.35,2.72,.27]])
   part(new T.CylinderGeometry(radius,radius+.04,h,8,1,false,Math.PI/8),'trim',x,yy,towerZ);
  // Distinct upper copper-clad facets, dark/weathered in the selected references rather than
  // a uniformly polished green cone. Footprint and summit are original modelling conventions.
  part(new T.CylinderGeometry(1.18,2.52,11.35,8,1,false,Math.PI/8),'spire',x,36.17,towerZ);
  part(new T.ConeGeometry(1.185,6.44,8,1,false,Math.PI/8),'spire',x,45.055,towerZ);
  for(let n=0;n<8;n++){
   const ang=Math.PI/8+n*TAU/8,dx=Math.sin(ang),dz=Math.cos(ang);
   beam(V(x+dx*2.52,30.54,towerZ+dz*2.52),V(x+dx*1.18,41.84,towerZ+dz*1.18),.035,'iron',4);
  }
  for(const a of [-1,1])for(const b of [-1,1]){
   const px=x+a*(baseW/2-.16),pz=towerZ+b*(baseD/2-.19);
   box(.55,18.8-foot,.70,px,(18.8+foot)/2,pz,'trim');
   box(.72,.28,.83,px,6.3,pz,'trim');box(.62,.25,.76,px,16.2,pz,'trim');
   part(new T.ConeGeometry(.51,3.28,4,1,false,Math.PI/4),'stone',px,20.34,pz);
   box(.34,1.85,.36,px,22.62,pz,'trim');part(new T.ConeGeometry(.40,2.62,4,1,false,Math.PI/4),'slate',px,24.79,pz);
  }
  // Existing game tip height and cross pieces; historic terminology conflicts, no survey or new tip assertion.
  box(.13,2,.13,x,49.05,towerZ,'trim');box(1.05,.14,.14,x,49.49,towerZ,'trim');
 }
 scope='east-steps';
 // A compact original stair flight, not a copy of an architectural plan or a public sidewalk.
 // Parent QA will test against submitted local terrain; no collision change or nav claim.

 box(width,landingY-foot,1.66,0,(landingY+foot)/2,landingZ-.23,'trim');
 for(let i=0;i<steps;i++){const yy=landingY-(i+1)*.15,zz=lFront+(i+.5)*tread;
  box(width,yy-foot,tread+.004,0,(yy+foot)/2,zz,'stone');
  box(width+.05,.065,.096,0,yy-.025,zz+tread*.5-.023,'trim');
 }
 for(const x of [-6.11,-2.82,2.82,6.11]){
  const lower=lFront+steps*tread-.09;
  for(const j of [0,steps/2,steps]){const zz=lFront+j*tread-.08,hh=landingY-j*.15;
   beam(V(x,hh-.03,zz),V(x,hh+.92,zz),.046,'iron',6);}
  beam(V(x,landingY+.93,lFront-.41),V(x,landingY+.93,lFront-.08),.057,'iron',6);
  beam(V(x,landingY+.93,lFront-.08),V(x,landingY+.03,lower),.057,'iron',6);
 }
 for(const [name,items] of blocks){
  if(!items.length)continue;
  const joined=mergeGeometries(items.map(b=>b.geo),false);
  if(!joined)throw Error('Basilica exterior: incompatible original mesh attributes');
  const ranges:{role:string,first:number,count:number}[]=[];let offset=0;
  for(const b of items){const n=b.geo.getAttribute('position').count/3,prev=ranges.at(-1);
   if(prev&&prev.role===b.scope)prev.count+=n;else ranges.push({role:b.scope,first:offset,count:n});
   offset+=n;b.geo.dispose();
  }
  joined.userData.basilicaRoles=ranges;
  const mesh=new T.Mesh(joined,mats[name]);mesh.name='Basilica exterior · '+name;g.add(mesh);
 }
 g.userData.basilicaAppearance='qualitative exterior';scene.add(g);return g;
}
