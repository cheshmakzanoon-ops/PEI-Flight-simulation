import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Scene,ShaderMaterial,Texture,Vector3} from 'three';
import {sceneryOptions,sceneryReviewBlock,standardMiscoucheRequested} from '../src/app/scenery-profile.ts';
import {createMiscoucheFill} from '../src/render/miscouche-fill.ts';
import {MISCOUCHE_CROWNS,MISCOUCHE_PROOF as EVIDENCE} from '../src/render/miscouche-fill.generated.ts';

const makeBase=()=>{
 const canopy=new Texture();
 const fragment='void main(){float a=.7;gl_FragColor=vec4(.1,.2,.3,clamp((a-.30)*3.8,0.,1.));}';
 const base=new ShaderMaterial({uniforms:{canopy:{value:canopy}},fragmentShader:fragment,alphaToCoverage:true});
 return {base,canopy,fragment};
};

test('Miscouche fill leaves the inherited material and atlas alone and blends through a short local lease',()=>{
 const {base,canopy,fragment}=makeBase();let protectedTextureDisposals=0;canopy.addEventListener('dispose',()=>protectedTextureDisposals++);
 const scene=new Scene();const wet=()=>undefined;
 assert.equal(createMiscoucheFill(scene,base,wet),undefined);
 assert.equal(scene.children.length,0);
 let y=8;
 const art=createMiscoucheFill(scene,base,()=>y);assert(art);
 assert.equal(scene.children.length,1);
 assert.equal(art.total,215);assert.equal(art.mesh.geometry.instanceCount*2,430);
 assert.equal(art.mesh.material.uniforms.canopy,base.uniforms.canopy);
 assert.equal(base.fragmentShader,fragment);
 const [x,z]=EVIDENCE.center;const eye=new Vector3(x,100,z);
 art.update(eye,true,1,100);assert.equal(art.gain,0);
 art.update(eye,true,1,310);assert.equal(art.gain,.5);
 art.update(eye,true,1,590);assert.equal(art.gain,1);
 eye.y=25;art.update(eye,true,1,670);assert.equal(art.gain,0);
 eye.y=100;y=10;art.update(eye,true,2,710);
 assert.ok(Math.abs(art.mesh.geometry.getAttribute('stem').getY(0)-9.84)<1e-6);
 art.update(eye,false,2,800);assert.equal(art.gain,0);
 art.update(eye,true,2,900);assert.equal(art.gain,0);
 y=NaN;art.update(eye,true,3,1200);assert.equal(art.mesh.visible,false);
 art.update(eye,true,3,1550);assert.equal(art.mesh.visible,false);
 art.dispose();assert.equal(scene.children.length,0);
 assert.equal(protectedTextureDisposals,0);
});

test('authoring sends only finite, unique inferred forms in the registered dense cohort',()=>{
 const seen=new Set<string>();const [cx,cz]=EVIDENCE.center;
 for(const [x,z,h,w] of MISCOUCHE_CROWNS){
  assert([x,z,h,w].every(Number.isFinite));
  const id=x+','+z;assert(!seen.has(id));seen.add(id);
  assert(Math.hypot(x-cx,z-cz)<270&&h>=9&&h<=21&&w>6&&w<=12);
 }
 assert.equal(seen.size,215);
});

test('the optional study leaves alternate scenery modes to their existing optics',()=>{
 const check=(query:string)=>sceneryReviewBlock('miscoucheCanopyStudy',sceneryOptions(query));
 assert.equal(check(''),undefined);
 assert.equal(check('?scenery=standard'),undefined);
 assert.equal(check('?scenery=detail'),'detail');
 for(const q of ['?scenery=legacy','?woodlandView','?buildingShadows','?surveyRelief','?seatedForestShadows'])assert.equal(check(q),'terrain');
});

test('Standard uses the low-only veil and isolates historical or compared routes',()=>{
 assert(standardMiscoucheRequested(sceneryOptions('?departure=miscouche-woodlot-pass')));
 for(const q of ['scenery=detail','stockMiscouche','miscoucheCanopyStudy','regionalCanopyStudy',
  'buildingShadows','sourceGrassStudy','woodland3D','shoreToneStudy']){
  assert(!standardMiscoucheRequested(sceneryOptions('?'+q)),q);
 }
 assert(!sceneryOptions('?stockMiscouche&miscoucheCanopyStudy').has('miscoucheCanopyStudy'));
 const scene=new Scene(),{base}=makeBase(),art=createMiscoucheFill(scene,base,()=>8,true);
 assert(art);
 const [x,z]=EVIDENCE.center,eye=new Vector3(x,100,z);
 art.update(eye,true,1,5);art.update(eye,true,1,500);
 assert.equal(art.gain,1);
 eye.y=292.5;art.update(eye,true,1,510);assert.equal(art.gain,.5);
 eye.y=330;art.update(eye,true,1,520);assert.equal(art.gain,0);
 art.dispose();
});
