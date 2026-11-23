import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {gunzipSync} from 'node:zlib';
import {decodeSidewalks,fitSidewalk,loadSidewalks,sidewalkGeometry,walkSections,WALK_FOOT,WALK_TOP,type WalkTile} from '../src/render/sidewalks.ts';
import {SIDEWALKS} from '../src/render/sidewalks.generated.ts';

const url=new URL('../public/world/'+SIDEWALKS.asset,import.meta.url);
const compressed=readFileSync(url),plain=gunzipSync(compressed);
const bytes=(b:Uint8Array)=>new Uint8Array(b).buffer;

test('mapped sidewalk revision decodes only its bounded, uniquely tiled geometry',()=>{
 const all=decodeSidewalks(bytes(plain));
 const paths=all.flatMap(t=>t.paths);
 assert.equal(all.length,SIDEWALKS.tiles);
 assert.equal(paths.length,SIDEWALKS.paths);
 assert.equal(paths.reduce((n,p)=>n+p.points.length,0),SIDEWALKS.points);
 assert.equal(new Set(all.map(t=>t.id)).size,all.length);
 assert.deepEqual([...new Set(paths.map(t=>t.style))].sort(),[0,1,2,3,4,5]);
 assert.ok(paths.every(p=>p.width>=.9&&p.width<=2.8));
 for(const n of [0,2,15,22,34,plain.length-1])
  assert.throws(()=>decodeSidewalks(bytes(plain.subarray(0,n))));
 const wrong=bytes(plain);new DataView(wrong).setUint8(22,7);
 assert.throws(()=>decodeSidewalks(wrong),/Invalid sidewalk path/);
 const extra=new Uint8Array(plain.length+1);extra.set(plain);
 assert.throws(()=>decodeSidewalks(extra.buffer),/Mismatched sidewalk atlas counts/);
});
test('optional sidewalk data silently falls back after absence, corruption or timeout',async()=>{
 const ok=async()=>new Response(bytes(compressed));
 const hostDecoded=async()=>new Response(bytes(plain),{headers:{'content-type':'application/octet-stream'}});
 assert.equal((await loadSidewalks('/',ok))?.length,SIDEWALKS.tiles);
 assert.equal((await loadSidewalks('/',hostDecoded))?.length,SIDEWALKS.tiles);
 assert.equal(await loadSidewalks('/',async()=>new Response(null,{status:404})),undefined);
 const bad=Buffer.from(plain);bad[bad.length-1]^=1;
 assert.equal(await loadSidewalks('/',async()=>new Response(bytes(bad))),undefined);
 let aborted=false;
 const stall:typeof fetch=async(_url,init)=>new Promise((_resolve,reject)=>
  init?.signal?.addEventListener('abort',()=>{aborted=true;reject(Error('request stopped'));}));
 assert.equal(await loadSidewalks('/',stall,8),undefined);
 assert.equal(aborted,true);
});
test('walkway cuts conform to both triangles of a steep terrain facet; the physical skirt seats below it',()=>{
 const tile:WalkTile={id:'fixture',ox:0,oz:0,box:[0,0,8,8],
  paths:[{phase:23,style:0,width:1.50,points:[{x:.70,z:1.23},{x:3.15,z:2.41},{x:6.94,z:5.81},{x:7.48,z:7.11}]}]};
 const grid={x0:0,z0:0,dx:4,dz:4};
 const model=sidewalkGeometry(tile,grid,()=>true);
 assert.ok(model.top>6*(tile.paths[0].points.length-1));
 const sections=walkSections(tile.paths[0]);
 assert.ok(sections[1].every(v=>Math.hypot(v.x-3.15,v.z-2.41)<.8665));
 const a=(i:number,j:number)=>Math.sin(i*.9-j*2.1)*6+2;
 const ground=(x:number,z:number)=>{
  const qx=x/4,qz=z/4,i=Math.floor(qx),j=Math.floor(qz),u=qx-i,v=qz-j;
  return (u+v<=1?a(i,j)*(1-u-v)+a(i+1,j)*u+a(i,j+1)*v:a(i+1,j+1)*(u+v-1)+a(i+1,j)*(1-v)+a(i,j+1)*(1-u));
 };
 fitSidewalk(model,tile,ground);
 const p=model.geometry.getAttribute('position'),n=model.geometry.getAttribute('normal'),style=model.geometry.getAttribute('walkStyle');
 for(let i=0;i<p.count;i++){
  if(i<model.top){
   assert.equal(style.getY(i),0);
   assert.ok(n.getY(i)>0);
   if(i%3===0){
    const get=(axis:'getX'|'getY'|'getZ')=>p[axis](i)*.23+p[axis](i+1)*.19+p[axis](i+2)*.58;
    assert.ok(Math.abs(get('getY')-ground(get('getX'),get('getZ'))-WALK_TOP)<3e-6);
   }
  }else{
   assert.equal(style.getY(i),1);
   assert.ok(Math.abs(n.getY(i))<1e-5);
   assert.ok(Math.min(Math.abs(model.offsets[i]-WALK_TOP),Math.abs(model.offsets[i]-WALK_FOOT))<1e-7);
  }
 }
 assert.equal(sidewalkGeometry(tile,grid,()=>false).top,0);
});
