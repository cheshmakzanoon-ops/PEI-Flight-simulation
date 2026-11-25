import {COASTAL_SPECS} from '../sim/coastal-surveys.generated.ts';
import {INLAND_SPECS} from '../sim/inland-surveys.generated.ts';
import {BANK_TILE} from './basin-channel-bank.ts';
import {BOWLEY_POND} from '../sim/bowley-pond.generated.ts';
import {MONTAGUE_FOUNDATION} from '../sim/montague-foundation.generated.ts';
import {QUARTERMASTER} from '../sim/quartermaster.generated.ts';
import {RUNWAYS} from '../sim/places.ts';
import {CONFEDERATION_TRAIL} from './confederation-trail.generated.ts';
import {marshPatches} from './marsh-patches.generated.ts';
import {DUNE_GRASS_AUTHORITY} from './dune-grass-authority.generated.ts';
import {DUNE_SAND_MASK} from './dune-sand-pins.generated.ts';
import {CANOPY_FENCE} from './canopy-fence.generated.ts';
import {MASK_BOUNDS as PASTURE_BOUNDS} from './panmure-pasture/mask.generated.ts';
import {DUNE_RELIEF} from '../sim/dune-relief.generated.ts';
import {KINGS_DRY_CROWN} from '../sim/kings-dry-crown.generated.ts';
import {GABLES_GRADE} from '../sim/gables-grade.generated.ts';
import {HOG_WEST_GRADE} from '../sim/hog-west-grade.generated.ts';
import {INDIAN_RIVER_GRADE} from '../sim/indian-river-grade.generated.ts';
import {RUSTICO_GRADE} from '../sim/rustico-grade.generated.ts';
import {POINT_PRIM_GRADE} from './point-prim/stamp.ts';
import {ST_DAVIDS} from './st-davids/source.generated.ts';
import {SUMMERSIDE_STATION} from './summerside-station/source.generated.ts';
import {LIGHT_STATIONS} from '../sim/lighthouse-sites.ts';
import {ORIGIN,METRES_PER_LON,METRES_PER_LAT} from '../sim/geo.ts';
const localSpecs=[...DUNE_RELIEF,KINGS_DRY_CROWN,GABLES_GRADE,HOG_WEST_GRADE,INDIAN_RIVER_GRADE,RUSTICO_GRADE,POINT_PRIM_GRADE];

/** Digest only when Expanded farmland is selected. Pin the actual current
 * protected-owner extents, source identities, airstrips, and projection used
 * by the offline qualifier. No geodata requests or bulk hashing. */
function protectedOwners(){
return {trail:CONFEDERATION_TRAIL.sha256,marsh:marshPatches.map(q=>[q.id,q.origin,q.step,q.width,q.height,q.decodedSha]),
 grass:[DUNE_GRASS_AUTHORITY.sha256,DUNE_GRASS_AUTHORITY.index.map(q=>[q.tile,q.uvOrigin,q.cells,q.decodedSHA256])],
 sand:DUNE_SAND_MASK.variants.map(q=>[q.tile,q.outputOrigin,q.size,q.decodedSha]),pasture:PASTURE_BOUNDS,
 sourceFence:CANOPY_FENCE.rawSha,localGrades:localSpecs.map(q=>[q.id,q.tileX,q.tileZ,q.firstX,q.firstZ,q.cellsX,q.cellsZ,q.sha256]),
 fixedReceivers:[ST_DAVIDS.boundsXZ,SUMMERSIDE_STATION.boundsXZ,...Object.values(LIGHT_STATIONS).map(q=>[q.lon,q.lat])],
 heldSurveys:[...COASTAL_SPECS,...INLAND_SPECS,MONTAGUE_FOUNDATION.ground].map(q=>[q.tileX,q.tileZ]),
 stockRunways:RUNWAYS.map(q=>[q.id,q.p.x,q.p.z,q.dx,q.dz,q.length,q.width]),
  places:[BANK_TILE,[BOWLEY_POND.left,BOWLEY_POND.top,BOWLEY_POND.width,BOWLEY_POND.height,BOWLEY_POND.step],QUARTERMASTER.boundsXZ],
  projection:[ORIGIN.lon,ORIGIN.lat,METRES_PER_LON,METRES_PER_LAT]};
}

export function protectedOwnerContract(){
 // Quantize purely to avoid last-bit differences between Math libraries.
 // Survey coordinates are in metres; this is well below millimetre precision.
 return JSON.stringify(protectedOwners(),(_key,v)=>typeof v==='number'?Math.round(v*1e8)/1e8:v);
}
export async function checkedFieldOwners(expected:string){
 try{
  if(!globalThis.crypto?.subtle)return false;
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(protectedOwnerContract()));
  return Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,'0')).join('')===expected;
 }catch{return false;}
}
