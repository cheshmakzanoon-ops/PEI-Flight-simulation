import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detachedWindowPrimitive} from '../tools/art/east-fog-study/sash-study.ts';
import {eastFogAuthoredSashes} from '../tools/art/east-fog-study/east-fog-authored-sashes.ts';
const plan=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url))).closedBodyPlan;
test('two documented rear-wall intervals, no host floor or opening is cut',()=>{
 const f=eastFogAuthoredSashes(plan),w=f.wall;
 assert.equal(f.apertures,2);assert.equal(w.u,-4.3);
 const [left,right]=f.locations;
 assert(left.along01>=.25&&left.along01<=.34&&right.along01>=.67&&right.along01<=.77);
 for(const a of f.locations){
  assert(a.width>=1.0&&a.width<=1.39);
  assert(a.bottom/w.highEave>=.20&&a.bottom/w.highEave<=.24);
  assert((a.bottom+a.height)/w.highEave>=.62&&(a.bottom+a.height)/w.highEave<=.67);
  assert(a.bottom>0&&a.bottom+a.height<w.highEave-.32);
 }
 const a=f.geometry.getAttribute('position'),{anchor}=w,c=Math.cos(w.yaw),s=Math.sin(w.yaw);
 for(let i=0;i<a.count;i++){
  const x=a.getX(i)-anchor[0],z=a.getZ(i)-anchor[1],u=c*x-s*z,v=s*x+c*z;
  assert(u>=w.u-.094&&u<=w.u+.034&&v>=w.v0+.6&&v<=w.v1-.6&&a.getY(i)>0);
 }
});
test('different shape, unsafe or mirrored reference orientation fail closed',()=>{
 for(const f of [x=>x.body[1].box[0]+=.001,x=>x.yaw=-x.yaw,x=>x.originXZ[1]+=1,x=>x.body.reverse()]){
  const q=structuredClone(plan);f(q);assert.throws(()=>eastFogAuthoredSashes(q),/unsupported East Point rear wall/);
 }
});

const p=plan;
const h=p.body[1],[u,,v0,v1]=h.box;
const wall={u,v0,v1,yaw:p.yaw,anchor:p.originXZ,highEave:h.ridgeY-h.pitch*Math.abs(h.ridgeU-u)};
// Synthetic equipment check, not an observed East Point aperture.
const toy={along01:.5,bottom:1.0,width:.88,height:1.43,panes:[2,3]};
test('closed opaque windows have exact backed front frame, recessed panes and leaf specs',()=>{
 const m=detachedWindowPrimitive(wall,toy),parts=m.spans;assert.equal(parts.filter(x=>x.kind==='pane').length,6);
 assert(parts.every(x=>x.uMin<u&&x.uMax>u&&x.end-x.first===36));
 const frame=parts.find(x=>x.kind==='frame'),pane=parts.find(x=>x.kind==='pane');
 assert(pane.uMin-frame.uMin>.04);
 const a=m.geometry.getAttribute('position'),s=Math.sin(p.yaw),c=Math.cos(p.yaw);
 for(let i=0;i<a.count;i++){
  const dx=a.getX(i)-p.originXZ[0],dz=a.getZ(i)-p.originXZ[1],u0=c*dx-s*dz,v=s*dx+c*dz;
  assert(u0>=u-.094&&u0<=u+.034&&v>v0+.6&&v<v1-.6&&a.getY(i)<wall.highEave-.32);
 }
 assert.equal(m.geometry.getAttribute('clad').array.find(x=>x!==0),undefined);
});
test('wrong wall, hand placements at the corner or roof, and nonfinite source refuse',()=>{
 for(const cut of [{along01:0},{along01:.985},{bottom:5},{width:10},{height:0},{width:NaN}])
  assert.throws(()=>detachedWindowPrimitive(wall,{...toy,...cut}));
});
test('an optional pair keeps a real wall interval and fails on a duplicate aperture',async()=>{
 const {detachedLocatedSashes}=await import('../tools/art/east-fog-study/sash-study.ts');
 const q=detachedLocatedSashes(wall,[{...toy,along01:.35},{...toy,along01:.65}]);
 assert.equal(q.apertures,2);
 assert.equal(q.geometry.getAttribute('position').count,2*detachedWindowPrimitive(wall,toy).geometry.getAttribute('position').count);
 assert.throws(()=>detachedLocatedSashes(wall,[toy,toy]),/clear wall/);
 assert.throws(()=>detachedLocatedSashes(wall,[]));
});
test('dated-style option keeps six subtly pale upper lights and a distinct lower divided sash',()=>{
 const q=detachedWindowPrimitive(wall,{...toy,historicalMeetingRail:true});
 const clear=q.spans.filter(x=>x.kind==='pane');
 assert.equal(clear.length,9);
 assert.equal(clear.filter(x=>x.paint===0x728585).length,6);
 assert.equal(clear.filter(x=>x.paint===0x35484a).length,3);
 assert(q.spans.every(x=>x.uMin<wall.u&&x.uMax>wall.u));
});
