import assert from 'node:assert/strict';
import test from 'node:test';
import {facet} from '../src/sim/coastal-terrain.ts';
import {ROAD_CONTACT_LIFT,seatRibbon} from '../src/render/road-contact.ts';
const v=(x:number,z:number)=>({x,z,u:7*x-11*z+9,v:14+.13*x-.19*z});
const area=(a:ReturnType<typeof v>,b:ReturnType<typeof v>,c:ReturnType<typeof v>)=>
 ((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;
const source=[v(-11,-3),v(15,3),v(-2,13)] as const;
const g={x0:0,z0:0,dx:2.1,dz:1.7};
const field=(x:number,z:number,mult:number)=>{
 const u=x/(g.dx*mult),v=z/(g.dz*mult),i=Math.floor(u),j=Math.floor(v);
 const h=(i:number,j:number)=>Math.sin(i*2.24)*3+Math.cos(j*1.36)*.8+Math.sin(i*.91+j*.42);
 return facet(u-i,v-j,h(i,j),h(i+1,j),h(i,j+1),h(i+1,j+1));
};

test('contact split retains exact plan-view coverage, inherited XZ phase, height and edge attributes',()=>{
 const tris:Array<ReturnType<typeof v>>=[];
 seatRibbon(source,g,{wearingLift:ROAD_CONTACT_LIFT,floor:()=>80,weight:()=>0},(q,y)=>{
  assert.equal(y,0);
  assert.ok(Math.abs(q.v-v(q.x,q.z).v)<2e-12&&Math.abs(q.u-v(q.x,q.z).u)<2e-11);
  tris.push(q);
 });
 const plan=Array.from({length:tris.length/3},(_,i)=>area(tris[i*3],tris[i*3+1],tris[i*3+2]));
 assert.ok(plan.length>50&&plan.every(q=>q>0));
 assert.ok(Math.abs(plan.reduce((a,b)=>a+b,0)-area(...source))<1e-8);
});

test('full wearing course clears every interior sample on N112/N56/N8 rather than just the corners',()=>{
 for(const mult of [1,2,14]){
  const soup:Array<{x:number;z:number;y:number}>=[];
  const floor=(x:number,z:number)=>field(x,z,mult);
  seatRibbon(source,g,{wearingLift:ROAD_CONTACT_LIFT,floor,weight:()=>1},(q,d)=>soup.push({x:q.x,z:q.z,y:q.v+d}));
  for(let i=0;i<soup.length;i+=3)for(const [a,b] of [[.2,.3],[.1,.57],[.48,.19],[.71,.16],[.33,.28]]){
   const c=1-a-b,x=soup[i].x*a+soup[i+1].x*b+soup[i+2].x*c,z=soup[i].z*a+soup[i+1].z*b+soup[i+2].z*c;
   const y=soup[i].y*a+soup[i+1].y*b+soup[i+2].y*c;
   assert.ok(Math.abs(y-floor(x,z)-ROAD_CONTACT_LIFT)<2e-9);
  }
 }
});
