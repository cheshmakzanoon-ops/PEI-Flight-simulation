#!/usr/bin/env node
// Compare the parent source checkout and this checkout; neither is modified.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const [oldPath,newPath]=process.argv.slice(2);
if(!oldPath||!newPath)throw Error('Usage: node --experimental-strip-types tools/qa/compare-aerial-join-scopes.mjs OLD_CHECKOUT NEW_CHECKOUT');
const digest=s=>createHash('sha256').update(s).digest('hex');
const pin=(root,file)=>digest(readFileSync(resolve(root,file)));
assert.equal(pin(oldPath,'src/render/orthophoto-seams.ts'),'2ca1e7fcb5e3a0fc82f8922fcf68be55d48e11ace3fea5003627c77965c71d30',
 'Use the #217 source sampler, not another old revision.');
assert.equal(pin(oldPath,'src/render/world.ts'),pin(newPath,'src/render/world.ts'),'Revalidate the base terrain shader separately.');
const [before,after]=await Promise.all([oldPath,newPath].map(x=>import(pathToFileURL(resolve(x,'src/render/orthophoto-seams.ts')).href)));
const gpu={},base={};
const targets=['18-12','18-13','27-13','27-14','5-2','5-3','10-12','11-12','16-11'];
const fixture='void main(){\n  col=textureGrad(detailMap,detailUV,du,dv).rgb;\n}';
const raw=(engine,scope,id)=>{const owner={fragmentShader:fixture,uniforms:{}};const fx=new engine.OrthophotoSeams(gpu,base,scope);fx.bind(id,owner);return owner.fragmentShader;};
const vectors=[];
for(const id of targets){
 const previous=raw(before,'study',id),candidate=raw(after,'study',id);
 assert.equal(previous,candidate);vectors.push({mode:'explicit-study',tile:id,fragmentProbeSHA256:digest(candidate)});
 if(id.startsWith('18-')){
  const t=raw(before,'tracadie',id);
  for(const scope of ['tracadie','standard']){
   const live=raw(after,scope,id);assert.equal(live,t);vectors.push({mode:scope,tile:id,fragmentProbeSHA256:digest(live)});
  }
 }else if(previous!==fixture){
  for(const scope of ['counties','standard']){
   const live=raw(after,scope,id);
   assert.equal(live,previous.replace('float localRange=1.;','float localRange=1.-smoothstep(205.,330.,distance(cameraPosition,p));'));
   vectors.push({mode:scope,tile:id,fragmentProbeSHA256:digest(live)});
  }
 }else{
  for(const scope of ['counties','standard','tracadie'])assert.equal(raw(after,scope,id),fixture);
 }
}
console.log(JSON.stringify({format:'pei-image-join-scope/1',against:'4217f910cf19631c996f6fbe46988df4961b75c4',
scope:'Captured the exact shader injection at the normal imagery sampling line, compared to its parent revision. The terrain renderer file matches; this probe is not a complete rendered scene or hardware benchmark.',exactStudyProbes:9,originalTracadieProbes:4,newCountyProbesExactlyOldPlusRange:12,verifiedProbes:vectors},null,2));
