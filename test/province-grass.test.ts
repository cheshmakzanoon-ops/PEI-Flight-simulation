import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {sceneryOptions,sceneryReviewBlock} from '../src/app/scenery-profile.ts';
import {GRASS_DIRECTORY_PIN as P,GRASS_SOURCE_PINS as S} from '../src/render/province-grass.generated.ts';
import {readFieldDirectory} from '../src/sim/field-shards.ts';
import {grassSourceAllows} from '../src/render/province-grass.ts';
import {originalGrassGrain} from '../src/render/province-grass-art.ts';
test('the optional classified grass study requires both trusted land pins and compatible Dispatch settings',()=>{
 assert(grassSourceAllows(S.terrain,S.cover,S.coverRaw));
 assert(!grassSourceAllows(S.terrain,S.cover,undefined));
 assert(!sceneryOptions('?scenery=detail&cavendishDetail').has('sourceGrassStudy'));
 assert(!sceneryReviewBlock('sourceGrassStudy',sceneryOptions('?sourceGrassStudy')));
 for(const f of ['surveyRelief','inlandRelief','buildingShadows','provinceFieldsReview','cropRowsReview','meadowTexture','northCapeWind'])
  assert(sceneryReviewBlock('sourceGrassStudy',sceneryOptions('?sourceGrassStudy&'+f)));
 assert.equal(sceneryReviewBlock('sourceGrassStudy',sceneryOptions('?scenery=detail&sourceGrassStudy')),'detail');
});
test('the exact compiled archive uses bounded immutable regional packs',()=>{
 const dir=new URL('../public/world/grass-study/index.fcr.gz',import.meta.url);
 const bytes=readFileSync(dir);const dig=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
 assert.equal(bytes.byteLength,P.packedSize);assert.equal(dig(bytes),P.packedHash);
 const plain=gunzipSync(bytes);assert.equal(dig(plain),P.rawHash);
 const raw=Uint8Array.from(plain).buffer;const index=readFieldDirectory(raw);assert(index);
 assert.equal(index.cells.size,3331);assert.equal(index.packs.length,43);
 assert(Math.max(...[...index.cells.values()].map(q=>q.size))<=3864);
 assert.equal(index.packs.reduce((n,p)=>n+p.size,0),1996492);
});
test('optical grass fibers are authored and deterministic, not imagery',()=>{
 const a=originalGrassGrain(),b=originalGrassGrain();
 assert.equal(a.image.width,256);assert.equal(a.image.height,256);
 assert.deepEqual(a.image.data,b.image.data);assert(a.generateMipmaps);
 a.dispose();b.dispose();
});
