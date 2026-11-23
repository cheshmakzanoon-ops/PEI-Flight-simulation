import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {emitSurveyRoof,matchesSurveyRoof,type RoofPoint} from '../src/render/survey-roof.ts';
import {emitQuartermasterRoof} from '../src/render/quartermaster-roof.ts';
import {SOURIS_ROOF as model} from '../src/render/souris-roof.generated.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {project} from '../src/sim/geo.ts';

const file=(s:string)=>readFileSync(new URL('../'+s,import.meta.url));
const json=(s:string)=>JSON.parse(file(s).toString());
const hash=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const data='data/roof-tiers/',bp='public/world/buildings/';
const profile=json(data+'souris-roof-cells.json'),score=json('docs/qa/souris-roof-gate.json');
const packed=file(data+profile.file),cells=gunzipSync(packed);
const values=new Int16Array(Uint8Array.from(cells).buffer);
const index=json(bp+'index.json'),blob=file(bp+'tiles.pack');
const tile=index.tiles.find((t:{id:string})=>t.id===profile.tile);
const f=JSON.parse(gunzipSync(blob.subarray(tile.offset,tile.offset+tile.bytes)).toString()).features;
const orig=f[profile.featureIndex];

test('Kings roof uses exactly the pinned one-feature footprint and audited class-6 cells only',()=>{
 assert.equal(model.atlasSha256,index.sha256);assert.equal(hash(blob),model.atlasSha256);
 assert.equal(hash(cells),profile.sha256);assert.equal(hash(packed),profile.compressedSha256);
 assert.equal(hash(file('src/render/souris-roof.generated.ts').toString().split(' = ')[1].split(' as const')[0]),score.modelDataSha256);
 assert.equal(values.length,5595*6);assert.equal(profile.class6.class6UnwithheldUnique,42869);
 assert.equal(orig.height,32.15);assert.deepEqual(orig.footprint,model.sourceFootprint);
 assert.deepEqual(f.filter(o=>matchesSurveyRoof(model,index.sha256,tile.id,o.footprint,o.holes)),[orig]);
 assert.equal(matchesSurveyRoof(model,index.sha256,'q132',orig.footprint),false);
 assert.equal(matchesSurveyRoof(model,'unrelated',tile.id,orig.footprint),false);
 assert.equal(matchesSurveyRoof(model,index.sha256,tile.id,[...orig.footprint].reverse()),false);
 assert.ok(score.holdoutRidge.p90<.10&&score.holdoutPlane.p90>.4&&score.holdoutFlat.p90>1.5);
 assert.equal(score.acceptedSourcesByTier.reduce((a,b)=>a+b,0)+score.uncertainOrExcluded,5595);
});

type P=RoofPoint;
const high:{p:readonly [P,P,P];y:readonly [number,number,number];n:number}[]=[];
const west:{p:readonly [P,P];lo:readonly [number,number]|undefined;y:readonly [number,number];n:number}[]=[];
emitSurveyRoof(model,{roof:(a,b,c,y,n)=>high.push({p:[a,b,c],y,n}),
 riser:(a,b,lo,y,n)=>west.push({p:[a,b],lo,y,n})});
const area=(a:P,b:P,c:P)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const sc=(q:P)=>{
 const [x,z]=model.mainRidge.originXZ,[a,b]=model.mainRidge.normalXZ;
 return (q.x-x)*a+(q.z-z)*b;
};
const surface=(q:P)=>model.levels[0].y-Math.max(-sc(q),0)*model.mainRidge.leftSlope-Math.max(sc(q),0)*model.mainRidge.rightSlope;

test('joined asymmetric gable and upper shells cover exactly the original area and stay within one tile draw budget',ctx=>{
 let sum=0;
 for(const {p:[a,b,c],y,n} of high){
  const signed=area(a,b,c);assert.ok(signed<0);
  sum-=signed*.5;
  if(n===0){
   const f=[a,b,c].map(sc);
   assert.ok(f.every(v=>v>-1e-7)||f.every(v=>v<1e-7),'top format did not split on the crest');
   for(const [i,p] of [a,b,c].entries())assert.equal(y[i],surface(p));
  }else assert.ok(y.every(v=>v===model.levels[n].y));
 }
 assert.ok(Math.abs(sum-score.originalOutlineM2)<.006);
 for(const {p,y,lo,n} of west){
  if(n<2)assert.ok(p.map(sc).every(v=>v>-1e-7)||p.map(sc).every(v=>v<1e-7),'side crosses ridge uncut');
  if(n===0)assert.equal(lo,undefined);
  if(n===1)assert.deepEqual(lo,p.map(surface));
  if(n===2)assert.ok(lo!.every(v=>v===model.levels[1].y));
  if(lo)assert.ok(lo.every((v,i)=>v<y[i]));
 }
 assert.ok(high.length+west.length*2<=320);
 ctx.diagnostic(`${high.length} roof triangles with continuous ridge; ${west.length} joined riser segments; ${high.length+west.length*2} total triangle shell`);
});

function hit(p:P){
 const v:number[]=[];
 for(const {p:[a,b,c],y,n} of high){
  if(p.x<Math.min(a.x,b.x,c.x)-1e-6||p.x>Math.max(a.x,b.x,c.x)+1e-6||
     p.z<Math.min(a.z,b.z,c.z)-1e-6||p.z>Math.max(a.z,b.z,c.z)+1e-6)continue;
  const aa=area(a,b,p),bb=area(b,c,p),cc=area(c,a,p);
  if(aa<1e-7&&bb<1e-7&&cc<1e-7){
   const tot=area(a,b,c);
   v.push(n>0?y[0]:(y[0]*bb+y[1]*cc+y[2]*aa)/tot);
  }
 }
 return [...new Set(v.map(h=>Math.round(h*1e5)/1e5))];
}
const percentile=(xs:number[],f:number)=>xs.sort((a,b)=>a-b)[Math.floor((xs.length-1)*f)];

test('locally projected native evidence compares old and actual emitted Three planes',ctx=>{
 const q=score.qaProjection;assert.ok(q.maxErrorM<.002);
 const [x,z]=q.worldOriginXZ,[ax,az]=q.eastStepXZ,[bx,bz]=q.northStepXZ;
 const terrain=json('public/world/terrain.json');
 const T=new Terrain(terrain,new Int16Array(Uint8Array.from(gunzipSync(file('public/world/'+terrain.file))).buffer));
 const pts=model.sourceFootprint.map(q=>project(...q));
 const center=pts.reduce((s,p)=>({x:s.x+p.x/pts.length,z:s.z+p.z/pts.length}),{x:0,z:0});
 const prev=T.meshElevation(center.x,center.z)+.05+orig.height;
 const baseline:number[]=[],current:number[]=[];
 for(let i=0;i<values.length;i+=6){
  const [row,col,dsm]=values.subarray(i,i+6);
  const y=dsm*.01,p={x:x+ax*row+bx*col,z:z+az*row+bz*col};
  const a=hit(p);
  assert.equal(a.length,1,`numeric projected boundary at native cell ${row},${col}`);
  assert.ok(a[0]>T.meshElevation(p.x,p.z)+2);
  baseline.push(Math.abs(prev-y));current.push(Math.abs(a[0]-y));
 }
 const a=percentile(baseline,.9),b=percentile(current,.9);
 assert.ok(a>22&&b<.26);
 for(const p of [{x:x-70,z},{x:x+280,z:z+60},{x:x-24,z:z+220}])assert.deepEqual(hit(p),[]);
 ctx.diagnostic(`original roof ${prev.toFixed(2)}m; 5,595 actual triangle hits: DSM p90 ${a.toFixed(2)}m → ${b.toFixed(2)}m`);
});

test('generalized emitter preserves exact previously released Quartermaster vertices and order',()=>{
 const row:unknown[][]=[];
 emitQuartermasterRoof({roof:(...a)=>row.push(['roof',...a]),riser:(...a)=>row.push(['wall',...a])});
 assert.equal(hash(JSON.stringify(row)),'c71e3aa4cf9c4c470ebdbfdb57c380fada9b19408b9a09c99066819fcfcc8740');
});
