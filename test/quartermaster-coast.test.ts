import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Cover} from '../src/sim/cover.ts';
import {coastSegments} from '../src/sim/shoreline.ts';
import {Terrain,OCEAN_Y} from '../src/sim/terrain.ts';
import {loadHarbourCover,HarbourCover} from '../src/sim/harbour-cover.ts';
import {QUARTERMASTER as plan} from '../src/sim/quartermaster.generated.ts';
import {project} from '../src/sim/geo.ts';

const get=(p:string)=>Uint8Array.from(readFileSync(new URL('../'+p,import.meta.url)));
const json=(p:string)=>JSON.parse(Buffer.from(get(p)).toString());
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const world='public/world/',source='data/odbl/quartermaster/coast.json',compressed=get(world+plan.asset);
const mask=gunzipSync(compressed),spec=json(world+'cover.json'),body=gunzipSync(get(world+'cover.bin.gz'));
const original=new Cover(spec.width,spec.height,body),c=new Cover(spec.width,spec.height,body,new HarbourCover(mask));
const t=new Terrain({width:2,height:2,bounds:spec.bounds},Int16Array.of(9,9,9,9));
const points=(json(source).coast as [number,number][]).map(q=>project(...q));
const edges=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z;return {a,b,dx,dz,l2:dx*dx+dz*dz};});
const [x0,z0,x1,z1]=plan.boundsXZ,sx=(x1-x0)/(plan.width-1),sz=(z1-z0)/(plan.height-1);

test('the separately attributed optional harbour inset pins only the reviewed modern directed coastline',()=>{
 const s=json(source);assert.equal(s.sourceWayId,'251166158');assert.equal(s.sourceWayVersion,'30');
 assert.equal(s.license,'ODbL 1.0');assert.deepEqual(s.sourceNodeRangeZeroBasedInclusive,[94,115]);
 assert.equal(s.coast.length,22);assert.equal(sha(get(source)),plan.sourceSha256);
 assert.equal(sha(get(world+'cover.bin.gz')),plan.pinCoverSha256);
 assert.equal(compressed.byteLength,plan.compressedBytes);assert.ok(compressed.byteLength<30_000);
 assert.equal(mask.byteLength,plan.width*plan.height*2);assert.equal(sha(mask),plan.sha256);
});

test('every negative texel lies far enough inside the OSM basin to keep all linear filter support inside',ctx=>{
 let rendered=0,minimum=Infinity;
 for(let j=0;j<plan.height;j++)for(let i=0;i<plan.width;i++){
  const n=(j*plan.width+i)*2;if(!mask[n+1]||mask[n]>=128)continue;
  const x=x0+i*sx,z=z0+j*sz;
  let inside=false,d2=Infinity;
  for(const {a,b,dx,dz,l2} of edges){
   if((a.z>z)!==(b.z>z)&&x<(z-a.z)*dx/dz+a.x)inside=!inside;
   const s=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2));
   d2=Math.min(d2,(x-a.x-dx*s)**2+(z-a.z-dz*s)**2);
  }
  assert.ok(inside&&d2>sx*sx+sz*sz,'negative interpolation supported outside the source geometry');
  minimum=Math.min(minimum,Math.sqrt(d2)-Math.hypot(sx,sz));rendered++;
 }
 assert.ok(rendered>10_000);
 ctx.diagnostic(`${rendered} negative supports; min spare source inset ${minimum.toFixed(3)}m`);
});

test('the overlay exposes water only, preserves every old terrain height on unchanged wet/dry classes, and joins the same ocean',ctx=>{
 let newly=0,edges=0;
 for(let j=-3;j<=plan.height+3;j+=2)for(let i=-3;i<=plan.width+3;i+=2){
  const x=x0+i*sx,z=z0+j*sz,old=original.distance(t,x,z),now=c.distance(t,x,z);
  assert.ok(now<=old+1e-10);
  if(i<0||i>=plan.width||j<0||j>=plan.height){assert.equal(now,old);edges++;}
  const contact=t.contactHeight(x,z,now>=0);
  if(old>=0&&now<0){assert.equal(contact,OCEAN_Y);newly++;}
  else assert.equal(contact,t.contactHeight(x,z,old>=0));
 }
 assert.ok(newly>5_000&&edges>1000);
 const a=points[0],b=points.at(-1)!;
 for(let i=0;i<=2048;i++){
  const x=a.x+(b.x-a.x)*i/2048,z=a.z+(b.z-a.z)*i/2048;
  assert.ok(original.distance(t,x,z)<-2&&c.distance(t,x,z)<-2,'artificial mouth closure changed a shore');
 }
 ctx.diagnostic(`${newly} sampled corrections; ${edges} exterior controls; 2049 previously wet mouth observations`);
});

test('local replacement curtains stitch to coarse contours and do not touch any offsite segment',ctx=>{
 const old=coastSegments(original,t),next=coastSegments(c,t);
 const local=({ax,az,bx,bz}:{ax:number;az:number;bx:number;bz:number})=>{
  const x=(ax+bx)*.5,z=(az+bz)*.5;
  return x>x0&&x<x1&&z>z0&&z<z1;
 };
 const outer=(a:typeof old)=>a.filter(s=>!local(s));
 assert.deepEqual(outer(next),outer(old));
 const zero=new Cover(spec.width,spec.height,body,new HarbourCover(new Uint8Array(plan.decodedBytes)));
 assert.deepEqual(coastSegments(zero,t),old,'an unchanged attached inset must not remesh nearby shores');
 const pts=new Map<string,number>();let stitch=0;
 for(const {ax,az,bx,bz} of next)for(const [x,z] of [[ax,az],[bx,bz]]){
  const on=Math.min(Math.abs(x-x0),Math.abs(x-x1),Math.abs(z-z0),Math.abs(z-z1))<.0002;
  if(!on||x<x0-.001||x>x1+.001||z<z0-.001||z>z1+.001)continue;
  const id=x.toFixed(4)+','+z.toFixed(4);pts.set(id,(pts.get(id)??0)+1);stitch++;
 }
 assert.ok(stitch>=2);
 assert.ok([...pts.values()].every(n=>n===2),'nonmanifold harbor curtain splice');
 const fine=next.filter(local);assert.ok(fine.length>100);
 const all=next.flatMap(({ax,az,bx,bz})=>[[ax,az],[bx,bz]]).filter(([x,z])=>x>=x0-.01&&x<=x1+.01&&z>=z0-.01&&z<=z1+.01);
 for(const a of all){
  if(Math.min(Math.abs(a[0]-x0),Math.abs(a[0]-x1),Math.abs(a[1]-z0),Math.abs(a[1]-z1))<.001)continue;
  assert.ok(all.some(b=>a!==b&&(a[0]-b[0])**2+(a[1]-b[1])**2<.013**2),'unstitched internal harbor curtain edge');
 }
 ctx.diagnostic(`${fine.length} local curtain segments; ${stitch/2} seam crossings welded`);
});

test('corruption, absence or stalling preserve the original province shoreline',async()=>{
 const decoded=Uint8Array.from(mask);
 const ok=await loadHarbourCover('/world/',async u=>{
  assert.equal(u,'/world/'+plan.asset);return new Response(compressed);
 });
 assert.equal(ok?.plan.id,'quartermaster-coast-v1');
 assert.deepEqual(await loadHarbourCover('/',async()=>new Response(decoded)),ok);
 decoded[3070]^=64;
 for(const f of [()=>Promise.resolve(new Response(null,{status:404})),()=>Promise.resolve(new Response(decoded)),
  ()=>Promise.resolve(new Response(decoded.subarray(0,40),{status:206})),()=>new Promise<Response>(()=>{})])
  assert.equal(await loadHarbourCover('/',f,220),undefined);
});
