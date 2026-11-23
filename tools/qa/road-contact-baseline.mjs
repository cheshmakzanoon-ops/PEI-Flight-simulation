/** Quantify the inherited rendered plane against each regular near terrain facet. */
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {decodeRoads} from '../../src/render/roads.ts';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {facet,WORLD_COLS,WORLD_ROWS,GROUND_LIFT} from '../../src/sim/coastal-terrain.ts';
import {runwayAt} from '../../src/sim/places.ts';
const widths=[2,2.8,3.6,4.8,6.4];
const file=(name)=>readFileSync(new URL('../../public/world/'+name,import.meta.url));
const json=(name)=>JSON.parse(file(name));
const read=(name)=>{const x=gunzipSync(file(name));return x.buffer.slice(x.byteOffset,x.byteOffset+x.byteLength);};
const T=json('terrain.json'),C=json('cover.json'),t=new Terrain(T,new Int16Array(read(T.file)));
const c=new Cover(C.width,C.height,new Uint8Array(read(C.file)));
const n=112,w=(t.right-t.left)/WORLD_COLS/n,d=(t.bottom-t.top)/WORLD_ROWS/n;
const raw=decodeRoads(read('roads.bin.gz'));
const head=new Map();
function height(x,z){
 const u=(x-t.left)/w,v=(z-t.top)/d,i=Math.floor(u),j=Math.floor(v);
 const key=j*n*WORLD_COLS+i;
 let q=head.get(key);
 if(!q){
  const at=(a,b)=>Math.fround(t.atlasElevation(t.left+(i+a)*w,t.top+(j+b)*d)+GROUND_LIFT);
  q=[at(0,0),at(1,0),at(0,1),at(1,1)];
  head.set(key,q);
 }
 return facet(u-i,v-j,...q);
}
const out={},empty=()=>({count:0,negative:0,above20cm:0,above35cm:0,above60cm:0,abs:[],gap:[]});
for(const {points,flags} of raw){
 if(flags&16)continue;
 const code=(flags&8)?'paved':'unpaved',width=widths[flags&7];
 out[code]??=empty();const b=out[code];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],p=points[i],ux=p.x-a.x,uz=p.z-a.z,len=Math.hypot(ux,uz);
  if(len<.05)continue;
  const rx=uz*width/len,rz=-ux*width/len,l=Math.ceil(len/500);
  for(let j=0;j<l;j++){
   const x0=a.x+j/l*ux,z0=a.z+j/l*uz,x1=a.x+(j+1)/l*ux,z1=a.z+(j+1)/l*uz;
   const k=Math.ceil(len/l/28);
   for(let z=0;z<k;z++){
    const ax=x0+(x1-x0)*z/k,az=z0+(z1-z0)*z/k,bx=x0+(x1-x0)*(z+1)/k,bz=z0+(z1-z0)*(z+1)/k;
    const y0=t.atlasElevation(ax,az)+.55,y1=t.atlasElevation(bx,bz)+.55;
    for(const along of [.15,.5,.85])for(const edge of [-.83,0,.83]){
     const x=ax+(bx-ax)*along+rx*edge,z=az+(bz-az)*along+rz*edge;
     if(c.legacyDistance(t,x,z)<110||runwayAt(x,z))continue;
     const prior=y0+(y1-y0)*along-height(x,z);
     b.count++;if(prior<0)b.negative++;if(prior>.2)b.above20cm++;
     if(prior>.35)b.above35cm++;if(prior>.6)b.above60cm++;
     b.abs.push(Math.abs(prior));b.gap.push(prior);
    }
   }
  }
 }
}
for(const x of Object.values(out)){
 const quant=a=>{a.sort((x,y)=>x-y);return [.01,.1,.5,.9,.95,.99].map(p=>+a[Math.floor(p*(a.length-1))].toFixed(4));};
 x.abs=quant(x.abs);x.gap=quant(x.gap);
}
console.log(JSON.stringify({quantileOrder:[.01,.1,.5,.9,.95,.99],
 caveat:'Legacy rendering geometry versus regular n112 atlas facets, not physical survey; land with Cover<110m and runways, bridges omitted.',samples:out},null,2));
