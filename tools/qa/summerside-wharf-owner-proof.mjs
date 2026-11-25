/** CPU replay of actual current building generator, exact original owner bytes.
 * No candidate edits, rendered pixels, GPU, or new survey inputs. */
import assert from 'node:assert/strict';
import {readFileSync as read,writeFileSync as write} from 'node:fs';
import {gunzipSync as gzip} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [repo,output]=process.argv.slice(2),root=resolve(repo);
const load=f=>import(pathToFileURL(join(root,f)));
const [{Scene,Texture},{Terrain},{Buildings},{project},{SUMMERSIDE_STATION:RAIL},{SPINNAKERS_SHELLS:WHARF},{SPINNAKERS_DECK:DECK},{downtownTilePin}]=await Promise.all(
 ['node_modules/three/build/three.module.js','src/sim/terrain.ts','src/render/buildings.ts','src/sim/geo.ts',
  'src/render/summerside-station/source.generated.ts','src/render/spinnakers-shells.generated.ts','src/render/spinnakers-deck.generated.ts','src/render/summerside-roof-source.ts'].map(load));
const Sha=b=>createHash('sha256').update(b).digest('hex'),readWorld=f=>read(join(root,'public/world',f)),json=f=>JSON.parse(readWorld(f));
const atlas=json('buildings/index.json'),terrain=json('terrain.json'),ground=gzip(readWorld(terrain.file)),data=readWorld('buildings/'+atlas.file);
assert.equal(Sha(data),atlas.sha256);assert.equal(Sha(ground),terrain.sha256);assert.equal(terrain.sha256,RAIL.terrain);
const t=atlas.tiles.find(q=>q.id===RAIL.tile);
const wire=data.subarray(t.offset,t.offset+t.bytes);assert.equal(Sha(wire),t.sha256);assert.equal(t.sha256,RAIL.chunk);assert.equal(t.sha256,WHARF.recordBytesHash);
assert.equal(downtownTilePin(atlas.sha256,t).sha256,RAIL.chunk);
const rows=JSON.parse(gzip(wire)).features;assert.equal(rows.length,399);
const V=new Terrain(terrain,new Int16Array(ground.buffer,ground.byteOffset,ground.byteLength/2));
const O=new Scene();O.environment=new Texture();
const meshPool=new Buildings(O,V,[t],undefined,atlas.sha256);
const tile=meshPool.tiles[0], selected=[163,240,315];
const b64=v=>Buffer.from(v.buffer,v.byteOffset,v.byteLength);
const names=['position','normal','uv','color','topFlag','facadeStyle'];
const attributes=g=>Object.fromEntries(names.map(n=>[n,g.geometry.getAttribute(n)]));
const digests=g=>Object.fromEntries(Object.entries(attributes(g)).map(([k,a])=>[k,Sha(b64(a.array))]));
const digestPieces=(g,index)=>Object.fromEntries(Object.entries(attributes(g)).map(([k,a])=>{
 const f=Buffer.alloc(index.length*a.itemSize*a.array.BYTES_PER_ELEMENT);
 const p=b64(a.array),size=a.itemSize*a.array.BYTES_PER_ELEMENT;
 for(let to=0;to<index.length;to++){const from=index[to];p.copy(f,to*size,from*size,from*size+size);}
 return [k,Sha(f)];
}));
const left=(n,spans)=>{const idx=new Uint32Array(n-spans.reduce((s,[lo,hi])=>s+hi-lo,0));let k=0,j=0;
 for(let v=0;v<n;v++){while(j<spans.length&&v>=spans[j][1])j++;if(j<spans.length&&v>=spans[j][0])continue;idx[k++]=v;}
 assert.equal(k,idx.length);return idx;};
const modes={};
for(const standard of [true,false]){
 if(standard)meshPool.enableSummersideRoofCohort();else meshPool.summersideRoofCohort=false;
 const build=(ordinal,legacyOmit=false,override=rows)=>meshPool.generate(override,tile,legacyOmit,ordinal,false,undefined,standard);
 const base=build(163),geom=base.geometry,count=geom.getAttribute('position').count;
 assert.equal(count,RAIL.vertices+(standard?12:0));assert.deepEqual(base.userData.beaconTriangles,[RAIL.start,RAIL.end]);
 assert.equal(geom.index,null);assert.equal(geom.groups.length,0);assert.deepEqual(Object.keys(geom.attributes).sort(),[...names].sort());
 const map={};
 for(const n of selected){
  const trial=build(n),span=trial.userData.beaconTriangles;
  assert.deepEqual(digests(base),digests(trial));
  assert(span.every(x=>Number.isInteger(x)&&x%3===0)&&span[1]>span[0]&&span[1]<=count);
  assert.equal(Sha(JSON.stringify(rows[n].footprint)).length,64);
  map[n]={span,triangles:(span[1]-span[0])/3,featureSHA:Sha(JSON.stringify(rows[n])), footprintSHA:Sha(JSON.stringify(rows[n].footprint)),
     geography:rows[n].footprint,verticesSHA256:digestPieces(base,Uint32Array.from({length:span[1]-span[0]},(_,i)=>span[0]+i))};
  trial.geometry.dispose();
 }
 const view={};
 for(const [label,exclude]of [['none',[]],['station',[163]],['wharf',[240,315]],['both',selected]]){
  const spans=exclude.map(k=>map[k].span).sort((a,b)=>a[0]-b[0]);assert(spans.every((s,i)=>i===0||s[0]>=spans[i-1][1]));
  const idx=left(count,spans);
  // Verify what legacy compaction retained, independently from index byte slicing.
  const suppressed=new Set(exclude);
  const physicallyMissing=rows.map((f,k)=>suppressed.has(k)?{...f,footprint:[]}:f);
  const compact=build(undefined,false,physicallyMissing),ranges=digestPieces(base,idx);
  assert.equal(compact.geometry.getAttribute('position').count,idx.length);
  assert.deepEqual(ranges,digests(compact));
  view[label]={omittedOrdinals:exclude,idempotentOriginalAttributeSelectionSHA256:ranges,
    canonicalUint32IndicesLeSHA256:Sha(b64(idx)),expectedSubmittedStockOwnerTriangles:idx.length/3,testedSameAsIndependentSourceCompaction:true};
  compact.geometry.dispose();
 }
 const legacy=build(163,true),legacyCount=legacy.geometry.getAttribute('position').count;
 assert.deepEqual(legacy.userData.beaconTriangles,map[163].span);
 assert.notEqual(legacyCount,count);assert.equal(legacyCount,view.wharf.expectedSubmittedStockOwnerTriangles*3);
 modes[standard?'standardWithSignedDowntown':'legacyRoofAndOptionalShadowGeometry']={allVertexCount:count,allTriangleCount:count/3,activeMeasuredDowntownRoofs:base.userData.measuredDowntownRoofs,oldCompactingWharfVertexCount:legacyCount,allAttributeSHA256:digests(base),origin:base.position.toArray(),rows:map,view};
 base.geometry.dispose();legacy.geometry.dispose();
}
const deckWire=readWorld(DECK.asset),deckRaw=gzip(deckWire);assert.equal(Sha(deckRaw),DECK.sha256);
const result={scope:'CPU baseline from current actual Buildings.generate with signed unmodified terrain, entire packed owner and valid Standard/downtown roof cohort. Renderer equivalence must still be checked on native indexed submission, do not mistake CPU geometry digests for optical/GL/device results.',
 atlas:atlas.sha256,railTile:t,sourceWharfAuthoredModels:WHARF.models.length,wharfDeck:{packedBytes:deckWire.length,packedSHA256:Sha(deckWire),decodedSHA256:Sha(deckRaw),decodedBytes:deckRaw.length,sourceDeckTriangles:DECK.triangles}, modes};
write(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(modes).map(([k,v])=>[k,{count:v.allVertexCount,span:Object.fromEntries(Object.entries(v.rows).map(([i,r])=>[i,r.span])),legacyCount:v.oldCompactingWharfVertexCount,measured:v.activeMeasuredDowntownRoofs}]))));
