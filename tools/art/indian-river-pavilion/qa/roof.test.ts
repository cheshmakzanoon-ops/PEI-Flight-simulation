import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from 'three';
import {buildPavilion,stockShell,steps} from '../src/model.ts';
import {pavilionMaterials} from '../src/materials.ts';
import {DATUM} from '../src/frame.ts';
import {PLAN,roofParts,roofHeight} from '../src/roof.ts';
type Point=readonly [number,number];
const inring=(u:number,v:number,r:readonly Point[])=>{
 let ii=false;
 for(let i=0,j=r.length-1;i<r.length;j=i++){
  const A=r[i],B=r[j];if((A[1]>v)!==(B[1]>v)&&u<(B[0]-A[0])*(v-A[1])/(B[1]-A[1])+A[0])ii=!ii;
 }
 return ii;
};
const quant=(x:number[],f:number)=>{
 const a=[...x].sort((x,y)=>x-y),k=f*(a.length-1),i=Math.floor(k);
 return a[i]+(a[Math.ceil(k)]-a[i])*(k-i);
};
const area=(r:readonly Point[])=>Math.abs(r.reduce((s,a,i)=>{
 const b=r[(i+1)%r.length];return s+a[0]*b[1]-a[1]*b[0];
},0))/2;
const geom=(p:T.Group,k:string)=>p.getObjectByName('Pavilion '+k) as T.Mesh;
const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
const cast=(objects:T.Object3D[],u:number,v:number,from=43)=>{
 ray.set(new T.Vector3(u,from-DATUM,-v),down);
 return ray.intersectObjects(objects,false)[0];
};
function absStats(y:number[]){
 return {n:y.length,p90:quant(y,.9),p95:quant(y,.95),worst:Math.max(...y)};
}
const ma=pavilionMaterials(false),hero=buildPavilion('hero',ma),flight=buildPavilion('flight',ma),stock=stockShell();
for(const x of [hero,flight,stock])x.updateMatrixWorld(true);
const q=JSON.parse(readFileSync(new URL('fold0-witness.json',import.meta.url),'utf8')) as {xyzuRole:[number,number,number,number][];model:{cuts:number[]}};
const stats:Record<string,unknown>={};

test('fold 0 roof observations hit actual submitted hero and flight at the correct frozen branch',()=>{
 for(const [k,g] of Object.entries({hero,flight})){
  const all:number[]=[],interior:number[]=[],old:number[]=[],prevInterior:number[]=[];
  let maxY=0,roofMisses=0;
  for(const [u,v,z] of q.xyzuRole){
   const h=cast(g.children,u,v),stockHeight=cast(stock.children,u,v);
   if(!h||h.object.userData.role!=='roof'){roofMisses++;continue;}
   assert.ok(stockHeight);
   const py=h.point.y+DATUM,prev=stockHeight!.point.y+DATUM;
   maxY=Math.max(maxY,Math.abs(py-roofHeight(u,v)));
   const oldErr=Math.abs(z-prev),error=Math.abs(z-py);
   old.push(oldErr);all.push(error);
   let min=100;
   for(let i=0;i<PLAN.length;i++){
    const a=PLAN[i],b=PLAN[(i+1)%PLAN.length];
    const x1=b[0]-a[0],y1=b[1]-a[1],k=Math.min(1,Math.max(0,((u-a[0])*x1+(v-a[1])*y1)/(x1*x1+y1*y1)));
    min=Math.min(min,Math.hypot(u-a[0]-k*x1,v-a[1]-k*y1));
   }
   const boundary=q.model.cuts;
   if(Math.min(min,Math.abs(u-boundary[0]),Math.abs(v-boundary[1]))>=.38){interior.push(error);prevInterior.push(oldErr);}
  }
  assert.equal(roofMisses,0);assert.ok(maxY<.0000014,maxY.toString());
  assert.equal(all.length,234);assert.equal(interior.length,170);
  assert.ok(quant(all,.9)<.045&&quant(interior,.9)<.028);
  stats[k]={all:absStats(all),interior:absStats(interior),stockAll:absStats(old),stockInterior:absStats(prevInterior),
   roofMisses,maxAbsElevErrorToAnalyticM:maxY};
 }
});

test('exact measured footprint has one horizontal-area cap in both tiers; fascia and glazing do not move roofs',()=>{
 const expectedArea=area(PLAN);
 assert.equal(roofParts().length,4);
 assert.ok(Math.abs(expectedArea-roofParts().reduce((s,x)=>s+area(x.ring),0))<2e-10);
 for(const g of [hero,flight]){
  const m=geom(g,'roof'),p=m.geometry.getAttribute('position'),idx=m.geometry.index!;
  let sum=0;
  for(let i=0;i<idx.count;i+=3){
   const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
   const a2=p.getX(a),a3=-p.getZ(a);
   const x=p.getX(b)-a2,y=-p.getZ(b)-a3,w=p.getX(c)-a2,z=-p.getZ(c)-a3;
   sum+=Math.abs(x*z-y*w)/2;
  }
  assert.ok(Math.abs(sum-expectedArea)<.000018,JSON.stringify({sum,expectedArea}));
  let inside=0,outside=0,max=0;
  for(let i=-93;i<=93;i++)for(let j=-93;j<=93;j++){
   const u=i*.07+.0013,v=j*.07+.0037;
   const contains=inring(u,v,PLAN),hit=cast([m],u,v);
   if(contains){
    assert.ok(hit,[u,v].toString());inside++;
    const e=Math.abs(hit!.point.y+DATUM-roofHeight(u,v));max=Math.max(max,e);
   }else{assert.ok(!hit,[u,v].toString());outside++;}
  }
  assert.ok(max<.000044,max.toString());
  stats[g===hero?'heroCap':'flightCap']={inside,outside,actualTriangleArea:sum,expectedArea,max};
 }
});

test('true stepped deck last does not miss and is common to both tiers',()=>{
 for(const g of [hero,flight]){
  const m=geom(g,'deck');let n=0,max=0;
  for(let a=-946;a<=602;a+=9)for(let b=-946;b<=598;b+=9){
   const u=a/100+.0011,v=b/100+.0023;
   let height=steps[0][1] as number;
   for(const [inward,y] of steps)if(u>=inward&&v>=inward)height=y;
   const hit=cast([m],u,v);
   assert.ok(hit,[u,v].toString());n++;
   const e=Math.abs(hit!.point.y+DATUM-height);max=Math.max(max,e);
  }
  stats[g===hero?'heroDeck':'flightDeck']={n,max};
  assert.ok(max<.000001);
 }
});
test('hero and flight every attribute finite, valid winding and scale, true cap buffers identical',()=>{
 for(const g of [hero,flight]){
  let tri=0,verts=0,bytes=0;
  for(const m of g.children as T.Mesh[]){
   const a=m.geometry.getAttribute('position'),i=m.geometry.index!;
   assert.ok(i.count%3===0);
   verts+=a.count;tri+=i.count/3;bytes+=i.array.byteLength;
   for(const p of Object.values(m.geometry.attributes)){
    const raw=(p as T.BufferAttribute).array;bytes+=raw.byteLength;
    assert.ok(raw.every(x=>Number.isFinite(x)));
   }
   assert.ok(i.array.every(k=>k>=0&&k<a.count));
   assert.ok(m.geometry.boundingSphere!.radius<22);
  }
  stats[g===hero?'heroGeometry':'flightGeometry']={tri,verts,bytes,opaqueDraws:g.children.length-1,glassDraws:1};
  assert.ok(tri<5300&&verts<12500&&g.children.length<=10,[tri,verts,g.children.length].toString());
 }
 const a=geom(hero,'roof').geometry,b=geom(flight,'roof').geometry;
 assert.deepEqual(a.getAttribute('position').array,b.getAttribute('position').array);
 assert.deepEqual(a.index!.array,b.index!.array);
 if(process.env.PAVILION_QA_RECEIPT)writeFileSync(process.env.PAVILION_QA_RECEIPT,JSON.stringify(stats,null,2)+'\n');
});

test('only a truly roof-blocked opaque beam discontinues its draw; low glazing view retains it',async()=>{
 const {pavilionBeamOccluded}=await import('../src/opaque-occlusion.ts');
 const light=new T.DirectionalLight(0xfff2da,2.03);
 light.position.set(-22.8,42.8,28.7);light.target.position.set(.6,2.4,.3);
 light.updateMatrixWorld();light.target.updateMatrixWorld();
 const beam=geom(hero,'steel'),roof=geom(hero,'roof');
 const testEye=(a:number,b:number,c:number)=>{
  const camera=new T.PerspectiveCamera(42,1040/656,.08,650);camera.position.set(a,b,c);
  camera.lookAt(0,2.7,0);camera.updateMatrixWorld();return camera;
 };
 const close=testEye(-10.2,1.77,10.98),high=testEye(19.25,18.8,-18.4),flightCam=testEye(-63.7,75.9,78.6);
 assert.ok(!pavilionBeamOccluded(beam,close,light));
 assert.ok(pavilionBeamOccluded(beam,high,light));
 assert.ok(pavilionBeamOccluded(beam,flightCam,light));
 const moon=new T.DirectionalLight();
 moon.position.set(-100,1,130);moon.target.position.set(.6,2.4,.3);
 moon.updateMatrixWorld();moon.target.updateMatrixWorld();
 assert.ok(!pavilionBeamOccluded(beam,high,moon));
 const raySet=new T.Raycaster();
 const point=new T.Vector3(),delta=new T.Vector3();
 const positions=beam.geometry.getAttribute('position');
 let checked=0,nearest=Infinity;
 for(const [x,y,z] of [[-63.7,75.9,78.6],[19.25,18.8,-18.4],[9.2,16.7,12.9],[-5.0,45.27,-22.68],[3.74,7.03,-.11],[0,32,0]]){
  const camera=testEye(x,y,z);
  if(!pavilionBeamOccluded(beam,camera,light))continue;
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i);
   delta.copy(point).sub(camera.position);
   raySet.set(camera.position,delta.clone().normalize());
   const rr=raySet.intersectObject(roof)[0];assert.ok(rr);
   const clearance=delta.length()-rr.distance;
   nearest=Math.min(nearest,clearance);assert.ok(clearance>.025);
   checked++;
  }
 }
 assert.ok(checked>90);
 stats.opticalGate={numericalActualRoofBlocksAllChecked:checked,nearestBeforeBeamM:nearest,lowKeepsSteel:true,lowSunKeepsSteel:true};
 if(process.env.PAVILION_QA_RECEIPT)writeFileSync(process.env.PAVILION_QA_RECEIPT,JSON.stringify(stats,null,2)+'\n');
});
