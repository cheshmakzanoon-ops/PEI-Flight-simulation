import assert from 'node:assert/strict';
import {test} from 'node:test';
import {project} from '../src/sim/geo.ts';
import {PRINCE_SURVEY_ROOF as r} from '../src/render/prince-survey-roof.generated.ts';
import {princeRoofOwner,matchesPrinceSurveyRoof,princeFoot,emitPrinceSurveyRoof} from '../src/render/prince-survey-roof.ts';
import {standardPrinceSurveyRoof,standardInlandOrtho,standardCountyOrtho,standardTracadieOrtho,coastalMarshRequested,forestFloorProfile} from '../src/app/scenery-profile.ts';
const q=(a:string)=>new URLSearchParams(a);
const row=r.record,ring=row.footprint.map(([lon,lat])=>project(lon,lat));
test('one Prince roof verifies its packed range and the complete ordered 14-point record, including local terrain seat',()=>{
 const tile={id:'q0322',offset:1073076,bytes:15510,count:315};
 assert(princeRoofOwner(r.atlas,tile));
 for(const t of [{...tile,id:'q0323'},{...tile,bytes:tile.bytes+1},{...tile,offset:tile.offset+1},{...tile,count:314}])assert(!princeRoofOwner(r.atlas,t));
 assert(!princeRoofOwner('stale',tile));
 const make=(a:string|undefined=r.atlas,c:string|undefined=r.chunk,t:string=r.tile,i:number=r.ordinal,fp:readonly(readonly[number,number])[]=row.footprint,h:number=row.height,
  low:number|undefined=row.minHeight,holes?:readonly(readonly(readonly[number,number])[])[],ground:number=r.base)=>matchesPrinceSurveyRoof(a,c,t,i,fp,h,low,holes,ground);
 assert(make());assert(!make('stale'));assert(!make(r.atlas,'stale'));assert(!make(r.atlas,r.chunk,'q0323'));assert(!make(r.atlas,r.chunk,r.tile,48));
 assert(!make(r.atlas,r.chunk,r.tile,47,row.footprint.slice(1)));
 assert(!make(r.atlas,r.chunk,r.tile,47,[...row.footprint].reverse()));
 assert(!make(r.atlas,r.chunk,r.tile,47,row.footprint,row.height+.01));
 assert(!make(r.atlas,r.chunk,r.tile,47,row.footprint,row.height,3.12));
 assert(!make(r.atlas,r.chunk,r.tile,47,row.footprint,row.height,row.minHeight,[row.footprint]));
 for(const y of [r.base+.04,NaN,Infinity])assert(!make(r.atlas,r.chunk,r.tile,47,row.footprint,row.height,row.minHeight,[],y));
});
test('measured cross-ridges cover original concave plan once; independent elevations produce a real step and no apartment façade',()=>{
 const anchor=ring[0];const area=Math.abs(ring.reduce((n,a,i)=>{let b=ring[(i+1)%ring.length];return n+(a.x-anchor.x)*(b.z-anchor.z)-(b.x-anchor.x)*(a.z-anchor.z);},0))*.5;
 let sum=0,roofs=0,walls=0,highest=0,lowest=Infinity,maxStep=0,sloped=0;
 emitPrinceSurveyRoof(ring,{
  roof(a,b,c,y){const ar=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;assert(ar>0&&y.every(Number.isFinite));sum+=ar;roofs++;
   highest=Math.max(highest,...y);lowest=Math.min(lowest,...y);if(Math.max(...y)-Math.min(...y)>.08)sloped++;},
  wall(a,b,low,high){assert(Math.hypot(a.x-b.x,a.z-b.z)>.00001&&high.every(Number.isFinite));walls++;
   if(low){assert(low.every((v,i)=>v<=high[i]+.00001));maxStep=Math.max(maxStep,high[0]-low[0],high[1]-low[1]);}},
 });
 assert.equal(roofs,30);assert.equal(walls,34);assert.equal(roofs+2*walls,98);
 assert(Math.abs(sum-area)<.001);assert(area>2392&&area<2393);assert(sloped>20);
 assert(lowest<12.7&&highest>20.65&&highest<21&&maxStep>4.9);
});
test('new wall cuts retain the original line between terrain feet even on a nonlinear terrain sample',()=>{
 const r=[{x:0,z:0},{x:9,z:0},{x:9,z:12},{x:0,z:12}],G=(x:number,z:number)=>x*x*.01+z*z*.07;
 for(let i=0;i<r.length;i++){
  const a=r[i],b=r[(i+1)%r.length];
  for(const k of [0,.24,.71,1]){
   const p={x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k},wanted=G(a.x,a.z)+(G(b.x,b.z)-G(a.x,a.z))*k-.6;
   assert(Math.abs(princeFoot(r,p,G)-wanted)<1e-8);
  }
 }
});
test('the Prince survey changes only normal Standard and its own stock switch, not other imagery, marsh or forest controls',()=>{
 for(const on of ['','scenery=standard','departure=summerside&diagnostics','stockInlandOrtho','stockCountyOrtho','stockCoastalMarsh','stockForestFloor'])assert(standardPrinceSurveyRoof(q(on)),on);
 for(const off of ['stockPrinceSurveyRoof','scenery=detail','scenery=expanded','sourceFields','orthophotoSeamStudy','northRusticoLighthouseStudy','unknown'])assert(!standardPrinceSurveyRoof(q(off)),off);
 for(const peer of [standardInlandOrtho,standardCountyOrtho,standardTracadieOrtho,coastalMarshRequested,forestFloorProfile])assert.equal(peer(q('stockPrinceSurveyRoof')),peer(q('')));
});
