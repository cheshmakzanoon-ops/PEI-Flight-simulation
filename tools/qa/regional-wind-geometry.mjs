/** Inspect actual production BufferGeometries and LOD batches, without a renderer.
 * Usage: node --experimental-strip-types tools/qa/regional-wind-geometry.mjs /tmp/wind.json
 * No frame-rate benchmark or independent as-built metrology is implied. */
import * as T from 'three';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {project} from '../../src/sim/geo.ts';
import {turbineGeometry,WIND_PROFILE} from '../../src/render/regional-wind-geometry.ts';
import {createRegionalWind,regionalRotorAngle} from '../../src/render/regional-wind.ts';
import {WIND_RANGES} from '../../src/render/regional-wind-stream.ts';
const [, ,out]=process.argv;if(!out)throw Error('Output filename required');
const digest=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const trace=g=>{const pos=g.getAttribute('position'),nor=g.getAttribute('normal'),ind=g.index;assert(pos&&nor&&ind);return {vertices:pos.count,faces:ind.count/3,position:digest(pos.array),normal:digest(nor.array),index:digest(ind.array)};};
const store=JSON.parse(readFileSync(new URL('../../data/regional-wind/locations.json',import.meta.url)));
const farms={};const ground={visualGroundEpoch:0,cover:{distance:()=>254},terrain:{isLand:()=>true},surface:()=>({land:true}),visualGroundHeight:()=>16};
for(const [id,f] of Object.entries(WIND_PROFILE)){
 const lod=[0,1,2].map(l=>{const {mast,rotor}=turbineGeometry(id,l),p=rotor.getAttribute('position');
  let radius=0;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getY(i),p.getZ(i)));
  assert(Math.abs(radius-f.radius)<1e-5);const r={detail:l,mast:trace(mast),rotor:trace(rotor),actualUnrolledRadius:radius};
  mast.dispose();rotor.dispose();return r;
 });
 const scene=new T.Scene(),a=createRegionalWind(id,scene,ground);assert(a);
 const eye={...project(...store.groups[id].average),y:165};a.update(eye,0);
 const v=a.root.children.map(m=>m.instanceMatrix.version);for(let i=1;i<=120;i++)a.update(eye,i/30);
 assert.deepEqual(v,a.root.children.map(m=>m.instanceMatrix.version));
 assert.equal(a.counts.registered,store.groups[id].count);
 assert(Math.abs(regionalRotorAngle(600,4,f.rpm)-regionalRotorAngle(0,4,f.rpm))<1e-12);
 const submitted=a.root.children.filter(o=>o.visible).reduce((n,m)=>n+m.geometry.index.count/3*m.count,0);
 farms[id]={shape:f.model,lod,registered:a.counts.registered,stationaryCount:{...a.counts},
   nonemptyDrawsAtPlanimetricCentre:a.root.children.filter(m=>m.visible).length,
   facesAtPlanimetricCentre:submitted,instanceBufferVersionsConstantAcross120Ticks:true};
 a.dispose();assert.equal(scene.children.length,0);
}
const px=(height,range,screen)=>height*(screen/2)/Math.tan(53*Math.PI/360)/range;
const result={meaning:'True production geometry on CPU and exact hashes. Count per farm uses registered centroid and a synthetic constant terrain Y=16/eye Y=165; not an actual flight or GPU frame time. Whole-turbine angular heights at 540px use the real 53 degree vertical field of view in free flight, looking horizontally. The blade tip path including tilt has a slightly lower vertical maximum.',
 fade:{shape:'1-smoothstep(distance); opaque screen-space coverage',startM:WIND_RANGES.fadeStart,endM:WIND_RANGES.fadeEnd,retireM:WIND_RANGES.visible,
   examples: Object.fromEntries(Object.entries(WIND_PROFILE).map(([id,f])=>[id,px(f.hub+f.radius,WIND_RANGES.visible,540)]))},farms};
writeFileSync(out,JSON.stringify(result,null,2)+'\n');
