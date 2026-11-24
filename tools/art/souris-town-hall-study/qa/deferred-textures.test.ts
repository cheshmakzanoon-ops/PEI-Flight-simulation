import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {buildSourisTownHall} from '../src/hall.ts';
import {deferHallTextures} from '../src/deferred-textures.ts';
import {STONE_ROLES,validateMasonry,type RecipeReply,type TextureSize} from '../src/texture-contract.ts';

const roles=STONE_ROLES;
const bases=[[3.68,2.52],[1.70,1.54],[2.58,1.62],[3.20,3.0]];
function batch(n:TextureSize=256){
 const entries=roles.map((role,i)=>({role,size:n,maps:new Uint8Array(n*n*4),norm:new Uint8Array(n*n*4),
  repeat:[1/bases[i][0],1/bases[i][1]] as [number,number]}));
 return {kind:'souris-masonry-v1',entries} satisfies RecipeReply;
}
class Fake {
 onmessage:Worker['onmessage']=null;
 onerror:Worker['onerror']=null;
 onmessageerror:Worker['onmessageerror']=null;
 posts:unknown[]=[];
 stops=0;
 postMessage(v:unknown){this.posts.push(v);}
 terminate(){this.stops++;}
 send(data:unknown){this.onmessage?.apply({} as Worker,[{data} as MessageEvent]);}
}
const colors=(g:T.Group)=>roles.map(n=>{
 const mesh=g.children.find(x=>x.name===n) as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
 return mesh.material;
});
test('rejects stale size, incomplete, repeated, aliased or differently calibrated material maps',()=>{
 const valid=batch();
 assert.equal(validateMasonry(valid,256)?.size,4);
 assert.equal(validateMasonry(valid,512),undefined);
 assert.equal(validateMasonry({...valid,entries:valid.entries.slice(1)},256),undefined);
 assert.equal(validateMasonry({...valid,entries:valid.entries.map((x,i)=>i===1?valid.entries[0]:x)},256),undefined);
 valid.entries[0].norm=valid.entries[0].maps;
 assert.equal(validateMasonry(valid,256),undefined);
 const sparse=batch();sparse.entries[0].repeat=new Array(2) as [number,number];
 assert.equal(validateMasonry(sparse,256),undefined);
 const differentRoleAlias=batch();differentRoleAlias.entries[1].maps=differentRoleAlias.entries[0].maps;
 assert.equal(validateMasonry(differentRoleAlias,256),undefined);
 const calibrated=batch();calibrated.entries[0].repeat[0]=4;
 assert.equal(validateMasonry(calibrated,256),undefined);
});

test('leaves an opaque original matte model until every role is ready',async()=>{
 const hall=buildSourisTownHall({textured:false}),m=colors(hall),w=new Fake();
 const task=deferHallTextures(hall,256,()=>w);
 const plain=m.map(x=>x.color.getHex());
 assert.ok(plain.every(x=>x!==0xffffff));
 assert.ok(m.every(x=>x.map===null&&x.normalMap===null));
 assert.deepEqual(w.posts,[256]);
 w.send(batch());
 assert.deepEqual(await task.ready,{state:'ready',size:256,bytes:2_097_152});
 assert.ok(m.every(x=>x.map instanceof T.DataTexture&&x.normalMap instanceof T.DataTexture&&x.color.getHex()===0xffffff));
 assert.equal(w.stops,1);
 task.release();task.release();
 assert.equal(w.stops,1);
 assert.deepEqual(m.map(x=>x.color.getHex()),plain);
 assert.ok(m.every(x=>x.map===null&&x.normalMap===null));
});

test('bad response or screen closure never leaves half of the detailed textures installed',async()=>{
 const g=buildSourisTownHall({textured:false}),m=colors(g),w=new Fake();
 const a=deferHallTextures(g,256,()=>w);
 w.send({kind:'bad-request'});
 assert.equal((await a.ready).state,'fallback');
 assert.ok(m.every(x=>x.map===null&&x.normalMap===null));
 const b=new Fake(),job=deferHallTextures(g,256,()=>b),late=b.onmessage;
 job.release();
 late?.apply({} as Worker,[{data:batch()} as MessageEvent]);
 assert.equal((await job.ready).state,'cancelled');
 assert.ok(m.every(x=>x.map===null&&x.normalMap===null));
 assert.equal(b.stops,1);
});

test('worker construction denial or no reply resolves transparently in matte mode',async()=>{
 const g=buildSourisTownHall({textured:false}),m=colors(g);
 const blocked=deferHallTextures(g,512,()=>{throw Error('blocked')});
 assert.equal((await blocked.ready).state,'fallback');
 const w=new Fake(),timeout=deferHallTextures(g,256,()=>w,5);
 assert.equal((await timeout.ready).state,'fallback');
 assert.equal(w.stops,1);
 assert.ok(m.every(x=>x.map===null&&x.normalMap===null&&x.color.getHex()!==0xffffff));
});
