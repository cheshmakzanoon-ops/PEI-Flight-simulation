import * as THREE from 'three';
import { replacesLightBuilding } from '../sim/lighthouse-sites.ts';
import { replacesBasilicaFootprint } from './basilica.ts';
import { project,clamp,geographic } from '../sim/geo.ts';
import type { Terrain } from '../sim/terrain.ts';
type Ring=[number,number][];
interface Bldg {footprint:Ring;holes?:Ring[];height:number;minHeight?:number;}
interface Tile {id:string;bounds:[number,number,number,number];count:number;offset:number;bytes:number;}
interface BoundTile extends Tile{x1:number;x2:number;z1:number;z2:number;}
const bases=[0xa9a69b,0x85948c,0xc1bda9,0x788c91,0x936d59,0xb7a98f,0x8e8073,0xadaa9a,0xbfc1b3].map(c=>new THREE.Color(c));
const tops=[0x4a5559,0x726558,0x655e58,0x495851,0x826c58,0x777c75,0x526468].map(c=>new THREE.Color(c));
type Pt={x:number;z:number};
const buildingV=`
 varying vec2 uv2d;varying vec3 tint,wp,normalW;varying float roof;
 attribute float topFlag;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;normalW=normal;uv2d=uv;tint=color;roof=topFlag;gl_Position=projectionMatrix*viewMatrix*p;
 #include <logdepthbuf_vertex>
 }`;
const buildingF=`
 varying vec2 uv2d;varying vec3 tint,wp,normalW;varying float roof;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 // Analytically integrate a repeated interval over the projected footprint of a pixel.
 // At street distance windows resolve; far away they still darken the average wall
 // instead of vanishing to a uniformly painted bright plane.
 float area(float p,float a,float b){return floor(p)*(b-a)+clamp(fract(p)-a,0.,b-a);}
 float band(float p,float a,float b){float w=max(fwidth(p),.001);return (area(p+w*.5,a,b)-area(p-w*.5,a,b))/w;}
 void main(){
 #include <logdepthbuf_fragment>
 float d=distance(wp,cameraPosition),fine=1.-smoothstep(220.,1250.,d);
 vec3 c=tint,n=normalize(normalW);if(roof>.5&&n.y<0.)n=-n;
 if(roof<.5&&!gl_FrontFacing)n=-n;
 float k=clamp(dot(n,normalize(vec3(-.60,.74,-.31))),0.,1.);
 if(roof<.5){
  vec2 grid=uv2d/vec2(2.62,3.08);
  float glass=band(grid.x,.17,.79)*band(grid.y,.23,.82);
  float reveal=band(grid.y,.19,.24)*band(grid.x,.145,.815);
  float sill=band(grid.y,.81,.86)*band(grid.x,.135,.84);
  float mullion=band(grid.x,.465,.495)*band(grid.y,.25,.80);
  vec3 glassCol=mix(vec3(.030,.054,.062),vec3(.12,.17,.18),.35+.5*k);
  c=mix(c,glassCol,glass*.88);c*=1.-reveal*.24;c+=vec3(.028)*(sill+mullion);
  c*=1.-.11*fine*band(uv2d.y*4.5,.0,.18);c*=.81+.19*smoothstep(0.,3.8,uv2d.y);
 }else{c*=1.-.11*fine*band(uv2d.x*1.8,.0,.17);}
 c*=.61+.51*k;float mist=1.-exp(-d*.000022);gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),mist),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
export class Buildings {
 private tiles:BoundTile[]=[];private pack:ArrayBuffer;private t:Terrain;private scene:THREE.Scene;
 private meshes=new Map<string,THREE.Mesh>();private loading=new Set<string>();private wanted=new Set<string>();private work:BoundTile[]=[];private failed=new Set<string>();
 private last={x:Infinity,z:Infinity};readonly mat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF,vertexColors:true,side:THREE.DoubleSide});
 private constructor(scene:THREE.Scene,t:Terrain,atlas:Tile[],pack:ArrayBuffer){
  this.t=t;this.scene=scene;this.pack=pack;this.tiles=atlas.map(a=>{const [w,s,e,n]=a.bounds,p=project(w,n),q=project(e,s);return {...a,x1:p.x,x2:q.x,z1:p.z,z2:q.z};});
 }
 static async create(scene:THREE.Scene,terrain:Terrain){
  const path=import.meta.env.BASE_URL+'world/buildings/';const [mf,pk]=await Promise.all([fetch(path+'index.json'),fetch(path+'tiles.pack')]);if(!mf.ok||!pk.ok)throw Error('Building atlas not available.');
  const a=(await mf.json()) as {tiles:Tile[]};const p=await pk.arrayBuffer();
  if(!a.tiles?.length||a.tiles.some(t=>t.offset<0||t.bytes<=0||t.offset+t.bytes>p.byteLength))throw Error('Invalid building atlas index.');
  return new Buildings(scene,terrain,a.tiles,p);
 }
 update(x:number,z:number){
  if(Math.hypot(x-this.last.x,z-this.last.z)>260){
   this.last={x,z};const d=(a:BoundTile)=>Math.hypot(x-clamp(x,a.x1,a.x2),z-clamp(z,a.z1,a.z2));
   const near=this.tiles.filter(t=>d(t)<5300).sort((a,b)=>d(a)-d(b));this.wanted=new Set(near.map(a=>a.id));
   this.work=near.filter(t=>!this.meshes.has(t.id)&&!this.loading.has(t.id)&&!this.failed.has(t.id));
   for(const [id,m] of this.meshes)if(!this.wanted.has(id)){this.scene.remove(m);m.geometry.dispose();this.meshes.delete(id);}
  }
  // Bound decompression and mesh creation to one tile per application frame, with bounded inflight loads.
  if(this.work.length&&this.loading.size<2){const tile=this.work.shift()!;void this.load(tile);}
 }
 private async load(tile:BoundTile){
  this.loading.add(tile.id);
  try{
   const part=this.pack.slice(tile.offset,tile.offset+tile.bytes);
   const chunk=await new Response(new Blob([part]).stream().pipeThrough(new DecompressionStream('gzip'))).json() as {features:Bldg[]};
   if(!this.wanted.has(tile.id))return;
   const mesh=this.generate(chunk.features,tile);this.meshes.set(tile.id,mesh);this.scene.add(mesh);
  }catch(e){this.failed.add(tile.id);console.warn('Building tile unavailable',tile.id,e);}finally{this.loading.delete(tile.id);}
 }
 private generate(features:Bldg[],tile:BoundTile){
  const ox=(tile.x1+tile.x2)/2,oz=(tile.z1+tile.z2)/2,P:number[]=[],C:number[]=[],UV:number[]=[],R:number[]=[];
  const vertex=(p:Pt,y:number,c:THREE.Color,u:number,v:number,r:number)=>{P.push(p.x-ox,y,p.z-oz);C.push(c.r,c.g,c.b);UV.push(u,v);R.push(r);};
  for(const f of features){
   if(f.footprint.length<3||!Number.isFinite(f.height)||replacesLightBuilding(f.footprint))continue;
   const rings=[f.footprint,...(f.holes??[])].map(r=>r.map(([lon,lat])=>project(lon,lat)));
   const ring=rings[0],cx=ring.reduce((s,p)=>s+p.x,0)/ring.length,cz=ring.reduce((s,p)=>s+p.z,0)/ring.length;
   const ll=geographic(cx,cz);if(replacesBasilicaFootprint(ll.lon,ll.lat))continue;
   const seed=Math.abs(Math.floor(cx*97+cz*53))>>>0,h=clamp(f.height,1.3,130);
   const base=this.t.meshElevation(cx,cz)+.05, cw=bases[seed%bases.length],cr=tops[(seed>>>4)%tops.length];
   // Measured highest/lowest roof samples guide shading; an inferred ridge is NOT surveyed roof geometry.
   const low=clamp(f.minHeight??h,h*.55,h), synthGable=ring.length===4&&rings.length===1&&h-low>.65;
   const eave=base+(synthGable?low:h);
   for(const rr of rings){for(let i=0;i<rr.length;i++){
    const a=rr[i],b=rr[(i+1)%rr.length],len=Math.hypot(b.x-a.x,b.z-a.z);
    if(len<.15)continue;
    const y0=this.t.meshElevation(a.x,a.z)-.6,y1=this.t.meshElevation(b.x,b.z)-.6;
    vertex(a,y0,cw,0,0,0);vertex(a,eave,cw,0,eave-y0,0);vertex(b,eave,cw,len,eave-y1,0);
    vertex(a,y0,cw,0,0,0);vertex(b,eave,cw,len,eave-y1,0);vertex(b,y1,cw,len,0,0);
   }}
   const roofVert=(p:Pt,y:number)=>vertex(p,y,cr,p.x-ox,p.z-oz,1);
   if(synthGable){
    const length=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.z-b.z);
    let a=ring[0],b=ring[1],c=ring[2],d=ring[3];
    if(length(a,b)>length(b,c)){[a,b,c,d]=[b,c,d,a];}
    const ab={x:(a.x+b.x)*.5,z:(a.z+b.z)*.5},cd={x:(c.x+d.x)*.5,z:(c.z+d.z)*.5};
    for(const [p,y] of [[a,eave],[ab,base+h],[cd,base+h],[a,eave],[cd,base+h],[d,eave],[b,eave],[c,eave],[cd,base+h],[b,eave],[cd,base+h],[ab,base+h]] as [Pt,number][])roofVert(p,y);
    for(const [u,v,w] of [[a,b,ab],[c,d,cd]]){vertex(u,eave,cw,0,0,0);vertex(v,eave,cw,4,0,0);vertex(w,base+h,cw,2,h-low,0);}
   }else{
    const outline=rings.map(rr=>rr.map(p=>new THREE.Vector2(p.x-ox,-p.z+oz))),flat=rings.flat();
    for(const face of THREE.ShapeUtils.triangulateShape(outline[0],outline.slice(1)))for(const idx of face)roofVert(flat[idx],eave);
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('topFlag',new THREE.Float32BufferAttribute(R,1));g.computeVertexNormals();g.computeBoundingSphere();
  const mesh=new THREE.Mesh(g,this.mat);mesh.position.set(ox,0,oz);return mesh;
 }
}
