import assert from 'node:assert/strict';
import test from 'node:test';
import {sharedSignedEnvelope} from './signed-envelope.ts';
test('both neighboring facets publish a single lower signed pair for their common exact edge',()=>{
 // Two bilinear patches are continuous on the common x=1 edge, but
 // their cross-derivatives differ (such as at an old native lattice break).
 const points=[[0,0],[1,0],[1,1],[0,1],[2,0],[2,1]] as const;
 const tri=[[0,1,2],[0,2,3],[1,4,2],[4,5,2]] as const;
 const Z=([x,z]:readonly [number,number])=>(x<=1?.4+x-.8*z+1.5*x*z:1.4+z*(.7-2.7*(x-1)));
 const Y=([x,z]:readonly [number,number])=>.5-x+2.2*z-.2*x*z;
 const values=points.map(p=>[Z(p),Y(p)] as const);
 const d=[[1.5,-.2],[1.5,-.2],[-2.7,-.2],[-2.7,-.2]] as const;
 const ret=sharedSignedEnvelope(points,tri,values,d,[1e-7,1e-7]);assert.ok(ret);
 assert.equal(ret.lower[1][0],values[1][0]-1e-7-.675);
 for(const k of tri)for(let i=0;i<64;i++)for(let j=0;j+i<64;j++){
  const w=[i/64,j/64,1-(i+j)/64];
  const x=k.reduce((s,v,l)=>s+points[v][0]*w[l],0),z=k.reduce((s,v,l)=>s+points[v][1]*w[l],0);
  const a=k.reduce((s,v,l)=>s+ret.lower[v][0]*w[l],0),b=k.reduce((s,v,l)=>s+ret.lower[v][1]*w[l],0);
  assert.ok(a<Z([x,z])&&b<Y([x,z]));
 }
});
