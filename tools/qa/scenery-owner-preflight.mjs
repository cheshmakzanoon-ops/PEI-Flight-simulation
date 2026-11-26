/** Exact native CPU baseline for a single mapped building. No art load, map
 * mutation, external data access, or claim about a rendered browser frame. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Scene,Texture} from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {Buildings} from '../../src/render/buildings.ts';
import {downtownTilePin} from '../../src/render/summerside-roof-source.ts';
import {loadCoastalSurveys} from '../../src/sim/coastal-terrain.ts';

const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const attributes=['position','normal','uv','color','topFlag','facadeStyle'];
const metaRoot=resolve(fileURLToPath(new URL('../../',import.meta.url)));
function bytes(a){
 return Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
}
function limits(a,lo,hi){
 const stride=a.itemSize*a.array.BYTES_PER_ELEMENT;
 return bytes(a).subarray(lo*stride,hi*stride);
}
export async function sceneryOwnerPreflight(repo,tileId,ordinal,profile='standard'){
 if(!/^q[0-3]{1,12}$/.test(tileId)||!Number.isSafeInteger(ordinal)||ordinal<0||!['standard','legacy'].includes(profile))
  throw Error('Use an exact q tile, nonnegative ordinal, and standard or legacy profile');
 const read=f=>readFileSync(join(repo,'public/world',f));
 const json=f=>JSON.parse(read(f));
 const atlas=json('buildings/index.json'),spec=json('terrain.json');
 const tile=atlas.tiles.find(t=>t.id===tileId);
 if(!tile||ordinal>=tile.count)throw Error('No such authored atlas row');
 const pack=read('buildings/'+atlas.file),ground=gunzipSync(read(spec.file));
 assert.equal(pack.length,atlas.bytes);assert.equal(sha(pack),atlas.sha256);assert.equal(sha(ground),spec.sha256);
 const record=pack.subarray(tile.offset,tile.offset+tile.bytes);
 assert.equal(record.byteLength,tile.bytes);assert.equal(sha(record),tile.sha256);
 const rows=JSON.parse(gunzipSync(record)).features;
 assert.equal(rows.length,tile.count);
 if(!Array.isArray(rows[ordinal]?.footprint)||rows[ordinal].footprint.length<3)throw Error('Missing stock outline');
 const base='http://local.invalid/world/';
 const readLocal=async url=>{
  const path=new URL(url).pathname;
  try{return new Response(read(path.slice('/world/'.length)));}catch{return new Response(null,{status:404});}
 };
 const surveys=await loadCoastalSurveys(base,readLocal);
 assert(surveys.length>=2,'The two signed coastal meshes must decode');
 const terrain=new Terrain(spec,new Int16Array(ground.buffer,ground.byteOffset,ground.byteLength/2),surveys);
 const scene=new Scene();
 // The native emitter selects its original measured Water Street/Victoria
 // materials only with an environment texture, even for an offline trace.
 scene.environment=new Texture();
 const asset=new Buildings(scene,terrain,[tile],undefined,atlas.sha256);
 const downtown=profile==='standard'&&downtownTilePin(atlas.sha256,tile)?.sha256===tile.sha256;
 const emit=(features,mark)=>asset.generate(features,asset.tiles[0],false,mark,false,tile.sha256,downtown);
 const owner=emit(rows,ordinal),normal=emit(rows),g=owner.geometry,n=g.getAttribute('position').count;
 try{
  const [lo,hi]=owner.userData.beaconTriangles??[-1,-1];
  assert(lo>=0&&hi>lo&&hi<=n&&lo%3===0&&hi%3===0,'This row does not own a complete stock span in this profile');
  assert(g.index===null&&g.groups.length===0&&g.drawRange.start===0&&g.drawRange.count===Infinity);
  assert.deepEqual(Object.keys(g.attributes).sort(),[...attributes].sort());
  for(const k of attributes)assert.equal(sha(bytes(g.getAttribute(k))),sha(bytes(normal.geometry.getAttribute(k))),'Recording a span must not modify '+k);
  const omitted=emit(rows.map((row,i)=>i===ordinal?{...row,footprint:[]}:row));
  const remainder=n-(hi-lo),fields={};
  try{
   assert.equal(omitted.geometry.getAttribute('position').count,remainder);
   for(const k of attributes){
    const a=g.getAttribute(k),p=limits(a,0,lo),q=limits(a,hi,n);
    const rest=sha(Buffer.concat([p,q]));assert.equal(rest,sha(bytes(omitted.geometry.getAttribute(k))),k+' native compacted comparison');
    fields[k]={stock:sha(bytes(a)),selected:sha(limits(a,lo,hi)),untouched:rest};
   }
  }finally{omitted.geometry.dispose();}
  const index=n<=65536?new Uint16Array(remainder):new Uint32Array(remainder);
  for(let i=0;i<remainder;i++)index[i]=i<lo?i:i+hi-lo;
  const part=g.getAttribute('topFlag');
  let roof=0,facade=0;
  for(let i=lo;i<hi;i+=3){
   if(part.getX(i)>.5&&part.getX(i+1)>.5&&part.getX(i+2)>.5)roof++;
   else if(part.getX(i)===0&&part.getX(i+1)===0&&part.getX(i+2)===0)facade++;
  }
  assert.equal(typeof downtown,'boolean');
  return {sourceAtlas:atlas.sha256,sourceTileSHA:tile.sha256,terrain:spec.sha256,coastalIds:terrain.coastalSurveys,
    tile:tileId,ordinal,profile,downtown,canonicalRow:sha(JSON.stringify(rows[ordinal])),
    wholeVertices:n,span:[lo,hi],originalRoofFaces:roof,originalFacadeFaces:facade,meshOrigin:owner.position.toArray(),
    untouchedVertexCount:remainder,untouchedIndexType:index.constructor.name,
    untouchedIndexSHA:sha(Buffer.from(index.buffer)),matchesIndependentEmitterCompaction:true,fields};
 }finally{
  g.dispose();normal.geometry.dispose();scene.environment.dispose();
  for(const m of new Set([owner.material,normal.material]))if(!Array.isArray(m))m.dispose();
 }
}
const self=pathToFileURL(process.argv[1]??'').href;
if(process.argv[1]&&self===import.meta.url){
 const [tile,ord,profile='standard',output]=process.argv.slice(2);
 if(!tile||!ord||!/^\d+$/.test(ord)||!output){
  console.error('Usage: node --experimental-transform-types tools/qa/scenery-owner-preflight.mjs TILE ORDINAL PROFILE OUTPUT.json');
  process.exitCode=2;
 }else{
  const result=await sceneryOwnerPreflight(metaRoot,tile,Number(ord),profile);
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(`${result.tile}/${result.ordinal}: ${result.originalRoofFaces} roof, ${result.originalFacadeFaces} facade faces; selected ${result.span.join('–')}/${result.wholeVertices}; stock compaction verified.`);
 }
}
