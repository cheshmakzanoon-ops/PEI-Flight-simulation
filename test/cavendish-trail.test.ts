import {test} from 'node:test';
import assert from 'node:assert/strict';
import {project} from '../src/sim/geo.ts';
import {gablesTrailIntersects,trailLateral} from '../src/render/cavendish-trail.ts';
import {GABLES_TRAIL} from '../src/render/cavendish-trail.generated.ts';

test('the terrain-only trail stops inside the qualified mapped chainage',()=>{
 assert.equal(GABLES_TRAIL.id,704985291);
 assert.deepEqual(GABLES_TRAIL.stationLimitsMetres,[10.625,86.65]);
 const pts=GABLES_TRAIL.derivedLineWgs84.map(([lo,la])=>project(lo,la));
 const first=pts[0],last=pts.at(-1)!;
 assert.equal(trailLateral(first.x,first.z).along,0);
 const gameLength=trailLateral(last.x,last.z).along;
 const nativeLength=GABLES_TRAIL.stationLimitsMetres[1]-GABLES_TRAIL.stationLimitsMetres[0];
 assert(Math.abs(gameLength-75.22935066)<.001);
 assert(Math.abs(gameLength/nativeLength-1)<.015);
 const outside=project(...GABLES_TRAIL.sourceStartEnd[0]);
 assert(trailLateral(outside.x,outside.z).nearest>9);
 assert(!gablesTrailIntersects(first.x+300,first.z,first.x+305,first.z+20));
});

test('the center path and lateral edges use the selected gameplay metres',()=>{
 const pts=GABLES_TRAIL.derivedLineWgs84.map(([lo,la])=>project(lo,la));
 for(let j=0;j<pts.length-1;j++){
  const a=pts[j],b=pts[j+1],dx=b.x-a.x,dz=b.z-a.z,s=Math.hypot(dx,dz),x=a.x+dx*.5,z=a.z+dz*.5;
  assert(s>2);
  assert(trailLateral(x,z).nearest<1e-6);
  assert(Math.abs(trailLateral(x-dz*.74/s,z+dx*.74/s).nearest-.74)<.001);
  assert(gablesTrailIntersects(x,z,x,z));
 }
});
