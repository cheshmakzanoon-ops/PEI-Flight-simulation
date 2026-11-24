import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,BufferGeometry,Group,Mesh,Scene,Raycaster,Vector3} from 'three';
import {Buildings} from '../src/render/buildings.ts';
import {PackedBytes} from '../src/sim/packed-bytes.ts';
import {GREEN_GABLES_REVIEW as S} from '../src/render/green-gables-review-spec.ts';
import {GREEN_GABLES_ASSET as A} from '../src/render/green-gables-review-asset.ts';
import {decodeGreenGablesPreview,disposeGreenGablesPreview,loadGreenGablesPreview} from '../src/render/green-gables-review.ts';
const packed=await readFile(new URL('../public/art/'+A.asset,import.meta.url)),plain=gunzipSync(packed);
const ranges=JSON.parse(await readFile(new URL('./fixtures/green-gables-triangle-ranges.json',import.meta.url),'utf8')) as Record<string,[string,number,number]>;
const asArray=(a:Uint8Array)=>Uint8Array.from(a).buffer;
const hash=(a:Uint8Array)=>createHash('sha256').update(a).digest('hex');

test('bounded original Green Gables art preserves actual surveyed roof regions and in-world seat',()=>{
 assert.equal(hash(packed),A.wireSha);assert.equal(hash(plain),A.sha);
 const g=decodeGreenGablesPreview(asArray(plain));assert.ok(g);assert.ok(g.userData.relativeTerrainOffset< -1.60);
 g.updateMatrixWorld(true);let vertices=0,triangles=0;
 for(const p of g.children){
  assert.ok(p instanceof Mesh);const a=p.geometry.getAttribute('position'),b=p.geometry.getAttribute('normal'),u=p.geometry.getAttribute('uv'),i=p.geometry.index;
  assert.ok(i&&a.count===b.count&&b.count===u.count);vertices+=a.count;triangles+=i.count/3;
  for(let j=0;j<i.count;j++)assert.ok(i.getX(j)<a.count);
  for(let j=0;j<a.count;j++)assert.ok(a.getX(j)>=S.maximumXZ[0][0]&&a.getX(j)<=S.maximumXZ[0][1]&&a.getZ(j)>=S.maximumXZ[1][0]&&
   a.getZ(j)<=S.maximumXZ[1][1]&&Number.isFinite(a.getY(j)+b.getY(j)+u.getY(j))&&a.getY(j)>= -1.091);
 }
 assert.equal(vertices,A.vertices);assert.equal(triangles,A.triangles);assert.equal(g.children.length,A.materials.length);
 const [[xx,xz],[zx,zz]]=S.basisXZ,[X,Z]=S.centroidXZ;
 const ray=new Raycaster();
 for(const [x,z,r] of [[6.3,7.1,'main surveyed roof/roof'],[4.7,-4.1,'kitchen surveyed roof/roof'],[9.2,3.2,'public entry vestibule/porchRoof']]){
  const p=new Vector3(X+Number(x)*xx+Number(z)*zx,50,Z+Number(x)*xz+Number(z)*zz);
  ray.set(p,new Vector3(0,-1,0));const [mat,lo,hi]=ranges[String(r)],hit=ray.intersectObject(g,true)[0];
  assert.ok(hit&&hit.object.name===mat&&hit.faceIndex!==undefined&&hit.faceIndex!==null&&hit.faceIndex>=lo&&hit.faceIndex<hi);
 }
 disposeGreenGablesPreview(g);
});

test('identity gzip and host-transcoded exact bytes succeed; corruption and late arrivals stay stock',async()=>{
 for(const body of [packed,plain]){
  const g=await loadGreenGablesPreview('./art/',async url=>{assert.equal(url,'./art/'+A.asset);return new Response(asArray(body));},2000);
  assert.ok(g);disposeGreenGablesPreview(g);
 }
 for(const body of [packed,plain]){
  const q=Buffer.from(body);q[q.length-99]^=4;
  assert.equal(await loadGreenGablesPreview('./art/',async()=>new Response(asArray(q))),undefined);
 }
 assert.equal(await loadGreenGablesPreview('./art/',async()=>new Response('',{status:404})),undefined);
 assert.equal(await loadGreenGablesPreview('./art/',async()=>new Response(asArray(plain.subarray(0,500)))),undefined);
 let signal:AbortSignal|undefined;
 const later=await loadGreenGablesPreview('./art/',async(_url,init)=>{
  signal=init?.signal??undefined;await new Promise(r=>setTimeout(r,30));return new Response(asArray(packed));
 },4);
 assert.equal(later,undefined);assert.ok(signal?.aborted);
});

test('sudden inherited coarse masking keeps the untouched owner draw and recovers atomically',()=>{
 let eligible=true;
 const c=Buildings as unknown as {new(...r:unknown[]):{ greenGables?:unknown;readonly greenGablesPreviewActive:boolean;syncGreenGables():void}};
 const b=new c(new Scene(),{},[],new PackedBytes('./tiles.pack',16),S.pack,undefined,undefined,undefined,undefined,false,()=>eligible);
 const authored=new Group();authored.visible=false;
 const raw=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(18),3));
 const i=new BufferAttribute(new Uint16Array([0,1,2]),1),owner=new Mesh(raw);
 b.greenGables={group:authored,owner,index:i,dispose:()=>{}};
 b.syncGreenGables();assert.equal(raw.index,i);assert.ok(b.greenGablesPreviewActive);
 eligible=false;b.syncGreenGables();assert.equal(raw.index,null);assert.equal(b.greenGablesPreviewActive,false);
 eligible=true;b.syncGreenGables();assert.equal(raw.index,i);assert.ok(b.greenGablesPreviewActive);
 raw.dispose();
});

test('live indexed roof art still intersects all 260 retained classified source cells within the advertised relative band',async()=>{
 const samples=JSON.parse(await readFile(new URL('./fixtures/green-gables-native-heldout.json',import.meta.url),'utf8')) as Record<string,[number,number,number][]>;
 const g=decodeGreenGablesPreview(asArray(plain));assert.ok(g);g.updateMatrixWorld(true);
 const ray=new Raycaster(),[X,Z]=S.centroidXZ,[[xx,xz],[zx,zz]]=S.basisXZ;
 const down=new Vector3(0,-1,0);
 for(const [role,total,maxP90] of [['southMain',192,.165],['northKitchen',68,.232]] as const){
  const e:number[]=[];assert.equal(samples[role].length,total);
  for(const [x,z,observed] of samples[role]){
   ray.set(new Vector3(X+x*xx+z*zx,40,Z+x*xz+z*zz),down);
   const hit=ray.intersectObject(g,true)[0];assert.ok(hit,role+' '+x+' '+z);
   e.push(Math.abs(hit.point.y-(observed-S.sourceCGVD+S.modelSeatY)));
  }
  e.sort((a,b)=>a-b);
  assert.ok(e[Math.round((e.length-1)*.9)]<maxP90,role+': '+e[Math.round((e.length-1)*.9)]);
 }
 disposeGreenGablesPreview(g);
});

test('the low approach sees an actual closed gable soffit without lifting the measured upper roof',()=>{
 const g=decodeGreenGablesPreview(asArray(plain));assert.ok(g);g.updateMatrixWorld(true);
 const eye=g.localToWorld(new Vector3(19.57942226655,3.415,18.35053468992));
 const ray=new Raycaster();
 for(const [y,z] of [[7.60654649,5.11667577],[7.46880847,4.97031767],[7.32969778,4.82250099],[7.13110565,4.62332755],[6.98866557,4.47203284]]){
  ray.set(eye,g.localToWorld(new Vector3(8.48,y,z)).sub(eye).normalize());
  const hit=ray.intersectObject(g,true)[0];assert.ok(hit);assert.equal(hit.object.name,'soffit');
  const point=g.worldToLocal(hit.point.clone());
  assert.ok(point.x>8.48 && point.x<8.82); // wholly under the existing overhang.
 }
 disposeGreenGablesPreview(g);
});
