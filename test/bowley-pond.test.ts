import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {test} from 'node:test';
import {BOWLEY_POND} from '../src/sim/bowley-pond.generated.ts';
import {admitPondTiles,BowleyPond,bowleyAtlasMatches,loadBowleyPond} from '../src/sim/bowley-pond.ts';
import {project} from '../src/sim/geo.ts';

const spec=BOWLEY_POND;
const archive=readFileSync(new URL('../public/world/'+spec.file,import.meta.url));
const decoded=gunzipSync(archive);
const job=new BowleyPond(spec,decoded);
const atlas=[spec.terrainSha256,spec.coverCompressedSha256,spec.coverDecodedSha256] as const;
const water=[[-62.708898169803,46.449062659262],[-62.708116539095,46.448702821100],[-62.707400044280,46.448401456640]] as const;
const exterior=[[-62.7139013,46.4486817],[-62.7073147,46.4453551],[-62.70914,46.44553],[-62.70914,46.45172]] as const;
test('the frozen pond is bounded, horizontally registered and uses one dated stage',()=>{
 assert.equal(archive.length,spec.compressedBytes);
 assert.equal(decoded.length,spec.decodedBytes);
 assert.equal(createHash('sha256').update(decoded).digest('hex'),spec.sha256);
 assert.equal(job.spec.waterY,1.132);
 assert(bowleyAtlasMatches(...atlas));
 for(let k=0;k<3;k++){
  const v: (string|undefined)[]=[...atlas];v[k]=undefined;
  assert(!bowleyAtlasMatches(...v as [string|undefined,string|undefined,string|undefined]));
 }
 for(const [lo,la] of water){const {x,z}=project(lo,la);assert(job.water(x,z));}
 for(const [lo,la] of exterior){const {x,z}=project(lo,la);assert(!job.water(x,z));}
 assert(!job.water(NaN,NaN));assert(!job.water(Infinity,-Infinity));
 assert(!job.intersects(job.x1+1,job.z1+1,job.x1+2,job.z1+2));
});

test('packed body may arrive gzip or decoded; corrupt, missing and slow packs never install',async()=>{
 let calls=0;
 const http=(body:Buffer):typeof fetch=>async(u,opts)=>{
  calls++;assert(String(u).endsWith(spec.file));assert(!opts?.signal?.aborted);
  return new Response(new Uint8Array(body));
 };
 assert((await loadBowleyPond('/world/',http(archive)))?.spec.id===spec.id);
 assert((await loadBowleyPond('/world/',http(decoded)))?.spec.id===spec.id);
 const corrupt=Buffer.from(decoded);corrupt[253]^=17;
 assert.equal(await loadBowleyPond('/world/',http(corrupt)),undefined);
 assert.equal(await loadBowleyPond('/world/',async()=>new Response(null,{status:404})),undefined);
 let aborted=false;
 const stalled:typeof fetch=async(_u,opts)=>new Promise((_resolve,reject)=>{
  opts?.signal?.addEventListener('abort',()=>{aborted=true;reject(new Error('cancelled'));},{once:true});
 });
 assert.equal(await loadBowleyPond('/world/',stalled,13),undefined);
 assert(aborted);assert.equal(calls,3);
});

test('the one continuous field has no exact-zero-edge ties and no loose contour endpoints',()=>{
 const arcs=job.contours(),ends=new Map<string,number>();
 assert(arcs.length>4000&&arcs.length<18000,arcs.length);
 assert(!decoded.includes(128));
 let maxChordResidual=0;
 for(const [a,b,c,d] of arcs){
  assert(Math.hypot(a-c,b-d)>.0000001);
  for(const [x,z] of [[a,b],[c,d]]){
   assert(Math.abs(job.distance(x,z))<1e-8,job.distance(x,z));
   const k=x.toFixed(7)+':'+z.toFixed(7);ends.set(k,(ends.get(k)??0)+1);
  }
  for(const t of [.2,.35,.5,.65,.8]){
   const x=a+(c-a)*t,z=b+(d-b)*t;
   maxChordResidual=Math.max(maxChordResidual,Math.abs(job.distance(x,z)));
  }
 }
 assert([...ends.values()].every(n=>n%2===0));
 assert(maxChordResidual<.0025,maxChordResidual);
});

test('independent surveyed stages never share a land mask binding or accept a clipped reserve',()=>{
 const pond=(id:string,left:number,top:number,waterY:number)=>new BowleyPond({id,width:4,height:4,left,top,step:1,units:1,waterY},
  new Uint8Array([255,255,255,255,255,72,72,255,255,72,72,255,255,255,255,255]));
 const a=pond('first',2,2,1.13),b=pond('second',15,15,1.46),same=pond('same tile',5,5,2),touch=pond('touches boundary',10,1,2),outside=pond('outside',18,15,2);
 const world={left:0,top:0,right:20,bottom:20,columns:2,rows:2};
 assert.deepEqual(admitPondTiles([a,b,same,touch,outside],world),[a,b]);
 assert.deepEqual(admitPondTiles([touch,a,b],world),[touch,b]);
 assert.deepEqual(admitPondTiles([a],{...world,columns:0}),[]);
 assert(a.water(4,4)&&!b.water(4,4));
 assert(b.water(17,17)&&!a.water(17,17));
 assert.notEqual(a.spec.waterY,b.spec.waterY);
});
