import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {Cover} from '../src/sim/cover.ts';
import {HarbourCover} from '../src/sim/harbour-cover.ts';
import {Terrain,OCEAN_Y} from '../src/sim/terrain.ts';
import {project} from '../src/sim/geo.ts';
import {QUARTERMASTER as coast} from '../src/sim/quartermaster.generated.ts';
import {QUARTERMASTER_DOCKS as plan} from '../src/render/quartermaster-docks.generated.ts';
import {addQuartermasterDocks,DECK_HEIGHT,loadQuartermasterDocks,quartermasterDockGeometry} from '../src/render/quartermaster-docks.ts';

type XZ=readonly [number,number];
const read=(s:string)=>Uint8Array.from(readFileSync(new URL('../'+s,import.meta.url)));
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const world='public/world/',raw=read('data/odbl/quartermaster/docks.json');
const source=JSON.parse(Buffer.from(raw).toString());
const blob=read(world+plan.asset),data=gunzipSync(blob);
const p=(await loadQuartermasterDocks('/world/',async u=>{
 assert.equal(u,'/world/'+plan.asset);return new Response(blob);
}))!;
assert.ok(p);
const spec=JSON.parse(Buffer.from(read(world+'cover.json')).toString());
const base=gunzipSync(read(world+'cover.bin.gz'));
const c=new Cover(spec.width,spec.height,base,new HarbourCover(gunzipSync(read(world+coast.asset))));
const dry=new Cover(spec.width,spec.height,base);
const t=new Terrain({width:2,height:2,bounds:spec.bounds},Int16Array.of(9,9,9,9));
const [x0,z0]=p.originXZ;

test('water-qualified geometry pins exact OSM mapped axes and only directly mapped fingers',ctx=>{
 assert.equal(source.license,'ODbL 1.0');assert.equal(source.attribution,'© OpenStreetMap contributors');
 assert.equal(sha(raw),plan.geometrySha256);assert.equal(sha(data),plan.sha256);
 assert.equal(blob.length,plan.compressedBytes);assert.ok(blob.length<13_000);
 assert.equal(plan.coastSha256,coast.sha256);
 const spines=source.ways.filter((w:{role:string})=>w.role==='spine'),fingers=source.ways.filter((w:{role:string})=>w.role==='finger');
 assert.deepEqual(spines.map((w:{id:string})=>w.id),['157136818','251161701','251167697']);
 assert.equal(fingers.length,30);assert.equal(p.hull.length,3);
 const qual=p.renderedWays.filter(w=>w.role==='spine');
 assert.ok(qual.every(w=>w.sourceM-w.qualifiedM>1.0 && w.qualifiedM>100));
 const area=(ring:readonly XZ[])=>Math.abs(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-a[1]*b[0];},0)/2);
 const total=p.hull.reduce((sum,[outer,...holes])=>sum+area(outer)-holes.reduce((sum,r)=>sum+area(r),0),0);
 assert.ok(Math.abs(total-plan.planAreaM2)<.001);
 for(const w of fingers){
  const [parent,index]=w.junctions[0];
  assert.equal(w.junctions.length,1);
  const line=spines.find((s:{id:string})=>s.id===parent);
  assert.ok(line.coordinates.some((q:XZ)=>q[0]===w.coordinates[index][0]&&q[1]===w.coordinates[index][1]));
 }
 let furthest=0;
 for(const [id,rings] of p.deckFaces){
  const way=source.ways.find((w:{id:string})=>w.id===id);
  const line=way.coordinates.map((q:XZ)=>project(...q)) as ReturnType<typeof project>[];
  const radius=(way.role==='spine'?p.authoredNominalWidthM.spine:p.authoredNominalWidthM.finger)*.5;
  for(const ring of rings)for(const [x,z] of ring){
   const gx=x+x0,gz=z+z0;let best=Infinity;
   for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i],dx=b.x-a.x,dz=b.z-a.z;
    const u=Math.max(0,Math.min(1,((gx-a.x)*dx+(gz-a.z)*dz)/(dx*dx+dz*dz)));
    best=Math.min(best,Math.hypot(gx-a.x-u*dx,gz-a.z-u*dz));
   }
   furthest=Math.max(furthest,best-radius);assert.ok(best<radius+.002,'top outside its original narrow pier corridor');
  }
 }
 ctx.diagnostic(`33 original axes; three water-only hulls; worst polygon vertex rounding ${(furthest*1000).toFixed(2)} mm`);
});

test('the actual dock mesh stays on water with one narrow static draw and outward triangles',ctx=>{
 const g=quartermasterDockGeometry(p);
 const pos=g.getAttribute('position'),normals=g.getAttribute('normal'),layers=g.getAttribute('dockSurface');
 assert.ok(pos.count/3>500&&pos.count/3<1700,'single small mesh budget');
 assert.equal(normals.count,pos.count);assert.equal(g.getAttribute('boardUV').count,pos.count);
 const box=g.boundingBox!;assert.ok(box.max.y>OCEAN_Y&&box.min.y<OCEAN_Y&&Math.abs(box.max.y-DECK_HEIGHT)<1e-6);
 let worst=-Infinity,count=0,planArea=0;
 const radius2=.31**2;
 const water=([x,z]:XZ)=>{
  const now=c.distance(t,x+x0,z+z0);worst=Math.max(worst,now);count++;
  assert.ok(now<-.18,'visible dock mesh occupies land or touches the coarse shore mask');
  assert.equal(t.contactHeight(x+x0,z+z0,now>=0),OCEAN_Y);
 };
 const pt=(i:number):XZ=>[pos.getX(i),pos.getZ(i)];
 const dx=(a:XZ,b:XZ)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
 const mid=(a:XZ,b:XZ):XZ=>[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
 const a3=new THREE.Vector3(),b3=new THREE.Vector3(),c3=new THREE.Vector3(),n=new THREE.Vector3();
 for(let i=0;i<pos.count;i+=3){
  a3.fromBufferAttribute(pos,i);b3.fromBufferAttribute(pos,i+1).sub(a3);c3.fromBufferAttribute(pos,i+2).sub(a3);
  n.fromBufferAttribute(normals,i);
  assert.ok(b3.cross(c3).dot(n)>0,'mesh triangle does not face the outward normal');
  const a=pt(i),b=pt(i+1),c=pt(i+2);
  if(layers.getX(i)>0){
   for(const [u,v] of [[a,b],[b,c],[a,c]]){
    const parts=Math.max(1,Math.ceil(Math.sqrt(dx(u,v))/.2));
    for(let i=0;i<=parts;i++)water([u[0]+(v[0]-u[0])*i/parts,u[1]+(v[1]-u[1])*i/parts]);
   }
   continue;
  }
  planArea+=((b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]))*.5;
  const todo: [XZ,XZ,XZ][]=[[a,b,c]];
  while(todo.length){
   let [u,v,w]=todo.pop()!;
   const uv=dx(u,v),vw=dx(v,w),wu=dx(w,u);
   if(Math.max(uv,vw,wu)>radius2){
    if(vw>uv&&vw>=wu)[u,v,w]=[v,w,u];else if(wu>uv&&wu>=vw)[u,v,w]=[w,u,v];
    const m=mid(u,v);todo.push([u,m,w],[m,v,w]);
   }else{
    water(u);water(v);water(w);water([(u[0]+v[0]+w[0])/3,(u[1]+v[1]+w[1])/3]);
   }
  }
 }
 assert.ok(Math.abs(planArea-plan.planAreaM2)<.03,'top partition disagrees with visible hull area');
 assert.ok(count>50_000);
 ctx.diagnostic(`${pos.count/3} triangles, ${count} sampled mesh points, closest cover ${worst.toFixed(4)} m`);
});

test('there is no dock draw on the baseline shore or an absent/corrupt/stalled optional pack',async()=>{
 const scene=new THREE.Scene(),sun=new THREE.Vector3(.3,.9,-.1).normalize();
 assert.equal(addQuartermasterDocks(scene,dry,sun,p),undefined);
 assert.equal(addQuartermasterDocks(scene,c,sun,undefined),undefined);
 const corrupt=Uint8Array.from(data);corrupt[1223]^=63;
 for(const f of [async()=>new Response(null,{status:404}),async()=>new Response(corrupt),
  async()=>new Response(blob.subarray(0,40),{status:206}),()=>new Promise<Response>(()=>{})]){
  const result=await loadQuartermasterDocks('/',f,70);
  assert.equal(result,undefined);
  assert.equal(addQuartermasterDocks(scene,c,sun,result),undefined);
  assert.equal(scene.children.length,0);
 }
 const d=addQuartermasterDocks(scene,c,sun,p);
 assert.equal(d?.spines,3);assert.equal(d?.fingers,30);
 assert.equal(scene.children.length,1);assert.equal(scene.children[0].name,p.id);
});
