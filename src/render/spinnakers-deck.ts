import * as THREE from 'three';
import {readCoastalPack} from '../sim/coastal-packs.ts';
import {OCEAN_Y,type Terrain} from '../sim/terrain.ts';
import {GROUND_LIFT} from '../sim/coastal-terrain.ts';
import type {BaywalkNative} from '../sim/baywalk-native.ts';
import type {Cover} from '../sim/cover.ts';
import {project} from '../sim/geo.ts';
import {SPINNAKERS_DECK as spec} from './spinnakers-deck.generated.ts';
import {SPINNAKERS_SHELLS} from './spinnakers-shells.generated.ts';

export type SpinnakersDeck={top:Float32Array;indices:Uint16Array;outline:Uint16Array};
export function loadSpinnakersDeck(base:string,fetcher:typeof fetch=fetch,timeout=1800){
 return readCoastalPack<SpinnakersDeck>(base+spec.asset,fetcher,timeout,spec,data=>{
  const d=new DataView(data);
  if(d.getUint32(0,true)!==0x4b444c53||d.getUint32(4,true)!==1)throw Error('Unsupported boardwalk format');
  const n=d.getUint32(8,true),m=d.getUint32(12,true),q=d.getUint32(16,true);
  if(n!==spec.nodes||m!==spec.triangles*3||q!==spec.outline||20+12*n+2*m+2*q!==data.byteLength)
   throw Error('Boardwalk counts do not match surveyed plan');
  const top=new Float32Array(n*3),indices=new Uint16Array(m),outline=new Uint16Array(q);
  for(let i=0;i<top.length;i++){
   const y=d.getFloat32(20+i*4,true);if(!Number.isFinite(y)||(i%3===1?(y<1.96||y>2.88):Math.abs(y)>62))throw Error('Unexpected location in deck pack');
   top[i]=y;
  }
  for(let i=0;i<indices.length;i++){
   const q=d.getUint16(20+12*n+2*i,true);if(q>=n)throw Error('Invalid shoreline index');indices[i]=q;
  }
  for(let i=0;i<outline.length;i++){
   const q=d.getUint16(20+12*n+2*(m+i),true);if(q>=n)throw Error('Invalid shoreline edge');outline[i]=q;
  }
  return {top,indices,outline};
 });
}

const origin=project(...spec.anchor);
const deckBase=new THREE.Color(0x7e796d);
export function weatheredTimber(opt:'deck'|'edge'|'post'|'rail',boardShade?:THREE.DataTexture){
 const isDeck=opt==='deck',vertical=opt==='edge'||opt==='post';
 const mat=new THREE.MeshStandardMaterial({color:isDeck?deckBase:opt==='edge'?0x6b6052:opt==='post'?0x504638:0x938e80,
  metalness:0,roughness:isDeck?.91:.95,side:THREE.DoubleSide});
 mat.customProgramCacheKey=()=>`spinnakers-timber-${opt}-${boardShade?'seat':'a'}`;
 mat.onBeforeCompile=(sh)=>{
  if(boardShade)sh.uniforms.wharfShade={value:boardShade};
  sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
    varying vec3 vWharf;`).replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 w=vec4(position,1.);
    #ifdef USE_INSTANCING
    w=instanceMatrix*w;
    #endif
    vWharf=w.xyz;`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 vWharf;
    ${boardShade?'uniform sampler2D wharfShade;':''}
    float timberHash(vec2 p){vec3 f=fract(vec3(p.xyx)*vec3(.1031,.1137,.1213));f+=dot(f,f.yxz+19.19);return fract((f.x+f.y)*f.z);}
    float wornWood(vec2 p){
     vec2 f=fract(p),k=floor(p);f=f*f*(3.-2.*f);
     return mix(mix(timberHash(k),timberHash(k+vec2(1.,0.)),f.x),mix(timberHash(k+vec2(0.,1.)),timberHash(k+1.),f.x),f.y);
    }`).replace('#include <color_fragment>',`#include <color_fragment>
    vec2 deck=mat2(.9636,.2674,-.2674,.9636)*vWharf.xz;
    float pixel=max(length(dFdx(vWharf)),length(dFdy(vWharf)));
    float f=1.-smoothstep(.020,.24,pixel);
    float wear=wornWood(deck*.17);
    ${isDeck?`
      // Weathered planks fade before their grooves alias in flight. Fine grain
      // is a treated wood interpretation, not a photographed surface.
      float cy=deck.y/.151,row=floor(cy),gap=min(fract(cy),1.-fract(cy));
      float aa=max(fwidth(cy)*.58,.013);
      float seam=1.-smoothstep(.018-aa*.38,.050+aa*.41,gap);
      float pax=deck.x/3.53+timberHash(vec2(row,19.));
      float butt=1.-smoothstep(.007,.021+fwidth(pax),min(fract(pax),1.-fract(pax)));
      float grain=(wornWood(vec2(deck.x*1.72,deck.y*76.))-0.5)*.16;
      float salt=(wornWood(vec2(deck.x*.73,deck.y*4.1))-.5)*.12;
      vec3 mixTone=mix(vec3(.81,.89,1.03),vec3(1.08,1.01,.85),wear);
      float wearEdge=(wornWood(deck*.78+25.)-.5)*.065;
      diffuseColor.rgb*=mixTone*(.92+.17*wear+wearEdge+
       f*((timberHash(vec2(row,floor(pax)))-.5)*.23+grain+salt-.22*seam-.14*butt));
      ${boardShade?'diffuseColor.rgb*=texture2D(wharfShade,(vWharf.xz+vec2(40.,32.))/vec2(80.,66.)).r;':''}
    `:`
      vec2 grain=${vertical?`vec2(deck.x+deck.y*.75,vWharf.y)`:`deck`};
      float fibres=wornWood(grain*vec2(91.,.67))-.5;
      float stain=wornWood(grain*vec2(8.3,1.57));
      float damp=${opt==='post'?`1.-smoothstep(.03,.76,vWharf.y)`:`0.`};
      diffuseColor.rgb*=.92+.19*wear+f*(.16*fibres+.12*(stain-.5))-.29*damp;
    `}
  `);
 };
 return mat;
}
function boardwalkContactTint(){
 // An original short-range contact tint, derived only from matching local
 // walls/cover. It does not pretend to cast sunlight shadows on real water.
 const nx=160,nz=132,a=new Uint8Array(nx*nz).fill(255);
 for(const shape of SPINNAKERS_SHELLS.models){
  let xmin=Infinity,zmin=xmin,xmax=-xmin,zmax=xmax;
  for(const [x,z] of shape.ring){xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);zmin=Math.min(zmin,z);zmax=Math.max(zmax,z);}
  for(let i=Math.max(0,Math.floor((xmin+38)*2));i<Math.min(nx,Math.ceil((xmax+42)*2));i++){
   for(let j=Math.max(0,Math.floor((zmin+30)*2));j<Math.min(nz,Math.ceil((zmax+34)*2));j++){
    const x=(i+.5)*.5-40,z=(j+.5)*.5-32;
    let dist=Infinity,inside=false;
    for(let k=0,l=shape.ring.length-1;k<shape.ring.length;l=k++){
     const [sx,sz]=shape.ring[l],[ex,ez]=shape.ring[k],dx=ex-sx,dz=ez-sz;
     const q=Math.max(0,Math.min(1,((x-sx)*dx+(z-sz)*dz)/(dx*dx+dz*dz)));
     dist=Math.min(dist,Math.hypot(x-sx-q*dx,z-sz-q*dz));
     if((sz>z)!==(ez>z)&&x<sx+(z-sz)*dx/dz)inside=!inside;
    }
    const w=inside?.20:Math.max(0,1-dist/1.34)**3*.20;
    a[j*nx+i]=Math.min(a[j*nx+i],Math.round(255*(1-w)));
   }
  }
 }
 const tex=new THREE.DataTexture(a,nx,nz,THREE.RedFormat);
 tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearFilter;tex.needsUpdate=true;
 return tex;
}
type DeckPoint={x:number;y:number;z:number};
function point(p:SpinnakersDeck,id:number):DeckPoint{
 return {x:p.top[id*3],y:p.top[id*3+1],z:p.top[id*3+2]};
}
function mesh(data:number[],material:THREE.Material,label:string){
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();g.computeBoundingSphere();
 const m=new THREE.Mesh(g,material);m.name=label;return m;
}
export function buildSpinnakersDeck(pack:SpinnakersDeck|undefined,cover:Cover,terrain:Terrain,seat?:ReturnType<typeof spinnakersDeckSurface>){
 if(!pack||cover.sourceSha!==spec.cover)return;
 // A reference geometry on a real over-water pier never creates a new
 // ground or aircraft contact surface. Refuse a changed underlying coast.
 for(let i=0;i<pack.top.length;i+=3){
  if(cover.beforeBaywalk(terrain,origin.x+pack.top[i],origin.z+pack.top[i+2])>=0)return;
 }
 const dock=new THREE.Group();dock.name='Spinnakers’ Landing measured weathered timber deck';dock.position.set(origin.x,0,origin.z);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pack.top,3));g.setIndex(new THREE.BufferAttribute(pack.indices,1));
 g.computeVertexNormals();g.computeBoundingSphere();
 const surface=new THREE.Mesh(g,weatheredTimber('deck',boardwalkContactTint()));surface.name='Spinnakers’ native deck surfaces';
 dock.add(surface);
 const rim=Array.from(pack.outline,i=>point(pack,i)),side:number[]=[],under:number[]=[];
 // The visible soffit and edge lift are authored dimensions; the top shape
 // alone is measured. Same exact perimeter vertices mean no floating fascias.
 for(let i=0;i<rim.length;i++){
  const a=rim[i],b=rim[(i+1)%rim.length];
  side.push(a.x,a.y,a.z,b.x,b.y,b.z,a.x,a.y-.28,a.z,
    b.x,b.y,b.z,b.x,b.y-.28,b.z,a.x,a.y-.28,a.z);
 }
 const baseAt=(i:number)=>{const p=point(pack,i);return [p.x,p.y-.28,p.z];};
 for(let i=0;i<pack.indices.length;i+=3)under.push(...baseAt(pack.indices[i]),...baseAt(pack.indices[i+2]),...baseAt(pack.indices[i+1]));
 dock.add(mesh(side,weatheredTimber('edge'),'Weathered timber band at deck edge'));
 // One dark soffit batch, no hidden repeated plank geometry.
 dock.add(mesh(under,new THREE.MeshStandardMaterial({color:0x514b40,roughness:.98}),'Deep brown boardwalk soffit'));
 const shafts:{x:number;y:number;z:number;span:number;rot:number}[]=[];
 let interval=.95;
 for(let i=0;i<rim.length;i++){
  const a=rim[i],b=rim[(i+1)%rim.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
  while(interval<len){
   const t=interval/len;
   shafts.push({x:a.x+dx*t+dz/len*.32,z:a.z+dz*t-dx/len*.32,y:a.y+(b.y-a.y)*t-.13,
    span:.228+.044*Math.sin(shafts.length*2.21),rot:Math.atan2(dx,dz)});
   interval+=2.38;
  }
  interval-=len;
 }
 // An original near-water pile silhouette inspired by the visible documented
 // structure. No claim of measured piles or any seabed installation.
 const columns=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),weatheredTimber('post'),shafts.length);
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),Y=new THREE.Vector3(0,1,0),bottom=OCEAN_Y-.105;
 for(let i=0;i<shafts.length;i++){
  const r=shafts[i];q.setFromAxisAngle(Y,r.rot);
  m.compose(new THREE.Vector3(r.x,(r.y+bottom)*.5,r.z),q,new THREE.Vector3(r.span,r.y-bottom,r.span));
  columns.setMatrixAt(i,m);
 }
 columns.name='Visible boardwalk perimeter pile interpretation';columns.computeBoundingSphere();dock.add(columns);

 // Gray post-and-picket rail appearance is documented, but there is no
 // licensed survey for every rail. Author selected seaward edge runs only;
 // leave the inner boardwalk/junctions unclaimed and don't move the deck.
 const railBeam:{a:DeckPoint;b:DeckPoint;h:number;w:number}[]=[];
 const railPickets:{p:DeckPoint;h:number;w:number}[]=[];
 const ySeat=seat??spinnakersDeckSurface(pack);
 let spacing=.063,main=.19;
 for(let i=0;i<rim.length;i++){
  const a=rim[i],b=rim[(i+1)%rim.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
  const x=(a.x+b.x)*.5,z=(a.z+b.z)*.5;
  if(z<16.-.153*x||dx/len<.52){
   spacing=.063;main=.19;continue;
  }
  const nx=dz/len*.205,nz=-dx/len*.205;
  const pointAt=(t:number,h=0)=>{
   const x=a.x+dx*t+nx,z=a.z+dz*t+nz;
   return {x,z,y:(ySeat(x,z)??a.y+(b.y-a.y)*t)+h};
  };
  railBeam.push({a:pointAt(0,.986),b:pointAt(1,.986),h:.070,w:.097},
   {a:pointAt(0,.206),b:pointAt(1,.206),h:.064,w:.074});
  while(spacing<len){railPickets.push({p:pointAt(spacing/len,.607),h:.788,w:.045});spacing+=.153;}
  spacing-=len;
  while(main<len){railPickets.push({p:pointAt(main/len,.512),h:1.06,w:.121});main+=2.23;}
  main-=len;
 }
 if(railBeam.length){
  const rail=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),weatheredTimber('rail'),railBeam.length+railPickets.length);
  const v=new THREE.Vector3(),forward=new THREE.Vector3(0,0,1);let i=0;
  for(const {a,b,w,h} of railBeam){
   v.set(b.x-a.x,b.y-a.y,b.z-a.z);const length=v.length();q.setFromUnitVectors(forward,v.normalize());
   m.compose(new THREE.Vector3((a.x+b.x)*.5,(a.y+b.y)*.5,(a.z+b.z)*.5),q,new THREE.Vector3(w,h,length+.031));
   rail.setMatrixAt(i++,m);
  }
  q.identity();
  for(const {p,h,w} of railPickets){
   m.compose(new THREE.Vector3(p.x,p.y,p.z),q,new THREE.Vector3(w,h,w));
   rail.setMatrixAt(i++,m);
  }
  rail.name='Selected seaward weathered gray timber rail appearance';rail.computeBoundingSphere();dock.add(rail);
 }
 return dock;
}

/** Evaluate the actual bed of the active triangle, in its local site frame. */
export function spinnakersDeckSurface(pack:SpinnakersDeck){
 const cells=new Map<string,number[]>(),c=2.4,key=(x:number,z:number)=>`${x},${z}`;
 for(let i=0;i<pack.indices.length;i+=3){
  const a=point(pack,pack.indices[i]),b=point(pack,pack.indices[i+1]),e=point(pack,pack.indices[i+2]);
  for(let x=Math.floor(Math.min(a.x,b.x,e.x)/c);x<=Math.floor(Math.max(a.x,b.x,e.x)/c);x++){
   for(let z=Math.floor(Math.min(a.z,b.z,e.z)/c);z<=Math.floor(Math.max(a.z,b.z,e.z)/c);z++){
    const k=key(x,z),bin=cells.get(k);if(bin)bin.push(i);else cells.set(k,[i]);
   }
  }
 }
 return (x:number,z:number)=>{
  const bin=cells.get(key(Math.floor(x/c),Math.floor(z/c)));if(!bin)return;
  for(const i of bin){
   const a=point(pack,pack.indices[i]),b=point(pack,pack.indices[i+1]),e=point(pack,pack.indices[i+2]);
   const ux=b.x-a.x,uz=b.z-a.z,vx=e.x-a.x,vz=e.z-a.z,px=x-a.x,pz=z-a.z,d=ux*vz-uz*vx;
   if(Math.abs(d)<1e-9)continue;
   const j=(px*vz-pz*vx)/d,k=(ux*pz-uz*px)/d;
   if(j>=-1e-6&&k>=-1e-6&&j+k<=1+1e-6)return a.y+j*(b.y-a.y)+k*(e.y-a.y);
  }
 };
}


/** Only the optional court may place corroborated grade below C. Keep strict
 * old-water registration and prove there is room under the existing deck. */
export function verifiedBaywalkDeckClearance(pack:SpinnakersDeck,cover:Cover,terrain:Terrain,bank:BaywalkNative){
 for(let i=0;i<pack.top.length;i+=3){
  const x=origin.x+pack.top[i],z=origin.z+pack.top[i+2],old=cover.beforeBaywalk(terrain,x,z);
  if(old>=0)return false;
  if(bank.restored(old,x,z)&&pack.top[i+1]-bank.heightM(x,z)-GROUND_LIFT<.36)return false;
 }
 const seat=spinnakersDeckSurface(pack);
 for(let j=0;j<bank.height;j++)for(let i=0;i<bank.width;i++){
  if(bank.data.shore[j*bank.width+i]<=128)continue;
  const x=bank.x0+bank.step*i,z=bank.z0+bank.step*j;
  if(cover.beforeBaywalk(terrain,x,z)>=0)continue;
  const top=seat(x-origin.x,z-origin.z);
  if(top!==undefined&&top-bank.heightM(x,z)-GROUND_LIFT<.36)return false;
 }
 return true;
}
