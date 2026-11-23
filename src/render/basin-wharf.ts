import * as THREE from 'three';
import {project} from '../sim/geo.ts';
import {BASIN_WHARF_SECTIONS} from './basin-wharf.generated.ts';

type Point=readonly [x:number,y:number,z:number];
const subdivisions=BASIN_WHARF_SECTIONS.map(([station,height,a,b])=>({station,height,a:project(a[0],a[1]),b:project(b[0],b[1])}));
const origin=subdivisions[3].a;
// 12cm existing visible-ground convention plus 3.7cm model clearance.
export const BASIN_WHARF_RENDER_LIFT=.157;
const mix=(a:number,b:number,f:number)=>a+(b-a)*f;
const point=(r:typeof subdivisions[number],t:number,dy=0):Point=>[
  mix(r.a.x,r.b.x,t)-origin.x,r.height+BASIN_WHARF_RENDER_LIFT+dy,mix(r.a.z,r.b.z,t)-origin.z,
];
const between=(a:Point,b:Point,t:number):Point=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
const below=(a:Point,d:number):Point=>[a[0],a[1]-d,a[2]];
const above=(a:Point,d:number):Point=>[a[0],a[1]+d,a[2]];
const atY=(a:Point,y:number):Point=>[a[0],y,a[2]];

function timberMaterial(deck:boolean){
 const material=new THREE.MeshStandardMaterial({
  color:deck?0x91877a:0x635d48,roughness:deck?.85:.94,side:THREE.DoubleSide,
 });
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 wharfBoard; varying float wharfElevation;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nwharfBoard=uv; wharfElevation=position.y;');
  shader.fragmentShader='varying vec2 wharfBoard; varying float wharfElevation;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   vec2 grain=wharfBoard*${deck?'vec2(4.55,.44)':'vec2(5.55,.65)'};
   float width=clamp(fwidth(grain.x),.002,.38);
   float fade=1.-smoothstep(.09,.40,fwidth(grain.x));
   float seam=1.-smoothstep(.024,.055+width,abs(fract(grain.x)-.50));
   float slat=fract(sin(dot(floor(vec2(grain.x+.5,grain.y)),vec2(12.98,31.71)))*43758.54)-.5;
   float wear=sin(wharfBoard.x*.57+wharfBoard.y*1.44)*sin(wharfBoard.x*.11-wharfBoard.y*2.79);
   float fibers=(sin(wharfBoard.x*91.+sin(wharfBoard.y*2.7)*.22)+sin(wharfBoard.x*137.+wharfBoard.y*.37))*.014;
   float damp=1.-smoothstep(.18,.61,fract(grain.y));
   float weather=sin(wharfBoard.x*.14-wharfBoard.y*.21)*.015;
   float salt=1.-smoothstep(.52,1.38,wharfElevation);
   float seams=fade*seam;
   diffuseColor.rgb*=.99+wear*.042+weather+fade*(slat*.20-seam*.23+fibers)${deck?'':'-salt*.24-damp*.03'};
   ${deck?`
   float stick=floor(grain.x+.5);
   float crossBoard=abs(fract(wharfBoard.y*.39+fract(sin(stick*19.718)*13758.))-.5);
   float joins=(1.-smoothstep(.009,.020+fwidth(grain.y),crossBoard))*fade;
   diffuseColor.rgb*=1.-joins*.13;
   `:`
   vec3 wetPatina=vec3(.70,.84,.67);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*wetPatina,salt*.48);
   ` }
  `).replace('#include <normal_fragment_maps>',`
   #include <normal_fragment_maps>
   float wharfBump=(seams*.011-${deck?'joins*.008':'salt*.002'});
   vec3 wharfT1=dFdx(-vViewPosition),wharfT2=dFdy(-vViewPosition);
   vec3 wharfR1=cross(wharfT2,normal),wharfR2=cross(normal,wharfT1);
   float wharfDet=dot(wharfT1,wharfR1);
   if(abs(wharfDet)>1.e-9){
      vec3 wharfGrad=sign(wharfDet)*(dFdx(wharfBump)*wharfR1+dFdy(wharfBump)*wharfR2);
      normal=normalize(abs(wharfDet)*normal-wharfGrad);
   }
  `);
 };
 material.customProgramCacheKey=()=>'basin-wharf-v3-'+deck;
 return material;
}
function strip(material:THREE.Material,name:string){
 const positions:number[]=[],uv:number[]=[];
 const q=(a:Point,b:Point,c:Point,d:Point,u0:number,u1:number,v0:number,v1:number)=>{
  for(const [p,u,v] of [[a,u0,v0],[b,u1,v0],[c,u1,v1],[a,u0,v0],[c,u1,v1],[d,u0,v1]] as const){
   positions.push(...p);uv.push(u,v);
  }
 };
 const finish=()=>{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;return mesh;
 };
 return {q,finish};
}

/**
 * The outer crop is survey-backed. It leaves the inner wharf, newer groynes
 * and submerged construction alone. A supported finite shell, not collision.
 */
export function createBasinWharf(grade:(x:number,z:number)=>number,land:(x:number,z:number)=>boolean,waterLevel:number){
 const group=new THREE.Group();group.name='Basin Head outer wharf';group.position.set(origin.x,0,origin.z);
 const deck=strip(timberMaterial(true),'Basin wharf: weathered deck');
 const sub=strip(timberMaterial(false),'Basin wharf: closed plank retaining face');
 // Lower bound for artwork only; not measured below the water line.
 const bottom=(p:Point)=>{
  const x=origin.x+p[0],z=origin.z+p[2];
  const footprint=land(x,z)?grade(x,z)-.075:waterLevel-.27;
  return Math.min(p[1]-.225,Number.isFinite(footprint)?footprint:p[1]-.225);
 };
 const skin=(a:Point,b:Point,s0:number,s1:number,full:boolean,channel=false)=>{
  const pieces=Math.max(1,Math.ceil((s1-s0)/.8));
  for(let i=0;i<pieces;i++){
   const l=between(a,b,i/pieces),r=between(a,b,(i+1)/pieces);
   const u=mix(s0,s1,i/pieces),v=mix(s0,s1,(i+1)/pieces);
   const ly=channel?waterLevel-.27:full?bottom(l):l[1]-.225,ry=channel?waterLevel-.27:full?bottom(r):r[1]-.225;
   sub.q(l,r,atY(r,ry),atY(l,ly),u,v,l[1]-Math.max(ly,ry),0);
  }
 };
 for(let j=1;j<subdivisions.length;j++){
  const a=subdivisions[j-1],b=subdivisions[j],l=point(a,0),insideA=point(a,1),n=point(b,0),insideB=point(b,1);
  const wa=Math.hypot(l[0]-insideA[0],l[2]-insideA[2]),wb=Math.hypot(n[0]-insideB[0],n[2]-insideB[2]);
  // Original coping has finite thickness. Its outer float edge meets the
  // observed wet toe, within 16cm of the fitted vertical lip.
  const widA=wa+.155,widB=wb+.155,r=between(l,insideA,widA/wa),s=between(n,insideB,widB/wb);
  // Cross-station boards. Opposite side is just a small edge, not
  // a duplicated retaining structure drawn inland.
  deck.q(r,s,n,l,a.station,b.station,0,(widA+widB)/2);
  skin(r,s,a.station,b.station,true,true);
  skin(l,n,a.station,b.station,b.station<=12.6);
  // Back cut has no false end wall. At the surveyed outer exposed apron
  // the hardware is returned across the head, only as far as the crop.
  if(j===1)skin(l,r,0,widA,true);
  const inset=.022,p=between(l,r,1-inset),q=between(n,s,1-inset);
  sub.q(above(r,.041),above(s,.041),above(q,.041),above(p,.041),a.station,b.station,0,.12);
  sub.q(above(r,.041),above(s,.041),below(s,.13),below(r,.13),a.station,b.station,.26,0);
 }
 group.add(deck.finish(),sub.finish());
 return group;
}
