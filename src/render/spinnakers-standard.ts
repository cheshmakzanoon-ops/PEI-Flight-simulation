import {type BufferGeometry,Group,InstancedMesh,Mesh,Texture} from 'three';
import type {Cover} from '../sim/cover.ts';
import {verifyDecodedCover} from '../sim/cover-proof.ts';
import {project} from '../sim/geo.ts';
import type {Terrain} from '../sim/terrain.ts';
import {downtownSceneryCompatible} from './summerside-roof-source.ts';
import {SUMMERSIDE_STATION as RAIL} from './summerside-station/source.generated.ts';
import {SPINNAKERS_DECK as DECK} from './spinnakers-deck.generated.ts';
import {buildSpinnakersDeck,loadSpinnakersDeck,spinnakersDeckSurface} from './spinnakers-deck.ts';
import {buildSpinnakersShells,SPINNAKERS_OMISSIONS} from './spinnakers-shells.ts';

export type WharfSpan=readonly [number,number];
export type WharfLoader=(eligible:()=>boolean)=>Promise<WharfArt|undefined>;
type WharfArt={group:Group;dispose:()=>void};

export function standardWharfRequested(q:URLSearchParams){
 return q.getAll('scenery').every(v=>v===''||v==='standard')&&downtownSceneryCompatible(q)&&!['stockSpinnakersDeck','northBaywalkConcrete','baywalkConcrete',
  'legacyShoreArcs','montagueFoundationPreview','montagueReachOptics','basinChannel','seatedRoads','townWallStudy','stockTownWalls']
  .some(key=>q.has(key));
}
const origin=project(...DECK.anchor);
export function nearStandardWharf(x:number,y:number,z:number,active=false){
 return Number.isFinite(y)&&y<(active?510:460)&&(x-origin.x)**2+(z-origin.z)**2<(active?2100:1750)**2;
}
export function standardWharfLoader(base:string,cover:Cover,terrain:Terrain,digest:string|undefined):WharfLoader|undefined{
 if(digest!==RAIL.terrain||cover.sourceSha!==DECK.cover)return;
 return async eligible=>{
  if(!eligible()||await verifyDecodedCover(cover)!==RAIL.coverDecoded||!eligible())return;
  const pack=await loadSpinnakersDeck(base);
  if(!pack||!eligible())return;
  const seat=spinnakersDeckSurface(pack),deck=buildSpinnakersDeck(pack,cover,terrain,seat);
  if(!deck)return;
  const group=new Group();
  group.name='Summerside Spinnakers’ Landing';
  group.add(deck);
  const dispose=()=>{
   group.removeFromParent();
   group.traverse(o=>{
    if(!(o instanceof Mesh))return;
    if(o instanceof InstancedMesh)o.dispose();
    o.geometry.dispose();
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
     const tint=m.userData.wharfOwnedTint;
     if(tint instanceof Texture)tint.dispose();
     m.dispose();
    }
   });
  };
  try{group.add(buildSpinnakersShells(seat));return {group,dispose};}
  catch{dispose();}
 };
}

// Only collect these two records, on this single fully authenticated stock tile.
export function trackWharfSpans(spans:Map<number,WharfSpan>,ordinal:number,start:number){
 if(SPINNAKERS_OMISSIONS.has(ordinal))spans.set(ordinal,[start,start]);
 const former=spans.get(ordinal-1);
 if(former)spans.set(ordinal-1,[former[0],start]);
}
type Pin={span:WharfSpan;proof:{start:number;end:number;vertices:number}};
// Independently measured from the unmodified Standard generator, immediately
// before either authored replacement is activated.
const drawPins=[
 {ordinal:240,start:51228,end:51429,position:'bd1b73cd04647b4179bd4c0747003cd1d989ddaba751f7ccd9f41ff71eafb369'},
 {ordinal:315,start:65946,end:65988,position:'9b83c236182d08ca63a8f01626104612483f5afb66fa8b8151f119e0eec2c90d'},
] as const;

export async function standardWharfPositionsAllow(g:BufferGeometry){
 const p=g.getAttribute('position'),buffer=p?.array.buffer;
 if(!p||!(p.array instanceof Float32Array)||!(buffer instanceof ArrayBuffer)||p.itemSize!==3)return false;
 try{
  return (await Promise.all(drawPins.map(async({start,end,position})=>{
   const bytes=new Uint8Array(buffer,p.array.byteOffset+start*12,(end-start)*12);
   const hash=await crypto.subtle.digest('SHA-256',bytes);
   return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')===position;
  }))).every(Boolean);
 }catch{return false;}
}

export function standardWharfDraw(geometry:BufferGeometry,spans:ReadonlyMap<number,WharfSpan>):readonly Pin[]|undefined{
 const vertices=RAIL.vertices+12;
 if(spans.size!==2||geometry.index||geometry.getAttribute('position').count!==vertices)return;
 const pins:Pin[]=[];
 for(const {ordinal,start,end} of drawPins){
  const span=spans.get(ordinal);
  if(!span||span[0]!==start||span[1]!==end)return;
  pins.push({span,proof:{vertices,start,end}});
 }
 return pins;
}
