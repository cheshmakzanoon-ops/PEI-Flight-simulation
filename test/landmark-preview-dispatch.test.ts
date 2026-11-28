import test from 'node:test';
import assert from 'node:assert/strict';
import {landmarkPreviewCard} from '../src/app/landmark-preview-dispatch.ts';
import {eastRimConsent} from '../src/app/east-roof-rim-option.ts';
import {railShingleConsent} from '../src/app/rail-shingle-option.ts';

const host='https://example.test/flight/sim';
test('default sites stay original; available buttons produce exactly existing scoped consent',()=>{
 assert.equal(landmarkPreviewCard(host,'new-glasgow-river-clyde'),undefined);
 for(const [id,flag,gate] of [['east-light','eastPointRimPreview',eastRimConsent],
                              ['spinnakers-low','railShinglePreview',railShingleConsent]] as const){
  const offered=landmarkPreviewCard(host+'?departure=other&scenery=standard&diagnostics=%31#keep',id);
  assert.equal(offered?.status,'available');assert.ok(offered.url);
  const request=new URL(offered.url);
  assert(gate(request.search));assert.equal(request.pathname,'/flight/sim');assert.equal(request.hash,'#keep');
  assert(request.search.includes('diagnostics=%31'));
  const active=landmarkPreviewCard(request.href,id);assert.equal(active?.status,'selected');assert.ok(active.url);
  assert.equal(new URL(active.url).searchParams.has(flag),false);
  assert.equal(new URL(active.url).searchParams.get('departure'),id);
  assert.equal(gate(new URL(active.url).search),false);
 }
});
test('incompatible and malformed settings are never normalized into enabled art',()=>{
 for(const search of ['scenery=detail','qa','inlandRelief','departure=x&departure=y','diagnostics&diagnostics',
  'eastPointWallFinish=1','railShinglePreview=1','%65astPointRimPreview=1','eastPointRimPreview=0']){
  const blocked=landmarkPreviewCard(host+'?'+search,'east-light');
  assert.equal(blocked?.status,'blocked',search);assert.equal(blocked.url,undefined);
 }
 assert.equal(landmarkPreviewCard(host+'?departure=east-light&eastPointRimPreview=1','spinnakers-low')?.status,'blocked');
});
