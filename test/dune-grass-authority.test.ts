import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {DUNE_GRASS_AUTHORITY as A} from '../src/render/dune-grass-authority.generated.ts';
import {openDuneGrassAuthority} from '../src/render/dune-grass-authority.ts';
const pack=readFileSync(new URL('../public/world/dune-grass/v1/authority.pack',import.meta.url));
const r=(b:Uint8Array)=>new Response(new Uint8Array(b));
test('all dune grass mask payloads authenticate without adding out-of-viewport assets',async()=>{
 const f=await openDuneGrassAuthority('world/',async url=>{
  assert.equal(url,'world/dune-grass/v1/authority.pack');return r(pack);
 });
 assert(f);assert.equal(pack.length,100121);
 let n=0,u=0;
 for(const s of A.index){
  assert(s.tile.join('-')!=='1-9'&&s.tile.join('-')!=='31-12');
  const b=await f.read(s);assert(b);
  assert.equal(s.offset,u);u+=s.wire;
  assert.equal(b.length,s.cells[0]*s.cells[1]);
  assert(b.subarray(0,s.cells[0]).every(x=>x===0));
  assert(Array.from(b).some(x=>x&1));n+=s.ownCells;
 }
 assert.equal(u,pack.length);
 assert.equal(n,180424);
});
test('authority accepts neither same-length corruption nor unbounded streaming',async()=>{
 const b=Uint8Array.from(pack);b[19]^=1;
 assert.equal(await openDuneGrassAuthority('',async()=>r(b)),undefined);
 assert.equal(await openDuneGrassAuthority('',async()=>r(new Uint8Array(pack.length+1))),undefined);
 assert.equal(await openDuneGrassAuthority('',async()=>new Response(null,{status:404})),undefined);
});
