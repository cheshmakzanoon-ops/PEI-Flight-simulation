import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

test('stock contact and native visual matching ports remain disconnected in three supersets',()=>{
 const tool=fileURLToPath(new URL('./stock-contact-connectivity.mjs',import.meta.url));
 const proc=spawnSync(process.execPath,['--experimental-strip-types',tool],{encoding:'utf8',timeout:20_000});
 assert.ifError(proc.error);assert.equal(proc.status,0,proc.stderr);
 const r=JSON.parse(proc.stdout);
 for(const p of Object.values(r.ports)){
  assert.ok(Math.abs(p.land)<1e-8);
  assert.ok(Math.abs(p.stockContact-p.nativeVisual)<1e-8);
 }
 assert.deepEqual(r.checks.map(x=>x.possibleBoxes),[1425,4524,29254]);
 for(const x of r.checks){
  assert.ok(x.distinct);
  assert.notEqual(x.portComponents.east,x.portComponents.west);
  assert.ok(x.possibleCoastalComponents.includes(x.portComponents.east));
  assert.ok(x.possibleCoastalComponents.includes(x.portComponents.west));
 }
 for(const x of r.checks.slice(0,2))assert.equal(x.possibleCoastalComponents.length,2);
});
