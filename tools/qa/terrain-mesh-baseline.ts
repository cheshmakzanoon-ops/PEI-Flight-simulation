/**
 * Compare pre-projected native-resolution observations from the same DTM with the existing world
 * terrain. Input is JSON [{id, points: [[lon, lat, sourceM], ...]}] on stdin.
 * Evaluate the *actual triangulated* near mesh and the separately sampled
 * gameplay surface, not just a raw lookup into the province DEM.
 */
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
import {clamp,project} from '../../src/sim/geo.ts';
import {makeTerrainPatchHeight} from './rendered-surface.ts';

const world=new URL('../../public/world/',import.meta.url);
const read=(path:string)=>readFileSync(new URL(path,world));
const terrainSpec=JSON.parse(read('terrain.json').toString());
const rawHeight=gunzipSync(read('height.bin.gz'));
const source=new DataView(rawHeight.buffer,rawHeight.byteOffset,rawHeight.byteLength);
const coarseSamples=new Int16Array(rawHeight.byteLength/2);
for(let i=0;i<coarseSamples.length;i++)coarseSamples[i]=source.getInt16(i*2,true);
const terrain=new Terrain(terrainSpec,coarseSamples);
const cc=JSON.parse(read('cover.json').toString());
const cover=new Cover(cc.width,cc.height,gunzipSync(read('cover.bin.gz')));
const cols=32,rows=22,subdiv=112,dx=(terrain.right-terrain.left)/cols,dz=(terrain.bottom-terrain.top)/rows;
const patches=new Map<string,ReturnType<typeof makeTerrainPatchHeight>>();
type Point=[number,number,number];
type Input={id:string;points:Point[]};

function displayedHeight(x:number,z:number){
 const i=clamp(Math.floor((x-terrain.left)/dx),0,cols-1),j=clamp(Math.floor((z-terrain.top)/dz),0,rows-1),key=i+':'+j;
 let patch=patches.get(key);
 if(!patch){
  patch=makeTerrainPatchHeight({x0:terrain.left+i*dx,z0:terrain.top+j*dz,w:dx,d:dz,n:subdiv,
   neighborSegments:[subdiv,subdiv,subdiv,subdiv]},(x,z)=>terrain.meshElevation(x,z)+.12);
  patches.set(key,patch);
 }
 return patch(x,z);
}
function describe(values:number[]){
 if(!values.length)return {count:0};
 const sorted=values.toSorted((a,b)=>a-b),n=sorted.length;
 const q=(fraction:number)=>Number(sorted[Math.round((n-1)*fraction)].toFixed(4));
 return {count:n,p50:q(.5),p90:q(.90),p95:q(.95),max:q(1)};
}
const cases=JSON.parse(readFileSync(0,'utf8')) as Input[];
const out=cases.map(({id,points})=>{
 const meshes:number[]=[],collisions:number[]=[],misalignments:number[]=[],shore:number[]=[],inland:number[]=[];
 const coverage={validSource:0,negativeSource:0,currentCoverLand:0,coarseMaskLand:0,maskDisagreements:0};
 for(const [lon,lat,measured] of points){
  if(![lon,lat,measured].every(Number.isFinite))continue;
  coverage.validSource++;
  if(measured<0)coverage.negativeSource++;
  const {x,z}=project(lon,lat),land=terrain.isLand(x,z),dist=cover.distance(terrain,x,z);
  if(land)coverage.coarseMaskLand++;
  if(dist>=0)coverage.currentCoverLand++;
  if(land!==(dist>=0))coverage.maskDisagreements++;
  // These bins use the existing mask only; they are not an independent
  // shoreline classification, nor is zero elevation a land/water test.
  if(!land||dist<0)continue;
  const mesh=displayedHeight(x,z);
  if(mesh===undefined)continue;
  const err=Math.abs((mesh-.12)-measured),collision=terrain.elevation(x,z)+.12;
  meshes.push(err);
  collisions.push(Math.abs((collision-.12)-measured));
  misalignments.push(Math.abs(mesh-collision));
  (dist<20?shore:inland).push(err);
 }
 return {id,coverage,existingLand:{mesh:describe(meshes),collision:describe(collisions),meshVsCollision:describe(misalignments),
    lessThan20mFromCurrentMask:describe(shore),atLeast20mFromCurrentMask:describe(inland)}};
});
console.log(JSON.stringify({model:'32×22 patch grid, 112 subdivisions, same-detail neighbors; 0.12 m display lift removed for survey errors',
 note:'Selected source cell centers; bins conditioned on both existing game masks, not verified coastline.',sites:out},null,2));
