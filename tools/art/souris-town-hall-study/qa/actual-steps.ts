import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';import {createHash} from 'node:crypto';
import {buildSourisTownHall} from '../src/hall.ts';
import {buildDetachedEntrySteps} from '../src/stairs-study.ts';import {RUNS} from '../src/stair-recipe.generated.ts';
import {meshDigests} from './mesh-digests.ts';import {DATUM} from '../src/survey.ts';
const dir=new URL('../proof/',import.meta.url);
const originalGround=fs.readFileSync(new URL('compact-N112-step-patch.json',dir));
assert.equal(createHash('sha256').update(originalGround).digest('hex'),'aa34e258a58d06b76167f8a76fef8f0865e129a595e855116beabe9b243c593e');
const q=JSON.parse(originalGround.toString('utf8'));
const cur=buildSourisTownHall({textured:false,rearSurvey:false});
const exact=meshDigests(cur);
assert.deepEqual(exact,JSON.parse(fs.readFileSync(new URL('rear-neutral-mesh.json',dir),'utf8')));
const matchingBytes=exact.flatMap(m=>m.parts).reduce((n,v)=>n+v.bytes,0);
const original=cur.children.find(x=>x.name==='trim') as T.Mesh;
const stepped=buildDetachedEntrySteps(RUNS,original.material as T.Material);const meshes=stepped.children as T.Mesh[];
stepped.updateMatrixWorld(true);cur.updateMatrixWorld(true);const q0=meshes.find(x=>x.name==='stoneTreads')!,q1=meshes.find(x=>x.name==='stoneCheeks')!;
const rail=meshes.find(x=>x.name==='surfaceRail')!;assert(rail);
const a0:number[]=[];for(const t of q.clippedTriangles as number[][][]){
 const a=t.map(([u,v,y])=>new T.Vector3(u,y-DATUM,-v));const n=a[1].clone().sub(a[0]).cross(a[2].clone().sub(a[0]));if(n.y<0)[a[1],a[2]]=[a[2],a[1]];for(const v of a)a0.push(...v);
}
const gg=new T.BufferGeometry();gg.setAttribute('position',new T.Float32BufferAttribute(a0,3));gg.computeVertexNormals();gg.computeBoundingSphere();
const bed=new T.Mesh(gg,new T.MeshBasicMaterial());bed.updateMatrixWorld(true);
const vv=new T.Vector3(0,-1.,0), ray=new T.Raycaster(new T.Vector3(),vv,0,100.0);let bedN=0,bedErr=0;
for(const [u,v,Y]of q.samples as [number,number,number][]){
 ray.ray.origin.set(u,55,-v);const hit=ray.intersectObject(bed)[0];assert(hit);
 bedErr=Math.max(bedErr,Math.abs(hit.point.y+DATUM-Y));bedN++;
}
const cfg=[];let totalTreads=0,maxStepErr=0,totalCheek=0,totalRailFoot=0,guardOffset=0;
for(const run of RUNS){
 let N=0,rimN=0,leastStepClear=Infinity,stepDropMin=Infinity,maxError=0,topTouch=0;
 for(let i=0;i<run.tops.length;i++){
  const v0=run.ends[i],v1=run.ends[i+1],steps=Math.ceil((v1-v0)/.0291),width=.5*run.width-.109;
  for(let j=1;j<steps;j++)for(let k=0;k<=60;k++){
   const v=v0+(v1-v0)*j/steps,u=run.center+width*(k/30.-1.0);
   ray.ray.origin.set(u,53,-v);const hit=ray.intersectObject(q0)[0],d=ray.intersectObject(bed)[0];assert(hit&&d);
   const err=Math.abs(run.tops[i]-hit.point.y-DATUM);maxError=Math.max(maxError,err);leastStepClear=Math.min(leastStepClear,hit.point.y-d.point.y);stepDropMin=Math.min(stepDropMin,d.point.y+DATUM-run.base);N++;
  }
 }
 // A real visible cheek support at the iron-base coordinates, with no
 // zero-area foot at any post or uncertain terrain anchor. No collision mesh.
 for(const s of [-1,1])for(let v=run.ends[0]+.217;v<run.ends.at(-1)!-.105;v+=.057){
  const u=run.center+s*(run.width*.5-.055);ray.ray.origin.set(u,55,-v);
  const hr=ray.intersectObject(q1)[0],gr=ray.intersectObject(bed)[0];assert(hr&&gr);
  if(hr.point.y-gr.point.y<=0)throw Error('Floating, buried definition or wrong sheet');rimN++;
 }
 // Genuine hardware contact in the actual exported triangles. Upward
 // FrontSide rays hit post undersides; downward rays hit only stone cheek.
 // Sample centre and four interior corners of each narrow post, not the
 // rail beam face itself. Keep the authored submerged post overlap.
 const ascending=new T.Raycaster(new T.Vector3(),new T.Vector3(0,1,0),0,100);
 const toe=run.ends[0]+.226,heel=run.ends.at(-2)!+.035,landingEnd=run.ends.at(-1)!-.124;
 const n=Math.max(5,Math.floor((heel-toe)/.218));
 let railFeet=0,minRailEmbed=Infinity,maxRailEmbed=-Infinity;
 for(const sign of [-1,1])for(let j=0;j<=n+1;j++){
  const v=j>n?landingEnd:toe+(heel-toe)*j/n;
  const w=j>n?.019:j===0||j===n||j===Math.floor(n/2)?.023:.010;
  const x=run.center+sign*(run.width*.5-.055);
  for(const [a,b]of [[0,0],[-.75,-.75],[-.75,.75],[.75,-.75],[.75,.75]]){
   const u=x+a*w,z=-(v+b*w);
   ascending.ray.origin.set(u,-5,z);ray.ray.origin.set(u,30,z);
   const foot=ascending.intersectObject(rail)[0],stone=ray.intersectObject(q1)[0];assert(foot&&stone);
   const embed=stone.point.y-foot.point.y;assert(embed>.014&&embed<.062,[run.label,j,embed]);
   minRailEmbed=Math.min(minRailEmbed,embed);maxRailEmbed=Math.max(maxRailEmbed,embed);railFeet++;
  }
 }
 totalRailFoot+=railFeet;
 // Sill core is physically contacted by the nominal last slab, not regarded
 // as a transfer surface or public path. Test just behind the front of the
 // authored sill and inside the min-width arch, not the outer eave halo.
 for(let u=run.center-.52;u<=run.center+.52;u+=.031){
  const v=run.ends.at(-1)!-.012;ray.ray.origin.set(u,55,-v);
  const x=ray.intersectObject(q0)[0], h=ray.intersectObjects(cur.children).filter(a=>a.point.y+DATUM<14.10&&a.point.y+DATUM>13.99)[0];
  assert(x&&h);const dh=h.point.y-x.point.y;assert(Math.abs(dh-.018)<.001);topTouch++;
 }
 cfg.push({label:run.label,N,minimumTopAboveN112M:leastStepClear,minimumFasciaBottomBuriedM:stepDropMin,maxStepErrorM:maxError,cheekRays:rimN,actualRailFootRays:railFeet,minRailEmbedM:minRailEmbed,maxRailEmbedM:maxRailEmbed,topAgainstNominalSillRays:topTouch});
 totalTreads+=N;totalCheek+=rimN;maxStepErr=Math.max(maxStepErr,maxError);
}
let faces=0;
for(const m of meshes){
 const p=m.geometry.getAttribute('position');faces+=p.count/3;
 for(let j=0;j<p.count;j++){
  const u=p.getX(j),v=-p.getZ(j),r=RUNS.find(q=>Math.abs(u-q.center)<q.width*.5+.00001);assert(r);
  const a=r.ends[0],b=r.ends.at(-1)!;
  guardOffset=Math.max(guardOffset,Math.max(0,a-v,v-b,Math.abs(u-r.center)-r.width*.5));
 }
}
assert(maxStepErr<3e-6&&bedErr<3e-6&&guardOffset<7e-7);
const out={proof:'Compact fixture: same exact B2 art and actual submitted stock N112 floor at independent controls; additions only separate detached groups with no gameplay/route/footing claim',matchingBytesToHeldB2:matchingBytes,ground:{bedN,maxHeightDiffM:bedErr,tile:q.terrainOwner,fullStockDerivedFaces:a0.length/9},artifact:{drawIndependentExtras:meshes.length,triangles:faces,actualTreadRays:totalTreads,actualCheekRays:totalCheek,actualRailFootRays:totalRailFoot,positionsBeyondNominalBoundsM:guardOffset,runs:cfg}};
console.log(JSON.stringify(out,null,2));
