import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Terrain} from '../src/sim/terrain.ts';
import {emitSurveyRoof,type RoofPoint} from '../src/render/survey-roof.ts';
import {SOURIS_ROOF,SOURIS_ROOF_SHA256} from '../src/render/souris-roof.generated.ts';
import {SOURIS_LIGHT as plan} from '../src/render/souris-light.generated.ts';
import {loadSourisLighting,SourisLighting,sourisLightingForTerrain} from '../src/render/souris-light.ts';

const file=(path:string)=>Uint8Array.from(readFileSync(new URL('../'+path,import.meta.url)));
const js=(p:string)=>JSON.parse(Buffer.from(file(p)).toString());
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const z=file('public/world/'+plan.asset),bytes=gunzipSync(z);
const tr=js('public/world/terrain.json');
const t=new Terrain(tr,new Int16Array(Uint8Array.from(gunzipSync(file('public/world/'+tr.file))).buffer));
const [sx,sz]=plan.shadowYZRatio;
const [left,top]=plan.leftTopXZ,cell=plan.cellMetres;

test('Souris daylight mask pins the current shell and elevation, and optional transfers fail quiet',async()=>{
 assert.equal(sha(bytes),plan.sha256);assert.equal(sha(z),plan.compressedSha256);
 assert.equal(plan.shadowBytes,plan.width*plan.height*2);assert.equal(bytes.length,plan.shadowBytes+plan.groundBytes);assert.ok(z.length<75_000);
 assert.equal(plan.terrainSha256,tr.sha256);
 assert.equal(plan.evidenceSha256,SOURIS_ROOF.evidenceSha256);
 assert.equal(plan.shellSha256,SOURIS_ROOF_SHA256);
 let finish!: (p:Response)=>void,requests=0;
 const light=new SourisLighting('/w/',async u=>{
  requests++;assert.equal(u,'/w/'+plan.asset);
  return new Promise<Response>(resolve=>finish=resolve);
 });
 assert.equal(requests,0,'do not fetch a local art pack during province startup');
 assert.equal(light.active.value,0,'the optional field alone is not an active caster');
 assert.equal(sourisLightingForTerrain('/w/','not-the-survey-terrain'),undefined);
 const load=light.setCaster(true);assert.equal(requests,1);
 light.setCaster(false);finish(new Response(z));await load;
 assert.equal(light.active.value,0,'late assets must not cast shadows from an evicted building');
 light.setCaster(true);assert.equal(light.active.value,1);assert.equal(requests,1);
 light.setCaster(false);assert.equal(light.active.value,0);
 assert.equal(light.uniforms.sourisLightLive,light.active);
 assert.equal(light.intersects(70000,15000,71000,16000),false);
 assert.equal(light.intersects(left-10,top-10,left+10,top+10),true);
 const bad=Uint8Array.from(bytes);bad[10000]^=1;
 for(const fetcher of [async()=>new Response(null,{status:404}),async()=>new Response(bad),
    async()=>new Response(z.subarray(0,31),{status:206}),()=>new Promise<Response>(()=>{})])
  assert.equal(await loadSourisLighting('/w/',fetcher,50),undefined);
});

type P=readonly [number,number,number];
const world=(p:RoofPoint,h:number):P=>[p.x,h,p.z];
const tris:[P,P,P][]=[];
emitSurveyRoof(SOURIS_ROOF,{roof:(a,b,c,h)=>tris.push([world(a,h[0]),world(b,h[1]),world(c,h[2])]),
 riser:(a,b,lo,hi)=>{
  const x=lo?.[0]??t.meshElevation(a.x,a.z)-.6,z=lo?.[1]??t.meshElevation(b.x,b.z)-.6;
  const [p,q,r,s]=[world(a,x),world(a,hi[0]),world(b,hi[1]),world(b,z)];
  tris.push([p,q,r],[p,r,s]);
 }});
const uv=([x,y,z]:P)=>({x:x-sx*(y-plan.shadowDatumY),z:z-sz*(y-plan.shadowDatumY),y});
const cross=(x:number,z:number,y:number,w:number)=>x*w-z*y;
const sunFaces=tris.flatMap(face=>{
 const [a,b,c]=face.map(uv),ux=b.x-a.x,uz=b.z-a.z,vx=c.x-a.x,vz=c.z-a.z;
 const det=cross(ux,uz,vx,vz);
 if(Math.abs(det)<1e-8)return [];
 return [{a,b,c,ux,uz,vx,vz,det,x0:Math.min(a.x,b.x,c.x),z0:Math.min(a.z,b.z,c.z),
  x1:Math.max(a.x,b.x,c.x),z1:Math.max(a.z,b.z,c.z)}];
});
function height(x:number,z:number){
 let maximum=0;
 for(const {a,b,c,ux,uz,vx,vz,det,x0,z0,x1,z1} of sunFaces){
  if(x<x0||z<z0||x>x1||z>z1)continue;
  const px=x-a.x,pz=z-a.z;
  const u=cross(px,pz,vx,vz)/det,v=cross(ux,uz,px,pz)/det;
  if(u < -1e-9||v < -1e-9||u+v>1+1e-9)continue;
  maximum=Math.max(maximum,a.y+u*(b.y-a.y)+v*(c.y-a.y));
 }
 return maximum;
}
test('every recorded sun-space receiver height comes from the actual 296 fitted roof/wall triangles',ctx=>{
 assert.equal(tris.length,plan.triangleCount);
 let validated=0,count=0,positive=0,peak=0;
 for(let j=0;j<plan.height;j++)for(let i=0;i<plan.width;i++){
  const d=bytes[(j*plan.width+i)*2],x=left+(i+.5)*cell,z=top+(j+.5)*cell;
  if(d||!(i%3||j%3)){
   const y=height(x,z);
   assert.equal(d,y?1+Math.round(y*4):0);
   if(d){validated++;peak=Math.max(peak,Math.abs(y-(d-1)*.25));}
   else count++;
  }
  if(!i||!j||i===plan.width-1||j===plan.height-1)assert.equal(d,0);
  if(bytes[(j*plan.width+i)*2+1])positive++;
 }
 assert.equal(validated,plan.depthTexels);assert.equal(positive,plan.aoTexels);assert.ok(peak<=.125);
 assert.ok(count>7000);
 ctx.diagnostic(`${validated} exact source-backed sun texels, ${count} empty controls; worst encoded height error ${peak.toFixed(5)} m`);
});

test('ground AO is confined to the actual footprint-edge collar; the outer texture guard is dark',ctx=>{
 const [ox,oz]=SOURIS_ROOF.originXZ;
 const curve=SOURIS_ROOF.levels[0].risers[0][0].map(([x,z])=>[x+ox,z+oz]);
 const edges=curve.map((a,i)=>{
  const b=curve[(i+1)%curve.length],dx=b[0]-a[0],dz=b[1]-a[1];
  return {ax:a[0],az:a[1],dx,dz,s:dx*dx+dz*dz};
 });
 let max=0,supported=0;
 for(let j=0;j<plan.height;j++)for(let i=0;i<plan.width;i++){
  const a=bytes[(j*plan.width+i)*2+1];
  if(!i||!j||i===plan.width-1||j===plan.height-1)assert.equal(a,0);
  if(!a)continue;
  const x=left+(i+.5)*cell,z=top+(j+.5)*cell;
  let best=Infinity;
  for(const {ax,az,dx,dz,s} of edges){
   const b=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/s));
   best=Math.min(best,(x-ax-b*dx)**2+(z-az-b*dz)**2);
  }
  max=Math.max(max,Math.sqrt(best));supported++;
 }
 assert.ok(max<plan.aoSupportMetres);
 assert.equal(supported,plan.aoTexels);
 ctx.diagnostic(`${supported} AO texels; max support ${max.toFixed(3)} m from the measured perimeter`);
});


test('ground contrast is limited to observed cells and bounded one-metre interpolations in the exterior collar',ctx=>{
 const footing=js('data/roof-tiers/souris-ground-strip.json');
 const survey=gunzipSync(file('data/roof-tiers/'+footing.file));
 assert.equal(sha(survey),plan.groundSourceSha256);
 assert.equal(footing.groundPoints,141_398);assert.equal(footing.quotedSourceTrack,60611);
 const evidence=new Uint16Array(Uint8Array.from(survey).buffer);
 const [w,h]=plan.groundSize,[x0,z0]=plan.groundLeftTopXZ,[ox,oz]=SOURIS_ROOF.originXZ;
 assert.equal(w*h*2,plan.groundBytes);
 const curve=SOURIS_ROOF.levels[0].risers[0][0].map(([x,z])=>[x+ox,z+oz]);
 let max=0,n=0,interp=0;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
  const offset=2*(j*w+i),k=plan.shadowBytes+offset;
  const value=bytes[k],weight=bytes[k+1];
  assert.ok(value<=weight,'premultiplication produced false value at a source void');
  if(i===0||j===0||i===w-1||j===h-1)assert.equal(weight,0,'filter guard must be empty');
  if(weight===0)continue;
  if(evidence[offset+1]<3){
   let close=0;
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
    if(evidence[2*((j+dz)*w+i+dx)+1]>=3)close++;
   assert.ok(close>=5,'ground interpolation escaped independently observed neighbours');
   interp++;
  }
  const x=x0+i+.5,z=z0+j+.5;
  let contained=false,best=Infinity;
  for(let s=0;s<curve.length;s++){
   const [a,b]=curve[s],[c,d]=curve[(s+1)%curve.length],dx=c-a,dz=d-b;
   if((b>z)!==(d>z)&&x<a+dx*(z-b)/dz)contained=!contained;
   const u=Math.max(0,Math.min(1,((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz)));
   best=Math.min(best,(x-a-u*dx)**2+(z-b-u*dz)**2);
  }
  assert.equal(contained,false,'direct ground colour cannot paint through the caster footprint');
  max=Math.max(max,Math.sqrt(best));n++;
 }
 assert.equal(n,plan.groundTexels);assert.ok(max<plan.relativeGroundSupportMetres);
 assert.equal(interp,plan.groundInterpolatedTexels);assert.equal(n-interp,plan.groundDirectTexels);
 assert.ok(plan.maxGroundInterpolationM<=1.41422);
 ctx.diagnostic(`${n-interp} observed and ${interp} interpolated exterior texels with ≥5 direct neighbours; max support ${max.toFixed(3)}m before bilinear filtering`);
});
