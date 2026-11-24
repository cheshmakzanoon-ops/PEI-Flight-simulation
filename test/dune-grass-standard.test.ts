import test from 'node:test';
import assert from 'node:assert/strict';
import {standardDuneGrassRequested,sceneryOptions} from '../src/app/scenery-profile.ts';
import {DuneGrassSurface} from '../src/render/dune-grass-surface.ts';
import {DUNE_GRASS_AUTHORITY as INDEX} from '../src/render/dune-grass-authority.generated.ts';
import {Terrain} from '../src/sim/terrain.ts';

const terrain=new Terrain({width:2,height:2,bounds:[-64.47,45.94,-61.93,47.1]},new Int16Array([1,1,1,1]));
const tick=()=>new Promise<void>(done=>setImmediate(done));
test('ordinary grass avoids locked studies without changing old opt-in semantics',()=>{
 const test=(s:string)=>standardDuneGrassRequested(sceneryOptions(s));
 assert(test(''));assert(test('?scenery=standard'));assert(test('?departure=queens-coastal-grass'));
 for(const s of ['scenery=detail','scenery=legacy','stockDuneGrass','duneGrassSurface','duneReliefStudy',
  'pointPrimStudy','regionalCanopyStudy','orthophotoSeamStudy','woodlandView','seatedForestShadows','canopyLight','shoreToneStudy','kingsDryCrownStudy'])assert(!test('?'+s),s);
 assert(!sceneryOptions('?stockDuneGrass&duneGrassSurface').has('duneGrassSurface'));
});
test('no proof work far/high; a late valid source does not authorize off-site asset reads',async()=>{
 const first=INDEX.index[0],x=first.uvOrigin[0]+first.cells[0]*2.5,z=first.uvOrigin[1]+first.cells[1]*2.5;
 let proof=0,downloads=0,finish!:(v:boolean)=>void;
 const alt=new DuneGrassSurface('/',terrain,async()=>{downloads++;return new Response(null,{status:404});});
 alt.permit(()=>{proof++;return new Promise<boolean>(ok=>{finish=ok;});});
 alt.update(x+450000,210,z);alt.update(x,900,z);await tick();assert.deepEqual([proof,downloads],[0,0]);
 alt.update(x,20,z);await tick();assert.deepEqual([proof,downloads],[1,0]);
 alt.update(x+450000,210,z);finish(true);await tick();alt.update(x+450000,210,z);await tick();
 assert.deepEqual([proof,downloads],[1,0]);assert.deepEqual(alt.diagnostics().active,[]);
});
test('a protected measured-dune tile has no grass uniforms or shader lease',()=>{
 const {tile}=INDEX.index[0];const plain=new DuneGrassSurface('/',terrain);
 const sealed=new DuneGrassSurface('/',terrain,fetch,new Set([tile.join('-')]));
 assert(plain.uniforms(...tile));
 assert.equal(sealed.uniforms(...tile),undefined);
});
