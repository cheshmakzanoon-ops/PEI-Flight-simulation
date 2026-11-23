// Browser fixture: coast-scene-audit.py stages this file at a throwaway Vite root.
import * as THREE from 'three';
import {project} from './src/sim/geo.ts';
import {loadAtlas,World} from './src/render/world.ts';
import {GroundIndex,auditEdges} from './coast-edge-audit.mjs';

const DISPLAY_LIFT=.12;
function describe(values){
  if(!values.length)return {n:0};
  values.sort((a,b)=>a-b);
  const q=f=>+values[Math.round((values.length-1)*f)].toFixed(5);
  return {n:values.length,p50:q(.5),p90:q(.9),p95:q(.95),max:q(1)};
}
function indexGround(scene,bounds){
  scene.updateMatrixWorld(true);
  const index=new GroundIndex(bounds),meshes=[],labels=[];
  const box=new THREE.Box3(new THREE.Vector3(bounds.x0,-100,bounds.z0),new THREE.Vector3(bounds.x1,100,bounds.z1));
  scene.traverseVisible(m=>{
    if(!m.isMesh||!m.userData.subdiv||!new THREE.Box3().setFromObject(m).intersectsBox(box))return;
    const g=m.geometry,arr=g.getAttribute('position'),idx=g.index?.array;
    const verts=Array.from({length:arr.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(arr,i).applyMatrix4(m.matrixWorld));
    const n=idx?.length??arr.count;const start=Math.max(0,g.drawRange.start),end=Math.min(n,start+g.drawRange.count);
    for(let i=start;i+2<end;i+=3)index.add(verts[idx?idx[i]:i],verts[idx?idx[i+1]:i+1],verts[idx?idx[i+2]:i+2]);
    meshes.push(m);labels.push({segments:m.userData.subdiv,detail:m.userData.coastalSurvey??null,totalTriangles:(end-start)/3,...(m.userData.coastalRefinement?{refinement:m.userData.coastalRefinement}:{})});
  });
  if(!meshes.length)throw new Error('No visible terrain meshes in the survey box.');
  return {index,meshes,labels};
}
function addGroup(groups,id,mesh,contact,diff){
  const g=groups[id]??={mesh:[],contact:[],diff:[]};
  g.mesh.push(mesh);g.contact.push(contact);g.diff.push(diff);
}
function finishGroups(groups){
  return Object.fromEntries(Object.entries(groups).map(([id,g])=>[id,{mesh:describe(g.mesh),contact:describe(g.contact),meshVsContact:describe(g.diff)}]));
}
function nearestVertexM(hits,x,z){
  let d=Infinity;
  for(const {t} of hits)for(const v of [t.a,t.b,t.c])d=Math.min(d,Math.hypot(x-v.x,z-v.z));
  return d;
}
function pointBounds(points,pad){
  return {x0:Math.min(...points.map(p=>p.x))-pad,x1:Math.max(...points.map(p=>p.x))+pad,
    z0:Math.min(...points.map(p=>p.z))-pad,z1:Math.max(...points.map(p=>p.z))+pad};
}
function realRay(meshes,x,z){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,300,z),new THREE.Vector3(0,-1,0));
  return ray.intersectObjects(meshes,false)[0]?.point.y;
}
async function sha256(values){
  const data=new ArrayBuffer(values.length*8),view=new DataView(data);
  values.forEach((n,i)=>view.setFloat64(i*8,n,true));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
}
// Physics ownership may extend beyond the triangles for edge blending. Probe the
// first and last owned coordinates, including where the inherited masks disagree.
function contactHandoff(terrain,world,id){
  const g=terrain.coastalGrids?.find(v=>v.spec.id===id);
  if(!g)return null;
  const inside=(x,z)=>terrain.detailElevation(x,z)!==undefined;
  const cx=(g.x0+g.x1)/2,cz=(g.z0+g.z1)/2;
  const search=(x,z,dx,dz)=>{
    let low=0,high=1;
    while(inside(x+dx*high,z+dz*high)&&high<2000)high*=2;
    if(high>=2000)throw Error('Unknown contact ownership extent');
    for(let k=0;k<40;k++){const m=(low+high)/2;if(inside(x+m*dx,z+m*dz))low=m;else high=m;}
    return (low+high)/2;
  };
  const dx0=search(g.x0,cz,-1,0),dx1=search(g.x1,cz,1,0),
        dz0=search(cx,g.z0,0,-1),dz1=search(cx,g.z1,0,1);
  function probe(x0,z0,x1,z1){
    const jumps={land:[],water:[]};let changedMask=0,worst=null;
    for(const [ax,az,bx,bz,ox,oz] of [[x0,z0,x1,z0,0,.002],[x1,z0,x1,z1,.002,0],
        [x0,z1,x1,z1,0,.002],[x0,z0,x0,z1,.002,0]]){
      const n=Math.ceil(Math.hypot(bx-ax,bz-az)/.62);
      for(let i=0;i<n;i++){
        const t=(i+.371)/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
        const a=world.surface(x-ox,z-oz),b=world.surface(x+ox,z+oz);
        if(a.land!==b.land){changedMask++;continue;}
        const delta=Math.abs(a.height-b.height);
        jumps[a.land?'land':'water'].push(delta);
        if(worst===null||delta>worst.delta)worst={delta:+delta.toFixed(7),x:+x.toFixed(4),z:+z.toFixed(4),land:a.land};
      }
    }
    return {land:describe(jumps.land),water:describe(jumps.water),changedMask,worst};
  }
  return {fineGrid:probe(g.x0,g.z0,g.x1,g.z1),outerOwnership:probe(g.x0-dx0,g.z0-dz0,g.x1+dx1,g.z1+dz1)};
}
// Terrain and water masks can meet where the signed ground is BELOW the water
// plane. A curtain that only reaches the old assumed "above sea level" land
// creates a slit, even if its two ground surfaces otherwise agree perfectly.
function curtainGaps(scene,index,terrain){
  const samples=[],toSea=[],toLand=[];let spans=0,unclassified=0,worst=null;
  const {x0,x1,z0,z1}=index.bounds;
  scene.traverseVisible(m=>{
    if(m.name!=='shore-to-sea surface')return;
    const p=m.geometry.getAttribute('position');
    for(let i=0;i+5<p.count;i+=6){
      const ax=p.getX(i),az=p.getZ(i);
      if(ax<x0-80||ax>x1+80||az<z0-80||az>z1+80)continue;
      const ends=new Map();
      for(let k=0;k<6;k++){
        const x=p.getX(i+k),z=p.getZ(i+k),y=p.getY(i+k),key=x+','+z;
        const col=ends.get(key)??{x,z,lo:Infinity,hi:-Infinity};
        col.lo=Math.min(col.lo,y);col.hi=Math.max(col.hi,y);ends.set(key,col);
      }
      if(ends.size!==2){unclassified++;continue;}
      const [a,b]=[...ends.values()];let counted=false;
      for(const u of [.125,.375,.625,.875]){
        const x=a.x*(1-u)+b.x*u,z=a.z*(1-u)+b.z*u;
        if(x<x0+2||x>x1-2||z<z0+2||z>z1-2)continue;
        if(terrain.coastalGrids?.length&&terrain.detailElevation(x,z)===undefined)continue;
        const hits=index.hits(x,z);if(!hits.length)continue;counted=true;
        const y=Math.max(...hits.map(h=>h.y)),sea=-.055;
        const lo=a.lo*(1-u)+b.lo*u,hi=a.hi*(1-u)+b.hi*u;
        const cover=h=>Math.max(0,lo-h,h-hi),water=cover(sea),land=cover(y),gap=Math.max(water,land);
        samples.push(gap);toSea.push(water);toLand.push(land);
        if(worst===null||gap>worst.gap)worst={gap:+gap.toFixed(6),sea,ground:+y.toFixed(5),curtain:[+lo.toFixed(5),+hi.toFixed(5)],x:+x.toFixed(3),z:+z.toFixed(3)};
      }
      if(counted)spans++;
    }
  });
  return {spans,unclassified,water:describe(toSea),ground:describe(toLand),envelope:describe(samples),worst};
}
async function testWorld(){
  const {sites,stride}=await(await fetch('./audit-observations.json')).json();
  const renderer=new THREE.WebGLRenderer({antialias:false,logarithmicDepthBuffer:true});
  const scene=new THREE.Scene();
  const {terrain,img,cover,sky}=await loadAtlas(()=>{});
  const world=new World(scene,terrain,img,renderer,cover,sky);
  let clock=1;
  const move=(x,z)=>world.update(new THREE.Vector3(x,80,z),++clock);
  const out=[];
  for(const site of sites){
    const points=site.points.map(([lon,lat,h,col,row])=>({...project(lon,lat),lon,lat,h,col,row}));
    const center=project(...site.reference),bounds=pointBounds(points,110);
    move(center.x,center.z);const {index,meshes,labels}=indexGround(scene,bounds);
    const groups={},rayDelta=[],wetHeight=[],allContactDiff=[],samples=[],allContacts=[];
    const coastalError={aboveHalfM:0,aboveThreeQuarterM:0,aboveOneM:0,aboveOnePoint25M:0,maximumPoint:null};
    const transects=new Map();
    const displayedAndContact=[],allMask=[];
    const counts={source:0,coverLand:0,coarseLand:0,maskDisagree:0,wrongLand:0,negativeWet:0,negativeLand:0,
      nonVertexCoverLand:0,nearVertexCoverLand:0,holes:0,doubleCoverage:0,nonFinite:0};
    for(let i=0;i<points.length;i++){
      const {x,z,lon,lat,h,col,row}=points[i],hits=index.hits(x,z);
      const surf=world.surface(x,z),shore=cover.distance(terrain,x,z),land=shore>=0,coarse=terrain.isLand(x,z);
      allMask.push(+land);
      counts.source++;counts.coverLand+=+land;counts.coarseLand+=+coarse;counts.maskDisagree+=+(land!==coarse);
      counts.wrongLand+=+(land!==surf.land);
      counts.negativeWet+=+(h<0&&!land);counts.negativeLand+=+(h<0&&land);
      if(!land)wetHeight.push(Math.abs(surf.height-(-.055))); // rendered water plane, not land's 12 cm lift
      if(!hits.length){counts.holes++;continue;}
      if(hits.filter(a=>a.inside).length>1)counts.doubleCoverage++;
      const y=Math.max(...hits.map(a=>a.y));
      if(!Number.isFinite(surf.height)||!Number.isFinite(y)){counts.nonFinite++;continue;}
      // True Three.Raycaster check exercises runtime material side, indices, transforms and drawn range.
      if(i%263===17){const actual=realRay(meshes,x,z);rayDelta.push(actual===undefined?1e6:Math.abs(actual-y));}
      displayedAndContact.push(Math.round(y*1000),Math.round(surf.height*1000),+surf.land);
      allContacts.push(surf.height);
      if(site.id==='east-point'&&[241,245].includes(row)&&col>=174&&col<=190){
        const section=transects.get(row)??[];
        section.push({col,land,sourceM:h,renderedM:+(y-DISPLAY_LIFT).toFixed(5),
          contactM:+(surf.height-DISPLAY_LIFT).toFixed(5),absoluteErrorM:+Math.abs(y-DISPLAY_LIFT-h).toFixed(5)});
        transects.set(row,section);
      }
      if(land){
        samples.push(y);
        const error=Math.abs(y-DISPLAY_LIFT-h),contactError=Math.abs(surf.height-DISPLAY_LIFT-h),inter=Math.abs(surf.height-y);
        allContactDiff.push(inter);
        coastalError.aboveHalfM+=+(error>.5);
        coastalError.aboveThreeQuarterM+=+(error>.75);
        coastalError.aboveOneM+=+(error>1);
        coastalError.aboveOnePoint25M+=+(error>1.25);
        if(!coastalError.maximumPoint||error>coastalError.maximumPoint.errorM)
          coastalError.maximumPoint={col,row,lon,lat,errorM:error,sourceM:h,renderedM:y-DISPLAY_LIFT,coverDistanceM:shore,coarseLand:coarse};
        const add=label=>addGroup(groups,label,error,contactError,inter);
        add('allCoverLand');if(coarse)add('bothMasksLand');else add('coverOnlyLand');
        if(nearestVertexM(hits,x,z)<.02){counts.nearVertexCoverLand++;continue;}
        counts.nonVertexCoverLand++;
        const rim=Math.min(col+.5,row+.5,site.cols-col-.5,site.rows-row-.5);
        add('offVertexLand');add(rim>=24?'offVertexCore24m':'offVertexOuter24m');
        add(shore<20?'offVertexShoreBand20m':'offVertexInland20m');
        if(h<0)add('offVertexNegativeLand');
      }
    }
    // These positions select far, medium and near *at the same fixed native observations*.
    // Distant LOD heights are allowed to simplify; collision must not change with a camera move.
    const lod=[];
    for(const offset of [22000,8500,0]){
      move(center.x+offset,center.z);const state=indexGround(scene,bounds),contact=[],display=[],screen=[];
      const cam=new THREE.PerspectiveCamera(53,16/9,.08,350000);
      const east=site.id==='east-point';
      if(offset){cam.position.set(center.x+offset,offset*.1,center.z);cam.lookAt(center.x,(east?10.07:1.79)+(east?19.5:20.62)/2,center.z);cam.updateMatrixWorld();}
      for(const p of points){
        const s=world.surface(p.x,p.z);contact.push(s.height);
        if(s.land){
          const hits=state.index.hits(p.x,p.z),visible=hits.length?Math.max(...hits.map(a=>a.y)):NaN;
          if(offset){
            const a=new THREE.Vector3(p.x,samples[display.length],p.z).project(cam),b=new THREE.Vector3(p.x,visible,p.z).project(cam);
            screen.push(Math.hypot((a.x-b.x)*960,(a.y-b.y)*540));
          }
          display.push(visible);
        }
      }
      lod.push({offsetM:offset,meshes:state.labels,contactDigest:await sha256(contact),screenDiffPxAt1080:describe(screen),displayedDigestMillimetres:await sha256(display.map(h=>Math.round(h*1000))),
        maxChangeInDisplayedLandM:Math.max(...display.map((v,i)=>Math.abs(v-samples[i]))),
        ...(offset===0?{}:{edges:auditEdges(state.index)})});
    }
    const visibleTransects=Object.fromEntries([...transects].map(([row,pts])=>{
      const gradientDifferences=[];
      for(let i=1;i<pts.length;i++)if(pts[i].col===pts[i-1].col+1&&pts[i].land&&pts[i-1].land)
        gradientDifferences.push(Math.abs((pts[i].renderedM-pts[i-1].renderedM)-(pts[i].sourceM-pts[i-1].sourceM)));
      return [row,{points:pts,gradientErrors:describe(gradientDifferences)}];
    }));
    out.push({id:site.id,meshes:labels,counts,coastalError,visibleTransects,meshAndContactDigestMillimetres:await sha256(displayedAndContact),oldMaskDigest:await sha256(allMask),contactHandoff:contactHandoff(terrain,world,site.id),shoreWall:curtainGaps(scene,index,terrain),
      groups:finishGroups(groups),allCoverLandContactDiff:describe(allContactDiff),waterContactOffsetFromPlane:describe(wetHeight),
      threeRayVsIndex:describe(rayDelta),nearEdges:auditEdges(index),initialContactDigest:await sha256(allContacts),lod});
  }
  // Off-window, unchanged inland check. Hash millimetre-rounded actual rendered/contact heights,
  // not class names or triangle counts, so a rebuild alone cannot change the control.
  const c=project(-63.408527,46.483862),ctrl=[];
  for(let i=0;i<24;i++)for(let j=0;j<24;j++)ctrl.push({x:c.x+(i-11.5)*7.3+.37,z:c.z+(j-11.5)*7.3+.81});
  move(c.x,c.z);const {index}=indexGround(scene,pointBounds(ctrl,15)),control=[],diff=[];
  for(const {x,z} of ctrl){
    const hits=index.hits(x,z),s=world.surface(x,z);
    if(!hits.length)throw Error('Missing triangle in Cavendish control');
    const mesh=Math.max(...hits.map(a=>a.y));control.push(Math.round(mesh*1000),Math.round(s.height*1000),+s.land);diff.push(Math.abs(mesh-s.height));
  }
  renderer.dispose();
  return {schema:1,settings:{stride,displayLiftM:DISPLAY_LIFT,coreInsetM:24,shoreBandM:20,
    edgeProbePadM:110,nonVertexDistanceM:.02,releaseView:'actual near terrain meshes and gameplay World.surface; no independent land survey'},
    sites:out,cavendishControl:{points:ctrl.length,digestMillimetres:await sha256(control),meshVsContact:describe(diff)}};
}
testWorld().then(report=>{window.auditResult=report}).catch(e=>{window.auditError=e.stack||String(e)});
