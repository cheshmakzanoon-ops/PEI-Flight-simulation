import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Mesh,Raycaster,Vector3} from 'three';
import {BEACON_ASSET as A} from '../src/render/beaconsfield-review-asset.ts';
import {BEACON_REVIEW as S} from '../src/render/beaconsfield-review-spec.ts';
import {decodeBeaconsfieldPreview,disposeBeaconsfieldPreview,loadBeaconsfieldPreview} from '../src/render/beaconsfield-review.ts';
const path=new URL('../public/art/'+A.file,import.meta.url), packed=await readFile(path), raw=gunzipSync(packed);
const ab=(b:Uint8Array)=>Uint8Array.from(b).buffer;
const good=()=>new Response(ab(packed),{status:200});
const ordered=[...S.ringXZ].map(([x,z])=>[x,z]);
const inside=(x:number,z:number)=>ordered.reduce((v,[a,b],i)=>{
 const [c,d]=ordered[(i+1)%ordered.length];
 return ((b>z)!==(d>z))&&x<a+(c-a)*(z-b)/(d-b)?!v:v;
},false);

test('lossless Beaconsfield exterior asset matches each version and has only finite in-plan vertices',()=>{
 const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(digest(packed),A.compressedSha256);assert.equal(digest(raw),A.decodedSha256);
 const model=decodeBeaconsfieldPreview(ab(raw));assert.ok(model);
 assert.equal(model.children.length,A.batches);assert.equal(model.userData.triangles,A.triangles);
 assert.equal(model.userData.absoluteBase,S.floorCGVD);
 model.updateMatrixWorld(true);
 let points=0,drawn=0;
 for(const item of model.children){
  assert.ok(item instanceof Mesh);
  const geom=item.geometry,p=geom.getAttribute('position'),n=geom.getAttribute('normal'),uv=geom.getAttribute('uv'),idx=geom.index;
  assert.ok(idx);assert.ok(p.count===n.count&&p.count===uv.count);
  points+=p.count;drawn+=idx.count/3;
  for(let i=0;i<idx.count;i++)assert.ok(idx.getX(i)<p.count);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert.ok(Number.isFinite(x+y+z)&&inside(x,z));
   assert.ok(y>=-1.20001&&y<17.2);
  }
 }
 assert.equal(points,A.uniqueVertices);assert.equal(drawn,A.triangles);
 const [a,b]=S.basisXZ,[x,z]=S.centroidXZ;
 // Near the physical fitted north and east eaves, not the nominal smaller
 // rectangular plan: pin actual relief rather than the plane extrapolation.
 const ray=new Raycaster();
 for(const [lx,lz,expected] of [[-1.839153,-.842887,14.395992],[-1.026601,-.988949,14.294861],[1.561062,1.44048,14.371196]]){
  ray.set(new Vector3(x+a[0]*lx+b[0]*lz,28,z+a[1]*lx+b[1]*lz),new Vector3(0,-1,0));
  const h=ray.intersectObject(model,true)[0];
  assert.ok(h?.object.name==='slate'&&Math.abs(h.point.y-S.floorCGVD-expected)<.002);
 }
 disposeBeaconsfieldPreview(model);
});

test('invalid Beaconsfield directory and exact-length network damage cannot activate the replacement',async()=>{
 const malformed=ab(raw);
 new DataView(malformed).setUint16(16,999,true);
 assert.equal(decodeBeaconsfieldPreview(malformed),undefined);
 const changed=Buffer.from(packed);changed[changed.length-6]^=16;
 const req:typeof fetch=async()=>new Response(ab(changed));
 assert.equal(await loadBeaconsfieldPreview('./art/',req,100),undefined);
 assert.equal(await loadBeaconsfieldPreview('./art/',async()=>new Response('',{status:404}),100),undefined);
 assert.equal(await loadBeaconsfieldPreview('./art/',async()=>new Response(ab(packed.subarray(0,500))),100),undefined);
 let signal:AbortSignal|undefined;
 const late:typeof fetch=async(_url,init)=>{
  signal=init?.signal??undefined;await new Promise(resolve=>setTimeout(resolve,35));return good();
 };
 assert.equal(await loadBeaconsfieldPreview('./art/',late,8),undefined);
 assert.ok(signal?.aborted);
 const served=await loadBeaconsfieldPreview('./art/',async()=>new Response(ab(raw),{headers:{'Content-Encoding':'gzip'}}),500);
 assert.ok(served);disposeBeaconsfieldPreview(served);
 const rawDamaged=Buffer.from(raw);rawDamaged[rawDamaged.length-16]^=4;
 assert.equal(await loadBeaconsfieldPreview('./art/',async()=>new Response(ab(rawDamaged)),500),undefined);
 const model=await loadBeaconsfieldPreview('./art/',async(input,init)=>{assert.equal(input,'./art/'+A.file);assert.ok(!init?.signal?.aborted);return good();},500);
 assert.ok(model);assert.equal(model.userData.vertices,A.uniqueVertices);disposeBeaconsfieldPreview(model);
});
