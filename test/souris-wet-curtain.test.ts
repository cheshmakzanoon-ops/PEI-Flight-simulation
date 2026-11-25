import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BufferAttribute,BufferGeometry,Mesh,Scene} from 'three';
import {standardSourisShoreline,standardPrinceSurveyRoof,standardOpenRipplesRequested} from '../src/app/scenery-profile.ts';
import {planSourisWetCurtainCut} from '../src/render/souris-wet-curtain-geometry.ts';
import {SourisWetCurtain} from '../src/render/souris-wet-curtain.ts';
import {SOURIS_WET_CURTAIN as pin} from '../src/render/souris-wet-curtain-pins.ts';

test('retire only Standard’s identified Souris stroke, without switching other peers',()=>{
 const q=(s:string)=>new URLSearchParams(s);
 assert(standardSourisShoreline(q('departure=souris-waterfront-pass&diagnostics')));
 assert(standardSourisShoreline(q('stockPrinceSurveyRoof')));
 assert(standardPrinceSurveyRoof(q('stockSourisShoreline')));
 assert(standardOpenRipplesRequested(q('stockSourisShoreline')));
 for(const x of ['scenery=detail','stockSourisShoreline','legacyShoreArcs','inlandRelief','surveyRelief'])
  assert(!standardSourisShoreline(q(x)),x);
});
const keptEast=[72806.9609375,-.14,16952.8828125,72759.359375,-.14,16952.8828125,72806.9609375,.72,16952.8828125,
 72806.9609375,.72,16952.8828125,72759.359375,-.14,16952.8828125,72759.359375,.72,16952.8828125];
const extra=[...keptEast,...keptEast,72700,0,16941,72720,0,16941,72700,1,16941,72700,1,16941,72720,0,16941,72720,1,16941];
const arrayOf=(q:typeof pin.quads[number])=>[
 q.x0,q.bottom0,q.z0, q.x1,q.bottom1,q.z1, q.x0,q.top0,q.z0,
 q.x0,q.top0,q.z0, q.x1,q.bottom1,q.z1, q.x1,q.top1,q.z1,
];
const source=()=>[...pin.quads.flatMap(q=>Array.from({length:q.copies},()=>arrayOf(q)).flat()),...extra];
function original(){
 const scene=new Scene(),g=new BufferGeometry(),p=source();
 g.setAttribute('position',new BufferAttribute(new Float32Array(p),3));
 g.setAttribute('uv',new BufferAttribute(new Float32Array(p.length/3*2),2));
 g.computeBoundingSphere();g.computeBoundingBox();
 const m=new Mesh(g);m.name='shore-to-sea surface';scene.add(m);
 return {scene,m,g};
}
test('four exact occurrences, split stays west of the admitted point on both copies',()=>{
 const {m,g}=original();
 const cut=planSourisWetCurtainCut([m],pin.decodedCover,pin);
 assert(cut&&cut.show());assert.equal(cut.count,4);assert.equal(cut.removedTriangles,4);
 const rest=arrayOf(pin.quads[1]);for(const i of [0,6,9])rest[i]=72666;
 assert.deepEqual(m.geometry.attributes.position.array,new Float32Array([...rest,...rest,...extra]));
 assert.deepEqual(m.geometry.boundingSphere,g.boundingSphere);
 assert.deepEqual(m.geometry.boundingBox,g.boundingBox);
 assert.deepEqual(g.attributes.position.array,new Float32Array(source()));
 cut.stock();assert.strictEqual(m.geometry,g);assert(cut.show());cut.dispose();assert.strictEqual(m.geometry,g);
});
test('wrong cover, a missing old occurrence, changed partial UV or foreign owner preserves stock',()=>{
 const {m,g}=original();assert.equal(planSourisWetCurtainCut([m],'a'.repeat(64),pin),undefined);
 const orig=g.attributes.position.getX(0);g.attributes.position.setX(0,orig+.25);
 assert.equal(planSourisWetCurtainCut([m],pin.decodedCover,pin),undefined);g.attributes.position.setX(0,orig);
 g.attributes.uv.setX(2*6,1);
 assert.equal(planSourisWetCurtainCut([m],pin.decodedCover,pin),undefined);g.attributes.uv.setX(2*6,0);
 const cut=planSourisWetCurtainCut([m],pin.decodedCover,pin);assert(cut);
 const foreign=new BufferGeometry();m.geometry=foreign;
 assert.equal(cut.show(),false);cut.dispose();assert.strictEqual(m.geometry,foreign);
});
test('runtime restores shared stock when leaving and reapplies only its own exact buffer while active',async()=>{
 const {scene,m,g}=original();let checks=0;
 const runtime=new SourisWetCurtain(scene,async()=>{checks++;return pin.decodedCover;});
 const camera={x:72732,y:62,z:16950};
 runtime.update({x:0,y:61,z:0});assert.equal(checks,0);
 runtime.update(camera);await Promise.resolve();runtime.update(camera);
 assert.equal(runtime.state.active,true);assert.equal(runtime.state.stockTrianglesRemoved,4);assert.equal(checks,1);
 const active=m.geometry;m.geometry=g;runtime.update(camera);assert.strictEqual(m.geometry,active);
 runtime.update({...camera,y:595});assert.strictEqual(m.geometry,g);assert.equal(runtime.state.active,false);
 runtime.update(camera);assert.strictEqual(m.geometry,active);assert.equal(checks,1);
 runtime.dispose();assert.strictEqual(m.geometry,g);assert.equal(scene.children.length,1);
});
test('a late proof cannot replace stock following disposal',async()=>{
 const {scene,m,g}=original();
 let ready:((s:string)=>void)|undefined;
 const runtime=new SourisWetCurtain(scene,()=>new Promise<string>(r=>{ready=r;}));
 runtime.update({x:72730,y:52,z:16952});assert(ready);
 runtime.dispose();ready(pin.decodedCover);
 await Promise.resolve();runtime.update({x:72730,y:52,z:16952});
 assert.strictEqual(m.geometry,g);assert.deepEqual(runtime.state,{proof:'rejected',active:false,stockQuadsAffected:0,stockTrianglesRemoved:0});
});
