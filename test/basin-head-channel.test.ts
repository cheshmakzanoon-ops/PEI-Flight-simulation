import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {project} from '../src/sim/geo.ts';
import {Cover} from '../src/sim/cover.ts';
import {Terrain,OCEAN_Y} from '../src/sim/terrain.ts';
import {coastSegments} from '../src/sim/shoreline.ts';
import {BASIN_CHANNEL} from '../src/sim/basin-head-channel.generated.ts';
import {loadBasinChannel,WaterInset} from '../src/sim/harbour-cover.ts';

const base=new URL('../public/world/',import.meta.url);
const metadata=(x:string)=>JSON.parse(readFileSync(new URL(x+'.json',base),'utf8'));
const archive=(x:string)=>new Uint8Array(readFileSync(new URL(x,base)));
const bytes=(x:string)=>Uint8Array.from(gunzipSync(archive(x)));
const t=metadata('terrain'),c=metadata('cover');
const terrain=new Terrain(t,new Int16Array(bytes(t.file).buffer));
const legacy=new Cover(c.width,c.height,bytes(c.file));
const overlay=new WaterInset(bytes(BASIN_CHANNEL.asset),BASIN_CHANNEL);
const scoped=new Cover(c.width,c.height,legacy.bytes,undefined,c.compressedSha256,overlay);

test('the measured Basin Head passage opens only the mapped central span without filling any legacy water',()=>{
 const p=project(-62.10826,46.37757),q=project(-62.108015,46.377657);
 const n=41;let wet=0;
 for(let i=0;i<n;i++){
  const u=i/(n-1),x=p.x+u*(q.x-p.x),z=p.z+u*(q.z-p.z);
  const old=legacy.distance(terrain,x,z),now=scoped.distance(terrain,x,z);
  assert(old>8);
  if(now<0){wet++;assert.equal(terrain.contactHeight(x,z,now>=0),OCEAN_Y);}
 }
 assert(wet>=12&&wet<=26,wet);
 const [a,b,e,s]=BASIN_CHANNEL.boundsXZ;
 for(let i=-6;i<=205;i++)for(let j=-4;j<=171;j++){
  const x=a+(e-a)*i/200,z=b+(s-b)*j/168;
  const old=legacy.distance(terrain,x,z),cut=scoped.distance(terrain,x,z);
  assert(cut<=old+2e-8);
  if(cut>=0)assert.equal(cut,old,'protected dry shoreline distance must not change optics');
  if(x<=a||x>=e||z<=b||z>=s)assert.equal(cut,old);
 }
 const off=coastSegments(legacy,terrain),on=coastSegments(scoped,terrain);
 const outside=(q:typeof off[number])=>!overlay.intersects(Math.min(q.ax,q.bx),Math.min(q.az,q.bz),Math.max(q.ax,q.bx),Math.max(q.az,q.bz));
 assert.deepEqual(on.filter(outside),off.filter(outside));
});
test('a missing or changed Basin Head package fails closed',async()=>{
 const src=archive(BASIN_CHANNEL.asset);
 assert.equal((await loadBasinChannel('/',async()=>new Response(src)))?.plan.id,BASIN_CHANNEL.id);
 for(const response of [new Response(src.slice(10)),new Response('',{status:404})]){
  assert.equal(await loadBasinChannel('/',async()=>response),undefined);
 }
});

test('native bank applies relative heights at near detail with exact untouched visual and collision boundaries',async()=>{
 const {BASIN_GROUND}=await import('../src/sim/basin-bank-relief.generated.ts');
 const {loadBasinGround,NativeBank}=await import('../src/sim/basin-bank-relief.ts');
 const packet=archive(BASIN_GROUND.asset);
 const data=await loadBasinGround('/',async()=>new Response(packet));assert(data);
 assert.equal(await loadBasinGround('/',async()=>new Response(packet.slice(2))),undefined);
 const bank=new NativeBank(terrain,data),g=bank.grid,p=data.terrain.samples,mask=data.weights;
 const eps=1.5e-6;
 let weighted=0,unchanged=0,max=0;
 for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++){
  const k=j*g.nx+i,x=g.x0+i*g.stepX,z=g.z0+j*g.stepZ;
  const grade=terrain.contactHeight(x,z,true),visible=g.indexHeight(i,j)+.12;
  const orig=g.parentHeight(x,z)+.12;
  const off=(i===0||j===0||i===g.nx-1||j===g.nz-1);
  if(off)assert(mask[k]===0&&p[k]===0);
  assert(Math.abs(visible-orig-p[k]/100)<=eps);
  if(!mask[k]){
   unchanged++;
   if(!off)assert(Math.abs(bank.height(x,z,grade)-grade)<eps);
  }else if(!off){
   weighted++;max=Math.max(max,Math.abs(visible-orig));
   if(mask[k]===255)assert(Math.abs(bank.height(x,z,grade)-visible)<eps);
  }
 }
 assert(weighted===4283&&unchanged>20000&&max>7.5);
 assert.equal(bank.height(g.x0-10,g.z0+10,18.25),18.25);
});
