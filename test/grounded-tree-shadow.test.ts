import assert from 'node:assert/strict';
import test from 'node:test';
import {facet} from '../src/sim/coastal-terrain.ts';
import {shadowFootprint,groundedShadow} from '../src/render/grounded-tree-shadow.ts';

test('the same original tree shadow footprint and UVs are split onto exact affine terrain faces',()=>{
 const tree={x:21.31,y:75.1,z:-17.87,width:15.65,height:16.4,variant:1},
  grid={x0:0,z0:0,dx:4.1,dz:3.9},[a,b,c,d]=shadowFootprint(tree);
 assert.ok(Math.abs((a.x+c.x)/2-(tree.x+.43*tree.height))<1e-12);
 assert.ok(Math.abs((a.z+c.z)/2-(tree.z+.21*tree.height))<1e-12);
 const f=(x:number,z:number)=>{
  const q=x/grid.dx,r=z/grid.dz,i=Math.floor(q),j=Math.floor(r);
  const val=(x:number,y:number)=>55+Math.sin(x*.81+y*.37)*4+Math.cos(y*.57)*2;
  return facet(q-i,r-j,val(i,j),val(i+1,j),val(i,j+1),val(i+1,j+1));
 };
 const out:Array<{x:number;y:number;z:number;u:number;v:number}>=[];
 groundedShadow(tree,grid,f,(x,y,z,u,v,kind)=>{
  assert.equal(kind,tree.variant);
  assert.ok(Math.abs(x-(a.x+(b.x-a.x)*u))<1e-9&&Math.abs(z-(a.z+(d.z-a.z)*v))<1e-9);
  out.push({x,y,z,u,v});
 });
 assert.ok(out.length>25);
 let a0=0;
 for(let i=0;i<out.length;i+=3){
  const s=out[i],t=out[i+1],u=out[i+2];
  const cross=(t.x-s.x)*(u.z-s.z)-(t.z-s.z)*(u.x-s.x);
  assert.ok(cross<0);a0+=-cross*.5;
  for(const [w,v] of [[.1,.55],[.37,.18],[.48,.47]]){
   const w2=1-w-v;
   const x=s.x*w+t.x*v+u.x*w2,y=s.y*w+t.y*v+u.y*w2,z=s.z*w+t.z*v+u.z*w2;
   assert.ok(Math.abs(y-f(x,z)-.024)<1e-9);
  }
 }
 assert.ok(Math.abs(a0-(b.x-a.x)*(d.z-a.z))<1e-8);
});

import {Scene,Texture,Vector3} from 'three';
import {GroundedTreeShadows} from '../src/render/grounded-tree-shadow.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import type {World} from '../src/render/world.ts';

test('a live adaptive tile withdraws and restores only its dependent close shadow seat',()=>{
 const terrain=new Terrain({width:4,height:4,bounds:[-64.47,45.94,-61.93,47.1]},Int16Array.from({length:16},()=>65));
 const cover=new Cover(4,4,Uint8Array.from({length:32},(_,i)=>i%2?255:10));
 let adaptive=false;
 const world={terrain,cover,get adaptiveState(){return adaptive?{active:['16-11']}:null;},
  visualGroundSignature(){return adaptive?'112/112*;':'112/112;';}} as unknown as World;
 const sc=new Scene(),fade={value:new Vector3(38,50,1)},shadow=new GroundedTreeShadows(sc,world,new Texture(),fade,12);
 const stems=new Float32Array([0,64.8,0]),shapes=new Float32Array([14.,10.,1.,1.]),active=new Float32Array([1]);
 shadow.update(stems,shapes,active,1,7);
 assert.equal(shadow.count,1);assert.equal(shadow.mask.getX(0),1);
 const defaultGeo=shadow.mesh.geometry;
 shadow.update(stems,shapes,active,1,7);assert.equal(shadow.mesh.geometry,defaultGeo);
 adaptive=true;shadow.update(stems,shapes,active,1,7);
 assert.equal(shadow.count,0);assert.equal(shadow.mask.getX(0),0);
 adaptive=false;shadow.update(stems,shapes,active,1,7);
 assert.equal(shadow.count,1);assert.equal(shadow.mask.getX(0),1);
 fade.value.z=0;shadow.update(stems,shapes,active,1,7);
 assert.equal(shadow.count,0);assert.ok(!shadow.mesh.visible);
});
