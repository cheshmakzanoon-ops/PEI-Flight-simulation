import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {lighthouseGroundGLSL} from '../src/render/lighthouse-ground.ts';
import {EAST_FOG_RECEIVER_SOURCE,patchDetachedFogLight,verifyDetachedFogReceiverSource}
 from '../tools/art/east-fog-study/east-fog-ground-light-study.ts';
const kernel=readFileSync(new URL('../tools/art/east-fog-study/east-fog-static-caster.glsl',import.meta.url),'utf8');
const stock={
 vertexShader:'varying vec3 p; varying vec2 vuv;\nvoid main(){vec4 w=position; p=w.xyz;vuv=uv;}',
 fragmentShader:lighthouseGroundGLSL+
  '\nvoid main(){\n#include <logdepthbuf_fragment>\nif(coast<0.)discard; col=stationGround(col,p.xz,coast);}',
};
test('actual stock lighthouse fragment keeps West, old outdoor roles and both neutral alternatives',()=>{
 const v=patchDetachedFogLight(stock,kernel);assert(v);
 assert.equal(createHash('sha256').update(kernel).digest('hex'),EAST_FOG_RECEIVER_SOURCE.kernel);
 const inherited=(s:string)=>s.split('// The evidenced West')[1].split('void main(){')[0];
 assert.equal(inherited(v.fragmentShader),inherited(stock.fragmentShader));
 assert(v.fragmentShader.indexOf('dFdx(fogReceiverStudyLocal)')<v.fragmentShader.indexOf('discard;'));
 assert.match(v.fragmentShader,/if\(fogReceiverStudyChannels\.x>\.5\).*else contact=1\.-smoothstep/);
 assert.match(v.fragmentShader,/if\(fogReceiverStudyChannels\.y>\.5\).*else houseShadow=1\.-smoothstep/);
 assert(!v.fragmentShader.includes('texture(')&&!v.fragmentShader.includes('gl_FragDepth='));
});
test('does not accept unknown shader family, duplicated tokens or a permissive source hash',async()=>{
 const v=patchDetachedFogLight(stock,kernel);assert(v);
 assert.equal(patchDetachedFogLight(v,kernel),undefined);
 assert.equal(patchDetachedFogLight({...stock,fragmentShader:stock.fragmentShader+stock.fragmentShader},kernel),undefined);
 assert.equal(patchDetachedFogLight(stock,kernel+'\n#include <camera>'),undefined);
 assert.equal(await verifyDetachedFogReceiverSource(stock,kernel),undefined);
});
