import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Roads} from '../src/render/roads.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';
import type {CoastalGrid,MeshSurveySpec} from '../src/sim/coastal-terrain.ts';

test('a road tile swaps one rendered mesh when inland ground enters or leaves the near LOD',()=>{
 const frame:TerrainSpec={width:8,height:8,bounds:[-64.47,45.94,-61.93,47.1]};
 const mark:MeshSurveySpec={id:'test-gate',kind:'inland',tileX:13,tileZ:13,firstX:35,firstZ:34,cellsX:4,cellsZ:4,sub:7,sha256:'a'.repeat(64)};
 const n=mark.cellsX*mark.sub+1;
 const t=new Terrain(frame,new Int16Array(64).fill(10),[],[{spec:mark,samples:new Int16Array(n*n).fill(1800)}]);
 const g=t.inlandGrids[0],x=(g.x0+g.x1)*.5,z=(g.z0+g.z1)*.5,T=5000;
 const i=Math.floor(x/T),j=Math.floor(z/T);
 const tile={x:(i+.5)*T,z:(j+.5)*T,segments:[g.x0-23,z,g.x1+20,z,1]};
 const scene=new THREE.Scene();let shown:CoastalGrid[]=[];
 const roads=Reflect.construct(Roads,[scene,new Map([[i+','+j,tile]]),t,undefined,()=>shown]) as Roads;
 roads.update(x,z);
 const group=scene.getObjectByName('PEI National Road Network')!;
 assert.equal(group.children.length,1);
 const mesh=group.children[0] as THREE.Mesh;
 const original=mesh.geometry;let killedBase=0,killedFine=0;
 original.addEventListener('dispose',()=>killedBase++);
 shown=[g];
 roads.update(x,z); // stationary location: world LOD can change first.
 const fine=mesh.geometry;
 assert.equal(group.children[0],mesh);assert.equal(group.children.length,1);
 assert.notEqual(fine,original);
 assert.ok(fine.getAttribute('position').count>original.getAttribute('position').count);
 fine.addEventListener('dispose',()=>killedFine++);
 shown=[];roads.update(x,z);
 assert.equal(mesh.geometry,original);
 shown=[g];roads.update(x,z);assert.equal(mesh.geometry,fine);
 roads.update(x+100000,z+100000);
 assert.equal(group.children.length,0);
 assert.equal(killedBase,1);assert.equal(killedFine,1);
});
