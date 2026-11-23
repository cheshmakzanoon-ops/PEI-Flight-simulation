import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {project} from '../sim/geo.ts';
import {BASIN_FOOTBRIDGE as DATA} from './basin-footbridge.generated.ts';

const projected=DATA.frameLonLat.map(([lon,lat])=>project(lon,lat));
const originX=(projected[0].x+projected[1].x)*.5,originZ=(projected[0].z+projected[1].z)*.5;
const [a,b,leftA,leftB]=projected.map(({x,z})=>new THREE.Vector2(x-originX,z-originZ));
const gap=DATA.spanS[1]-DATA.spanS[0];
const frame=(s:number,w:number)=>{
 const u=s/DATA.sourceLength;
 return a.clone().lerp(b,u).lerp(leftA.clone().lerp(leftB,u),w);
};
export const bridgeTrack=(s:number)=>DATA.axisCentre+(s-DATA.trackStation)*DATA.trackSlope;
export function bridgeDeckY(s:number,w:number){
 const t=(s-DATA.polynomialS0)/DATA.polynomialDivisor,c=DATA.heightCoefficients;
 return ((((c[4]*t+c[3])*t+c[2])*t+c[1])*t+c[0])+w*c[5];
}
const anchor=(s:number,d:number,y:number)=>{
 const w=bridgeTrack(s)+d,p=frame(s,w);
 return new THREE.Vector3(p.x,bridgeDeckY(s,w)+y,p.y);
};

/** Deck grade uses the native survey. Rail proportions, finish and visible
 * joinery follow dated reference character, not current as-built dimensions. */
export function createBasinFootbridge(ground:(x:number,z:number)=>number,land:(x:number,z:number)=>boolean){
 const bounds=DATA.spanS,span=DATA.halfDeckWidth;
 const endSeats=[
   {from:bounds[0]-.90,to:bounds[0]+.028,terminal:bounds[0]},
   {from:bounds[1]-.028,to:bounds[1]+.83,terminal:bounds[1]},
 ];
 // Leave this optional landmark out rather than inventing a footing over
 // a failed or incompatible basin patch. Check the entire two dry caps.
 for(const e of endSeats)for(let i=0;i<=9;i++)for(let j=0;j<=12;j++){
  const s=e.from+(e.to-e.from)*i/9,d=(2*j/12-1)*span;
  const p=anchor(s,d,0),base=ground(originX+p.x,originZ+p.z);
  if(!land(originX+p.x,originZ+p.z)||!Number.isFinite(base)||base>p.y+.16||base<p.y-1.65)return;
 }
 const group=new THREE.Group();
 group.name='Basin Head park footbridge (survey-era exterior)';
 group.position.set(originX,0,originZ);
 const plank:THREE.BufferGeometry[]=[],truss:THREE.BufferGeometry[]=[],shoe:THREE.BufferGeometry[]=[],footing:THREE.BufferGeometry[]=[];
 const xAxis=new THREE.Vector3(1,0,0),temp=new THREE.Vector3();
 const dark=new THREE.Color(0x414644),wood=new THREE.Color(0x796f5d),joint=new THREE.Color(0x333638);
 function bar(list:THREE.BufferGeometry[],p:THREE.Vector3,q:THREE.Vector3,w:number,h:number,c:THREE.Color,shade=1){
  const dir=temp.subVectors(q,p),d=dir.length();if(d<1e-5)throw Error('Invalid footbridge member');
  const g=new THREE.BoxGeometry(d,h,w),r=new THREE.Quaternion().setFromUnitVectors(xAxis,dir.normalize());
  g.applyQuaternion(r);g.translate((p.x+q.x)*.5,(p.y+q.y)*.5,(p.z+q.z)*.5);
  const count=g.getAttribute('position').count,pcol=new Float32Array(count*3);
  for(let i=0;i<count;i++){pcol[i*3]=c.r*shade;pcol[i*3+1]=c.g*shade;pcol[i*3+2]=c.b*shade;}
  g.setAttribute('color',new THREE.BufferAttribute(pcol,3));list.push(g);
 }
 const x0=DATA.spanS[0],x1=DATA.spanS[1];
 const boards=72;
 for(let i=0;i<boards;i++){
  const s=x0+(i+.5)*gap/boards;
  const variation=.84+.27*(.5+.5*Math.sin(i*1.713+.42));
  bar(plank,anchor(s,-span,-.031),anchor(s,span,-.031),gap/boards-.007,.062,wood,variation);
 }
 const panels=24;
 for(let i=0;i<panels;i++){
  const a=x0+i*gap/panels,b=x0+(i+1)*gap/panels;
  bar(truss,anchor(a,0,-.092),anchor(b,0,-.092),span*2-.07,.113,dark,.82);
  for(const side of [-1,1]){
   const rail=side*(span-.069);
   bar(truss,anchor(a,rail,-.11),anchor(b,rail,-.11),.122,.21,dark,.98);
   for(const [lift,w,h] of [[DATA.railHeight,.081,.079],[.64,.044,.048],[.31,.041,.047],[.125,.044,.050]])
    bar(truss,anchor(a,rail,lift),anchor(b,rail,lift),w,h,dark,lift>.8?1.16:.94);
  }
 }
 const bays=8;
 for(const side of [-1,1]){
  const rail=side*(span-.069);
  for(let i=0;i<=bays;i++){
   const s=x0+(i+.06)*gap/(bays+.12);
   bar(truss,anchor(s,rail,-.085),anchor(s,rail,DATA.railHeight+.045),.083,.082,dark,1.02);
   if(i<bays){
    const next=x0+(i+1.06)*gap/(bays+.12),down=side<0;
    bar(truss,anchor(s,rail,down?.78:.16),anchor(next,rail,down?.16:.78),.058,.063,dark,1.04);
   }
   const shade=.88+.26*(.5+.5*Math.sin(i*2.19+side*1.1));
   bar(shoe,anchor(s-.054,rail+side*.044,.18),anchor(s+.054,rail+side*.044,.18),.02,.10,joint,shade);
  }
 }
 // Original maritime boards inset to the measured wet/dry placement.
 // Bottoms sit just inside the actual rendered bank, not floating in air.
 const aged=new THREE.Color(0x777f69);
 for(const [k,e] of endSeats.entries()){
  for(let cell=0;cell<13;cell++){
   const a=-span+(cell+.04)*2*span/13,b=-span+(cell+.96)*2*span/13,d=(a+b)*.5;
   const h=anchor(e.terminal,d,0).y-.019;
   let embedded=h-.10;
   // A cross-falling bank can be lower at the seaward edge than the
   // midpoint. Sample the entire narrow piece, then sink below the floor.
   for(let j=0;j<=8;j++)for(let i=0;i<=4;i++){
    const v=anchor(e.from+(e.to-e.from)*j/8,a+(b-a)*i/4,0);
    embedded=Math.min(embedded,ground(originX+v.x,originZ+v.z)-.055);
   }
   const support=embedded;
   const p=anchor(e.from,d,0),q=anchor(e.to,d,0);
   p.y=q.y=.5*(h+support);
   const factor=.83+.27*(.5+.5*Math.sin(cell*2.43+k*2.11));
   bar(footing,p,q,b-a,h-support,aged,factor);
  }
 }
 const add=(p:THREE.BufferGeometry[],roughness:number,metalness:number,name:string)=>{
  const geometry=mergeGeometries(p);if(!geometry)throw Error('Footbridge geometry buffers mismatch');
  for(const g of p)g.dispose();
  const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness,metalness}));
  m.name=name;geometry.computeBoundingSphere();group.add(m);
 };
 add(plank,.84,0,'Survey-profile footbridge deck');
 add(truss,.75,.18,'Authored open rail and bracing');
 add(shoe,.67,.24,'Recessed rail connection plates');
 add(footing,.87,0,'Shore-seated approach caps');
 return group;
}
export function basinCrossingWorld(s:number,d:number){
 const p=anchor(s,d,0);return {x:originX+p.x,y:p.y,z:originZ+p.z};
}
