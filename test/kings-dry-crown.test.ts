import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {KINGS_DRY_CROWN as C} from '../src/sim/kings-dry-crown.generated.ts';
import {BoundedGrade,loadBoundedGrade} from '../src/sim/bounded-grade.ts';
import {kingsDryCrownHedges,kingsDryCrownInterior,kingsDryCrownRequested,kingsDryCrownSources} from '../src/sim/kings-dry-crown.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';

const world=(p:string)=>new URL('../public/world/'+p,import.meta.url);
const pack=readFileSync(world(C.file));
const body=(q:Uint8Array,status=200)=>async()=>new Response(new Uint8Array(q),{status});
const native=gunzipSync(pack);
const bad=new Uint8Array(native);bad[8192]^=255;
const fixture=()=>{
 const spec=JSON.parse(readFileSync(world('terrain.json'),'utf8'));
 const dem=gunzipSync(readFileSync(world('height.bin.gz')));
 const cmeta=JSON.parse(readFileSync(world('cover.json'),'utf8'));
 const cdata=gunzipSync(readFileSync(world('cover.bin.gz')));
 const terrain=new Terrain(spec,new Int16Array(dem.buffer,dem.byteOffset,dem.byteLength/2));
 const cover=new Cover(cmeta.width,cmeta.height,cdata,undefined,C.coverCompressedSha256,undefined,undefined,C.coverDecodedSha256);
 return {terrain,cover};
};

test('Kings crown is explicit Standard only and denies competing terrain/colour',()=>{
 const w=(q:string)=>kingsDryCrownRequested(new URLSearchParams(q));
 assert(!w(''));assert(w('kingsDryCrownStudy'));assert(w('scenery=standard&kingsDryCrownStudy&legacyShoreArcs'));
 for(const id of ['scenery=detail','surveyRelief','inlandRelief','woodland3D','buildingShadows','seatedForestShadows','sourceGrassStudy','northCapeWind','indianRiverReview','northBaywalkPreview&spinnakersPreview']){
  assert(!w('kingsDryCrownStudy&'+id));
 }
});

test('Only exact bounded crown bytes allow the new near profile; false epoch and generic elevation cap still reject',async()=>{
 const {terrain,cover}=fixture(),make=await loadBoundedGrade(C,'/',body(pack));assert(make);
 const art=make(terrain,(x,z)=>terrain.atlasElevation(x,z));
 assert(kingsDryCrownInterior(terrain,cover,art));
 const pass=[C.roadsSha256,C.sidewalksSha256,C.parkingSha256,true,true] as const;
 assert(kingsDryCrownSources(terrain,cover,C.terrainSha256,...pass));
 assert(!kingsDryCrownSources(terrain,cover,'incorrect',...pass));
 assert(!kingsDryCrownSources(terrain,cover,C.terrainSha256,undefined,C.sidewalksSha256,C.parkingSha256,true,true));
 assert(!kingsDryCrownSources(terrain,cover,C.terrainSha256,C.roadsSha256,C.sidewalksSha256,C.parkingSha256,false,true));
 const dim=art.grid.nx*art.grid.nz;
 assert.throws(()=>new BoundedGrade(terrain,C,new Int16Array(dim),new Uint8Array(dim),()=>0),/ceiling/);
 assert.throws(()=>new BoundedGrade(terrain,{...C,id:'uncertified'},new Int16Array(dim),new Uint8Array(dim),()=>0),/ceiling/);
 const normalized=await loadBoundedGrade(C,'/',body(native));assert(normalized);
 assert.deepEqual(normalized(terrain,(x,z)=>terrain.atlasElevation(x,z)).grid.heights,art.grid.heights);
 const unsigned=await loadBoundedGrade({...C},'/',body(pack));assert(unsigned);
 assert.throws(()=>unsigned(terrain,(x,z)=>terrain.atlasElevation(x,z)),/ceiling/);
 const outside=art.grid.x0-1,z=art.grid.z0+1;
 assert.equal(art.weight(outside,z),0);assert.equal(art.contactY(outside,z,1.2345),1.2345);
});

test('Bad crown or actor transport stays stock and late correct bytes never admit a grade',async()=>{
 for(const get of [body(pack,404),body(pack,206),body(bad),body(pack.subarray(0,pack.length-1)),body(new Uint8Array(C.decodedBytes+1))]){
  assert.equal(await loadBoundedGrade(C,'/',get),undefined);
 }
 let late=false;
 const delayed=async()=>{await new Promise(r=>setTimeout(r,35));late=true;return new Response(new Uint8Array(pack));};
 assert.equal(await loadBoundedGrade(C,'/',delayed,3),undefined);
 await new Promise(r=>setTimeout(r,45));assert(late);
 const ix=readFileSync(world('woodland/hedgerows-v1/index.json'));
 assert(await kingsDryCrownHedges('/',body(ix)));
 const altered=new Uint8Array(ix);altered[10]^=32;
 assert(!await kingsDryCrownHedges('/',body(altered)));
 assert(!await kingsDryCrownHedges('/',body(ix,404)));
 assert(!await kingsDryCrownHedges('/',delayed,3));
});
