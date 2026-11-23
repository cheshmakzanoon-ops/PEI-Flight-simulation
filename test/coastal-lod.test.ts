import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {distantCoast} from '../src/render/coastal-lod.ts';
import {COASTAL_SPECS} from '../src/sim/coastal-surveys.generated.ts';
import {Terrain} from '../src/sim/terrain.ts';
const world=new URL('../public/world/',import.meta.url);
const raw=(path:string)=>readFileSync(new URL(path,world));
const i16=(path:string)=>{const b=gunzipSync(raw(path));return Int16Array.from({length:b.length/2},(_,i)=>b.readInt16LE(i*2));};
const t=new Terrain(JSON.parse(raw('terrain.json').toString()),i16('height.bin.gz'),COASTAL_SPECS.map(spec=>({spec,samples:i16('coastal/v1/'+spec.id+'.i16.gz')})));
for(const g of t.coastalGrids)test(g.spec.id+': distant mesh is watertight and the entire continuous surface stays within 10 cm of the near mesh',ctx=>{
 const nearCount=2*(g.nx-1)*(g.nz-1),layout=distantCoast(g),{points:p,indices}=layout;
 assert.ok(indices.length/3<nearCount*.30);
 for(let j=0;j<g.nz;j++)for(let i=0;i<g.nx;i++)if(!i||!j||i===g.nx-1||j===g.nz-1)assert.ok(layout.edgeVertex(i,j)>=0);
 const count=new Map<number,number>(),mult=p.length/2;
 const height=(x:number,z:number)=>{const i=x>>1,j=z>>1;
  assert.equal(x&1,z&1);
  return x&1?(g.indexHeight(i+1,j)+g.indexHeight(i,j+1))*.5:g.indexHeight(i,j);
 };
 const y=Float64Array.from({length:mult},(_,i)=>height(p[2*i],p[2*i+1]));
 let checked=0,max=0;
 for(let k=0;k<indices.length;k+=3){
  const a=indices[k],b=indices[k+1],c=indices[k+2],ax=p[a*2],az=p[a*2+1],bx=p[b*2],bz=p[b*2+1],cx=p[c*2],cz=p[c*2+1];
  for(const [l,r] of [[a,b],[b,c],[c,a]]){const id=Math.min(l,r)*mult+Math.max(l,r);count.set(id,(count.get(id)??0)+1);}
  const sx=bx-ax,sz=bz-az,tx=cx-ax,tz=cz-az,det=sx*tz-sz*tx;
  assert.ok(det<0);
  for(let z=Math.min(az,bz,cz);z<=Math.max(az,bz,cz);z++)for(let x=Math.min(ax,bx,cx);x<=Math.max(ax,bx,cx);x++){
   if((x&1)!==(z&1))continue;
   const dx=x-ax,dz=z-az,u=(dx*tz-dz*tx)/det,v=(sx*dz-sz*dx)/det;if(u<0||v<0||u+v>1)continue;
   const far=y[a]+u*(y[b]-y[a])+v*(y[c]-y[a]);max=Math.max(max,Math.abs(far-height(x,z)));checked++;
  }
 }
 ctx.diagnostic(indices.length/3+' distant / '+nearCount+' near triangles, '+checked+' overlay-vertex tests, maximum '+max.toFixed(5)+' m');
 assert.ok(checked>2*(g.nx-1)*(g.nz-1));assert.ok(max<=.097,'max '+max+' m, including sub-centimetre perimeter welding');
 for(const [key,n] of count){
  const a=Math.floor(key/mult),b=key%mult,ax=p[a*2],az=p[a*2+1],bx=p[b*2],bz=p[b*2+1];
  const outer=(ax===bx&&(ax===0||ax===2*g.nx-2))||(az===bz&&(az===0||az===2*g.nz-2));
  assert.equal(n,outer?1:2,'non-manifold or unmatched interior edge');
  if(outer)assert.equal(Math.abs(ax-bx)+Math.abs(az-bz),2);
 }
});
