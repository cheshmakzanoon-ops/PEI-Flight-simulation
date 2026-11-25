import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {ForestFloor} from '../src/render/forest-floor.ts';
import {CANOPY_FENCE} from '../src/render/canopy-fence.generated.ts';
import {Cover} from '../src/sim/cover.ts';

const state=(art:ForestFloor)=>art.state;
async function settled(art:ForestFloor){
 for(let n=0;n<50&&state(art)!=='failed';n++)await delay(4);
 assert.equal(state(art),'failed');
 assert.equal(art.uniforms.forestFloorMix.value,0);
 assert.equal(art.uniforms.forestFloorA.value,null);
 assert.equal(art.uniforms.forestFloorB.value,null);
}
test('ordinary forest floor waits for actual low contact and exact Cover proof before requesting images',async t=>{
 const paths:string[]=[];
 t.mock.method(globalThis,'fetch',async (url:string)=>{
  paths.push(url);return new Response('invalid floor image',{status:200});
 });
 const saved=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
 Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:()=>{throw Error('invalid body must not decode');}});
 t.after(()=>{
  if(saved)Object.defineProperty(globalThis,'createImageBitmap',saved);
  else Reflect.deleteProperty(globalThis,'createImageBitmap');
 });
 const wrong=new ForestFloor('/local/',new Cover(2,2,new Uint8Array(8)));
 assert.equal(wrong.shouldProbe(0),true);
 assert.equal(wrong.shouldProbe(.1),false);
 assert.equal(wrong.shouldProbe(.22),true);
 wrong.update(false,0);
 assert.equal(state(wrong),'idle');
 assert.deepEqual(paths,[]);
 wrong.update(true,10);
 assert.equal(state(wrong),'checking');
 await settled(wrong);
 assert.deepEqual(paths,[]);
 const source=new Cover(2,2,new Uint8Array(8),undefined,undefined,undefined,undefined,CANOPY_FENCE.pins.coverDecoded);
 const exact=new ForestFloor('/local/',source);
 exact.update(true,10);await settled(exact);
 assert.deepEqual(paths,['/local/art/forest-floor/duff-1.webp','/local/art/forest-floor/duff-2.webp']);
 exact.update(true,100);
 assert.equal(paths.length,2);
});
