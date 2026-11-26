import test from 'node:test';
import assert from 'node:assert/strict';
import {INDIAN_RIVER_LENS,INDIAN_RIVER_ROUTE,indianRiverLensState,indianRiverLensFlight,indianRiverCanCommit,sceneryOptions,switchIndianRiverLens} from '../src/app/scenery-profile.ts';

test('Indian River preview leaves every normalized Standard option unchanged and only launches its one route',()=>{
 const off='?diagnostics&scenery=standard&stockSeacowExterior&departure='+INDIAN_RIVER_ROUTE;
 const raw='https://example.test/sim/'+off+'#map';
 const opened=new URL(switchIndianRiverLens(raw,true,INDIAN_RIVER_ROUTE));
 assert(opened.searchParams.has(INDIAN_RIVER_LENS));assert(!opened.searchParams.has('indianRiverReview'));
 assert.equal(opened.hash,'#map');
 assert.deepEqual([...sceneryOptions(opened.search)],[...sceneryOptions(off)]);
 assert.equal(indianRiverLensState(opened.search).active,true);
 const closed=new URL(switchIndianRiverLens(opened.href,false,INDIAN_RIVER_ROUTE));
 assert(!closed.searchParams.has(INDIAN_RIVER_LENS));assert.equal(closed.hash,'#map');
 assert.deepEqual([...closed.searchParams],[...new URL(raw).searchParams]);
 assert.equal(switchIndianRiverLens(raw,true,'summerside'),raw);
 for(const query of ['&scenery=detail','&qa','&unknown','&indianRiverReview','&buildingShadows','&departure=summerside','&'+INDIAN_RIVER_LENS]){
  assert.equal(indianRiverLensState(opened.search+query).active,false,query);
 }
 assert.equal(indianRiverLensState(opened.search.replace(INDIAN_RIVER_ROUTE,'summerside')).active,false);
});
test('only a flying Indian River departure can begin the coupled grade/owner transaction',()=>{
 for(const mode of ['dispatch','map','help','credits']){
  assert.deepEqual(indianRiverLensFlight(INDIAN_RIVER_ROUTE,mode,'dispatch'),{initiate:false,retain:false});
 }
 for(const mode of ['paused','crash','map','help','credits']){
  assert.deepEqual(indianRiverLensFlight(INDIAN_RIVER_ROUTE,mode,'flight'),{initiate:false,retain:true});
  assert.deepEqual(indianRiverLensFlight(INDIAN_RIVER_ROUTE,mode,'crash'),{initiate:false,retain:true});
 }
 assert.deepEqual(indianRiverLensFlight(INDIAN_RIVER_ROUTE,'flight','dispatch'),{initiate:true,retain:true});
 assert.deepEqual(indianRiverLensFlight('summerside','flight','paused'),{initiate:false,retain:false});
});


test('only a true airborne start with clearance can install changed contact',()=>{
 assert(indianRiverCanCommit(true,true,false,'flying',24));
 for(const status of ['rolling','touchdown','stopped','crashed','unknown'])
  assert(!indianRiverCanCommit(true,true,false,status,90));
 for(const clearance of [NaN,Infinity,-1,0,23.999])
  assert(!indianRiverCanCommit(true,true,false,'flying',clearance));
 assert(!indianRiverCanCommit(false,true,false,'flying',900));
 assert(indianRiverCanCommit(false,true,true,'stopped',0));
 assert(!indianRiverCanCommit(false,false,true,'flying',90));
});

import {Mesh,MeshBasicMaterial,Scene} from 'three';
import {prepareChurchArt} from '../src/render/indian-river/runtime.ts';
import {pinChurchLensArt} from '../src/render/indian-river/church-lens-custody.ts';

test('recursive renderer custody rejects drift to an actual tier mesh but allows authored far/LOD selection',()=>{
 const scene=new Scene(),art=prepareChurchArt(),group=art.group;
 scene.add(group);
 const pin=pinChurchLensArt(group,scene);
 assert(pin?.());
 const lod=group.children[0],far=group.children[1];
 let leaf:Mesh|undefined;
 lod.children[1].traverse(m=>{if(!leaf&&m instanceof Mesh)leaf=m;});
 assert(leaf);const l=leaf as Mesh,old=l.material;
 far.visible=true;lod.visible=false;assert(pin());
 far.visible=false;lod.visible=true;assert(pin());
 l.material=new MeshBasicMaterial();assert(!pin());
 l.material=old;assert(pin());
 const materials=Array.isArray(l.material)?l.material:[l.material];
 materials[0].visible=false;assert(!pin());materials[0].visible=true;assert(pin());
 const real=lod as import('three').LOD;
 real.autoUpdate=false;assert(!pin());real.autoUpdate=true;assert(pin());
 l.visible=false;assert(!pin());l.visible=true;assert(pin());
 const host=l.parent!;host.remove(l);assert(!pin());
});
