import * as THREE from 'three';
import { downtownFacade, downtownFacadeGLSL } from './facade.ts';
import { emitQuartermasterRoof,supportedQuartermasterRoof } from './quartermaster-roof.ts';
import { emitSurveyRoof,matchesSurveyRoof } from './survey-roof.ts';
import { SOURIS_ROOF } from './souris-roof.generated.ts';
import {sourisOcclusionGLSL,sourisMetalGLSL,type SourisLighting} from './souris-light.ts';
import {buildingShadowGLSL,type BuildingShadows} from './local-building-shadows.ts';
import { emitFarmShell,farmRoofAtlas,readFarmShell } from './farm-shells.ts';
import { farmMaterialGLSL } from './farm-material.ts';
import { homeRoofAtlas,readHomeEnvelope,emitHomeEnvelope } from './home-envelopes.ts';
import { homeMaterialGLSL } from './home-material.ts';
import {waterStreetMaterialGLSL} from './water-street-material.ts';
import {emitWaterStreetShell,waterStreetModel,WATER_STREET_LAYER,WATER_STREET_TILE} from './water-street.ts';
import { replacesLightBuilding } from '../sim/lighthouse-sites.ts';
import { replacesBasilicaFootprint } from './basilica.ts';
import { project,clamp,geographic } from '../sim/geo.ts';
import type { Terrain } from '../sim/terrain.ts';
import { PackedBytes } from '../sim/packed-bytes.ts';
import { roofHeight,splitRoofEdge,splitRoofTriangle,type Triangle } from '../sim/roof-ridge.ts';
import { lookupRoofFit,supportedRoofAtlas } from '../sim/fitted-roofs.ts';
type Ring=[number,number][];
interface Bldg {footprint:Ring;holes?:Ring[];height:number;minHeight?:number;}
interface Tile {id:string;bounds:[number,number,number,number];count:number;offset:number;bytes:number;}
interface BoundTile extends Tile{x1:number;x2:number;z1:number;z2:number;}
const bases=[0xa9a69b,0x85948c,0xc1bda9,0x788c91,0x936d59,0xb7a98f,0x8e8073,0xadaa9a,0xbfc1b3].map(c=>new THREE.Color(c));
const sourisCladding=new THREE.Color(0x889397),sourisRoof=new THREE.Color(0x7d898d);
const sourisFrame='vec2 local=wp.xz-vec2('+SOURIS_ROOF.originXZ.map(n=>n.toFixed(1)).join(',')+
 '),basis=vec2('+SOURIS_ROOF.mainRidge.normalXZ.map(n=>n.toFixed(8)).join(',')+');';
const tops=[0x4a5559,0x726558,0x655e58,0x495851,0x826c58,0x777c75,0x526468].map(c=>new THREE.Color(c));
type Pt={x:number;z:number};
const buildingV=`
 varying vec2 uv2d;varying vec3 tint,wp,normalW;varying float roof,facade;
 attribute float topFlag, facadeStyle;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;normalW=normal;uv2d=uv;tint=color;roof=topFlag;facade=facadeStyle;gl_Position=projectionMatrix*viewMatrix*p;
 #include <logdepthbuf_vertex>
 }`;
const buildingF=(souris=false,hasBuildingShadows=false,waterStreet=false)=>`
 varying vec2 uv2d;varying vec3 tint,wp,normalW;varying float roof,facade;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 // Analytically integrate a repeated interval over the projected footprint of a pixel.
 // At street distance windows resolve; far away they still darken the average wall
 // instead of vanishing to a uniformly painted bright plane.
 float area(float p,float a,float b){return floor(p)*(b-a)+clamp(fract(p)-a,0.,b-a);}
 float band(float p,float a,float b){float w=max(fwidth(p),.001);return (area(p+w*.5,a,b)-area(p-w*.5,a,b))/w;}
 float warmWindowHash(vec2 p){
  vec3 h=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
  h+=dot(h,h.yzx+33.33);
  return fract((h.x+h.y)*h.z);
 }
 ${downtownFacadeGLSL}
 ${souris?sourisOcclusionGLSL+sourisMetalGLSL:''}
 ${hasBuildingShadows?buildingShadowGLSL:''}
 ${farmMaterialGLSL}
 ${homeMaterialGLSL}
 ${waterStreet?waterStreetMaterialGLSL:''}
 void main(){
 #include <logdepthbuf_fragment>
 float d=distance(wp,cameraPosition),fine=1.-smoothstep(220.,1250.,d);
 vec3 c=tint,n=normalize(normalW);
 ${waterStreet?'if(facade>12.5){if(!gl_FrontFacing)n=-n;}else{':''}
 if(roof>.5&&n.y<0.)n=-n;
 if(roof<.5&&!gl_FrontFacing)n=-n;
 ${waterStreet?'}':''}
 float k=clamp(dot(n,normalize(vec3(-.60,.74,-.31))),0.,1.);
 ${waterStreet?'if(facade>12.5){shadeWaterStreet(c,uv2d,wp,n,facade,roof,k,fine,d);}else':''}
 if(facade>9.5){shadeHome(c,uv2d,wp,n,facade,roof,k,d);}
 else if(facade>6.5){shadeFarm(c,uv2d,wp,n,facade,roof,k,fine,d);}
 else if(roof<.5&&facade>5.5){
  // Neutral manufactured cladding for the one measured industrial shell;
  // no guessed windows, openings, branding or claim of actual material.
  ${sourisFrame}vec2 other=vec2(-basis.y,basis.x);
  ${souris?'if(sourisLightLive>.5){c=sourisClad(c,n,wp,local,basis,uv2d.y,0.,fine);}else{':''}
  float u=abs(dot(n.xz,basis))>.72?dot(local,other):dot(local,basis);
  float rib=band(u/.32,.06,.17),smallLip=band(u/.32,.17,.24);
  float panel=band(u/2.85,.03,.065),lap=band(uv2d.y/3.85,.055,.092);
  float crisp=1.-smoothstep(.055,.65,fwidth(u));
  float panelTone=warmWindowHash(vec2(floor(u/2.85),floor(uv2d.y/3.85)));
  float bottom=1.-smoothstep(.42,1.45,uv2d.y);
  vec3 steel=mix(vec3(.92,.98,1.02),vec3(1.02,.99,.94),panelTone);
  c*=mix(vec3(1.),steel,crisp)* (1.-fine*(.10*rib+.19*panel+.16*lap)-.16*bottom);
  c+=vec3(.026,.030,.031)*smallLip*fine;
  ${souris?'}':''}
 }else if(roof<.5&&facade>.5){harbourWalls(c,uv2d,wp,facade,k,fine);}
 else if(roof<.5){
  vec2 grid=uv2d/vec2(2.62,3.08);
  float glass=band(grid.x,.17,.79)*band(grid.y,.23,.82);
  float reveal=band(grid.y,.19,.24)*band(grid.x,.145,.815);
  float sill=band(grid.y,.81,.86)*band(grid.x,.135,.84);
  float mullion=band(grid.x,.465,.495)*band(grid.y,.25,.80);
  vec3 glassCol=mix(vec3(.030,.054,.062),vec3(.12,.17,.18),.35+.5*k);
  c=mix(c,glassCol,glass*.88);c*=1.-reveal*.24;c+=vec3(.028)*(sill+mullion);
  c*=1.-.11*fine*band(uv2d.y*4.5,.0,.18);c*=.81+.19*smoothstep(0.,3.8,uv2d.y);
 }else if(facade>5.5){
  ${sourisFrame}
  ${souris?'if(sourisLightLive>.5){c=sourisClad(c,n,wp,local,basis,uv2d.y,1.,fine);}else{':''}
  float u=dot(local,basis),v=dot(local,vec2(-basis.y,basis.x));
  float seam=band(u/1.15,.025,.056),lap=band(v/6.2+.5*mod(floor(u/1.15),2.),.05,.095);
  float polish=warmWindowHash(floor(vec2(u/2.5,v/7.)));
  c*=mix(.97,1.03,polish)*(1.-fine*(.18*seam+.07*lap));
  ${souris?'}':''}
 }else{c*=1.-.11*fine*band(uv2d.x*1.8,.0,.17);}
 c*=.61+.51*k;
 ${hasBuildingShadows?`
 if(facade<5.5||facade>6.5){
  float groundedCast=buildingShade(wp,n,d);
  c*=mix(vec3(1.),vec3(.67,.73,.82),groundedCast*smoothstep(.05,.64,k));
 }
 `:''}
 ${souris?`
 if(facade>5.5){
  float shade=sourisCast(wp)*(.21+.79*smoothstep(.02,.63,k));
  c*=mix(vec3(1.),vec3(.53,.62,.72),shade);
 }
 `:''}
 float mist=1.-exp(-d*.000022);gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),mist),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
export class Buildings {
 private tiles:BoundTile[]=[];private pack:PackedBytes;private t:Terrain;private scene:THREE.Scene;
 private meshes=new Map<string,THREE.Mesh>();private loading=new Set<string>();private wanted=new Set<string>();private work:BoundTile[]=[];private failed=new Set<string>();
 private readonly fitted:boolean;private readonly farms:boolean;private readonly homes:boolean;private readonly atlasHash:string|undefined;
 private readonly sourisMat?:THREE.ShaderMaterial;
 private readonly waterStreetMat?:THREE.ShaderMaterial;
 private readonly sourisLight?:SourisLighting;
 private last={x:Infinity,z:Infinity};readonly mat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(),vertexColors:true,side:THREE.DoubleSide});
 private constructor(scene:THREE.Scene,t:Terrain,atlas:Tile[],pack:PackedBytes,atlasHash:string|undefined,sourisLight?:SourisLighting,casts?:BuildingShadows){
  if(casts){this.mat.fragmentShader=buildingF(false,true);Object.assign(this.mat.uniforms,casts.uniforms);}
  if(sourisLight&&atlasHash===SOURIS_ROOF.atlasSha256){
   this.sourisLight=sourisLight;
   this.sourisMat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(true,!!casts),uniforms:{...sourisLight.uniforms,...casts?.uniforms},vertexColors:true,side:THREE.DoubleSide});
  }
  if(atlasHash===WATER_STREET_LAYER&&scene.environment){
   this.waterStreetMat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(false,!!casts,true),
    uniforms:{waterStreetSky:{value:scene.environment},...casts?.uniforms},vertexColors:true,side:THREE.DoubleSide});
  }
  this.fitted=supportedRoofAtlas(atlasHash);this.farms=farmRoofAtlas(atlasHash);this.homes=homeRoofAtlas(atlasHash);
  this.atlasHash=atlasHash;this.t=t;this.scene=scene;this.pack=pack;this.tiles=atlas.map(a=>{const [w,s,e,n]=a.bounds,p=project(w,n),q=project(e,s);return {...a,x1:p.x,x2:q.x,z1:p.z,z2:q.z};});
 }
 static async create(scene:THREE.Scene,terrain:Terrain,sourisLight?:SourisLighting,casts?:BuildingShadows){
  const path=import.meta.env.BASE_URL+'world/buildings/',mf=await fetch(path+'index.json');
  if(!mf.ok)throw Error('Building atlas not available.');
  const a=(await mf.json()) as {file:string;bytes:number;tiles:Tile[];sha256?:string};
  if(a.file!=='tiles.pack'||!Number.isSafeInteger(a.bytes)||a.bytes<=0||!Array.isArray(a.tiles)||!a.tiles.length||
     a.tiles.some(t=>!Number.isSafeInteger(t.offset)||!Number.isSafeInteger(t.bytes)||t.offset<0||t.bytes<=0||t.bytes>a.bytes-t.offset)){
   throw Error('Invalid building atlas index.');
  }
  return new Buildings(scene,terrain,a.tiles,new PackedBytes(path+a.file,a.bytes),a.sha256,sourisLight,casts);
 }
 update(x:number,z:number){
  if(Math.hypot(x-this.last.x,z-this.last.z)>260){
   this.last={x,z};const d=(a:BoundTile)=>Math.hypot(x-clamp(x,a.x1,a.x2),z-clamp(z,a.z1,a.z2));
   const near=this.tiles.filter(t=>d(t)<5300).sort((a,b)=>d(a)-d(b));this.wanted=new Set(near.map(a=>a.id));
   this.work=near.filter(t=>!this.meshes.has(t.id)&&!this.loading.has(t.id)&&!this.failed.has(t.id));
   for(const [id,m] of this.meshes)if(!this.wanted.has(id)){this.scene.remove(m);m.geometry.dispose();this.meshes.delete(id);if(id===SOURIS_ROOF.sourceTileId&&this.sourisLight)void this.sourisLight.setCaster(false);}
  }
  // Bound decompression and mesh creation to one tile per application frame, with bounded inflight loads.
  if(this.work.length&&this.loading.size<2){const tile=this.work.shift()!;void this.load(tile);}
 }
 drawableCasters(x:number,z:number,r:number,out:THREE.Mesh[]){
  for(const m of this.meshes.values()){
   const b=m.geometry.boundingSphere;
   if(!m.visible||!b)continue;
   if(Math.hypot(x-m.position.x-b.center.x,z-m.position.z-b.center.z)<r+b.radius)out.push(m);
  }
 }
 get sourceAtlasSha256(){return this.atlasHash;}
 diagnostics(){
  let failed=0;
  for(const id of this.failed)if(this.wanted.has(id))failed++;
  return {wanted:this.wanted.size,ready:this.meshes.size,loading:this.loading.size,pending:this.work.length,failed};
 }
 private async load(tile:BoundTile){
  this.loading.add(tile.id);
  try{
   const part=await this.pack.read(tile.offset,tile.bytes);
   const chunk=await new Response(new Blob([part]).stream().pipeThrough(new DecompressionStream('gzip'))).json() as {features:Bldg[]};
   if(!this.wanted.has(tile.id))return;
   const mesh=this.generate(chunk.features,tile);this.meshes.set(tile.id,mesh);this.scene.add(mesh);
   if(this.sourisLight&&tile.id===SOURIS_ROOF.sourceTileId){
    void this.sourisLight.setCaster(chunk.features.some(f=>matchesSurveyRoof(SOURIS_ROOF,this.atlasHash,tile.id,f.footprint,f.holes)));
   }
  }catch(e){this.failed.add(tile.id);console.warn('Building tile unavailable',tile.id,e);}finally{this.loading.delete(tile.id);}
 }
 private generate(features:Bldg[],tile:BoundTile){
  const ox=(tile.x1+tile.x2)/2,oz=(tile.z1+tile.z2)/2,P:number[]=[],C:number[]=[],UV:number[]=[],R:number[]=[],F:number[]=[];
  let facade=0;
  const vertex=(p:Pt,y:number,c:THREE.Color,u:number,v:number,r:number)=>{P.push(p.x-ox,y,p.z-oz);C.push(c.r,c.g,c.b);UV.push(u,v);R.push(r);F.push(facade);};
  for(let i=0;i<features.length;i++){
   const f=features[i];
   if(f.footprint.length<3||!Number.isFinite(f.height)||replacesLightBuilding(f.footprint))continue;
   const rings=[f.footprint,...(f.holes??[])].map(r=>r.map(([lon,lat])=>project(lon,lat)));
   const ring=rings[0],cx=ring.reduce((s,p)=>s+p.x,0)/ring.length,cz=ring.reduce((s,p)=>s+p.z,0)/ring.length;
   const ll=geographic(cx,cz);if(replacesBasilicaFootprint(ll.lon,ll.lat))continue;
   const seed=Math.abs(Math.floor(cx*97+cz*53))>>>0,h=clamp(f.height,1.3,130);
   facade=downtownFacade(ll.lon,ll.lat,h,seed);
   const base=this.t.meshElevation(cx,cz)+.05, cw=bases[seed%bases.length],cr=tops[(seed>>>4)%tops.length];
   if(supportedQuartermasterRoof(this.atlasHash,tile.id,f.footprint,f.holes)){
    emitQuartermasterRoof({
     roof:(a,b,c,y)=>{
      vertex(a,y,cr,a.x-ox,a.z-oz,1);vertex(b,y,cr,b.x-ox,b.z-oz,1);vertex(c,y,cr,c.x-ox,c.z-oz,1);
     },
     riser:(a,b,below,y)=>{
      const ga=this.t.meshElevation(a.x,a.z)-.6,gb=this.t.meshElevation(b.x,b.z)-.6;
      const loA=below??ga,loB=below??gb,d=Math.hypot(a.x-b.x,a.z-b.z);
      facade=downtownFacade(ll.lon,ll.lat,y-base,seed);
      vertex(a,loA,cw,0,loA-ga,0);vertex(a,y,cw,0,y-ga,0);vertex(b,y,cw,d,y-gb,0);
      vertex(a,loA,cw,0,loA-ga,0);vertex(b,y,cw,d,y-gb,0);vertex(b,loB,cw,d,loB-gb,0);
     }
    });
    continue;
   }
   if(matchesSurveyRoof(SOURIS_ROOF,this.atlasHash,tile.id,f.footprint,f.holes)){
    facade=6;
    emitSurveyRoof(SOURIS_ROOF,{
     roof:(a,b,c,y)=>{
      vertex(a,y[0],sourisRoof,a.x-ox,a.z-oz,1);
      vertex(b,y[1],sourisRoof,b.x-ox,b.z-oz,1);
      vertex(c,y[2],sourisRoof,c.x-ox,c.z-oz,1);
     },
     riser:(a,b,below,y)=>{
      const ga=this.t.meshElevation(a.x,a.z)-.6,gb=this.t.meshElevation(b.x,b.z)-.6;
      const loA=below?.[0]??ga,loB=below?.[1]??gb,d=Math.hypot(a.x-b.x,a.z-b.z);
      vertex(a,loA,sourisCladding,0,loA-ga,0);vertex(a,y[0],sourisCladding,0,y[0]-ga,0);vertex(b,y[1],sourisCladding,d,y[1]-gb,0);
      vertex(a,loA,sourisCladding,0,loA-ga,0);vertex(b,y[1],sourisCladding,d,y[1]-gb,0);vertex(b,loB,sourisCladding,d,loB-gb,0);
     }
    });
    continue;
   }
   const mainStreet=this.waterStreetMat?waterStreetModel(this.atlasHash,tile.id,i,f.footprint,f.holes):undefined;
   if(mainStreet){
    emitWaterStreetShell(mainStreet,(x,z)=>this.t.meshElevation(x,z),(p,y,c,u,v,role,style)=>{
     facade=style;vertex(p,y,c,u,v,role);
    });
    continue;
   }
   // Measured highest/lowest roof samples guide shading; an inferred ridge is NOT surveyed roof geometry.
   const low=clamp(f.minHeight??h,h*.55,h), synthGable=ring.length===4&&rings.length===1&&h-low>.65;
   const fit=this.fitted&&rings.length===1?lookupRoofFit(tile.id,f.footprint,{x:cx,z:cz}):undefined;
   const farm=this.farms&&!fit&&rings.length===1?readFarmShell(tile.id,i,f.footprint):undefined;
   if(farm){
    facade=farm.style;
    emitFarmShell(ring,{x:cx,z:cz},base,seed,farm,(x,z)=>this.t.meshElevation(x,z),vertex);
    continue;
   }
   const home=this.homes&&!fit&&rings.length===1?readHomeEnvelope(tile.id,i,f.footprint):undefined;
   if(home){
    facade=home.style;
    emitHomeEnvelope(ring,{x:cx,z:cz},base,seed,home,(x,z)=>this.t.meshElevation(x,z),vertex);
    continue;
   }
   const eave=base+(synthGable?low:h);
   const rim=(p:Pt)=>fit?base+roofHeight(p,fit):eave;
   const wall=(p:Pt,q:Pt,u0:number,u1:number)=>{
    const y0=this.t.meshElevation(p.x,p.z)-.6,y1=this.t.meshElevation(q.x,q.z)-.6,y2=rim(p),y3=rim(q);
    vertex(p,y0,cw,u0,0,0);vertex(p,y2,cw,u0,y2-y0,0);vertex(q,y3,cw,u1,y3-y1,0);
    vertex(p,y0,cw,u0,0,0);vertex(q,y3,cw,u1,y3-y1,0);vertex(q,y1,cw,u1,0,0);
   };
   for(const rr of rings){for(let i=0;i<rr.length;i++){
    const a=rr[i],b=rr[(i+1)%rr.length],len=Math.hypot(b.x-a.x,b.z-a.z);
    if(len<.15)continue;
    const middle=fit?splitRoofEdge(a,b,fit)[1]:b;
    if(middle===b)wall(a,b,0,len);
    else{const u=Math.hypot(middle.x-a.x,middle.z-a.z);wall(a,middle,0,u);wall(middle,b,u,len);}
   }}
   const roofVert=(p:Pt,y:number)=>vertex(p,y,cr,p.x-ox,p.z-oz,1);
   if(synthGable&&!fit){
    const length=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.z-b.z);
    let a=ring[0],b=ring[1],c=ring[2],d=ring[3];
    if(length(a,b)>length(b,c)){[a,b,c,d]=[b,c,d,a];}
    const ab={x:(a.x+b.x)*.5,z:(a.z+b.z)*.5},cd={x:(c.x+d.x)*.5,z:(c.z+d.z)*.5};
    for(const [p,y] of [[a,eave],[ab,base+h],[cd,base+h],[a,eave],[cd,base+h],[d,eave],[b,eave],[c,eave],[cd,base+h],[b,eave],[cd,base+h],[ab,base+h]] as [Pt,number][])roofVert(p,y);
    for(const [u,v,w] of [[a,b,ab],[c,d,cd]]){vertex(u,eave,cw,0,0,0);vertex(v,eave,cw,4,0,0);vertex(w,base+h,cw,2,h-low,0);}
   }else{
    const outline=rings.map(rr=>rr.map(p=>new THREE.Vector2(p.x-ox,-p.z+oz))),flat=rings.flat();
    const faces=THREE.ShapeUtils.triangulateShape(outline[0],outline.slice(1));
    if(fit){for(const face of faces){
      const triangle:Triangle=[flat[face[0]],flat[face[1]],flat[face[2]]];
      for(const t of splitRoofTriangle(triangle,fit))for(const p of t)roofVert(p,rim(p));
    }}else{for(const face of faces)for(const idx of face)roofVert(flat[idx],eave);}
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('topFlag',new THREE.Float32BufferAttribute(R,1));g.setAttribute('facadeStyle',new THREE.Uint8BufferAttribute(F,1));g.computeVertexNormals();g.computeBoundingSphere();
  const mesh=new THREE.Mesh(g,tile.id===SOURIS_ROOF.sourceTileId&&this.sourisMat?this.sourisMat:tile.id===WATER_STREET_TILE&&this.waterStreetMat?this.waterStreetMat:this.mat);mesh.position.set(ox,0,oz);return mesh;
 }
}
