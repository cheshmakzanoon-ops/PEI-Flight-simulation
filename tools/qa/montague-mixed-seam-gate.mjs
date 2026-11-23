/** Real terrain buffers and the stock 8/56/112 shared-edge sewing rule. */
import * as THREE from 'three';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {GROUND_LIFT} from '../../src/sim/coastal-terrain.ts';
import {loadMontagueFoundation} from '../../src/sim/montague-foundation.ts';
import {MONTAGUE_FOUNDATION as plan} from '../../src/sim/montague-foundation.generated.ts';
import {insertCoastalGrid} from '../../src/render/coastal-patch.ts';
const file=f=>fs.readFileSync(new URL('../../public/world/'+f,import.meta.url));
const tm=JSON.parse(file('terrain.json')),b=gunzipSync(file(tm.file)),h=new Int16Array(b.buffer,b.byteOffset,b.byteLength/2);
const source=await loadMontagueFoundation('/',async()=>new Response(file(plan.asset)),500);
assert(source);
const t=new Terrain(tm,h,[source.ground]),grid=t.coastalGrids[0],{tileX,tileZ}=grid.spec;
const w=(t.right-t.left)/32,d=(t.bottom-t.top)/22;
const make=(i,j,n,insert=false)=>{
 const x=t.left+i*w,z=t.top+j*d,g=new THREE.PlaneGeometry(w,d,n,n);g.rotateX(-Math.PI/2);
 const a=g.getAttribute('position'),u=g.getAttribute('uv');
 for(let p=0;p<a.count;p++){
  const X=x+w/2+a.getX(p),Z=z+d/2+a.getZ(p);
  a.setY(p,t.atlasElevation(X,Z)+GROUND_LIFT);u.setXY(p,...t.uv(X,Z));
 }
 if(insert)insertCoastalGrid(g,n,{x,z,w,d},t,grid);
 return {g,x,z,n};
};
const at=(dir,k,n)=>dir===0?k:dir===1?k*(n+1)+n:dir===2?n*(n+1)+k:k*(n+1);
const edgeFile=({g,n},dir)=>{
 const allowed=new Map(Array.from({length:n+1},(_,k)=>[at(dir,k,n),k]));
 const qi=g.getIndex(),seen=new Set();
 for(let t=0;t<qi.count;t+=3)for(let f=0;f<3;f++){
  const l=allowed.get(qi.getX(t+f)),r=allowed.get(qi.getX(t+(f+1)%3));
  if(l!==undefined&&r!==undefined&&Math.abs(l-r)===1)seen.add(Math.min(l,r));
 }
 return seen;
};
function sew(t,side,m){
 const {g,n,x,z}=t,pos=g.getAttribute('position'),ratio=n/m;
 const height=(s)=>t0.atlasElevation(x+w*(side%2===0?s:side===1?1:0),
 z+d*(side%2===1?s:side===2?1:0))+GROUND_LIFT;
 for(let k=0,a=0,b=0;k<=n;k++){
  if(k%ratio===0){a=height(k/n);b=height(Math.min(1,(k+ratio)/n));}
  pos.setY(at(side,k,n),a+(b-a)*(k%ratio)/ratio);
 }
}
const t0=t;
const offsets=[[0,-1],[1,0],[0,1],[-1,0]];
const rows=[];
for(const [n,m] of [[56,8],[112,56],[112,8]]){
 let maxY=0,maxXZ=0,total=0;
 for(let side=0;side<4;side++){
  const [dx,dz]=offsets[side],rev=(side+2)%4;
  const self=make(tileX,tileZ,n,true),neighbor=make(tileX+dx,tileZ+dz,m);
  sew(self,side,m);if(m>8)sew(neighbor,rev,m);
  assert.equal(edgeFile(self,side).size,n);assert.equal(edgeFile(neighbor,rev).size,m);
  const p=self.g.getAttribute('position'),q=neighbor.g.getAttribute('position');
  for(let k=0;k<=n;k++){
   const raw=k/n*m,j=Math.min(m-1,Math.floor(raw)),z=raw-j,i=at(side,k,n),a=at(rev,j,m),b=at(rev,j+1,m);
   const Y=q.getY(a)*(1-z)+q.getY(b)*z;
   const X=neighbor.x+w/2+q.getX(a)*(1-z)+q.getX(b)*z,Z=neighbor.z+d/2+q.getZ(a)*(1-z)+q.getZ(b)*z;
   maxY=Math.max(maxY,Math.abs(p.getY(i)-Y));
   maxXZ=Math.max(maxXZ,Math.hypot(self.x+w/2+p.getX(i)-X,self.z+d/2+p.getZ(i)-Z));total++;
  }
 }
 assert(maxY<.00004&&maxXZ<.0008);
 rows.push({lod:n,neighbor:m,joinedEdgeSamples:total,largestYDifferenceM:maxY,largestXZDifferenceM:maxXZ});
}
console.log(JSON.stringify(rows,null,2));
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(rows,null,2)+'\n');
