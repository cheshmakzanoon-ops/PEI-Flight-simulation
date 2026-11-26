import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneryOwnerPreflight} from './scenery-owner-preflight.mjs';
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const sku={holman:'46513f544a1ef2a3afbb39d73b72ee92e608062660ea90ef52acffd78e0b5dc7',
 founders:'8d1316262a304ad84eea4bde610a9d10a3c4d3373f0bdba08510924104ba08e0'};
test('matches the two known native owner spans without changing an original vertex',async()=>{
 const [h,f,l,fl]=await Promise.all([sceneryOwnerPreflight(root,'q032001',132),
  sceneryOwnerPreflight(root,'q120010',313),sceneryOwnerPreflight(root,'q032001',132,'legacy'),
  sceneryOwnerPreflight(root,'q120010',313,'legacy')]);
 assert.deepEqual([h.wholeVertices,h.span,h.originalRoofFaces,h.originalFacadeFaces,h.untouchedIndexType],[69906,[20157,20241],8,20,'Uint32Array']);
 assert.deepEqual([f.wholeVertices,f.span,f.originalRoofFaces,f.originalFacadeFaces,f.untouchedIndexType],[41007,[22968,23079],11,26,'Uint16Array']);
 assert.equal(h.canonicalRow,sku.holman);assert.equal(f.canonicalRow,sku.founders);
 assert.equal(h.untouchedIndexSHA,'f40ecf2bdf762ca09f82a86747dd8621f08a45d2fd566d59d376fbf97d977180');
 assert.equal(l.wholeVertices,69894);assert.deepEqual(l.span,h.span);assert.equal(l.downtown,false);
 for(const a of [h,f,l,fl])assert(a.matchesIndependentEmitterCompaction);
 assert.equal(f.townWallMode,'core');assert.equal(f.townWallAttribute,true);
 assert.equal(f.fields.townWallFit.stock,'5711d7a061136473b2fbc294722b444963f230e78daf4da63e3bc35cadb494f5');
 assert.equal(f.fields.townWallFit.selected,'ca687b6a7c3d29b566f3e1988b9f877b51d9a83ee25ffe0755a8dcd3eb5f434a');
 assert.equal(fl.townWallMode,null);assert.equal(fl.townWallAttribute,false);
 assert.equal(Object.keys(fl.fields).length,6);
 for(const [k,v] of Object.entries(fl.fields))assert.deepEqual(f.fields[k],v);
 assert.equal(f.untouchedIndexSHA,fl.untouchedIndexSHA);
});
test('rejects unrelated tile IDs and invalid profile or ordinals',async()=>{
 await assert.rejects(sceneryOwnerPreflight(root,'../terrain',132),/exact q tile/);
 await assert.rejects(sceneryOwnerPreflight(root,'q032001',-1),/nonnegative ordinal/);
 await assert.rejects(sceneryOwnerPreflight(root,'q032001',132,'other'),/standard or legacy/);
 await assert.rejects(sceneryOwnerPreflight(root,'q032001',654422),/No such authored/);
});
