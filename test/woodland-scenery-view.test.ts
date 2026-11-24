import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observerView} from '../src/sim/observer-view.ts';
import {sceneryOptions,sceneryReviewBlock,WOODLAND_SCENERY_FLAGS} from '../src/app/scenery-profile.ts';
const close=(a:number,b:number)=>assert(Math.abs(a-b)<1e-8,JSON.stringify([a,b]));
test('the scenery camera pitches down without modifying the aircraft',()=>{
 const f=Object.freeze({x:20,y:50,z:-10,heading:0,pitch:0,bank:1,throttle:.5,altitude:50});
 const p=observerView(f,1.36);
 p.eye.forEach((n,i)=>close(n,[20,54.2,6.8][i]));
 p.target.forEach((n,i)=>close(n,[20,29,-32.8][i]));
 close(Math.atan2(p.eye[1]-p.target[1],Math.hypot(p.eye[0]-p.target[0],p.eye[2]-p.target[2])),Math.atan2(25.2,39.6));
 assert.equal(f.throttle,.5);assert.equal(f.bank,1);assert.equal(f.altitude,50);
 const a=observerView({...f,heading:Math.PI/2},1.36);
 a.eye.forEach((n,i)=>close(n,[3.2,54.2,-10][i]));
 a.target.forEach((n,i)=>close(n,[42.8,29,-10][i]));
 assert(observerView(f,.66).eye[2]>p.eye[2]);
});
test('woodland scenery bundles only the previously qualified independent optics',()=>{
 const plain=sceneryOptions('?diagnostics');assert.equal(plain.has('sceneryObserver'),false);
 const opt=sceneryOptions('?woodlandView');assert(WOODLAND_SCENERY_FLAGS.every(k=>opt.has(k)));
 assert(!opt.has('canopyLight')&&!opt.has('buildingShadows'));
 for(const f of ['duneSandDetail','duneGrassSurface','seatedForestShadows','inlandRelief','indianRiverReview','buildingShadows','scenery=detail']){
  const r=sceneryOptions('?woodlandView&'+f);
  assert(!r.has('sceneryObserver'));assert(sceneryReviewBlock('woodlandView',r));
 }
});
