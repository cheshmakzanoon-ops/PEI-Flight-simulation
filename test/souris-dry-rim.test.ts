import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {SOURIS_DRY_RIM_PACKET as p} from '../tools/art/souris-dry-rim-study/souris-dry-rim.generated.ts';
import {createDetachedDryRimGeometry} from '../tools/art/souris-dry-rim-study/souris-dry-rim-study.ts';

const art=new URL('../tools/art/souris-dry-rim-study/',import.meta.url);
const read=(rel:string)=>readFileSync(new URL(rel,art),'utf8');
const sha=(a:Float32Array)=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const yAt=(x:number,a:number,b:number,ya:number,yb:number)=>ya+(yb-ya)*(x-a)/(b-a);

test('Souris study has only the inherited dry chord and exact geometry words',()=>{
 const g=createDetachedDryRimGeometry();
 try{
  const pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  assert.equal(g.index,null);
  assert.equal(g.groups.length,0);
  assert.equal(pos.count,30); assert.equal(uv.count,30);
  assert.equal(sha(pos.array as Float32Array),p.positionSHA);
  assert.equal(sha(uv.array as Float32Array),p.uvSHA);
  assert(uv.array.every(x=>x===0));
  const xs=new Set<number>(), near=p.knots[0][0], far=p.knots.at(-1)![0];
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i); xs.add(x);
   assert(x>=near&&x<=far);
   assert.equal(pos.getZ(i),p.z);
   assert(pos.getY(i)>=p.lowerY);
  }
  assert.deepEqual([...xs],p.knots.map(k=>k[0]));
  assert.equal(near,72664.15625);assert.equal(far,72711.7578125);
  assert.deepEqual(p.shoreSpan,[1812,1818]);
  assert(p.nearestSignedSolidSourceM>1.7);
 }finally{g.dispose();}
});

test('Souris cap stays below both fixed continuous native terrain envelopes',()=>{
 const gaps:number[]=[];
 for(let j=1;j<p.knots.length;j++){
  const [a,ya]=p.knots[j-1], [b,yb]=p.knots[j];
  assert(b>a&&yb>p.lowerY);
  for(const envelope of p.clampCaps){
   let length=0;
   for(const f of envelope){
    const lo=Math.max(a,f.x[0]),hi=Math.min(b,f.x[1]);
    if(hi<lo)continue;
    length+=hi-lo;
    for(const x of [lo,hi])gaps.push(yAt(x,...f.x,...f.y)-yAt(x,a,b,ya,yb));
   }
   assert(Math.abs(length-(b-a))<1e-8);
  }
 }
 assert(Math.min(...gaps)>=.00097&&Math.max(...gaps)<=.00115);
 assert.deepEqual([Math.min(...gaps),Math.max(...gaps)],p.actualDownwardReserveRangeM);
});

test('Souris experimental draw is never imported by the playable application',()=>{
 const main=read('../../../src/main.ts');
 const world=read('../../../src/render/world.ts');
 const src=read('souris-dry-rim-study.ts');
 assert(!main.includes('souris-dry-rim')&&!world.includes('souris-dry-rim'));
 assert.match(src,/DEPTH_CLEAR_VALUE\)!==1/);
 assert.match(src,/m\.depthFunc=T\.EqualDepth;m\.depthWrite=false/);
 assert(!/scene\.add\(/.test(src));
});
