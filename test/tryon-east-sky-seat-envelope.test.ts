import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EAST_SKY_SEAT_POSITIONS as pos} from '../src/render/cape-tryon-east-sky-seat-data.ts';
type Piece={lo:number;hi:number;yLo:number;yHi:number;facet:number};
const q=JSON.parse(readFileSync(new URL('../docs/qa/cape-tryon-east-seat-geometry.json',import.meta.url),'utf8')) as {
 origin:[number,number,number]; atlasBounds:[number,number,number,number];decodedGrid:[number,number];
 curved:{sections:Piece[][][]};straight:{profiles:Piece[][];endpoints:[number[],number[]]};
};
const [west,north,east,south]=q.atlasBounds;
const dx=(east-west)/q.decodedGrid[0],dz=(south-north)/q.decodedGrid[1];
const x0=west+(1554+.5)*dx,z0=north+(1327+.5)*dz;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const top=(k:number)=>[pos[k+6]+q.origin[0],pos[k+7],pos[k+8]+q.origin[2]];
const topEnd=(k:number)=>[pos[k+15]+q.origin[0],pos[k+16],pos[k+17]+q.origin[2]];
test('the bowed East strip follows the signed contour, inside its cell and below both native envelopes',()=>{
 const xmax=x0+dx,zmax=z0+dz;assert.equal(q.curved.sections.length,24);
 let xyErr=0;
 for(let j=0;j<24;j++){
  const a=top(j*18),b=topEnd(j*18);
  if(j)assert.deepEqual(a,topEnd((j-1)*18));
  for(const [X,,Z] of [a,b])assert(X>x0&&X<xmax&&Z-z0>.0079&&zmax-Z>.0079);
  const va=(a[2]-z0)/dz,vb=(b[2]-z0)/dz,slope=(b[0]-a[0])/(vb-va);
  assert(va<vb&&slope<0);
  const turn=(Math.sqrt(-120*dx/slope)-18)/6;
  // The horizontal secant minus signed rational contour has no other
  // interior extremum; checking endpoints and this root is continuous.
  for(const v of [va,vb, ...(turn>va&&turn<vb?[turn]:[])]){
   const raw=lerp(a[0],b[0],(v-va)/(vb-va)),exact=x0+dx*(14-2*v)/(18+6*v);
   xyErr=Math.max(xyErr,Math.abs(raw-exact));
  }
  for(const view of q.curved.sections[j]){
   assert(view.length);
   for(const {lo,hi,yLo,yHi,facet} of view){
    assert([18401,18624,18625].includes(facet));
    assert(lo>=0&&hi<=1&&hi>lo);
    // The seat and indexed surface each vary affinely across this piece.
    assert(yLo-lerp(a[1],b[1],lo)>.00194&&yHi-lerp(a[1],b[1],hi)>.00194);
   }
  }
 }
 assert(xyErr<.002558);
});
test('the straight East strip stays on its exact stock axis and inside the two native caps',()=>{
 const [a,b]=q.straight.endpoints,range=b[2]-a[2];
 for(let k=24*18;k<pos.length;k+=18){
  const s=top(k),t=topEnd(k);
  assert.equal(s[0],a[0]);assert.equal(t[0],b[0]);
  const l=(s[2]-a[2])/range,r=(t[2]-a[2])/range;
  assert(0<l&&l<r&&r<1);
  for(const p of q.straight.profiles){
   for(const piece of p){
    const l0=Math.max(l,piece.lo),r0=Math.min(r,piece.hi);
    if(l0>r0)continue;
    for(const u of [l0,r0]){
     const y=lerp(piece.yLo,piece.yHi,(u-piece.lo)/(piece.hi-piece.lo));
     assert(y-lerp(s[1],t[1],(u-l)/(r-l))>.0019);
    }
   }
  }
 }
});
