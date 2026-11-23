import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CoastalGrid,GROUND_LIFT} from '../src/sim/coastal-terrain.ts';
import {cutInlandRoad,type RoadCutPoint} from '../src/sim/inland-road.ts';

const ext={left:0,right:32*112,top:0,bottom:22*112};
const s={id:'test-inland',sha256:'0'.repeat(64),kind:'inland' as const,tileX:1,tileZ:1,firstX:20,firstZ:25,cellsX:5,cellsZ:4,sub:7};
const g=new CoastalGrid(ext,{spec:s,samples:Int16Array.from({length:(5*7+1)*(4*7+1)},(_,n)=>360+Math.round(Math.sin(n*.1)*60))},()=>3);
const points:RoadCutPoint[]=[
 {x:g.x0-1,z:g.z0+1.63,y:3.55,edge:127},{x:g.x0-1,z:g.z0+2.13,y:3.55,edge:-127},
 {x:g.x1+1,z:g.z0+2.42,y:3.65,edge:-127},{x:g.x1+1,z:g.z0+1.92,y:3.65,edge:127}
];
const area=(a:RoadCutPoint,b:RoadCutPoint,c:RoadCutPoint)=>
 Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;
test('a combined road ribbon retains its plane outside and contacts exact supported interior facets',()=>{
 const v=cutInlandRoad(points,[g]);
 assert.ok(v&&v.length>100);
 let sum=0;let fine=0;
 for(let k=0;k<v.length;k+=3){
  sum+=area(v[k],v[k+1],v[k+2]);
  for(const p of v.slice(k,k+3)){
   const prev=3.55+.1*(p.x-points[0].x)/(points[2].x-points[0].x);
   if(p.x<=g.x0||p.x>=g.x1)assert.ok(Math.abs(p.y-prev)<1e-10);
   else if(Math.min(p.x-g.x0,g.x1-p.x,p.z-g.z0,g.z1-p.z)>1.17){
      assert.ok(Math.abs(p.y-g.height(p.x,p.z)!-GROUND_LIFT-.06)<1e-8);
      fine++;
   }
   assert.ok(Math.abs(p.edge)<=127.001);
  }
 }
 assert.ok(fine>30);
 assert.ok(Math.abs(sum-area(points[0],points[1],points[2])-area(points[0],points[2],points[3]))<1e-8);
 assert.equal(cutInlandRoad(points.map(p=>({...p,z:p.z+500})),[g]),undefined);
});
