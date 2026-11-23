import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {emitQuartermasterRoof,supportedQuartermasterRoof} from '../src/render/quartermaster-roof.ts';
import {QUARTERMASTER_ROOF as model} from '../src/render/quartermaster-roof.generated.ts';
import {project} from '../src/sim/geo.ts';
import {Terrain} from '../src/sim/terrain.ts';

type Pair=readonly [number,number];
type P=Readonly<{x:number;z:number}>;
const input=(p:string)=>readFileSync(new URL('../'+p,import.meta.url));
const obj=(p:string)=>JSON.parse(input(p).toString());
const sha=(a:Uint8Array|string)=>createHash('sha256').update(a).digest('hex');
const folder='data/roof-tiers/',bldg='public/world/buildings/';
const census=obj(folder+'quartermaster-roof-cells.json');
const report=obj('docs/qa/quartermaster-roof-gate.json');
const bin=input(folder+census.file),raw=gunzipSync(bin);
const grid=new Int16Array(Uint8Array.from(raw).buffer);
const index=obj(bldg+'index.json'),pack=input(bldg+'tiles.pack');
const tile=index.tiles.find((x:{id:string})=>x.id===census.tile);
const features=JSON.parse(gunzipSync(pack.subarray(tile.offset,tile.offset+tile.bytes)).toString()).features as {
 footprint:Pair[];holes?:Pair[][];height:number;
}[];
const source=features[census.featureIndex],outline=source.footprint.map(q=>project(...q));

test('the geometry only replaces the complete exact pinned outline and old-height source feature',()=>{
 assert.equal(sha(pack),model.atlasSha256);assert.equal(index.sha256,model.atlasSha256);
 assert.equal(sha(raw),census.sha256);assert.equal(sha(bin),census.compressedSha256);
 assert.equal(sha(input('src/render/quartermaster-roof.generated.ts').toString().split(' = ')[1].split(' as const')[0]),report.modelDataSha256);
 assert.equal(grid.length,10_844*6);assert.equal(model.evidenceSha256,census.sha256);
 assert.deepEqual(census.sourceFootprint,source.footprint);
 const selected=features.filter(f=>supportedQuartermasterRoof(index.sha256,tile.id,f.footprint,f.holes));
 assert.deepEqual(selected,[source]);assert.equal(source.height,40.51);
 assert.equal(supportedQuartermasterRoof('bad',tile.id,source.footprint),false);
 assert.equal(supportedQuartermasterRoof(index.sha256,'q12000113',source.footprint),false);
 assert.equal(supportedQuartermasterRoof(index.sha256,tile.id,[...source.footprint].reverse()),false);
 const perturbed=[...source.footprint];perturbed[19]=[perturbed[19][0]+1e-6,perturbed[19][1]];
 assert.equal(supportedQuartermasterRoof(index.sha256,tile.id,perturbed),false);
 assert.equal(supportedQuartermasterRoof(index.sha256,tile.id,source.footprint,[source.footprint]),false);
});

const area=(a:P,b:P,c:P)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const top: {a:P;b:P;c:P;y:number;lvl:number}[]=[];
const side: {a:P;b:P;lo:number|undefined;y:number;lvl:number}[]=[];
emitQuartermasterRoof({
 roof:(a,b,c,y,lvl)=>top.push({a,b,c,y,lvl}),
 riser:(a,b,lo,y,lvl)=>side.push({a,b,lo,y,lvl}),
});
test('actual Three.js roof triangulation is upward and retains the original closed footprint and a bounded batch',ctx=>{
 const sum=top.reduce((s,{a,b,c})=>{
  const p=area(a,b,c);assert.ok(p<0,'downward roof triangle');return s-p*.5;
 },0);
 const d=Math.abs(sum-report.sourceOutlineM2);
 assert.ok(d<.005,`top area misses intended model by ${d}m²`);
 const first=side.filter(q=>!q.lvl);
 const truth=outline.reduce((s,a,i)=>{const b=outline[(i+1)%outline.length];return s+Math.hypot(a.x-b.x,a.z-b.z);},0);
 const perimeter=first.reduce((s,{a,b})=>s+Math.hypot(a.x-b.x,a.z-b.z),0);
 assert.equal(first.length,outline.length);assert.ok(Math.abs(perimeter-truth)<.0001);
 const uniqueLevels=[...new Set(top.map(a=>a.y))];
 assert.deepEqual(uniqueLevels,[9.11,10.58,13.96,14.92,28.68,37.09,42.55]);
 for(const face of side)assert.equal(face.lo,face.lvl?uniqueLevels[face.lvl-1]:undefined);
 assert.ok(top.length+side.length*2<1300);
 ctx.diagnostic(`${top.length} upward roof triangles; ${side.length} tier wall edges; total shell triangle budget ${top.length+side.length*2}`);
});

function heightsAt(p:P){
 const fits=new Set<number>();
 for(const {a,b,c,y} of top){
  if(p.x<Math.min(a.x,b.x,c.x)-1e-7||p.x>Math.max(a.x,b.x,c.x)+1e-7||
     p.z<Math.min(a.z,b.z,c.z)-1e-7||p.z>Math.max(a.z,b.z,c.z)+1e-7)continue;
  if(area(a,b,p)<=1e-8&&area(b,c,p)<=1e-8&&area(c,a,p)<=1e-8)fits.add(y);
 }
 return [...fits];
}
const percentile=(xs:number[],f:number)=>xs.sort((a,b)=>a-b)[Math.floor((xs.length-1)*f)];

test('all 10,844 native raster centres hit exactly one rendered height and beat the original maximum extrusion',ctx=>{
 const witness=report.qaProjection;
 assert.ok(witness.maxErrorM<.002);
 const a=witness.worldOriginXZ,b=witness.eastStepXZ,c=witness.northStepXZ;
 const terrainSpec=obj('public/world/terrain.json');
 const dtm=new Int16Array(Uint8Array.from(gunzipSync(input('public/world/'+terrainSpec.file))).buffer);
 const T=new Terrain(terrainSpec,dtm);
 const center={x:outline.reduce((s,q)=>s+q.x,0)/outline.length,z:outline.reduce((s,q)=>s+q.z,0)/outline.length};
 const old=T.meshElevation(center.x,center.z)+.05+source.height;
 const before:number[]=[],after:number[]=[],stable:number[]=[];
 let mixed=0,well=0;
 for(let i=0;i<grid.length;i+=6){
  const [u,v,dm,n,cm,spread]=grid.subarray(i,i+6);
  const y=dm*.01,p={x:a[0]+u*b[0]+v*c[0],z:a[1]+u*b[1]+v*c[1]};
  const surface=heightsAt(p);
  assert.equal(surface.length,1,`missing/double roof at native cell ${u},${v}`);
  assert.ok(surface[0]>T.meshElevation(p.x,p.z)+2,'roof below ground');
  before.push(Math.abs(old-y));after.push(Math.abs(surface[0]-y));
  if(n>=3&&spread<85&&Math.abs(cm-dm)<=65){
   stable.push(Math.abs(surface[0]-.01*cm));well++;
  }else mixed++;
 }
 const first=percentile(before,.9),next=percentile(after,.9),controlled=percentile(stable,.9);
 assert.ok(first>25&&next<=1.60&&controlled<=.36);
 assert.ok(mixed>1000&&well>9100);
 const outside=[[a[0]-20,a[1]],[a[0],a[1]-420],[a[0]+350,a[1]+150]] as const;
 for(const [x,z] of outside)assert.deepEqual(heightsAt({x,z}),[]);
 ctx.diagnostic(`original ${old.toFixed(2)}m; DSM p90 ${first.toFixed(2)}→${next.toFixed(2)}m; same-survey stable class-6 p90 ${controlled.toFixed(2)}m, ${mixed} uncertain or mixed cells separately counted`);
});
