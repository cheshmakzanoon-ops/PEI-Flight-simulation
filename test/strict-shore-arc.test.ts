import {test} from 'node:test';
import assert from 'node:assert/strict';
import {strictArc,type Quad} from '../src/sim/strict-shore-arc.ts';

const pitch=[47.60180338623524,47.40693277739292] as const;
const sites=[
 {corners:[-4,-4,-4,12], coarse:8.3976},
 {corners:[-4,-4,-3,10], coarse:7.5413},
 {corners:[10,10,-10,4], coarse:3.3362},
] satisfies Array<{corners:Quad;coarse:number}>;
test('sampled strict curves follow the exact field and preserve sign-cell endpoints',()=>{
 for(const {corners:q,coarse} of sites){
  const r=strictArc(q,...pitch,.047,96,1.40);
  assert.equal(r.mode,'exact');assert.ok(r.points.length>2&&r.points.length<=97);
  assert.ok(r.boundM<=.047&&Math.abs(r.oldChordErrorM!-coarse)<.001);
  const [a,b,c,d]=q;
  const f=(x:number,y:number)=>a+(b-a)*x+(d-a)*y+(a-b-d+c)*x*y;
  for(const [i,[x,y]] of r.points.entries()){
   assert.ok(x>=0&&x<=1&&y>=0&&y<=1);
   assert.ok(Math.abs(f(x,y))<1e-11);
   if(i===0||i===r.points.length-1)assert.ok(x===0||x===1||y===0||y===1);
  }
  const mirror=strictArc([-a,-b,-c,-d],...pitch,.047,96,1.40);
  assert.deepEqual(mirror.points,r.points);
 }
});
test('ambiguous, zero-tie, small-error and unbounded curves keep the old renderer',()=>{
 for(const q of [[-2,3,-4,5],[0,5,-4,3],[-4,-4,10,10],[-4,-4,-4,12]] as const){
  const r=strictArc(q,...pitch,.047,1,1.40);
  assert.equal(r.mode,'unsupported');
 }
});

test('a pinned single zero can connect the same endpoints as the inherited mask rule without guessing joins',()=>{
 const candidates=[
  [-12,-19,0,10],[-19,-14,4,0],[0,-23,-10,4],[-14,-23,0,4],[0,-12,4,19],
 ] as const;
 for(const q of candidates){
  const result=strictArc(q,...pitch,.047,96,.09,true);
  assert.equal(strictArc(q,...pitch,.047,96,.09).mode,'unsupported');
  assert.equal(result.mode,'exact');assert.ok(result.points.length>2&&result.boundM<=.047);
  const [a,b,c,d]=q;
  const evaluate=(u:number,v:number)=>(a*(1-u)+b*u)*(1-v)+(d*(1-u)+c*u)*v;
  assert.ok(result.points.every(([u,v])=>Math.abs(evaluate(u,v))<1e-10));
  const edges=[[a,b],[b,c],[d,c],[a,d]] as const;
  const edgeHits=edges.flatMap(([v0,v1],i)=>{
   if((v0>=0)===(v1>=0))return [];
   const t=v0/(v0-v1);
   return [[t,0],[1,t],[t,1],[0,t]].slice(i,i+1);
  });
  assert.deepEqual(result.points[0],edgeHits[0]);
  assert.deepEqual(result.points.at(-1),edgeHits[1]);
 }
 for(const q of [[-4,0,0,13],[0,-12,-10,-19],[0,12,10,19],[0,-2,1,-3]] as const)
  assert.equal(strictArc(q,...pitch,.047,96,0,true).mode,'unsupported');
});
