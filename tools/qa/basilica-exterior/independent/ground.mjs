import {Terrain} from '../../../../src/sim/terrain.ts';
import {Cover} from '../../../../src/sim/cover.ts';
import {World} from '../../../../src/render/world.ts';
import {Vegetation} from '../../../../src/render/vegetation.ts';
import {decodeHedgeChunk} from '../../../../src/sim/hedge-stream.ts';
import {loadCoastalSurveys} from '../../../../src/sim/coastal-terrain.ts';
import {loadHarbourCover} from '../../../../src/sim/harbour-cover.ts';
import * as T from 'three';
import {project} from '../../../../src/sim/geo.ts';
import {readFileSync,writeFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import assert from'node:assert/strict';
const [repo,out]=process.argv.slice(2);if(!repo||!out)throw Error('Usage: node ground.mjs REPO OUTPUT.json');
const root=repo+'/public/world/',file=f=>readFileSync(root+f),js=f=>JSON.parse(file(f)),hash=b=>createHash('sha256').update(b).digest('hex'),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const t=js('terrain.json'),c=js('cover.json'),tb=gunzipSync(file(t.file)),cg=file(c.file),cb=gunzipSync(cg);assert.equal(hash(tb),t.sha256);assert.equal(hash(cg),c.compressedSha256);
const url='http://local.invalid/world/',get=async u=>{try{return new Response(file(new URL(u).pathname.slice(7)));}catch{return new Response(null,{status:404});}};
const [sur,hc]=await Promise.all([loadCoastalSurveys(url,get),loadHarbourCover(url,get)]);assert(sur.length>=2&&hc);
const terrain=new Terrain(t,new Int16Array(ab(tb)),sur),cover=new Cover(c.width,c.height,new Uint8Array(ab(cb)),hc,hash(cg),undefined,undefined,hash(cb));
const scene=new T.Scene(),mat=new T.ShaderMaterial({side:T.DoubleSide}),w=Object.assign(Object.create(World.prototype),{scene,terrain,cover,mat,pondMeshes:[],grades:new Map,byId:new Map,reliefActive:new Set,shoreFaces:[]});
const origin=project(-63.125295,46.233718),R=72,p=terrain.uv(origin.x,origin.z),tx=Math.floor(p[0]*32),tz=Math.floor(p[1]*22),dx=(terrain.right-terrain.left)/32,dz=(terrain.bottom-terrain.top)/22,x0=terrain.left+tx*dx,z0=terrain.top+tz*dz;
assert(x0+R<origin.x&&origin.x<x0+dx-R&&z0+R<origin.z&&origin.z<z0+dz-R);
const m=w.patch(x0,z0,dx,dz,112),g=m.geometry,pos=g.getAttribute('position'),ix=g.index,matrix=m.position,crop=[];
for(let n=0;n<ix.count;n+=3){const q=[0,1,2].map(k=>{const i=ix.getX(n+k);return [pos.getX(i)+matrix.x-origin.x,pos.getY(i)+matrix.y,pos.getZ(i)+matrix.z-origin.z]});if([0,2].every(k=>Math.min(...q.map(v=>v[k]))<=R&&Math.max(...q.map(v=>v[k]))>=-R))crop.push(q);}
const v=Object.assign(Object.create(Vegetation.prototype),{t:terrain,cover,roofBits:new Uint32Array(8)}),roots=[];
for(let j=Math.floor((origin.z-R)/192);j<=Math.floor((origin.z+R)/192);j++)for(let i=Math.floor((origin.x-R)/192);i<=Math.floor((origin.x+R)/192);i++){
 const a=v.tile(i,j);for(let k=0;k<a.length;k+=8){const X=a[k]-origin.x,Z=a[k+2]-origin.z;if(Math.hypot(X,Z)<=R)roots.push({type:'originalCanopy',tile:[i,j],slot:k/8,x:X,z:Z,h:a[k+3],w:a[k+4],base:a[k+1]});}}
const hd='woodland/hedgerows-v1/',hcat=js(hd+'index.json'),[W,S,E,N]=hcat.bounds,nw=project(W,N),se=project(E,S),hx=(se.x-nw.x)/32,hz=(se.z-nw.z)/22,hprovider=[];
for(const q of hcat.tiles){let [i,j]=q.id.split('-').map(Number),a=nw.x+i*hx,b=nw.z+j*hz;if(origin.x+R<a||origin.x-R>a+hx||origin.z+R<b||origin.z-R>b+hz)continue;
 const pack=file(hd+hcat.packs[q.pack].file);assert.equal(hash(pack),hcat.packs[q.pack].sha256);const comp=pack.subarray(q.offset,q.offset+q.bytes);const raw=gunzipSync(comp);assert.equal(hash(raw),q.sha256);const xy=decodeHedgeChunk(ab(raw),q.count,a,b);
 hprovider.push([q.id,q.sha256]);for(let n=0;n<xy.length;n+=4){const X=xy[n]-origin.x,Z=xy[n+1]-origin.z;if(Math.hypot(X,Z)<=R)roots.push({type:'hedgeSourceOnly',tile:q.id,slot:n/4,x:X,z:Z,h:xy[n+2],style:xy[n+3]});}}
const P=out;
writeFileSync(P,JSON.stringify({method:'Authentic original Three World.patch with full native near LOD112 stock site at correct world transform. CPU counterpart buffer; compare with mounted native where claiming exact. Seeded original Vegetation.tile class10 source and separately exact HedgeStream candidate catalogue. No actual photographs/point elevations, no claim inferred tree is today observed object. All XY relative to exact old focal model root.',origin,extentM:R,tile:[tx,tz],triangleCount:ix.count/3,positions:hash(Buffer.from(pos.array.buffer)),indices:hash(Buffer.from(ix.array.buffer)),worldCenter:[matrix.x,matrix.y,matrix.z],localRows:crop,hedgeSources:hprovider,rootCount:roots.length,roots,gameBase:terrain.elevation(origin.x,origin.z)+.10,source:{terrain:t.sha256,cover:c.compressedSha256}})+'\n');
console.log({tile:[tx,tz],crop:crop.length,roots:roots.length,rootByType:roots.reduce((o,v)=>(o[v.type]=(o[v.type]||0)+1,o),{}),gameBase:terrain.elevation(origin.x,origin.z)+.1,oldYRange:[Math.min(...crop.flat().map(v=>v[1])),Math.max(...crop.flat().map(v=>v[1]))],pos:hash(Buffer.from(pos.array.buffer))});
