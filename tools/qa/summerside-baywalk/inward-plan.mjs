// Offline source-only plan audit. It never changes the playable atlas.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {sharedSignedEnvelope} from './signed-envelope.ts';
import {BaywalkNative,BAYWALK_COVER_DECODED_SHA} from '../../../src/sim/baywalk-native.ts';
import {BAYWALK_COURT as S} from '../../../src/sim/baywalk-native.generated.ts';
import {Cover} from '../../../src/sim/cover.ts';
import {Terrain} from '../../../src/sim/terrain.ts';

assert.equal(process.argv.length,3,'Usage: node --experimental-strip-types tools/qa/summerside-baywalk/inward-plan.mjs <new-output-directory>');
const root=fileURLToPath(new URL('../../../',import.meta.url)),dir=resolve(process.argv[2]),out=resolve(dir,'inward-plan.json');
assert.ok(!existsSync(dir),'Use a new output directory to retain earlier evidence.');
const get=s=>readFileSync(root+'/public/world/'+s),hash=b=>createHash('sha256').update(b).digest('hex');
// The manifest fixes the stock mask lattice, not just the DEM filename.
const manifest=get('terrain.json'),manifestSHA='77c9417c6bd4f4286ea4ca86a4625be30f779f33272dd7a8a4af13e001de7e98';
assert.equal(hash(manifest),manifestSHA,'The stock atlas manifest changed');
const spec=JSON.parse(manifest),dem=gunzipSync(get(spec.file)),cWire=get('cover.bin.gz'),atlas=gunzipSync(cWire),raw=gunzipSync(get(S.asset));
assert.equal(hash(dem),S.pinTerrainSha);assert.equal(hash(cWire),S.pinCoverSha);
assert.equal(hash(atlas),BAYWALK_COVER_DECODED_SHA);assert.equal(hash(raw),S.sha256);
const t=new Terrain(spec,new Int16Array(dem.buffer,dem.byteOffset,dem.byteLength/2)),cover=new Cover(spec.width,spec.height,atlas);
const fz=new BaywalkNative({shore:raw.subarray(20,20+S.width*S.height),y:new Int16Array(0)});
const {x0,z0,step,width:w,height:h,data:{shore}}=fz;
const bX=(t.right-t.left)/cover.width,bZ=(t.bottom-t.top)/cover.height;
const sideSplits=(A,B,O,s)=>{
 const x=O+(Math.floor((A-O)/s)+1)*s;
 return x>A&&x<B?[A,x,B]:[A,B];
};
const area=P=>P.length<3?0:P.slice(1,-1).reduce((v,q,i)=>{
 const a=P[0],b=P[i+2];return v+Math.abs((q[0]-a[0])*(b[1]-a[1])-(q[1]-a[1])*(b[0]-a[0]))*.5;
},0);
const clip=(P,i,v,sign)=>{
 const out=[];
 for(let j=0;j<P.length;j++){
  const a=P[j],b=P[(j+1)%P.length],da=sign*(a[i]-v),db=sign*(b[i]-v);
  if(da>=0)out.push(a);
  if((da<0)!==(db<0)){
   const s=da/(da-db),p=[a[0]+s*(b[0]-a[0]),a[1]+s*(b[1]-a[1])];p[i]=v;out.push(p);
  }
 }
 return out;
};
const F=([x,z])=>(fz.sample(shore,x,z)-128)*S.shoreQuantum,L=([x,z])=>-cover.legacyDistance(t,x,z);
const cross=(f,A,B,C,D)=>((f([A,B])+f([C,D]))-(f([A,D])+f([C,B])))/((C-A)*(D-B));

// CPU topology only. 1e-8 m canonical keys keep shared branch calculations
// deterministic; the reachably signed field is >1e-5 after this snapping.
// Raw source IDs and accepted native parent transforms remain separate.
const bins=new Map(),basePts=[],baseFaces=[],deltas=[];
const snap=1e8,cKey=p=>Math.round((p[0]-x0)*snap)+','+Math.round((p[1]-z0)*snap);
function pin(map,pts,p){
 const k=cKey(p),prior=map.get(k);if(prior!==undefined)return prior;
 const n=pts.length;map.set(k,n);pts.push(p);return n;
}
for(let j=0;j<h-1;j++)for(let i=0;i<w-1;i++){
 const k=j*w+i;if(Math.max(shore[k],shore[k+1],shore[k+w],shore[k+w+1])<=128)continue;
 const a=x0+i*step,b=z0+j*step,c=a+step,d=b+step;
 const x=sideSplits(a,c,t.left+bX*.5,bX),z=sideSplits(b,d,t.top+bZ*.5,bZ);
 if(Math.max(...x.flatMap(x=>z.map(z=>L([x,z]))))<=0)continue;
 const cF=cross(F,a,b,c,d);
 for(const tri of [[[a,b],[a,d],[c,b]],[[c,b],[a,d],[c,d]]]){
  for(let u=0;u<x.length-1;u++)for(let v=0;v<z.length-1;v++){
   const A=x[u],B=z[v],C=x[u+1],D=z[v+1];
   const poly=clip(clip(clip(clip(tri,0,A,1),1,B,1),0,C,-1),1,D,-1);
   const cL=cross(L,A,B,C,D);
   for(let n=1;n<poly.length-1;n++){
    const q=[poly[0],poly[n],poly[n+1]];if(area(q)<1e-12)continue;
    const ids=q.map(item=>pin(bins,basePts,item));if(new Set(ids).size!==3)continue;
    baseFaces.push(ids);deltas.push([cF,cL]);
   }
  }
 }
}
const env=sharedSignedEnvelope(basePts,baseFaces,basePts.map(p=>[F(p),L(p)]),deltas,[2e-5,2e-5]);
assert.ok(env);
function clipS(Q,field){
 const P=[];
 for(let j=0;j<Q.length;j++){
  const a=Q[j],b=Q[(j+1)%Q.length],u=a.s[field],v=b.s[field];
  if(u>=0)P.push(a);
  if((u<0)!==(v<0)){
   const t=u/(u-v),p=a.p.map((n,k)=>n+t*(b.p[k]-n)),s=a.s.map((n,k)=>n+t*(b.s[k]-n));s[field]=0;
   P.push({p,s});
  }
 }
 return P;
}
const pts=[],map=new Map(),faces=[],edgeCount=new Map(),balance=new Map(),minPositive=[Infinity,Infinity],tags=[];
let polyArea=0,degenerateAfterSnap=0;
for(const tri of env.triangles){
 const Q=clipS(clipS(tri.map(i=>({p:basePts[i],s:env.lower[i]})),0),1);
 if(Q.length<3)continue;
 for(let n=1;n<Q.length-1;n++){
  const proposal=[Q[0],Q[n],Q[n+1]],p=proposal.map(q=>q.p);if(area(p)<1e-12)continue;
  const I=proposal.map(q=>{
   const v=pin(map,pts,q.p),tag=Number(Math.abs(q.s[0])<5e-9)+2*Number(Math.abs(q.s[1])<5e-9);
   tags[v]=(tags[v]??0)|tag;
   return v;
  });
  if(new Set(I).size!==3){degenerateAfterSnap++;continue;}
  polyArea+=area(I.map(i=>pts[i]));faces.push(I);
  for(let j=0;j<3;j++){
   const a=I[j],b=I[(j+1)%3],k=a<b?a+','+b:b+','+a,sign=a<b?1:-1;
   edgeCount.set(k,(edgeCount.get(k)??0)+1);balance.set(k,(balance.get(k)??0)+sign);
  }
  for(const id of I){const p=pts[id];assert.ok(F(p)>0&&L(p)>0);minPositive[0]=Math.min(minPositive[0],F(p));minPositive[1]=Math.min(minPositive[1],L(p));}
 }
}
const adj=new Map(),bump=(x,y)=>{const n=adj.get(x)??[];n.push(y);adj.set(x,n);};let nonmanifold=0,wrongWinding=0,perimeter=0;
for(const [edge,count] of edgeCount){
 if(count>2)nonmanifold++;if(count===2&&balance.get(edge)!==0)wrongWinding++;
 if(count===1){const [a,b]=edge.split(',').map(Number);bump(a,b);bump(b,a);perimeter++;}
}
const visited=new Set(),components=[],irregular=[];
for(const [x,ns] of adj){
 if(ns.length!==2)irregular.push([x,pts[x],ns.length]);
 if(visited.has(x))continue;
 const queue=[x];visited.add(x);
 for(let i=0;i<queue.length;i++)for(const v of adj.get(queue[i]))if(!visited.has(v)){visited.add(v);queue.push(v);}
 components.push(queue.length);
}
const report={schema:1,source:{terrainManifest:manifestSHA,terrain:S.pinTerrainSha,stockCoverDecoded:BAYWALK_COVER_DECODED_SHA,nativeCourtDecoded:S.sha256},scope:'Draft conservative inward plan only. Does not supply cap height, reconcile old contact, or mount/close the coast. Distinct from 3D native proof.',
 baseMesh:{points:basePts.length,triangles:baseFaces.length},
 inward:{points:pts.length,triangles:faces.length,polyArea,perimeter,nonmanifold,wrongWinding,degenerateAfterSnap,minPositive,
 perimeters:components.sort((a,b)=>b-a),irregularCount:irregular.length,irregular:irregular.slice(0,12)}};
assert.equal(nonmanifold,0);assert.equal(wrongWinding,0);assert.equal(irregular.length,0);assert.equal(components.length,1);
const first=Math.min(...adj.keys()),ring=[first];let prev=first,cur=Math.min(...adj.get(first));
while(cur!==first){
 assert.ok(ring.length<=adj.size);ring.push(cur);
 const v=adj.get(cur).filter(n=>n!==prev);assert.equal(v.length,1);
 prev=cur;cur=v[0];
}
assert.equal(ring.length,adj.size);
const sides=new Uint8Array(ring.length);
for(let i=0;i<ring.length;i++)sides[i]=tags[ring[i]]&tags[ring[(i+1)%ring.length]];
const pathM=[0,0,0,0],pathCount=[0,0,0,0],ties=[];
for(let i=0;i<sides.length;i++){
 const a=pts[ring[i]],b=pts[ring[(i+1)%ring.length]],r=sides[i];
 pathM[r]+=Math.hypot(b[0]-a[0],b[1]-a[1]);pathCount[r]++;
 if(r!==sides[(i+sides.length-1)%sides.length])ties.push({i,at:a,before:sides[(i+sides.length-1)%sides.length],after:r});
}
report.rimSourceConstraint={legend:['unresolved','new wet-frontier','stock land interface','both'],edges:pathCount,distanceM:pathM,junctions:ties};
assert.equal(pathCount[0]+pathCount[3],0,'all source edge roles must be unambiguous');
assert.equal(ties.length,2,'one wet frontier and one stock tie must meet at exactly two transitions');

const pBytes=Buffer.alloc(pts.length*16),iBytes=Buffer.alloc(faces.length*12),rBytes=Buffer.alloc(ring.length*4);
for(let i=0;i<pts.length;i++){pBytes.writeDoubleLE(pts[i][0],i*16);pBytes.writeDoubleLE(pts[i][1],i*16+8);}
for(let i=0;i<faces.length;i++)for(let k=0;k<3;k++)iBytes.writeUInt32LE(faces[i][k],i*12+k*4);
for(let i=0;i<ring.length;i++)rBytes.writeUInt32LE(ring[i],i*4);
mkdirSync(dir); // never overwrite a previous evidence bundle or existing directory
for(const [tag,z] of [['xz.f64le',pBytes],['faces.u32le',iBytes],['ring.u32le',rBytes],['ring-role.u8',sides]]){
 writeFileSync(out+'.'+tag,z,{flag:'wx'});
 (report.rawScopedDraft??={})[tag]={bytes:z.length,sha256:hash(z)};
}
writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(report);
