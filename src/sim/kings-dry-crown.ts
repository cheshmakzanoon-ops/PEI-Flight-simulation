import type {Cover} from './cover.ts';
import type {BoundedGrade} from './bounded-grade.ts';
import type {Terrain} from './terrain.ts';
import {boundedPackedBody} from './packed-bytes.ts';
import {KINGS_DRY_CROWN as S} from './kings-dry-crown.generated.ts';

export const KINGS_DRY_CROWN_OPTION='kingsDryCrownStudy';
const incompatible=[
 'inlandRelief','surveyRelief','woodlandView','woodland3D','woodlandCrownBase',
 'woodlandBark','canopyLight','forestFloor','seatedForestShadows','buildingShadows',
 'sourceGrassStudy','sourceGrassNap','duneGrassSurface','duneSandDetail',
 'provinceFieldsReview','cropRowsReview','meadowTexture','northCapeWind','indianRiverReview',
] as const;
export function kingsDryCrownRequested(options:URLSearchParams){
 return options.has(KINGS_DRY_CROWN_OPTION)&&options.get('scenery')!=='detail'&&
  !(options.has('northBaywalkPreview')&&options.has('spinnakersPreview'))&&
  !incompatible.some(k=>options.has(k));
}

// Check current actor and elevation provenance before the World receives any
// measured geometry. An unknown/missing actor authority is not a safe void.
export function kingsDryCrownSources(terrain:Terrain,cover:Cover,elevation:string|undefined,
 roads:string|undefined,sidewalks:string|undefined,parking:string|undefined,buildings:boolean,hedges:boolean){
 if(elevation!==S.terrainSha256||cover.sourceSha!==S.coverCompressedSha256||cover.sourceDecodedSha!==S.coverDecodedSha256||
    roads!==S.roadsSha256||sidewalks!==S.sidewalksSha256||parking!==S.parkingSha256||!buildings||!hedges)return false;
 if(terrain.surveyGrids.some(g=>g.spec.tileX===S.tileX&&g.spec.tileZ===S.tileZ)||cover.waterInsets.some(w=>w.intersects(...S.boundsXZ)))return false;
 const [a,b,c,d]=S.boundsXZ;
 return cover.distance(terrain,(a+c)/2,(b+d)/2)>70;
}

/** The compact support is not rectangular. Every grid node of an incident
 * triangle must remain well inland, even after composing other shore modes. */
export function kingsDryCrownInterior(terrain:Terrain,cover:Cover,grade:BoundedGrade){
 const g=grade.grid;
 if(g.spec!==S||!g.renderWeights)return false;
 const flags=new Uint8Array(g.renderWeights.length);
 for(let j=1;j<g.nz-1;j++)for(let i=1;i<g.nx-1;i++){
  if(!g.renderWeights[j*g.nx+i])continue;
  for(let y=j-1;y<=j+1;y++)for(let x=i-1;x<=i+1;x++)flags[y*g.nx+x]=1;
 }
 let any=false;
 for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++)if(flags[j*g.nx+i]){
  any=true;
  if(cover.distance(terrain,g.x0+g.stepX*i,g.z0+g.stepZ*j)<=70)return false;
 }
 return any;
}

export async function kingsDryCrownHedges(base:string,fetcher:typeof fetch=fetch,ms=1400){
 if(!globalThis.crypto?.subtle)return false;
 const controller=new AbortController(),signal=controller.signal;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const exact=async()=>{
  const r=await fetcher(base+'woodland/hedgerows-v1/index.json',{signal});
  if(r.status!==200||signal.aborted){void r.body?.cancel().catch(()=>{});return false;}
  const raw=await boundedPackedBody(r.body,60000);
  if(!raw||signal.aborted)return false;
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
  return !signal.aborted&&Array.from(hash,v=>v.toString(16).padStart(2,'0')).join('')===S.hedgeIndexSha256;
 };
 try{return await Promise.race([exact(),new Promise<false>(done=>timer=setTimeout(()=>{controller.abort();done(false);},ms))]);}
 catch{return false;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
