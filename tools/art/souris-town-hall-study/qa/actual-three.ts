import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {buildSourisTownHall} from '../src/hall.ts';import {DATUM,PLAN,roofAt,area} from '../src/survey.ts';
const prep=new URL('../proof/',import.meta.url), doc=JSON.parse(fs.readFileSync(new URL('fit-qa-witness.json',prep),'utf8'));
const base=buildSourisTownHall({textured:false,frontGable:false}),art=buildSourisTownHall({textured:false});
for(const g of [base,art])g.updateMatrixWorld(true);
const which=(g:T.Group)=>g.children.filter(x=>x.name==='roofCrown'||x.name==='roofSide');
const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),.00001,100);
function probe(g:T.Group,u:number,v:number){ray.set(new T.Vector3(u,80,-v),new T.Vector3(0,-1,0));return ray.intersectObjects(which(g));}
function summary(v:number[]){v.sort((a,b)=>a-b);return [0.,.50,.90,.95,1.].map(t=>{const x=t*(v.length-1),i=Math.floor(x);return v[i]+(v[Math.min(i+1,v.length-1)]-v[i])*(x-i);});}
const abs=doc.hold.map(([u,v,y]:number[])=>[
 Math.abs(y-27.310401916503906),...([base,art].map(g=>{const hit=probe(g,u,v)[0];assert(hit);return Math.abs(y-hit.point.y-DATUM);})),
]);
const sig='actual Three Float32 roof rays, all tested source centres remain disjoint from train/rank';
let leak=0,found=0,drop=0,delta=0,spread=0,pa=0,maxOutside=0;
function inside(u:number,v:number){let got=false,best=Infinity;
 for(let i=0;i<PLAN.length;i++){
  const a=PLAN[i],b=PLAN[(i+1)%PLAN.length],x=b[0]-a[0],z=b[1]-a[1];
  if((a[1]>v)!==(b[1]>v)&&u<(v-a[1])*x/z+a[0])got=!got;
  const d=Math.min(1,Math.max(0,((u-a[0])*x+(v-a[1])*z)/(x*x+z*z)));
  best=Math.min(best,Math.hypot(u-a[0]-x*d,v-a[1]-z*d));
 }
 return (got?1:-1)*best;
}
for(let v=-.2;v<14.55;v+=.103)for(let u=-4.65;u<4.71;u+=.103){
 const sd=inside(u,v),ok=sd>.002,out=sd<-.003;
 if(!(ok||out))continue;
 const r=probe(art,u,v);
 if(out){if(r.length)leak++;continue;}
 found++;
 if(!r.length){drop++;continue;}
 delta=Math.max(delta,Math.abs(r[0].point.y+DATUM-roofAt([u,v])));
 spread=Math.max(spread,r[0].point.y-r[r.length-1].point.y);
}
for(const o of art.children as T.Mesh[]) {
 const a=o.geometry.attributes.position,n=a.count;
 for(let i=0;i<n;i++){
  maxOutside=Math.max(maxOutside,-inside(a.getX(i),-a.getZ(i)));
  if(i%3!==0||o.name!=='roofSide'&&o.name!=='roofCrown')continue;
  pa+=Math.abs(area([i,i+1,i+2].map(j=>[a.getX(j),-a.getZ(j)] as [number,number])));
 }
}
assert.equal(leak,0);assert.equal(drop,0);assert(delta<1e-5);assert(spread<1e-5);assert(Math.abs(pa-Math.abs(area(PLAN)))<2e-4);
let hit=0,miss=0,cast=0;const roles:Record<string,number>={};
for(let u=art.userData.frontWallRange[0]+.039;u<=art.userData.frontWallRange[1]-.039;u+=.063)for(let y=13.46;y<roofAt([u,0])-.192;y+=.063){
 for(const eye of [[u,y,1.1],[u-1.1,y+.42,2.75],[u+1.25,y-.37,3.25]]){
  const a=new T.Vector3(eye[0],eye[1]-DATUM,eye[2]);const depth=Math.abs(u)<art.userData.centralBayU[1]?art.userData.wallFaceDepths[0]:art.userData.wallFaceDepths[1]; const b=new T.Vector3(u,y-DATUM,-depth);
  ray.set(a,b.sub(a).normalize());
  const first=ray.intersectObjects(art.children)[0];cast++;
  if(!first){miss++;if(miss<8)console.log('facade first miss',u,y,eye);continue;}
  const k=first.object.name;roles[k]=(roles[k]??0)+1;hit++;
 }
}
const doc2={qualifiedHeldCompare:{n:abs.length,sig,stock:summary(abs.map(x=>x[0])),nativeLowerAndDeck:summary(abs.map(x=>x[1])),withAuthoredFront:summary(abs.map(x=>x[2]))},
 shellProjection:{found,drop,leak,elevationDeltaMax:delta,dualRoofDepthMax:spread,signedPolygonArea:Math.abs(area(PLAN)),submissionRoofArea:pa,meshVerticesLargestApproxPlanLeakM:maxOutside},
 facadeDirectAndOblique:{cast,hit,miss,roles,warning:'artwork in nominal front extends above thresholds; no measured aisle/door access claim'},build:art.userData,
 extras:'compact right high cap and lower rear/skirt require dedicated independent separated roles; stage only'};
console.log(JSON.stringify(doc2,null,2));
assert.equal(miss,0);
