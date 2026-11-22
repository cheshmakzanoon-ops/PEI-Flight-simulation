import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {unpackGzip} from '../src/sim/compression.ts';
test('accepts compressed and browser-decoded responses identically', async()=>{
 const src=new TextEncoder().encode('PEIR demo');
 const packed=Uint8Array.from(gzipSync(src)).buffer;
 for(const b of [src.buffer,packed])assert.deepEqual(new Uint8Array(await unpackGzip(b)),src);
});
