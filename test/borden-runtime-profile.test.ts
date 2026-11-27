import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {bordenCoastRequested,aircraftRunwayCastRequested} from '../src/app/scenery-profile.ts';
import {stockOceanApertureDepth} from '../src/render/borden-ocean-depth.ts';

const params=(q:string)=>new URLSearchParams(q);
test('Borden opts into only normal Standard and its stock veto leaves unrelated runway depth on',()=>{
 for(const q of ['', 'scenery=standard&diagnostics', 'departure=bridge'])assert(bordenCoastRequested(params(q)),q);
 for(const q of ['scenery=legacy','scenery=standard&scenery=standard','qa=horse',
  'legacyShoreArcs','stockBordenCoast','testUnknownToggle'])assert(!bordenCoastRequested(params(q)),q);
 assert(aircraftRunwayCastRequested(params('stockBordenCoast')));
});

test('finite stock ocean depth requires a complete downhill aperture',()=>{
 const camera=new T.PerspectiveCamera(53,1.5,.08,350000);
 camera.position.set(-38840,50,27790);camera.lookAt(-38812,0,27814);camera.updateMatrixWorld();
 const aperture=new T.Box2(new T.Vector2(-.11,-.10),new T.Vector2(.10,.11));
 const depth=stockOceanApertureDepth(camera,aperture,-.055);
 assert(depth!==undefined&&depth>50&&depth<100);
 camera.lookAt(-38740,50,27790);camera.updateMatrixWorld();
 assert.equal(stockOceanApertureDepth(camera,aperture,-.055),undefined);
 camera.far=100000;camera.lookAt(-38812,0,27814);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 assert.equal(stockOceanApertureDepth(camera,aperture,-.055),undefined);
});
