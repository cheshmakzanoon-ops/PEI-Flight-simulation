import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sceneryOptions,standardPanmurePastureRequested} from '../src/app/scenery-profile.ts';
import {PASTURE,PanmurePastureFlight,pastureDigest,pastureEyeGain,pastureTile,correctPastureFrame} from '../src/render/panmure-pasture/flight.ts';
import {readPastureMask} from '../src/render/panmure-pasture/material.ts';
import {MASK,MASK_BOUNDS,MASK_SHAPE} from '../src/render/panmure-pasture/mask.generated.ts';
import {CANOPY_FENCE} from '../src/render/canopy-fence.generated.ts';
const src=(p:string)=>readFileSync(new URL('../public/world/'+p,import.meta.url));
const unpack=(b:Uint8Array)=>Uint8Array.from(b).buffer;
const tick=()=>new Promise(r=>setTimeout(r,1));
async function settle(test:()=>boolean){let n=0;while(!test()&&n++<200)await tick();assert(test());}
const eye={x:56155,z:39605,y:90},ready={proof:'ready',mounted:true,gain:1};
const owner=()=>unpack(src('buildings/tiles.pack').subarray(PASTURE.offset,PASTURE.offset+PASTURE.size));
test('only independent Standard admits this field; no old review or opt-out changes',()=>{
 const f=(s:string)=>standardPanmurePastureRequested(sceneryOptions(s));
 for(const s of ['','?departure=panmure-head-coast','?scenery=standard&diagnostics'])assert(f(s),s);
 for(const s of ['stockPanmurePasture','scenery=detail','scenery=other','sourceGrassStudy','meadowTexture','stockMeadow','surveyRelief','coastalOptics','aerialPerspectiveStudy','woodlandView','newUnreviewedSurface'])assert(!f('?'+s),s);
});
test('field registration matches the literal dimensions and origin as well as the tile',()=>{
 assert(correctPastureFrame(MASK_BOUNDS,MASK_SHAPE));
 for(const [b,s]of [[[...MASK_BOUNDS.slice(0,3),MASK_BOUNDS[3]+.125],MASK_SHAPE],[MASK_BOUNDS,[213,236]],[MASK_BOUNDS.slice(1),MASK_SHAPE]])assert(!correctPastureFrame(b,s));
 const tile={id:'25-18',i:25,j:18,x0:55000,z0:39000,w:2000,d:2000};
 assert(pastureTile(tile));assert(!pastureTile({...tile,x0:56100}));assert(!pastureTile({...tile,id:'24-18'}));
});
test('dated 1 m bytes, existing dry-class cells, and half-metre samples agree without importing geometry',async()=>{
 const mask=await readPastureMask();assert(mask);assert.equal(await pastureDigest(mask.buffer),PASTURE.mask);
 const c=gunzipSync(src('cover.bin.gz'));let nonzero=0,full=0;
 for(let j=0;j<236;j++)for(let i=0;i<213;i++){
  const m=mask[j*213+i];if(!m)continue;nonzero++;if(m===255)full++;
  const lon=(MASK_BOUNDS[0]+i+.5)/76762.59317717304-63.2,lat=46.5-(MASK_BOUNDS[1]+j+.5)/111161.08375388647;
  const u=(lon+64.47)/2.54,v=(47.1-lat)/1.16;
  assert.equal(c[2*(Math.floor(v*2720)*4096+Math.floor(u*4096))],30);
 }
 assert.equal(nonzero,10211);assert.equal(full,3739);
 assert.equal(await readPastureMask('%'+MASK.slice(1)),undefined);
 assert.equal(await readPastureMask('A'+MASK.slice(1)),undefined);
 assert.equal(await readPastureMask(MASK,[0,0,213,236],MASK_SHAPE),undefined);
});
test('the pinned drawn 640-pixel imagery and ordinary building and road records are independently authentic',async()=>{
 const d=JSON.parse(src('detail/index.json').toString()),m=d.tiles[PASTURE.tile],pack=src('detail/'+d.packs[m.pack].file);
 assert.equal(m.sha256,PASTURE.image);assert.equal(await pastureDigest(unpack(pack.subarray(m.offset,m.offset+m.bytes))),PASTURE.image);
 assert.equal(await pastureDigest(owner()),PASTURE.ownerSha);
 assert.equal(await pastureDigest(unpack(gunzipSync(src('roads.bin.gz')))),CANOPY_FENCE.pins.road);
});
test('no high/remote/dispatch activation; smoothly fade at altitude before the cutoff',()=>{
 assert.equal(pastureEyeGain({...eye,y:180}),1);assert.equal(pastureEyeGain({...eye,y:227.5}),.5);
 assert(pastureEyeGain({...eye,y:274.99})<1e-7);
 for(const v of [{...eye,y:275},{...eye,y:380},{...eye,x:0},{...eye,y:NaN}, {...eye,x:NaN}])assert.equal(pastureEyeGain(v),0);
});
test('the drawn owner and Cover must be proved while local; a late result cannot import the art after departure',async()=>{
 let loads=0;let go!:(s:string)=>void;const pending=new Promise<string>(r=>go=r);
 const c=new PanmurePastureFlight(()=>pending,async()=>{loads++;throw Error('not in view');});
 c.permit(true);const raw=owner();
 c.update(eye,1,false,false,()=>{throw Error('dispatch requested owner');});
 c.update({...eye,y:281},2,true,true,()=>{throw Error('high requested owner');});
 c.update(eye,3,true,true,()=>raw);await tick();
 assert.equal(c.state.proof,'checking');
 c.update({...eye,x:0},3.2,true,true,()=>{throw Error('remote requested owner');});
 go(CANOPY_FENCE.pins.coverDecoded);await settle(()=>c.state.proof==='cold');assert.equal(loads,0);
});
test('reloads, wrong sources and broken art keep the resident material at stock',async()=>{
 const r=owner();let mounts=0;let imports=0;let disposed=0;
 const c=new PanmurePastureFlight(async()=>CANOPY_FENCE.pins.coverDecoded,async()=>{imports++;return {gain:{value:0},install:()=>{mounts++;return true;},dispose:()=>{disposed++;}};});
 c.permit(true);c.update(eye,1,true,true,()=>r);await settle(()=>c.state.proof==='ready');
 c.update(eye,2,true,true,()=>r);c.update(eye,2.9,true,true,()=>r);assert.deepEqual(c.state,ready);
 c.update({...eye,y:275},3,true,true,()=>r);assert.equal(c.state.gain,0);
 c.update(eye,4,true,true,()=>undefined);assert.equal(c.state.gain,0);
 const wrong=r.slice(0);new Uint8Array(wrong)[4]^=1;c.update(eye,5,true,true,()=>wrong);
 await settle(()=>c.state.proof==='stock');assert.equal(c.state.gain,0);assert.equal(mounts,1);assert.equal(imports,1);assert.equal(disposed,0);
 const fail=new PanmurePastureFlight(async()=>CANOPY_FENCE.pins.coverDecoded,async()=>undefined);
 fail.permit(true);fail.update(eye,1,true,true,()=>r);await settle(()=>fail.state.proof==='stock');assert(!fail.state.mounted);
});
