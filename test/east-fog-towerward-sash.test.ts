import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {eastFogAuthoredSashes} from '../tools/art/east-fog-study/east-fog-authored-sashes.ts';
import {eastFogTowerwardSash,EAST_TOWERWARD_REFERENCE as A} from '../tools/art/east-fog-study/east-fog-towerward-sash.ts';
const plan=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url))).closedBodyPlan;
const hash=(v:ArrayBufferView)=>createHash('sha256').update(Buffer.from(v.buffer,v.byteOffset,v.byteLength)).digest('hex');
test('authored towerward sash occupies its documented first interval, seated in the same high wall',()=>{
 const a=eastFogTowerwardSash(plan);
 assert(a.location.along01>=A.referenceCentre2023&&a.location.along01<=A.referenceCentre2009);
 assert(a.clearGap>.80&&a.wall.u===-4.3);
 const g=a.geometry.getAttribute('position'),{wall:w}=a,c=Math.cos(w.yaw),s=Math.sin(w.yaw);
 const points=Array.from({length:g.count},(_,i)=>{
  const x=g.getX(i)-w.anchor[0],z=g.getZ(i)-w.anchor[1];
  return [c*x-s*z,g.getY(i),s*x+c*z];
 });
 assert(g.count===792&&points.every(([u,y,v])=>u>=w.u-.094&&u<=w.u+.034&&
  y>0&&y<w.highEave-.32&&v>w.v0+.6&&v<w.v1-.6));
 assert(points.some(([u])=>u<w.u-.03)&&points.some(([u])=>u>w.u+.009));
 a.geometry.dispose();
 assert.throws(()=>eastFogTowerwardSash({...plan,yaw:0}),/unsupported East Point rear wall/);
});
test('older two documented sash streams keep every exact word when sharing wall qualification',()=>{
 const g=eastFogAuthoredSashes(plan).geometry;
 const keys=['position','normal','color','clad'];
 assert.deepEqual(keys.map(k=>hash(g.getAttribute(k).array)),[
 '2c3de9131974cc4d7071c8c3ed4fcc72cf9322ec46b86c6e0ef1134533504977',
 '917d94de6e22fda2769d6e1dd03c3c1b6b563ef8cbd6a1e2a72e2168efc0d482',
 'ccbb3804cadcf4d2dc27fefc834ae88b946af2f9e180fb31a89d6715b88ab3d7',
 '822c2cdfbc7a6e5f4dd355251f4dfc9af1b1a64152464b9b83c5007eeed0f346']);
 g.dispose();
});
test('every shaded ray through the added sash also intersects the opaque high shell within .25 m',()=>{
 const a=eastFogTowerwardSash(plan),p=a.geometry.getAttribute('position');
 const {wall:w}=a,h=plan.body[1],c=Math.cos(w.yaw),s=Math.sin(w.yaw);
 const [u0,u1,v0,v1]=h.box,sun=[-.5988930707832083,.7386347872992903,-.3094280865713243];
 for(let i=0;i<p.count;i++)for(const shift of [0,.14]){
  const x=p.getX(i)-w.anchor[0]+sun[0]*.25,z=p.getZ(i)-w.anchor[1]+sun[2]*.25;
  const u=c*x-s*z+shift,v=s*x+c*z,y=p.getY(i)+sun[1]*.25;
  const cap=h.ridgeY-h.pitch*Math.abs(u-h.ridgeU);
  assert(Math.min(u-u0,u1-u,v-v0,v1-v,y-plan.planeBottom,cap-y)>.027);
 }
 a.geometry.dispose();
});
