import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {provinceGrass} from '../src/render/province-grass.ts';
import type {FieldShardSource} from '../src/sim/field-shards.ts';
const reader={dir:{cells:new Map()}} as unknown as FieldShardSource;
const tick=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
test('idle cradle allocates no texture when off, abandons obsolete work, produces exact artifact only on admitted demand',async()=>{
 const q=provinceGrass(reader,true);const art=q.nap!;
 q.prepareNap();await tick(16);
 assert.equal(art.map.value,null);assert.equal(art.pending,false);
 q.admitted=true;q.prepareNap();art.wanted=false;
 await tick(16);assert.equal(art.map.value,null);assert.equal(art.pending,false);
 art.wanted=true;q.prepareNap();
 let ticks=0;
 while(art.pending){ticks++;await tick(8);assert.ok(ticks<250);}
 assert.ok(ticks>2,'generation must yield');
 // TypeScript does not know an async callback mutated the uniform.
 const n=art.map.value as null|{image:{data:Uint8Array}};
 assert.ok(n);
 assert.equal(createHash('sha256').update(n!.image.data).digest('hex'),'b2df230ff632bde794c14d85de37208188b43107b0872009b4afeca50dbd978b');
 assert.ok(Number.isFinite(art.readyAt));
 q.dispose();assert.equal(art.mix.value,0);assert.equal(art.map.value,null);
});
