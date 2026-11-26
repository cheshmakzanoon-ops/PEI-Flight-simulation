import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,openSync,readFileSync,readSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {test} from 'node:test';
import {Scene,ShaderMaterial} from 'three';
import {sourisWestFacingRequested,sceneryOptions,rusticoHarbourRoofRequested} from '../src/app/scenery-profile.ts';
import {Buildings} from '../src/render/buildings.ts';
import {sourisFacingAdmittedEdge} from '../src/render/souris-waterfront-face-pin.ts';
import {SRS_WEST_WALL,patchSourisSchoolWestFragment} from '../src/render/souris-west-wall-material.ts';
import {PackedBytes} from '../src/sim/packed-bytes.ts';
import {Terrain} from '../src/sim/terrain.ts';

const world=(n:string)=>new URL('../public/world/'+n,import.meta.url);
const json=(n:string)=>JSON.parse(readFileSync(world(n),'utf8'));
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const atlas=json('buildings/index.json'),tile=atlas.tiles.find((x:{id:string})=>x.id===SRS_WEST_WALL.tile);
const d=json('terrain.json'),buf=gunzipSync(readFileSync(world(d.file)));
const terrain=new Terrain(d,new Int16Array(buf.buffer,buf.byteOffset,buf.byteLength/2));
const body=Buffer.alloc(tile.bytes),fd=openSync(world('buildings/'+atlas.file),'r');
try{assert.equal(readSync(fd,body,0,tile.bytes,tile.offset),tile.bytes);}finally{closeSync(fd);}
const rows=JSON.parse(gunzipSync(body).toString('utf8')).features;
const bytes=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const Builder=Buildings as unknown as new(...args:any[])=>any;
function state(wire:Uint8Array=body){
 const s=new Scene(),headers:string[]=[];
 const pack=new PackedBytes('https://fixture.invalid/buildings/'+atlas.file,atlas.bytes,async(_url,options)=>{
  const v=new Headers(options?.headers).get('range')??'';assert.equal(v,'bytes='+tile.offset+'-'+(tile.offset+body.length-1));headers.push(v);
  return new Response(Uint8Array.from(wire),{status:206,headers:{'content-range':'bytes '+v.slice(6)+'/'+atlas.bytes}});
 });
 const b=new Builder(s,terrain,[tile],pack,atlas.sha256); b.wanted.add(tile.id);
 return {b,s,headers,fetchTile:async()=>{await b.load(b.tiles[0]);return b.meshes.get(tile.id);}};
}
test('manifest, compressed tile, and entire ordered source row authorize only the one southwest edge',()=>{
 assert.equal(sha(body),SRS_WEST_WALL.wire);
 assert.equal(sha(Buffer.from(JSON.stringify(rows[32]))),SRS_WEST_WALL.row);
 assert.deepEqual(sourisFacingAdmittedEdge(atlas.sha256,tile,sha(body),rows),{ordinal:32,edge:26});
 for(const change of [
  (r:any[])=>r[32].footprint.reverse(),(r:any[])=>r[32].footprint[26][0]+=.000001,
  (r:any[])=>r[32].height+=.01,(r:any[])=>r[32].holes=[],(r:any[])=>[r[32],r[33]]=[r[33],r[32]],
 ]){const q=structuredClone(rows);change(q);assert.equal(sourisFacingAdmittedEdge(atlas.sha256,tile,sha(body),q),undefined);}
 assert.equal(sourisFacingAdmittedEdge(atlas.sha256,tile,undefined,rows),undefined);
 assert.equal(sourisFacingAdmittedEdge(atlas.sha256,{...tile,count:269},sha(body),rows),undefined);
});
test('Standard selector and local veto do not change previous roof selection',()=>{
 const site='departure=souris-waterfront-pass';
 assert(sourisWestFacingRequested(sceneryOptions(site)));
 for(const s of ['&scenery=detail','&unknown','&qa=%7B%7D','&scenery=standard&scenery=detail','&stockSourisWestFacing'])
  assert(!sourisWestFacingRequested(sceneryOptions(site+s)));
 assert(rusticoHarbourRoofRequested(sceneryOptions(site+'&stockSourisWestFacing')));
});
test('await a genuine linked program, then change exactly six style bytes and restore the original draw',async()=>{
 const a=state(),stock=await a.fetchTile(),b=state();
 assert(stock.material instanceof ShaderMaterial);
 let resolve:(v:unknown)=>void=()=>{},signal:AbortSignal|undefined,ready=true,called=0;
 const gate=new Promise(r=>resolve=r);
 b.b.enableSourisWestFacing((g:any,s:AbortSignal)=>{
  called++;signal=s;
  assert(!g.parent);assert.equal(g.children.length,1);
  assert(!g.children[0].material.transparent);assert.match(g.children[0].material.fragmentShader,/srsWestLive/);
  return gate;
 });
 const q=await b.fetchTile(),old=q.material,original=q.geometry.getAttribute('facadeStyle');
 assert.equal(called,1);assert.equal(b.headers.length,1);
 assert.equal(b.b.sourisWestFacingActive,false);assert.equal(old.fragmentShader,stock.material.fragmentShader);
 resolve(()=>ready);await gate;await Promise.resolve();
 assert.equal(b.b.sourisWestFacingActive,true);assert.equal(q.geometry.groups.length,0);
 assert.equal(q.geometry.index,null);
 assert.equal(q.material.uniforms.srsWestLive.value,1);
 assert.equal(q.material.vertexShader,old.vertexShader);assert.equal(q.material.side,old.side);
 assert.deepEqual(q.position.toArray(),stock.position.toArray());assert.deepEqual(q.geometry.boundingSphere,stock.geometry.boundingSphere);
 for(const [k,v] of Object.entries(stock.geometry.attributes) as [string,any][]){
  const after=q.geometry.getAttribute(k).array, before=v.array;
  if(k!=='facadeStyle'){assert.deepEqual(bytes(after),bytes(before),k);continue;}
  for(let j=0;j<before.length;j++)assert.equal(after[j],j>=1989&&j<1995?87:before[j]);
 }
 assert.equal(patchSourisSchoolWestFragment(q.material.fragmentShader),undefined);
 ready=false;b.b.syncSourisWestFacing();
 assert.equal(signal?.aborted,true);assert.equal(b.b.sourisWestFacingActive,false);
 assert.equal(q.material,old);assert.equal(q.geometry.getAttribute('facadeStyle'),original);
 assert.deepEqual(bytes(q.geometry.getAttribute('facadeStyle').array),bytes(stock.geometry.getAttribute('facadeStyle').array));
});
test('refused link, lost whole draw, and renderer configuration mismatch never mark the stock facade',async()=>{
 for(const mode of ['refused','projection','partial','mutated'] as const){
  const a=state();let done:(v:unknown)=>void=()=>{};const link=new Promise(r=>done=r);
  a.b.enableSourisWestFacing(()=>link);
  const q=await a.fetchTile(),stock=q.material,style=q.geometry.getAttribute('facadeStyle');
  if(mode==='partial')q.geometry.setDrawRange(0,13952);
  if(mode==='mutated'){const v=q.geometry.getAttribute('position');v.setY(1989,v.getY(1989)+.5);}
  done(mode==='refused'?undefined:()=>mode!=='projection');await link;await Promise.resolve();
  assert.equal(a.b.sourisWestFacingActive,false);assert.equal(q.material,stock);
  assert.equal(q.geometry.getAttribute('facadeStyle'),style);
  assert(!style.array.includes(87));assert.equal(a.headers.length,1);
 }
});

test('an in-place receiver mutation revokes the resident artwork without undoing the external geometry update',async()=>{
 const a=state();a.b.enableSourisWestFacing(async()=>()=>true);
 const q=await a.fetchTile();await Promise.resolve();
 assert.equal(a.b.sourisWestFacingActive,true);
 const v=q.geometry.getAttribute('position'),y=v.getY(1989)+.5;v.setY(1989,y);
 a.b.syncSourisWestFacing();
 assert.equal(a.b.sourisWestFacingActive,false);
 assert.equal(v.getY(1989),y);
 assert(!q.geometry.getAttribute('facadeStyle').array.includes(87));
});

test('a valid gzip with different signed bytes still draws the original tile',async()=>{
 const rematerialized=Uint8Array.from(body);
 rematerialized[4]^=1;
 assert.notEqual(sha(rematerialized),sha(body));
 assert.deepEqual(gunzipSync(rematerialized),gunzipSync(body));
 const a=state(rematerialized);let called=false;
 a.b.enableSourisWestFacing(async()=>{called=true;return ()=>true;});
 const m=await a.fetchTile();
 assert(m);assert.equal(a.headers.length,1);
 assert.equal(a.b.sourisWestFacingActive,false);
 assert(!called);assert(!m.geometry.getAttribute('facadeStyle').array.includes(87));
});

test('changed upload generation or owner transform retires the exact appearance independently',async()=>{
 for(const change of [(q:any)=>q.position.y=.01,(q:any)=>q.geometry.getAttribute('facadeStyle').needsUpdate=true]){
  const a=state();a.b.enableSourisWestFacing(async()=>()=>true);
  const m=await a.fetchTile();await Promise.resolve();assert.equal(a.b.sourisWestFacingActive,true);
  change(m);a.b.syncSourisWestFacing();
  assert.equal(a.b.sourisWestFacingActive,false);assert(!m.geometry.getAttribute('facadeStyle').array.includes(87));
 }
});
