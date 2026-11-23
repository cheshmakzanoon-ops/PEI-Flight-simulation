import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveRelief} from '../src/sim/adaptive-relief.ts';
import {facet} from '../src/sim/coastal-terrain.ts';

test('adaptive relief creates no coarse boundary cracks and shares identical refined edges',()=>{
 const n=16,split=4,nv=n+1;
 const old=Float32Array.from({length:nv*nv},(_,i)=>Math.sin(i*.42)*8+Math.cos(i*.22)*24);
 const can=(i:number,j:number)=>(i>=3&&i<=12&&j>=4&&j<=10&&(i+j)%7!==0)||i===0;
 const survey=(u:number,v:number)=>((u+v)*97|0)===59?undefined:16*Math.cos(u*21+v*32);
 const g=new AdaptiveRelief({n,split,baseline:old,survey,canRefine:can});
 const h=(i:number,j:number)=>old[j*nv+i];
 const np=split+1;
 const rel=(i:number,j:number,a:number,b:number)=>g.cellOffset[j*n+i]+b*np+a;
 const draw=(i:number)=>g.positions.subarray(i*3,i*3+3);
 let shared=0,coarse=0;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  if(g.cellOffset[j*n+i]<0)continue;
  for(const [dx,dz,a,b] of [[-1,0,0,-1],[1,0,split,-1],[0,-1,-1,0],[0,1,-1,split]])for(let k=0;k<=split;k++){
   const q=draw(rel(i,j,a<0?k:a,b<0?k:b));
   if(g.cellOffset[(j+dz)*n+i+dx]>=0){
    const x=dx<0?split:dx>0?0:k,z=dz<0?split:dz>0?0:k;
    assert.deepEqual(q,draw(rel(i+dx,j+dz,x,z)));shared++;
   }else{
    const x=a<0?k/split:a/split,z=b<0?k/split:b/split;
    assert.ok(Math.abs(q[1]-facet(x,z,h(i,j),h(i+1,j),h(i,j+1),h(i+1,j+1)))<2e-6);
    coarse++;
   }
  }
 }
 assert.ok(shared>400&&coarse>100);
 assert.ok(g.selected.every((v,i)=>i%n!==0||v===0));
 assert.ok(g.indices.length>6*(n*n+g.refinedCells*(split**2-1)));
 for(let i=0;i<g.indices.length;i+=3){
  const [a,b,c]=g.indices.subarray(i,i+3),p=g.positions;
  assert.ok((p[b*3+2]-p[a*3+2])*(p[c*3]-p[a*3])-(p[b*3]-p[a*3])*(p[c*3+2]-p[a*3+2])>0);
 }
});

test('adaptive sampler matches packed rendered triangles and keeps inherited protected cells',()=>{
 const n=12,split=3,w=n+1;
 const old=Float32Array.from({length:w*w},(_,i)=>Math.sin(i)*3+(i%7)*2);
 const g=new AdaptiveRelief({n,split,baseline:old,
   canRefine:(i,j)=>i>2&&j>3,survey:(u,v)=>18*Math.sin(u*21-v*26)});
 let triangle=0,max=0;
 for(let k=0;k<g.indices.length;k+=3){
  const a=g.indices[k]*3,b=g.indices[k+1]*3,c=g.indices[k+2]*3,p=g.positions;
  for(const [i,j] of [[.13,.18],[.4,.4],[.67,.21],[.88,.04]]){
   const z=1-i-j;
   const x=p[a]*i+p[b]*j+p[c]*z,v=p[a+2]*i+p[b+2]*j+p[c+2]*z,y=p[a+1]*i+p[b+1]*j+p[c+1]*z;
   max=Math.max(max,Math.abs(g.height(x,v)-y));triangle++;
  }
 }
 assert.ok(triangle>4000&&max<.00008,String(max));
 for(let i=0;i<n;i++)for(let j=0;j<3;j++){
  const k=j*w+i;
  assert.ok(Math.abs(g.height((i+.52)/n,(j+.39)/n)-facet(.52,.39,old[k],old[k+1],old[k+w],old[k+w+1]))<1e-12);
 }
});
