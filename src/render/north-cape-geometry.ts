import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Only these two overall dimensions are asserted by the station database.
// Component cross-sections, paint, fairing and assembly details are original artwork.
export const NORTH_CAPE_HUB_M=50,NORTH_CAPE_ROTOR_M=47;
export const NORTH_CAPE_ROTOR_OFFSET=2.77;
const W=0xe7e6df,TOP=0xf0eee5,BOTTOM=0xb8bbba,STEEL=0x636b6e,CONCRETE=0x99958b;
function paint(g:T.BufferGeometry,tone:number,rough=.81){
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),c:T.Color=new T.Color(tone);
 const info=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){
  const h=n.getY(i),m=rough+(1-rough)*(.57+.43*h);
  info.set([c.r*m,c.g*m,c.b*m],i*3);
 }
 g.setAttribute('color',new T.BufferAttribute(info,3));g.deleteAttribute('uv');return g;
}
function mconcat(a:T.BufferGeometry[]){
 const parts=a.map(g=>g.index?g.toNonIndexed():g);
 const m=mergeGeometries(parts);a.forEach(g=>g.dispose());parts.forEach(g=>g.dispose());
 m.computeBoundingSphere();return m;
}
// Lathed ovals with gently tapered faces avoid a box-and-stick turbine.
const drum=(profile:number[][],segments:number,sy=1,sz=1)=>new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),segments).rotateZ(-Math.PI*.5).scale(1,sy,sz);
function fairing(segments:number){
 return drum([[0,-2.34],[.52,-2.34],[.87,-2.13],[1.02,-1.71],[1.15,-.48],[1.15,1.12],[1.04,1.92],[.84,2.43],[0,2.48]],segments,.84,1.04);
}
const palette=[0xe9e8e0,0xddded7,0xe3e4de];
// Radial positions / local chord / sweep / thickness, all original.
// The tip is 23.5 m from the axis; stations follow a winding, tapered blade.
const profile=[
 [ .73,.45,.03,.16],[1.51,.63,.02,.24],[2.72,1.09,.02,.31],
 [4.10,1.55,-.02,.36],[6.75,1.69,-.06,.32],[9.8,1.46,-.15,.25],
 [13.4,1.16,-.25,.18],[16.6,.94,-.38,.13],[19.1,.76,-.57,.10],
 [21.35,.51,-.79,.075],[22.8,.36,-.97,.060],[23.4,.18,-1.12,.034],[23.5,.015,-1.16,.012],
];
function blade(far:boolean){
 const stations=far?profile.filter((_,i)=>i%2===0):profile,segments=far?6:10;
 const P:number[]=[],I:number[]=[];
 for(const [radius,chord,sweep,thick] of stations){
  const twist=.06+.43*Math.pow(1-radius/23.5,2);
  for(let i=0;i<segments;i++){
   const t=i/segments*Math.PI*2,v=Math.cos(t),w=Math.sin(t);
   const c=chord*(.48*v-.12),th=thick*(.52+.22*v)*w;
   const z=sweep+c*Math.cos(twist)-th*Math.sin(twist);
   const y=Math.min(radius,Math.sqrt((NORTH_CAPE_ROTOR_M*.5)**2-z*z));
   P.push(.022*radius+c*Math.sin(twist)+th*Math.cos(twist),y,z);
  }
 }
 for(let j=0;j<stations.length-1;j++)for(let i=0;i<segments;i++){
  const k=j*segments+i,n=j*segments+(i+1)%segments,a=k+segments,b=n+segments;
  I.push(k,n,a,n,b,a);
 }
 for(let i=1;i<segments-1;i++){const k=(stations.length-1)*segments;I.push(0,i+1,i,k,k+i,k+i+1);}
 const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(P,3)).setIndex(I);
 g.computeVertexNormals();return g;
}
export function northCapeRotor(far:boolean){
 const sides=far?9:18;
 const hub=paint(drum([[0,-.58],[.62,-.57],[.73,-.34],[.72,.15],[.62,.48],[.35,.76],[0,.83]],sides,1,1),TOP,.87);
 const parts=[hub];
 for(let i=0;i<3;i++)parts.push(paint(blade(far).rotateX(i/3*Math.PI*2),palette[i],.91));
 return mconcat(parts);
}
export function northCapeMast(far:boolean){
 const sides=far?10:22,parts:T.BufferGeometry[]=[];
 // A below-grade socket avoids a light halo at the foot. No road/terrain edits.
 parts.push(paint(new T.CylinderGeometry(1.88,2.08,1.36,sides).translate(0,-.54,0),CONCRETE));
 const mast=new T.LatheGeometry([
  [0,-1.28],[1.65,-1.28],[1.65,.15],[1.62,1.7],[1.42,12],[1.25,26],
  [1.075,42],[1.015,48.8],[1.,49.26],[0,49.26],
 ].map(([r,y])=>new T.Vector2(r,y)),sides);
 parts.push(paint(mast,W,.92),paint(fairing(sides).translate(-.47,49.90,0),TOP,.88));
 const flange=paint(drum([[0,1.86],[.67,1.86],[.70,2.25],[.70,2.61],[0,2.64]],sides).translate(0,50,0),BOTTOM);
 parts.push(flange);
 if(!far){
  for(const [y,r] of [[.31,1.65],[13,1.408],[26.65,1.244],[48.54,1.019]]){
   parts.push(paint(new T.CylinderGeometry(r,r,.040,sides,1,true).translate(0,y,0),BOTTOM,.83));
  }
  // Inset-size access frame and nacelle radiator; not claims about specific doors or markings.
  parts.push(paint(new T.BoxGeometry(.070,2.05,.83).translate(-1.586,1.35,0),BOTTOM),
     paint(new T.BoxGeometry(.066,1.9,.67).translate(-1.62,1.35,0),W),
     paint(new T.BoxGeometry(.045,.145,.095).translate(-1.663,1.49,.20),STEEL));
  for(let i=0;i<4;i++)parts.push(paint(new T.BoxGeometry(.64,.038,.055).translate(-1.44,49.82+i*.086,.992),STEEL));
 }
 return mconcat(parts);
}
