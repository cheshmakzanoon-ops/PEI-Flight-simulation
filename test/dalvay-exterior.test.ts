import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync as R} from 'node:fs';import {gunzipSync as unzip} from 'node:zlib';import {createHash} from 'node:crypto';
import * as T from 'three';import {DALVAY,dalvayOwner,dalvaySource,dalvayGroundPair} from '../src/render/dalvay-exterior-seat.ts';
import {dalvayExteriorRequested,seacowExteriorRequested,standardSourisShoreline} from '../src/app/scenery-profile.ts';
import {DALVAY_PACKET as A} from '../src/render/dalvay-manor.generated.ts';import {decodeDalvay,loadDalvay} from '../src/render/dalvay-art-packet.ts';
import {DalvaySocket} from '../src/render/dalvay-exterior-socket.ts';import {Buildings} from '../src/render/buildings.ts';import{Terrain}from'../src/sim/terrain.ts';
import{makeDalvayExterior}from'../src/render/dalvay-exterior-art.ts';import{regularRoadGround}from'../src/render/road-contact.ts';
const ab=(b:Buffer)=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),
 j=(f:string)=>JSON.parse(R('public/world/'+f,'utf8')),spec=j('terrain.json'),terrain=new Terrain(spec,new Int16Array(ab(unzip(R('public/world/'+spec.file))))),idx=j('buildings/index.json'),tile=idx.tiles.find((t:any)=>t.id===DALVAY.id),rw=R('public/world/buildings/'+idx.file).subarray(tile.offset,tile.offset+tile.bytes),rows=JSON.parse(unzip(rw).toString()).features;
const pack=R('public/art/'+A.file),raw=unzip(pack),decoded=()=>decodeDalvay(ab(raw))!;
const ctx=()=>{const s=new T.Scene(),B:any=new (Buildings as any)(s,terrain,[tile],{},idx.sha256),m=B.generate(rows,B.tiles[0],false,71);s.add(m);return {s,m,raw:ab(rw)};};
const wait=async(p:()=>boolean)=>{for(let j=0;j<100&&!p();j++)await new Promise(r=>setTimeout(r,5));assert(p());};
test('Dalvay explicit selection is independent and unavailable to unknown or relief profiles',()=>{
 for(const [s,answer] of [['',false],['stockDalvayExterior',false],['dalvayExteriorStudy',true],['dalvayExteriorStudy&scenery=standard&qa',true],['dalvayExteriorStudy&stockDalvayExterior',false],['dalvayExteriorStudy&scenery=detail',false],['dalvayExteriorStudy&scenery=standard&scenery=detail',false],['dalvayExteriorStudy&relief',false]] as const)assert.equal(dalvayExteriorRequested(new URLSearchParams(s)),answer,s);
 assert(standardSourisShoreline(new URLSearchParams('dalvayExteriorStudy')));assert(seacowExteriorRequested(new URLSearchParams('seacowExteriorStudy&stockDalvayExterior')));
 assert(dalvayOwner(idx.sha256,tile));assert(!dalvayOwner(idx.sha256,{...tile,count:241}));assert(!dalvayOwner(idx.sha256,{...tile,bounds:[0,0,0,0]}));
 const fine=()=>({lod:112,local:{},fine:{visible:true,geometry:{index:{count:112*112*6},getAttribute:()=>({count:113*113})},userData:{},parent:{},material:null as any}});
 const a=fine(),b=fine();a.fine.material=a.local;b.fine.material=b.local;
 assert(dalvayGroundPair(a,b,false));b.lod=56;assert(!dalvayGroundPair(a,b,false));b.lod=112;a.fine.material={};assert(!dalvayGroundPair(a,b,false));
});
test('authentic raw owner, all 241 siblings and original span are pinned',async()=>{
 const q=ctx();assert(await dalvaySource(q.raw,rows.length,rows[71],q.m));assert(!await dalvaySource(q.raw,rows.length,rows[205],q.m));
 const uv=q.m.geometry.getAttribute('uv'),prior=uv.array[10];uv.array[10]+=1;assert(!await dalvaySource(q.raw,rows.length,rows[71],q.m));uv.array[10]=prior;
 assert.deepEqual(q.m.userData.beaconTriangles,[4533,4644]);q.m.geometry.getAttribute('position').array[0]+=.2;assert(!await dalvaySource(q.raw,rows.length,rows[71],q.m));
 const wrong=Buffer.from(rw);wrong[19]^=1;assert(!await dalvaySource(ab(wrong),rows.length,rows[71],q.m));
});
test('lossless authored 5-batch packet equals all original positions, normals, colors and UVs without procedural geometry at mount',()=>{
 assert.equal(sha(pack),A.wireHash);assert.equal(sha(raw),A.rawHash);const live=decoded(),expected=makeDalvayExterior(regularRoadGround(terrain));
 assert(live.intact());assert.equal(live.group.children.length,5);assert.deepEqual(live.group.position.toArray(),expected.group.position.toArray());let triangles=0;
 for(const [i,m] of (live.group.children as T.Mesh[]).entries()){
  const orig=(expected.group.children[i] as T.Mesh).geometry,index=m.geometry.index!;triangles+=index.count/3;
  for(const [key,a] of Object.entries(m.geometry.attributes)){const e=orig.getAttribute(key),size=a.itemSize;assert.equal(e.count,index.count);
    for(let j=0;j<index.count;j++){const k=index.getX(j);for(let n=0;n<size;n++)assert(Object.is(a.array[k*size+n],e.array[j*size+n]),key);}
  }
 }
 assert.equal(triangles,24853);assert(expected.group.userData.dalvayGeometry.groundFeatures.length>=45);live.dispose();expected.dispose();
});
test('network denial, timeout-style abort, malformed and oversized wire remain fail-closed',async()=>{
 const safe=new AbortController();for(const [code,b] of [[404,Buffer.alloc(0)],[200,Buffer.from(pack).fill(0,125,130)],[200,Buffer.concat([pack,Buffer.from([1])])],[200,Buffer.alloc(16)]]as const){
  const get=async()=>new Response(ab(b),{status:code});assert.equal(await loadDalvay('/x/',safe.signal,get),undefined);
 }
 const art=await loadDalvay('/x/',safe.signal,async()=>new Response(ab(pack)));assert(art?.intact());art.dispose();
 const off=new AbortController();off.abort();assert.equal(await loadDalvay('/x/',off.signal,async()=>new Response(ab(pack))),undefined);
});
test('socket activation and rollback never replace the other original submissions; foreign children and late load cannot steal a lease',async()=>{
 const c=ctx(),stock=c.m.geometry;let present=false,count=0;const seat={resident:()=>present,verifiedCover:async()=>true};
 const socket=new DalvaySocket(c.s,c.m,c.raw,rows.length,rows[71],seat,async()=>{count++;return decoded();});socket.sync();assert.equal(count,0);assert(!socket.active);
 present=true;socket.sync();await wait(()=>socket.active);assert.equal(count,1);assert.equal(c.s.children.length,2);const resolved=c.m.geometry,i=resolved.index;
 assert.equal(i.count,13608-111);for(let k=0;k<i.count;k++)assert.equal(i.getX(k),k<4533?k:k+111);
 for(const [k,v] of Object.entries(stock.attributes))assert.equal(resolved.getAttribute(k),v);
 c.m.position.x+=.125;socket.sync();assert(!socket.active);assert.equal(c.m.geometry,stock);c.m.position.x-=.125;socket.sync();assert(socket.active);
 const old=stock.getAttribute('color');stock.setAttribute('color',old.clone());socket.sync();assert(!socket.active);assert.equal(c.m.geometry,stock);stock.setAttribute('color',old);socket.sync();assert(socket.active);
 const art=c.s.children.find(q=>q!==c.m) as T.Group,bar=art.children[2] as T.Mesh,mat=bar.material,foreign=new T.MeshBasicMaterial();
 bar.material=foreign;socket.sync();assert(!socket.active);assert(!art.visible);assert.equal(c.m.geometry,stock);bar.material=mat;socket.sync();assert(socket.active);
 present=false;socket.sync();assert(!socket.active);assert.equal(c.m.geometry,stock);present=true;socket.sync();assert(socket.active);assert.equal(count,1);
 c.s.overrideMaterial=foreign;socket.sync();assert(!socket.active);assert.equal(c.m.geometry,stock);c.s.overrideMaterial=null;socket.sync();assert(socket.active);
 socket.dispose();assert(!socket.active);assert.equal(c.s.children.length,1);assert.equal(c.m.geometry,stock);foreign.dispose();
 const c2=ctx();let finish:((v:ReturnType<typeof decoded>)=>void)|undefined;const late=new DalvaySocket(c2.s,c2.m,c2.raw,rows.length,rows[71],seat,async()=>new Promise(r=>{finish=r;}));late.sync();await wait(()=>!!finish);late.dispose();finish!(decoded());await new Promise(r=>setTimeout(r,3));assert(!late.active);assert.equal(c2.s.children.length,1);assert.equal(c2.m.geometry.index,null);
});

test('one joined cross-roof and physically curved dining room share the same accepted old plan',()=>{
 const a=makeDalvayExterior(regularRoadGround(terrain)),proof=a.group.userData.dalvayGeometry;
 const gs=proof.roofForms.filter((r:{role:string})=>r.role.startsWith('lakeside outward broad cross-gable'));
 assert.equal(gs.length,2);assert(gs.every((g:any)=>g.axis==='v'&&g.ridge[1][2]-g.ridge[0][2]>5&&g.eaves[1][0]-g.eaves[0][0]>8));
 const emitted=proof.roofTriangleRanges as {role:string,firstTriangle:number,triangles:number}[];
 assert(gs.every((g:any)=>emitted.some(r=>r.role===g.role&&r.triangles>0)));assert(emitted.some(r=>r.role==='lakeside low continuous multi-sash shed dormer'));
 assert(emitted.filter(r=>r.role==='continuous curved dining-room low roof').length>=16);
 const rows=proof.groundFeatures.filter((g:{role:string})=>g.role.startsWith('rounded dining-room plinth'));
 const p=(a.group.children[0] as T.Mesh).geometry.getAttribute('position');let total=0;const d=rows.map((g:any)=>{const [i,j]=g.lowerVertices,v=new T.Vector2(p.getX(j)-p.getX(i),p.getZ(j)-p.getZ(i));assert(v.length()>.55&&v.length()<2);total+=v.length();return v.normalize();});
 assert.equal(rows.length,27);assert(total>32);assert(d[0].angleTo(d.at(-1))>1.1);
 const signatures=proof.architecturalFeatures as {role:string,parts:Record<string,[number,number]>}[];
 const entry=signatures.find(x=>x.role.startsWith('recessed paired green entry'));assert(entry&&entry.parts.glazing[1]>=7&&entry.parts.joinery[1]>120);
 const round=signatures.find(x=>x.role.startsWith('continuous curved sandstone'));assert(round&&round.parts.masonry[1]>80&&round.parts.glazing[1]>=54);
 a.dispose();
});
