import assert from 'node:assert/strict';
import {test} from 'node:test';
import {drySupport,dryToWorld,soilEnvelope,makeDryGrains,worldToDry} from '../src/render/dry-coast/soil.ts';
test('a local optics medium is not a terrain or saltwater override',()=>{
 const u=-4.1,v=1.85,flat=(type:number,signed:number,height:number,slope:number,weight:number)=>drySupport(u,v,type,signed,height,slope,weight);
 assert.equal(soilEnvelope(u,v),1);
 assert(flat(30,62,2.84,1,1)>.99);
 for(const bad of [[80,62,2.84,1,1],[10,62,2.84,1,1],[30,5,2.84,1,1],[30,62,1.8,1,1],[30,62,2.84,.86,1],[30,62,2.84,1,.49]] as const)assert.equal(flat(...bad),0);
 assert.equal(soilEnvelope(u+17.51,v),0);
 const [x,z]=dryToWorld(u,v),p=worldToDry(x,z);
 assert(Math.hypot(u-p[0],v-p[1])<1e-8);
});
test('local grains are authored and deterministic linear data',()=>{
 const a=makeDryGrains(),b=makeDryGrains();
 assert.equal(a.image.width,192);assert.equal(a.image.height,192);assert.equal(a.image.data!.length,147456);
 assert.deepEqual(a.image.data,b.image.data);assert(a.generateMipmaps);
 a.dispose();b.dispose();
});
