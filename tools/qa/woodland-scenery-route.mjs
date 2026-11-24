/** Independently replay exact proposed virtual sites on ordinary physics.
 * This tests finite rendered-volume bounds, not real world collision clearance. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as T from 'three';
import { Terrain } from '../../src/sim/terrain.ts';
import { Cover } from '../../src/sim/cover.ts';
import { SITES,runwayAt } from '../../src/sim/places.ts';
import { observerView } from '../../src/sim/observer-view.ts';
import { spawn,step,neutral,FIXED_STEP,flightConditions,DEFAULT_FLIGHT_CONDITIONS } from '../../src/sim/flight.ts';
import { project,geographic } from '../../src/sim/geo.ts';
import { loadHarbourCover } from '../../src/sim/harbour-cover.ts';
import { loadCoastalSurveys } from '../../src/sim/coastal-terrain.ts';
import { ForestStream } from '../../src/sim/forest-stream.ts';
import { loadForestHeights } from '../../src/sim/forest-heights.ts';
import { HedgeStream } from '../../src/sim/hedge-stream.ts';
import { Vegetation } from '../../src/render/vegetation.ts';
import { regularRoadGround } from '../../src/render/road-contact.ts';
import { branchedCrown } from '../../src/render/woodland-volume-geometry.ts';
import { sceneryOptions,sceneryReviewBlock,applyReviewSceneryURL } from '../../src/app/scenery-profile.ts';

const BASE=fileURLToPath(new URL('../../',import.meta.url)),PUB=BASE+'public/';
const baseline='8612a5a2b5b8a72046db78e58e1f269d12f50de3';
const fromStock=(file)=>execFileSync('git',['show',baseline+':'+file],{cwd:BASE});
const oldSites=34;
const H=(d)=>createHash('sha256').update(d).digest('hex'),ab=a=>a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength);
const src=fs.readFileSync(BASE+'src/main.ts','utf8');
for(const f of ['flight.ts','geo.ts','aerodynamics.ts','terrain.ts','cover.ts','powerplant.ts','windmilling.ts']){
 const now=fs.readFileSync(BASE+'src/sim/'+f),prev=fromStock('src/sim/'+f);assert(now.equals(prev),f);
}
const oldPlaces=fromStock('src/sim/places.ts').toString('utf8'),newPlaces=fs.readFileSync(BASE+'src/sim/places.ts','utf8');
const split=oldPlaces.indexOf('\n];');
assert(split>0 && newPlaces.startsWith(oldPlaces.slice(0,split)+',\n') && newPlaces.endsWith(oldPlaces.slice(split)));
assert.equal(SITES.length,oldSites+3);
const olderOptions=[["",""],["?scenery=detail","scenery=detail&shoreFoamDetail=&legacyShoreArcs=&canopyLight=&forestFloor=&woodland3D=&spinnakersPreview=&northBaywalkPreview=&baywalkConcrete=&basinChannel=&basinWharf=&montagueFoundationPreview=&montagueReachOptics=&northCapeWind=&bowleySurveyPreview="],["?woodlandBark","woodlandBark=&woodland3D="],["?woodland3D&woodlandCrownBase","woodland3D=&woodlandCrownBase="],["?northCapeWind","northCapeWind="],["?cavendishDetail","cavendishDetail=&greenGablesReview=&greenGablesBarnReview=&cavendishWaterReview=&gablesGradeReview=&gablesFairwayReview=&gablesTrailReview="]];
for(const [query,value] of olderOptions)assert.equal(sceneryOptions(query).toString(),value,query);
const locks=['scenery=detail','surveyRelief','inlandRelief','indianRiverReview','buildingShadows','seatedForestShadows','duneReliefStudy','duneGrassSurface','duneSandDetail'];
for(const q of locks)for(const suffix of [`?woodlandView&${q}`,`?${q}&woodlandView`]){
 const oo=sceneryOptions(suffix);
 assert(sceneryReviewBlock('woodlandView',oo));
 assert(!oo.has('sceneryObserver'));
 assert.equal(oo.has('woodland3D'),q==='scenery=detail');
}
const both=sceneryOptions('?woodlandView');
for(const q of ['woodland3D','woodlandCrownBase','woodlandBark','forestFloor','sceneryObserver'])assert(both.has(q));
const link=applyReviewSceneryURL('https://sim.invalid/pei/?departure=cavendish',new Set(['woodlandView']),'queens-woodland-view');
assert.equal(new URL(link).searchParams.get('departure'),'queens-woodland-view');
assert(src.includes("['Chase','Cockpit','Wide chase','Scenery']:['Chase','Cockpit','Wide chase']"));
assert(src.includes("code==='KeyV'&&ui.mode==='flight'"));
assert(src.includes('step(f,u,sceneSurface)'));

const get=async(url,init)=>{
 try{
  const path=new URL(url).pathname.slice(1);
  const x=fs.readFileSync(PUB+path),r=/^bytes=(\d+)-(\d+)$/.exec(new Headers(init?.headers).get('Range')??'');
  return r?new Response(x.subarray(+r[1],+r[2]+1),{status:206,headers:{'Content-Range':`bytes ${r[1]}-${r[2]}/${x.length}`}}):new Response(x);
 }catch{return new Response(null,{status:404});}
};
const tmeta=JSON.parse(fs.readFileSync(PUB+'world/terrain.json','utf8')),cmeta=JSON.parse(fs.readFileSync(PUB+'world/cover.json','utf8'));
const hh=gunzipSync(fs.readFileSync(PUB+'world/height.bin.gz')),cc=fs.readFileSync(PUB+'world/cover.bin.gz'),cr=gunzipSync(cc);
assert.equal(H(hh),tmeta.sha256);assert.equal(H(cc),cmeta.compressedSha256);
const [survey,quarter,pilot]=await Promise.all([loadCoastalSurveys('http://peg.local/world/',get,2500),loadHarbourCover('http://peg.local/world/',get,2000), loadForestHeights('http://peg.local/',get,2500)]);
assert(pilot);assert(survey.length>=2);assert(quarter&&quarter.plan.pinCoverSha256===cmeta.compressedSha256);
const terrain=new Terrain(tmeta,new Int16Array(ab(hh)),survey),cover=new Cover(cmeta.width,cmeta.height,new Uint8Array(ab(cr)),quarter,cmeta.compressedSha256,undefined,undefined,H(cr));
const finiteGround=regularRoadGround(terrain);
const meshBase=BASE+'src/render/world.ts';
registerHooks({load(url,context,nextLoad){const got=nextLoad(url,context);
 if(url!==new URL('file://'+meshBase).href)return got;
 const before=String(got.source),change="const base = import.meta.env.BASE_URL + 'world/';";
 assert(before.includes(change));
 return {...got,source:before.replace(change,"const base = 'http://peg.local/world/';")};
}});
const {World}=await import(meshBase);
const world=Object.assign(Object.create(World.prototype),{terrain,cover,pondMeshes:[],reliefActive:new Set,byId:new Map});
const surface=(x,z)=>world.surface(x,z);
const bi=JSON.parse(fs.readFileSync(PUB+'world/buildings/index.json','utf8')),bp=fs.readFileSync(PUB+'world/buildings/tiles.pack');
assert.equal(H(bp),bi.sha256);
const qtile=b=>({w:project(b[0],b[3]).x,e:project(b[2],b[1]).x,n:project(b[0],b[3]).z,s:project(b[2],b[1]).z});
const clamps=(x,a,b)=>Math.min(b,Math.max(a,x));
const smooth=(x,a,b)=>{const h=clamps((x-a)/(b-a),0,1);return h*h*(3-2*h)};
const min2d=(r,x,z)=>Math.hypot(Math.max(r.w-x,x-r.e,0),Math.max(r.n-z,z-r.s,0));
const compiled=[];
const AIR_R=7.8,AIR_LOW=2.,CAM_R=.19; // conservative virtual airframe and clip margin, not hard mesh body collision.
function testBounds(x,z){return {w:x-1120,e:x+1120,n:z-1120,s:z+1120}}
function roofs(b){
 const scenes=[];
 for(const k of bi.tiles){
  const q=qtile(k.bounds);
  if(q.e<b.w||q.w>b.e||q.s<b.n||q.n>b.s)continue;
  const bytes=bp.subarray(k.offset,k.offset+k.bytes);assert.equal(H(bytes),k.sha256);
  JSON.parse(gunzipSync(bytes)).features.forEach((x,j)=>{
   if(!Number.isFinite(x.height)||x.footprint.length<3)return;
   const p=x.footprint.map(a=>project(...a)),xx=p.map(q=>q.x),zz=p.map(q=>q.z),r={w:Math.min(...xx),e:Math.max(...xx),n:Math.min(...zz),s:Math.max(...zz)};
   if(r.e<b.w||r.w>b.e||r.s<b.n||r.n>b.s)return;
   const core=project(...x.footprint[0]);
   const top=Math.max(...p.map(a=>terrain.meshElevation(a.x,a.z)),terrain.meshElevation(core.x,core.z)) + clamps(x.height,1.30,130)+4.;
   scenes.push({r,id:k.id,j,top});
  });
 }
 return scenes;
}
const rods=[],crownExtents=[],volumes=[];
for(let v=0;v<4;v++){
 const temp=branchedCrown(v),g=temp.getAttribute('position'),b=temp.getAttribute('branchDetail');
 volumes.push({p:g.array,index:temp.index.array});
 const d=[];let west=Infinity,east=-Infinity,down=Infinity,up=-Infinity,rad=0;
 for(let k=0;k<g.count;k++){
  const [x,y,z]=[g.getX(k),g.getY(k),g.getZ(k)];
  west=Math.min(west,x);east=Math.max(east,x);down=Math.min(down,y);up=Math.max(up,y);rad=Math.max(rad,Math.hypot(x,z));
  if(b.getX(k)===0&&k%2===1&&k%6===1)d.push([x,y,z]); // reproducible points on submitted wood vertices
 }
 rods.push(d);crownExtents.push({west,east,down,up,rad});
}
function stemRows(veget,x,z,hedged){
 const r=[],a=veget.stems.array,b=veget.shapes.array;
 for(let i=0;i<veget.geom.instanceCount;i++){
  const X=a[i*3],Y=a[i*3+1],Z=a[i*3+2],H=b[i*4],W=b[i*4+1],v=b[i*4+2];
  if(Math.hypot(X-x,Z-z)>1100||(i>=veget.hedgeStart&&!hedged))continue;
  const farR=.5*Math.hypot(W,Math.max(W,1.04*H));
  const d3=crownExtents[v], ct=Math.max(d3.up,.76)*H;
  const farTop=Math.max(.99*H,.65*H+.5*W);
  const sAngle=(Math.imul(Math.floor(X*5),0x45d9f3b)^Math.imul(Math.floor(Z*5),0x119de1f3))>>>0;
  r.push({x:X,y:Y,z:Z,H,W,v,hedge:i>=veget.hedgeStart,R:Math.max(farR,W*d3.rad),top:Y+Math.max(ct,farTop),co:Math.cos(sAngle*2*Math.PI/4294967296),si:Math.sin(sAngle*2*Math.PI/4294967296)});
 }
 return r;
}
function mul(a,b){return Array.from(a,x=>x*b)}
function add(a,b){return Array.from(a,(x,i)=>x+b[i])}
function norm(v){return mul(v,1/Math.max(1e-15,Math.hypot(...v)))}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function exactCardTree(p,eye){
 const ray=norm([eye[0]-p.x,eye[1]-(p.y+p.H*.5),eye[2]-p.z]),right=norm([ray[2]+.00001,0,-ray[0]]),up=norm(cross(ray,right));
 const mix=smooth(ray[1],.19,.80),yy=1.04*p.H*(1-mix)+p.W*mix;
 const c=[p.x,p.y+p.H*(.47+.18*mix),p.z],x=mul(right,p.W*.5),y=mul(up,yy*.5);
 return [add(add(c,mul(x,-1)),mul(y,-1)),add(add(c,x),mul(y,-1)),add(add(c,x),y),add(add(c,mul(x,-1)),y)];
}
function clipXZTop(vertices,f,R,needY){
 if(!vertices.some(v=>v[1]>=needY))return -Infinity;
 const cp=[ [0,1,f.x-R],[0,-1,f.x+R],[2,1,f.z-R],[2,-1,f.z+R] ];
 let poly=vertices;
 for(const [k,a,b] of cp){
   const A=[];
   for(let j=0;j<poly.length;j++){
    const c=poly[j],d=poly[(j+1)%poly.length];
    const u=(c[k]-b)*a,v=(d[k]-b)*a;
    if(u>=0) A.push(c);
    if((u<0)!==(v<0)){
     const frac=u/(u-v);
     A.push(c.map((x,i)=>x+(d[i]-x)*frac));
    }
   }
   poly=A;if(!poly.length)return -Infinity;
 }
 return Math.max(...poly.map(q=>q[1]));
}
function exact3DCrownTop(p,f,R,needY){
 if(p.hedge||p.y+p.H*Math.max(crownExtents[p.v].up,.76)<needY)return -Infinity;
 const template=volumes[p.v],data=template.p,I=template.index,v=[];
 for(let k=0;k<data.length;k+=3){
  const a=data[k],y=data[k+1],c=data[k+2];let Y=p.y+p.H*y;
  if(p.v>=2&&y>0&&y<.76){
   const t=y/.76;
   // Full maximum provisional BLC independent of source/camera. XZ unchanged.
   Y+=Math.min(1.65,.10*p.H)*(256/27)*t*(1-t)**3;
  }
  v.push([p.x+p.W*(a*p.co-c*p.si),Y,p.z+p.W*(a*p.si+c*p.co)]);
 }
 let out=-Infinity;
 for(let j=0;j<I.length;j+=3){
  const a=v[I[j]],b=v[I[j+1]],c=v[I[j+2]];
  if(Math.max(a[1],b[1],c[1])<needY)continue;
  if(Math.min(a[0],b[0],c[0])>f.x+R||Math.max(a[0],b[0],c[0])<f.x-R
     ||Math.min(a[2],b[2],c[2])>f.z+R||Math.max(a[2],b[2],c[2])<f.z-R)continue;
  out=Math.max(out,clipXZTop([a,b,c],f,R,needY));
 }
 return out;
}
function micro(stem,ex,ey,ez,fx,fz,sinPitch,cosPitch,aspect){
 // Actual virtual instanced tree rotation/scale, no claim alpha/occlusion
 // or EFI branch warp. Both active and warm-fallback tallests were bounded.
 let max=0;
 const half=Math.tan(53*Math.PI/360);
 for(const c of rods[stem.v]){
  const x=stem.x+stem.W*(c[0]*stem.co-c[2]*stem.si)-ex,z=stem.z+stem.W*(c[0]*stem.si+c[2]*stem.co)-ez,y=stem.y+stem.H*c[1]-ey;
  const d=Math.hypot(x,y,z);
  if(d>=25)continue;
  const ahead=x*fx+z*fz,side=x*(-fz)+z*fx;
  const front=ahead*cosPitch-y*sinPitch,up=ahead*sinPitch+y*cosPitch;
  if(front>.1&&Math.abs(up)<front*half&&Math.abs(side)<front*half*aspect)max=Math.max(max,1-smooth(d,11,25));
 }
 return max;
}
const report=[];
const originalPrince=SITES.find(s=>s.id==='prince-woodland-view');
const altSource=process.env.PEI_OBSERVER_BACKUP?[0,1,1.5,2].map(y=>({...originalPrince,backupDelta:y,height:originalPrince.height+y})):SITES.filter(s=>s.id.endsWith('-woodland-view'));
for(const site of altSource){
 const q=project(site.lon,site.lat),fstr=new ForestStream('http://peg.local/',get),hedge=new HedgeStream('http://peg.local/',get);
 await hedge.settleCatalogue();hedge.move(q.x,q.z);
 await fstr.warm(q.x,q.z,3000);
 for(let n=0;n<120&&(fstr.state.inflight||hedge.state.loading);n++)await new Promise(r=>setTimeout(r,12));
 assert(fstr.state.activeReady);
 const attrs=n=>new T.InstancedBufferAttribute(new Float32Array(45000*n),n);
 const make=(wanted)=>Object.assign(Object.create(Vegetation.prototype),{
  t:terrain,cover,forestHeights:pilot,forestStream:wanted&&fstr||undefined,hedges:hedge,decorativeY:finiteGround,
  roofBits:new Uint32Array(8),crown:{visible:true},shade:{visible:true},geom:{instanceCount:0},stems:attrs(3),shapes:attrs(4),hedgeGround:attrs(4),
  hedgeStart:0,forestRevision:0,cache:new Map(),hedgeRev:-1,hedgeApply:0,lastHedges:0,lastX:Infinity,lastZ:Infinity});
 const v=make(true),w=make(false);v.update(q.x,q.z,49);w.update(q.x,q.z,49);
 const r=stemRows(v,q.x,q.z,true),rFallback=stemRows(w,q.x,q.z,false);
 // A cold session can have fewer measured heights; retain both observed
 // canonical rosters for independent bounds. Exact header/atlas pins above.
 const treeMap=new Map(),xyScale=24;
 for(const s of [...r,...rFallback]){
  const key=Math.floor(s.x/xyScale)+':'+Math.floor(s.z/xyScale);
  if(!treeMap.has(key))treeMap.set(key,new Map());
  const cell=treeMap.get(key),k=s.x+','+s.z,old=cell.get(k);
  if(old){old.top=Math.max(old.top,s.top);old.R=Math.max(old.R,s.R);old.parts.push(s);}
  else cell.set(k,{...s,parts:[s]});
 }
 const readTrees=(x,z,rad)=>{
  const a=[];
  for(let x0=Math.floor((x-rad)/xyScale);x0<=Math.floor((x+rad)/xyScale);x0++)for(let z0=Math.floor((z-rad)/xyScale);z0<=Math.floor((z+rad)/xyScale);z0++){
   const got=treeMap.get(x0+':'+z0);
   if(got)for(const p of got.values())a.push(p);
  }
  return a;
 };
 const b=roofs(testBounds(q.x,q.z));
 let runs=[];
 for(const [name,e,n] of [['gameDefault',1.9,-.35],['calm',0,0],['east4',4,0],['west4',-4,0],['north4',0,4],['south4',0,-4],['NE',3.5,3.5]]){
  const fc=name==='gameDefault'?DEFAULT_FLIGHT_CONDITIONS:flightConditions(DEFAULT_FLIGHT_CONDITIONS.massKg,e,n);
  const f=spawn(site,surface);
  const cameras=[1.72,.5625,.46].map(aspect=>({aspect,eye:undefined,groundMin:Infinity,crownBoundMin:Infinity,closestMappedRoof:Infinity,microFrames01:0,microFrames025:0,microFrames050:0,maxWeight:0,minEyeAGL:Infinity}));
  let refinedOnly=0,clearPrecise=Infinity,exactFailure=null;
  let fGroundMin=Infinity,fWingFloor=Infinity,fCrownBoundMin=Infinity,closestMappedRoof=Infinity,negativeCrown=null,roofTopBoundMin=Infinity,gearContact=false,dryCount=0,raisedRunway=0;
  for(let k=0;k<13/FIXED_STEP;k++){
   const ss=surface(f.x,f.z);
   if(ss.land)dryCount++;if(ss.runway)raisedRunway++;
   fGroundMin=Math.min(fGroundMin,f.y-ss.height);
   gearContact||=f.status!=='flying';
   if(k%3===0){
    for(let a=0;a<9;a++){const ang=a*Math.PI/4,r=a===8?0:AIR_R;
     fWingFloor=Math.min(fWingFloor,f.y-AIR_LOW-finiteGround(f.x+r*Math.cos(ang),f.z+r*Math.sin(ang)));
    }
    const tst=readTrees(f.x,f.z,35);
    for(const p of tst)if(Math.hypot(f.x-p.x,f.z-p.z)<=AIR_R+p.R){
     const d=f.y-AIR_LOW-p.top;
     if(d<fCrownBoundMin){fCrownBoundMin=d;negativeCrown={t:f.time,root:[p.x,p.z],H:p.H,W:p.W,body:[f.x,f.y,f.z],hedge:p.hedge};}
    }
    for(const z of b){
     const d=min2d(z.r,f.x,f.z);closestMappedRoof=Math.min(closestMappedRoof,d);
     if(d<=AIR_R)roofTopBoundMin=Math.min(roofTopBoundMin,f.y-AIR_LOW-z.top);
    }
    for(const c of cameras){
     const previous={...f};const {eye,target}=observerView(Object.freeze({...f}),c.aspect);
     assert.deepEqual(f,previous);
     const fx=Math.sin(f.heading),fz=-Math.cos(f.heading),db=16.8*Math.max(1,1.05/c.aspect);
     assert.deepEqual(eye,[f.x-db*fx,f.y+4.2,f.z-db*fz],'same normal chase eye at respected viewport');
     const yy=Math.max(eye[1],world.groundHeight(eye[0],eye[2])+.58);
     const dest=[eye[0],yy,eye[2]];
     if(!c.eye)c.eye=dest;
     else c.eye=c.eye.map((old,j)=>old+(dest[j]-old)*(1-Math.exp(-3*FIXED_STEP*7)));
     const [xx,ey,zz]=c.eye,ag=ey-finiteGround(xx,zz);
     const w=37*Math.max(1,1.05/c.aspect),wide=[f.x-w*fx,f.y+11,f.z-w*fz];
     wide[1]=Math.max(wide[1],world.groundHeight(wide[0],wide[2])+.58);
     const rot=new T.Quaternion().setFromEuler(new T.Euler(f.pitch,-f.heading,-f.bank,'YXZ'));
     const spin=new T.Vector3(0,.73,-.36).applyQuaternion(rot);
     const cabin=[f.x+spin.x,f.y+spin.y,f.z+spin.z];
     cabin[1]=Math.max(cabin[1],world.groundHeight(cabin[0],cabin[2])+.58);
     if(!c.wide)c.wide=wide;
     else c.wide=c.wide.map((val,j)=>val+(wide[j]-val)*(1-Math.exp(-3*FIXED_STEP*7)));
     c.minEyeAGL=Math.min(c.minEyeAGL,ey-world.groundHeight(xx,zz));
     c.groundMin=Math.min(c.groundMin,ag);
     for(const z of b)c.closestMappedRoof=Math.min(c.closestMappedRoof,min2d(z.r,xx,zz));
     let max=0;
     for(const p of readTrees(xx,zz,58)){
      const d=Math.hypot(xx-p.x,zz-p.z);
      if(d<=p.R+CAM_R)c.crownBoundMin=Math.min(c.crownBoundMin,ey-p.top-CAM_R);
      if(!p.hedge&&d<=25+p.W*.42&&ag<112){
       const hoff=Math.hypot(target[0]-xx,target[2]-zz),pitch=Math.atan2(ey-target[1],hoff);
       const fxx=(target[0]-xx)/hoff,fzz=(target[2]-zz)/hoff;
       const vv=micro(p,xx,ey,zz,fxx,fzz,Math.sin(pitch),Math.cos(pitch),c.aspect);
       max=Math.max(max,vv);
      }
     }
     if(site.id==='prince-woodland-view'){
      // Only the Prince broad failed. Exact projected front/side quad
      // bounds include cases from cold and warmed roster and three viewports.
      for(const p of readTrees(f.x,f.z,35)){
       if(Math.hypot(f.x-p.x,f.z-p.z)>AIR_R*Math.SQRT2+p.R||f.y-AIR_LOW-p.top>1.25)continue;
       refinedOnly++;
       const lim=f.y-AIR_LOW-1.25;
       for(const r of p.parts){
        let tp=Math.max(...[c.eye,c.wide,cabin].map(eye=>clipXZTop(exactCardTree(r,eye),f,AIR_R,lim)));
        tp=Math.max(tp,exact3DCrownTop(r,f,AIR_R,lim));
        const d=f.y-AIR_LOW-tp;
        if(d<clearPrecise){clearPrecise=d;exactFailure={time:f.time,view:c.aspect,stemXZ:[r.x,r.z],hedge:r.hedge,H:r.H,W:r.W};}
       }
      }
     }
     c.maxWeight=Math.max(c.maxWeight,max);
     if(max>.1)c.microFrames01++;
     if(max>.25)c.microFrames025++;
     if(max>.5)c.microFrames050++;
    }
   }
   step(f,neutral,surface,FIXED_STEP,fc);
  }
  runs.push({name,conditions:fc,after:f.status,movementM:Math.hypot(f.x-q.x,f.z-q.z),fGroundMin,fWingFloor,fCrownBoundMin,negativeCrown,
    refinedOnly,clearPrecise,exactFailure,closestMappedRoof,roofTopBoundMin,gearContact,dryCount,raisedRunway,cameras:cameras.map(({eye,wide,...rest})=>rest)});
 }
 report.push({site,roofFootprints:b.length,warmTrees:r.length,warmHedges:r.filter(s=>s.hedge).length,pilotFallbackTrees:rFallback.length,runs});
 console.log(site.id,r.length,b.length,runs.map(p=>[p.name,p.fGroundMin.toFixed(3),p.fCrownBoundMin.toFixed(3),p.closestMappedRoof.toFixed(1),p.cameras.map(q=>[q.crownBoundMin.toFixed(3),q.microFrames01,q.microFrames025,q.maxWeight.toFixed(2)])]));
}
const data={mass:DEFAULT_FLIGHT_CONDITIONS.massKg,defaultConditions:DEFAULT_FLIGHT_CONDITIONS,surfacePins:{terrain:tmeta.sha256,cover:cmeta.compressedSha256,building:bi.sha256},
 stockSites:oldSites,allSites:SITES.length,profileNegativeOrders:locks.length*2,defaultViewSequence:['Chase','Cockpit','Wide chase'],
 sourceSHAs:Object.fromEntries(['src/main.ts','src/sim/observer-view.ts','src/sim/places.ts','src/app/scenery-profile.ts'].map(p=>[p,H(fs.readFileSync(BASE+p))])),
 resultScope:'Actual shipped step/default scene surface and stock dataset AABB/volume upper bounds; canopy overlap bound not physically collidable. FOV wood vertices proxy ignores occlusion and stage timings.',
 sites:report};
const output=process.argv[2];
if(!output)throw Error('Provide a destination for the route QA report');
fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n');
