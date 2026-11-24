import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {GEORGETOWN_GROUND_SUN as S} from '../src/render/st-davids/ground-sun.generated.ts';
import {georgetownSunMatches} from '../src/render/st-davids/ground-sun.ts';
import {loadChurchGroundSun} from '../src/render/indian-river/church-ground-sun.ts';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const wire=readFileSync(new URL('../public/world/'+S.file,import.meta.url));
test('the only Georgetown light transport follows the reviewed art, transform, terrain and fixed daylight',async()=>{
 assert(georgetownSunMatches(S.terrainSha,S.sun));
 assert(!georgetownSunMatches(undefined,S.sun));
 assert(!georgetownSunMatches(S.terrainSha,[0,1,0]));
 assert(!georgetownSunMatches(S.terrainSha,[...S.sun,1]));
 assert.equal(wire.byteLength,S.wireBytes);assert.equal(hash(wire),S.wireSha);
 const raw=gunzipSync(wire);
 assert.equal(raw.byteLength,S.width*S.height);assert.equal(hash(raw),S.maskSha);
 assert.equal(raw.filter(x=>x>0).length,2389);
 assert.equal(raw.filter(x=>x===255).length,2318);
 for(const bits of [wire,raw]){
  const mask=await loadChurchGroundSun(S,'/world/',async url=>{
   assert.equal(url,'/world/'+S.file);return new Response(Uint8Array.from(bits));
  });
  assert(mask);assert.equal(mask.live.value,0);
  assert.equal(hash(mask.uniforms.churchSunMask.value.image.data),S.maskSha);
  mask.uniforms.churchSunMask.value.dispose();
 }
 const damaged=Uint8Array.from(wire);damaged[damaged.length>>>1]^=64;
 assert.equal(await loadChurchGroundSun(S,'/world/',async()=>new Response(damaged)),undefined);
});
