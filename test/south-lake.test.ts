import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {project} from '../src/sim/geo.ts';
import {SOUTH_LAKE as plan} from '../src/render/south-lake.generated.ts';
import {loadSouthLake} from '../src/render/south-lake.ts';

const get=(p:string)=>Uint8Array.from(readFileSync(new URL('../'+p,import.meta.url)));
const json=(p:string)=>JSON.parse(Buffer.from(get(p)).toString());
const world='public/world/',evidence='data/sheltered-water/south-lake-nhn.json';
const copy=()=>get(world+plan.asset);
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('the bounded South Lake mask pins one official archived feature and the existing shoreline',()=>{
 const source=json(evidence);
 assert.equal(source.featureId,'d0615df188d74a048e076d40d206ab61');
 assert.equal(source.sourceGeometryDate,'1987');
 assert.equal(hash(get(evidence)),plan.polygonSHA256);
 assert.equal(hash(get(world+'cover.bin.gz')),plan.coverSHA256);
 const b=copy(),body=gunzipSync(b);
 assert.equal(b.length,plan.compressedBytes);assert.ok(b.length<12_000);
 assert.equal(body.length,plan.width*plan.height);assert.ok(body.length<184_000);
 assert.equal(body.filter(x=>x!==0).length,plan.activeTexels);
 assert.equal(hash(body),plan.sha256);
});

test('every nonzero texel and its complete linear filtering support stays inside both NHN and Cover water',ctx=>{
 const source=json(evidence),coverSpec=json(world+'cover.json');
 const c=new Cover(coverSpec.width,coverSpec.height,gunzipSync(get(world+'cover.bin.gz')));
 const terrain=new Terrain({width:2,height:2,bounds:coverSpec.bounds},new Int16Array(4));
 const p=(source.ring as [number,number][]).map(r=>project(...r)),ring=p.slice(1).map((b,i)=>{
  const a=p[i],dx=b.x-a.x,dz=b.z-a.z;return {a,b,dx,dz,den:dx*dx+dz*dz};
 });
 const b=gunzipSync(copy()),[l,t]=plan.rotatedBoundsXZ,[ox,oz]=plan.worldAnchorXZ,[cs,sn]=plan.rotationCS;
 const step=plan.texelMetres,r=step*(Math.abs(cs)+Math.abs(sn)),lengthX=terrain.right-terrain.left,lengthZ=terrain.bottom-terrain.top;
 const uHalf=r/lengthX*c.width,zHalf=r/lengthZ*c.height;
 let checked=0,polygonMin=Infinity,coverMargin=Infinity;
 for(let j=0;j<plan.height;j++)for(let i=0;i<plan.width;i++){
  if(!b[j*plan.width+i])continue;
  assert.ok(i>0&&i<plan.width-1&&j>0&&j<plan.height-1);
  const a=l+(i+.5)*step,k=t+(j+.5)*step,x=ox+cs*a+sn*k,z=oz-sn*a+cs*k;
  let inside=false,minD=Infinity;
  for(const {a,b,dx,dz,den} of ring){
   if((a.z>z)!==(b.z>z)&&x<(z-a.z)*dx/dz+a.x)inside=!inside;
   if(den){
    const s=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/den));
    minD=Math.min(minD,(x-a.x-s*dx)**2+(z-a.z-s*dz)**2);
   }
  }
  assert.ok(inside&&minD>(step*Math.SQRT2)**2,'linear tent can reach outside the source feature');
  polygonMin=Math.min(polygonMin,Math.sqrt(minD)-step*Math.SQRT2);
  // A rotated tent fits in this world-axis box. Check corners of its
  // subrectangles after splitting on the Cover grid. Bilinear extrema
  // over each subrectangle occur at a corner.
  const u=(x-terrain.left)/lengthX*c.width-.5,v=(z-terrain.top)/lengthZ*c.height-.5;
  const lo=u-uHalf,hi=u+uHalf,low=v-zHalf,high=v+zHalf;
  for(const fx of [lo,hi,Math.min(hi,Math.ceil(lo))])for(const fz of [low,high,Math.min(high,Math.ceil(low))]){
   const px=terrain.left+(fx+.5)*lengthX/c.width,pz=terrain.top+(fz+.5)*lengthZ/c.height;
   const d=c.distance(terrain,px,pz);
   assert.ok(d<0,'linear tent can reach the land mask');coverMargin=Math.min(coverMargin,-d);
  }
  checked++;
 }
 assert.equal(checked,plan.activeTexels);
 ctx.diagnostic(`${checked} complete texture supports, nearest polygon safety ${polygonMin.toFixed(3)}m, nearest Cover-water margin ${coverMargin.toFixed(3)}m`);
});

test('an optional missing, delayed or corrupt shelter pack safely defaults to the original shader',async()=>{
 const known=await loadSouthLake('/world/',async u=>{
  assert.equal(u,'/world/'+plan.asset);
  return new Response(copy());
 });
 assert.equal(known?.plan.id,'south-lake-v1');
 const raw=Uint8Array.from(gunzipSync(copy()));
 assert.deepEqual(await loadSouthLake('/',async()=>new Response(raw)),known);
 raw[12_842]^=12;
 const failure=[
  ()=>Promise.resolve(new Response(null,{status:404})),
  ()=>Promise.resolve(new Response(raw.subarray(0,300),{status:206})),
  ()=>Promise.resolve(new Response(raw)),
  ()=>new Promise<Response>(()=>{})
 ];
 for(const fetcher of failure)assert.equal(await loadSouthLake('/',fetcher,200),undefined);
});
