import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferAttribute,Mesh,MeshBasicMaterial,PlaneGeometry,Scene} from 'three';
import {PRINCE_OVERVIEW_CELLS} from '../src/render/prince-grassland/source.ts';
import {PrinceLandscapeLease} from '../src/render/prince-grassland/lease.ts';
function state(){
 const g=new PlaneGeometry(112,112,112,112).rotateX(-Math.PI/2);
 const mesh=new Mesh(g,new MeshBasicMaterial()),scene=new Scene();scene.add(mesh);
 const lens=new PrinceLandscapeLease(mesh,{cells:PRINCE_OVERVIEW_CELLS,survey:()=>4});
 const rims=Array.from({length:113*113},(_,i)=>i).filter(i=>i<113||i>=112*113||i%113===0||i%113===112)
  .map(i=>[i,g.getAttribute('position').getY(i)] as const);
 return {g,mesh,scene,lens,rims};
}
test('continuously installed contact is independent of an alternate render bracket',()=>{
 const {g,mesh,scene,lens,rims}=state();
 assert(lens.valid(scene,rims));
 const s=[-44.5,5.5,1,true,false] as const;
 assert.equal(lens.contact(...s),1);
 lens.arm();const ground=lens.contact(...s);assert(ground>1);
 assert.equal(mesh.geometry,g);
 const close=lens.begin(scene);assert(close);assert.equal(mesh.geometry,lens.raised);
 assert.equal(lens.contact(...s),ground);
 close();assert.equal(mesh.geometry,g);assert.equal(lens.contact(...s),ground);
 assert(lens.valid(scene,rims));lens.close();assert.equal(lens.contact(...s),1);
});
test('same-token edge movement or changed arrays cannot be mistaken for original terrain',()=>{
 const {g,mesh,scene,lens,rims}=state();assert(lens.valid(scene,rims));
 const i=56,base=g.getAttribute('position') as BufferAttribute,raised=lens.raised.getAttribute('position'),y=base.getY(i);
 // A legitimate native neighbour revision is evaluated from new authenticated edge values.
 const newRim=rims.map(([k,v])=>[k,k===i?Math.fround(v+.125):v] as const);base.setY(i,y+.125);base.needsUpdate=true;
 lens.synchronizeRim(newRim);
 assert(lens.valid(scene,newRim));
 raised.setY(i,y+2);assert(!lens.valid(scene,newRim));raised.setY(i,y+.125);
 base.setY(i,y+3);assert(!lens.valid(scene,newRim));base.setY(i,y+.125);
 const raw=base.array;base.array=raw.slice();assert(!lens.valid(scene,newRim));base.array=raw;
 const oldIndex=g.index!,candidate=lens.raised.index!;
 oldIndex.normalized=true;assert(!lens.valid(scene,newRim));oldIndex.normalized=false;
 candidate.normalized=true;assert(!lens.valid(scene,newRim));candidate.normalized=false;
 assert(lens.valid(scene,newRim));
 const rogue=g.clone();mesh.geometry=rogue;lens.close();assert.equal(mesh.geometry,rogue);
});
