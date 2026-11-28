import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,openSync,readSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {test} from 'node:test';
import {eastHouseScope,eastPointWallConsent,eastPointWallOption,makeEastPointWallPreview} from '../src/render/east-wall-preview.ts';

const scope=eastHouseScope;
const route=scope.route;
const input='?departure=east-light&eastPointWallPreview=1';
const hash=(v:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength)).digest('hex');
function fixture(){
 const wire=new Uint8Array(scope.length);
 const fd=openSync(new URL('../public/world/buildings/tiles.pack',import.meta.url),'r');
 try{assert.equal(readSync(fd,wire,0,wire.length,scope.offset),wire.length);}finally{closeSync(fd);}
 assert.equal(hash(wire),scope.wire);
 // This isolates lifecycle from terrain. GPU/fit evidence comes from the actual arrival proof.
 const initial={object:{},wire:wire.buffer,position:new Float32Array(scope.vertices*3),
  fit:new Int16Array(scope.vertices*3),roof:new Float32Array(scope.vertices),versions:[0,0,0] as const};
 for(let i=0;i<scope.marked;i++) initial.fit[i*3]=30;
 let value:typeof initial|undefined=initial;
 const gain={value:0};
 const pins={position:hash(initial.position),fit:hash(initial.fit),roof:hash(initial.roof)};
 const preview=makeEastPointWallPreview(true,()=>value,pins,{gain});
 return {preview,gain,initial,set:(v:typeof value)=>{value=v;}};
}
type Preview=ReturnType<typeof fixture>['preview'];
async function until(p:Preview,want:string){
 for(let i=0;i<140&&p.phase!==want;i++)await sleep(2);
 assert.equal(p.phase,want);
}

test('explicit East Point only; duplicate, competing and other routes refuse',()=>{
 assert.equal(eastPointWallConsent(input),true);
 assert.equal(eastPointWallConsent(input+'&diagnostics'),true);
 for(const q of ['',input+'&departure=east-light',input+'&eastPointWallPreview=1',
  input+'&scenery=detail',input+'&stockEastPointWalls',input+'&townWalls',input+'&surveyRelief',
  input.replace('east-light','northcape-wind-low'),input.replace('=1','=0')])
  assert.equal(eastPointWallConsent(q),false,q);
});

test('early Begin cannot gain a late appearance; real Dispatch reset can rearm',async()=>{
 const {preview:p,initial,gain,set}=fixture();
 set(undefined);p.dispatch(route,true);p.begin(route,true,true);
 assert.equal(p.phase,'held');assert.equal(p.available,false);
 set(initial);p.dispatch(route,true);p.frame(route,true,true);assert.equal(p.available,true);
 assert.equal(p.phase,'held');assert.equal(p.owner,undefined);assert.equal(gain.value,0);
 p.freshDispatch();p.dispatch(route,true);await until(p,'ready');
 p.begin(route,true,true);assert.equal(p.phase,'active');assert.equal(p.owner,undefined);
 p.frame(route,true,true);assert.equal(p.owner,initial.object);assert.equal(gain.value,1);
 p.frame(route,false,true);assert.equal(p.phase,'active');assert.equal(p.owner,undefined);assert.equal(gain.value,0);
 p.frame(route,true,true);assert.equal(p.owner,initial.object);
 p.frame(route,true,false);assert.equal(p.phase,'held');assert.equal(p.owner,undefined);assert.equal(gain.value,0);
});

test('changed source or roof fit cannot activate; retired epoch cannot settle the new one',async()=>{
 const a=fixture();
 a.preview.dispatch(route,true);a.preview.freshDispatch();a.set(undefined);
 await sleep(10);assert.equal(a.preview.phase,'waiting');a.preview.begin(route,true,true);
 assert.equal(a.preview.phase,'held');assert.equal(a.preview.owner,undefined);
 const b=fixture();
 const wire=new Uint8Array(b.initial.wire.slice(0));wire[0]^=0x10;
 b.set({...b.initial,wire:wire.buffer});b.preview.dispatch(route,true);await until(b.preview,'held');
 assert.equal(b.preview.owner,undefined);
 const c=fixture();
 c.initial.roof[0]=1;c.preview.dispatch(route,true);assert.equal(c.preview.phase,'held');
 assert.equal(c.preview.owner,undefined);
 const d=fixture();
 d.preview.dispatch(route,true);await until(d.preview,'ready');
 d.set({...d.initial,object:{}});d.preview.begin(route,true,true);
 assert.equal(d.preview.phase,'held');assert.equal(d.gain.value,0);
});

test('resident identity change aborts the active lease before another scoped draw',async()=>{
 const {preview:p,initial,gain,set}=fixture();
 p.dispatch(route,true);await until(p,'ready');p.begin(route,true,true);
 p.frame(route,true,true);assert.equal(p.owner,initial.object);
 set({...initial,wire:initial.wire.slice(0)});
 assert.equal(p.owner,undefined);p.frame(route,true,true);
 assert.equal(p.phase,'held');assert.equal(gain.value,0);
 p.freshDispatch();p.dispatch('cavendish',true);assert.equal(p.phase,'idle');
 p.begin('cavendish',true,true);assert.equal(p.owner,undefined);
});

test('removes only the locally owned comparison flags before every ordinary scenery decision',()=>{
 const canonical='?departure=east-light&scenery=standard&diagnostics';
 assert.deepEqual(eastPointWallOption(canonical),{requested:false,stockSearch:canonical});
 const compare=new URLSearchParams(canonical).toString();
 assert.deepEqual(eastPointWallOption(canonical+'&eastPointWallPreview=1'),{requested:true,stockSearch:compare});
 assert.deepEqual(eastPointWallOption(canonical+'&stockEastPointWalls&townWalls&mixed=2&mixed=3'),{
  requested:false,stockSearch:compare+'&townWalls=&mixed=2&mixed=3'});
 for(const source of ['?departure=cavendish','?departure=east-light&scenery=detail','?departure=east-light&alien=1',
   '?departure=east-light&departure=cavendish','?departure=east-light&diagnostics&diagnostics=one']){
  const actual=eastPointWallOption(source+'&eastPointWallPreview=1');
  assert.equal(actual.requested,false);assert.equal(actual.stockSearch,new URLSearchParams(source).toString());
 }
});
