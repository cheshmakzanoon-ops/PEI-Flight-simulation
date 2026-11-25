import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import * as T from 'three';
import {turbineGeometry,WIND_PROFILE} from '../src/render/regional-wind-geometry.ts';
import {ROTOR_PINS,ROTOR_INDEX,ROTOR_LIMIT,rotorLayout,ROTOR_CLOCK,SUN,PITCH_M} from '../src/render/regional-wind-rotor-field.ts';
import {canDrawRotor,withRotorReceiver} from '../src/render/regional-wind-rotor.ts';
import {staticWindLight} from '../src/render/regional-wind-light.ts';
import {createRegionalWind} from '../src/render/regional-wind.ts';import {WIND_STATIONS} from '../src/render/regional-wind.generated.ts';import {project} from '../src/sim/geo.ts';import type {WindFarmId} from '../src/render/regional-wind-stream.ts';import {standardRegionalWind} from '../src/app/scenery-profile.ts';
const sig=(a:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
test('signed actual three spinner/blade meshes, full-rotation clipping gutter and bounded linear depth layout',()=>{
 assert(standardRegionalWind(new URLSearchParams('stockRegionalWindRotorLight')));assert(!standardRegionalWind(new URLSearchParams('stockRegionalWind')));
 for(const id of Object.keys(ROTOR_PINS)as WindFarmId[]){
  const g=turbineGeometry(id,0),pos=g.rotor.getAttribute('position');assert.equal(sig(pos.array),ROTOR_PINS[id]);assert.equal(sig(g.rotor.index!.array),ROTOR_INDEX);
  assert.equal(ROTOR_CLOCK[id],(WIND_PROFILE[id].rpm*Math.PI*2/60).toFixed(10));
  const L=rotorLayout(id,pos,2048)!;assert(L&&L.ax<=2048&&L.ay<=2048);assert(L.cols*L.rows>=ROTOR_LIMIT[id]);assert(!rotorLayout(id,pos,128));
  assert(Math.abs(L.x.dot(L.sun))+Math.abs(L.y.dot(L.sun))+Math.abs(L.x.dot(L.y))<1e-12);
  for(let k=0;k<41;k++){const a=k*2.957914,c=Math.cos(a),s=Math.sin(a);
   for(let j=0;j<pos.count;j++){const v=pos.getX(j),b=pos.getY(j),w=pos.getZ(j),xyz=L.cols3[0].clone().multiplyScalar(v).addScaledVector(L.cols3[1],b*c-w*s).addScaledVector(L.cols3[2],b*s+w*c),x=xyz.dot(L.x)-L.lowU,y=xyz.dot(L.y)-L.lowV;
    assert(Math.min(x,y,L.w*PITCH_M-x,L.h*PITCH_M-y)>=1.99999);const d=xyz.dot(SUN);assert(d>=L.loD+1.99999&&d<=L.hiD-1.99999);
   }
  }g.mast.dispose();g.rotor.dispose();
 }
});
function mockRenderer(bad=false){let target:any=null,draws=0,fail=false,foreign=false;const fake={};
 const gl={FRAMEBUFFER:100,FRAMEBUFFER_COMPLETE:101,LINK_STATUS:111,isContextLost:()=>false,checkFramebufferStatus:()=>bad?99:101,getProgramParameter:()=>true};
 const r={capabilities:{isWebGL2:true,reversedDepthBuffer:false,maxTextures:16,maxFragmentUniforms:224,maxTextureSize:2048},autoClear:true,xr:{enabled:false},getRenderTarget:()=>foreign?fake:target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget:(q:any)=>{target=q;},getContext:()=>gl,properties:{get:()=>({currentProgram:{program:fake}})},compile(){},clear(c:boolean,d:boolean,s:boolean){assert(target&&!c&&d&&!s);},render(){assert(target);draws++;if(fail)throw Error('injected pass failure');}};
 return {r:r as unknown as T.WebGLRenderer,count:()=>draws,target:()=>target,fail:()=>{fail=true;},foreign:(v:boolean)=>{foreign=v;}};
}
const delay=()=>new Promise(ok=>setTimeout(ok,5));
test('exact phase sync, finite ownership, no redundant pass when paused and no stale pass when time advances, real state fallback to installed static',async t=>{
 const id='west-cape',s=WIND_STATIONS[id].find(v=>v[0]==='WCW27')!,eye={...project(s[1],s[2]),y:62},src='uniform sampler2D old;void main(){ col*=.90+.31*light; }';
 const m=new T.ShaderMaterial({fragmentShader:src}),terrain={terrain:{isLand:()=>true},cover:{distance:()=>64},sun:SUN.clone(),surface:()=>({land:true}),visualGroundEpoch:1,visualGroundHeight:()=>10,regionalWindLightReceivers:()=>[{id:'1-7',m}]};
 const art=createRegionalWind(id,new T.Scene(),terrain as never)!;art.update(eye,.42);
 const old=globalThis.fetch;let fetches=0;globalThis.fetch=async()=>{fetches++;return new Response(readFileSync(new URL('../public/world/regional-wind-light/v1/west-cape.wrg.gz',import.meta.url)));};t.after(()=>{globalThis.fetch=old;art.dispose();m.dispose();});
 for(const bad of [false,true]){
  const mock=mockRenderer(bad),r=mock.r,base=staticWindLight(id,{world:terrain as never,base:'/',maxTextures:16,maxUniforms:224,rotorScope:true},art)!;
  assert(canDrawRotor(r));r.capabilities.maxTextures=15;assert(!canDrawRotor(r));r.capabilities.maxTextures=16;
  const light=withRotorReceiver(id,r,terrain as never,art,base);assert.equal(light,base);
  for(let i=0;i<50;i++){base.update(eye);await delay();const p=(base.state as any).moving.phase;if(mock.count()||p==='unavailable')break;}
  assert.equal(base.state.phase,'ready');assert(m.fragmentShader.includes('windStaticDirect'));
  if(bad){assert.equal((base.state as any).moving.phase,'unavailable');assert.equal(mock.count(),0);}
  else{assert.equal(mock.count(),1);assert(m.fragmentShader.includes('sampler2DShadow regionalRotorDepth'));assert(m.uniforms.rotorCount.value>0);
   base.update(eye);assert.equal(mock.count(),1);art.update(eye,.44);base.update(eye);assert.equal(mock.count(),2);
   for(const tick of [599.992,600,600.014]){art.update(eye,tick);base.update(eye);assert.equal((base.state as any).moving.lastPhase,tick%600);}
   mock.foreign(true);art.update(eye,601);base.update(eye);assert.equal(m.uniforms.rotorCount.value,0);mock.foreign(false);base.update(eye);assert(m.uniforms.rotorCount.value>0);assert.equal(mock.target(),null);
   mock.fail();art.update(eye,602);base.update(eye);assert.equal((base.state as any).moving.phase,'unavailable');assert.equal(mock.target(),null);assert(r.autoClear);
  }
  assert(!m.fragmentShader.includes('sampler2DShadow regionalRotorDepth'));assert(!('rotorCount'in m.uniforms));assert(m.uniforms.regionalStaticCount.value>0);
  light.dispose();assert.equal(m.fragmentShader,src);assert.deepEqual(Object.keys(m.uniforms),[]);
 }assert.equal(fetches,2);
});
test('foreign program takeover retires only that material without pulling live GLSL or independent shared uniforms from under it; donor changes preserve static mast',async t=>{
 const id='west-cape',site=WIND_STATIONS[id].find(v=>v[0]==='WCW27')!,eye={...project(site[1],site[2]),y:62},frag='uniform sampler2D old;void main(){ col*=.90+.31*light; }';
 const mats=Array.from({length:4},()=>new T.ShaderMaterial({fragmentShader:frag}));
 const world={terrain:{isLand:()=>true},cover:{distance:()=>64},sun:SUN.clone(),surface:()=>({land:true}),visualGroundEpoch:1,visualGroundHeight:()=>10,regionalWindLightReceivers:()=>mats.map(m=>({id:'1-7',m}))};
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(readFileSync(new URL('../public/world/regional-wind-light/v1/west-cape.wrg.gz',import.meta.url)));const art=createRegionalWind(id,new T.Scene(),world as never)!;art.update(eye,.19);
 const mock=mockRenderer(),base=staticWindLight(id,{world:world as never,base:'/',maxTextures:16,maxUniforms:224,rotorScope:true},art)!;withRotorReceiver(id,mock.r,world as never,art,base);
 t.after(()=>{globalThis.fetch=old;base.dispose();art.dispose();for(const m of mats)m.dispose();});
 for(let i=0;i<60&&!mock.count();i++){base.update(eye);await delay();}
 assert.equal((base.state as any).moving.activeTiles,4);assert(mats.every(m=>m.uniforms.rotorCount===mats[0].uniforms.rotorCount));
 // (A) exact original block is no longer machine-removable. Keep code and the
 // newer owner's handle, keep valid typed zero/null copies only on this one.
 const [a,b,c,d]=mats;const custom={value:new T.Vector3(8,9,10)};
 a.fragmentShader=a.fragmentShader.replace('uniform vec3 rotorRight','/* newer observer */ uniform vec3 rotorRight');a.uniforms.rotorRight=custom;
 const takeA=a.fragmentShader;
 // (B) original block is still intact, but new code calls one of its symbols;
 // physically removing the block would break a now foreign shader program.
 const later='\nfloat foreignNormal(vec3 p){return windRotorDirect(p,0.,.1);}';b.fragmentShader+=later;const takeB=b.fragmentShader;
 // (C) unrelated owner edits do not use our code. Remove only our intact
 // declaration and do not undo the other feature's legitimate work.
 const independent='\nfloat unrelated(){return .242;}';c.fragmentShader+=independent;
 const shared=d.uniforms.rotorCount;
 art.update(eye,.23);base.update(eye);base.update(eye);
 assert.equal((base.state as any).moving.activeTiles,1);assert.equal(a.fragmentShader,takeA);assert.equal(b.fragmentShader,takeB);
 assert.equal(a.uniforms.rotorRight,custom);assert.equal(b.uniforms.rotorCount.value,0);assert.equal(a.uniforms.rotorCount.value,0);assert.equal(a.uniforms.regionalRotorDepth.value,null);
 assert.notEqual(b.uniforms.rotorOrigins,d.uniforms.rotorOrigins);assert.notEqual(b.uniforms.rotorOrigins.value[0],d.uniforms.rotorOrigins.value[0]);
 assert(c.fragmentShader.endsWith(independent));assert(!c.fragmentShader.includes('sampler2DShadow'));assert(!c.uniforms.rotorCount);
 assert.equal(d.uniforms.rotorCount,shared);assert(d.uniforms.rotorCount.value>0);assert(d.uniforms.regionalStaticCount.value>0);
 // Mutating the source via its supported Three update contract invalidates
 // only the new moving pass. Static shells, rows and the render target survive.
 const donor=art.root.children[1] as T.InstancedMesh;donor.geometry.getAttribute('position').needsUpdate=true;
 art.update(eye,.26);base.update(eye);
 assert.equal((base.state as any).moving.phase,'unavailable');assert.equal((base.state as any).phase,'ready');assert(d.uniforms.regionalStaticCount.value>0);assert(!d.uniforms.rotorCount);assert.equal(mock.target(),null);
});
