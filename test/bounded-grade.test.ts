import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BoundedGrade,boundedGradeTiles} from '../src/sim/bounded-grade.ts';
import {GROUND_LIFT} from '../src/sim/coastal-terrain.ts';
const bounds={left:0,top:0,right:3584,bottom:2464};
const spec={id:'local-test',tileX:1,tileZ:2,firstX:12,firstZ:14,cellsX:1,cellsZ:1,sub:4,sha256:'test',relativeToParent:true}as const;
const H=(x:number,z:number)=>12+x*.008-z*.003;
const sample=()=>({rel:new Int16Array(25),weight:new Uint8Array(25)});

test('core changes exactly with the submitted triangle, anchors and unsupported terrain do not change',()=>{
 const {rel,weight}=sample();
 rel[12]=137;weight[12]=255;
 const q=new BoundedGrade(bounds,spec,rel,weight,H),g=q.grid;
 const x=g.x0+2*g.stepX,z=g.z0+2*g.stepZ;
 assert.equal(q.weight(x,z),1);
 assert.equal(q.contactY(x,z,6),q.visualY(x,z));
 assert(Math.abs(q.visualY(x,z)!-H(x,z)-GROUND_LIFT-1.37)<.00001);
 const stock=H(x,z)+GROUND_LIFT+.17;
 for(const dx of [-.55,.55]){
  const a=q.contactY(x+dx,z,stock);
  assert.equal(a,stock);
 }
 assert.equal(q.contactY(g.x0,g.z0,stock),stock);
 const x2=x+.125,w=q.weight(x2,z),facet=g.parentHeight(x2,z)+GROUND_LIFT;
 assert.equal(w,.5);
 assert(Math.abs(q.contactY(x2,z,stock)-(q.visualY(x2,z)!+.5*(stock-facet)))<1e-10);
});

test('a malformed or unsupported relative correction cannot escape its bounded inset',()=>{
 const {rel,weight}=sample();
 rel[0]=50;weight[0]=10;
 assert.throws(()=>new BoundedGrade(bounds,spec,rel,weight,H),/outer reserve/);
 rel[0]=weight[0]=0;
 rel[12]=1;
 assert.throws(()=>new BoundedGrade(bounds,spec,rel,weight,H),/unsupported/);
 rel[12]=221;weight[12]=255;
 assert.throws(()=>new BoundedGrade(bounds,spec,rel,weight,H),/ceiling/);
});

test('the specimen may pin a different tight ceiling without lifting the hard format limit',()=>{
 const {rel,weight}=sample();
 rel[12]=237;weight[12]=255;
 assert.throws(()=>new BoundedGrade(bounds,spec,rel,weight,H),/validated ceiling/);
 assert.throws(()=>new BoundedGrade(bounds,{...spec,maxRelativeDeltaCm:235},rel,weight,H),/validated ceiling/);
 const q=new BoundedGrade(bounds,{...spec,maxRelativeDeltaCm:240},rel,weight,H);
 const x=q.grid.x0+2*q.grid.stepX,z=q.grid.z0+2*q.grid.stepZ;
 assert(Math.abs(q.visualY(x,z)!-H(x,z)-GROUND_LIFT-2.37)<1e-5);
 for(const bad of [251,NaN,1.5,0])assert.throws(()=>new BoundedGrade(bounds,{...spec,maxRelativeDeltaCm:bad},rel,weight,H),/Invalid bounded grade ceiling/);
});

test('the exact native grade is independent, demanded and fails closed',async()=>{
 const {readFileSync}=await import('node:fs');
 const {GABLES_GRADE:s}=await import('../src/sim/gables-grade.generated.ts');
 const {gradeAtlasMatches,loadBoundedGrade}=await import('../src/sim/bounded-grade.ts');
 const f=new Uint8Array(readFileSync(new URL('../public/world/'+s.file,import.meta.url)));
 assert.equal(f.length,s.wireBytes);
 assert(gradeAtlasMatches(s,s.terrainSha256,s.coverCompressedSha256,s.coverDecodedSha256));
 assert(!gradeAtlasMatches(s,s.terrainSha256,s.coverCompressedSha256,'old'));
 const actual=await loadBoundedGrade(s,'/world/',async(path,opts)=>{
   assert.equal(path,'/world/'+s.file);assert(opts?.signal);return new Response(f);
 });
 assert(actual);
 assert.equal(actual(bounds,H).grid.spec.id,s.id);
 for(const invalid of [new Response(new Uint8Array(65_000)),new Response(new Uint8Array(f.length)),new Response(null,{status:404})]){
  assert.equal(await loadBoundedGrade(s,'/world/',async()=>invalid),undefined);
 }
 let aborted=false;
 assert.equal(await loadBoundedGrade(s,'/world/',(_url,init)=>new Promise((_ok,no)=>{
   init?.signal?.addEventListener('abort',()=>{aborted=true;no(Error('expired'));},{once:true});
 }),12),undefined);
 assert(aborted);
});

test('neighbourhood signatures invalidate only where a measured grade may touch',()=>{
 const {rel,weight}=sample();
 rel[12]=65;weight[12]=184;
 const q=new BoundedGrade(bounds,spec,rel,weight,H),g=q.grid;
 const x=g.x0+2*g.stepX,z=g.z0+2*g.stepZ;
 assert(q.affectsBounds([x,z,x+.05,z+.05]));
 assert(q.affectsBounds([x+g.stepX,z-g.stepZ,x+g.stepX+.02,z-g.stepZ+.01]));
 assert(!q.affectsBounds([x+g.stepX+.02,z,x+g.stepX+.08,z+.04]));
 assert(!q.affectsBounds([x-2*g.stepX,z-2*g.stepZ,x-1.1*g.stepX,z-1.1*g.stepZ]));
});


test('independent local grade tiles coexist and cannot take another site or the inherited edge',()=>{
 const a=sample(),b=sample();
 a.rel[12]=137;a.weight[12]=255;b.rel[12]=-40;b.weight[12]=255;
 const left=new BoundedGrade(bounds,spec,a.rel,a.weight,H);
 const other={...spec,id:'different-site',tileX:3,tileZ:5};
 const right=new BoundedGrade(bounds,other,b.rel,b.weight,H);
 const registered=boundedGradeTiles([left,right]);
 assert.deepEqual([...registered.keys()],['1-2','3-5']);
 assert.equal(registered.get('1-2'),left);
 assert.equal(registered.get('3-5'),right);
 for(const [p,unrelated] of [[left,right],[right,left]] as const){
  const x=p.grid.x0+2*p.grid.stepX,z=p.grid.z0+2*p.grid.stepZ;
  assert.equal(p.weight(x,z),1);assert.equal(unrelated.weight(x,z),0);
  assert(Math.abs(p.contactY(x,z,40)-p.visualY(x,z)!)<1e-12);
  assert.equal(unrelated.contactY(x,z,40),40);
 }
 const regrid=(v:Partial<import('../src/sim/coastal-terrain.ts').MeshSurveySpec>)=>new BoundedGrade(bounds,{...other,...v},b.rel,b.weight,H);
 assert.throws(()=>boundedGradeTiles([left,regrid({tileX:1,tileZ:2})]),/share an owner/);
 assert.throws(()=>boundedGradeTiles([left,regrid({id:'local-test'})]),/share an owner/);
 assert.throws(()=>boundedGradeTiles([regrid({firstX:0})]),/inherited edge/);
 assert.throws(()=>boundedGradeTiles([regrid({tileZ:22})]),/inherited edge/);
});
