import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file=new URL('../docs/qa/cape-tryon-vertical-seat-strip.json',import.meta.url);
const packet=JSON.parse(readFileSync(file,'utf8')) as {anchor:[number,number,number];position:number[]};
const oldTop=4.71999979019165,oldEnd=5.71999979019165;
const dx=-6093/128,dz=17885/1024;
const ts=[82/512,450/512,511/512] as const;
const [minX,minZ,maxX,maxZ]=[-23491.4899711068,-3906.1677886751277,-23443.888167720565,-3858.760855897735];
type Knot=readonly [number,number];
const interpolate=(knots:readonly Knot[],t:number)=>{
 for(let i=1;i<knots.length;i++){
  const [a,y]=knots[i-1],[b,z]=knots[i];
  if(t>=a&&t<=b)return y+(z-y)*(t-a)/(b-a);
 }
 throw Error('Station outside the registered envelope');
};

test('detached Tryon study is exactly three non-degenerate triangles on its native straight chord',()=>{
 assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),
  '16e8ee3d741fc636a14ed4a530fa014d5c3d1910abad5b65de0e7bdaad59e683');
 assert.deepEqual(packet.anchor,[-23443.888671875,0,-3876.2265625]);
 assert.equal(packet.position.length,27);
 const xyz=Buffer.alloc(108);
 packet.position.forEach((v,i)=>{
  assert.equal(Math.fround(v),v);xyz.writeFloatLE(v,4*i);
 });
 assert.equal(createHash('sha256').update(xyz).digest('hex'),
  'b9133ef0eab928fac3f7c2c12cc6d8935e9cd3e64bf46bdeaea68054c72cb855');
 const visited=new Set<number>();
 const [x0,,z0]=packet.anchor;
 for(let i=0;i<27;i+=3){
  const [x,y,z]=packet.position.slice(i,i+3),t=x/dx;
  assert(ts.some(k=>k===t));assert.equal(z,dz*t);visited.add(t);
  assert(x+x0>minX&&x+x0<maxX&&z+z0>minZ&&z+z0<maxZ);
  assert(y>=oldTop+(oldEnd-oldTop)*t+0.000243);
 }
 assert.deepEqual([...visited],Array.from(ts));
 for(let i=0;i<27;i+=9){
  const [x0,y0,,x1,y1,,x2,y2]=packet.position.slice(i,i+9);
  assert.notEqual((x1-x0)*(y2-y0)-(x2-x0)*(y1-y0),0);
 }
 // Signed NW, NE, SE, SW corners in the checked decoded cell.
 // A zero bilinear cross term permits a straight contour, unlike its
 // neighbour with curvature. The packed native line is the position owner.
 const [nw,ne,se,sw]=[-19,-12,7,0];assert.equal(nw-ne-sw+se,0);
});

test('detached cap remains below both captured piecewise-affine N112 envelopes',()=>{
 const tops=ts.map(t=>[t,Math.max(...packet.position.flatMap((x,i)=>
  i%3===0&&x/dx===t?[packet.position[i+1]]:[]))] as const);
 // Independently clipped actual facets 17954,17953,17952 at the stock
 // chord, not interpolated terrain or the authored strip itself.
 const receivers:readonly (readonly Knot[])[]=[
  [[.07141919091393403,4.6186447888772335],[.8790893882838882,7.031360608635704],[.9999934895568664,7.254279288519369]],
  [[.07139340226489414,4.618636744682921],[.8790554129266565,7.031319077932871],[.9999934895568664,7.254300250326234]],
 ];
 let least=Infinity;
 for(const g of receivers){
  const events=[...ts,...g.flatMap(([t])=>t>ts[0]&&t<ts[2]?[t]:[])];
  for(const t of events)least=Math.min(least,interpolate(g,t)-interpolate(tops,t));
 }
 // Linear between union knots, so there is no unsampled interior maximum.
 assert(least>=0.000976&&least<0.001);
});
