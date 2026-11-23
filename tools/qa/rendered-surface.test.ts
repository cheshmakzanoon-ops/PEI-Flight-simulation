import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {makeTerrainPatchHeight,planeCellHeight} from './rendered-surface.ts';

test('the diagonal is a triangle edge, not bilinear interpolation',()=>{
 assert.equal(planeCellHeight(.5,.5,0,10,10,0),10);
 const flat=makeTerrainPatchHeight({x0:0,z0:0,w:3,d:3,n:3},(x,z)=>2*x-3*z);
 assert.equal(flat(1.5,1.5),-1.5);
 assert.equal(flat(-1,2),undefined);
 const conformed=makeTerrainPatchHeight({x0:0,z0:0,w:64,d:64,n:16,neighborSegments:[4,16,16,16]},(x,z)=>x*x+z);
 assert.equal(conformed(8,0),128);
});
test('type-independent height evaluator matches raycasts through an actual Three.js plane',()=>{
 const x0=-54681.719,z0=999.235,w=6459.331,d=5998.419,n=56;
 const base=(x:number,z:number)=>50+20*Math.sin(x*.004)*Math.cos(z*.005)+2*Math.sin(x*.03);
 const g=new T.PlaneGeometry(w,d,n,n);g.rotateX(-Math.PI/2);
 const p=g.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setY(i,base(p.getX(i)+x0+w/2,p.getZ(i)+z0+d/2));
 const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));
 m.position.set(x0+w/2,0,z0+d/2);m.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0)),expected=makeTerrainPatchHeight({x0,z0,w,d,n},base);
 for(let i=0;i<200;i++){
  const x=x0+w*(.001+.998*((i*613)%997)/997),z=z0+d*(.001+.998*((i*211)%991)/991);
  ray.ray.origin.set(x,400,z);
  const hit=ray.intersectObject(m)[0];
  assert.ok(hit&&Math.abs(hit.point.y-expected(x,z)!)<1e-6);
 }
});
