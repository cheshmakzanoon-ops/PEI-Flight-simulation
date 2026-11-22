import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { project } from '../sim/geo.ts';
import type { Terrain } from '../sim/terrain.ts';

/** Northern nave centroid and building identity from the 2020 NRCan footprint. */
const LON=-63.125295, LAT=46.233718;
const P = project(LON,LAT);

/** Replace only the surveyed main-building extrusion, not adjacent properties. */
export function replacesBasilicaFootprint(lon:number,lat:number) {
 return Math.abs(lon-LON)<.00012 && Math.abs(lat-LAT)<.00010;
}

/** Original visible exterior reconstruction; no floor plan or claim of exact masonry. */
export function addBasilica(scene:THREE.Scene,terrain:Terrain) {
 const g=new THREE.Group();g.name="St. Dunstan’s Basilica";
 g.position.set(P.x,terrain.elevation(P.x,P.z)+.10,P.z);
 g.rotation.y=-.827;scene.add(g);
 const stone=new THREE.MeshStandardMaterial({color:0x948579,roughness:.92});
 const limestone=new THREE.MeshStandardMaterial({color:0xb4a28a,roughness:.92});
 const glass=new THREE.MeshStandardMaterial({color:0x263b42,roughness:.68,metalness:.09});
 const roof=new THREE.MeshStandardMaterial({color:0x364951,roughness:.84});
 const doors=new THREE.MeshStandardMaterial({color:0x43312a,roughness:.88});
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
 const m=new THREE.Matrix4();
 function part(geom:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,ry=0,rx=0){
  const packed=geom.index?geom.toNonIndexed():geom;
  m.makeRotationFromEuler(new THREE.Euler(rx,ry,0,'YXZ'));m.setPosition(x,y,z);packed.applyMatrix4(m);
  packed.deleteAttribute('uv');
  const parts=batches.get(mat)??[];if(!batches.has(mat))batches.set(mat,parts);parts.push(packed);
 }
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat=stone,ry=0)=>part(new THREE.BoxGeometry(w,h,d),mat,x,y,z,ry);
 function gable(w:number,rise:number,length:number,x:number,y:number,z:number,ry=0) {
  const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,rise);s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:length,bevelEnabled:false});geo.translate(0,0,-length/2);
  part(geo,roof,x,y,z,ry);
 }
 function lancet(w:number,h:number,x:number,y:number,z:number,ry=0,mat=glass) {
  const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h*.58);
  s.quadraticCurveTo(w/2,h*.78,0,h);s.quadraticCurveTo(-w/2,h*.78,-w/2,h*.58);s.closePath();
  part(new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:false}),mat,x,y,z,ry);
 }
 function cap(x:number,z:number,bottom:number,width:number,high:number,mat=roof) {
  part(new THREE.ConeGeometry(width,high,4),mat,x,bottom+high/2,z,Math.PI/4);
 }
 // Cruciform body: raised central nave, aisles, transepts, and polygonal sanctuary.
 box(15,14,48,0,7,-1);
 box(7.0,8.5,31,-9.0,4.25,2);box(7.0,8.5,31,9.0,4.25,2);
 gable(15.5,10,48,0,14,-1);
 gable(7.2,3.0,31,-9,8.5,2);gable(7.2,3.0,31,9,8.5,2);
 box(29,13.2,11,0,6.6,-7.5);
 gable(11.6,8,30,0,13.2,-7.5,Math.PI/2);
 part(new THREE.CylinderGeometry(7,7,13,8),stone,0,6.5,-24,Math.PI/8);
 part(new THREE.ConeGeometry(7.3,7.8,8),roof,0,16.9,-24,Math.PI/8);
 for(const side of [-1,1]) {
  for(const z of [-19,-14,-7,0,6,12,17]){
   for(const [x,y,h] of [[12.51,2.3,4.4],[7.52,10.0,3.15]])
    lancet(1.25,h,x*side,y,z,side*Math.PI/2);
   box(.65,7,.6,12.6*side,3.5,z-1.7,limestone);
  }
  const x=6.0*side,z=21.15;
  box(7.5,28.5,7.2,x,14.25,z);
  for(const y of [4,11.3,18.4,24.6,28.6])box(8.0,.34,7.8,x,y,z,limestone);
  for(const u of [-1,1])for(const v of [-1,1]){
   const xx=x+u*3.25,zz=z+v*3.07;
   box(.72,26.7,.72,xx,13.35,zz,limestone);
   box(.83,2.65,.83,xx,29.86,zz,limestone);
   cap(xx,zz,31.1,.68,3.4);
  }
  for(const [rotate,dx,dz] of [[0,0,3.67],[Math.PI,0,-3.67],[Math.PI/2,3.8,0],[-Math.PI/2,-3.8,0]])
   for(const off of [-1,1])lancet(1.12,4.6,x+dx+Math.cos(rotate)*off*1.08,20.3,z+dz-Math.sin(rotate)*off*1.08,rotate);
  cap(x,z,28.7,5.05,19.4);
  box(.13,2.0,.13,x,49.05,z,limestone);box(1.05,.14,.14,x,49.49,z,limestone);
 }
 box(12,15,2.6,0,7.5,23.1);
 gable(12.7,6.2,3.0,0,15,23.1);
 for(const x of [-3.8,0,3.8]){
  lancet(2.6,5.0,x,0.25,24.48,0,doors);
  for(const off of [-1,1])box(.28,3.8,.42,x+off*1.54,1.9,24.55,limestone);
  lancet(1.65,4.2,x,7.9,24.45);
 }
 for(const [r,w] of [[2.13,.17],[1.73,.09]]){
  part(new THREE.TorusGeometry(r,w,5,20),limestone,0,13.65,24.55);
 }
 part(new THREE.CircleGeometry(1.92,24),glass,0,13.65,24.47);
 box(.11,3.9,.12,0,13.65,24.57,limestone);
 box(3.9,.11,.12,0,13.65,24.57,limestone);
 for(const [mat,items] of batches){
  const mesh=new THREE.Mesh(mergeGeometries(items),mat);g.add(mesh);
  items.forEach(item=>item.dispose());
 }
 return g;
}
