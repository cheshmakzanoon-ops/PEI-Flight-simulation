import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {createHash} from 'node:crypto';
import {buildSourisTownHallCombinedStudy} from '../src/combined-studies.ts';
import {combinedHallOptions} from '../src/combined-options.ts';
import {deferHallTextures} from '../src/deferred-textures.ts';
import {makeStoneTile} from '../src/materials.ts';
import {STONE_ROLES,type RecipeReply,type TextureSize} from '../src/texture-contract.ts';

test('the combined preview requires exactly the new option and no legacy flags',()=>{
 const get=(q:string)=>combinedHallOptions(new URLSearchParams(q));
 for(const q of ['','entry=steps','roof=lower-rear','entry=steps&roof=lower-rear','study=combine',
  'study=lower-rear-and-steps&entry=steps','study=lower-rear-and-steps&shot=detail',
  'study=lower-rear-and-steps&study=lower-rear-and-steps','study=lower-rear-and-steps&texture=experimental',
  'study=lower-rear-and-steps&light=','study=lower-rear-and-steps&unrelated=1'])assert.equal(get(q),undefined,q);
 assert.deepEqual(get('study=lower-rear-and-steps'),{shot:'entry',size:512,light:'studio'});
 assert.deepEqual(get('study=lower-rear-and-steps&shot=rear&texture=flight&light=sim'),{shot:'rear',size:256,light:'sim'});
});

class Fake {
 onmessage:Worker['onmessage']=null;
 onerror:Worker['onerror']=null;
 onmessageerror:Worker['onmessageerror']=null;
 posts:unknown[]=[];stops=0;
 postMessage(x:unknown){this.posts.push(x);}
 terminate(){this.stops++;}
 send(data:unknown){this.onmessage?.apply({} as Worker,[{data} as MessageEvent]);}
}
const sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
for(const n of [256,512] as const)test(`compound ${n} reuses exact original eight procedural maps and one worker`,async()=>{
 const comp=buildSourisTownHallCombinedStudy(),w=new Fake();
 const batch={kind:'souris-masonry-v1',entries:STONE_ROLES.map(role=>({role,size:n,...makeStoneTile(role,n)!}))} satisfies RecipeReply;
 const mats=STONE_ROLES.map(k=>(comp.hall.getObjectByName(k) as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>).material);
 const treads=(comp.steps.getObjectByName('stoneTreads') as T.Mesh).material;
 const cheeks=(comp.steps.getObjectByName('stoneCheeks') as T.Mesh).material;
 const job=deferHallTextures(comp.hall,n,()=>w);
 assert.deepEqual(w.posts,[n]);assert.equal(treads,mats[1]);assert.equal(cheeks,mats[1]);
 assert(mats.every(m=>m.map===null&&m.normalMap===null));
 w.send(batch);
 assert.deepEqual(await job.ready,{state:'ready',bytes:8*n*n*4,size:n});
 assert.equal(w.stops,1);
 const owned=new Set<T.Texture>();
 let disposed=0;
 for(const [i,m] of mats.entries()){
  const p=batch.entries[i];
  assert(m.map instanceof T.DataTexture&&m.normalMap instanceof T.DataTexture);
  assert.equal(m.map.image.width,n);assert.equal(m.map.image.height,n);assert.equal(m.normalMap.image.height,n);
  assert.equal(sha(m.map.image.data as Uint8Array),sha(p.maps));
  assert.equal(sha(m.normalMap.image.data as Uint8Array),sha(p.norm));
  assert.deepEqual(m.map.repeat.toArray(),p.repeat);
  owned.add(m.map);owned.add(m.normalMap);
  assert.equal(m.map.colorSpace,T.SRGBColorSpace);assert.equal(m.normalMap.colorSpace,T.NoColorSpace);
 }
 assert.equal(owned.size,8);
 for(const x of owned)x.addEventListener('dispose',()=>disposed++);
 job.release();job.release();comp.dispose();comp.dispose();
 assert.equal(disposed,8);assert.equal(w.stops,1);
 assert(mats.every(m=>m.map===null&&m.normalMap===null));
});
test('blocked/malformed/late jobs keep the compound matte; no second mount',async()=>{
 const c=buildSourisTownHallCombinedStudy();
 const stop=()=>{throw Error('worker blocked');};
 assert.deepEqual(await deferHallTextures(c.hall,256,stop).ready,{state:'fallback',bytes:0,size:256});
 const w=new Fake(),bad=deferHallTextures(c.hall,256,()=>w);
 w.send({kind:'bad-request'});
 assert.deepEqual(await bad.ready,{state:'fallback',bytes:0,size:256});
 const v=new Fake(),job=deferHallTextures(c.hall,256,()=>v),h=v.onmessage;
 job.release();job.release();
 h?.apply({} as Worker,[{data:{kind:'late response'}} as MessageEvent]);
 assert.deepEqual(await job.ready,{state:'cancelled',bytes:0,size:256});
 assert.equal(v.stops,1);assert.equal(w.stops,1);
 c.dispose();
});
