import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Raycaster,Vector3} from 'three';
import {makeTignishRoof,type RoofRecipe} from '../tools/art/tignish-simon-jude-study/nave/roof.ts';
import {makeTignishNaveSideJoins,type NaveSideEvidence} from '../tools/art/tignish-simon-jude-study/nave/side-joins.ts';

const file=(p:string)=>readFileSync(new URL('../'+p,import.meta.url));
const raw=file('tools/art/tignish-simon-jude-study/nave/fit.json');
const roof:RoofRecipe=JSON.parse(raw.toString('utf8'));
const g=JSON.parse(file('data/tignish-nave-mosaic-study/observations.json').toString('utf8'));
const sha=(d:Buffer)=>createHash('sha256').update(d).digest('hex');

test('calibration is recovered from 182 non-overlapping earlier rows, not tuned in either new strip',()=>{
 assert.equal(sha(raw),g.basis.digestOfFrozenRoof);
 assert.equal(sha(file('data/tignish-nave-mosaic-study/observations.json')),'c08ea096bb235d3b12ad3d0ddee0eb7bd50d7b2e6ef52af61f2a101b6f84b158');
 assert.equal(g.calibration.length,g.basis.comparisonAnchorCount);assert.equal(g.calibration.length,182);
 assert.deepEqual(g.source.sampling.geotransform,[2284018,1,0,338897,0,-1]);
 assert.deepEqual(g.source.sampling.parentOffset,[284018,161103]);
 const pixels=new Set<string>(),counts=new Map<string,number>();
 const pixel=(row:number,column:number)=>{
  assert.ok([row,column].every(v=>Number.isInteger(v)&&v>=0&&v<256));
  const key=row+':'+column;assert.ok(!pixels.has(key));pixels.add(key);
 };
 const r=g.calibration.map((t:{role:string;row:number;column:number;u:number;v:number;surfaceMetres:number})=>{
  const q=roof.patches.find(x=>x.id===t.role)!;
  assert.equal(q.planes.length,1);
  assert.ok(t.u>=q.u[0]+.5&&t.u<=q.u[1]-.5&&t.v>=q.v[0]+.5&&t.v<=q.v[1]-.5);
  const [c,u,v]=q.planes[0];pixel(t.row,t.column);counts.set(t.role,(counts.get(t.role)??0)+1);
  return t.surfaceMetres-(c+u*t.u+v*t.v);
 }).sort((a:number,b:number)=>a-b);
 assert.deepEqual([...counts.values()].sort((a,b)=>a-b),[42,43,48,49]);
 assert.ok(Math.abs((r[90]+r[91])*.5-g.basis.registeredMosaicFitBiasM)<1e-12);
 for(const k of ['north','south'])for(const [row,col] of g.strips[k].nativePixels)pixel(row,col);
 assert.equal(pixels.size,204);
});

test('actual Three.js joins connect only the two measured side faces, and all 22 interior rays hit the declared geometry',()=>{
 const a=makeTignishNaveSideJoins(roof,g),b=makeTignishRoof(roof);
 try{
  assert.equal(a.group.parent,null);assert.equal(a.group.children.length,1);
  assert.deepEqual(a.roles,[{side:'north',start:0,end:6},{side:'south',start:6,end:12}]);
  assert.equal(a.mesh.geometry.getAttribute('position').count,12);
  assert.equal(a.mesh.material.map,null);
  const at=(u:number,v:number)=>new Vector3(roof.world.worldXZAtUV00[0]+u*roof.world.worldXZPerU[0]+v*roof.world.worldXZPerV[0],
   76,roof.world.worldXZAtUV00[1]+u*roof.world.worldXZPerU[1]+v*roof.world.worldXZPerV[1]);
  const rays=(u:number,v:number)=>new Raycaster(at(u,v),new Vector3(0,-1,0));
  const counts=[];
  for(const k of ['north','south']){
   const q=g.strips[k],results=[];
   for(const [u,v,_s,pred,res] of q.cellsUVSurfacePredictionResidual){
    const r=rays(u,v),joined=r.intersectObject(a.mesh),prior=r.intersectObjects(b.children);
    assert.equal(joined.length,1);assert.equal(prior.length,0);
    assert.ok(Math.abs(joined[0].point.y-pred)<.00001);
    assert.ok(joined[0].face!.normal.y>.60);
    results.push(Math.abs(res));
   }
   counts.push(results.length);
  }
  assert.deepEqual(counts,[12,10]);
  assert.equal(rays(4.3,-2.78).intersectObject(a.mesh).length,0,'the unsupported crown stays open');
  assert.equal(rays(5.21,0).intersectObject(a.mesh).length,0,'source roof begins outside new strip');
  assert.equal(rays(4.3,7).intersectObject(a.mesh).length,0,'no extra shoulders');
 }finally{
  a.dispose();
  b.traverse(o=>{if('geometry' in o)(o as (typeof a.mesh)).geometry.dispose();if('material' in o)(o as (typeof a.mesh)).material.dispose();});
 }
});

test('a bad source pin, displaced measured edge or poorly fitted cell refuses the complete study',()=>{
 const tryWith=(mutate:(e:NaveSideEvidence)=>void)=>{
  const q=structuredClone(g);mutate(q);
  assert.throws(()=>makeTignishNaveSideJoins(roof,q),/scope/);
 };
 tryWith(e=>e.basis.surfaceGrid='unknown');
 const moved=structuredClone(roof);moved.world.worldXZAtUV00[0]+=.02;
 assert.throws(()=>makeTignishNaveSideJoins(moved,g),/scope/);
 const ring=structuredClone(roof);ring.outlineUV[4][0]+=.1;
 assert.throws(()=>makeTignishNaveSideJoins(ring,g),/scope/);
 const shifted=structuredClone(roof);
 for(const q of shifted.patches.filter(x=>x.id.startsWith('nave-north-')))q.v[0]-=.15;
 assert.throws(()=>makeTignishNaveSideJoins(shifted,g),/scope/);
 const plane=structuredClone(roof);plane.patches[0].planes[0][0]+=.2;
 assert.throws(()=>makeTignishNaveSideJoins(plane,g),/scope/);
 tryWith(e=>e.strips.north.verticesUVH[0][2]+=.01);
 tryWith(e=>{
  const row=e.strips.north.cellsUVSurfacePredictionResidual[0];
  row[2]+=1;row[4]+=1;
 });
 tryWith(e=>e.strips.south.cellsUVSurfacePredictionResidual.length=2);
});

test('168 preregistered native first returns hit the four new triangles without a raster height offset',()=>{
 const a=makeTignishNaveSideJoins(roof,g);
 try{
  assert.deepEqual(['north','south'].map(k=>g.nativeReturns.results[k].distinct),[88,80]);
  for(const k of ['north','south']){
   const n=g.nativeReturns.results[k];
   const errors=n.evidenceRows.map(([u,v,z,y,e]:number[])=>{
    const x=roof.world.worldXZAtUV00[0]+u*roof.world.worldXZPerU[0]+v*roof.world.worldXZPerV[0];
    const h=roof.world.worldXZAtUV00[1]+u*roof.world.worldXZPerU[1]+v*roof.world.worldXZPerV[1];
    const ray=new Raycaster(new Vector3(x,76,h),new Vector3(0,-1,0));
    const hits=ray.intersectObject(a.mesh);assert.equal(hits.length,1);
    assert.ok(Math.abs(hits[0].point.y-y)<.00001);
    assert.ok(Math.abs((z-hits[0].point.y)-e)<.00001);
    return Math.abs(e);
   });
   assert.ok(Math.max(...errors)<.097);
  }
 }finally{a.dispose();}
});

test('mosaic-only geometry is not approved, even if its 22 cell centres agree',()=>{
 const bad=structuredClone(g);bad.nativeReturns.results.north.evidenceRows.length=2;
 assert.throws(()=>makeTignishNaveSideJoins(roof,bad),/scope/);
 const cell=structuredClone(g);cell.nativeReturns.results.south.evidenceRows[0][2]+=.70;
 cell.nativeReturns.results.south.evidenceRows[0][4]+=.70;
 assert.throws(()=>makeTignishNaveSideJoins(roof,cell),/scope/);
});
