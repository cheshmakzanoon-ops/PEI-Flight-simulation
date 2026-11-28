import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';

const [repo,planPath,out]=process.argv.slice(2);
const read=p=>readFileSync(resolve(repo,'public/world',p));
const hash=q=>createHash('sha256').update(q).digest('hex');
import {decodeRoads} from '../../../src/render/roads.ts';
import {decodeSidewalks} from '../../../src/render/sidewalks.ts';
import {decodeParkingSurfaces} from '../../../src/render/parking-surfaces.ts';
import {decodeConfederationTrail} from '../../../src/render/confederation-trail.ts';
const pins={roads:'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1',
 sidewalk:'e2dce7c86c4b5cd45ea45fb92ed89c2ae504306e4349e1291e627a669630e384',
 parking:'071f8b599e27afcda8a1924cb152135f342c47756de1667fea28c0fdbb294303',
 trail:'2848f6ba638caaaa7bcd9d355289aa6712e05148a433f57335eaa4d3639da1ab'};
const load=(p,k)=>{const b=gunzipSync(read(p));assert.equal(hash(b),pins[k]);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};
const plan=JSON.parse(readFileSync(planPath));
const boxes=plan.windows.map(v=>{assert(v.worldXZBounds?.length===4&&v.worldXZBounds.every(Number.isFinite));return v.worldXZBounds;});
const d=[];
const wanted=boxes.map(b=>[b[0]-60,b[1]-60,b[2]+60,b[3]+60]);
function near(box){
 return wanted.some(b=>box[0]<=b[2]&&box[1]<=b[3]&&box[2]>=b[0]&&box[3]>=b[1]);
}
const box=pp=>pp.reduce(([x,z,X,Z],[a,b])=>[Math.min(x,a),Math.min(z,b),Math.max(X,a),Math.max(Z,b)],[Infinity,Infinity,-Infinity,-Infinity]);
function lines(fs,cat,w,id){
 const p=fs.map(q=>[q.x,q.z]);
 for(let i=1;i<p.length;i++){
  const s=[p[i-1],p[i]],a=box(s);
  if(near(a))d.push({kind:'line',category:cat,id:id+'/'+(i-1),width:w,p:s});
 }
}
for(const [i,r] of decodeRoads(load('roads.bin.gz','roads')).entries())
 lines(r.points,'road',[2,2.8,3.6,4.8,6.4][r.flags&7]??8,i);
for(const T of decodeSidewalks(load('pedestrian/odbl/v1/sidewalks.bin.gz','sidewalk'))) {
 if(!near(T.box))continue;
 T.paths.forEach((q,i)=>lines(q.points,'sidewalk',q.width,T.id+'/'+i));
}
for(const T of decodeConfederationTrail(load('trails/odbl/v1/confederation-main.bin.gz','trail')).values()){
 if(!near(T.box))continue;
 T.paths.forEach(q=>lines(q.cuts,'trail',Math.max(...q.cuts.map(a=>Math.hypot(a.wX,a.wZ))),q.way));
}
for(const T of decodeParkingSurfaces(load('ground/odbl/v1/parking-surfaces.bin.gz','parking'))) {
 if(!near(T.box))continue;
 for(const [i,[_,core,rim]] of T.lots.entries())for(const poly of [...core,...rim]){
  const ring=poly[0].map(([x,z])=>[x*.001+T.ox,z*.001+T.oz]);
  const a=box(ring);
  if(near(a))d.push({kind:'area',category:'parking',id:T.id+'/'+i,p:ring,box:a});
 }
}
const atlasRaw=read('buildings/index.json');
assert.equal(hash(atlasRaw),'fcc2bb4d890eafd08ac41136a3bff7bebeafe2f9c25a066fdcf756ed39badce0');
const atlas=JSON.parse(atlasRaw),full=read('buildings/'+atlas.file);
assert.equal(hash(full),'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557');
const chunks=[];
const xz=(lon,lat)=>[(lon+63.2)*76762.59317717304,(46.5-lat)*111161.08375388647];
for(const c of atlas.tiles){
 const [left,bottom,right,top]=c.bounds,b=[...xz(left,top),...xz(right,bottom)];
 if(!near(b))continue;
 const wire=full.subarray(c.offset,c.offset+c.bytes);
 assert.equal(hash(wire),c.sha256);chunks.push([c.id,c.sha256]);
 const f=JSON.parse(gunzipSync(wire)).features;assert.equal(f.length,c.count);
 for(const [i,m] of f.entries()){
   const p=m.footprint.map(a=>xz(...a)),b=box(p);
   if(near(b))d.push({kind:'area',category:'building',id:c.id+'/'+i,p,box:b});
 }
}
writeFileSync(out,JSON.stringify({pins,boxes,storageExtraGuardM:60,buildingChunks:chunks,localActors:d},null,2)+'\n',{flag:'wx'});
