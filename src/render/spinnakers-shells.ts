import * as THREE from 'three';
import {SPINNAKERS_SHELLS as spec} from './spinnakers-shells.generated.ts';
import {SPINNAKERS_DECK} from './spinnakers-deck.generated.ts';
import {project} from '../sim/geo.ts';

export type WharfCoordinate=readonly [number,number];
type Point=WharfCoordinate;
type Plane=readonly [number,number,number];
type Tri=readonly [Point,Point,Point];
export type WharfFeature={footprint:readonly Point[];holes?:readonly(readonly Point[])[];height:number};
export const SPINNAKERS_TILE=spec.tile;
export const SPINNAKERS_ATLAS=spec.atlas;
export const SPINNAKERS_OMISSIONS:ReadonlySet<number>=new Set(spec.old.map(f=>f.ordinal));
export function matchesSpinnakersShells(hash:string|undefined,tile:string,rows:readonly WharfFeature[]){
 return hash===spec.atlas&&tile===spec.tile&&spec.old.every(old=>{
  const f=rows[old.ordinal];
  return f?.height===old.height&&!f.holes?.length&&f.footprint.length===old.footprint.length&&
     old.footprint.every(([lon,lat],i)=>lon===f.footprint[i][0]&&lat===f.footprint[i][1]);
 });
}
export type WharfSurface=(x:number,z:number)=>number|undefined;
const base=project(...SPINNAKERS_DECK.anchor);
const join=(a:Point,b:Point,t:number):Point=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const evaluate=(p:Plane,q:Point)=>p[0]+p[1]*q[0]+p[2]*q[1];
const minus=(a:Plane,b:Plane):Plane=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
function contains(r:readonly Point[],[x,z]:Point){
 let hit=false;
 for(let i=0,j=r.length-1;i<r.length;j=i++){
  const [a,b]=r[j],[c,d]=r[i];
  if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)hit=!hit;
 }
 return hit;
}
function clip(poly:readonly Point[],phi:Plane){
 const out:Point[]=[];
 let a=poly[poly.length-1],u=evaluate(phi,a);
 for(const b of poly){
  const v=evaluate(phi,b);
  if((v>=0)!==(u>=0)&&Math.abs(u-v)>1e-14)out.push(join(a,b,u/(u-v)));
  if(v>=0)out.push(b);
  a=b;u=v;
 }
 return out;
}
type Face={corners:Point[];plane:Plane;clippers:Plane[]};
function roofFaces(r:readonly Point[],bounds:readonly (readonly Plane[])[]){
 const t=THREE.ShapeUtils.triangulateShape(r.map(([x,z])=>new THREE.Vector2(x,z)),[]).map(idx=>idx.map(i=>r[i]) as unknown as Tri);
 const visit=([face,...rem]:Face[],tri:Tri,choices:readonly Plane[],limits:readonly Plane[]):Face[]=>{
  if(!face)return choices.flatMap((p,i)=>{
   const clips=[...limits,...choices.filter((_,j)=>j!==i).map(q=>minus(p,q))];
   let corners:readonly Point[]=tri;
   for(const c of clips){corners=clip(corners,c);if(corners.length<3)return [];}
   return [{corners:[...corners],plane:p,clippers:clips}];
  });
  // Choose one active lower plane per gable and retain their common support.
  return visit(rem,tri,[...choices,face.plane],[...limits,...face.clippers]);
 };
 const Cartesian:(at:number,terms:readonly Face[])=>readonly (readonly Face[])[]=(at,terms)=>
  at===bounds.length?[terms]:bounds[at].flatMap((plane,i)=>Cartesian(at+1,[
   ...terms,{corners:[],plane,clippers:bounds[at].filter((_,j)=>j!==i).map(other=>minus(other,plane))}
  ]));
 const groups=Cartesian(0,[]);
 return t.flatMap(tri=>groups.flatMap(group=>visit([...group],tri,[],[])));
}
function siding(roof:boolean){
 const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:roof?.95:.86,metalness:0,side:THREE.DoubleSide});
 mat.customProgramCacheKey=()=>roof?'spinnakers-worn-shingles-v1':'spinnakers-bevel-painted-wood-v1';
 mat.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   varying vec2 vBoard;varying vec3 vLocal;`).replace('#include <begin_vertex>',`#include <begin_vertex>
   vBoard=uv;vLocal=position;`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec2 vBoard;varying vec3 vLocal;
   float patchHash(vec2 p){
    vec3 h=fract(vec3(p.xyx)*vec3(.1031,.1035,.1137));h+=dot(h,h.yzx+19.19);
    return fract((h.x+h.y)*h.z);
   }
   float patchNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(patchHash(i),patchHash(i+vec2(1.,0.)),f.x),mix(patchHash(i+vec2(0.,1.)),patchHash(i+1.),f.x),f.y);
   }`).replace('#include <color_fragment>',`#include <color_fragment>
   float d=max(length(dFdx(vLocal)),length(dFdy(vLocal)));
   float f=1.-smoothstep(.016,.175,d);
   ${roof?`
    vec2 r=vec2(vBoard.x/.288,vBoard.y/.143);
    float row=floor(r.y),u=r.x+.5*mod(row,2.);
    float sh=patchHash(vec2(floor(u),row));
    float wide=patchNoise(vLocal.xz*vec2(.49,.47))*2.-1.;
    float courses=1.-smoothstep(.035,.12+fwidth(r.y),fract(r.y));
    float stagger=(1.-smoothstep(.027,.075+fwidth(u),fract(u)))*.051;
    float grit=(patchNoise(vLocal.xz*67.)-.5)*.10;
    diffuseColor.rgb*=1.+.19*wide+f*((sh-.5)*.25-.10*courses-stagger+grit);
   `:`
    float q=vBoard.y/.141,g=fract(q),end=1.-smoothstep(.075,.15+fwidth(q)*.8,g);
    float layer=patchHash(vec2(floor(q),floor((vBoard.x+1.37*sin(floor(q)))/2.96)));
    float peel=patchNoise(vec2(vBoard.x*1.4,vBoard.y*4.7));
    float wood=patchNoise(vec2(vBoard.x*2.8,vBoard.y*112.));
    float fade=.96+.095*patchNoise(vLocal.xz*.39);
    diffuseColor.rgb*=fade+f*(.105*(layer-.5)+.10*(peel-.5)+.065*(wood-.5)-end*.23);
    diffuseColor.rgb*=.93+.07*smoothstep(1.99,3.8,vLocal.y);
   `}`);
 };
 return mat;
}
type Vertex=readonly [number,number,number];
type UV=readonly [number,number];
class Batch {
 readonly p:number[]=[];readonly u:number[]=[];readonly c:number[]=[];
 tri(a:Vertex,b:Vertex,c:Vertex,tint:THREE.Color,U:UV=[0,0],V:UV=[0,0],W:UV=[0,0]){
  this.p.push(...a,...b,...c);this.c.push(tint.r,tint.g,tint.b,tint.r,tint.g,tint.b,tint.r,tint.g,tint.b);
  this.u.push(...U,...V,...W);
 }
 strip(a:Vertex,b:Vertex,c:Vertex,d:Vertex,tint:THREE.Color,uv?:readonly [UV,UV,UV,UV]){
  this.tri(a,b,c,tint,uv?.[0],uv?.[1],uv?.[2]);this.tri(a,c,d,tint,uv?.[0],uv?.[2],uv?.[3]);
 }
 mesh(material:THREE.Material,name:string){
  if(!this.p.length)return undefined;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));
  g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.Mesh(g,material);m.name=name;return m;
 }
}
const panel=(q:Point,y:number):Vertex=>[q[0],y,q[1]];
const makeMat=(roughness:number,metalness=0,env=1)=>new THREE.MeshStandardMaterial({
 vertexColors:true,roughness,metalness,envMapIntensity:env,side:THREE.DoubleSide});
export function buildSpinnakersShells(seat:WharfSurface){
 const out=new THREE.Group();out.position.set(base.x,0,base.z);
 out.name='Spinnakers’ Landing seven independent measured roof shells';
 const caps=new Batch(),clad=new Batch(),edge=new Batch(),reveal=new Batch(),glazing=new Batch();
 const cream=new THREE.Color(0xb1aa94),header=new THREE.Color(0xc4baa1),inside=new THREE.Color(0x544737),
  window=new THREE.Color(0x3a4548),blueglass=new THREE.Color(0x4a565d),under=new THREE.Color(0x6e665a),
  burnt=new THREE.Color(0x433f32);
 for(const m of spec.models){
  const r=m.ring as unknown as readonly Point[],surfaces=m.surfaces as unknown as readonly(readonly Plane[])[];
  const paint=new THREE.Color(m.paint),matRoof=new THREE.Color(m.roof).lerp(new THREE.Color(0x786f67),.43);
  const rY=(q:Point)=>Math.max(...surfaces.map(g=>Math.min(...g.map(p=>evaluate(p,q)))));
  const area=r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0);
  const sg=Math.sign(area);
  const sc=sg*.975;
  for(const f of roofFaces(r,surfaces)){
   const g=f.corners;
   for(let i=1;i+1<g.length;i++){
    let point=[g[0],g[i],g[i+1]] as [Point,Point,Point];
    const c=cross(...point);if(Math.abs(c)<1e-8)continue;
    if(c>0)point=[point[0],point[2],point[1]];
    const [a,b,e]=point.map(q=>panel(q,evaluate(f.plane,q)));
    const uv=point.map(q=>[q[0]*.966-q[1]*.258,q[0]*.258+q[1]*.966] as UV);
    caps.tri(a,b,e,matRoof,...uv as [UV,UV,UV]);
    edge.tri([a[0],a[1]-.13,a[2]],[e[0],e[1]-.13,e[2]],[b[0],b[1]-.13,b[2]],under);
   }
  }
  for(let i=0;i<r.length;i++){
   const a=r[i],b=r[(i+1)%r.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   if(len<.008)continue;
   const nx=sc*dz/len,nz=-sc*dx/len;
   const Q=(u:number,off=0):Point=>[a[0]+u*dx/len+nx*off,a[1]+u*dz/len+nz*off];
   const S=(q:Point):number=>{
    // Wall reaches the surveyed surface; the authored seam tucks 4 cm below it.
    const h=seat(q[0],q[1]);if(h===undefined)throw Error('Wharf building footprint is not seated on the measured deck');
    return h-.04;
   };
   const offS=Q(len*.5,.31);
   const shared=spec.models.some(o=>o.way!==m.way&&contains(o.ring as unknown as readonly Point[],offS));
   function facade(batch:Batch,u0:number,u1:number,lo0:number,lo1:number,hi0:number,hi1:number,L:THREE.Color,off=0){
    batch.strip(panel(Q(u0,off),lo0),panel(Q(u1,off),lo1),panel(Q(u1,off),hi1),panel(Q(u0,off),hi0),
     L,[[u0,lo0],[u1,lo1],[u1,hi1],[u0,hi0]]);
   }
   const openings:{x:number;l:number;r:number;lo:number;hi:number;door:boolean;tint:THREE.Color}[]=[];
   if(!shared&&m.type!==2&&len>=1.45){
    const n=Math.max(1,Math.floor((len-.85)/(m.type===1?2.25:2.16)));
    for(let j=0;j<n;j++){
     const u=(j+.5)*len/n,bottom=S(Q(u));
     for(let floor=0;floor<(m.type===1?2:1);floor++){
      const door=floor===0&&i===0&&j===Math.round((n-1)*.5);
      const lo=bottom+(floor===0?0:2.57)+(door?.14:.89);
      const w=Math.min(len/n*.59,door?.94:.92),l=u-w*.5,r=u+w*.5;
      const hi=Math.min(rY(Q(l)),rY(Q(u)),rY(Q(r)))-.32;
      const high=Math.min(hi,lo+(door?2:floor===1?.96:1.1));
      if(high-lo>=.56)openings.push({x:u,l,r,lo,hi:high,door,
       tint:door?burnt:(j+i+floor)%3===0?blueglass:window});
     }
    }
   }
   const tips=new Set<number>([0,len,...openings.flatMap(q=>[q.l,q.r])]);const step=Math.ceil(len/.96);
   for(let k=1;k<step;k++)tips.add(len*k/step);
   const planes=surfaces.flatMap(p=>p);
   for(let l=0;l<planes.length;l++)for(let n=l+1;n<planes.length;n++){
    const s=minus(planes[l],planes[n]),u=evaluate(s,a),v=evaluate(s,b),k=len*u/(u-v);
    if(k>1e-5&&k<len-1e-5)tips.add(k);
   }
   const supports=[...tips].sort((a,b)=>a-b);
   for(let j=1;j<supports.length;j++){
    const t0=supports[j-1],t1=supports[j],p=Q(t0),q=Q(t1),h0=rY(p),h1=rY(q);
    facade(edge,t0,t1,h0-.153,h1-.153,h0,h1,header);
    if(m.type!==2||shared){
     const top0=h0-.15,top1=h1-.15;
     // Non-glazed portions are masonry-free painted wood. Deep house
     // lights, commercial signs and tenant identifications are not inferred.
     const e0=S(p),e1=S(q);
     let y0=e0,y1=e1;
     for(const cut of openings.filter(c=>t0>=c.l-1e-8&&t1<=c.r+1e-8).sort((a,b)=>a.lo-b.lo)){
      if(Math.min(cut.lo-y0,cut.lo-y1)>.002)facade(clad,t0,t1,y0,y1,cut.lo,cut.lo,paint,-.026);
      y0=cut.hi;y1=cut.hi;
     }
     if(Math.min(top0-y0,top1-y1)>.002)facade(clad,t0,t1,y0,y1,top0,top1,paint,-.026);
     facade(edge,t0,t1,e0+.035,e1+.035,e0+.185,e1+.185,under,.011);
    }
   }
   if(shared||len<1.45)continue;
   // Slim corner boards and short plank knockouts break up the close view.
   for(const [left,right] of [[0,.101],[len-.101,len]]){
    const A=Q(left),B=Q(right);
    if(m.type!==2){
     facade(edge,left,right,S(A),S(B),rY(A)-.16,rY(B)-.16,cream,.018);
    }
   }
   if(m.type===2){
    const n=Math.max(1,Math.round(len/2.9));
    for(let k=0;k<=n;k++){
     const u=.19+(len-.38)*k/n,v=Math.min(.074,(len-.38)/(n*4)),p=Q(u),bottom=S(p),top=rY(p)-.10;
     facade(edge,u-v,u+v,bottom,bottom,top,top,cream,-.14);
     const q=Q(u+v,-.14),w=Q(u+v,-.25);
     edge.strip(panel(q,bottom),panel(w,bottom),panel(w,top),panel(q,top),under);
    }
    continue;
   }
   for(const {x:u,l,r:v,lo:lower,hi:y,door,tint} of openings){
    const seam=.061;
    // A cut aperture with a shallow vaulted real sill, wood jambs and recessed glass.
    facade(reveal,l,v,lower,lower,y,y,inside,-.138);
    facade(glazing,l+.035,v-.035,lower+.030,lower+.030,y-.034,y-.034,tint,-.121);
    for(const [l0,v0,side] of [[l-seam,l+.039,l],[v-.039,v+seam,v]]){
     facade(edge,l0,v0,lower-.04,lower-.04,y+.046,y+.046,cream,.052);
     const p=Q(side,.052),q=Q(side,-.139);
     edge.strip(panel(p,lower-.04),panel(q,lower-.04),panel(q,y+.015),panel(p,y+.015),under);
    }
    const p=Q(l,.047),q=Q(v,.047),j=Q(v,-.138),k=Q(l,-.138);
    edge.strip(panel(p,y),panel(q,y),panel(j,y),panel(k,y),inside);
    edge.strip(panel(q,lower),panel(p,lower),panel(k,lower),panel(j,lower),under);
    facade(edge,l-.065,v+.065,y-.007,y-.007,y+.055,y+.055,cream,.061);
    facade(edge,l-.072,v+.072,lower-.056,lower-.056,lower+.035,lower+.035,header,.069);
    if(!door){
     facade(edge,u-.017,u+.017,lower+.027,lower+.027,y-.015,y-.015,cream,-.082);
     const band=y-(y-lower)*.48;
     facade(edge,l+.035,v-.035,band-.018,band-.018,band+.018,band+.018,cream,-.081);
    }
   }
  }
 }
 for(const set of [
  [caps,siding(true),'Spinnakers measured roof planes'],[clad,siding(false),'Named-site original timber walls'],
  [edge,makeMat(.90),'Wood verge, pressings, shutters and jambs'],[reveal,makeMat(.93),'Shadowed openings'],
  [glazing,makeMat(.29,.12,.64),'Unbranded opening glass']
 ] as const){
  const m=set[0].mesh(set[1],set[2]);if(m)out.add(m);
 }
 return out;
}
