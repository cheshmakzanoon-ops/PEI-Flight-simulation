import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {BASIN_SAND} from '../src/render/basin-head-sand-pin.generated.ts';
import {BASIN_SCAN} from '../src/render/basin-head-scan-pin.generated.ts';
import {BASIN_SAND_BOUNDS,basinSandIntersects,loadBasinSand} from '../src/render/basin-head-sand.ts';

const world=new URL('../public/world/',import.meta.url);
const bytes=(p:string)=>new Uint8Array(readFileSync(new URL(p,world)));
test('the pale-sand binary covers only original admitted cells and encodes their exact exterior flags',()=>{
 const m=gunzipSync(bytes(BASIN_SAND.asset)),w=BASIN_SAND.width,h=BASIN_SAND.height;
 assert.equal(m.length,w*h*2);
 let count=0,flags=0;
 const inside=(x:number,z:number)=>x>=0&&z>=0&&x<w&&z<h&&m[(z*w+x)*2]>0;
 for(let z=0;z<h;z++)for(let x=0;x<w;x++){
  let f=0,k=(z*w+x)*2;
  if(m[k]){
   count++;
   for(const [i,[a,b]] of [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]].entries())
    if(!inside(x+a,z+b)){f|=1<<i;flags++;}
  }
  assert(m[k+1]===f);
 }
 assert.equal(count,2379);assert.equal(flags,2782);
 const [l,a,r,b]=BASIN_SAND_BOUNDS;
 assert.equal(basinSandIntersects(l,a,r,b),true);
 assert.equal(basinSandIntersects(l-200,a,l,b),false);
 assert.equal(basinSandIntersects(l,b,r,b+200),false);
});

test('missing or replaced sand material inputs cannot partially change the surface material',async()=>{
 const bodies=new Map<string,Uint8Array>([[BASIN_SAND.asset,bytes(BASIN_SAND.asset)],[BASIN_SCAN.asset,bytes(BASIN_SCAN.asset)]]);
 const load=(miss?:string,truncate=false)=>loadBasinSand('/',async url=>{
  const id=String(url).slice(1),body=bodies.get(id);
  if(!body||miss===id&&!truncate)return new Response('',{status:404});
  return new Response(new Uint8Array(miss===id?body.slice(10):body));
 });
 const got=await load();assert(got);
 assert.equal(got.basinSandMap.value.image.data.length,BASIN_SAND.decodedBytes);
 assert.equal(got.basinSandScan.value.image.data.length,BASIN_SCAN.decodedBytes);
 for(const id of bodies.keys()){assert.equal(await load(id),undefined);assert.equal(await load(id,true),undefined);}
});
