/** Exercise real near-instance membership over fixed flight-like tracks. This is
 * a CPU streaming test with static dry tiles, not a frame-rate benchmark, a new
 * terrain measurement, or a flight. Signed field and real mast buffers are used.
 */
import * as T from 'three';
import {staticWindLight} from '../../../src/render/regional-wind-light.ts';
import {createRegionalWind} from '../../../src/render/regional-wind.ts';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const [repo,out]=process.argv.slice(2);
if(!repo||!out)throw Error('Usage: node caster-transition.mjs REPO OUTPUT.json');
const ground=JSON.parse(readFileSync(resolve(repo,'docs/qa/regional-wind/ground.json'))).units;
const targets={'west-cape':['WCW27','1-7'],'east-point-i':['EKW6','30-12'],hermanville:['HCS3','27-12']};
const sun=new T.Vector3(-.60,.74,-.31).normalize(),axis=new T.Vector2(.60,.31).normalize();
const cases={},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const oldFetch=globalThis.fetch;
let fetches=0;
globalThis.fetch=async url=>{fetches++;return new Response(Uint8Array.from(readFileSync(resolve(repo,'public/world',String(url).slice(1)))));};
try{
for(const [id,[target,tileId]] of Object.entries(targets)){
 const homes=ground.filter(r=>r.farm===id),self=homes.find(r=>r.id===target);
 assert(self&&homes.length>=9);
 const m=new T.ShaderMaterial({fragmentShader:'uniform sampler2D land;void main(){col*=.90+.31*light;}'});
 const world={sun,visualGroundEpoch:1,terrain:{isLand:()=>true},surface:()=>({land:true}),cover:{distance:()=>254},
   // This fixture fixes each base at its signed published coarse Y. Rocking Y
   // or an oscillating terrain LOD is deliberately *not* simulated here.
   visualGroundHeight:(x,z)=>{const r=homes.find(r=>Math.hypot(r.x-x,r.z-z)<=5);assert(r);return r.oldVisual;},
   regionalWindLightReceivers:()=>[{id:tileId,m}]};
 const art=createRegionalWind(id,new T.Scene(),world);
 const light=staticWindLight(id,{world,base:'/',maxTextures:16,maxUniforms:224},art);
 assert(light);
 const eye=(dx,dy,dz)=>({x:self.x+dx,y:self.oldVisual+dy,z:self.z+dz});
 const update=(p,t)=>{art.update(p,t/60);light.update(p);};
 update(eye(0,120,0),0);
 for(let n=0;n<120&&light.state.phase!=='ready';n++)await sleep(5);
 assert.equal(light.state.phase,'ready');
 const tracks={};let frame=0;
 // These perpendicular/parallel/vertical signed sweeps do not use rendered
 // pixels to select aims. A conservative cylinder R=104m, |Y|<=8m bounds
 // every tested actual original-terrain source geometry and receiver.
 for(const [axisName,path] of Object.entries({
  parallel:d=>eye(axis.x*d,50,axis.y*d),transverse:d=>eye(-axis.y*d,70,axis.x*d),
  vertical:d=>eye(0,Math.abs(d),0)
 })){
  let previous=null,crossings=0,mandatory=0,smallestNotPresent=Infinity,seenFar=false;
  const passes=[[1120,-1120],[-1120,1120]];
  for(const [begin,end] of passes)for(let n=0;n<=560;n++){
   // Exact 4m per tick intentionally exercises the 8m movement cache.
   const d=begin+(end-begin)*n/560,p=path(d);update(p,++frame);
   const nNear=Number(m.uniforms.regionalStaticCount?.value??0);
   const exists=(m.uniforms.regionalStaticMasts?.value??[]).slice(0,nNear).some(v=>Math.hypot(v.x-self.x,v.z-self.z)<.01);
   const dx=Math.hypot(p.x-self.x,p.z-self.z),dy=Math.abs(p.y-self.oldVisual);
   const clearance=Math.hypot(Math.max(0,dx-104),Math.max(0,dy-8));
   if(clearance<570){assert(exists,axisName+': omitted a potentially visible cast');mandatory++;}
   if(!exists){seenFar=true;smallestNotPresent=Math.min(smallestNotPresent,clearance);}
   if(previous!==null&&exists!==previous)crossings++;
   previous=exists;
  }
  assert(crossings>=4&&mandatory>0&&seenFar&&smallestNotPresent>=570);
  tracks[axisName]={frames:1122,ownerEnterExitCrossings:crossings,framesWithPossibleVisibleCast:mandatory,minimumCenterCylinderEyeDistanceWhenOwnerAbsentM:smallestNotPresent};
 }
 cases[target]={farm:id,tracks,fieldReachedReady:true};
 light.dispose();art.dispose();assert.equal(m.uniforms.regionalStaticCount,undefined);m.dispose();
}
}finally{globalThis.fetch=oldFetch;}
assert.equal(fetches,3);
const report={method:'Bidirectional 4m-step probes of actual CPU instance/field lease (synthetic dry terrain tile, positions + foundation Y from earlier signed game socket checks). Each target must be bound whenever an eye lies within 570m of any point of its conservative 104m horizontal, ±8m vertical receiver volume. Does not establish GPU performance or visual identity.',data:'docs/qa/regional-wind/ground.json',rawTransferCount:fetches,cases};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(Object.keys(cases).length,'real casters; three paths each; no premature cutoff.');
