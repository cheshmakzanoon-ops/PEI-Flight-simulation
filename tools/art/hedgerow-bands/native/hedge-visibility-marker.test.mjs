import assert from 'node:assert/strict';import {test} from 'node:test';
import {makeInstanceCoverageTexture,markerSource} from './hedge-visibility-marker.ts';
test('sorted original appended lane only; no forest prefix, aliases, or outside slots',()=>{
 const p=makeInstanceCoverageTexture([179,705,29000],175,30000);assert(p);
 const data=p.texture.image.data;
 assert.deepEqual(Array.from(data).flatMap((v,i)=>v?[i]:[]),[179,705,29000]);
 assert.equal(p.texture.image.width,256);assert.equal(p.texture.image.height,176);
 for(const s of [[11],[177,177],[30000],[181,179],[],[175.5]])assert(!makeInstanceCoverageTexture(s,175,30000));
 p.close();
});
test('same shader plus RGB write only after old alpha and display transforms',()=>{
 const original={vertex:' attribute vec3 stem;attribute vec4 shape;\n void main(){ }',
  fragment:' void main(){ if(a<.30)discard; gl_FragColor=vec4(c,clamp((a-.30)*3.8,0.,1.));\n #include <colorspace_fragment>\n }'};
 const m=markerSource(original,original);assert(m);
 assert(m.vertex.includes('hedgeProofOwner=gl_InstanceID;'));
 assert.equal(m.fragment.split('gl_FragColor=vec4').length,2);
 assert(m.fragment.indexOf('gl_FragColor.rgb=hedgeProofRGB')>m.fragment.indexOf('colorspace_fragment'));
 assert(!markerSource({...original,vertex:original.vertex+' '},original));
 const foreign={...original,fragment:original.fragment.replace('discard','return')};
 assert(!markerSource(foreign,foreign));
});
