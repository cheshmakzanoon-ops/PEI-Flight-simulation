/** Ensure opt-in Montague and Basin Head contour sources coexist, below the renderer. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {loadBasinGround} from '../../src/sim/basin-bank-relief.ts';
import {loadBasinChannel,loadHarbourCover} from '../../src/sim/harbour-cover.ts';
import {loadMontagueFoundation} from '../../src/sim/montague-foundation.ts';
import {coastSegments} from '../../src/sim/shoreline.ts';
import {montagueShoreReview} from '../../src/render/montague-shore.ts';
const path=f=>new URL('../../public/world/'+f,import.meta.url);
const file=f=>fs.readFileSync(path(f)),gzip=f=>gunzipSync(file(f));
const fetcher=async(f)=>new Response(file(String(f)));
const tm=JSON.parse(file('terrain.json')),cm=JSON.parse(file('cover.json'));
const tr=gzip(tm.file),cv=gzip(cm.file),heights=new Int16Array(tr.buffer,tr.byteOffset,tr.byteLength/2);
const [basin,qm,bank,mont]=await Promise.all([loadBasinChannel('',fetcher),loadHarbourCover('',fetcher),loadBasinGround('',fetcher),loadMontagueFoundation('',fetcher)]);
assert(basin&&qm&&bank&&mont);
const prior=new Terrain(tm,heights),candidate=new Terrain(tm,heights,[mont.ground]);
const atlas=new Cover(cm.width,cm.height,cv,qm,cm.compressedSha256,basin);
const next=new Cover(cm.width,cm.height,cv,qm,cm.compressedSha256,basin,mont.water);
assert.equal(next.waterInsets.length,3);
const bounds=mont.water.plan.boundsXZ;
const inside=(b,x,z)=>x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3];
const checks={basin:0,harbour:0,otherProvince:0,montague:0,newlyWet:0,unchangedOldWater:0};
const sample=(x,z,key)=>{
 const a=atlas.distance(prior,x,z),b=next.distance(candidate,x,z);
 checks[key]++;
 if(key==='montague'){
  if(a>=0&&b<0)checks.newlyWet++;
  if(a<0&&b<0)checks.unchangedOldWater++;
  assert(b<=a+1e-11);
  assert(!(a<0&&b>=0));
  if(b>=0)assert.equal(a,b);
 }else{
  assert.equal(b,a);
  assert.equal(candidate.contactHeight(x,z,b>=0),prior.contactHeight(x,z,a>=0));
 }
};
function area(plan,key,step){
 const [l,t,r,b]=plan.boundsXZ;
 for(let z=t;z<=b;z+=step)for(let x=l;x<=r;x+=step)sample(x,z,key);
}
area(basin.plan,'basin',1.05);area(qm.plan,'harbour',1.05);area(mont.water.plan,'montague',.5);
const grid=candidate.coastalGrids[0],around=[Math.min(bounds[0],grid.x0-2*grid.stepX*grid.spec.sub)-6,
 Math.min(bounds[1],grid.z0-2*grid.stepZ*grid.spec.sub)-6,Math.max(bounds[2],grid.x1+2*grid.stepX*grid.spec.sub)+6,
 Math.max(bounds[3],grid.z1+2*grid.stepZ*grid.spec.sub)+6];
for(let z=prior.top+12.9;z<prior.bottom;z+=191)
 for(let x=prior.left+20.1;x<prior.right;x+=317){if(!inside(around,x,z))sample(x,z,'otherProvince');}
const local=[bounds[0]-113,bounds[1]-113,bounds[2]+113,bounds[3]+113];
// The render-only replay accounts for exact reviewed arcs that extend
// beyond the separate survey water bounds. Exclude only those exact five
// cells, not their bounding rectangle.
const closure=montagueShoreReview(next,candidate);
assert(closure&&next.montague?.plan.contourReviewCells?.length===5);
const out=s=>!inside(local,s.ax,s.az)&&!inside(local,s.bx,s.bz)&&!closure.includes(s);
const old=coastSegments(atlas,prior),now=coastSegments(next,candidate);
const off=old.filter(out);
assert.deepEqual(now.filter(out),off);
assert(checks.newlyWet>3000);
const result={...checks,offMontagueSegmentsExactlyEqual:off.length,oldAllSegments:old.length,candidateAllSegments:now.length,
  reviewedRenderOnlyCells:next.montague.plan.contourReviewCells.length,
  simultaneouslyVerifiedInsets:next.waterInsets.map(p=>p.plan.id)};
console.log(JSON.stringify(result,null,2));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
