/** Private per-return computation used by the offline aggregate reproduction.
 * It writes no coordinates or intermediate samples to disk. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {World} from '../../../../src/render/world.ts';
import {Terrain} from '../../../../src/sim/terrain.ts';
import {Cover} from '../../../../src/sim/cover.ts';
import {project} from '../../../../src/sim/geo.ts';
import {WORLD_COLS,WORLD_ROWS} from '../../../../src/sim/coastal-terrain.ts';

const read=name=>readFileSync(resolve(process.argv[2]??'.','public/world',name));
const json=name=>JSON.parse(read(name));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const spec=json('terrain.json'),cm=json('cover.json');
const heights=gunzipSync(read(spec.file)),signedCover=gunzipSync(read('cover.bin.gz'));
if(sha(heights)!=='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d'||
   sha(signedCover)!=='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9')
 throw Error('This replay requires the pinned stock terrain and Cover.');
const terrain=new Terrain(spec,new Int16Array(heights.buffer,heights.byteOffset,heights.byteLength/2));
const cover=new Cover(cm.width,cm.height,signedCover,undefined,cm.compressedSha256);
const dw=(terrain.right-terrain.left)/WORLD_COLS,dh=(terrain.bottom-terrain.top)/WORLD_ROWS;
const i=10,j=12;
const west=terrain.left+i*dw,north=terrain.top+j*dh;
const [cx,cz]=[-33694.05389007342,6920.535248586467];
const area=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);
function load(n){
 const m=World.prototype.patch.call({terrain},west,north,dw,dh,n);
 const g=m.geometry,p=g.getAttribute('position'),ix=g.index;
 const global=i=>[p.getX(i)+m.position.x,p.getY(i)+m.position.y,p.getZ(i)+m.position.z];
 const triangles=[];
 for(let k=0;k<ix.count;k+=3){
   const v=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)].map(global);
   const x=v.map(q=>q[0]),z=v.map(q=>q[2]);
   if(Math.min(...x)<=cx+75&&Math.max(...x)>=cx-75&&Math.min(...z)<=cz+75&&Math.max(...z)>=cz-75)triangles.push(v);
 }
 g.dispose();
 return (x,z)=>{
   for(const [a,b,c] of triangles){
      const ar=area(a,b,c),w=[x,0,z],u=area(a,w,c)/ar,v=area(a,b,w)/ar;
      if(u>=-1e-9&&v>=-1e-9&&u+v<=1+1e-9)return a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v;
   }
   throw Error('Point is outside the bounded stock faces.');
 };
}
const lod=[112,56,8].map(load);
const points=JSON.parse(readFileSync(0,'utf8'));
if(!Array.isArray(points)||points.length>150000)throw Error('Unbounded rear window input.');
process.stdout.write(JSON.stringify(points.map(([lon,lat])=>{
  const {x,z}=project(lon,lat);
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(x-cx)>70||Math.abs(z-cz)>70)
   throw Error('Invalid rear window coordinate.');
  return {y:lod.map(sample=>sample(x,z)),cover:cover.legacyDistance(terrain,x,z)};
})));
