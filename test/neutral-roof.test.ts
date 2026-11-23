import assert from 'node:assert/strict';
import test from 'node:test';
import {neutralRoofEdge,neutralRoofHeight,neutralRoofTriangles,readNeutralRoof,type RoofPlane} from '../src/render/neutral-roof.ts';
import type {Triangle} from '../src/sim/roof-ridge.ts';
import {NEUTRAL_ATLAS_SHA,NEUTRAL_ROWS} from '../src/render/neutral-roofs.generated.ts';
const a={x:-8,z:-5},b={x:8,z:-5},c={x:8,z:5},d={x:-8,z:5};
const center={x:0,z:0};
const area=([a,b,c]:Triangle)=>Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2;
const samples:RoofPlane[][]=[[[8,0,0]],[[8,0,.34]],[[9,0,.4],[9,0,-.4]],
 [[9,0,.4],[9,0,-.4],[10.2,.4,0],[10.2,-.4,0]],[[9,.1,0],[9,.1,0]]];
for(const [i,p] of samples.entries())test('neutral roof fixture '+i+' partitions the unchanged footprint',()=>{
 const source:Triangle[]=[[a,b,c],[a,c,d]];
 const faces=source.flatMap(t=>neutralRoofTriangles(t,center,p));
 assert.ok(Math.abs(faces.reduce((s,t)=>s+area(t),0)-160)<1e-9);
 for(const q of faces){
  const m={x:q.reduce((h,r)=>h+r.x/3,0),z:q.reduce((h,r)=>h+r.z/3,0)};
  const avg=q.reduce((h,r)=>h+neutralRoofHeight(r,center,p)/3,0);
  assert.ok(Math.abs(neutralRoofHeight(m,center,p)-avg)<1e-9,'each triangle must be flat on its actual plane');
 }
 for(const [x,y] of [[a,b],[b,c],[c,d],[d,a]]){
  const segments=neutralRoofEdge(x,y,center,p);
  for(let j=1;j<segments.length;j++){
   const l=segments[j-1],r=segments[j];
   const middle={x:(l.x+r.x)/2,z:(l.z+r.z)/2};
   assert.ok(Math.abs(neutralRoofHeight(middle,center,p)-(neutralRoofHeight(l,center,p)+neutralRoofHeight(r,center,p))/2)<1e-9);
  }
 }
});


test('surveyed rows require the exact atlas, slot, and every ordered outline coordinate',()=>{
 const entries=Object.entries(NEUTRAL_ROWS);
 assert.ok(entries.length>0);
 for(const [tile,rows]of entries)for(const row of rows){
  const ring: [number,number][]=[];
  for(let j=0;j<row[1].length;j+=2)ring.push([row[1][j]/1e6,row[1][j+1]/1e6]);
  const model=readNeutralRoof(NEUTRAL_ATLAS_SHA,tile,row[0],ring);
  assert.ok(model&&Number.isFinite(model.datum)&&model.planes.length>=1&&model.planes.length<=4);
  assert.ok(model.planes.flat().every(Number.isFinite));
  assert.equal(readNeutralRoof(undefined,tile,row[0],ring),undefined);
  assert.equal(readNeutralRoof(NEUTRAL_ATLAS_SHA+'-stale',tile,row[0],ring),undefined);
  assert.equal(readNeutralRoof(NEUTRAL_ATLAS_SHA,'unregistered',row[0],ring),undefined);
  assert.equal(readNeutralRoof(NEUTRAL_ATLAS_SHA,tile,row[0],ring.slice(1)),undefined);
  assert.equal(readNeutralRoof(NEUTRAL_ATLAS_SHA,tile,row[0],[...ring.slice(1),ring[0]]),undefined);
  const altered:[number,number][]=[[ring[0][0]+5e-9,ring[0][1]],...ring.slice(1)];
  assert.equal(readNeutralRoof(NEUTRAL_ATLAS_SHA,tile,row[0],altered),undefined);
 }
});
