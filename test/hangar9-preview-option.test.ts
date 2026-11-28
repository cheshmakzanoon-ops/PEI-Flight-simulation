import assert from 'node:assert/strict';
import test from 'node:test';
import {HANGAR9_OPTION,hangar9Consent,hangar9StockSearch} from '../src/app/hangar9-preview-option.ts';
import {landmarkPreviewCard} from '../src/app/landmark-preview-dispatch.ts';
const origin='https://flight.invalid/index.html';
const active='?departure=cysu&'+HANGAR9_OPTION+'=1';
test('stock stays stock; one exact Standard cysu offer and clear path',()=>{
 assert.equal(hangar9Consent('?departure=cysu'),false);
 for(const unknown of ['?departure=other','?departure=cysu&scenery=detail',active+'&buildingShadows','?departure=cysu&departure=cysu&'+HANGAR9_OPTION+'=1',
  active+'&'+HANGAR9_OPTION+'=1','?departure=cysu&h%61ngar9ApronPreview=1',active+'&diagnostics&diagnostics',
  active+'&railShinglePreview=1'])assert.equal(hangar9Consent(unknown),false,unknown);
 assert.equal(hangar9Consent(active),true);
 assert.equal(hangar9Consent(active+'&scenery=standard&diagnostics'),true);
 assert.equal(hangar9StockSearch(active+'&diagnostics=%31'),'?departure=cysu&diagnostics=%31');
});
test('actual card URL retains benign query words; no mixed own or peer offer',()=>{
 const asked=landmarkPreviewCard(origin+'?departure=cysu&diagnostics=%31#keep','cysu');
 assert.equal(asked?.status,'available');assert.ok(asked.url);
 const u=new URL(asked.url);assert.equal(u.hash,'#keep');assert.equal(hangar9Consent(u.search),true);
 const on=landmarkPreviewCard(u.href,'cysu');assert.equal(on?.status,'selected');assert.ok(on.url);
 assert.equal(new URL(on.url).search,'?diagnostics=%31&departure=cysu');
 assert.equal(landmarkPreviewCard(origin+'?departure=cysu&scenery=detail','cysu')?.status,'blocked');
 assert.equal(landmarkPreviewCard(origin+active,'east-light')?.status,'blocked');
 assert.equal(landmarkPreviewCard(origin+'?departure=east-light&eastPointRimPreview=1','cysu')?.status,'blocked');
});
