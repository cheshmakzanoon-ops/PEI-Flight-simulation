import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Scene,BufferGeometry} from 'three';
import {northCapeLightOption} from '../src/app/north-cape-light-option.ts';
import {eastPointWallOption} from '../src/render/east-wall-preview.ts';
import {createNorthCapeLightPreview} from '../src/render/north-cape-light-preview.ts';

const offer='?departure=northcape-light-low&northCapeLightPreview';
const source='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';

test('North Cape is explicit, refuses competitors, and leaves their stock controls intact',()=>{
 assert.deepEqual(northCapeLightOption(offer),{route:true,visible:true,standardSearch:'departure=northcape-light-low'});
 assert.equal(northCapeLightOption(offer+'&scenery=standard').visible,true);
 for(const suffix of ['&northCapeLightPreview','&eastPointWallPreview=1','&scenery=detail',
  '&townWalls','&departure=northcape-wind-low','&diagnostics&diagnostics']){
  assert.equal(northCapeLightOption(offer+suffix).visible,false,suffix);
 }
 assert.equal(northCapeLightOption(offer+'=1').route,false);
 assert.equal(northCapeLightOption(offer+'&stockNorthCapeLight').visible,false);
 const foreign='?departure=basin-head-low&basinChannel&survey=one%20two';
 assert.equal(northCapeLightOption(foreign).standardSearch,foreign);
 const east='?departure=east-light&eastPointWallPreview=1';
 assert.equal(northCapeLightOption(east).standardSearch,east);
 assert.equal(eastPointWallOption(east+'&northCapeLightPreview').stockSearch,
  'departure=east-light&northCapeLightPreview=');
 assert.equal(northCapeLightOption(eastPointWallOption(east+'&northCapeLightPreview').stockSearch).standardSearch,'departure=east-light');
});

function fixture(terrain=source){
 const scene=new Scene(), base=new BufferGeometry();
 let owner:BufferGeometry|undefined=base;
 let height=5.54;
 const ground={
  terrain:{isLand:()=>true},cover:{legacyDistance:()=>102},
  rollingCanopyOwner:()=>owner?{key:'5-0',geometry:owner}:undefined,
  rollingCanopyStill:(_key:string,geometry:BufferGeometry)=>geometry===owner,
  visualGroundHeight:()=>height,
 } as Parameters<typeof createNorthCapeLightPreview>[1];
 const swap=new BufferGeometry();
 return {scene,actor:createNorthCapeLightPreview(scene,ground,terrain),
  unset:()=>{owner=undefined;},restore:()=>{owner=base;},replace:()=>{owner=swap;},raise:()=>{height+=.01;}};
}

test('the selected Ready departure remains detached until Begin and loses the lease on ground change',()=>{
 const {scene,actor,raise}=fixture();
 actor.dispatch(true,true);
 assert.equal(actor.phase,'ready');
 assert.equal(scene.children.length,0);
 actor.begin(true,true,true);
 assert.equal(actor.phase,'active');
 actor.update(true,true);
 assert.equal(scene.children.length,1);
 assert.equal(actor.state.mounted,true);
 assert.equal(scene.children[0].children.length,3);
 raise();
 actor.update(true,true);
 assert.equal(actor.phase,'held');
 assert.equal(actor.state.mounted,false);
 assert.equal(scene.children.length,0);
});

test('early Begin cannot stream in an actor; a fresh Dispatch can rearm',()=>{
 const f=fixture();const a=f.actor;
 f.unset();a.dispatch(true,true);a.begin(true,true,true);
 f.restore();a.update(true,true);
 assert.equal(a.phase,'held');
 assert.equal(f.scene.children.length,0);
 a.freshDispatch();a.dispatch(true,true);a.begin(true,true,true);a.update(true,true);
 assert.equal(a.phase,'active');
 f.replace();a.update(true,true);
 assert.equal(a.phase,'held');
 assert.equal(f.scene.children.length,0);
});

test('wrong terrain, changed renderer, or a different selection keep stock',()=>{
 const bad=fixture('other');
 bad.actor.dispatch(true,true);bad.actor.begin(true,true,true);bad.actor.update(true,true);
 assert.equal(bad.scene.children.length,0);
 const {actor,scene}=fixture();
 actor.dispatch(true,true);actor.begin(false,true,false);actor.update(false,true);
 assert.equal(scene.children.length,0);
 actor.freshDispatch();actor.dispatch(true,true);actor.begin(true,true,true);actor.update(true,false);
 assert.equal(actor.phase,'held');
 assert.equal(scene.children.length,0);
});
