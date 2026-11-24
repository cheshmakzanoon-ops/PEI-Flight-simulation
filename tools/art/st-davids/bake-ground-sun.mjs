import * as T from 'three';
import {readFileSync as read,writeFileSync as write} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {Terrain} from '../../../src/sim/terrain.ts';
import {Cover} from '../../../src/sim/cover.ts';
import {project} from '../../../src/sim/geo.ts';
import {ST_DAVIDS as S} from '../../../src/render/st-davids/source.generated.ts';
import {ST_DAVIDS_ART as A} from '../../../src/render/st-davids/art.generated.ts';
import {decodeStDavids} from '../../../src/render/st-davids/runtime.ts';
const source=new URL('../../../src/',import.meta.url);
registerHooks({load(url,context,next){
 if(url.startsWith(source.href)&&url.endsWith('.ts')){
  const s=read(new URL(url),'utf8');
  if(s.includes('import.meta.env'))return {format:'module-typescript',shortCircuit:true,
   source:s.replaceAll('import.meta.env','({BASE_URL:"./"})')};
 }
 return next(url,context);
}});
const {World}=await import('../../../src/render/world.ts');
const {Roads,decodeRoads}=await import('../../../src/render/roads.ts');
const root=new URL('../../../public/',import.meta.url),w=new URL('world/',root);
const worldRead=(path)=>read(new URL(path,w));
const b=gunzipSync(read(new URL('art/'+A.file,root)));
const h=gunzipSync(worldRead('height.bin.gz')),data=gunzipSync(worldRead('cover.bin.gz')),cs=JSON.parse(worldRead('cover.json'));
const terrain=new Terrain(JSON.parse(worldRead('terrain.json')),new Int16Array(h.buffer,h.byteOffset,h.byteLength/2));
const cover=new Cover(cs.width,cs.height,Uint8Array.from(data),undefined,cs.compressedSha256);
globalThis.document={createElement:()=>({getContext:()=>Object.fromEntries(['save','translate','fillRect','rotate','scale','fillText','restore'].map(x=>[x,()=>{}]))})};
T.TextureLoader.prototype.load=function(){return new T.Texture()};
const scene=new T.Scene(),sky=new T.Texture();sky.mapping=T.EquirectangularReflectionMapping;
const world=new World(scene,terrain,new T.Texture(),{capabilities:{maxTextureSize:4096}},cover,sky);world.details.load=async()=>undefined;
const [ox,oz]=S.originXZ;world.update(new T.Vector3(ox,85,oz),0);
const art=decodeStDavids(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),undefined);
if(!art)throw Error('bad original art asset');art.group.updateMatrixWorld(true);
const meshTris=[];
for(const m of art.group.children){
 const attr=m.geometry.getAttribute('position'),ix=m.geometry.index.array,points=[];
 for(let i=0;i<attr.count;i++)points.push(new T.Vector3().fromBufferAttribute(attr,i).applyMatrix4(m.matrixWorld).toArray());
 for(let o=0;o<ix.length;o+=3)meshTris.push([points[ix[o]],points[ix[o+1]],points[ix[o+2]]]);
}
const raw=[Math.floor(ox-24),Math.floor(oz-26),Math.ceil(ox+43),Math.ceil(oz+35)],step=.35;
const width=Math.ceil((raw[2]-raw[0])/step),height=Math.ceil((raw[3]-raw[1])/step),mask=new Uint8Array(width*height);
const rays=[[0,0],[-.012,0],[.012,0],[0,-.012],[0,.012],[-.008,.008],[.008,-.008]]
 .map(([x,z])=>[world.sun.x/world.sun.y+x,world.sun.z/world.sun.y+z]);
const k=(x,z)=>x+','+z;
const work=rays.map(([sx,sz])=>{
 const grid=new Map();
 for(const tri of meshTris){
  const [a,b,c]=tri.map(([x,y,z])=>[x-y*sx,z-y*sz,y]);
  const d=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  if(Math.abs(d)<1e-10)continue;
  for(let x=Math.floor(Math.min(a[0],b[0],c[0]));x<=Math.floor(Math.max(a[0],b[0],c[0]));x++)
   for(let z=Math.floor(Math.min(a[1],b[1],c[1]));z<=Math.floor(Math.max(a[1],b[1],c[1]));z++){
    const akey=k(x,z),r=grid.get(akey)??[];r.push([a,b,c,d]);grid.set(akey,r);
   }
 }
 return (x,y,z)=>{
  x-=sx*y;z-=sz*y;
  return (grid.get(k(Math.floor(x),Math.floor(z)))??[]).some(([a,b,c,d])=>{
   const n=((x-a[0])*(c[1]-a[1])-(z-a[1])*(c[0]-a[0]))/d;
   const m=((b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]))/d;
   return n>=0&&m>=0&&n+m<=1&&a[2]*(1-n-m)+b[2]*n+c[2]*m>y+.02;
  });
 };
});
let active=0,full=0,wet=0,minDry=Infinity,heights=[Infinity,-Infinity];
let limits=[Infinity,Infinity,-Infinity,-Infinity];
for(let j=0;j<height;j++)for(let i=0;i<width;i++){
 const x=raw[0]+i*step,z=raw[1]+j*step,y=world.visualGroundHeight(x,z),s=world.surface(x,z),dry=cover.distance(terrain,x,z);
 let votes=0;for(const ray of work)votes+=+ray(x,y,z);
 if(!votes)continue;
 if(!s.land||s.runway||dry<180){wet++;continue;}
 if(!i||!j||i===width-1||j===height-1)throw Error('shadow touches raster edge');
 mask[j*width+i]=Math.round(255*votes/work.length);
 active++;full+=+(votes===work.length);minDry=Math.min(minDry,dry);
 heights=[Math.min(heights[0],y),Math.max(heights[1],y)];
 limits=[Math.min(limits[0],x),Math.min(limits[1],z),Math.max(limits[2],x),Math.max(limits[3],z)];
}
const gzip=gzipSync(mask,{level:9}),hash=x=>createHash('sha256').update(x).digest('hex');
const receipt={samples:rays.length,triangles:meshTris.length,sun:world.sun.toArray(),spacing:step,origin:raw.slice(0,2),width,height,active,full,wet,minDry,heights,limits,wire:gzip.length,rawSha:hash(mask),wireSha:hash(gzip)};

const roadScene=new T.Scene(),bytes=gunzipSync(worldRead('roads.bin.gz'));
const rb=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const roads=await Roads.create(roadScene,terrain,undefined,undefined,undefined,undefined,{data:rb,roads:decodeRoads(rb),digest:S.road,montagueVerified:false});
for(let i=0;i<35;i++)roads.update(ox,oz,Infinity);
roadScene.updateMatrixWorld();
const polygons=[];
roadScene.traverse(m=>{
 if(!m.isMesh)return;
 const a=m.geometry.getAttribute('position'),idx=m.geometry.index?.array,limit=idx?.length??a.count;
 const pt=k=>new T.Vector3().fromBufferAttribute(a,idx?.[k]??k).applyMatrix4(m.matrixWorld);
 for(let k=0;k<limit;k+=3){
  const p=[pt(k),pt(k+1),pt(k+2)];
  if(p.every(t=>t.x>limits[2]+40)||p.every(t=>t.x<limits[0]-40)||p.every(t=>t.z>limits[3]+40)||p.every(t=>t.z<limits[1]-40))continue;
  polygons.push(p.map(t=>[t.x,t.z]));
 }
});
function segment(x,z,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],m=dx*dx+dz*dz;
 const f=m?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/m)):0;
 return Math.hypot(x-a[0]-f*dx,z-a[1]-f*dz);
}
function triangle(x,z,abc){
 const [a,b,c]=abc, cross=(u,v)=>(v[0]-u[0])*(z-u[1])-(v[1]-u[1])*(x-u[0]);
 const y=[cross(a,b),cross(b,c),cross(c,a)];
 if(y.every(a=>a>0)||y.every(a=>a<0))return 0;
 return Math.min(segment(x,z,a,b),segment(x,z,b,c),segment(x,z,c,a));
}
let clearance=Infinity,hits=0;for(let j=0;j<height;j++)for(let i=0;i<width;i++){
 if(!mask[j*width+i])continue;
 const x=raw[0]+i*step,z=raw[1]+j*step,d=Math.min(...polygons.map(q=>triangle(x,z,q)));
 clearance=Math.min(clearance,d);hits+=+(d===0);
}
const roadProof={...receipt,localRoadTriangles:polygons.length,minRoadDistanceAtCenterM:clearance,conservativeMinRoadDistanceWithFullBilinearFootprintM:Math.max(0,clearance-Math.SQRT2*step),centerRoadOverlap:hits};

const index=JSON.parse(worldRead('buildings/index.json')),pack=worldRead('buildings/'+index.file);
const nearby=[];
for(const tile of index.tiles){
 const [a,b,c,d]=tile.bounds,lo=project(a,d),hi=project(c,b);
 if(lo.x>limits[2]+40||lo.z>limits[3]+40||hi.x<limits[0]-40||hi.z<limits[1]-40)continue;
 const f=JSON.parse(gunzipSync(pack.subarray(tile.offset,tile.offset+tile.bytes))).features;
 for(const [i,row] of f.entries()){
  if(tile.id===S.tile&&i===S.ordinal)continue;
  const p=row.footprint.map(([l,t])=>{const {x,z}=project(l,t);return [x,z]});
  if(p.every(t=>t[0]>limits[2]+40)||p.every(t=>t[0]<limits[0]-40)||p.every(t=>t[1]>limits[3]+40)||p.every(t=>t[1]<limits[1]-40))continue;
  nearby.push({tile:tile.id,i,p});
 }
}
let nearest=Infinity,touching=0;
for(let j=0;j<height;j++)for(let i=0;i<width;i++){
 if(!mask[j*width+i])continue;
 const x=raw[0]+i*step,z=raw[1]+j*step;
 for(const {p} of nearby){
  let inside=false;
  for(let a=0,b=p.length-1;a<p.length;b=a++){
   const [u,v]=p[a],[s,t]=p[b];
   if((v>z)!==(t>z)&&x<(s-u)*(z-v)/(t-v)+u)inside=!inside;
   nearest=Math.min(nearest,segment(x,z,p[a],p[b]));
  }
  touching+=+inside;
 }
}
const scoped={...roadProof,nearbyOtherOwners:nearby.length,minOtherBuildingDistanceM:nearest-Math.SQRT2*step,maskCentersUnderOtherBuilding:touching};
const published=new URL('lighting/v1/georgetown-st-davids-ground-A.gz',w);
const target=process.argv[2];
if(wet||hits||touching||scoped.conservativeMinRoadDistanceWithFullBilinearFootprintM<=10||scoped.minOtherBuildingDistanceM<=9)
 throw Error('Shadow lost the reviewed clearances');
if(target&&target!=='--verify')write(target,gzip,{flag:'wx'});
else if(!gzip.equals(read(published)))throw Error('Regenerated ground mask differs from the tracked pack');
console.log(JSON.stringify(scoped,null,2));
