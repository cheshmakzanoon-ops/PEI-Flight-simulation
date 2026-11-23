/** Count where existing forest shadow planes leave the regular near terrain. */
import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {loadForestHeights} from '../../src/sim/forest-heights.ts';
import {ForestStream} from '../../src/sim/forest-stream.ts';
import {Vegetation} from '../../src/render/vegetation.ts';
import {project} from '../../src/sim/geo.ts';
import {TREE_PITCH,TREE_TILE_SIDE} from '../../src/sim/tree-layout.ts';
import {regularRoadGround} from '../../src/render/road-contact.ts';
import {shadowFootprint,groundedShadow} from '../../src/render/grounded-tree-shadow.ts';
import {sidewalkGrid} from '../../src/render/sidewalks.ts';
const web=new URL('../../public/',import.meta.url);
const file=(p)=>readFileSync(new URL(p,web));
const bytes=(p)=>{const b=gunzipSync(file(p));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const fetcher=async (u,init)=>{
 const p=new URL(decodeURIComponent(new URL(u).pathname.slice(1)),web);
 if(!existsSync(p))return new Response(null,{status:404});
 const src=readFileSync(p),m=/^bytes=(\d+)-(\d+)$/.exec(new Headers(init?.headers).get('range')??'');
 return m?new Response(src.subarray(Number(m[1]),Number(m[2])+1),{status:206,headers:{'Content-Range':`bytes ${m[1]}-${m[2]}/${src.length}`}}):new Response(src);
};
const ts=JSON.parse(file('world/terrain.json')),cs=JSON.parse(file('world/cover.json'));
const t=new Terrain(ts,new Int16Array(bytes('world/'+ts.file))),cover=new Cover(cs.width,cs.height,new Uint8Array(bytes('world/'+cs.file)));
const forestHeights=await loadForestHeights('http://archive/',fetcher,10000);
const forestStream=new ForestStream('http://archive/',fetcher);
const v=Object.create(Vegetation.prototype);Object.assign(v,{t,cover,forestHeights,forestStream,roofBits:new Uint32Array(8)});
const pts=[['Prince',-64.238,46.674],['Queens',-63.373,46.400],['Kings',-62.169,46.414]];
const floor=regularRoadGround(t),g=sidewalkGrid(t),scale=TREE_PITCH*TREE_TILE_SIDE,result=[];
for(const [n,lon,lat] of pts){
 const c=project(lon,lat);
 await forestStream.warm(c.x,c.z);
 let treeCount=0,below=0,floating=0,witnesses=0,maxErr=0;
 const d=[];
 for(let j=Math.floor((c.z-185)/scale);j<=Math.floor((c.z+185)/scale);j++)for(let i=Math.floor((c.x-185)/scale);i<=Math.floor((c.x+185)/scale);i++){
  const a=v.tile(i,j);
  for(let k=0;k<a.length;k+=8){
   const [x,y,z,height,width,variant]=a.subarray(k,k+8);
   if(Math.hypot(x-c.x,z-c.z)>175||cover.distance(t,x,z)<120)continue;
   const tree={x,y,z,height,width,variant};treeCount++;
   const quad=shadowFootprint(tree),[L,R,B]=quad;
   for(const v of [.08,.24,.5,.76,.92])for(const u of [.08,.24,.5,.76,.92]){
    const px=L.x+(R.x-L.x)*u,pz=L.z+(B.z-L.z)*v;
    const e=y+.46-floor(px,pz);d.push(e);if(e<0)below++;if(e>.45)floating++;
   }
   const mesh=[];
   groundedShadow(tree,g,floor,(x,y,z)=>mesh.push({x,y,z}));
   for(let k=0;k<mesh.length;k+=3){
    const [a,b,c]=mesh.slice(k,k+3);
    for(const [u,v] of [[.11,.33],[.44,.01],[.69,.21]]){
     const w=1-u-v,x=a.x*u+b.x*v+c.x*w,z=a.z*u+b.z*v+c.z*w,y=a.y*u+b.y*v+c.y*w;
     maxErr=Math.max(maxErr,Math.abs(y-floor(x,z)-.024));witnesses++;
    }
   }
  }
 }
 d.sort((a,b)=>a-b);result.push({n,treeCount,oldSamples:d.length,below,floating,oldGap:[.01,.1,.5,.9,.99].map(p=>d[Math.floor(p*(d.length-1))]),newSamples:witnesses,maxErr});
}
console.log(JSON.stringify(result,null,2));
