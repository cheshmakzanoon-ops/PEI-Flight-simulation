import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {gunzipSync} from 'node:zlib';
import {inspectPanmureV5LocalCut} from './pasture-v5-cut.ts';

const read=p=>readFileSync(new URL('./data/'+p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read('manifest.json'));
const repair=JSON.parse(read('repair.json'));
function data(name){
 const m=manifest.payload[name],gz=read(name+'.gz');
 assert.equal(hash(gz),m.gzipSHA256);
 const raw=gunzipSync(gz);
 assert.equal(raw.length,m.bytes);assert.equal(hash(raw),m.sha256);
 return raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
}
function verifyPlanes(rows,idx){
 let greatest=0,smallest=Infinity,area=0;
 for(let i=0;i<idx.length;i+=3){
  const [a,b,c]=[rows[idx[i]],rows[idx[i+1]],rows[idx[i+2]]];
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
  const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const t=ux*vz-uz*vx;
  assert.ok(t<0,'zero or reversed face '+i/3);
  greatest=Math.max(greatest,Math.hypot((uy*vz-uz*vy)/t,(ux*vy-uy*vx)/t));
  smallest=Math.min(smallest,-t/Math.max(Math.hypot(ux,uz),Math.hypot(vx,vz),Math.hypot(vx-ux,vz-uz)));
  area-=t/2;
 }
 return {greatest,smallest,area};
}
test('exact dated surfaces retain their complete open rim and stay under 12% after world packing',async()=>{
 const i=data('indices.u32'),b0=data('neutral.f32'),b1=data('measured.f32');
 const before=await inspectPanmureV5LocalCut('stock',b0,i),after=await inspectPanmureV5LocalCut('dated',b1,i);
 assert.equal(before.parent,null);assert.equal(after.parent,null);assert.equal(after.userData.mayAttach,false);
 const I=after.geometry.getIndex().array,positions=after.geometry.getAttribute('position'),old=before.geometry.getAttribute('position');
 assert.deepEqual(I,before.geometry.getIndex().array);assert.equal(I.length,14754*3);
 const used=new Set(I),edge=new Map(),rim=new Set(new Uint32Array(data('rim.u32')));
 for(let i=0;i<I.length;i+=3)for(let n=0;n<3;n++){
  const i0=I[i+n],i1=I[i+(n+1)%3],k=i0<i1?i0+':'+i1:i1+':'+i0;
  const [count,dir]=edge.get(k)??[0,0];edge.set(k,[count+1,dir+(i0<i1?1:-1)]);
 }
 let capture=0;
 for(const [key,[n,w]] of edge){
  if(n===2){assert.equal(w,0);continue;}
  const [a,b]=key.split(':').map(Number);
  assert.equal(n,1);assert.equal(Math.abs(w),1);assert.ok(rim.has(a)&&rim.has(b));capture++;
 }
 assert.equal(capture,632);assert.equal(rim.size,632);assert.equal(used.size,7694);
 for(const n of new Uint32Array(data('source-core.u32')))assert.ok(used.has(n));
 for(const n of rim)assert.equal(positions.getY(n),old.getY(n));
 const raw=Array.from({length:positions.count},(_,i)=>[positions.getX(i),positions.getY(i),positions.getZ(i)]);
 const placed=raw.map(row=>row.map((v,c)=>Math.fround(Math.fround(manifest.origin[c])+v)));
 const l=verifyPlanes(raw,I),w=verifyPlanes(placed,I);
 assert.ok(Math.abs(l.greatest-repair.maxSlopeLocalPerM)<1e-10);
 assert.ok(Math.abs(w.greatest-repair.maxSlopeWorldPerM)<1e-10);
 assert.ok(Math.abs(w.smallest-repair.minWorldFlatTriangleAltitudeM)<1e-10);
 assert.ok(w.greatest<.12&&l.greatest<.12);
 assert.equal(repair.canMount,false);
});
