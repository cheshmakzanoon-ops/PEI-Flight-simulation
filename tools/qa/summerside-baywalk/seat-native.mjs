// Reproduce the audited detached cap and its wet edge from the observed native tile.
// This tool never activates scenery or derives a flight-contact surface.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync as read,writeFileSync as write} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {gunzipSync as gz} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Terrain,OCEAN_Y} from '../../../src/sim/terrain.ts';
import {Cover} from '../../../src/sim/cover.ts';
import {facet,GROUND_LIFT} from '../../../src/sim/coastal-terrain.ts';
import {BaywalkNative,BAYWALK_COVER_DECODED_SHA} from '../../../src/sim/baywalk-native.ts';
import {BAYWALK_COURT as C} from '../../../src/sim/baywalk-native.generated.ts';

assert.ok(process.argv.length===4||process.argv.length===5,
 'Usage: seat-native.mjs <inward-plan-dir> <new-output-dir> [native-replay-dir]');
const [D,out,O]=process.argv.slice(2).map(p=>resolve(p));
assert.ok(!existsSync(out),'Use a new output directory to retain earlier evidence.');
const root=fileURLToPath(new URL('../../../',import.meta.url)),file=s=>read(root+'public/world/'+s);
const sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(read(p,'utf8'));
const bytes=(file,sha256,n)=>{const b=read(file);assert.equal(b.length,n);assert.equal(sha(b),sha256);return b;};
const unpack=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);

// Use the literal browser-reported origin; do not recalculate it in Node.
const base='4cc5d89cec2a3f719f1dd723308c3cd8a6e3728e';
const [ox,oy,oz]=[-45697.731250785546,0,12429.830274298314];
let witness;
if(O){
 const q=json(resolve(O,'baseline.json')),row=q.rows?.['315'],own=row?.localTile?.owner;
 assert.equal(q.base,base);assert.equal(row.samples,4);
 assert.equal(row.localTile.lod,112);assert.equal(own.subdiv,112);
 assert.equal(own.visible,true);assert.equal(row.normalWharf,true);assert.equal(row.roads,true);
 assert.deepEqual(own.objectPosition,[ox,oy,oz]);
 assert.deepEqual(own.matrix,[1,0,0,0,0,1,0,0,0,0,1,0,ox,oy,oz,1]);
 witness=row.rawWitness;
}
const owners={
 landPosition:['a239d9b7786b54879d0f4ac1cebd7167711594dbb3003f25bd41fe3b2470eb66',153228,'Float32Array'],
 landUV:['e2408590fda91a4b292541a9798ebaadc8d77723202152245fe8c57eb83baf81',102152,'Float32Array'],
 landIndex:['33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa',150528,'Uint16Array'],
};
const snapshot=O?undefined:gz(bytes(new URL('./fixtures/n112-native-f315.gz',import.meta.url),
 'f8ac7ebcd106ab06b7ea34672c0b59deaf11f53c9e8f8bcece0eb0656e68355e',150461));
const ownerLength=Object.values(owners).reduce((total,v)=>total+v[1],0);
if(snapshot)assert.equal(snapshot.length,ownerLength);
let cursor=0;
function observed(key){
 const [hash,n,type]=owners[key];
 if(snapshot){
  const part=snapshot.subarray(cursor,cursor+n);cursor+=n;
  assert.equal(sha(part),hash);
  return unpack(part);
 }
 assert.deepEqual(witness[key],{sha:hash,bytes:n,encoding:type});
 return unpack(bytes(resolve(O,hash+'.typedle'),hash,n));
}
const xyz=new Float32Array(observed('landPosition'));
observed('landUV'); // File custody, not an assertion about optical UV coverage.
const ix=new Uint16Array(observed('landIndex')),N=112,L=N+1;
for(let z=0;z<N;z++)for(let x=0;x<N;x++){
 const k=z*L+x,j=(z*N+x)*6;
 assert.deepEqual([...ix.subarray(j,j+6)],[k,k+L,k+1,k+L,k+L+1,k+1]);
}
const planWires={
 'xz.f64le':['32094c7d2229a320c989658634c97a2b2fb29af06aedcc3d4538bef8a71ef9c4',467648],
 'faces.u32le':['9cbdea9673be2c21b00a10d28b9d7e38e2803a17d3671078b823a3eb9b0d3985',685428],
 'ring.u32le':['83c45763db0ed2c24a984d392cd5e64db7d55ff358a3489fd2ff6a83893d8913',5340],
 'ring-role.u8':['502d55f9ece68a674e4cfd7a6851b6981882b0be079749fc897c36ac079d2be5',1335],
};
const plan=tag=>unpack(bytes(resolve(D,'inward-plan.json.'+tag),...planWires[tag]));
const points=new Float64Array(plan('xz.f64le')),topFaces=new Uint32Array(plan('faces.u32le'));
const ring=new Uint32Array(plan('ring.u32le')),role=new Uint8Array(plan('ring-role.u8'));

function between(v,axis){
 const val=k=>axis===0?xyz[3*k]:xyz[3*k*L+2];
 assert.ok(v>=val(0)&&v<=val(N));let a=0,b=N;
 while(b-a>1){const m=(a+b)>>1;if(v<val(m))b=m;else a=m;}
 return [a,(v-val(a))/(val(a+1)-val(a))];
}
function parent(x,z){
 const [a,u]=between(x-ox,0),[b,v]=between(z-oz,2),k=(b*L+a)*3+1;
 return facet(u,v,xyz[k],xyz[k+3],xyz[k+3*L],xyz[k+3*L+3]);
}

const manifest=file('terrain.json');
assert.equal(sha(manifest),'77c9417c6bd4f4286ea4ca86a4625be30f779f33272dd7a8a4af13e001de7e98');
const ts=JSON.parse(manifest),t=gz(file(ts.file)),c=gz(file('cover.bin.gz')),co=gz(file(C.asset));
assert.equal(sha(t),C.pinTerrainSha);assert.equal(sha(c),BAYWALK_COVER_DECODED_SHA);assert.equal(sha(co),C.sha256);
const size=C.width*C.height,T=new Terrain(ts,new Int16Array(unpack(t))),land=new Cover(ts.width,ts.height,c);
const court=new BaywalkNative({shore:co.subarray(20,20+size),y:new Int16Array(unpack(co.subarray(20+size)))});
const {x0,z0,step,width,height,data}=court,packed=new Float32Array(points.length*3/2);
const h=new Float32Array(width*height);
for(let j=0;j<height;j++)for(let i=0;i<width;i++){
 const k=j*width+i,x=x0+step*i,z=z0+step*j,y=data.y[k]*.01+GROUND_LIFT;
 const prev=land.legacyDistance(T,x,z),r=Math.min(1,Math.max(0,-prev/4.8)),a=1-r*r*(3-2*r);
 h[k]=a?a*parent(x,z)+(1-a)*y:y;
}
for(let i=0;i<points.length;i+=2){
 const u=(points[i]-x0)/step,v=(points[i+1]-z0)/step,a=Math.floor(u),b=Math.floor(v),k=b*width+a;
 const Y=facet(u-a,v-b,h[k],h[k+1],h[k+width],h[k+width+1]);
 assert.ok(Number.isFinite(Y)&&Y>OCEAN_Y,'seated top must be finite and above fixed sea');
 packed.set([points[i]-x0,Y,points[i+1]-z0],3*(i/2));
}

const topUses=new Map(),ringEdges=new Map();
const k=(a,b)=>a<b?a+','+b:b+','+a;
for(let j=0;j<ring.length;j++){
 const a=ring[j],b=ring[(j+1)%ring.length];
 assert.ok(role[j]===1||role[j]===2);
 ringEdges.set(k(a,b),{a,b,role:role[j]});
}
for(let i=0;i<topFaces.length;i+=3)for(let j=0;j<3;j++){
 const a=topFaces[i+j],b=topFaces[i+(j+1)%3];
 if(!ringEdges.has(k(a,b)))continue;
 assert.ok(!topUses.has(k(a,b)));topUses.set(k(a,b),{a,b});
}
assert.equal(topUses.size,ring.length);
const lowerBase=packed.length/3,lower=new Map(),verts=[],outIdx=[];
const bottomBottom=Math.fround(OCEAN_Y-.12); // rendering skirt, not measured bathymetry.
const bottom=i=>{
 const prior=lower.get(i);if(prior!==undefined)return prior;
 const id=lowerBase+verts.length/3;lower.set(i,id);verts.push(packed[i*3],bottomBottom,packed[i*3+2]);return id;
};
let least=Infinity,longest=0,total=0,excluded=0;
for(const [key,edge] of ringEdges){
 if(edge.role===2){excluded++;continue;}
 const {a,b}=topUses.get(key),A=bottom(a),B=bottom(b);
 assert.ok(packed[3*a+1]>OCEAN_Y&&packed[3*b+1]>OCEAN_Y);
 // Opposite to the upward cap's directed boundary. Every exact wet
 // top edge is borrowed unchanged from the cap; cap and rim never resample Y.
 outIdx.push(b,a,A,b,A,B);
 const l=Math.hypot(packed[a*3]-packed[b*3],packed[a*3+2]-packed[b*3+2]);assert.ok(l>0);
 total+=l;longest=Math.max(longest,l);least=Math.min(least,l);
}
const xyzRim=Buffer.alloc(verts.length*4),idx=Buffer.alloc(outIdx.length*4);
verts.forEach((x,i)=>xyzRim.writeFloatLE(x,i*4));outIdx.forEach((x,i)=>idx.writeUInt32LE(x,i*4));
const cap=Buffer.alloc(packed.length*4);
packed.forEach((v,i)=>cap.writeFloatLE(v,i*4));
const products={
 'cap.xyz.f32le':[cap,'3440009959d93a95a9267f5d907e3e49636903ded681d07e82bbcaf727e144f2'],
 'wet-rim-only.xyz.f32le':[xyzRim,'8157d2d0a1e66d7c167f16319a648bc3d586da6ae869d899838c3ab8606e8cf6'],
 'wet-rim-with-cap.u32le':[idx,'3093e78729af5ba188cbde362b62c02ed57daa6958c63a40c4321fae093d5fa4'],
};
const report={scope:'Detached cap and wet-side rim only. No dry-side closure, elevation survey, runtime mounting or flight-contact proof.',
 base,frame:315,receiver:{position:owners.landPosition[0],uv:owners.landUV[0],index:owners.landIndex[0]},stockOrigin:[ox,oy,oz],capOrigin:[x0,0,z0],capVertices:packed.length/3,
 wetEdges:outIdx.length/6,wetTriangles:outIdx.length/3,wetVertices:lower.size,skippedDryEdges:excluded,
 wetLengthM:total,wetEdgeLengthRangeM:[least,longest],oceanY:OCEAN_Y,rimBaseY:bottomBottom,assets:{}};
assert.equal(report.wetVertices,report.wetEdges+1);
for(const [k,[b,expected]] of Object.entries(products)){
 assert.equal(sha(b),expected,k+' differs from the audited native result');
 report.assets[k]={sha256:expected,bytes:b.length};
}
mkdirSync(out);
for(const [k,[b]] of Object.entries(products))write(resolve(out,k),b,{flag:'wx'});
write(resolve(out,'seated-rim.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(report);
