/** Reproduce the factored exact stock 3-7 seat witness; no scene changes.
 * From project root, bundle the actual Vite World class for Node:
 * ./node_modules/.bin/esbuild tools/qa/oleary-exterior/stock-grade-rims.mjs --bundle --platform=node --format=esm --define:import.meta.env.BASE_URL='"/"' --outfile=/tmp/oleary-stock-grade.mjs
 * node /tmp/oleary-stock-grade.mjs src/render/oleary-railway/grade.generated.ts */
import{readFileSync as R,writeFileSync as W}from'node:fs';
import{gunzipSync as Z}from'node:zlib';import{createHash}from'node:crypto';
import assert from'node:assert/strict';
import{Terrain}from'../../../src/sim/terrain.ts';
import{World}from'../../../src/render/world.ts';
import{WORLD_COLS,WORLD_ROWS}from'../../../src/sim/coastal-terrain.ts';
import{OLEARY_STOCK_EDGE_LEVELS as L,partitionOlearyNativeXYZ as split}from'../../../src/render/oleary-railway/grade-shape.ts';
const base='public/world/',a=JSON.parse(R(base+'terrain.json')),raw=Z(R(base+a.file));
const terrain=new Terrain(a,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2));
const n=112,w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS;
const x0=terrain.left+w*3,z0=terrain.top+d*7;
const m=World.prototype.patch.call({terrain},x0,z0,w,d,n),p=m.geometry.getAttribute('position'),o=p.array.slice();
const sha=b=>createHash('sha256').update(Buffer.from(b.buffer,b.byteOffset,b.byteLength)).digest('hex');
const original=sha(o),inner=sha(split(o).inner),index=sha(m.geometry.index.array),rim=Array.from({length:4},()=>({}));
assert.equal(original,'4c2bbb800902bc66f59c67224e54b374f37a7c73c1945c272650ac3742865959');
assert.equal(index,'33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa');
assert.equal(inner,'2bfde315a7b7c3a7a8f88e8be01275c1d803208423169ce696e08a9e9eaf5fac');
const build=levels=>{
 p.array.set(o);
 // Bit-for-bit replay of World.update's existing N/E/S/W transition.
 for(let side=0;side<4;side++){
  const ratio=n/levels[side];let a=0,b=0;
  const height=t=>terrain.atlasElevation(x0+w*(side%2===0?t:side===1?1:0),z0+d*(side%2===1?t:side===2?1:0))+.12;
  for(let k=0;k<=n;k++){
   if(k%ratio===0){a=height(k/n);b=height(Math.min(1,(k+ratio)/n));}
   const j=side===0?k:side===1?k*(n+1)+n:side===2?n*(n+1)+k:k*(n+1);
   p.setY(j,a+(b-a)*(k%ratio)/ratio);
  }
 }
 return split(p.array);
};
let variants=0;
for(const a of L)for(const b of L)for(const c of L)for(const d of L){
 const q=[a,b,c,d],s=build(q);assert.equal(sha(s.inner),inner);
 const actual=s.rim.map(sha);
 for(let side=0;side<4;side++){
  const l=q[side],pin=rim[side][l];
  if(pin)assert.equal(pin,actual[side]);else rim[side][l]=actual[side];
 }
 variants++;
}
build([56,56,56,112]);
assert.equal(sha(p.array),'70848824d096976a0ce3e18f388b8853200eb0142a9c7ceb75de0f4b328b9446');
const stamp={tile:'3-7',side:112,origin:m.position.toArray(),originalPatchXYZ:original,indexSHA256:index,interiorXYZSHA256:inner,
 renderRimXYZSHA256BySideAndLOD:rim,verifiedCartesianVariants:variants};
const out=process.argv[2];
if(out)W(out,'/** Reproduce with tools/qa/oleary-exterior/stock-grade-rims.mjs. Only the original N112 ground and existing World edge stitching. */\nexport const OLEARY_NATIVE_GRADE='+JSON.stringify(stamp,null,2)+' as const;\n');
console.log(JSON.stringify(stamp,null,2));
m.geometry.dispose();
