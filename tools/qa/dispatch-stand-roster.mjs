/** Actual Three r187 geometry, existing app seeds/terrain/cover/hedges and
 * neutral flight. No browser, draw, screenshot, network or replacement asset. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import * as THREE from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {SITES} from '../../src/sim/places.ts';
import {spawn,neutral,step} from '../../src/sim/flight.ts';
import {ForestStream} from '../../src/sim/forest-stream.ts';
import {loadForestHeights} from '../../src/sim/forest-heights.ts';
import {HedgeStream} from '../../src/sim/hedge-stream.ts';
import {DISPATCH_STAND,PRINCE_DISPATCH_STAND,exactStandSeed} from '../../src/render/dispatch-stand-height.ts';
import {treeRandom} from '../../src/sim/tree-layout.ts';
const path=(x)=>new URL('../../'+x,import.meta.url),pub=path('public/');
const file=(x)=>fs.readFileSync(new URL(x,pub));
const H=(data)=>createHash('sha256').update(data).digest('hex'),asAB=(b)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const arraysha=(a)=>H(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const height=file('world/height.bin.gz'),coverRaw=file('world/cover.bin.gz'),dims=JSON.parse(file('world/terrain.json'));
const coverMeta=JSON.parse(file('world/cover.json'));const hh=gunzipSync(height),cc=gunzipSync(coverRaw);
assert.equal(H(hh),dims.sha256);assert.equal(H(coverRaw),coverMeta.compressedSha256);
assert.equal(H(cc),'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
assert.equal(H(file('world/woodland/stream-v1/index.json')),'5878c49f6a6c2cb896606c07be2d2943586edad10f45871116d36ef88d716efe');
const t=new Terrain(dims,new Int16Array(asAB(hh))),c=new Cover(coverMeta.width,coverMeta.height,
 new Uint8Array(asAB(cc)),undefined,coverMeta.compressedSha256,undefined,undefined,H(cc));
const surface=(x,z)=>{
 const land=c.distance(t,x,z)>0;return {land,height:t.contactHeight(x,z,land)};
};
const prince=process.argv.includes('--prince');
const victim=prince?PRINCE_DISPATCH_STAND:DISPATCH_STAND,held=prince?['47309','78870']:['478492','530951'];
let deliver,requested=false,hold=new Promise(r=>{deliver=r;});
const paths=new Map();
const request=async(input,init)=>{
 const p=new URL(String(input)).pathname.slice(1);assert(!p.includes('..'));
 let a=paths.get(p);if(!a){try{a=file(p);paths.set(p,a);}catch{return new Response(null,{status:404});}}
 const r=/^bytes=(\d+)-(\d+)$/.exec(new Headers(init?.headers).get('range')??'');
 if(p.endsWith('/heights-03.pack')&&r?.[1]===held[0]&&r?.[2]===held[1]){
  requested=true;await hold;
 }
 return r?new Response(a.subarray(+r[1],+r[2]+1),{status:206,headers:{'content-range':`bytes ${r[1]}-${r[2]}/${a.length}`}}):new Response(a);
};
const root=fileURLToPath(path('src/render/vegetation.ts'));
const testPath=new URL('file://'+root).href;
registerHooks({load(url,context,nextLoad){
 const orig=nextLoad(url,context);
 if(url!==testPath)return orig;
 const k='import.meta.env.BASE_URL';const s=String(orig.source);
 assert.equal(s.split(k).length,2);
 return {...orig,source:s.replace(k,'"https://fixture.invalid/"')};
}});
const {Vegetation}=await import(testPath);
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
const forests=new ForestStream('https://fixture.invalid/',request);
const hedges=new HedgeStream('https://fixture.invalid/',request);
const pilot=await loadForestHeights('https://fixture.invalid/',request);
assert(pilot);
const make=()=>new Vegetation(new THREE.Scene(),t,c,pilot,forests,hedges);
const p=make(),b=make();
let wallClock=0;Object.defineProperty(performance,'now',{configurable:true,value:()=>wallClock});
const site=SITES.find(s=>s.id===victim.route);assert(site);
const seed=spawn(site,surface);assert.equal(site.height,55);
const settle=(s,F=seed)=>s.update(F.x,F.z,F.y);
settle(p);settle(b);
assert.equal(forests.captureHeightPlan(victim.owner,victim.sha256),undefined);
const reference=()=>({stem:p.stems.array.slice(),shade:p.hedgeGround.array.slice(),shape:p.shapes.array.slice(),
 count:p.geom.instanceCount,hedge:p.hedgeStart,stemVersion:p.stems.version,shadeVersion:p.hedgeGround.version});
const stock0=reference();
deliver();
const ready=await (async()=>{
 for(let i=0;i<160;i++){
  const s=forests.captureHeightPlan(victim.owner,victim.sha256);if(s)return s;
  await new Promise(r=>setTimeout(r,15));
 }
})();
assert(requested&&ready,'signed local source response must participate');
const prepared=p.prepareDispatchStand(ready,seed.x,seed.z,victim);
assert(prepared&&prepared.slots.length>1000);
assert.deepEqual(reference(),stock0,'readying may not change any cached/submitted data');
assert(!p.takeDispatchStand(prepared,seed.x+.01,seed.z,victim),'wrong spawn may not take');
assert.equal(p.dispatchStandAdjusted,0);
assert(!p.takeDispatchStand(prepared,seed.x,seed.z,prince?DISPATCH_STAND:PRINCE_DISPATCH_STAND));
assert(p.takeDispatchStand(prepared,seed.x,seed.z,victim));
assert.equal(p.stems.version,stock0.stemVersion);
assert.equal(p.hedgeGround.version,stock0.shadeVersion);
assert.equal(p.geom.instanceCount,stock0.count);
const counts=[];
const stamp=(n)=>{
 assert.equal(p.geom.instanceCount,b.geom.instanceCount);assert.equal(p.hedgeStart,b.hedgeStart);
 assert.equal(arraysha(p.stems.array),arraysha(b.stems.array));
 assert.equal(arraysha(p.hedgeGround.array),arraysha(b.hedgeGround.array));
 const X=p.stems.array,base=b.shapes.array,alt=p.shapes.array;
 let count=0, abs=0, max=0;
 const names=new Set(prepared.slots.map(s=>s.x+':'+s.z));
 for(let i=0;i<p.geom.instanceCount;i++){
  for(const j of [2,3])assert.equal(alt[i*4+j],base[i*4+j]);
  if(alt[i*4]===base[i*4]&&alt[i*4+1]===base[i*4+1])continue;
  const x=X[i*3],z=X[i*3+2];
  assert(i<p.hedgeStart&&ready.contains(x,z)&&names.has(x+':'+z));
  const q=exactStandSeed(x,z);assert(q);
  const h=ready.height(q.x,q.z,treeRandom(q.i,q.j,35));
  const w=h*(.83+treeRandom(q.i,q.j,9)*.35);
  const d=Math.abs(alt[i*4]-base[i*4]);abs+=d;max=Math.max(d,max);
  assert.equal(alt[i*4],Math.fround(h));assert.equal(alt[i*4+1],Math.fround(w));
  count++;
 }
 assert.equal(count,p.dispatchStandAdjusted);
 return {tick:n,actualInstances:p.geom.instanceCount,forest:p.hedgeStart,actualRescaledExistingRows:count,
            meanAbsStandHeightDeltaM:abs/Math.max(1,count),maxAbsStandDeltaM:max,
            unchangedStemSHA:arraysha(p.stems.array),exactOriginalHedgeGroundSHA:arraysha(p.hedgeGround.array)};
};
counts.push(stamp(0));
const fly=spawn(site,surface);
for(let i=1;i<=720;i++){
 step(fly,neutral,surface);
 // Reserve actual geom update each tick; measure subset at normal inquiry.
 // Use a common HedgeStream, and both see the same elapsed time/roster rule.
 wallClock=i*1000/90;
 settle(p,fly);settle(b,fly);
 if([1,90,180,360,540,720].includes(i))counts.push(stamp(i));
}
const before=stamp(720);
p.clearDispatchStand();
assert.equal(p.dispatchStandAdjusted,0);
assert.deepEqual(p.shapes.array,b.shapes.array,'same-site Dispatch backdrop restores original from actual ending roster');
assert.equal(arraysha(p.stems.array),before.unchangedStemSHA);
assert.equal(arraysha(p.hedgeGround.array),before.exactOriginalHedgeGroundSHA);
console.log(JSON.stringify({scope:'CPU receipt for stock Three r187 instancing and real neutral simulation only; no RGBA.',
 sourceOwner:victim.owner,signedDigest:victim.sha256,sourceAvailableOnlyAfterOriginalAllocation:true,
 readyDidNotWrite:true,allAttributesExceptMatchedHeightWidthWereExact:true,sameSiteDispatchRestoreExact:true,
 cloneBlocks:prepared.blocks.length,counts},null,2));
