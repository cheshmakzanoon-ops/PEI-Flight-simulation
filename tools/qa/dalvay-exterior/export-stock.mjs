/** Export only the original rendered q12203/71 triangle span for negative-space pixel checks.
 * Usage: node --experimental-strip-types tools/qa/dalvay-exterior/export-stock.mjs OUT [CHECKOUT]
 */
import {readFileSync as R,writeFileSync as W,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
const root=resolve(process.argv[3]??fileURLToPath(new URL('../../..',import.meta.url))),out=resolve(process.argv[2]??'/tmp/dalvay-stock-render');mkdirSync(out,{recursive:true});
const load=k=>import(pathToFileURL(join(root,k))),read=k=>R(join(root,'public/world',k)),sha=b=>createHash('sha256').update(b).digest('hex');
const {Terrain}=await load('src/sim/terrain.ts'),{DALVAY,dalvayOwner,dalvaySource}=await load('src/render/dalvay-exterior-seat.ts'),{Buildings}=await load('src/render/buildings.ts');
const {Scene}=await load('node_modules/three/build/three.module.js'),spec=JSON.parse(read('terrain.json')),h=gunzipSync(read(spec.file)),t=new Terrain(spec,new Int16Array(h.buffer,h.byteOffset,h.byteLength/2)),idx=JSON.parse(read('buildings/index.json')),tile=idx.tiles.find(k=>k.id===DALVAY.id);
if(!dalvayOwner(idx.sha256,tile))throw Error('Not the authenticated tile');
const src=read('buildings/'+idx.file).subarray(tile.offset,tile.offset+tile.bytes),row=JSON.parse(gunzipSync(src).toString()).features,sc=new Scene(),b=new Buildings(sc,t,[tile],{},idx.sha256),owner=b.generate(row,b.tiles[0],false,DALVAY.ordinal);
sc.add(owner);sc.updateMatrixWorld(true);if(!await dalvaySource(src.buffer.slice(src.byteOffset,src.byteOffset+src.byteLength),row.length,row[DALVAY.ordinal],owner))throw Error('Original submitted mesh/attributes do not match');
const [first,end]=owner.userData.beaconTriangles,pos=owner.geometry.getAttribute('position'),p=pos.array.subarray(first*pos.itemSize,end*pos.itemSize),bytes=Buffer.from(p.buffer,p.byteOffset,p.byteLength);
W(join(out,'stock-position.f32'),bytes);W(join(out,'stock.json'),JSON.stringify({tile:tile.id,ordinal:DALVAY.ordinal,sourceChunk:sha(src),vertices:[first,end],triangles:(end-first)/3,stockMatrix:owner.matrixWorld.toArray(),float32Position:sha(bytes)},null,2)+'\n');
console.log(out,tile.id,DALVAY.ordinal,(end-first)/3,sha(bytes));owner.geometry.dispose();owner.removeFromParent();
