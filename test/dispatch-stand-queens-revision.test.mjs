import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {project} from '../src/sim/geo.ts';
import {ForestStream} from '../src/sim/forest-stream.ts';
import {REGIONAL_STANDS,REGIONAL_SOURCE} from '../src/render/regional-canopy/spec.ts';
import {RegionalCanopies} from '../src/render/regional-canopy/controller.ts';
import {decodeRegionalCanopy} from '../src/render/regional-canopy/assets.ts';
import * as contract from '../src/render/queens-dispatch-contract.ts';

const {QUEENS_DISPATCH_STAND:q,QUEENS_REGIONAL_BOX:box,
 QUEENS_REGIONAL_ROSTER:N,queensDispatchAdmits}=contract;
const legacyNegative=process.env.PEI_QUEENS_HELD_NEGATIVE==='1';
const regionalLeaf=process.env.PEI_REGIONAL_LEAF_APP;
assert(!legacyNegative||!regionalLeaf);
const H=b=>createHash('sha256').update(Buffer.from(b)).digest('hex');
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const file=p=>readFileSync(new URL('../public/'+p,import.meta.url));
const source=file('world/woodland/stream-v1/index.json');
assert.equal(H(source),'5878c49f6a6c2cb896606c07be2d2943586edad10f45871116d36ef88d716efe');
const wet=JSON.parse(file('world/cover.json')),wetZip=file('world/cover.bin.gz'),wetRaw=gunzipSync(wetZip);
const elevation=JSON.parse(file('world/terrain.json')),height=gunzipSync(file('world/height.bin.gz'));
assert.equal(H(height),REGIONAL_SOURCE.terrain);
assert.equal(H(wetZip),REGIONAL_SOURCE.cover);
assert.equal(H(wetRaw),REGIONAL_SOURCE.decoded);
const terrain=new Terrain(elevation,new Int16Array(ab(height)));
const cover=new Cover(wet.width,wet.height,new Uint8Array(ab(wetRaw)),undefined,H(wetZip),undefined,undefined,H(wetRaw));
const seed=project(q.lon,q.lat),stand=REGIONAL_STANDS[0];
const signed=file('world/regional-canopy-v1/'+stand.file);
assert.equal(H(signed),stand.wireSha);
const raw=gunzipSync(signed);
assert.equal(H(raw),stand.decodedSha);
const rows=decodeRegionalCanopy(ab(raw),stand);
assert.equal(rows?.length,364);
const appSource=new URL('../src/',import.meta.url);
const tsHook=registerHooks({load(url,context,nextLoad){
 const r=nextLoad(url,context);
 if(!url.startsWith(appSource.href)||!url.endsWith('.ts')||!r.source)return r;
 return {...r,source:"import.meta.env={BASE_URL:'https://fixture.invalid/'};\n"+r.source};
}});
const {Vegetation}=await import(new URL('render/vegetation.ts',appSource).href);
const {World}=await import(new URL('render/world.ts',appSource).href);
tsHook.deregister();
globalThis.fetch=()=>{throw Error('No network in controlled regional revision test');};
globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
const receiverScene=new THREE.Scene(),sky=new THREE.Texture();
const world=new World(receiverScene,terrain,new THREE.Texture(),{capabilities:{maxTextureSize:4096}},cover,sky);
world.details.load=async()=>undefined;
world.update(new THREE.Vector3(seed.x-18,127,seed.z+4),1);
assert.equal(world.rollingCanopyOwner(stand.canopyBounds)?.key,q.owner);
let meshURL=new URL('../src/render/regional-canopy/mesh.ts',import.meta.url);
if(regionalLeaf){
 meshURL=pathToFileURL(regionalLeaf+'/src/render/regional-canopy/mesh.ts');
 // Parent-owned candidate only; not an implicit rebase of either app.
 assert.equal(H(readFileSync(meshURL)),process.env.PEI_REGIONAL_LEAF_MESH_SHA);
 const crown=pathToFileURL(regionalLeaf+'/src/render/stock-crown-program.ts');
 assert.equal(H(readFileSync(crown)),process.env.PEI_REGIONAL_LEAF_PROGRAM_SHA);
}
const {createRegionalCanopy}=await import(meshURL.href);
const packs=new Map();
let exactOwnerRequests=0;
const forest=new ForestStream('https://fixture.invalid/',async(url,options)=>{
 const p=new URL(url);
 const prefix='/world/woodland/stream-v1/';
 assert(p.origin==='https://fixture.invalid'&&p.pathname.startsWith(prefix));
 const name=p.pathname.slice(prefix.length);
 if(name==='index.json')return new Response(source);
 assert(/^heights-[0-9]{2}\.pack$/.test(name));
 if(!packs.has(name))packs.set(name,file('world/woodland/stream-v1/'+name));
 const b=packs.get(name),r=/^bytes=(\d+)-(\d+)$/.exec(new Headers(options?.headers).get('range'));
 assert(r);
 const bytes=b.subarray(+r[1],+r[2]+1);
 if(name==='heights-04.pack'&&r[1]==='212212'&&r[2]==='248768'){
  exactOwnerRequests++;
  assert.equal(b.length,520308);
  assert.equal(H(bytes),'6792161ce3b913ef67dd41e23574dd8719a05629221a37e7db1aab57c9332cb2');
 }
 return new Response(bytes,{status:206,headers:{'content-range':`bytes ${r[1]}-${r[2]}/${b.length}`}});
});
await forest.warm(seed.x,seed.z,5000);
const view=forest.captureHeightPlan(q.owner,q.sha256);
assert(view&&exactOwnerRequests===1);
const within=(x,z)=>x>=box[0]&&z>=box[1]&&x<=box[2]&&z<=box[3];
const peer=v=>v.captureStockCanopy(box,N);
const genericSHA='e64150d4465bc880beb71c4599b901b32865594b1a15862a89e95b47fe3b593e';
function make(){
 let loadedAtCreation=true;
 const scene=new THREE.Scene();
 // Controlled translation of an existing warm/cold cache history: only the
 // old peer cells are loaded for its ORIGINAL roster. All heights are either
 // exact original stream samples or the actual unmeasured fallback branch;
 // no stem/variant/height arrays are directly seeded or overwritten here.
 const availability={height(x,z,fallback,vary){
  return loadedAtCreation&&within(Math.fround(x),Math.fround(z))?forest.height(x,z,fallback,vary):fallback;
 },update(){}};
 const sun=regionalLeaf?new THREE.Vector3(.4,.8,.44).normalize():undefined;
 const v=new Vegetation(scene,terrain,cover,undefined,availability,undefined,undefined,undefined,sun,
  undefined,undefined,!!regionalLeaf,!!regionalLeaf);
 const put=(x=seed.x,z=seed.z)=>v.update(x,z,110);
 put();
 assert.equal(H(peer(v)),stand.stockSha,'controlled original roster must match exact 1081 published words');
 return {v,scene,put,withPeer:(b)=>loadedAtCreation=b};
}
const position={...seed,y:110},eye={x:seed.x-18,z:seed.z+4,y:127};
function observer({scene,v}){
 let readCount=0,loadCount=0,buildCount=0,disposed=0;
 const gains=[];
 const stock={get stockCanopyRevision(){return v.stockCanopyRevision;},
  captureStockCanopy(...args){readCount++;return v.captureStockCanopy(...args);},
  crownFillMaterial:()=>v.crownFillMaterial()};
 const c=new RegionalCanopies(world,scene,stock,forest,'https://fixture.invalid/',[stand],async()=>{
  loadCount++;
  return {rows,create(...args){
   buildCount++;
   const art=createRegionalCanopy(...args);
   if(art){
    const dispose=art.dispose,gain=art.gainTo;
    art.dispose=()=>{disposed++;dispose();};art.gainTo=(n)=>{gains.push(n);gain(n);};
   }
   return art;
  }};
 });
 c.qualifyLayers(true);
 return {get state(){return c.state;},get member(){return c.state.stands[0];},
  update:(n,x=position,e=eye)=>c.update(x,e,76,90,true,true,n),
  stats:()=>[readCount,loadCount,buildCount,disposed],gains:()=>gains.slice(),
  object:()=>scene.getObjectByName('Regional canopy '+stand.id)};
}
const originalDigest=crypto.subtle.digest.bind(crypto.subtle);
function holdPeerDigest(){
 const seen=[];
 let release;const promise=new Promise(r=>{release=r;});
 const originalDescriptor=Object.getOwnPropertyDescriptor(crypto.subtle,'digest');
 Object.defineProperty(crypto.subtle,'digest',{configurable:true,value:async(alg,input)=>{
  if(input.byteLength===N*5*4){seen.push(H(input));await promise;}
  return originalDigest(alg,input);
 }});
 return {seen,release,restore(){
  release();
  if(originalDescriptor)Object.defineProperty(crypto.subtle,'digest',originalDescriptor);
  else delete crypto.subtle.digest;
 }};
}
const until=async check=>{
 for(let i=0;i<200;i++){
  if(check())return;
  await new Promise(r=>setTimeout(r,2));
 }
 assert.fail('async regional fixture did not settle');
};
const rev=v=>[v.beaconsfieldShadowRoster().revision,v.stockCanopyRevision];
const take=v=>{
 const c=v.prepareDispatchStand(view,seed.x,seed.z,q);
 assert(c&&c.slots.length>15000&&c.slots.every(a=>queensDispatchAdmits(a.x,a.z)));
 assert(v.takeDispatchStand(c,seed.x,seed.z,q));
 return c;
};
const rest=async (...controls)=>{
 for(const s of controls)s.update(800);
 await until(()=>controls.every(s=>s.state.cover==='ready'));
 for(const s of controls)s.update(1000);
 await until(()=>controls.every(s=>s.member.pack==='ready'));
 for(const s of controls){
  s.update(1200);s.update(1900);
  assert(s.object()?.visible,'authorized genuine CPU actor must attach and turn visible: '+JSON.stringify(s.state));
  assert.equal(s.state.draw,364);assert.equal(s.state.gain,1);
 }
};
function equalProtected(gold,candidate){
 assert.deepEqual(peer(gold),peer(candidate));
 assert.deepEqual(gold.stems.array,candidate.stems.array);
 assert.deepEqual(gold.hedgeGround.array,candidate.hedgeGround.array);
}

test('in-flight genuine ordered peer remains ready directly across Queens take and actual clear',async()=>{
 const base=make(),a=make(),starting=rev(a.v);
 const old=observer(base),selected=observer(a),hold=holdPeerDigest();
 try{
  old.update(1);selected.update(1);
  assert.deepEqual(hold.seen,[stand.stockSha,stand.stockSha]);
  assert.equal(old.member.roster,'checking');assert.equal(selected.member.roster,'checking');
  const claim=take(a.v);
  assert.equal(a.v.dispatchStandAdjusted,claim.slots.length);
  assert.deepEqual(rev(a.v),[starting[0]+1,starting[1]+Number(legacyNegative)]);
  equalProtected(base.v,a.v);
  assert.notDeepEqual(a.v.shapes.array,base.v.shapes.array);
  old.update(2);selected.update(2);
  assert.deepEqual(selected.stats(),[1,0,0,0]);
  a.v.clearDispatchStand();
  assert.deepEqual(rev(a.v),[starting[0]+2,starting[1]+2*Number(legacyNegative)]);
  assert.deepEqual(a.v.shapes.array,base.v.shapes.array);
  old.update(3);selected.update(3);
  assert.equal(selected.member.roster,'checking');
  hold.release();await until(()=>selected.member.roster!=='checking'&&old.member.roster!=='checking');
  assert.equal(old.member.roster,'ready');
  assert.equal(selected.member.roster,legacyNegative?'waiting':'ready',
   'real active digest should not require an unnecessary recheck for the same exact peers');
  assert.deepEqual(selected.stats(),[1,0,0,0]);
  await rest(old,selected);
  assert.deepEqual(old.stats(),[1,1,1,0]);
  assert.deepEqual(selected.stats(),[legacyNegative?2:1,1,1,0]);
  if(legacyNegative)return;

  const rendered=selected.object(),seat=selected.member.seat;
  take(a.v);old.update(1920);selected.update(1920);
  equalProtected(base.v,a.v);
  assert.equal(selected.object(),rendered);assert.equal(seat,'ready');
  assert.deepEqual(selected.state,old.state);assert.deepEqual(selected.stats(),[1,1,1,0]);
  a.v.clearDispatchStand();old.update(1930);selected.update(1930);
  assert.equal(selected.object(),rendered);
  assert.equal(rev(a.v)[0],starting[0]+4);assert.equal(rev(a.v)[1],starting[1]);
  assert.deepEqual(selected.state,old.state);assert.deepEqual(selected.stats(),[1,1,1,0]);
  assert.deepEqual(base.v.shapes.array,a.v.shapes.array);
  assert.deepEqual(selected.gains(),[0,1,1,1]);assert.deepEqual(selected.gains(),old.gains());

  take(a.v);const beforeMove=rev(a.v);
  base.put(seed.x+148,seed.z);a.put(seed.x+148,seed.z);
  assert(a.v.dispatchStandAdjusted>0);
  assert.deepEqual(rev(a.v),[beforeMove[0]+1,beforeMove[1]+1]);
  old.update(1970);selected.update(1970);
  assert.deepEqual(selected.stats(),[2,1,1,0]);assert.deepEqual(selected.stats(),old.stats());
  assert.equal(selected.object(),rendered);equalProtected(base.v,a.v);
  a.v.clearDispatchStand();old.update(1990);selected.update(1990);
  assert.deepEqual(rev(a.v),[beforeMove[0]+2,beforeMove[1]+1]);
  assert.deepEqual(base.v.shapes.array,a.v.shapes.array);
  assert.deepEqual(selected.stats(),old.stats());assert.deepEqual(selected.gains(),old.gains());
 }finally{hold.restore();}
});

if(!legacyNegative)test('ordinary roster rebuild invalidates an old in-flight proof and refuses a different regenerated peer roster',async()=>{
 const a=make(),control=observer(a),hold=holdPeerDigest();
 try{
  const r=rev(a.v);control.update(1);assert.deepEqual(hold.seen,[stand.stockSha]);
  a.put(seed.x+148,seed.z); // same normal 135m update threshold, actual stock rebuild
  assert.deepEqual(rev(a.v),[r[0]+1,r[1]+1]);
  assert.equal(H(peer(a.v)),stand.stockSha);
  hold.release();await until(()=>control.member.roster!=='checking');
  assert.equal(control.member.roster,'waiting'); // stale until the actual new roster is compared
  assert.deepEqual(control.stats(),[1,0,0,0]);
  await rest(control);assert.deepEqual(control.stats(),[2,1,1,0]);

  const r2=rev(a.v),farX=seed.x+13200;
  a.put(farX,seed.z);
  control.update(2100,{...position,x:farX},{...eye,x:farX});
  assert.deepEqual(rev(a.v),[r2[0]+1,r2[1]+1]);assert.equal(control.stats()[3],1);
  a.withPeer(false);a.put();
  assert.deepEqual(rev(a.v),[r2[0]+2,r2[1]+2]);
  assert.equal(H(peer(a.v)),genericSHA);
  control.update(2500);control.update(3100);
  assert.equal(control.member.roster,'waiting');assert.equal(control.state.draw,0);
  assert.deepEqual(control.stats(),[3,1,1,1]);

  a.put(farX,seed.z);a.withPeer(true);a.put();
  assert.equal(H(peer(a.v)),stand.stockSha);
  control.update(3500);control.update(4100);
  assert.equal(control.member.roster,'ready');assert.equal(control.state.draw,364);assert.equal(control.state.gain,1);
  assert.deepEqual(control.stats(),[4,1,2,1]);
  assert.deepEqual(hold.seen,[stand.stockSha]); // cached signed equality only
 }finally{hold.restore();}
});

if(!legacyNegative)test('a newly overlapping observer fails take and for an already taken cohort makes actual clear notify normally',()=>{
 const a=make(),start=rev(a.v),c=a.v.prepareDispatchStand(view,seed.x,seed.z,q);
 assert(c&&contract.queensRegionalObserverDisjoint());
 const other=REGIONAL_STANDS[1],oldBox=other.bounds;
 try{
  const touching=[-12186.061666875947,seed.z-1,-12186.061666875947+20,seed.z+1];
  for(const refused of [undefined,[],[NaN,0,1,2],touching]){
   other.bounds=refused;assert(!contract.queensRegionalObserverDisjoint());
  }
  other.bounds=[seed.x-20,seed.z-20,seed.x+20,seed.z+20];
  assert(!contract.queensRegionalObserverDisjoint());
  assert.equal(a.v.prepareDispatchStand(view,seed.x,seed.z,q),false);
  assert(!a.v.takeDispatchStand(c,seed.x,seed.z,q));
  assert.deepEqual(rev(a.v),start);
  other.bounds=oldBox;
  assert(a.v.takeDispatchStand(c,seed.x,seed.z,q));
  assert.deepEqual(rev(a.v),[start[0]+1,start[1]]);
  other.bounds=[seed.x-20,seed.z-20,seed.x+20,seed.z+20];
  a.v.clearDispatchStand();
  assert.equal(a.v.dispatchStandAdjusted,0);assert.equal(H(peer(a.v)),stand.stockSha);
  assert.deepEqual(rev(a.v),[start[0]+2,start[1]+1]);
  a.v.clearDispatchStand();assert.deepEqual(rev(a.v),[start[0]+2,start[1]+1]);
 }finally{other.bounds=oldBox;}
});

if(!legacyNegative)test('clear without any actual H/W restore does not notify either revision',()=>{
 const a=make(),claim=take(a.v);
 // Local negative: external restoration already completed; the lease still
 // holds its slots but no submitted H/W match those alternate values.
 for(const s of claim.slots)a.v.shapes.setXY(s.slot,s.oldH,s.oldW);
 const before=rev(a.v),upload=a.v.shapes.version;
 a.v.clearDispatchStand();
 assert.equal(a.v.dispatchStandAdjusted,0);assert.deepEqual(rev(a.v),before);
 assert.equal(a.v.shapes.version,upload);
});
