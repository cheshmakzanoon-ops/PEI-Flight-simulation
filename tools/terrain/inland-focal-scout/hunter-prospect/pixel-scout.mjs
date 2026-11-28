/** Neutral-input camera forecast, not an observation of the browser. */
import {Vector3,PerspectiveCamera} from 'three';
import {readFileSync,writeFileSync} from 'node:fs';
import {plane,t,tx,tz} from './pick.mjs';
const u=f=>new URL('../../../../src/sim/'+f+'.ts',import.meta.url);
const [{SITES,runwayAt},{spawn,step,neutral,FIXED_STEP}]=await Promise.all([import(u('places')),import(u('flight'))]);
const make=path=>JSON.parse(readFileSync(path));
const q=make(process.argv[3]);
const f32=x=>{const b=Buffer.from(x,'base64');return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const pts0=f32(q.wire.neutralSuffix),pts1=f32(q.wire.measuredSuffix);
const sun=({x,z})=>t.isLand(x,z);
const surf=(x,z)=>{const land=sun({x,z});return {land,height:t.contactHeight(x,z,land),runway:!!runwayAt(x,z)};};
const site=SITES.find(s=>s.id==='hunter-river-trail'),a=spawn(site,surf);
const dimensions=[1200,760],kept=[];
const start=new Vector3(a.x,a.y,a.z),camera=new PerspectiveCamera(53,dimensions[0]/dimensions[1],.1,260000);
let eye=new Vector3(),aim=new Vector3();
for(let k=0;k<=18*90&&a.status==='flying';k++){
 const p=new Vector3(a.x,a.y,a.z),d=new Vector3(Math.sin(a.heading),0,-Math.cos(a.heading));
 const e=p.clone().addScaledVector(d,-16.8),g=p.clone().addScaledVector(d,7.8);
 e.y+=4.2;g.y+=1.18+Math.sin(a.pitch)*4.5;
 if(k===0){eye=e;aim=g;}else{eye.lerp(e,1-Math.exp(-FIXED_STEP*7));aim.lerp(g,1-Math.exp(-FIXED_STEP*10));}
 camera.position.copy(eye);camera.lookAt(aim);camera.updateMatrixWorld();
 if(k%90===0){
  const b=[],shift=[];for(let i=0;i<pts0.length;i+=3){
   const p=v=>new Vector3(v[i]+tx,v[i+1],v[i+2]+tz).project(camera);
   const stock=p(pts0),raised=p(pts1); if(Math.max(stock.z,raised.z)>=1||Math.min(stock.z,raised.z)<-1)continue;
   if(Math.max(Math.abs(stock.x),Math.abs(stock.y),Math.abs(raised.x),Math.abs(raised.y))>=1)continue;
   b.push([(stock.x*.5+.5)*dimensions[0],(.5-stock.y*.5)*dimensions[1]]);
   if(pts0[i+1]!==pts1[i+1])shift.push(Math.abs(raised.y-stock.y)*dimensions[1]*.5);
  }
  shift.sort((a,b)=>a-b);
  const box=b.length?[Math.min(...b.map(z=>z[0])),Math.min(...b.map(z=>z[1])),
   Math.max(...b.map(z=>z[0])),Math.max(...b.map(z=>z[1]))]:null;
  kept.push({seconds:k/90,travelM:Math.hypot(a.x-start.x,a.z-start.z),centresInsideLens:b.length,movedInsideLens:shift.length,
   projectedVerticalP90px:shift.length?shift[Math.floor((shift.length-1)*.9)]:null,box});
 }
 step(a,neutral,surf,FIXED_STEP);
}
writeFileSync(process.argv[4],JSON.stringify({scope:'stabilized stock-cover camera lens forecast, not browser visibility or optical output',size:dimensions,kept},null,2)+'\n',{flag:'wx'});
plane.dispose();
