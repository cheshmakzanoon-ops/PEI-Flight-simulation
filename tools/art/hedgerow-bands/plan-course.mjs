import assert from 'node:assert/strict';
import {readFileSync as rd,writeFileSync as wr} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Terrain} from '../../../src/sim/terrain.ts';
import {Cover} from '../../../src/sim/cover.ts';
import {SITES,runwayAt} from '../../../src/sim/places.ts';
import {project,geographic,RAD} from '../../../src/sim/geo.ts';
import {spawn,step,neutral,FIXED_STEP} from '../../../src/sim/flight.ts';
const [root,planFile,out]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
const load=p=>rd(root+'/public/world/'+p);const t=JSON.parse(load('terrain.json')),cmeta=JSON.parse(load('cover.json'));
const D=gunzipSync(load(t.file)),C=gunzipSync(load(cmeta.file));assert.equal(sha(D),'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
assert.equal(sha(C),'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
const terrain=new Terrain(t,new Int16Array(D.buffer,D.byteOffset,D.byteLength/2)),cover=new Cover(cmeta.width,cmeta.height,C);
const sample=(x,z)=>{const land=cover.distance(terrain,x,z)>=0;return {height:terrain.contactHeight(x,z,land),land,runway:!!runwayAt(x,z)};};

import * as T from 'three';
const planRaw=rd(planFile),pre=JSON.parse(planRaw);
assert.equal(sha(planRaw),'cbf4496cab145a4090b1cafdd68b001289cea810ebfcc1eead7ae40339858f76');
const roleRaw=rd(process.argv[5]);
assert.equal(sha(roleRaw),'fa1ece47ae443d81f313faf4ec11a647aa4baf3cb20d4531479e47234ec81cc1');
const role=JSON.parse(roleRaw).rows;assert(role.length===28);
const mean=axis=>role.reduce((a,q)=>a+q.xyz[axis],0)/role.length,cx=mean(0),cz=mean(2);
const c=new T.PerspectiveCamera(53,pre.viewAspect,.08,350000),
 desiredEye=new T.Vector3(),desiredLook=new T.Vector3(),look=new T.Vector3(),
 ray=new T.Vector3(),right=new T.Vector3(),up=new T.Vector3(),base=new T.Vector3(),p=new T.Vector4();
const vp=new T.Matrix4(),neutralEye=[];
const ease=x=>x*x*(3-2*x),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const targets=pre.checkForwardDistances;
function score(){
 vp.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse);
 let s=0,hole=0;
 for(const r of role){
  const [x,y,z]=r.xyz,[height,width]=r.shape;
  ray.copy(c.position).sub(base.set(x,y+height*.5,z)).normalize();
  right.set(ray.z+.00001,0,-ray.x).normalize();
  up.crossVectors(ray,right).normalize();
  const tilt=ease(clamp((ray.y-.19)/.61,0,1)),portrait=height*1.04*(1-tilt)+width*tilt;
  const u=y+height*(.47+.18*tilt);
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity, ok=true;
  for(const a of [-.5,.5])for(const b of [-.5,.5]){
   base.set(x,u,z).addScaledVector(right,a*width).addScaledVector(up,b*portrait);
   p.set(base.x,base.y,base.z,1).applyMatrix4(vp);
   if(p.w<=.08){ok=false;break;}
   const X=p.x/p.w,Y=p.y/p.w;
   maxx=Math.max(maxx,X);maxy=Math.max(maxy,Y);minx=Math.min(minx,X);miny=Math.min(miny,Y);
  }
  if(!ok||maxx< -1||maxy< -1||minx>1||miny>1)continue;
  const box=[clamp(minx,-1,1),clamp(miny,-1,1),clamp(maxx,-1,1),clamp(maxy,-1,1)];
  const a=(box[2]-box[0])*600*(box[3]-box[1])*380;
  if(a>=pre.minCandidateAreaPerForehypothesisPx){hole+=a;s++;}
 }
 return [s,hole];
}
function simulate(site){
 const f=spawn(site,sample),start=[f.x,f.z];
 const out=[];
 let safety=Infinity,dry=Infinity, exit;
 for(let j=0;j<=5500;j++){
  const F=sample(f.x,f.z),distance=Math.hypot(f.x-start[0],f.z-start[1]);
  if(f.status!=='flying'||!F.land)return;
  safety=Math.min(safety,f.y-F.height);dry=Math.min(dry,cover.distance(terrain,f.x,f.z));
  if(safety<pre.minAglEntireRoute||dry<pre.minOldSignedDryContact)return;
  const X=Math.sin(f.heading),Z=-Math.cos(f.heading);
  desiredEye.set(f.x-16.8*X,f.y+4.2,f.z-16.8*Z);
  desiredEye.y=Math.max(desiredEye.y,sample(desiredEye.x,desiredEye.z).height+.58);
  desiredLook.set(f.x+7.8*X,f.y+1.18+Math.sin(f.pitch)*4.5,f.z+7.8*Z);
  c.position.lerp(desiredEye,j?1-Math.exp(-FIXED_STEP*7):1);
  look.lerp(desiredLook,j?1-Math.exp(-FIXED_STEP*10):1);
  c.lookAt(look);c.updateMatrixWorld(true);
  for(const [k,m] of targets.entries())if(distance>=m&&distance<=m+32){
   const considered=out[k]??=[];out[k]=considered;
   const [n,area]=score();
   considered.push({distance,projectedConservativeRoots:n,summedQuadBoxesNotUniquePx:area});
  }
  if(distance>=pre.exitCheckForwardDistance){exit=score();break;}
  step(f,neutral,sample);
 }
 if(!exit||out.length!==2||out.some(a=>a.length<2))return;
 const stats=out.map(q=>({first:q[0],last:q.at(-1),min:Math.min(...q.map(v=>v.projectedConservativeRoots)),length:q.length}));
 if(stats.some(q=>q.min<pre.minForecastProjectedCandidateRootsBothStations))return;
 return {site,minGroundM:safety,minDryM:dry,stats,lateExpectedRoots:exit[0]};
}
const chosen=[];
let tries=0;
for(let heading=0;heading<360;heading+=pre.headingBinDegrees)
 for(const back of pre.startDistances)
  for(const agl of pre.startAGL){
   const angle=heading*RAD,x=cx-Math.sin(angle)*back,z=cz+Math.cos(angle)*back;
   const g=geographic(x,z);
   const site={id:'private-queens-field-edge-reciprocal',name:'New Glasgow · alternate test pass',
    region:'Queens County',lon:g.lon,lat:g.lat,heading,height:agl,note:'Private non-navigational artwork test.'};
   tries++;
   const state=simulate(site);if(state)chosen.push(state);
  }
chosen.sort((a,b)=>Math.min(...b.stats.map(x=>x.min))-Math.min(...a.stats.map(x=>x.min))||
 a.lateExpectedRoots-b.lateExpectedRoots||b.minGroundM-a.minGroundM);
const o={scope:'Stock geometry screen only, not alpha/depth visibility, image match or player-ready art.',tries,
 plans:chosen.length,selected:chosen.slice(0,12),subjectsSHA256:sha(roleRaw),prelockSHA256:sha(planRaw)};
wr(out,JSON.stringify(o,null,2)+'\n',{flag:'wx'});console.log(o.plans,JSON.stringify(o.selected.slice(0,2),null,2));
