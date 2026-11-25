import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PRINCE_SKY_FIELD as F} from '../src/render/prince-roof-sky.generated.ts';
import {princeSkyBlock,princeSkyWords,princeSkyGLSL} from '../src/render/prince-roof-sky.ts';
import {princeSkyBudget,PRINCE_SKY_MIN_FRAGMENT_UNIFORM_VECTORS} from '../src/render/prince-roof-sky-budget.ts';
import {standardPrinceRoofContact,standardPrinceSurveyRoof,standardInlandOrtho,coastalMarshRequested} from '../src/app/scenery-profile.ts';
const uv=(i:number,u:number,v:number,extraY=0,n?:readonly number[])=>{
 const c=F.charts[i],A=F.anchor,B=F.basis,q=n??c.normal;
 return princeSkyBlock(A[0]+B[0][0]*u+B[1][0]*v,c.plane[0]+c.plane[1]*u+c.plane[2]*v+extraY,A[1]+B[0][1]*u+B[1][1]*v,q[0],q[1],q[2]);
};
test('only three frozen roof planes receive physically local diffuse blockage; unrelated directions and elevations are neutral',()=>{
 assert.equal(F.charts.length,3);
 for(const [i,u,v,min] of [[0,9.5,-18,.12],[1,-10,16.6,.16],[2,-15.55,27.,.12]]){
  assert(uv(i,u,v)>min,[i,u,v,uv(i,u,v)].join(','));
  assert.equal(uv(i,u,v,.25),0);assert.equal(uv(i,u,v,0,[0,-1,0]),0);
 }
 assert.equal(uv(0,1,-28),0);assert.equal(uv(1,35,28),0);
});
test('immutable 6-bit field plus hardware headroom: no samplers, geometry change, or per-vertex province allocation',()=>{
 const W=princeSkyWords();assert.equal(W,princeSkyWords());
 assert.equal(F.cells,2198);assert.equal(W.byteLength,1760);assert.equal(Math.ceil(W.length/4),110);
 assert(princeSkyGLSL.includes('uvec4 princeSkyWords[110]'));assert(!/sampler\w*/.test(princeSkyGLSL));
 const bytes=Uint8Array.from({length:F.cells},(_,i)=>(W[Math.floor(i/5)]>>((i%5)*6))&63);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'15d5f3fd0402ce17b786a53a0e0509193f7c15a03da7552e5c4b37f1c0ca4c3e');
 assert.equal(createHash('sha256').update(readFileSync(new URL('../src/render/prince-survey-roof.generated.ts',import.meta.url))).digest('hex'),F.shapeSHA256);
 assert.equal(PRINCE_SKY_MIN_FRAGMENT_UNIFORM_VECTORS,192);
 for(const n of [NaN,Infinity,-1,0,110,191])assert(!princeSkyBudget(n));assert(princeSkyBudget(192));assert(princeSkyBudget(1024));
});
test('contact and measured form have independently reversible settings',()=>{
 const req=(s:string)=>new URLSearchParams(s);
 for(const p of ['', 'scenery=standard','stockInlandOrtho','stockCountyOrtho','stockForestFloor'])assert(standardPrinceRoofContact(req(p)));
 for(const p of ['scenery=detail','stockPrinceRoofContact','stockPrinceSurveyRoof','orthophotoSeamStudy'])assert(!standardPrinceRoofContact(req(p)));
 assert(standardPrinceSurveyRoof(req('stockPrinceRoofContact')));
 for(const f of [coastalMarshRequested,standardInlandOrtho])assert.equal(f(req('stockPrinceRoofContact')),f(req('')));
});
