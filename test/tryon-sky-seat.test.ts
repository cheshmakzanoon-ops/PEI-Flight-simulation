import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeshBasicMaterial, AdditiveBlending, AlwaysDepth } from 'three';
import { capeTryonSkySeatRequested } from '../src/app/scenery-profile.ts';
import { CAPE_TRYON_SKY_SEAT, ordinarySkySeatOwner } from '../src/render/cape-tryon-sky-seat.ts';
import { opaqueCoverageBlend } from '../src/render/opaque-coverage-alpha.ts';
import { createHash } from 'node:crypto';

const flag='capeTryonSkySeatReview';
test('the isolated early layer is explicit and refuses incompatible scenery',()=>{
 const yes=[flag,`${flag}&scenery=standard&stockCapeTryonRock`,`${flag}&diagnostics&departure=cape-tryon-coast`];
 const no=['',`${flag}&${flag}`,`${flag}&scenery=detail`,`${flag}&scenery=standard&scenery=standard`,
   `${flag}&stockOpenCoast`,`${flag}&legacyShoreArcs`,`${flag}&capeTryonWaterReview`,`${flag}&unrecognizedProfile`];
 for(const s of yes)assert(capeTryonSkySeatRequested(new URLSearchParams(s)),s);
 for(const s of no)assert(!capeTryonSkySeatRequested(new URLSearchParams(s)),s);
});

test('foreground custody cannot assume hidden or exceptional draws are ordinary',()=>{
 const good=new MeshBasicMaterial();
 assert(ordinarySkySeatOwner(good));
 const other=new MeshBasicMaterial({colorWrite:false,visible:false});
 assert(!ordinarySkySeatOwner(other));
 const accepted=new MeshBasicMaterial(opaqueCoverageBlend);
 assert(ordinarySkySeatOwner(accepted));
 accepted.blending=AdditiveBlending;assert(!ordinarySkySeatOwner(accepted));
 good.depthFunc=AlwaysDepth;assert(!ordinarySkySeatOwner(good));
 good.dispose();other.dispose();accepted.dispose();
});

test('the render shape is the exact separately measured three-triangle packet',()=>{
 const bytes=Buffer.alloc(CAPE_TRYON_SKY_SEAT.length*4);
 for(const [i,v] of CAPE_TRYON_SKY_SEAT.entries())bytes.writeFloatLE(v,i*4);
 assert.equal(bytes.length,108);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  'b9133ef0eab928fac3f7c2c12cc6d8935e9cd3e64bf46bdeaea68054c72cb855');
});
