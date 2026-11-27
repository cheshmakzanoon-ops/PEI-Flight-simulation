import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const input=name=>readFileSync(new URL('../../../data/baywalk/'+name,import.meta.url));
const load=name=>JSON.parse(input(name));
test('the two bounded observations identify the pinned archive without recertifying the historical pack',()=>{
 const prior=load('native-scope.json'),check=load('shore-shoulder-source-check.json');
 const wkt=input('survey-archive-horizontal.wkt');
 assert.match(wkt.toString(),/AUTHORITY\["EPSG","2961"\]\]$/);
 assert.equal(createHash('sha256').update(wkt).digest('hex'),prior.archiveHorizontalWktSHA256);
 assert.equal(prior.archiveHorizontalWktSHA256,check.wktSHA256);
 assert.equal(prior.archiveHorizontalCRS,check.archiveHorizontalCRS);
 assert.equal(prior.historicalReceiptCRS,'EPSG:3979');
 assert.equal(prior.historicalWorkingCRS,'unverified');
 assert.equal(prior.etagCheckedWithRange,check.etag);
 assert.equal(prior.objectBytes,check.objectBytes);
 assert.equal(prior.officialSingleObject,check.officialSingleObject);
 assert.equal(check.windowHalfWidthM,6);
 for(const w of Object.values(check.windows)){
  assert.deepEqual(Object.keys(w.classCountsWithoutWithheldOrOverlap),['2','9']);
  assert.equal(Object.values(w.classCountsWithoutWithheldOrOverlap).reduce((n,r)=>n+r.count,0),w.qualifiedRawCount);
  assert.equal(w.worldCentre.length,2);
 }
 assert.deepEqual(Object.values(check.windows).map(w=>w.siteScreenWithin2m.unchangedOldDry.class2Count),[22,7]);
 assert.deepEqual(Object.values(check.windows).map(w=>Math.sign(w.siteScreenWithin2m.unchangedOldDry.medianSourcePlusLiftMinusStockContactM)),[-1,1]);
});
