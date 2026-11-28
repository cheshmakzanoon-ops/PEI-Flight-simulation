import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {PlaneGeometry} from 'three';
const url=f=>new URL('../../../../'+f,import.meta.url);
const read=f=>readFileSync(url('public/world/'+f));
const data=f=>readFileSync(url('data/inland-focal-scout/'+f));
const sha=b=>createHash('sha256').update(b).digest('hex');
const [T,C,G,F,Trail,Stamp,E,Hedge]=await Promise.all([
 'src/sim/terrain.ts','src/sim/cover.ts','src/sim/geo.ts','src/sim/coastal-terrain.ts',
 'src/render/confederation-trail.ts','src/render/confederation-trail.generated.ts',
 'tools/art/north-cape-lighthouse/grade/north-cape-grade-exclusions.mjs','src/sim/hedge-stream.ts'
].map(f=>import(url(f))));
const tSpec=JSON.parse(read('terrain.json')),cSpec=JSON.parse(read('cover.json'));
const dem=gunzipSync(read(tSpec.file)),cov=gunzipSync(read(cSpec.file));
assert.equal(sha(dem),'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
assert.equal(sha(cov),'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
const ab=a=>a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength);
const t=new T.Terrain(tSpec,new Int16Array(ab(dem))),c=new C.Cover(cSpec.width,cSpec.height,cov);
const intake=JSON.parse(data('intake.json')),s=intake.windows.find(w=>w.route==='hunter-river-trail'),D=intake.width,N=112,A=N+1;
const sample=gunzipSync(data(s.file));
assert.equal(sha(sample),s.publishedInt16Sha256);
const native=new Int16Array(ab(sample)),[e,,,n]=s.geoTransform;
const job=spawnSync('gdaltransform',['-s_srs','EPSG:3979','-t_srs','EPSG:4326'],{
  input:Array.from({length:native.length},(_,i)=>[e+i%D+.5,n-Math.floor(i/D)-.5].join(' ')).join('\n')+'\n',
  encoding:'utf8',maxBuffer:20*1024*1024,env:{...process.env,LC_ALL:'C',PROJ_NETWORK:'OFF'},
});
assert.equal(job.status,0,job.stderr);
const coords=job.stdout.trim().split('\n').map(row=>G.project(...row.split(/\s+/).slice(0,2).map(Number)));
const W=(t.right-t.left)/32,H=(t.bottom-t.top)/22,tx=t.left+14.5*W,tz=t.top+14.5*H;
const plane=new PlaneGeometry(W,H,N,N).rotateX(-Math.PI/2),pos=plane.attributes.position;
for(let k=0;k<pos.count;k++){
 const x=pos.getX(k)+tx,z=pos.getZ(k)+tz;pos.setY(k,t.atlasElevation(x,z)+F.GROUND_LIFT);
 plane.attributes.uv.setXY(k,...t.uv(x,z));
}
const X=Float64Array.from({length:A},(_,i)=>pos.getX(i)+tx);
const Z=Float64Array.from({length:A},(_,j)=>pos.getZ(j*A)+tz);
function bin(axis,p){
 if(p<axis[1]||p>=axis[N-1])return -1;let a=1,b=N-1;
 while(b-a>1){const m=(a+b)>>1;if(axis[m]<=p)a=m;else b=m;}return a;
}
function packedHeight(x,z){
 const i=bin(X,x),j=bin(Z,z);if(i<0||j<0)return;
 const u=(x-X[i])/(X[i+1]-X[i]),v=(z-Z[j])/(Z[j+1]-Z[j]),k=j*A+i;
 return {face:2*(j*N+i)+ +(u+v>1),cell:[i,j],y:F.facet(u,v,pos.getY(k),pos.getY(k+1),pos.getY(k+A),pos.getY(k+A+1))};
}
const ex=await E.readNorthCapeGradeExclusions(url,coords,G.project,{x:Infinity,z:Infinity});
const spec=Stamp.CONFEDERATION_TRAIL,trailRaw=gunzipSync(read(spec.asset));
assert.equal(sha(trailRaw),spec.sha256);
const graph=Trail.decodeConfederationTrail(ab(trailRaw)),links=[];
const home=G.project(...s.reportedAnchor.wgs84);
for(const region of graph.values())for(const path of region.paths)for(let i=1;i<path.cuts.length;i++){
 const a=path.cuts[i-1],q=path.cuts[i],x=q.x-a.x,z=q.z-a.z,k=x*x+z*z;
 if(k<=0||Math.min(Math.hypot(a.x-home.x,a.z-home.z),Math.hypot(q.x-home.x,q.z-home.z))>600)continue;
 links.push({a,x,z,k,half:path.width*.581+.015,way:path.way});
}
const distance=(x,z,l)=>{
 const f=Math.max(0,Math.min(1,((x-l.a.x)*l.x+(z-l.a.z)*l.z)/l.k));
 return Math.hypot(x-l.a.x-l.x*f,z-l.a.z-l.z*f)-l.half;
};
const hedgeDir='woodland/hedgerows-v1/',hi=read(hedgeDir+'index.json');
assert.equal(sha(hi),'601cb33036c694028dc1c04f0107263108d9d786218f69ace58fdb2798f09f2a');
const catalogue=JSON.parse(hi);
assert.ok(Hedge.validHedgeCatalogue(catalogue));
const chunk=catalogue.tiles.find(q=>q.id==='14-14'),hf=catalogue.packs[chunk.pack],hp=read(hedgeDir+hf.file);
assert.equal(sha(hp),hf.sha256);assert.equal(hp.length,hf.bytes);
const hg=gunzipSync(hp.subarray(chunk.offset,chunk.offset+chunk.bytes));
assert.equal(sha(hg),chunk.sha256);assert.equal(hg.length,chunk.count*6);
const hx=t.left+14*W,hz=t.top+14*H;
assert.ok(coords.every(q=>q.x-hx>120&&q.z-hz>120&&hx+W-q.x>120&&hz+H-q.z>120));
const hedges=Hedge.decodeHedgeChunk(ab(hg),chunk.count,hx,hz),nearHedges=[];
for(let i=0;i<hedges.length;i+=4){
 const [x,z,h,style]=hedges.subarray(i,i+4);
 if(Math.hypot(x-home.x,z-home.z)>440)continue;
 const span=h*(style===1?1.68:1.19),reserve=8;
 nearHedges.push([x-.71*span-reserve,z-.595*span-reserve,x+.43*h+.71*span+reserve,z+.21*h+.595*span+reserve]);
}
const forestProof=[];
const forest=['stream-v1','crown-v1'].map(kind=>{
 const dir='woodland/'+kind+'/',idxRaw=read(dir+'index.json'),idx=JSON.parse(idxRaw);
 assert.deepEqual([idx.cols,idx.rows,idx.tileInterior,idx.tileBorder],[32,22,320,2]);
 if(kind==='crown-v1')assert.equal(sha(idxRaw),'54e8689b87a9dc0009ca79e92635460afb459813100d95f634af4be8cf86655a');
 const record=idx.tiles.find(q=>q.id==='14-14'),entry=idx.packs[record.pack],pack=read(dir+entry.file);
 assert.equal(pack.length,entry.bytes);
 if(entry.sha256)assert.equal(sha(pack),entry.sha256);
 const zip=pack.subarray(record.offset,record.offset+record.bytes);
 const raw=zip[0]===31&&zip[1]===139?gunzipSync(zip,{maxOutputLength:104976}):zip;
 assert.equal(raw.length,104976);assert.equal(sha(raw),record.sha256);
 forestProof.push({kind,indexSHA:sha(idxRaw),rawSHA:record.sha256,packSHA:sha(pack)});
 return raw;
});
function nearMappedStand(x,z){
 const u=320*(x-hx)/W+2,v=320*(z-hz)/H+2,dx=W/320,dz=H/320;
 const a=Math.floor(u),b=Math.floor(v),margin=28;
 for(let j=b-3;j<=b+3;j++)for(let i=a-3;i<=a+3;i++){
  if(!forest.some(data=>data[j*324+i]!==0))continue;
  const xx=Math.max(i-u,0,u-i-1)*dx,zz=Math.max(j-v,0,v-j-1)*dz;
  if(Math.hypot(xx,zz)<=margin)return true;
 }
 return false;
}
const sampleStatus=({x,z})=>{
 const path=Math.min(...links.map(l=>distance(x,z,l)));
 const q=packedHeight(x,z);
 if(!q||!t.isLand(x,z)||c.legacyDistance(t,x,z)<=80||[30,40].includes(c.sample(t,x,z))===false)return {reason:'not dry open stock',path,q};
 if(nearMappedStand(x,z))return {reason:'EFI/crown raster reserve 28m',path,q};
 if(nearHedges.some(([x0,z0,x1,z1])=>x>=x0&&x<=x1&&z>=z0&&z<=z1))return {reason:'signed hedge/shadow reserve',path,q};
 const conflict=ex.classify({x,z});
 if(conflict)return {reason:conflict,path,q};
 if(path<23)return {reason:'mapped trail reserve 23m',path,q};
 // Land-cover samples on the same signed base grid; a planning buffer, not a surveyed forest edge.
 for(const [i,j] of [[-13,-13],[0,-13],[13,-13],[-13,0],[13,0],[-13,13],[0,13],[13,13]])
  if(![30,40].includes(c.sample(t,x+i,z+j)))return {reason:'not open at cover reserve taps',path,q};
 return {path,q};
};
const rows=coords.map((q,i)=>{const v=sampleStatus(q);return {...v,m:native[i]/100,
 delta:v.q?native[i]/100-(v.q.y-F.GROUND_LIFT):null};});
const safe=rows.map((q,i)=>{
 const r=Math.floor(i/D),j=i%D;
 if(q.reason||r<2||j<2||r>=D-2||j>=D-2)return false;
 return [-2*D,-2,-D-1,-D+1,0,D-1,D+1,2,2*D].every(o=>rows[i+o].q?.face===q.q.face&&!rows[i+o].reason);
});
const faces=new Set(rows.filter((q,i)=>safe[i]&&Math.abs(q.delta)>1).map(q=>q.q.face));
const prospects=[];
for(const face of faces)for(const sign of [-1,1]){
 const h=new Uint16Array(D+1);let best;
 for(let i=0;i<D;i++){
  for(let j=0;j<D;j++){const k=i*D+j;
   h[j]=safe[k]&&rows[k].q.face===face&&rows[k].delta*sign>=.85?h[j]+1:0;}
  const stack=[];
  for(let j=0;j<h.length;j++){
   let first=j;
   while(stack.length&&stack.at(-1)[1]>h[j]){
    const [l,n]=stack.pop();first=l;const w=j-l,area=w*n,window=[l,i-n+1,j-1,i];
    if(w>=12&&n>=12&&(!best||area>best.area))best={face,sign,window,area};
   }
   if(!stack.length||stack.at(-1)[1]<h[j])stack.push([first,h[j]]);
  }
 }
 if(best){
  const d=[],path=[];const [c0,r0,c1,r1]=best.window;
  for(let r=r0;r<=r1;r++)for(let j=c0;j<=c1;j++){const k=r*D+j;d.push(rows[k].delta);path.push(rows[k].path);}
  best.residualM=[Math.min(...d),Math.max(...d)];best.minCentreToMappedRibbonM=Math.min(...path);
  prospects.push(best);
 }
}
prospects.sort((a,b)=>b.area-a.area||a.face-b.face);
const dataSet={
 source:s.file,sourceCellGeoreferencing:s.geoTransform,stockGeometry:{positions:sha(Buffer.from(ab(pos.array))),indices:sha(Buffer.from(ab(plane.index.array)))},
  scope:'Strict detached rectangle prospect; no runtime height adjustment or complete real safety proof.',protectedAtlas:ex.receipt,trailSHA256:spec.sha256,
  hedgeExactChunk:{sha256:chunk.sha256,roots:chunk.count,closeBoxes:nearHedges.length},
  forestProof,comparedRows:rows.length,strictSafeCentreCount:safe.filter(Boolean).length,prospects:prospects.slice(0,8),
 };
const report=process.argv[2];
writeFileSync(report,JSON.stringify(dataSet,null,2)+'\n',{flag:'wx'});
// Save the leading candidate full pose and source rows for an independent geometry prototype.
export {plane,t,coords,rows,D,tx,tz,packedHeight,dataSet};
