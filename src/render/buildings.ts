import {TerminalWallPreview} from './summerside-terminal/wall-preview.ts';
import {TERMINAL_WIRE} from './summerside-terminal/terminal-wall-owner.ts';
import {nearStandardWharf,standardWharfDraw,standardWharfPositionsAllow,trackWharfSpans,type WharfLoader,type WharfSpan} from './spinnakers-standard.ts';
import {OLEARY,OLEARY_INDUSTRIAL,OLEARY_WAREHOUSE,olearyAtlasOwner,type OlearySeat} from './oleary-railway/authority.ts';
import {OlearySocket} from './oleary-railway/socket.ts';
import {OlearyCohortSocket,type OlearyCohortStudy} from './oleary-railway/cohort.ts';
import type {DalvayGlazingSource} from './dalvay-glazing.ts';
import {DALVAY,dalvayOwner,type DalvaySeat} from './dalvay-exterior-seat.ts';
import {DalvaySocket} from './dalvay-exterior-socket.ts';
import {SEACOW,seacowOwner,seacowSource,type SeacowSeat} from './seacow-exterior-seat.ts';
import {KNIGHT_SEAT,knightExactOwner,knightOwns,type KnightSeat} from './souris-knight-seat.ts';
import {princeSkyGLSL,princeSkyWords} from './prince-roof-sky.ts';
import {POINT_PRIM,pointPrimDrawSource,pointPrimOwner,type PointPrimStock} from './point-prim/admit.ts';
import {downtownTilePin,downtownWireAllows} from './summerside-roof-source.ts';
import {crockettAtlasCandidate,crockettExactRow,crockettExactWire} from './souris-east/admit.ts';
import {SOURCE as SOURIS_EAST} from './souris-east/source.ts';
import type {SourisEastGround} from './souris-east/ground.ts';
import {KINGS_CROWN_BUILDINGS,readKingsCrownBuildings} from './kings-crown-building-owner.ts';
import {ST_DAVIDS as ST_DAVID} from './st-davids/source.generated.ts';
import {stDavidsAtlasAllows,stDavidsDrawAllows,stDavidsOwnerAllows,stDavidsOwnerBytes} from './st-davids/admit.ts';
import type {StDavidsArt} from './st-davids/runtime.ts';
import {SUMMERSIDE_STATION as RAIL} from './summerside-station/source.generated.ts';
import {railAtlasAllows,railOwnerAllows,railOwnerChunk} from './summerside-station/admit.ts';
import type {RailwayArtwork} from './summerside-station/rail-art.ts';
import {INDIAN_RIVER_SOURCE as CHURCH} from './indian-river/indian-river-source.generated.ts';
import {churchOwnerBytes,churchOwnerSource} from './indian-river/indian-river-guard.ts';
import {authenticatedOwnerVariant} from './indian-river/authored-owner-variant.ts';
import {authenticatedOwnerCohort} from './authenticated-owner-cohort.ts';
import type {ChurchArt} from './indian-river/runtime.ts';
import {matchesRusticoMassing,emitRusticoMassing,RUSTICO_MASSING_TILE} from './rustico-neighbour.ts';
import * as THREE from 'three';
import {BEACON_REVIEW} from './beaconsfield-review-spec.ts';
import {CavendishBarnViews} from './cavendish-owner-views.ts';
import {GREEN_GABLES_BARN} from './green-gables-barn-spec.ts';
import {GREEN_GABLES_REVIEW} from './green-gables-review-spec.ts';
import {matchesHangar4,emitHangar4,hangar4GLSL} from './hangar4.ts';
import {readRoofTone} from './roof-tone.ts';
import {RUSTICO_HARBOUR_ROOF_ROW,RUSTICO_HARBOUR_ROOF_TILE,RUSTICO_HARBOUR_ROOF_TONE,rusticoHarbourRoofAllows,rusticoHarbourRoofAtlasAllows} from './rustico-harbour-roof.ts';
import {OLEARY_ACCESS_ROOF_COLOR,OLEARY_ACCESS_ROOF_TILE,olearyAccessRoofTile,olearyAccessRoofOrdinal} from './oleary-access-roof-tone.ts';
import {readNeutralRoof,neutralRoofHeight,neutralRoofTriangles,neutralRoofEdge} from './neutral-roof.ts';
import type {NorthBaywalk} from './north-baywalk.ts';
import {SPINNAKERS_SHELLS} from './spinnakers-shells.generated.ts';
import {buildSpinnakersShells,matchesSpinnakersShells,SPINNAKERS_OMISSIONS,SPINNAKERS_TILE,type WharfSurface} from './spinnakers-shells.ts';
import {PRINCE_ROOF_TILE,princeRoofOwner,matchesPrinceSurveyRoof,emitPrinceSurveyRoof,princeFoot} from './prince-survey-roof.ts';
import { downtownFacade, downtownFacadeGLSL } from './facade.ts';
import { fittedWallMaterial,townFaceRegion,townTileRegion,townWallVertex,TOWN_WALL_ATLAS,type TownWallOptics } from './town-wall-optics.ts';
import {sourisFacingOwnerTile,sourisFacingAdmittedEdge,sourisFacingExactSurface} from './souris-waterfront-face-pin.ts';
import {detachedSchoolWestMark,patchSourisSchoolWestFragment,SRS_FACE_MARKER,SRS_WEST_WALL} from './souris-west-wall-material.ts';
import type {OlearyLink,OlearyProgramProof} from './oleary-railway/program-gate.ts';
import { emitQuartermasterRoof,supportedQuartermasterRoof } from './quartermaster-roof.ts';
import { emitSurveyRoof,matchesSurveyRoof } from './survey-roof.ts';
import { SOURIS_ROOF } from './souris-roof.generated.ts';
import {sourisOcclusionGLSL,sourisMetalGLSL,type SourisLighting} from './souris-light.ts';
import {buildingShadowGLSL,type BuildingShadows} from './local-building-shadows.ts';
import { emitFarmShell,farmRoofAtlas,readFarmShell } from './farm-shells.ts';
import { farmMaterialGLSL } from './farm-material.ts';
import { homeRoofAtlas,readHomeEnvelope,emitHomeEnvelope } from './home-envelopes.ts';
import { homeMaterialGLSL } from './home-material.ts';
import {montagueHallMaterialGLSL} from './montague-hall-material.ts';
import {sourisMcleanMaterialGLSL} from './souris-mclean-material.ts';
import {emitSourisMclean,sourisMcleanModel,MCLEAN_TILE,MCLEAN_ATLAS} from './souris-mclean.ts';
import {macdonaldMaterialGLSL} from './montague-macdonald-material.ts';
import {montagueMacdonaldModel,emitMacdonaldShell} from './montague-macdonald.ts';
import {emitMontagueHall,montagueHallModel,MONTAGUE_HALL_TILE,MONTAGUE_HALL_ATLAS} from './montague-hall.ts';
import {victoriaMaterialGLSL} from './victoria-material.ts';
import {emitVictoriaRow,victoriaRowModel,VICTORIA_TILE,VICTORIA_ATLAS} from './victoria-row.ts';
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
type PreparedAtlas={atlas:Tile[];pack:PackedBytes;atlasHash?:string;spinnakers?:Bldg[];indianRiver?:Bldg[];kingsCrown?:Bldg[]};
interface Bldg {footprint:Ring;holes?:Ring[];height:number;minHeight?:number;}
type ExteriorRecord={ordinal:number;footprint:readonly (readonly [number,number])[];height:number;minHeight:number};
function matchesExterior(rows:Bldg[],spec:ExteriorRecord){
 const f=rows[spec.ordinal];
 return !!f&&f.height===spec.height&&f.minHeight===spec.minHeight&&!f.holes?.length&&
  f.footprint.length===spec.footprint.length&&f.footprint.every((q,j)=>q[0]===spec.footprint[j][0]&&q[1]===spec.footprint[j][1]);
}
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
const buildingF=(souris=false,hasBuildingShadows=false,waterStreet=false,victoria=false,montague=false,sourisMain=false,rusticoNeutral=false,princeContact=false)=>`
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
 ${princeContact?princeSkyGLSL:''}
 ${downtownFacadeGLSL}
 ${souris?sourisOcclusionGLSL+sourisMetalGLSL:''}
 ${hasBuildingShadows?buildingShadowGLSL:''}
 ${farmMaterialGLSL}
 ${homeMaterialGLSL}
 ${hangar4GLSL}
 ${waterStreet?waterStreetMaterialGLSL:''}
 ${victoria?victoriaMaterialGLSL:''}
 ${montague?montagueHallMaterialGLSL+macdonaldMaterialGLSL:''}
 ${sourisMain?sourisMcleanMaterialGLSL:''}
 void main(){
 #include <logdepthbuf_fragment>
 float d=distance(wp,cameraPosition),fine=1.-smoothstep(220.,1250.,d);
 vec3 c=tint,n=normalize(normalW);
 ${waterStreet||victoria||montague||sourisMain?`if(facade>${sourisMain?48.5:12.5}){if(!gl_FrontFacing)n=-n;}else{`:''}
 if(roof>.5&&n.y<0.)n=-n;
 if(roof<.5&&!gl_FrontFacing)n=-n;
 ${waterStreet||victoria||montague||sourisMain?'}':''}
 float k=clamp(dot(n,normalize(vec3(-.60,.74,-.31))),0.,1.);
 ${rusticoNeutral?`
 if(facade>81.5&&facade<82.5){
  // Neutral shape-study finish. No measured facade openings or materials.
  float luma=dot(c,vec3(.2126,.7152,.0722));
  c=mix(vec3(luma),c,roof>.5?.28:.53);
  if(roof<.5)c*=.87+.13*smoothstep(.3,1.8,uv2d.y);
 }else`:''}
 if(facade>71.5&&facade<74.5){shadeHangar4(c,wp,uv2d,facade,d);}else
 ${sourisMain?'if(facade>48.5){shadeSourisMclean(c,uv2d,wp,n,roof,d);}else':''}
 ${montague?'if(facade>47.5){shadeMacdonald(c,uv2d,wp,n,roof,k,d);}else if(facade>46.5){shadeMontagueHall(c,uv2d,wp,n,roof,k);}else':''}
 ${victoria?'if(facade>31.5){shadeVictoria(c,uv2d,wp,n,facade,roof,k,d);}else':''}
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
 ${princeContact?`// Local finite sky loss only: retain the existing .51*k direct term in full.
 if(facade>81.5&&facade<82.5&&roof>.5&&d<290.){
  float loss=princeSkyBlock(wp,n)*(.74*(1.-smoothstep(150.,290.,d)));
  if(loss>0.)c*=.61*(1.-loss)+.51*k;else c*=.61+.51*k;
 }else`:''}
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
export type SpinnakersScene={deck:THREE.Group;seat:WharfSurface;assembleNorth?:()=>NorthBaywalk|undefined;north?:NorthBaywalk;assembled?:THREE.Group};
type LocalExteriorReview={ground:()=>boolean;shadows?:BuildingShadows;standard?:true};
export type RailwayReview={ground:()=>boolean;shadows?:BuildingShadows;standard?:true};
type OwnerSlot=Pick<NonNullable<ReturnType<typeof authenticatedOwnerVariant>>,'visible'|'sync'|'dispose'>;
type Cohort=NonNullable<ReturnType<typeof authenticatedOwnerCohort>>;
type RailwayVariant={owner:THREE.Mesh;art:RailwayArtwork;variant:OwnerSlot;neighborsCaster:THREE.Mesh;
 stockForProof?:()=>THREE.BufferGeometry|undefined};
export type PointPrimDrawLease=Readonly<{present:()=>boolean;active:()=>boolean;set:(visible:boolean)=>boolean;release:()=>void}>;
export type PointPrimVerifiedOwner=Readonly<{source:PointPrimStock;present:()=>boolean;
 mount:(group:THREE.Group)=>PointPrimDrawLease|undefined}>;

export class Buildings {
 private tiles:BoundTile[]=[];private pack:PackedBytes;private t:Terrain;private scene:THREE.Scene;
 private meshes=new Map<string,THREE.Mesh>();private loading=new Set<string>();private wanted=new Set<string>();private work:BoundTile[]=[];private failed=new Set<string>();
 private readonly fitted:boolean;private readonly farms:boolean;private readonly homes:boolean;private readonly atlasHash:string|undefined;
 private readonly sourisMat?:THREE.ShaderMaterial;
 private readonly montagueMat?:THREE.ShaderMaterial;
 private readonly sourisMcleanMat?:THREE.ShaderMaterial;
 private readonly victoriaMat?:THREE.ShaderMaterial;
 private readonly waterStreetMat?:THREE.ShaderMaterial;
 private readonly rusticoNeutralMat?:THREE.ShaderMaterial;
 private readonly rusticoRoof:boolean;
 private rusticoHarbourRoof=false;
 private olearyAccessRoof=false;
 enableOlearyAccessRoof(){this.olearyAccessRoof=true;}
 get olearyAccessRoofActive(){
  const owner=this.meshes.get(OLEARY_ACCESS_ROOF_TILE);
  return !!owner?.visible&&owner.parent===this.scene&&owner.userData.olearyAccessRoofTone===true;
 }
 enableRusticoHarbourRoof(){this.rusticoHarbourRoof=true;}
 /** This is a resident emitted colour, not a visibility/depth report. */
 get rusticoHarbourRoofActive(){
  const owner=this.meshes.get(RUSTICO_HARBOUR_ROOF_TILE);
  return !!owner&&owner.parent===this.scene&&owner.visible&&owner.userData.rusticoHarbourRoofTone===true;
 }
 private sourisWestLink?:OlearyLink;
 private sourisWestMat?:THREE.ShaderMaterial;
 private readonly sourisWestPending=new WeakMap<THREE.Mesh,THREE.BufferAttribute>();
 private sourisWestLease?:{owner:THREE.Mesh;geometry:THREE.BufferGeometry;original:THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
   marked:THREE.BufferAttribute;mount:readonly number[];controller:AbortController;proof?:OlearyProgramProof};
 enableSourisWestFacing(link:OlearyLink){this.sourisWestLink=link;}
 /** Resident verified material, not a claim about optical visibility. */
 get sourisWestFacingActive(){
  const a=this.sourisWestLease;
  return !!a?.proof&&a.owner.visible&&a.owner.parent===this.scene&&a.owner.material===this.sourisWestMat;
 }
 private releaseSourisWestFacing(){
  const a=this.sourisWestLease;if(!a)return;
  this.sourisWestLease=undefined;a.controller.abort();
  if(a.geometry.getAttribute('facadeStyle')===a.marked)a.geometry.setAttribute('facadeStyle',a.original);
  if(a.owner.material===this.sourisWestMat)a.owner.material=this.mat;
 }
 private validSourisWestFacing(a:NonNullable<Buildings['sourisWestLease']>){
  const {owner,geometry}=a;
  if(!this.wanted.has(SRS_WEST_WALL.tile)||this.meshes.get(SRS_WEST_WALL.tile)!==owner||owner.parent!==this.scene||
     this.scene.overrideMaterial||!owner.visible||owner.geometry!==geometry||geometry.index!==null||geometry.groups.length||
     geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity||!sourisFacingExactSurface(geometry))return false;
  const {position:p,quaternion:q,scale:s}=owner,[x,y,z,layer]=a.mount;
  if(p.x!==x||p.y!==y||p.z!==z||owner.layers.mask!==layer||owner.renderOrder!==0||
     q.x||q.y||q.z||q.w!==1||s.x!==1||s.y!==1||s.z!==1||
     !owner.matrixAutoUpdate||a.marked.version!==0)return false;
  for(let i=SRS_WEST_WALL.first;i<SRS_WEST_WALL.last;i++)if(a.marked.getX(i)!==SRS_FACE_MARKER)return false;
  return true;
 }
 private syncSourisWestFacing(){
  const a=this.sourisWestLease;
  if(a?.proof&&(!this.validSourisWestFacing(a)||!a.proof()||a.owner.material!==this.sourisWestMat||
      a.geometry.getAttribute('facadeStyle')!==a.marked))this.releaseSourisWestFacing();
 }
 private async stageSourisWestFacing(owner:THREE.Mesh){
  const marked=this.sourisWestPending.get(owner),link=this.sourisWestLink,material=this.sourisWestMat;
  this.sourisWestPending.delete(owner);
  if(!marked||!link||!material)return;
  this.releaseSourisWestFacing();
  const geometry=owner.geometry,original=geometry.getAttribute('facadeStyle');
  const controller=new AbortController(),a:NonNullable<Buildings['sourisWestLease']>={owner,geometry,original,marked,mount:[owner.position.x,owner.position.y,owner.position.z,owner.layers.mask],controller};
  if(!original||!this.validSourisWestFacing(a)||owner.material!==this.mat)return;
  this.sourisWestLease=a;
  // Compile the real material with the actual owner attribute schema. The
  // detached group is never drawn and the streamed tile remains on stock.
  const g=new THREE.Group();g.add(new THREE.Mesh(geometry,material));
  try{
   const live=await link(g,controller.signal);
   if(this.sourisWestLease!==a)return;
   if(!live||!live()||!this.validSourisWestFacing(a)||owner.material!==this.mat||
       geometry.getAttribute('facadeStyle')!==original){this.releaseSourisWestFacing();return;}
   geometry.setAttribute('facadeStyle',marked);owner.material=material;a.proof=live;
  }catch{if(this.sourisWestLease===a)this.releaseSourisWestFacing();}
 }
 private princeRoofContact=false;private princeSurveyRoof=false;private princeNeutralMat?:THREE.ShaderMaterial;
 private readonly shadowedBuildings:boolean;
 enablePrinceSurveyRoof(contact=false){this.princeSurveyRoof=true;this.princeRoofContact=contact;}
 get princeRoofContactActive(){return this.princeRoofContact&&this.princeSurveyRoofActive;}
 get princeSurveyRoofActive(){return this.meshes.get(PRINCE_ROOF_TILE)?.userData.princeSurveyRoof===true;}
 private sourceNeutralMaterial(){
  if(this.rusticoNeutralMat&&!this.princeRoofContact)return this.rusticoNeutralMat;
  // One material only when this owner passes. Neighbours retain the original
  // shader path; the source-neutral branch is entered only by style 82.
  return this.princeNeutralMat??=new THREE.ShaderMaterial({vertexShader:buildingV,
   fragmentShader:buildingF(false,this.shadowedBuildings,false,false,false,false,true,this.princeRoofContact),
   uniforms:this.princeRoofContact?{...this.mat.uniforms,princeSkyWords:{value:princeSkyWords()}}:this.mat.uniforms,
   vertexColors:true,side:THREE.DoubleSide});
 }
 private readonly sourisLight?:SourisLighting;
 private readonly spinnakers?:SpinnakersScene;
 private readonly pinnedSpinnakers?:Bldg[];
 private readonly tryBeaconsfield:boolean;
 private readonly greenGablesGate:(()=>boolean)|undefined;
 private readonly barnGate:(()=>boolean)|undefined;
 private barnNearOnly=false;
 private pendingBarn?:{tile:BoundTile;owner:THREE.Mesh;source:ArrayBuffer};
 enableNearBarn(){this.barnNearOnly=true;}
 private barn?:{group:THREE.Group;owner:THREE.Mesh;views:CavendishBarnViews;dispose:(group:THREE.Group)=>void};
 private greenGables?:{group:THREE.Group;owner:THREE.Mesh;index:THREE.BufferAttribute;dispose:(group:THREE.Group)=>void};
 private beacon?:THREE.Group;
 private disposeBeacon?:(m:THREE.Group)=>void;
 private last={x:Infinity,z:Infinity};readonly mat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(),vertexColors:true,side:THREE.DoubleSide});
 private indianVariant?:ReturnType<typeof authenticatedOwnerVariant>;
 private readonly churchArt?:ChurchArt;
 private readonly pinnedChurch?:Bldg[];
 private readonly pinnedKingsCrown?:Bldg[];
 private readonly townWallOptics?:TownWallOptics;
 private readonly fittedWallMaterials=new Map<THREE.ShaderMaterial,THREE.ShaderMaterial>();
 private readonly tryStation?:RailwayReview;
 private station?:RailwayVariant;
 private pendingStandardRail?:{tile:BoundTile;owner:THREE.Mesh;source:ArrayBuffer};
 private readonly tryStDavids?:LocalExteriorReview;
 private stDavids?:Omit<RailwayVariant,'art'|'neighborsCaster'>&{art:StDavidsArt;neighborsCaster?:THREE.Mesh};
 private pendingStDavids?:{tile:BoundTile;owner:THREE.Mesh;source:ArrayBuffer};
 private standardWharf?:WharfLoader;
 private wharfOwner?:{owner:THREE.Mesh;mask:Cohort;started:boolean;near:boolean;
  art?:{variant:NonNullable<OwnerSlot>;dispose:()=>void}};
 enableStandardWharf(load:WharfLoader){this.standardWharf=load;}
 private syncStandardWharf(x:number,y:number,z:number){
  const w=this.wharfOwner,load=this.standardWharf;
  if(!w||!load)return;
  w.near=nearStandardWharf(x,y,z,w.art?.variant.visible);
  if(w.art){w.art.variant.sync(w.near);return;}
  if(!w.near||w.started)return;
  const stock=w.mask.stockForProof();
  if(!stock)return;
  w.started=true;
  const current=()=>this.wharfOwner===w&&w.owner.parent===this.scene&&this.wanted.has(SPINNAKERS_TILE);
  let deferred=false;
  const eligible=()=>{
   const valid=current()&&w.near&&w.mask.stockForProof()===stock;
   if(!valid)deferred=true;
   return valid;
  };
  void standardWharfPositionsAllow(stock).then(ok=>ok&&eligible()?load(eligible):undefined).then(art=>{
   if(!art){if(deferred&&current())w.started=false;return;}
   if(!eligible()){art.dispose();if(current())w.started=false;return;}
   const pins=w.mask.stockForProof()===stock?standardWharfDraw(stock,w.owner.userData.spinnakersSpans):undefined;
   const v=current()&&pins?w.mask.addMany(art.group,pins):undefined;
   if(!v){art.dispose();return;}
   this.scene.add(art.group);
   w.art={variant:v,dispose:art.dispose};
  }).catch(()=>{/** A missing optional package never hides the stock shells. */});
 }
 private georgetownCohort?:{owner:THREE.Mesh;mask:NonNullable<ReturnType<typeof authenticatedOwnerCohort>>};
 private olearySeat?:OlearySeat;private olearyStudy?:OlearyCohortStudy;private oleary?:OlearySocket|OlearyCohortSocket;
 private dalvaySeat?:DalvaySeat;private dalvay?:DalvaySocket;private dalvayGlass?:DalvayGlazingSource;
 private seacowSeat?:SeacowSeat;
 private seacow?:{owner:THREE.Mesh;intact:()=>boolean;retire:()=>void;originalMaterial:THREE.Material|THREE.Material[];art:ReturnType<typeof import('./seacow-exterior-art.ts')['makeSeacowExterior']>;view:NonNullable<ReturnType<typeof authenticatedOwnerVariant>>};
 private knightSeat?:KnightSeat;
 private knight?:{owner:THREE.Mesh;art:THREE.Group;originalMaterial:THREE.Material|THREE.Material[];
  current:()=>boolean;retire:()=>void;variant:NonNullable<ReturnType<typeof authenticatedOwnerVariant>>};
 private pointPrimEnabled=false;
 private primStock?:PointPrimStock;
 private primDraw?:PointPrimDrawLease;
 private sourisEastGround?:SourisEastGround;
 private summersideRoofCohort=false;
 private terminalWallFactory?:(owner:THREE.Mesh,tileId:string,bytes:ArrayBuffer,rows:readonly Bldg[])=>TerminalWallPreview;
 private terminalWall?:TerminalWallPreview;
 private sourisEastShadows?:BuildingShadows;
 private sourisEast?:{owner:THREE.Mesh;seated:()=>boolean;dispose:()=>void;
  variant:NonNullable<ReturnType<typeof authenticatedOwnerVariant>>;
  caster?:THREE.Mesh;neighborsCaster?:THREE.Mesh};

 private constructor(scene:THREE.Scene,t:Terrain,atlas:Tile[],pack:PackedBytes,atlasHash:string|undefined,sourisLight?:SourisLighting,casts?:BuildingShadows,spinnakers?:SpinnakersScene,pinnedSpinnakers?:Bldg[],tryBeaconsfield=false,greenGablesGate?:()=>boolean,barnGate?:()=>boolean,rusticoRoof=false,churchArt?:ChurchArt,pinnedChurch?:Bldg[],tryStation?:RailwayReview,tryStDavids?:LocalExteriorReview,pinnedKingsCrown?:Bldg[],townWallOptics?:TownWallOptics){
  this.townWallOptics=atlasHash===TOWN_WALL_ATLAS?townWallOptics:undefined;
  this.shadowedBuildings=!!casts;this.rusticoRoof=rusticoRoof;this.churchArt=churchArt;this.pinnedChurch=pinnedChurch;this.pinnedKingsCrown=pinnedKingsCrown;this.tryStation=tryStation;this.tryStDavids=tryStDavids;
  this.spinnakers=spinnakers;this.pinnedSpinnakers=pinnedSpinnakers;this.tryBeaconsfield=tryBeaconsfield;this.greenGablesGate=greenGablesGate;this.barnGate=barnGate;
  if(this.rusticoRoof&&!casts)this.rusticoNeutralMat=new THREE.ShaderMaterial({
   vertexShader:buildingV,fragmentShader:buildingF(false,false,false,false,false,false,true),vertexColors:true,side:THREE.DoubleSide});
  if(casts){this.mat.fragmentShader=buildingF(false,true);Object.assign(this.mat.uniforms,casts.uniforms);}
  if(sourisLight&&atlasHash===SOURIS_ROOF.atlasSha256){
   this.sourisLight=sourisLight;
   this.sourisMat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(true,!!casts),uniforms:{...sourisLight.uniforms,...casts?.uniforms},vertexColors:true,side:THREE.DoubleSide});
  }
  if(atlasHash===WATER_STREET_LAYER&&scene.environment){
   this.waterStreetMat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(false,!!casts,true),
    uniforms:{waterStreetSky:{value:scene.environment},...casts?.uniforms},vertexColors:true,side:THREE.DoubleSide});
  }
  if(atlasHash===VICTORIA_ATLAS&&scene.environment){
   this.victoriaMat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(false,!!casts,false,true),
    uniforms:{victoriaSky:{value:scene.environment},...casts?.uniforms},vertexColors:true,side:THREE.DoubleSide});
  }
  if(atlasHash===MONTAGUE_HALL_ATLAS&&scene.environment){
   this.montagueMat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(false,!!casts,false,false,true),
    uniforms:{montagueSky:{value:scene.environment},...casts?.uniforms},vertexColors:true,side:THREE.DoubleSide});
  }
  if(atlasHash===MCLEAN_ATLAS&&scene.environment){
   this.sourisMcleanMat=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(false,!!casts,false,false,false,true),
    uniforms:{sourisMcleanSky:{value:scene.environment},...casts?.uniforms},vertexColors:true,side:THREE.DoubleSide});
  }
  this.fitted=supportedRoofAtlas(atlasHash);this.farms=farmRoofAtlas(atlasHash);this.homes=homeRoofAtlas(atlasHash);
  this.atlasHash=atlasHash;this.t=t;this.scene=scene;this.pack=pack;this.tiles=atlas.map(a=>{const [w,s,e,n]=a.bounds,p=project(w,n),q=project(e,s);return {...a,x1:p.x,x2:q.x,z1:p.z,z2:q.z};});
 }
 private static async openAtlas(signal?:AbortSignal):Promise<PreparedAtlas>{
  const path=import.meta.env.BASE_URL+'world/buildings/',mf=await fetch(path+'index.json',signal?{signal}:undefined);
  if(!mf.ok)throw Error('Building atlas not available.');
  const a=(await mf.json()) as {file:string;bytes:number;tiles:Tile[];sha256?:string};
  if(a.file!=='tiles.pack'||!Number.isSafeInteger(a.bytes)||a.bytes<=0||!Array.isArray(a.tiles)||!a.tiles.length||
     a.tiles.some(t=>!Number.isSafeInteger(t.offset)||!Number.isSafeInteger(t.bytes)||t.offset<0||t.bytes<=0||t.bytes>a.bytes-t.offset)){
   throw Error('Invalid building atlas index.');
  }
  return {atlas:a.tiles,pack:new PackedBytes(path+a.file,a.bytes,(input,init)=>fetch(input,signal?{...init,signal}:init)),atlasHash:a.sha256};
 }
 private static async decodeChunk(part:ArrayBuffer){
  const result=await new Response(new Blob([part]).stream().pipeThrough(new DecompressionStream('gzip'))).json() as {features:Bldg[]};
  return result.features;
 }
 private static async decode(tile:Tile,pack:PackedBytes){
  return Buildings.decodeChunk(await pack.read(tile.offset,tile.bytes));
 }
 /** Bank activation and scene assembly use the same immutable verified
  * q032001 bytes. A second network read cannot orphan the live bank. */
 static async prepareBaywalk(){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),2200);
  try{
   const ready=await Buildings.openAtlas(c.signal);
   const tile=ready.atlas.find(t=>t.id===SPINNAKERS_TILE);
   if(!tile||tile.bytes!==20163||!globalThis.crypto?.subtle)return;
   const part=await ready.pack.read(tile.offset,tile.bytes);
   const hash=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',part));
   const digest=Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
   if(digest!==SPINNAKERS_SHELLS.recordBytesHash)return;
   const rows=await Buildings.decodeChunk(part);
   if(matchesSpinnakersShells(ready.atlasHash,tile.id,rows))return {...ready,spinnakers:rows};
  }catch{/** Ordinary C and stock still have their normal fallback. */}
  finally{clearTimeout(timer);}
 }
 /** No visual, grade, or stock omission without the exact whole readable owner. */
 static async prepareIndianRiver(){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),2600);
  try{
   const ready=await Buildings.openAtlas(c.signal);
   const tile=ready.atlas.find(t=>t.id===CHURCH.tile);
   if(!tile||ready.atlasHash!==CHURCH.atlas||tile.offset!==CHURCH.offset||tile.bytes!==CHURCH.size)return;
   const part=await ready.pack.read(tile.offset,tile.bytes);
   if(!await churchOwnerBytes(part)||c.signal.aborted)return;
   const rows=await Buildings.decodeChunk(part);
   if(!c.signal.aborted&&churchOwnerSource(ready.atlasHash,tile,rows))return {...ready,indianRiver:rows};
  }catch{/** Standard building loading remains the fallback. */}
  finally{clearTimeout(timer);}
 }
 static async prepareKingsDryCrown(get:typeof fetch=fetch,ms=1450):Promise<PreparedAtlas|undefined>{
  const path=(import.meta.env?.BASE_URL??'/')+'world/buildings/';
  const ready=await readKingsCrownBuildings(path,Buildings.decodeChunk,get,ms);
  if(!ready)return;
  // Ordinary loading of every other owner is unchanged. After eviction this
  // one staged owner still uses the same proven rows, never a second read.
  return {atlas:ready.spec.tiles,pack:new PackedBytes(ready.file,ready.spec.bytes,get),
   atlasHash:ready.spec.sha256,kingsCrown:ready.rows};
 }
 static async create(scene:THREE.Scene,terrain:Terrain,sourisLight?:SourisLighting,casts?:BuildingShadows,spinnakers?:Promise<SpinnakersScene|undefined>,verified?:Promise<PreparedAtlas|undefined>,tryBeaconsfield=false,greenGablesGate?:()=>boolean,barnGate?:()=>boolean,rusticoRoof=false,churchArt?:ChurchArt,tryStation?:RailwayReview,tryStDavids?:LocalExteriorReview,townWallOptics?:TownWallOptics){
  const ready=(verified?await verified:undefined)??await Buildings.openAtlas();
  return new Buildings(scene,terrain,ready.atlas,ready.pack,ready.atlasHash,sourisLight,casts,spinnakers?await spinnakers:undefined,ready.spinnakers,tryBeaconsfield,greenGablesGate,barnGate,rusticoRoof,churchArt,ready.indianRiver,tryStation,tryStDavids,ready.kingsCrown,townWallOptics);
 }
 get townWallReview(){return this.townWallOptics!==undefined&&this.townWallOptics.mode!=='core';}
 get townWallProfile(){return this.townWallOptics===undefined?undefined:this.townWallOptics.mode??'expanded';}
 get indianRiverPrepared(){return !!this.indianVariant;}
 enableSummersideRoofCohort(){this.summersideRoofCohort=true;}
 enableSourisEast(request:SourisEastGround,shadows?:BuildingShadows){this.sourisEastGround=request;this.sourisEastShadows=shadows;}
 enableOlearyExterior(seat:OlearySeat,study?:OlearyCohortStudy){this.olearySeat=seat;this.olearyStudy=study;}
 get olearyExteriorActive(){return this.oleary?.active===true;}
 get olearyWarehouseActive(){return this.oleary instanceof OlearyCohortSocket&&this.oleary.warehouseActive;}
 get olearyIndustrialActive(){return this.oleary instanceof OlearyCohortSocket&&this.oleary.industrialActive;}
 enableDalvayExterior(seat:DalvaySeat,glazing?:DalvayGlazingSource){this.dalvaySeat=seat;this.dalvayGlass=glazing;}
 get dalvayExteriorActive(){return this.dalvay?.active===true;}
 enableSeacowExterior(seat:SeacowSeat){this.seacowSeat=seat;}
 get seacowExteriorActive(){return this.seacow?.view.visible===true;}
 private syncSeacow(){
  const p=this.seacow;if(!p)return;
  p.view.sync(p.owner.parent===this.scene&&p.owner.visible&&p.owner.material===p.originalMaterial&&
   p.art.group.parent===this.scene&&p.intact()&&!this.scene.overrideMaterial&&this.seacowSeat?.resident()===true);
 }
 private async promoteSeacow(owner:THREE.Mesh,raw:ArrayBuffer,rows:number,row:unknown,seat:SeacowSeat){
  const present=()=>this.meshes.get(SEACOW.id)===owner&&owner.parent===this.scene&&this.wanted.has(SEACOW.id)&&!this.seacow;
  if(!present())return;
  try{
   if(!(await seacowSource(raw,rows,row,owner))||!await seat.verifiedCover()||!present())return;
   const {makeSeacowExterior}=await import('./seacow-exterior-art.ts');if(!present())return;
   const art=makeSeacowExterior(seat.floor),view=authenticatedOwnerVariant(owner,art.group,owner.userData.beaconTriangles,SEACOW.proof);
   if(!view){art.dispose();return;}
   // Removing a child, or replacing its draw or local transform, must never leave a
   // partial lighthouse beside a missing original. Capture once; polling has no allocations.
   const group=art.group,base=group.position.clone(),rot=group.quaternion.clone(),scale=group.scale.clone();
   const parts=group.children.map(x=>{const m=x as THREE.Mesh<THREE.BufferGeometry,THREE.Material>;
    return {m,geo:m.geometry,mat:m.material,attrib:m.geometry.getAttribute('position'),layers:m.layers.mask,position:m.position.clone(),rotation:m.quaternion.clone(),scale:m.scale.clone()};
   });
   const intact=()=>{
    if(parts.length!==4||group.children.length!==4||!group.matrixAutoUpdate||!group.position.equals(base)||!group.quaternion.equals(rot)||!group.scale.equals(scale))return false;
    for(let i=0;i<parts.length;i++){const p=parts[i],m=p.m;
     if(group.children[i]!==m||m.parent!==group||!m.visible||m.geometry!==p.geo||m.material!==p.mat||!m.material.visible||m.layers.mask!==p.layers||!m.matrixAutoUpdate||
       m.geometry.index!==null||m.geometry.drawRange.start!==0||m.geometry.drawRange.count!==Infinity||m.geometry.getAttribute('position')!==p.attrib||
       !m.position.equals(p.position)||!m.quaternion.equals(p.rotation)||!m.scale.equals(p.scale))return false;
    }
    return true;
   };
   const retire=()=>{view.dispose();for(const p of parts){p.geo.dispose();p.mat.dispose();}group.removeFromParent();};
   this.scene.add(group);this.seacow={owner,art,view,intact,retire,originalMaterial:owner.material};this.syncSeacow();
  }catch{/** Missing module, invalid seat or mismatched geometry leaves the original full tile in place. */}
 }
 enableKnightExterior(seat:KnightSeat){this.knightSeat=seat;}
 get knightExteriorActive(){return this.knight?.variant.visible===true;}
 private syncKnight(){
  const p=this.knight;if(!p)return;
  p.variant.sync(p.owner.parent===this.scene&&p.owner.visible&&p.owner.material===p.originalMaterial&&
   p.art.parent===this.scene&&p.current()&&!this.scene.overrideMaterial&&this.knightSeat?.resident()===true);
 }
 private async promoteKnight(owner:THREE.Mesh,raw:ArrayBuffer,rows:number,row:unknown,seat:KnightSeat){
  const pending=()=>this.meshes.get(KNIGHT_SEAT.id)===owner&&owner.parent===this.scene&&this.wanted.has(KNIGHT_SEAT.id)&&!this.knight;
  if(!pending())return;
  try{
   if(!await knightExactOwner(raw,rows,row,owner)||!await seat.verifiedCover()||!pending())return;
   const {drawKnightTower}=await import('./souris-knight-art.ts');if(!pending())return;
   const art=drawKnightTower(seat.floor),p=art.position.clone(),q=art.quaternion.clone(),s=art.scale.clone();
   const parts=art.children.map(o=>{
    const m=o as THREE.Mesh<THREE.BufferGeometry,THREE.Material>,g=m.geometry;
    return {m,g,material:m.material,uniformPosition:g.getAttribute('position'),layers:m.layers.mask,
      position:m.position.clone(),quaternion:m.quaternion.clone(),scale:m.scale.clone()};
   });
   const current=()=>parts.length===4&&art.children.length===4&&art.matrixAutoUpdate&&art.position.equals(p)&&art.quaternion.equals(q)&&art.scale.equals(s)&&
    parts.every(({m,g,material,uniformPosition,layers,position,quaternion,scale},i)=>art.children[i]===m&&m.parent===art&&m.visible&&m.material===material&&material.visible&&
     m.geometry===g&&g.getAttribute('position')===uniformPosition&&m.layers.mask===layers&&!g.index&&g.drawRange.start===0&&g.drawRange.count===Infinity&&
     m.matrixAutoUpdate&&m.position.equals(position)&&m.quaternion.equals(quaternion)&&m.scale.equals(scale));
   const variant=authenticatedOwnerVariant(owner,art,owner.userData.beaconTriangles,KNIGHT_SEAT.proof);
   const dispose=()=>{for(const part of parts){part.g.dispose();part.material.dispose();}art.removeFromParent();};
   if(!variant){dispose();return;}
   this.scene.add(art);this.knight={owner,art,originalMaterial:owner.material,current,variant,retire:()=>{variant.dispose();dispose();}};
   this.syncKnight();
  }catch{/** Optional art never removes the actual original building on failure. */}
 }
 enablePointPrim(){this.pointPrimEnabled=true;}
 get pointPrimSource(){
  const q=this.primStock;
  return q&&this.currentPointPrim(q)?q:undefined;
 }
 private currentPointPrim(q:PointPrimStock){
  return this.primStock===q&&this.meshes.get(POINT_PRIM.tile)===q.mesh&&this.wanted.has(POINT_PRIM.tile)&&
   q.mesh.parent===this.scene&&q.mesh.visible;
 }
 /** This only authenticates an already submitted ordinary owner. The returned
  * capability attaches no geometry until the synchronous frame transaction. */
 async verifyPointPrim(q:PointPrimStock):Promise<PointPrimVerifiedOwner|undefined>{
  const present=()=>this.currentPointPrim(q);
  if(!present()||!await pointPrimDrawSource(q)||!present()||q.mesh.geometry!==q.geometry)return;
  return {source:q,present,mount:group=>{
   if(!present()||this.primDraw||q.mesh.geometry!==q.geometry||group.parent)return;
   const s=q.mesh.userData.beaconTriangles as readonly [number,number];
   const v=authenticatedOwnerVariant(q.mesh,group,s,POINT_PRIM.proof);
   if(!v)return;
   group.visible=false;this.scene.add(group);
   let closed=false;
   const lease:PointPrimDrawLease={
    present:()=>!closed&&present()&&group.parent===this.scene,active:()=>!closed&&v.visible,
    set:show=>{if(!closed)v.sync(show&&lease.present());return lease.active();},
    release:()=>{
     if(closed)return;closed=true;v.dispose();group.removeFromParent();
     if(this.primDraw===lease)this.primDraw=undefined;
    }
   };
   this.primDraw=lease;
   return lease;
  }};
 }
 get summersideWaterRoofActive(){return this.meshes.get('q032001')?.userData.measuredWaterRoof===true;}
 get summersideRoofCount(){
  return (this.meshes.get('q032001')?.userData.measuredDowntownRoofs??0)+(this.meshes.get('q03200300')?.userData.measuredDowntownRoofs??0);
 }
 get sourisEastActive(){return this.sourisEast?.variant.visible??false;}
 syncIndianRiver(){this.indianVariant?.sync(this.churchArt?.active()??false);}
 get indianRiverActive(){return this.indianVariant?.visible??false;}
 get rusticoMassingPreviewActive(){return this.meshes.get(RUSTICO_MASSING_TILE)?.userData.rusticoMassing===true;}
 update(x:number,z:number,barnAgl=Infinity,aircraftY=Infinity){
  this.syncStandardWharf(x,aircraftY,z);
  this.syncCavendish(x,z,barnAgl);
  this.syncStation(x,z);
  this.syncStDavids(x,z);
  this.syncSourisEast();this.syncSourisWestFacing();this.syncSeacow();this.syncKnight();this.dalvay?.sync();this.oleary?.sync();
  this.indianVariant?.sync(this.churchArt?.active()??false);
  if(this.spinnakers?.north?.group.parent?.parent)this.spinnakers.north.sync();
  if(Math.hypot(x-this.last.x,z-this.last.z)>260){
   this.last={x,z};const d=(a:BoundTile)=>Math.hypot(x-clamp(x,a.x1,a.x2),z-clamp(z,a.z1,a.z2));
   const near=this.tiles.filter(t=>d(t)<5300).sort((a,b)=>d(a)-d(b));this.wanted=new Set(near.map(a=>a.id));
   this.work=near.filter(t=>!this.meshes.has(t.id)&&!this.loading.has(t.id)&&!this.failed.has(t.id));
   for(const [id,m] of this.meshes)if(!this.wanted.has(id)){
    if(m===this.sourisWestLease?.owner)this.releaseSourisWestFacing();
    if(m===this.oleary?.owner){this.oleary.dispose();this.oleary=undefined;}
    if(m===this.dalvay?.owner){this.dalvay.dispose();this.dalvay=undefined;}
    if(m===this.seacow?.owner){this.seacow.retire();this.seacow=undefined;}
    if(m===this.knight?.owner){this.knight.retire();this.knight=undefined;}
    if(m===this.primStock?.mesh){this.primDraw?.release();this.primStock=undefined;}
    if(m===this.sourisEast?.owner){
     if(this.sourisEast.variant.visible)this.sourisEastShadows?.leaseOwnerChanged();
     this.sourisEast.variant.dispose();this.sourisEast.dispose();this.sourisEast=undefined;
    }
    if(this.pendingStandardRail?.owner===m)this.pendingStandardRail=undefined;
    if(id===RAIL.tile&&this.station){
     if(this.station.variant?.visible)this.tryStation?.shadows?.leaseOwnerChanged();
     this.station.variant?.dispose();this.station.art.dispose();this.station=undefined;
    }
    if(this.wharfOwner?.owner===m){
     this.wharfOwner.mask.dispose();this.wharfOwner.art?.dispose();this.wharfOwner=undefined;
    }
    if(id===ST_DAVID.tile){
     const st=this.stDavids;
     if(st?.owner===m){
      if(st.variant?.visible)this.tryStDavids?.shadows?.leaseOwnerChanged();
      st.variant?.dispose();st.art.dispose();this.stDavids=undefined;
     }
     if(this.pendingStDavids?.owner===m)this.pendingStDavids=undefined;
     if(this.georgetownCohort?.owner===m){
      this.georgetownCohort.mask.dispose();this.georgetownCohort=undefined;
     }
    }
    if(id===CHURCH.tile&&this.indianVariant){this.indianVariant.dispose();this.indianVariant=undefined;this.churchArt?.group.removeFromParent();}
    if(this.pendingBarn?.owner===m)this.pendingBarn=undefined;
    this.scene.remove(m);if(id===BEACON_REVIEW.tile&&this.beacon){this.scene.remove(this.beacon);this.disposeBeacon?.(this.beacon);this.beacon=undefined;}if(id===GREEN_GABLES_BARN.tile&&this.barn){
     m.geometry=this.barn.views.stock;this.barn.views.dispose();
     this.scene.remove(this.barn.group);this.barn.dispose(this.barn.group);this.barn=undefined;
    }
    if(id===GREEN_GABLES_REVIEW.tile&&this.greenGables){
     // Always release any previously uploaded optional index, even from the stock draw.
     m.geometry.setIndex(this.greenGables.index);
     this.scene.remove(this.greenGables.group);this.greenGables.dispose(this.greenGables.group);this.greenGables=undefined;
    }
    if(id===TERMINAL_WIRE.id){this.terminalWall?.dispose();this.terminalWall=undefined;}
    if(this.chunkObserver?.id===id){this.chunkObserver.content=undefined;this.chunkObserver.mesh=undefined;}
    if(id===SPINNAKERS_TILE&&this.spinnakers?.assembled)this.scene.remove(this.spinnakers.assembled);m.geometry.dispose();this.meshes.delete(id);if(id===SOURIS_ROOF.sourceTileId&&this.sourisLight)void this.sourisLight.setCaster(false);}
  }
  // Bound decompression and mesh creation to one tile per application frame, with bounded inflight loads.
  if(this.work.length&&this.loading.size<2){const tile=this.work.shift()!;void this.load(tile);}
 }
 drawableCasters(x:number,z:number,r:number,out:THREE.Mesh[]){
  const add=(m:THREE.Mesh)=>{
   const b=m.geometry.boundingSphere;
   if(m.visible&&b&&Math.hypot(x-m.position.x-b.center.x,z-m.position.z-b.center.z)<r+b.radius)out.push(m);
  };
  for(const m of this.meshes.values()){
   const east=this.sourisEast;
   if(east?.owner===m&&east.variant.visible&&east.caster&&east.neighborsCaster){
    add(east.neighborsCaster);add(east.caster);continue;
   }
   const exterior=this.station?.owner===m&&this.tryStation?.shadows?this.station:this.stDavids?.owner===m&&this.tryStDavids?.shadows?this.stDavids:undefined;
   if(exterior?.variant?.visible&&exterior.art.caster&&exterior.neighborsCaster){
    // Distinct roster identities invalidate the former flat owner's depth
    // exactly when its visual owner view changes.
    add(exterior.neighborsCaster);add(exterior.art.caster);
   }else add(m);
  }
 }
 get summersideStationActive(){return this.station?.variant?.visible??false;}
 private syncStation(x:number,z:number){
  const request=this.tryStation,s=this.station,queued=this.pendingStandardRail;
  if(!request||(!s&&!queued))return;
  const inRange=!request.standard||Math.hypot(x-RAIL.originXZ[0],z-RAIL.originXZ[1])<(s?.variant?.visible?2700:2250);
  const seated=inRange&&request.ground();
  if(s){
   const before=s.variant?.visible;
   s.variant?.sync(seated);
   if(before!==s.variant?.visible)request.shadows?.leaseOwnerChanged();
   if(s.variant?.visible)s.neighborsCaster.geometry=s.owner.geometry;
  }else if(queued&&seated){
   this.pendingStandardRail=undefined;
   void this.promoteStation(queued.tile,queued.owner,queued.source,request);
  }
 }
 get stDavidsActive(){return this.stDavids?.variant?.visible??false;}
 private syncStDavids(x:number,z:number){
  const request=this.tryStDavids,art=this.stDavids,pending=this.pendingStDavids;
  if(!request||(!art&&!pending))return;
  const inRange=!request.standard||Math.hypot(x-ST_DAVID.originXZ[0],z-ST_DAVID.originXZ[1])<(art?.variant?.visible?2700:2250);
  const seated=inRange&&request.ground();
  if(art){
   const before=art.variant?.visible;
   art.variant?.sync(seated);
   if(before!==art.variant?.visible)request.shadows?.leaseOwnerChanged();
   if(art.variant?.visible&&art.neighborsCaster)art.neighborsCaster.geometry=art.owner.geometry;
  }else if(pending&&seated){
   this.pendingStDavids=undefined;
   void this.promoteStDavids(pending,request);
  }
 }
 get beaconsfieldPreviewActive(){return !!this.beacon?.parent;}
 get greenGablesPreviewActive(){return this.greenGables?.group.visible??false;}
 private syncGreenGables(){
  if(!this.greenGables)return;
  const {group,owner,index}=this.greenGables;
  const show=this.greenGablesGate?.()??false;
  const stock=this.barn?.owner===owner?this.barn.views.stock:owner.geometry;
  if(group.visible!==show){stock.setIndex(show?index:null);group.visible=show;}
 }
 get greenGablesBarnPreviewActive(){return this.barn?.group.visible??false;}
 private syncCavendish(x=Infinity,z=Infinity,agl=Infinity){
  // An async artwork completion is not a new aircraft position.
  if(this.barnNearOnly&&(!Number.isFinite(x)||!Number.isFinite(z)))return;
  this.syncGreenGables();
  const seated=()=>this.barnGate?.()??false;
  const visible=this.barn?.group.visible;
  const near=!this.barnNearOnly||(agl<(visible?730:540)&&
   Math.hypot(x-GREEN_GABLES_BARN.gameXZ[0],z-GREEN_GABLES_BARN.gameXZ[1])<(visible?2700:2250));
  if(!this.barn){
   if(this.pendingBarn&&near&&seated()){
    const {tile,owner,source}=this.pendingBarn;this.pendingBarn=undefined;
    void this.promoteBarn(tile,owner,source);
   }
   return;
  }
  const {group,owner,views}=this.barn,home=this.greenGables;
  const g=near&&seated()?views.withBarn(home?.owner===owner&&home.group.visible?home.index:null):undefined;
  owner.geometry=g??views.stock;group.visible=g!==undefined;
 }
 get spinnakersActive(){return !!this.spinnakers?.assembled?.parent||this.wharfOwner?.art?.variant.visible===true;}
 get northBaywalkActive(){return this.spinnakersActive&&!!this.spinnakers?.north?.group.visible;}
 get northConcreteActive(){return this.northBaywalkActive&&!!this.spinnakers?.north?.sidewalk;}
 enableTerminalWallPreview(renderer:THREE.WebGLRenderer,camera:THREE.Camera,trackDraw:boolean){
  this.terminalWallFactory=(owner,id,bytes,rows)=>{
   const stock=owner.geometry;
   const actor=new TerminalWallPreview(owner,this.scene,()=>owner.parent===this.scene&&this.meshes.get(id)===owner&&this.wanted.has(id)&&
    (owner.geometry===stock||(this.wharfOwner?.owner===owner&&this.wharfOwner.mask.stockForProof()===stock)||
     (this.station?.owner===owner&&this.station.stockForProof?.()===stock)),{renderer,camera,trackDraw});
   void actor.verify(this.atlasHash,id,bytes,rows);
   return actor;
  };
 }
 syncTerminalWall(){this.terminalWall?.sync();}
 get terminalWallActive(){return this.terminalWall?.active===true;}
 get terminalWallDrawn(){return this.terminalWall?.rendered===true;}
 /** Observe bytes already requested by the ordinary building streamer. An observer
  * cannot start a download or replace a mesh. A reloaded owner has a new identity. */
 private chunkObserver?:{id:string;offset:number;size:number;content?:ArrayBuffer;mesh?:THREE.Mesh};
 observeSourceChunk(id:string,offset:number,size:number){
  const o=this.chunkObserver={id,offset,size,content:undefined as ArrayBuffer|undefined,mesh:undefined as THREE.Mesh|undefined};
  return ()=>o.mesh&&o.mesh.parent===this.scene&&o.mesh.visible&&this.meshes.get(id)===o.mesh&&this.wanted.has(id)?o.content:undefined;
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
   const spec=this.tryBeaconsfield&&tile.id===BEACON_REVIEW.tile?BEACON_REVIEW:
    this.greenGablesGate&&tile.id===GREEN_GABLES_REVIEW.tile?GREEN_GABLES_REVIEW:undefined;
   const barnSpec=this.barnGate&&tile.id===GREEN_GABLES_BARN.tile?GREEN_GABLES_BARN:undefined;
   const pinned=spec??barnSpec;
   const candidate=pinned&&this.atlasHash===pinned.pack&&tile.offset===pinned.offset&&
    tile.bytes===pinned.bytes&&!!globalThis.crypto?.subtle;
   const rusticoCandidate=this.rusticoRoof&&tile.id===RUSTICO_MASSING_TILE&&!!globalThis.crypto?.subtle;
   const harbourRoofCandidate=this.rusticoHarbourRoof&&rusticoHarbourRoofAtlasAllows(this.atlasHash,tile)&&!!globalThis.crypto?.subtle;
   const olearyAccessCandidate=this.olearyAccessRoof&&!this.olearySeat&&olearyAccessRoofTile(this.atlasHash,tile)&&!!globalThis.crypto?.subtle;
   const sourisWestCandidate=!!this.sourisWestLink&&sourisFacingOwnerTile(this.atlasHash,tile)&&!!globalThis.crypto?.subtle;
   const princeCandidate=this.princeSurveyRoof&&princeRoofOwner(this.atlasHash,tile)&&!!globalThis.crypto?.subtle;
   const tryStation=!!this.tryStation&&!this.spinnakers&&railAtlasAllows(this.atlasHash,tile);
   const tryStDavids=!!this.tryStDavids&&stDavidsAtlasAllows(this.atlasHash,tile);
   const seacow=this.seacowSeat&&seacowOwner(this.atlasHash,tile)?this.seacowSeat:undefined;
   let seacowBytes:ArrayBuffer|undefined;
   const oleary=this.olearySeat&&olearyAtlasOwner(this.atlasHash,tile)?this.olearySeat:undefined;
   const olearyStudy=oleary?this.olearyStudy:undefined;
   const dalvay=this.dalvaySeat&&dalvayOwner(this.atlasHash,tile)?this.dalvaySeat:undefined;
   let dalvayBytes:ArrayBuffer|undefined,olearyBytes:ArrayBuffer|undefined;
   const knight=this.knightSeat&&knightOwns(this.atlasHash,tile)?this.knightSeat:undefined;
   let knightBytes:ArrayBuffer|undefined;
   const tryPointPrim=this.pointPrimEnabled&&pointPrimOwner(this.atlasHash,tile);
   const east=this.sourisEastGround&&crockettAtlasCandidate(this.atlasHash,tile)?this.sourisEastGround:undefined;
   let eastBytes:ArrayBuffer|undefined;
   const downtown=this.summersideRoofCohort?downtownTilePin(this.atlasHash,tile):undefined;
   let downtownVerified=false;
   let features:Bldg[],ownerBytes:ArrayBuffer|undefined,barnBytes:ArrayBuffer|undefined,stationBytes:ArrayBuffer|undefined,stDavidsBytes:ArrayBuffer|undefined,massingChunk:string|undefined;
   const observer=this.chunkObserver,tapped=observer&&observer.id===tile.id&&observer.offset===tile.offset&&observer.size===tile.bytes;
   let observed:ArrayBuffer|undefined;
   let primBytes:ArrayBuffer|undefined;
   const terminal=this.terminalWallFactory&&!this.spinnakers&&downtown?.id===TERMINAL_WIRE.id?this.terminalWallFactory:undefined;
   let terminalBytes:ArrayBuffer|undefined;
   if(candidate||princeCandidate||rusticoCandidate||harbourRoofCandidate||olearyAccessCandidate||sourisWestCandidate||tryStation||tryStDavids||east||downtown||tryPointPrim||seacow||knight||dalvay||oleary||tapped){
    const raw=await this.pack.read(tile.offset,tile.bytes);
    // Only the signed downtown chunk needs this check, with no duplicate
    // download and an unchanged stock decoder on a crypto or pin failure.
    const downtownCheck=downtown?downtownWireAllows(downtown,raw):undefined;
    features=await Buildings.decodeChunk(raw);
    if(tapped)observed=raw;
    if(terminal)terminalBytes=raw;
    if(seacow)seacowBytes=raw;
    if(dalvay)dalvayBytes=raw;
    if(oleary)olearyBytes=raw;
    if(knight)knightBytes=raw;
    if(tryPointPrim)primBytes=raw;
    if(downtownCheck)downtownVerified=await downtownCheck;
    if(east&&crockettExactRow(features))eastBytes=raw;
    if(spec&&matchesExterior(features,spec))ownerBytes=raw;
    if(barnSpec&&matchesExterior(features,barnSpec))barnBytes=raw;
    if(tryStation&&railOwnerAllows(features))stationBytes=raw;
    if(tryStDavids&&stDavidsOwnerAllows(features))stDavidsBytes=raw;
    // Bounded appearances share a single digest of the already-read chunk.
    if(rusticoCandidate||princeCandidate||harbourRoofCandidate||olearyAccessCandidate||sourisWestCandidate)try{
     const digest=await crypto.subtle.digest('SHA-256',raw);
     massingChunk=Array.from(new Uint8Array(digest),c=>c.toString(16).padStart(2,'0')).join('');
    }catch{/** A crypto failure is stock geometry, not a missing streamed tile. */}

   }else if(tile.id===KINGS_CROWN_BUILDINGS.tile&&this.pinnedKingsCrown)features=this.pinnedKingsCrown;
   else if(tile.id===CHURCH.tile&&this.pinnedChurch)features=this.pinnedChurch;
   else features=tile.id===SPINNAKERS_TILE&&this.pinnedSpinnakers?this.pinnedSpinnakers:await Buildings.decode(tile,this.pack);
   if(!this.wanted.has(tile.id))return;
   const sp=this.spinnakers;
   let wharf:THREE.Group|undefined;
   if(sp&&matchesSpinnakersShells(this.atlasHash,tile.id,features)){
    try{
     if(!sp.assembled){
      const roofs=buildSpinnakersShells(sp.seat);
      sp.assembled=new THREE.Group();sp.assembled.name='Summerside Spinnakers’ Landing visual preview';
      sp.assembled.add(sp.deck,roofs);
      const north=sp.north=sp.assembleNorth?.();
      if(north)sp.assembled.add(north.group);
     }
     wharf=sp.assembled;
    }catch{/** Optional site art must not suppress stock buildings when it cannot seat. */}
   }
   const church=features===this.pinnedChurch?this.churchArt:undefined;
   const trackWharf=!!this.standardWharf&&downtownVerified&&downtown?.id===SPINNAKERS_TILE&&downtown.sha256===SPINNAKERS_SHELLS.recordBytesHash&&
    matchesSpinnakersShells(this.atlasHash,tile.id,features);
   const mesh=this.generate(features,tile,!!wharf,church?CHURCH.ordinal:ownerBytes?spec?.ordinal:stationBytes?RAIL.ordinal:stDavidsBytes?ST_DAVID.ordinal:eastBytes?SOURIS_EAST.ordinal:primBytes?POINT_PRIM.ordinal:seacowBytes?SEACOW.ordinal:knightBytes?KNIGHT_SEAT.ordinal:dalvayBytes?DALVAY.ordinal:olearyBytes&&(!olearyStudy||olearyStudy.station)?OLEARY.ordinal:undefined,!!barnBytes,massingChunk,downtownVerified,trackWharf,!!olearyStudy,!!olearyStudy?.warehouse);
   if(tapped&&observer){observer.content=observed;observer.mesh=mesh;}
   this.meshes.set(tile.id,mesh);this.scene.add(mesh);if(wharf)this.scene.add(wharf);
   if(sourisWestCandidate)void this.stageSourisWestFacing(mesh);
   if(trackWharf&&standardWharfDraw(mesh.geometry,mesh.userData.spinnakersSpans)){
    const mask=authenticatedOwnerCohort(mesh);
    if(mask)this.wharfOwner={owner:mesh,mask,started:false,near:false};
   }
   if(terminal&&terminalBytes&&downtownVerified){this.terminalWall?.dispose();this.terminalWall=terminal(mesh,tile.id,terminalBytes,features);}
   if(oleary&&olearyBytes){
    this.oleary?.dispose();
    this.oleary=olearyStudy?new OlearyCohortSocket(this.scene,mesh,olearyBytes,features.length,features[OLEARY.ordinal],features[OLEARY_INDUSTRIAL.ordinal],oleary,olearyStudy.warehouse?{...olearyStudy,warehouse:{...olearyStudy.warehouse,row:features[OLEARY_WAREHOUSE.ordinal]}}:olearyStudy,()=>this.meshes.get(tile.id)===mesh&&this.wanted.has(tile.id)):
     new OlearySocket(this.scene,mesh,olearyBytes,features.length,features[OLEARY.ordinal],oleary);
    this.oleary.sync();
   }
   if(dalvay&&dalvayBytes){
    const glazing=this.dalvayGlass;
    this.dalvay?.dispose();
    this.dalvay=new DalvaySocket(this.scene,mesh,dalvayBytes,features.length,features[DALVAY.ordinal],dalvay,glazing?
     async signal=>(await import('./dalvay-art-packet.ts')).loadDalvay((import.meta.env?.BASE_URL??'/')+'art/',signal,fetch,glazing):undefined);
    this.dalvay.sync();
   }
   if(seacow&&seacowBytes)void this.promoteSeacow(mesh,seacowBytes,features.length,features[SEACOW.ordinal],seacow);
   if(knight&&knightBytes)void this.promoteKnight(mesh,knightBytes,features.length,features[KNIGHT_SEAT.ordinal],knight);
   if(primBytes&&features[POINT_PRIM.ordinal]){
    this.primStock={mesh,geometry:mesh.geometry,wire:primBytes,count:features.length,row:JSON.stringify(features[POINT_PRIM.ordinal])};
   }
   if(church&&mesh.userData.beaconTriangles){
    const v=authenticatedOwnerVariant(mesh,church.group,mesh.userData.beaconTriangles,CHURCH.owner);
    if(v){this.indianVariant=v;this.scene.add(church.group);v.sync(church.active());}
   }
   // The ordinary whole tile is already visible. Do not put buildings on the
   // renderer's streaming queue behind an optional module or art response.
   if(ownerBytes&&spec){
    if(spec===BEACON_REVIEW)void this.promoteBeaconsfield(tile,mesh,ownerBytes);
    else void this.promoteGreenGables(tile,mesh,ownerBytes);
   }
   if(barnBytes){
    if(this.barnNearOnly)this.pendingBarn={tile,owner:mesh,source:barnBytes};
    else void this.promoteBarn(tile,mesh,barnBytes);
   }
   if(stationBytes&&this.tryStation){
    if(this.tryStation.standard)this.pendingStandardRail={tile,owner:mesh,source:stationBytes};
    else void this.promoteStation(tile,mesh,stationBytes,this.tryStation);
   }
   if(stDavidsBytes)this.pendingStDavids={tile,owner:mesh,source:stDavidsBytes};
   if(eastBytes&&east)void this.promoteSourisEast(tile,mesh,eastBytes,east);
   if(this.sourisLight&&tile.id===SOURIS_ROOF.sourceTileId){
    void this.sourisLight.setCaster(features.some(f=>matchesSurveyRoof(SOURIS_ROOF,this.atlasHash,tile.id,f.footprint,f.holes)));
   }
  }catch(e){this.failed.add(tile.id);console.warn('Building tile unavailable',tile.id,e);}finally{this.loading.delete(tile.id);}
 }
 private syncSourisEast(){
  const east=this.sourisEast;
  if(!east)return;
  const before=east.variant.visible;
  east.variant.sync(east.seated());
  if(east.variant.visible&&east.neighborsCaster)east.neighborsCaster.geometry=east.owner.geometry;
  if(before!==east.variant.visible)this.sourisEastShadows?.leaseOwnerChanged();
 }
 private async promoteSourisEast(tile:BoundTile,owner:THREE.Mesh,raw:ArrayBuffer,ground:SourisEastGround){
  const current=()=>this.wanted.has(tile.id)&&this.meshes.get(tile.id)===owner&&owner.parent===this.scene;
  const span=owner.userData.beaconTriangles as readonly [number,number]|undefined;
  const proof={vertices:34251,start:6957,end:7005};
  if(!span||span[0]!==proof.start||span[1]!==proof.end||owner.geometry.getAttribute('position').count!==proof.vertices)return;
  try{
   if(!await crockettExactWire(new Uint8Array(raw))||!current())return;
   const seated=await ground();
   if(!seated||!current())return;
   const shadows=this.sourisEastShadows;
   const [mod,occlusion]=await Promise.all([import('./souris-east/art.ts'),
    shadows?import('./summerside-station/rail-penumbra.ts'):undefined]);
   if(!current())return;
   const art=mod.createSourisEastExterior(shadows&&occlusion?{uniforms:shadows.uniforms,penumbra:occlusion.railPenumbraGLSL}:undefined);
   const variant=authenticatedOwnerVariant(owner,art.group,span,proof);
   if(!variant){art.dispose();return;}
   this.scene.add(art.group);
   const neighborsCaster=art.caster?new THREE.Mesh(owner.geometry,owner.material):undefined;
   neighborsCaster?.position.copy(owner.position);
   this.sourisEast={owner,variant,seated,dispose:art.dispose,caster:art.caster,neighborsCaster};
   this.syncSourisEast();
  }catch{/** Optional art cannot remove or delay the stock tile. */}
 }
 private async promoteStation(tile:BoundTile,owner:THREE.Mesh,source:ArrayBuffer,request:RailwayReview){
  const alive=()=>this.wanted.has(tile.id)&&this.meshes.get(tile.id)===owner&&!!owner.parent;
  let modTimer:ReturnType<typeof setTimeout>|undefined;
  try{
   const range=owner.userData.beaconTriangles as readonly [number,number]|undefined;
   // Standard keeps the signed gable cohort enabled. Its +12 submitted
   // vertices occur after the original station ordinal; the owner span is
   // unchanged. Alternate shadow mode keeps its original exact baseline.
   const proof={start:RAIL.start,end:RAIL.end,vertices:RAIL.vertices+(request.standard?12:0)};
   const cohort=request.standard&&this.wharfOwner?.owner===owner?this.wharfOwner.mask:undefined;
   const base=()=>cohort?cohort.stockForProof():owner.geometry;
   if(!range||range[0]!==proof.start||range[1]!==proof.end||base()?.getAttribute('position').count!==proof.vertices||
     !await railOwnerChunk(source)||!alive())return;
   const mod=await Promise.race([
    import('./summerside-station/rail-art.ts'),
    new Promise<undefined>(ok=>{modTimer=setTimeout(()=>ok(undefined),1200);}),
   ]).finally(()=>{if(modTimer!==undefined)clearTimeout(modTimer);});
   if(!mod||!alive())return;
   const art=await mod.loadRailArtwork((import.meta.env?.BASE_URL??'./')+'art/',request.shadows);
   if(!art)return;
   if(!alive()){art.dispose();return;}
   const solo=cohort?undefined:authenticatedOwnerVariant(owner,art.group,range,proof);
   const variant=cohort?cohort.add(art.group,range,proof):solo;
   if(!variant){art.dispose();return;}
   const neighborsCaster=new THREE.Mesh(owner.geometry,owner.material);
   neighborsCaster.position.copy(owner.position);
   this.station={owner,art,variant,neighborsCaster,stockForProof:()=>cohort?cohort.stockForProof():solo?.stockForProof()};
   this.scene.add(art.group);
   // Asset, transform, roster and contact are all qualified before the
   // next animation loop updates visibility and the exact owner index.
  }catch{/** Optional promotion must never remove the already submitted stock tile. */}
 }
 private async promoteStDavids(pending:{tile:BoundTile;owner:THREE.Mesh;source:ArrayBuffer},request:LocalExteriorReview){
  const {tile,owner,source}=pending;
  const active=()=>this.georgetownCohort?.owner===owner?this.georgetownCohort.mask:undefined;
  const base=()=>{const cohort=active();return cohort?cohort.stockForProof():owner.geometry;};
  const stock=base();
  if(!stock)return;
  const current=()=>this.wanted.has(tile.id)&&this.meshes.get(tile.id)===owner&&owner.parent===this.scene&&base()===stock;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const range=owner.userData.beaconTriangles as readonly [number,number]|undefined;
   const environment=this.scene.environment;
   if(!current()||!range||environment?.mapping!==THREE.EquirectangularReflectionMapping||this.scene.environmentIntensity!==.77||
      !this.waterStreetMat||!this.victoriaMat||!this.montagueMat||!this.sourisMcleanMat||
      !await stDavidsOwnerBytes(source)||!await stDavidsDrawAllows(owner,range,stock)||!current())return;
   const mod=await Promise.race([
    import('./st-davids/runtime.ts'),new Promise<undefined>(ok=>{timer=setTimeout(()=>ok(undefined),1200);}),
   ]).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
   if(!mod||!current())return;
   const art=await mod.loadStDavids((import.meta.env?.BASE_URL??'./')+'art/',request.shadows);
   if(!art)return;
   if(!current()){art.dispose();return;}
   const mask=active()??authenticatedOwnerCohort(owner,stock);
   const variant=mask?.add(art.group,range,ST_DAVID);
   if(!mask||!variant){art.dispose();return;}
   this.georgetownCohort={owner,mask};
   const neighborsCaster=art.caster?new THREE.Mesh(stock,owner.material):undefined;
   neighborsCaster?.position.copy(owner.position);
   this.stDavids={owner,art,variant,neighborsCaster};
   // Until the next valid ground check, keep the original tile and old depth.
   this.scene.add(art.group);
  }catch{/** Optional exterior must never hide a source tile or delay its submission. */}
 }
 private async promoteBeaconsfield(tile:BoundTile,mesh:THREE.Mesh,source:ArrayBuffer){
  const current=()=>this.wanted.has(tile.id)&&this.meshes.get(tile.id)===mesh;
  const range=mesh.userData.beaconTriangles as readonly [number,number]|undefined;
  if(!range)return;
  try{
   const src=await crypto.subtle.digest('SHA-256',source);
   if(!current()||Array.from(new Uint8Array(src),c=>c.toString(16).padStart(2,'0')).join('')!==BEACON_REVIEW.chunk)return;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const mod=await Promise.race([
    import('./beaconsfield-review.ts'),
    new Promise<undefined>(r=>{timer=setTimeout(()=>r(undefined),1200);}),
   ]).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
   if(!mod||!current())return;
   const group=await mod.loadBeaconsfieldPreview(import.meta.env.BASE_URL+'art/');
   if(!group)return;
   if(!current()){mod.disposeBeaconsfieldPreview(group);return;}
   // Omit only the recorded contiguous owner span from the *same* submitted
   // attributes. All protected triangles retain their bytes and original order.
   const g=mesh.geometry,n=g.getAttribute('position').count,[lo,hi]=range;
   if(lo<0||hi<=lo||hi>n||lo%3||hi%3||n%3){mod.disposeBeaconsfieldPreview(group);return;}
   const rest=n-(hi-lo),index=n<=65536?new Uint16Array(rest):new Uint32Array(rest);
   for(let i=0;i<rest;i++)index[i]=i<lo?i:i+hi-lo;
   g.setIndex(new THREE.BufferAttribute(index,1));
   this.beacon=group;this.disposeBeacon=mod.disposeBeaconsfieldPreview;this.scene.add(group);
  }catch{/** Unavailable optional art never hides the ordinary owner. */}
 }
 private async promoteGreenGables(tile:BoundTile,owner:THREE.Mesh,source:ArrayBuffer){
  const current=()=>this.wanted.has(tile.id)&&this.meshes.get(tile.id)===owner;
  const range=owner.userData.beaconTriangles as readonly [number,number]|undefined;
  if(!range)return;
  try{
   const src=await crypto.subtle.digest('SHA-256',source);
   if(!current()||Array.from(new Uint8Array(src),c=>c.toString(16).padStart(2,'0')).join('')!==GREEN_GABLES_REVIEW.chunk)return;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const m=await Promise.race([
    import('./green-gables-review.ts'),
    new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),1200);}),
   ]).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
   if(!m||!current())return;
   const group=await m.loadGreenGablesPreview(import.meta.env.BASE_URL+'art/');
   if(!group)return;
   if(!current()){m.disposeGreenGablesPreview(group);return;}
   const n=owner.geometry.getAttribute('position').count,[lo,hi]=range;
   if(lo<0||hi<=lo||hi>n||lo%3||hi%3||n%3){m.disposeGreenGablesPreview(group);return;}
   const rest=n-(hi-lo),rows=n<=65536?new Uint16Array(rest):new Uint32Array(rest);
   for(let i=0;i<rest;i++)rows[i]=i<lo?i:i+hi-lo;
   group.visible=false;this.scene.add(group);
   this.greenGables={group,owner,index:new THREE.BufferAttribute(rows,1),dispose:m.disposeGreenGablesPreview};
   this.syncCavendish();
  }catch{/** Leave the original row (and tile) when optional artwork fails. */}
 }
 private async promoteBarn(tile:BoundTile,owner:THREE.Mesh,source:ArrayBuffer){
  const still=()=>this.wanted.has(tile.id)&&this.meshes.get(tile.id)===owner;
  const range=owner.userData.barnTriangles as readonly [number,number]|undefined;
  const s=GREEN_GABLES_BARN;
  if(!range||range[0]!==s.span[0]||range[1]!==s.span[1]||owner.geometry.getAttribute('position').count!==s.stockVertices)return;
  try{
   const hash=await crypto.subtle.digest('SHA-256',source);
   if(!still()||Array.from(new Uint8Array(hash),c=>c.toString(16).padStart(2,'0')).join('')!==s.chunk)return;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const mod=await Promise.race([
    import('./green-gables-barn-review.ts'),
    new Promise<undefined>(done=>{timer=setTimeout(()=>done(undefined),1200);})
   ]).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
   if(!mod||!still())return;
   const group=await mod.loadBarnReview((import.meta.env?.BASE_URL??'./')+'art/');
   if(!group)return;
   if(!still()){mod.disposeBarnReview(group);return;}
   group.visible=false;this.scene.add(group);
   this.barn={group,owner,views:new CavendishBarnViews(owner.geometry,range),dispose:mod.disposeBarnReview};
   this.syncCavendish();
  }catch{/** Never withhold q72, q101, or their existing neighbours. */}
 }
 private generate(features:Bldg[],tile:BoundTile,replaceSpinnakers=false,exteriorOrdinal?:number,markBarn=false,massingChunk?:string,downtownVerified=false,trackWharf=false,trackOlearyIndustrial=false,trackWarehouse=false){
  const wharfSpans=trackWharf?new Map<number,WharfSpan>():undefined;
  let warehouseStart=-1,warehouseEnd=-1;
  let industrialStart=-1,industrialEnd=-1,beaconStart=-1,beaconEnd=-1,barnStart=-1,barnEnd=-1,actualRustico=false,actualPrince=false;
  const ox=(tile.x1+tile.x2)/2,oz=(tile.z1+tile.z2)/2,P:number[]=[],C:number[]=[],UV:number[]=[],R:number[]=[],F:number[]=[];
  // Record only changed spans; allocate the GPU lane once after emission.
  const townSpans=this.townWallOptics&&townTileRegion(tile.x1,tile.z1,tile.x2,tile.z2,this.townWallOptics.areas)?[] as number[]:undefined;
  let facade=0,measuredDowntownRoofs=0,measuredWaterRoof=false,paintedHarbourRoof=false,paintedOlearyAccessRoof=false;
  const westWall=this.sourisWestLink?sourisFacingAdmittedEdge(this.atlasHash,tile,massingChunk,features):undefined;
  let westSpan:readonly [number,number]|undefined;
  const harbourRoofRow=this.rusticoHarbourRoof&&rusticoHarbourRoofAllows(this.atlasHash,tile,massingChunk,features)?RUSTICO_HARBOUR_ROOF_ROW:-1;
  const olearyAccessRow=this.olearyAccessRoof&&!this.olearySeat?olearyAccessRoofOrdinal(this.atlasHash,tile,massingChunk,features):undefined;
  const vertex=(p:Pt,y:number,c:THREE.Color,u:number,v:number,r:number)=>{P.push(p.x-ox,y,p.z-oz);C.push(c.r,c.g,c.b);UV.push(u,v);R.push(r);F.push(facade);};
  for(let i=0;i<features.length;i++){
   if(wharfSpans)trackWharfSpans(wharfSpans,i,P.length/3);
   if(trackWarehouse){if(i===OLEARY_WAREHOUSE.ordinal)warehouseStart=P.length/3;if(i===OLEARY_WAREHOUSE.ordinal+1)warehouseEnd=P.length/3;}
   if(trackOlearyIndustrial){if(i===OLEARY_INDUSTRIAL.ordinal)industrialStart=P.length/3;if(i===OLEARY_INDUSTRIAL.ordinal+1)industrialEnd=P.length/3;}
   if(markBarn){if(i===GREEN_GABLES_BARN.ordinal)barnStart=P.length/3;if(i===GREEN_GABLES_BARN.ordinal+1)barnEnd=P.length/3;}
   if(exteriorOrdinal!==undefined){if(i===exteriorOrdinal)beaconStart=P.length/3;if(i===exteriorOrdinal+1)beaconEnd=P.length/3;}
   if(replaceSpinnakers&&SPINNAKERS_OMISSIONS.has(i))continue;
   const f=features[i];
   if(f.footprint.length<3||!Number.isFinite(f.height)||replacesLightBuilding(f.footprint))continue;
   const rings=[f.footprint,...(f.holes??[])].map(r=>r.map(([lon,lat])=>project(lon,lat)));
   const ring=rings[0],cx=ring.reduce((s,p)=>s+p.x,0)/ring.length,cz=ring.reduce((s,p)=>s+p.z,0)/ring.length;
   const ll=geographic(cx,cz);if(replacesBasilicaFootprint(ll.lon,ll.lat))continue;
   const seed=Math.abs(Math.floor(cx*97+cz*53))>>>0,h=clamp(f.height,1.3,130);
   facade=downtownFacade(ll.lon,ll.lat,h,seed);
   const base=this.t.meshElevation(cx,cz)+.05, cw=bases[seed%bases.length],cr=tops[(seed>>>4)%tops.length];
   const prince=this.princeSurveyRoof&&matchesPrinceSurveyRoof(this.atlasHash,massingChunk,tile.id,i,f.footprint,f.height,f.minHeight,f.holes,base);
   if(prince||(this.rusticoRoof&&matchesRusticoMassing(this.atlasHash,massingChunk,tile.id,i,f.footprint,f.height,f.minHeight,f.holes))){
    if(prince)actualPrince=true;else actualRustico=true;
    facade=82;
    (prince?emitPrinceSurveyRoof:emitRusticoMassing)(ring,{
     roof:(a,b,c,y)=>{
      vertex(a,y[0],cr,a.x-ox,a.z-oz,1);vertex(b,y[1],cr,b.x-ox,b.z-oz,1);vertex(c,y[2],cr,c.x-ox,c.z-oz,1);
     },
     wall:(a,b,below,y)=>{
      const ga=this.t.meshElevation(a.x,a.z)-.6,gb=this.t.meshElevation(b.x,b.z)-.6;
      const loA=below?.[0]??(prince?princeFoot(ring,a,(x,z)=>this.t.meshElevation(x,z)):ga);
      const loB=below?.[1]??(prince?princeFoot(ring,b,(x,z)=>this.t.meshElevation(x,z)):gb),L=Math.hypot(a.x-b.x,a.z-b.z);
      vertex(a,loA,cw,0,loA-ga,0);vertex(b,y[1],cw,L,y[1]-gb,0);vertex(a,y[0],cw,0,y[0]-ga,0);
      vertex(a,loA,cw,0,loA-ga,0);vertex(b,loB,cw,L,loB-gb,0);vertex(b,y[1],cw,L,y[1]-gb,0);
     },
    });
    continue;
   }
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
   if(this.sourisMcleanMat&&sourisMcleanModel(this.atlasHash,tile.id,i,f.footprint,f.holes)){
    emitSourisMclean(ring,(x,z)=>this.t.meshElevation(x,z),(p,y,c,u,v,role,style)=>{
     facade=style;vertex(p,y,c,u,v,role);
    });
    continue;
   }
   if(matchesHangar4(this.atlasHash,tile.id,i,f.footprint,f.holes)){
    emitHangar4((x,z)=>this.t.meshElevation(x,z),readRoofTone(this.atlasHash,tile.id,i,f.footprint),(p,y,c,u,v,role,style)=>{
     facade=style;vertex(p,y,c,u,v,role);
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
   const victoria=this.victoriaMat?victoriaRowModel(this.atlasHash,tile.id,i,f.footprint,f.holes):undefined;
   if(victoria){
    emitVictoriaRow(victoria,(x,z)=>this.t.meshElevation(x,z),(p,y,c,u,v,role,style)=>{
     facade=style;vertex(p,y,c,u,v,role);
    });
    continue;
   }
   const hall=this.montagueMat?montagueHallModel(this.atlasHash,tile.id,i,f.footprint,f.holes):undefined;
   if(hall){
    emitMontagueHall(hall,(x,z)=>this.t.meshElevation(x,z),(p,y,c,u,v,role,style)=>{
     facade=style;vertex(p,y,c,u,v,role);
    });
    continue;
   }
   const macdonald=this.montagueMat?montagueMacdonaldModel(this.atlasHash,tile.id,i,f.footprint,f.holes):undefined;
   if(macdonald){
    emitMacdonaldShell(macdonald,(x,z)=>this.t.meshElevation(x,z),(p,y,c,u,v,role,style)=>{
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
   const center={x:cx,z:cz};
   const neutralSource=!fit&&rings.length===1?readNeutralRoof(this.atlasHash,tile.id,i,f.footprint,downtownVerified):undefined;
   // The measured elevations are absolute. Reject material ground-datum conflicts
   // and leave this exact outline on the ordinary legacy generator.
   const neutral=neutralSource&&Math.abs(neutralSource.datum-base)<=.8?neutralSource:undefined;
   if(neutral?.downtown){
    measuredDowntownRoofs++;
    if(tile.id==='q032001'&&i===383)measuredWaterRoof=true;
   }
   const preserveDowntownFoot=neutral?.downtown&&!(tile.id==='q032001'&&i===383);
   const eave=base+(synthGable?low:h);
   const rim=(p:Pt)=>fit?base+roofHeight(p,fit):neutral?neutral.datum+neutralRoofHeight(p,center,neutral.planes):eave;
   const wall=(p:Pt,q:Pt,u0:number,u1:number,footA?:number,footB?:number)=>{
    const y0=footA??(this.t.meshElevation(p.x,p.z)-.6),y1=footB??(this.t.meshElevation(q.x,q.z)-.6),y2=rim(p),y3=rim(q);
    vertex(p,y0,cw,u0,0,0);vertex(p,y2,cw,u0,y2-y0,0);vertex(q,y3,cw,u1,y3-y1,0);
    vertex(p,y0,cw,u0,0,0);vertex(q,y3,cw,u1,y3-y1,0);vertex(q,y1,cw,u1,0,0);
   };
   const fitWalls=!!townSpans&&facade===0&&rings.length===1&&townFaceRegion(cx,cz,this.townWallOptics?.areas);
   // One horizontal ordering datum above every actual parent wall foot;
   // sloped stock floor profiles remain unchanged beneath these optics.
   let wallDatum=base;
   if(fitWalls)for(const p of ring)wallDatum=Math.max(wallDatum,this.t.meshElevation(p.x,p.z)-.22);
   const westOwner=westWall?.ordinal===i&&rings.length===1&&!fit&&!neutral&&facade===0;
   for(const rr of rings){for(let i=0;i<rr.length;i++){
    const a=rr[i],b=rr[(i+1)%rr.length],len=Math.hypot(b.x-a.x,b.z-a.z);
    if(len<.15)continue;
    const westEdge=westOwner&&rr===ring&&i===westWall?.edge;
    const first=fitWalls||westEdge?P.length/3:0;
    let rimMin=fitWalls?Math.min(rim(a),rim(b)):0;
    if(neutral){
     const edges=neutralRoofEdge(a,b,center,neutral.planes);
     if(fitWalls)for(const cut of edges)rimMin=Math.min(rimMin,rim(cut));
     const u=(t:Pt)=>Math.hypot(t.x-a.x,t.z-a.z);
     if(preserveDowntownFoot&&edges.length>2){
      // A new roof ridge may split an existing XY wall. Keep the original
      // sampled endpoint bottoms and interpolate between them instead of
      // sampling the terrain a second time at the new upper ridge station.
      const lo=this.t.meshElevation(a.x,a.z)-.6,hi=this.t.meshElevation(b.x,b.z)-.6;
      for(let k=1;k<edges.length;k++){
       const ua=u(edges[k-1]),ub=u(edges[k]);
       wall(edges[k-1],edges[k],ua,ub,lo+(hi-lo)*ua/len,lo+(hi-lo)*ub/len);
      }
     }else for(let k=1;k<edges.length;k++)wall(edges[k-1],edges[k],u(edges[k-1]),u(edges[k]));
    }else{
     const middle=fit?splitRoofEdge(a,b,fit)[1]:b;
     if(fitWalls)rimMin=Math.min(rimMin,rim(middle));
     if(middle===b)wall(a,b,0,len);
     else{const u=Math.hypot(middle.x-a.x,middle.z-a.z);wall(a,middle,0,u);wall(middle,b,u,len);}
    }
    if(westEdge&&P.length/3===first+6)westSpan=[first,P.length/3];
    if(fitWalls&&townSpans){
     const [width,floor,top]=townWallVertex(len,wallDatum,rimMin);
     if(width>0)townSpans.push(first,P.length/3,width,floor,top);
    }
   }}
   const observed=rings.length===1?readRoofTone(this.atlasHash,tile.id,i,f.footprint):undefined;
   // Keep measured/artistic owners and the existing observed roof table ahead
   // of this categorical cue. Only the stock gable's four top triangles use it.
   const pale=i===harbourRoofRow&&!observed&&synthGable&&!fit&&!neutral&&facade===0;
   // Leave any more specific or later geometric roof model ahead of this
   // documentary tone. No opacity, role, new triangle or optical shader.
   const membrane=i===olearyAccessRow&&!observed&&!synthGable&&!fit&&!neutral&&facade===0;
   if(membrane)paintedOlearyAccessRoof=true;
   const roofColor=observed?new THREE.Color().setRGB(...observed):pale?new THREE.Color(RUSTICO_HARBOUR_ROOF_TONE):
    membrane?new THREE.Color(OLEARY_ACCESS_ROOF_COLOR):cr;
   if(pale)paintedHarbourRoof=true;
   const roofVert=(p:Pt,y:number)=>vertex(p,y,roofColor,p.x-ox,p.z-oz,1);
   if(synthGable&&!fit&&!neutral){
    const length=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.z-b.z);
    let a=ring[0],b=ring[1],c=ring[2],d=ring[3];
    if(length(a,b)>length(b,c)){[a,b,c,d]=[b,c,d,a];}
    const ab={x:(a.x+b.x)*.5,z:(a.z+b.z)*.5},cd={x:(c.x+d.x)*.5,z:(c.z+d.z)*.5};
    for(const [p,y] of [[a,eave],[ab,base+h],[cd,base+h],[a,eave],[cd,base+h],[d,eave],[b,eave],[c,eave],[cd,base+h],[b,eave],[cd,base+h],[ab,base+h]] as [Pt,number][])roofVert(p,y);
    // These triangle caps have no geometric wall-grid UV (0/4/2
    // was decorative only). Keep them opaque within opted ordinary faces.
    if(fitWalls&&townSpans)townSpans.push(P.length/3,P.length/3+6,-100,0,0);
    for(const [u,v,w] of [[a,b,ab],[c,d,cd]]){vertex(u,eave,cw,0,0,0);vertex(v,eave,cw,4,0,0);vertex(w,base+h,cw,2,h-low,0);}
   }else{
    const outline=rings.map(rr=>rr.map(p=>new THREE.Vector2(p.x-ox,-p.z+oz))),flat=rings.flat();
    const faces=THREE.ShapeUtils.triangulateShape(outline[0],outline.slice(1));
    if(fit){for(const face of faces){
      const triangle:Triangle=[flat[face[0]],flat[face[1]],flat[face[2]]];
      for(const t of splitRoofTriangle(triangle,fit))for(const p of t)roofVert(p,rim(p));
    }}else if(neutral){for(const face of faces){
      const triangle:Triangle=[flat[face[0]],flat[face[1]],flat[face[2]]];
      for(const cut of neutralRoofTriangles(triangle,center,neutral.planes))for(const p of cut)roofVert(p,rim(p));
    }}else{for(const face of faces)for(const idx of face)roofVert(flat[idx],eave);}
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('topFlag',new THREE.Float32BufferAttribute(R,1));g.setAttribute('facadeStyle',new THREE.Uint8BufferAttribute(F,1));g.computeVertexNormals();g.computeBoundingSphere();
  const mesh=new THREE.Mesh(g,actualPrince?this.sourceNeutralMaterial():actualRustico&&this.rusticoNeutralMat?this.rusticoNeutralMat:tile.id===SOURIS_ROOF.sourceTileId&&this.sourisMat?this.sourisMat:tile.id===WATER_STREET_TILE&&this.waterStreetMat?this.waterStreetMat:tile.id===VICTORIA_TILE&&this.victoriaMat?this.victoriaMat:tile.id===MONTAGUE_HALL_TILE&&this.montagueMat?this.montagueMat:tile.id===MCLEAN_TILE&&this.sourisMcleanMat?this.sourisMcleanMat:this.mat);mesh.position.set(ox,0,oz);
  if(westSpan&&mesh.material===this.mat&&!townSpans?.length){
   const token={atlas:this.atlasHash??'',tile:tile.id,wire:massingChunk??'',row:SRS_WEST_WALL.row,ordinal:SRS_WEST_WALL.ordinal};
   const attrs=detachedSchoolWestMark(g,token,westSpan);
   if(attrs){
    if(!this.sourisWestMat){
     const fs=patchSourisSchoolWestFragment(this.mat.fragmentShader);
     if(fs){
      this.sourisWestMat=this.mat.clone();
      this.sourisWestMat.fragmentShader=fs;
      // Keep the original shared shadow/sun uniform objects, not cloned snapshots.
      this.sourisWestMat.uniforms={...this.mat.uniforms,srsWestLive:{value:1}};
     }
    }
    if(this.sourisWestMat)this.sourisWestPending.set(mesh,attrs);
   }
  }
  if(townSpans?.length&&this.townWallOptics){
    const stock=mesh.material;
    let material=this.fittedWallMaterials.get(stock);
    if(!material){material=fittedWallMaterial(stock,this.townWallOptics);this.fittedWallMaterials.set(stock,material);}
    if(material!==stock){
     const data=new Int16Array(P.length);
     for(let i=0;i<townSpans.length;i+=5){
      const start=townSpans[i]*3,end=townSpans[i+1]*3,x=townSpans[i+2],y=townSpans[i+3],z=townSpans[i+4];
      for(let j=start;j<end;j+=3){data[j]=x;data[j+1]=y;data[j+2]=z;}
     }
     g.setAttribute('townWallFit',new THREE.BufferAttribute(data,3));mesh.material=material;
    }
  }
  if(measuredDowntownRoofs)mesh.userData.measuredDowntownRoofs=measuredDowntownRoofs;
  if(measuredWaterRoof)mesh.userData.measuredWaterRoof=true;
  if(actualPrince)mesh.userData.princeSurveyRoof=true;
  if(actualRustico)mesh.userData.rusticoMassing=true;
  if(paintedHarbourRoof)mesh.userData.rusticoHarbourRoofTone=true;
  if(paintedOlearyAccessRoof)mesh.userData.olearyAccessRoofTone=true;
  if(markBarn&&barnStart>=0&&barnEnd>barnStart)mesh.userData.barnTriangles=[barnStart,barnEnd];
  if(exteriorOrdinal!==undefined&&beaconStart>=0&&beaconEnd>beaconStart)mesh.userData.beaconTriangles=[beaconStart,beaconEnd];
  if(wharfSpans)mesh.userData.spinnakersSpans=wharfSpans;
  if(trackWarehouse&&warehouseStart>=0&&warehouseEnd>warehouseStart)mesh.userData.olearyWarehouseTriangles=[warehouseStart,warehouseEnd];
  if(trackOlearyIndustrial&&industrialStart>=0&&industrialEnd>industrialStart)mesh.userData.olearyIndustrialTriangles=[industrialStart,industrialEnd];
  return mesh;
 }
}
