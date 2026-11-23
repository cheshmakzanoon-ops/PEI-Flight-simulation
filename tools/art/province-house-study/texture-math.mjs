import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { bakeStones, encoded, families, stonePoint, stoneSpan, toneRange, warmthRange } from './src/masonry.ts';
const batch=bakeStones(), spec={}; let count=0;
for (const f of batch.planes) {
 const {width:w,height:h,family}=f;
 let toneBias=0, warmBias=0, albedo8Error=0, normalErrors=0, normal8max=0, maxClipped=0, jointSamples=0;
 const range={tone:[1,0],warm:[1,0]};
 const o=(x,y)=>stonePoint(((x+w)%w+.5)/w,((y+h)%h+.5)/h,family);
 const points=new Map();
 // A coprime deterministic lattice, full outer boundaries, and all course crossings on selected rays.
 function add(x,y){points.set(y*w+x,[x,y]);}
 for(let j=0;j<8191;j++)add(Math.imul(j,389)%w,Math.imul(j,431)%h);
 for(let y=0;y<h;y++)for(const x of [0,1,w-2,w-1,Math.floor(w/3),Math.floor(w*.711)])add(x,y);
 for(let x=0;x<w;x++)for(const y of [0,1,h-2,h-1])add(x,y);
 for(const [x,y] of points.values()){
   const s=o(x,y), k=(y*w+x)*4;
   // Invert R and G to get the exact two source primitives for this color family (no approximation).
   const tone=(s.color[1]+(.10/.43)*s.color[0])/(.979+.10/.43),warm=(s.color[0]/tone-1)/.43;
   range.tone[0]=Math.min(range.tone[0],tone);range.tone[1]=Math.max(range.tone[1],tone);
   range.warm[0]=Math.min(range.warm[0],warm);range.warm[1]=Math.max(range.warm[1],warm);
   const dTone=toneRange[0]+toneRange[1]*f.pixels[k]/255,dWarm=warmthRange[0]+warmthRange[1]*f.pixels[k+1]/255;
   toneBias=Math.max(toneBias,Math.abs(dTone-tone));warmBias=Math.max(warmBias,Math.abs(dWarm-warm));
   const rgb=[dTone*(1+dWarm*.43),dTone*(.979-dWarm*.10),dTone*(.944-dWarm*.62)];
   s.color.forEach((c,i)=>albedo8Error=Math.max(albedo8Error,Math.abs(encoded(c)-encoded(rgb[i]))));
   const oldX=(Math.fround(o(x-1,y).height)-Math.fround(o(x+1,y).height))*w/(2*stoneSpan[0]);
   const oldY=(Math.fround(o(x,y-1).height)-Math.fround(o(x,y+1).height))*h/(2*stoneSpan[1]);
   const d=Math.hypot(oldX,oldY,1);
   const dx=Math.abs(f.pixels[k+2]-encoded(.5+oldX/(2*d))),dy=Math.abs(f.pixels[k+3]-encoded(.5+oldY/(2*d)));
   normalErrors+=!!(dx||dy); normal8max=Math.max(normal8max,dx,dy);
   maxClipped+=f.pixels[k]===0||f.pixels[k]===255||f.pixels[k+1]===0||f.pixels[k+1]===255;
   if(s.rough>.853)jointSamples++;
 }
 assert.ok(toneBias<=toneRange[1]/510+1e-13,`${family} tone ${toneBias}`);
 assert.ok(warmBias<=warmthRange[1]/510+1e-13,`${family} warm ${warmBias}`);
 assert.ok(albedo8Error<=1&&normalErrors===0&&maxClipped===0, JSON.stringify({family,albedo8Error,normalErrors,maxClipped}));
 assert.equal(f.pixels.byteLength,w*h*4);
 spec[family]={points:points.size,toneBias,warmBias,albedo8Error,normalErrors,normal8max,maxClipped,jointSamples,range};count+=points.size;
}
assert.equal(batch.planes.length,families.length);
assert.equal(batch.planes.reduce((n,f)=>n+f.pixels.byteLength,0),14155776);
writeFileSync('proof/texture-math.json',JSON.stringify({samples:count,families:spec},null,2)+'\n');
console.log(count,'source texels checked');
