/** Verify the render-only legacy-cell refinements never move the wet physics. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {Terrain,OCEAN_Y} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {WaterInset,loadBasinChannel,loadHarbourCover} from '../../src/sim/harbour-cover.ts';
import {loadMontagueFoundation} from '../../src/sim/montague-foundation.ts';
import {coastSegments} from '../../src/sim/shoreline.ts';
import {montagueShoreReview,seatedMontagueCurtain} from '../../src/render/montague-shore.ts';
const file=f=>fs.readFileSync(new URL('../../public/world/'+f,import.meta.url));
const fetcher=async f=>new Response(file(String(f)));
const tm=JSON.parse(file('terrain.json')),cm=JSON.parse(file('cover.json'));
const h=gunzipSync(file(tm.file)),b=gunzipSync(file(cm.file));
const [source,basin,harbour]=await Promise.all([loadMontagueFoundation('',fetcher),loadBasinChannel('',fetcher),loadHarbourCover('',fetcher)]);
assert(source&&basin&&harbour);
const t=new Terrain(tm,new Int16Array(h.buffer,h.byteOffset,h.byteLength/2),[source.ground]);
const next=new Cover(cm.width,cm.height,b,harbour,cm.compressedSha256,basin,source.water);
const {contourReviewCells,...ordinaryPlan}=source.water.plan;
const old=new Cover(cm.width,cm.height,b,harbour,cm.compressedSha256,basin,new WaterInset(source.water.bytes,ordinaryPlan));
const view=montagueShoreReview(next,t),legacy=coastSegments(old,t),actual=coastSegments(next,t);
assert(view&&contourReviewCells?.length===5);
const outside=legacy.filter(s=>!view.includes(s));
assert.deepEqual(actual.filter(s=>!view.includes(s)),outside);
const removed=legacy.filter(view.includes),added=actual.filter(view.includes);
const [l,u,r,v]=view.bounds,stepX=(t.right-t.left)/next.width,stepZ=(t.bottom-t.top)/next.height;
let probes=0,maxZeroError=0;
for(let z=u-34.25;z<v+34;z+=.82)for(let x=l-36.71;x<r+36;x+=.77){
 assert.equal(next.distance(t,x,z),old.distance(t,x,z));probes++;
}
function countSegments(list){
 const seen=new Map();
 for(const e of list)for(const end of [[e.ax,e.az],[e.bx,e.bz]]){
  const k=end.map(v=>v.toFixed(4)).join(','),q=seen.get(k)??{n:0,xy:end};
  q.n++;seen.set(k,q);
 }
 return [...seen.values()].filter(s=>s.n===1).map(s=>s.xy);
}
const a=countSegments(removed),q=countSegments(added);
let worstJoin=0;
for(const lattice of [a,q]){
 const other=lattice===a?q:a;
 for(const pt of lattice){
  const d=Math.min(...other.map(o=>Math.hypot(o[0]-pt[0],o[1]-pt[1])));
  worstJoin=Math.max(worstJoin,d);assert(d<.02);
 }
}
for(const e of added){
 for(const alpha of [0,.25,.5,.75,1]){
  const x=e.ax+(e.bx-e.ax)*alpha,z=e.az+(e.bz-e.az)*alpha;
  maxZeroError=Math.max(maxZeroError,Math.abs(next.distance(t,x,z)));
 }
}
// Also falsify accidental in-plane water or terrain changes in the
// generated curtain geometry. It may emit vertical faces only.
const p=seatedMontagueCurtain(added,(x,z)=>t.meshElevation(x,z)+.12);
for(let i=0;i<p.length;i+=9){
 const X=new Set([p[i],p[i+3],p[i+6]]),Z=new Set([p[i+2],p[i+5],p[i+8]]);
 assert(X.size<=2&&Z.size<=2);
}
const result={reviewCells:contourReviewCells,eachCellSizeM:[stepX,stepZ],legacyExteriorSegmentsExact:outside.length,wetAndDryScalarProbesExactlyEqual:probes,
 oldChords:removed.length,lowerVarianceNewChords:added.length,unchangedAdjacentArcJoinCount:a.length,
 greatestAdjacentChordJoinGapM:worstJoin,maxSampleSignedScalarAtNewChords:maxZeroError,
 samplePlaneIsUnchanged:OCEAN_Y,illustratedRenderScopeOnly:true};
console.log(JSON.stringify(result,null,2));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
