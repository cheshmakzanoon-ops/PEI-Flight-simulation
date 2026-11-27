import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markTryonRockShoreUV,tryonRockMatches,tryonRockNear} from '../src/render/cape-tryon-rock.ts';
import {ORBY_COVER_SHA} from '../src/sim/orby-shore-closure.ts';

test('Cape rock is fail-closed to the current authenticated coast and terrain',()=>{
 const sha='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';
 const bounds=[-64.47,45.94,-61.93,47.1];
 const cover={sourceSha:ORBY_COVER_SHA,width:4096,height:2720};
 assert(tryonRockMatches(sha,bounds,cover));
 assert(!tryonRockMatches(undefined,bounds,cover));
 assert(!tryonRockMatches('wrong',bounds,cover));
 assert(!tryonRockMatches(sha,[-64.47,45.95,-61.93,47.1],cover));
 assert(!tryonRockMatches(sha,bounds,{...cover,height:2719}));
 assert(!tryonRockMatches(sha,bounds,{...cover,sourceSha:undefined}));
});

test('Cape coast marker marks only admitted complete source-triangle spans',()=>{
 const uv=new Float32Array(42);
 for(let i=0;i<uv.length;i++)uv[i]=i%2===0?.125:.25;
 assert.equal(markTryonRockShoreUV(uv,[[9,18],[36,54]]),uv);
 for(let i=0;i<uv.length/2;i++){
  assert.equal(uv[i*2],(i>=3&&i<6)||(i>=12&&i<18)?1:.125);
  assert.equal(uv[i*2+1],.25);
 }
});

test('Cape Tryon material stays cold outside its source aperture',()=>{
 const x=-23601,z=-3825;
 assert(tryonRockNear(x,z,1500));
 assert(tryonRockNear(-23711.65-1499,z,1500));
 assert(!tryonRockNear(-23711.65-1501,z,1500));
 assert(tryonRockNear(-23711.65-1799,z,1800));
 assert(!tryonRockNear(-23711.65-1801,z,1800));
 assert(!tryonRockNear(-38841,27786,1800)); // Borden
 assert(!tryonRockNear(NaN,z,1500));
 assert(!tryonRockNear(x,z,Infinity));
});

test('a departure during the Cover digest defers linking without losing the next local attempt',async()=>{
 const text=readFileSync(new URL('../src/render/world.ts',import.meta.url),'utf8');
 const a=text.indexOf(' async prepareTryonRock('),b=text.indexOf(' async prepareCapeWet(',a);
 assert(a>=0&&b>a);
 const code=new Script(ts.transpile('({'+text.slice(a,b)+'}).prepareTryonRock.call(world,camera)',{target:ts.ScriptTarget.ES2022}));
 const lease={started:false},world={tryonRockStage:lease,tryonRockPhase:'pending',cover:{}};
 const camera={position:{x:-23601,z:-3825}};
 let resolve:(answer:string)=>void=()=>{};
 const digest=new Promise<string>(done=>{resolve=done;});
 const pending=code.runInNewContext({world,camera,tryonRockNear,CAPE_TRYON_COVER_DECODED:'signed',
  crypto:{subtle:{}},verifyDecodedCover:()=>digest});
 assert(lease.started&&world.tryonRockPhase==='checking-cover');
 camera.position={x:-38841,z:27786};
 resolve('signed');await pending;
 assert(!lease.started&&world.tryonRockPhase==='pending');
});

test('the real Tryon mount returns both original materials away from the aperture and never overrides a foreign owner',()=>{
 const source=readFileSync(new URL('../src/render/world.ts',import.meta.url),'utf8');
 const a=source.indexOf(' private syncTryonRock('),b=source.indexOf(' private refreshMontagueReviewShore(',a);
 assert(a>=0&&b>a);
 const method=source.slice(a,b).replace(' private ',' ');
 const run=new Script(ts.transpile('({'+method+'}).syncTryonRock.call(world,pos)',{target:ts.ScriptTarget.ES2022}));
 const owners=[0,1].map(()=>{const stock={},authored={};return {stock,authored,mesh:{material:stock}};});
 const lease={owners,mounted:false,proof:()=>true};
 const world={tryonRockStage:lease,tryonRockPhase:'linked'};
 const frame=(x:number,z:number)=>run.runInNewContext({tryonRockNear,world,pos:{x,z}});
 frame(-38841,27786);
 assert(!lease.mounted&&owners.every(q=>q.mesh.material===q.stock));
 frame(-23601,-3825);
 assert(lease.mounted&&owners.every(q=>q.mesh.material===q.authored));
 frame(-38841,27786);
 assert(!lease.mounted&&owners.every(q=>q.mesh.material===q.stock));
 frame(-23601,-3825);
 assert(lease.mounted);
 const other={};owners[0].mesh.material=other;
 frame(-23601,-3825);
 assert.equal(world.tryonRockPhase,'stock-revoked');
 assert.equal(owners[0].mesh.material,other);
 assert.equal(owners[1].mesh.material,owners[1].stock);
 assert(!lease.mounted&&!lease.proof);
});
