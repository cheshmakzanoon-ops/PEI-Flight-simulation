import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ShaderMaterial,Texture} from 'three';
import {
 AIRLIGHT_CALIBRATION_SKY_SHA,labAerialFragment,loadVerifiedAerialSky,
 pathMeanDensity,pathTransmission,verifiedAerialOptics,
} from '../src/render/aerial-perspective-lab.ts';
import {aerialPerspectiveRequested,loadAerialModule} from '../src/render/aerial-profile.ts';

const skySource=readFileSync(new URL('../public/world/maritime-sky.webp',import.meta.url));
test('slant column is reciprocal, altitude-sensitive, finite, and stable on equal heights',()=>{
 const tx=pathTransmission(30e3,50,0),ty=pathTransmission(30e3,500,0);
 assert.deepEqual(tx,pathTransmission(30e3,0,50));
 assert(tx.every((v,j)=>v>0&&v<ty[j]&&ty[j]<1));
 assert(tx[0]>tx[1]&&tx[1]>tx[2]);
 assert.deepEqual(pathTransmission(0,200,0),[1,1,1]);
 for(const k of [1200,8000])for(const pair of [[0,0],[250,150],[500,0],[8300,0]]){
  const [a,b]=pair;
  let integral=0;
  const N=100000;
  for(let i=0;i<N;i++)integral+=Math.exp(-(a+(i+.5)/N*(b-a))/k)/N;
  assert(Math.abs(pathMeanDensity(a,b,k)-integral)<2e-10);
 }
 assert(aerialPerspectiveRequested(new URLSearchParams()));
 assert(!aerialPerspectiveRequested(new URLSearchParams('stockAerialPerspective')));
 assert(!aerialPerspectiveRequested(new URLSearchParams('buildingShadows')));
 assert(!aerialPerspectiveRequested(new URLSearchParams('orthophotoSeamStudy')));
 assert(aerialPerspectiveRequested(new URLSearchParams('orthophotoSeamStudy&aerialPerspectiveStudy')));
 assert(!aerialPerspectiveRequested(new URLSearchParams('stockAerialPerspective&aerialPerspectiveStudy')));
 assert(aerialPerspectiveRequested(new URLSearchParams('buildingShadows&aerialPerspectiveStudy')));
 assert(!aerialPerspectiveRequested(new URLSearchParams('scenery=detail&aerialPerspectiveStudy')));
 assert(aerialPerspectiveRequested(new URLSearchParams('aerialPerspectiveStudy')));
});
test('the same bounded authenticated sky bytes must back the actual daylight panorama texture',async()=>{
 assert.equal(skySource.length,214798);
 assert.equal(createHash('sha256').update(skySource).digest('hex'),AIRLIGHT_CALIBRATION_SKY_SHA);
 const expected=new Texture({width:4096,height:2048});
 let fetches=0,decodes=0,url='';
 const sheet=await loadVerifiedAerialSky('/world/maritime-sky.webp',async v=>{
  decodes++;url=v;
  assert.equal(createHash('sha256').update(Buffer.from(await (await fetch(v)).arrayBuffer())).digest('hex'),AIRLIGHT_CALIBRATION_SKY_SHA);
  return expected;
 },async()=>{fetches++;return new Response(skySource);});
 assert(sheet&&sheet.texture===expected&&fetches===1&&decodes===1);
 await assert.rejects(fetch(url));
 const refused=verifiedAerialOptics(sheet);assert(refused&&!refused.accepts(new Texture())&&!refused.armed&&refused.gain.value===0);
 const pass=verifiedAerialOptics(sheet);assert(pass&&pass.accepts(expected)&&!pass.armed);
 const backdrop=new ShaderMaterial({fragmentShader:'uniform float skyDiagnostic; void main(){vec3 c=skyAt(normalize(skyRay));}'});
 const land=new ShaderMaterial({fragmentShader:'vec3 mist(vec3 col,float d,float h){return col;} void main(){gl_FragColor=vec4(mist(col,d,p.y),1.);}'});
 const mainland=new ShaderMaterial({fragmentShader:'void main(){float d=distance(wp,cameraPosition);gl_FragColor=vec4(mix(c.rgb*l,vec3(.56,.68,.72),min(haze,.91)),1.);}'});
 pass.bind(land);pass.bind(backdrop);assert(!pass.armed);pass.bind(mainland);assert(pass.armed);
 for(const material of [backdrop,land,mainland])assert(material.uniforms.atmosphericLabGain===pass.gain);
 const clone=new ShaderMaterial({fragmentShader:land.fragmentShader,uniforms:{...land.uniforms}});
 assert(pass.bind(clone).uniforms.atmosphericLabGain===pass.gain&&pass.armed);
 assert(labAerialFragment('unrelated')===undefined);
});
test('bad HTTP, length, authenticating digest and decoded size never authorize optics',async()=>{
 const wrong=Buffer.from(skySource);wrong[99]^=1;
 for(const r of [
  new Response(null,{status:404}),new Response(skySource,{status:206}),new Response(wrong),
  new Response(skySource.subarray(0,-1)),new Response(Buffer.concat([skySource,Buffer.from([0])]))
 ]){
  let decoded=false;const v=await loadVerifiedAerialSky('/world/maritime-sky.webp',async()=>{decoded=true;return new Texture();},async()=>r);
  assert(!v&&!decoded);
 }
 const v=await loadVerifiedAerialSky('/world/maritime-sky.webp',async()=>new Texture({width:4095,height:2048}),async()=>new Response(skySource));
 assert(!v);
 let decoded=false;
 const late=await loadVerifiedAerialSky('/world/maritime-sky.webp',async()=>{decoded=true;return new Texture();},
  async()=>{await new Promise(r=>setTimeout(r,35));return new Response(skySource);},4);
 assert(!late&&!decoded);
});
test('optional optics code cannot hold Standard startup or activate on a late resolution',async()=>{
 assert.equal(await loadAerialModule(async()=>17),17);
 assert.equal(await loadAerialModule(async()=>{throw Error('module unavailable');}),undefined);
 let deliver:(x:number)=>void=()=>{};
 const source=new Promise<number>(r=>{deliver=r;});
 const fallback=loadAerialModule(()=>source,10);
 assert.equal(await fallback,undefined);
 deliver(17);
 assert.equal(await source,17);
 assert.equal(await fallback,undefined);
});
