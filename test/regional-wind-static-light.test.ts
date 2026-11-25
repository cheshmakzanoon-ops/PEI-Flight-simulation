import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {loadStaticData,staticWindLight} from '../src/render/regional-wind-light.ts';
import {STATIC_SKIN} from '../src/render/regional-wind-light.generated.ts';
import {createRegionalWind} from '../src/render/regional-wind.ts';
import {WIND_STATIONS} from '../src/render/regional-wind.generated.ts';
import {project} from '../src/sim/geo.ts';
import type {WindFarmId} from '../src/render/regional-wind-stream.ts';
const bytes=(farm:WindFarmId)=>Uint8Array.from(readFileSync(new URL('../public/world/regional-wind-light/v1/'+farm+'.wrg.gz',import.meta.url)));
const wait=(ms:number)=>new Promise(ok=>setTimeout(ok,ms));
test('accepts only exactly signed wire/auto-inflated source representations; bounded and rejects malformed mesh shadow without fallback fill',async()=>{
 for(const id of Object.keys(STATIC_SKIN) as WindFarmId[]){const wire=bytes(id),raw=Uint8Array.from(gunzipSync(wire)),s=STATIC_SKIN[id];
  const f=(a:Uint8Array<ArrayBuffer>)=> (async()=>new Response(a)) as typeof fetch;
  const v=await loadStaticData(id,'/',f(wire));assert(v);assert.equal(v.length,s.size[0]*s.size[1]*4);assert.deepEqual(await loadStaticData(id,'/',f(raw)),v);
  const altered=wire.slice();altered[altered.length>>1]^=1;assert.equal(await loadStaticData(id,'/',f(altered)),undefined);
  raw[8]^=2;assert.equal(await loadStaticData(id,'/',f(raw)),undefined);
  assert.equal(await loadStaticData(id,'/',f(new Uint8Array(raw.length+1))),undefined);
  assert.equal(await loadStaticData(id,'/',async()=>new Response(null,{status:404})),undefined);
 }
});
test('geographic near terrain, capacity, source geometry, zero-based immutable direct term and exact material lease/wait/rollback',async(t)=>{
 const site=WIND_STATIONS['west-cape'].find(v=>v[0]==='WCW27')!,eye={...project(site[1],site[2]),y:90};
 const marker='col*=.90+.31*light;',src='precision highp float;\n uniform sampler2D old;void main(){'+marker+'}';
 const mat=new T.ShaderMaterial({fragmentShader:src,uniforms:{original:{value:41}}});let tiles=true,requests=0;
 const world={sun:new T.Vector3(-.60,.74,-.31).normalize(),visualGroundEpoch:0,cover:{distance:()=>254},terrain:{isLand:()=>true},surface:()=>({land:true}),visualGroundHeight:()=>16,regionalWindLightReceivers:()=>tiles?[{id:'1-7',m:mat}]:[]};
 const wind=createRegionalWind('west-cape',new T.Scene(),world as never)!;wind.update(eye,4.25);
 const context={world:world as never,base:'/',maxTextures:16,maxUniforms:224};
 assert.equal(staticWindLight('west-cape',{...context,maxTextures:15},wind),undefined);
 assert.equal(staticWindLight('west-cape',{...context,maxUniforms:223},wind),undefined);
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;wind.dispose();mat.dispose();});
 globalThis.fetch=async()=>{requests++;return new Response(bytes('west-cape'));};
 const state=staticWindLight('west-cape',context,wind)!;t.after(()=>state.dispose());
 state.update({...eye,x:eye.x+20000});await wait(4);assert.equal(requests,0);
 tiles=false;state.update(eye);await wait(4);assert.equal(requests,0);
 tiles=true;world.visualGroundEpoch++;state.update(eye);
 for(let i=0;i<40&&state.state.phase!=='ready';i++)await wait(10);
 assert.equal(state.state.phase,'ready');assert.equal(requests,1);state.update(eye);
 assert.equal(state.state.activeTiles,1);assert(state.state.nearCasters>0);assert(mat.fragmentShader.includes('regionalStaticDepth'));
 assert.equal(mat.uniforms.original.value,41);const same=mat.fragmentShader,version=mat.version;state.update(eye);assert.equal(mat.fragmentShader,same);assert.equal(mat.version,version);
 state.update({...eye,x:eye.x+20000});assert.equal(mat.fragmentShader,src);assert.deepEqual(Object.keys(mat.uniforms),['original']);
 state.update(eye);assert.equal(mat.fragmentShader,same);assert.equal(requests,1);
 // Preserve a concurrent unrelated accepted addition to the shader while removing only our own source.
 mat.fragmentShader+='\n// local nonwind study';state.clear();
 assert.equal(mat.fragmentShader,src+'\n// local nonwind study');assert.deepEqual(Object.keys(mat.uniforms),['original']);
 world.visualGroundEpoch++;mat.fragmentShader=Array.from({length:16},(_,i)=>'uniform sampler2D old'+i+';').join('')+'void main(){'+marker+'}';
 state.update(eye);assert.equal(state.state.activeTiles,0);assert.equal(requests,1);assert(!mat.fragmentShader.includes('regionalStatic'));
});
