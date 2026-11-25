import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {Terrain} from '../src/sim/terrain.ts';
import {regularRoadGround} from '../src/render/road-contact.ts';
import {addBasilicaExterior} from '../src/render/basilica-exterior.ts';
import {BASILICA_CAST as C} from '../src/render/basilica-cast-source.ts';
import {BasilicaLocalSun} from '../src/render/basilica-local-sun.ts';
import {castMaterial,one} from '../src/render/basilica-cast-material.ts';
import {basilicaExteriorRequested,basilicaYardSunRequested,sceneryOptions} from '../src/app/scenery-profile.ts';
const eye=new T.Vector3(...C.origin).add(new T.Vector3(55,8,35)),q=(s:string)=>sceneryOptions(s);
test('only the three yard receivers are exposed, never the private self-light trial',()=>{
 for(const k of ['', 'basilicaYardSun','basilicaFormSun','basilicaExteriorStudy','basilicaExteriorStudy&basilicaFormSun','basilicaExteriorStudy&basilicaYardSun&basilicaFormSun','basilicaExteriorStudy&stockBasilicaSun&basilicaYardSun','basilicaExteriorStudy&basilicaYardSun&inlandRelief','basilicaExteriorStudy&stockBasilicaExterior&basilicaYardSun'])
  assert.equal(basilicaYardSunRequested(q(k)),false,k);
 assert(basilicaYardSunRequested(q('basilicaExteriorStudy&basilicaYardSun')));
 assert(basilicaExteriorRequested(q('basilicaExteriorStudy&basilicaYardSun&stockBasilicaSun')));
});
test('each genuine receiver binds only its original direct lighting and preserves stock source, shared uniforms, and the material callback',()=>{
 const uf={bsLive:{value:1},bsSourceDepth:{value:new T.DepthTexture(1,1,T.UnsignedShortType)}};
 for(const [role,base] of [['land','col*=.90+.31*light;'],['walk','c*=.655+.44*slope;']]as const){
  const m=new T.ShaderMaterial({uniforms:{legacy:{value:2}},fragmentShader:'void main(){'+base+'}'});
  const v=castMaterial(m,role,uf) as T.ShaderMaterial;
  assert.notEqual(v,m);assert.equal(v.uniforms.legacy,m.uniforms.legacy);assert.equal(v.uniforms.bsLive,uf.bsLive);
  assert(v.fragmentShader.includes('else '+base));assert(!m.fragmentShader.includes('bsShade'));
  assert.throws(()=>castMaterial(new T.ShaderMaterial({fragmentShader:'void main(){}'}),role,uf));
 }
 const src=new T.MeshStandardMaterial();let calls=0;src.onBeforeCompile=s=>{calls++;s.fragmentShader+='\n//original';};
 const m=castMaterial(src,'road',uf);const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 m.onBeforeCompile(sh as any,{} as any);assert.equal(calls,1);assert(sh.fragmentShader.includes('//original'));assert(sh.fragmentShader.includes('reflectedLight.directDiffuse*='));
 assert(sh.fragmentShader.includes('reflectedLight.directSpecular*='));assert(!sh.fragmentShader.includes('indirectDiffuse*'));assert(!sh.fragmentShader.includes('outgoingLight*='));
 assert(sh.vertexShader.indexOf('bsPhysicalP=(modelMatrix*vec4(transformed,1.)).xyz')>sh.vertexShader.indexOf('#include <displacementmap_vertex>'));
 assert.throws(()=>one('xxx','x','z'));
});
const dir=new URL('../public/world/',import.meta.url),spec=JSON.parse(readFileSync(new URL('terrain.json',dir),'utf8'));
const bytes=gunzipSync(readFileSync(new URL(spec.file,dir))),terrain=new Terrain(spec,new Int16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2));
function chamber(fault=false){
 const scene=new T.Scene(),g=addBasilicaExterior(scene,terrain,regularRoadGround(terrain)),s=new T.Vector3(...C.directions[2]);
 const light=new T.DirectionalLight();light.position.copy(s).multiplyScalar(42);scene.add(light);
 const make=(type:string)=>{const base=type==='road'?new T.MeshStandardMaterial():new T.ShaderMaterial({
  fragmentShader:'void main(){'+(type==='land'?'col*=.90+.31*light;':'c*=.655+.44*slope;')+'}'});
  return {mesh:new T.Mesh(new T.BufferGeometry(),base),base};};
 const f=make('land'),r=make('road'),w=make('walk'),ready={road:true,walk:false};
 let target:any=null;const submitted:any[]=[];
 const gpu={autoClear:true,capabilities:{maxTextures:32,maxTextureSize:4096},xr:{isPresenting:false},
 getContext:()=>({FRAMEBUFFER:1,FRAMEBUFFER_COMPLETE:1,checkFramebufferStatus:()=>1,isContextLost:()=>false}),
 getRenderTarget:()=>target,setRenderTarget:(b:any)=>target=b,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,clear:()=>{},
 render:(sc:T.Scene)=>{submitted.push(sc.children.map(a=>(a as T.Mesh).geometry));if(fault)throw Error('injected depth target failure');}};
 const world={sun:s,basilicaDaylight:light,basilicaSunGround:()=>f},road=()=>({basilicaSunRoad:()=>ready.road?r:undefined}),walk=()=>({basilicaSunWalk:()=>ready.walk?w:undefined});
 const stage=new BasilicaLocalSun(gpu as any,scene,world as any,g,road as any,walk as any);
 return {stage,g,ready,f,r,w,scene,light,gpu,submitted,world};
}
async function prove(c:ReturnType<typeof chamber>){c.stage.update(eye,.02);for(let i=0;i<160&&c.stage.state.phase==='certifying';i++)await new Promise(r=>setTimeout(r,1));c.stage.update(eye,.02);}
test('one original caster for a fully transactional yard and original architecture stays unchanged',async()=>{
 const c=chamber(),original=c.g.children.map(x=>(x as T.Mesh).material);await prove(c);
 assert.equal(c.stage.state.yard,false);assert.equal(c.stage.state.phase,'cold');assert.equal(c.submitted.length,0);
 assert.equal(c.f.mesh.material,c.f.base);assert.equal(c.r.mesh.material,c.r.base);
 c.ready.walk=true;await prove(c);assert(c.stage.state.yard);assert.equal(c.stage.state.leases,3);
 assert.deepEqual(c.submitted[0],c.g.children.map(x=>(x as T.Mesh).geometry));assert.equal(c.stage.state.isolatedDepthDraws,9);
 assert.deepEqual(c.g.children.map(x=>(x as T.Mesh).material),original);const first=c.f.mesh.material;
 for(let i=0;i<10;i++)c.stage.update(eye,.02);assert.equal(c.f.mesh.material,first);assert.equal(c.submitted.length,1);
 c.ready.road=false;c.stage.update(eye,.02);assert.equal(c.stage.state.yard,false);assert.equal(c.f.mesh.material,c.f.base);assert.equal(c.w.mesh.material,c.w.base);assert.equal(c.stage.state.target,null);
 c.ready.road=true;c.stage.update(eye,.02);assert(c.stage.state.yard);assert.equal(c.submitted.length,2);
 const foreign=new T.MeshBasicMaterial();c.f.mesh.material=foreign;c.stage.update(eye,.02);
 assert.equal(c.stage.state.yard,false);assert.equal(c.stage.state.target,null);assert.equal(c.f.mesh.material,foreign);
 c.stage.dispose();assert.deepEqual(c.g.children.map(x=>(x as T.Mesh).material),original);
});
test('directional, visible nested emissive lights, foreign material and stale caster cancel whole yard',async()=>{
 for(const l of [new T.PointLight(),new T.SpotLight(),new T.RectAreaLight(),new T.DirectionalLight()]){
  const c=chamber();c.ready.walk=true;await prove(c);const g=new T.Group();g.add(l);c.scene.add(g);c.stage.update(eye,.01);
  assert.equal(c.stage.state.yard,false);assert.equal(c.stage.state.target,null);assert.equal(c.r.mesh.material,c.r.base);
  g.visible=false;c.stage.update(eye,.02);assert(c.stage.state.yard);
  l.intensity=0;g.visible=true;c.stage.update(eye,.02);assert(c.stage.state.yard);
  c.scene.add(new T.HemisphereLight(),new T.AmbientLight());c.stage.update(eye,.02);assert(c.stage.state.yard);
  c.light.position.set(0,10,0);c.stage.update(eye,.02);assert(!c.stage.state.yard);c.stage.dispose();
 }
 const c=chamber();c.ready.walk=true;await prove(c);
 c.scene.overrideMaterial=new T.MeshBasicMaterial();c.stage.update(eye,.02);assert(!c.stage.state.yard);assert.equal(c.stage.state.target,null);
 c.scene.overrideMaterial=null;c.stage.update(eye,.02);assert(c.stage.state.yard);
 const mf=c.w.base as T.ShaderMaterial;mf.fragmentShader+='//unexpected donor';c.stage.update(eye,.02);assert(!c.stage.state.yard);assert.equal(c.stage.state.phase,'failed');
 const changed=chamber();changed.ready.walk=true;await prove(changed);
 (changed.g.children[2]as T.Mesh).geometry.getAttribute('position').needsUpdate=true;changed.stage.update(eye,.01);assert.equal(changed.stage.state.phase,'failed');assert.equal(changed.r.mesh.material,changed.r.base);
});
test('cold incapability, invalid donor shader, thrown depth and absent range retain the three old surface owners',async()=>{
 const c=chamber();c.ready.walk=true;c.gpu.capabilities.maxTextures=12;await prove(c);assert.equal(c.stage.state.target,null);
 c.gpu.capabilities.maxTextures=32;await prove(c);assert(c.stage.state.yard);
 const far=eye.clone().add(new T.Vector3(800,0,0));for(let i=0;i<20;i++)c.stage.update(far,.2);
 assert.equal(c.stage.state.target,null);assert.equal(c.stage.state.yard,false);assert.equal(c.r.mesh.material,c.r.base);
 const bad=chamber(true);bad.ready.walk=true;await prove(bad);assert.equal(bad.stage.state.phase,'failed');assert.equal(bad.stage.state.target,null);
 assert.equal(bad.gpu.getRenderTarget(),null);assert.equal(bad.gpu.autoClear,true);
 const invalid=chamber();invalid.ready.walk=true;invalid.r.base.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>','');};await prove(invalid);
 assert.equal(invalid.stage.state.phase,'failed');assert.equal(invalid.stage.state.leases,0);assert.equal(invalid.stage.state.target,null);assert.equal(invalid.f.mesh.material,invalid.f.base);
});
