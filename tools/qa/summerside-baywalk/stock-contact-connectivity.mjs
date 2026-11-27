// Source-only overapproximation. Never updates geometry or game contact.
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../../src/sim/terrain.ts';
import {Cover} from '../../../src/sim/cover.ts';
import {project} from '../../../src/sim/geo.ts';
import {GROUND_LIFT,facet} from '../../../src/sim/coastal-terrain.ts';

const data=name=>new URL('../../../public/world/'+name,import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const pin=(b,hash)=>{assert.equal(sha(b),hash);return b;};
const manifest=pin(read(data('terrain.json')),'77c9417c6bd4f4286ea4ca86a4625be30f779f33272dd7a8a4af13e001de7e98');
const terrainSpec=JSON.parse(manifest);
const heights=pin(gunzipSync(read(data(terrainSpec.file))),'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
const coverBytes=pin(gunzipSync(read(data('cover.bin.gz'))),'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
const samples=new Int16Array(heights.buffer,heights.byteOffset,heights.byteLength/2);
const terrain=new Terrain(terrainSpec,samples),cover=new Cover(terrainSpec.width,terrainSpec.height,coverBytes);
const fixture=gunzipSync(read(new URL('./fixtures/n112-native-f315.gz',import.meta.url)));
const position=pin(fixture.subarray(0,153228),'a239d9b7786b54879d0f4ac1cebd7167711594dbb3003f25bd41fe3b2470eb66');
const index=pin(fixture.subarray(153228+102152),'33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa');
assert.equal(index.length,150528);
const width=113,wx=-45697.731250785546,wz=12429.830274298314;
const x=Array.from({length:width},(_,i)=>wx+position.readFloatLE(i*12));
const z=Array.from({length:width},(_,i)=>wz+position.readFloatLE(i*width*12+8));
const y=(ix,iz)=>position.readFloatLE((iz*width+ix)*12+4);
for(let i=0;i<112;i++)for(let j=0;j<112;j++){
 const off=(j*112+i)*12,a=j*width+i;
 assert.deepEqual(Array.from({length:6},(_,k)=>index.readUInt16LE(off+2*k)),[a,a+width,a+1,a+width,a+width+1,a+1]);
}

const {surveyWindowWgs84}=JSON.parse(read(new URL('../../../data/baywalk/native-scope.json',import.meta.url)));
assert.deepEqual(surveyWindowWgs84,[-63.78823,46.38914,-63.78637,46.39061]);
const [lon0,lat0,lon1,lat1]=surveyWindowWgs84,tl=project(lon0,lat1),br=project(lon1,lat0);
const ports={west:[-45128.34044870893,12307.003220967183],east:[-45042.677735041434,12319.521193166094]};
assert.ok(tl.x>x[0]&&tl.z>z[0]&&br.x<x.at(-1)&&br.z<z.at(-1));
const sx=(terrain.right-terrain.left)/cover.width,sz=(terrain.bottom-terrain.top)/cover.height;
const bx=terrain.left+sx*.5,bz=terrain.top+sz*.5;
const cuts=(lo,hi,mesh,offset,space,step)=>{
 const points=[lo,hi,...mesh.filter(k=>k>lo&&k<hi)];
 for(let n=Math.floor((lo-offset)/space)+1;offset+n*space<hi;n++)points.push(offset+n*space);
 for(let i=1;lo+i*step<hi;i++)points.push(lo+i*step);
 return [...new Set(points)].sort((a,b)=>a-b);
};
function span(a,v){
 let lo=0,hi=a.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(a[m]<=v)lo=m;else hi=m;}
 return lo;
}
function plane(ix,iz){
 const a=y(ix,iz),b=y(ix+1,iz),c=y(ix,iz+1),d=y(ix+1,iz+1);
 const toU=v=>(v-x[ix])/(x[ix+1]-x[ix]),toV=v=>(v-z[iz])/(z[iz+1]-z[iz]);
 return {
  toU,toV,
  first:(u,v)=>a+(b-a)*u+(c-a)*v,
  second:(u,v)=>d+(c-d)*(1-u)+(b-d)*(1-v),
  height:(X,Z)=>facet(toU(X),toV(Z),a,b,c,d),
 };
}
function values(i,j,X,Z){
 const u=(X-bx)/sx-i,v=(Z-bz)/sz-j,at=j*cover.width+i;
 const ws=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v],p=[at,at+1,at+cover.width,at+cover.width+1];
 let n=0,d=0,g=0;
 for(let k=0;k<4;k++){
  const h=samples[p[k]];
  if(h!==-32768){n+=ws[k]*h;d+=ws[k];}
  g+=ws[k]*coverBytes[p[k]*2+1];
 }
 return {n,d,land:(g-128)*2};
}
// Tensor degree-2 Bernstein coefficients enclose the polynomial range.
// At 0, .5, 1 the coefficients are f0, 2*f.5−(f0+f1)/2, f1.
function encloses(poly,eps){
 const at=[0,.5,1],b=at.map(v=>{
  const [f,g,h]=at.map(u=>poly(u,v));return [f,2*g-(f+h)*.5,h];
 });
 let lo=Infinity,hi=-Infinity;
 for(let i=0;i<3;i++)for(const v of [b[0][i],2*b[1][i]-(b[0][i]+b[2][i])*.5,b[2][i]]){
  lo=Math.min(lo,v);hi=Math.max(hi,v);
 }
 return lo<=eps&&hi>=-eps;
}
function run(step,eps){
 const X=cuts(tl.x,br.x,x,bx,sx,step),Z=cuts(tl.z,br.z,z,bz,sz,step);
 const w=X.length-1,h=Z.length-1,flags=new Uint8Array(w*h),coast=new Uint8Array(w*h),labels=new Uint32Array(w*h);
 let count=0;
 for(let r=0;r<h;r++)for(let s=0;s<w;s++){
  const a=X[s],b=X[s+1],c=Z[r],d=Z[r+1],mx=(a+b)*.5,mz=(c+d)*.5;
  const i=Math.floor((mx-bx)/sx),j=Math.floor((mz-bz)/sz);
  const corners=[[a,c],[b,c],[a,d],[b,d]].map(([x,z])=>values(i,j,x,z));
  if(Math.max(...corners.map(k=>k.land))< -eps)continue;
  const cell=plane(span(x,mx),span(z,mz)),u0=cell.toU(a),u1=cell.toU(b),v0=cell.toV(c),v1=cell.toV(d);
  const possible=[];
  if(u0+v0<=1+eps)possible.push(cell.first);
  if(u1+v1>=1-eps)possible.push(cell.second);
  let keep=false;
  for(const p of possible){
   const hs=[p(u0,v0),p(u1,v0),p(u0,v1),p(u1,v1)];
   // Include potential zero-denominator/floor matches in the superset: stock's
   // max(0,N/D) must never be replaced by the polynomial when it clamps.
   if(Math.min(...corners.map(k=>k.d))<=eps||
      (Math.min(...corners.map(k=>k.n))<=eps&&Math.min(...hs)<=GROUND_LIFT+eps&&Math.max(...hs)>=GROUND_LIFT-eps)){
    keep=true;break;
   }
   const f=(u,v)=>{
    const t=values(i,j,a+(b-a)*u,c+(d-c)*v);
    return t.n-(p(u0+(u1-u0)*u,v0+(v1-v0)*v)-GROUND_LIFT)*t.d;
   };
   if(encloses(f,eps)){keep=true;break;}
  }
  if(keep){flags[r*w+s]=1;coast[r*w+s]=Number(Math.min(...corners.map(k=>k.land))<=eps);count++;}
 }
 const components=[],possibleCoastalComponents=[];
 for(let k=0;k<flags.length;k++){
  if(!flags[k]||labels[k])continue;
  const id=components.length+1,fill=[k];labels[k]=id;
  for(let u=0;u<fill.length;u++){
   const r=Math.floor(fill[u]/w),s=fill[u]%w;
   for(let j=Math.max(0,r-1);j<=Math.min(h-1,r+1);j++)for(let i=Math.max(0,s-1);i<=Math.min(w-1,s+1);i++){
    const idx=j*w+i;if(flags[idx]&&!labels[idx]){labels[idx]=id;fill.push(idx);}
   }
  }
  components.push(fill.length);
  if(fill.some(i=>coast[i]))possibleCoastalComponents.push(id);
 }
 const portComponents=Object.fromEntries(Object.entries(ports).map(([name,[X0,Z0]])=>{
  const a=span(X,X0),b=span(Z,Z0),id=labels[b*w+a];
  assert.ok(id,'audited stock match excluded from overapproximation');
  return [name,id];
 }));
 return {step,eps,gridPoints:X.length*Z.length,possibleBoxes:count,componentSizes:components,possibleCoastalComponents,portComponents,
  distinct:portComponents.east!==portComponents.west};
}
const observedPorts=Object.fromEntries(Object.entries(ports).map(([name,[x0,z0]])=>{
 const land=cover.legacyDistance(terrain,x0,z0);
 const stockContact=terrain.contactHeight(x0,z0,true),nativeVisual=plane(span(x,x0),span(z,z0)).height(x0,z0);
 assert.ok(Math.abs(land)<1e-8&&Math.abs(stockContact-nativeVisual)<1e-8);
 return [name,{point:[x0,z0],land,stockContact,nativeVisual}];
}));
const report={scope:'Stock-only superset of possible shared visual/contact heights over the recorded survey rectangle. Includes all old dry, corners, and both facets at diagonals. Not measured terrain or a proposed connection.',
 ports:observedPorts,checks:[run(.5,1e-8),run(.25,1e-8),run(.5,2e-4)]};
assert.ok(report.checks.every(x=>x.distinct),'stock-only ports connect in an overapproximation; result is inconclusive, not a proof of a real connection');
console.log(JSON.stringify(report,null,2));
