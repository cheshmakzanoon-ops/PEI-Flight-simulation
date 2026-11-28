import assert from 'node:assert/strict';
import {test} from 'node:test';
import {branchVertex,branchFragment} from '../tools/art/woodland-envelope/original-program.ts';
import {prepareLeafRadianceStudy} from '../tools/art/woodland-envelope/leaf-radiance-study.ts';

test('woodland illumination admits only the exact original program as an off-by-default study',()=>{
 const p=prepareLeafRadianceStudy(branchVertex,branchFragment)!;
 assert.ok(p);assert.ok(Object.isFrozen(p));assert.equal(p.neutralGain,0);assert.equal(p.studyGain,1);
 for(const [v,f] of [[branchVertex+'\n',branchFragment],[branchVertex,'#define BARK_SCAN\n'+branchFragment],
  [p.vertexShader,p.fragmentShader],[branchVertex,branchFragment.replace('fFade<.003','fFade<.006')]]){
  assert.equal(prepareLeafRadianceStudy(v,f),undefined);
 }
});

test('stripping the height varying and one bounded leaf-RGB operation recovers both source shaders byte-for-byte',()=>{
 const p=prepareLeafRadianceStudy(branchVertex,branchFragment)!;
 const varying='\n varying float peiCrownDepth;';
 assert.equal(p.vertexShader.replace(varying,'').replace('\n  peiCrownDepth=position.y;',''),branchVertex);
 const light=p.fragmentShader.indexOf('\n  if(peiLocalLeafLight>0.)');
 const next=p.fragmentShader.indexOf('\n  c+=vec3(.012,.021,.007)',light);
 assert.ok(light>p.fragmentShader.indexOf('if(fade<.055)discard;')&&next>light);
 assert.equal((p.fragmentShader.slice(0,light)+p.fragmentShader.slice(next))
  .replace(varying,'').replace('\n uniform float peiLocalLeafLight;',''),branchFragment);
 assert.ok(p.fragmentShader.slice(light,next).includes('smoothstep(.40,.90,peiCrownDepth)'));
 assert.doesNotMatch(p.fragmentShader.slice(light,next),/discard|gl_Frag(?:Color|Depth)|\bfade\b|texture|worldMatrix/i);
});
