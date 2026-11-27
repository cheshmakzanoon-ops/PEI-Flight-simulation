import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const data=JSON.parse(readFileSync(new URL('data/holman-ground/reserved-controls.json',import.meta.url),'utf8'));
const published=JSON.parse(readFileSync(new URL('../../docs/art/holman-centre-ground-bound.json',import.meta.url),'utf8'));
assert.equal(data.rows.length,66);
assert.equal(data.sourceHeaderSHA256,published.sourceHeaderSHA256);
assert.equal(data.withheldSourceSHA256,published.independentPointsSHA256);
assert(new Set(data.rows.map(r=>r.slice(1,3).join(','))).size===66);
const p=(v,q)=>{
 const w=[...v].sort((a,b)=>a-b),i=q*(w.length-1),k=Math.floor(i);
 return w[k]+(i-k)*(w[Math.min(k+1,w.length-1)]-w[k]);
};
const close=(a,b)=>assert(Math.abs(a-b)<1e-12,JSON.stringify([a,b]));
for(const side of ['west','south','north','east','pooled']){
 const chosen=data.rows.filter(r=>side==='pooled'||r[0]===side),reported=published.sides[side];
 const errors=chosen.map(r=>r[3]-data.legacyVisualLiftM-r[4]);
 assert.equal(chosen.length,reported.count);
 close(p(errors.map(Math.abs),.9),reported.stockAbsP90M);
 close(p(errors,.5),reported.stockSignedMedianM);
 for(const [label,surface] of [['protected-centers',5],['protected-cells',6]]){
  const selected=chosen.map(r=>r[surface].length>0),mask=published.sides[side].oracle[label];
  const fixed=selected.filter(Boolean).length;
  assert.equal(fixed,mask.immutable);assert.equal(chosen.length-fixed,mask.freelyCorrectable);
  const low=p(errors.map((e,i)=>selected[i]?e:-1e9),.5),high=p(errors.map((e,i)=>selected[i]?e:1e9),.5);
  const bestMedian=(low>0?low:high<0?-high:0),bestP90=p(errors.map((e,i)=>selected[i]?Math.abs(e):0),.9);
  close(bestP90,mask.lowestPossibleAbsP90M);close(bestMedian,mask.lowestPossibleAbsMedianM);
  assert.equal(bestP90<=.45&&bestMedian<=.22,mask.passesNecessaryCondition);
 }
}
assert(!published.sides.west.oracle['protected-centers'].passesNecessaryCondition);
assert(!published.sides.south.oracle['protected-centers'].passesNecessaryCondition);
console.log('Holman ground-only placement remains unqualified without re-seating protected surroundings.');
