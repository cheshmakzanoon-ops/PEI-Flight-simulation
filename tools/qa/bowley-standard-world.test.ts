/** Authenticated source, actual World.surface and five protected controls.
 * Node only substitutes image decoding; the source and terrain paths are real. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {bowleyCoreRequested,sceneryOptions} from '../../src/app/scenery-profile.ts';
import {BOWLEY_POND} from '../../src/sim/bowley-pond.generated.ts';
import {loadBowleyPond} from '../../src/sim/bowley-pond.ts';
import {project} from '../../src/sim/geo.ts';

const src=new URL('../../src/',import.meta.url).href;
const hooks=registerHooks({load(url,ctx,next){
 const out=next(url,ctx);
 return out.source&&url.startsWith(src)&&url.endsWith('.ts')?{...out,source:"import.meta.env={BASE_URL:'/'};\n"+out.source}:out;
}});
const {loadAtlas,World}=await import('../../src/render/world.ts');
hooks.deregister();
const root=new URL('../../public/',import.meta.url),key='/world/'+BOWLEY_POND.file;
const body=readFileSync(new URL(key.slice(1),root)),wrong=gunzipSync(body);
wrong[313]^=3;
const bad=gzipSync(wrong);
const wet=[[-62.708898169803,46.449062659262],[-62.708116539095,46.448702821100],[-62.707400044280,46.448401456640]] as const;
const protectedSites=[[-62.7139013,46.4486817],[-62.7073147,46.4453551],[-62.70914,46.44553],[-62.70914,46.45172],[-62.7187079,46.4560696]] as const;

function contact(world:InstanceType<typeof World>,point:readonly [number,number]){
 const {x,z}=project(...point),surface=world.surface(x,z);
 assert.equal(world.groundHeight(x,z),surface.height);
 return {surface,fresh:world.freshwaterContains(x,z)};
}
test('Standard Bowley signed contact is local and fails stock-safe on invalid data and registration', {timeout:30000},async()=>{
 const fetchOriginal=globalThis.fetch, oldDocument=globalThis.document;
 const load=THREE.TextureLoader.prototype.load,loadAsync=THREE.TextureLoader.prototype.loadAsync;
 globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})} as unknown as Document;
 THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
 THREE.TextureLoader.prototype.loadAsync=async()=>new THREE.Texture();
 try{
  const result=new Map();
  for(const phase of ['standard','stock','corrupt','spatial-drift'] as const){
   let requests=0;
   globalThis.fetch=async(input)=>{
    const path=String(input);
    if(path===key){requests++;return new Response(Uint8Array.from(phase==='corrupt'?bad:body));}
    try{
     const buffer=readFileSync(new URL(path.slice(1),root));
     if(path==='/world/terrain.json'&&phase==='spatial-drift'){
      const manifest=JSON.parse(buffer.toString());
      // Same verified elevation data, still a valid original world, but
      // not the exact pixel-edge WGS84 registration of the pond asset.
      manifest.bounds[0]+=.000002;
      return new Response(JSON.stringify(manifest));
     }
     return new Response(Uint8Array.from(buffer));
    }catch{return new Response(null,{status:404});}
   };
   const request=bowleyCoreRequested(sceneryOptions(phase==='stock'?'?stockBowleyPond':''));
   const a=await loadAtlas(()=>{},false,false,false,undefined,false,undefined,request?loadBowleyPond('/world/'):undefined,true);
   const scene=new THREE.Scene(),renderer={capabilities:{maxTextureSize:4096}} as THREE.WebGLRenderer;
   const world=new World(scene,a.terrain,a.img,renderer,a.cover,a.sky,a.bench,a.southLake,a.sourisLighting,
    false,false,false,undefined,undefined,false,false,false,false,false,a.bowley);
   assert.equal(world.bowleyPond,phase==='standard'?BOWLEY_POND.id:null);
   assert.equal(requests,request?1:0);
   result.set(phase,{wet:wet.map(p=>contact(world,p)),protected:protectedSites.map(p=>contact(world,p))});
   scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});scene.clear();
  }
  const standard=result.get('standard'),stock=result.get('stock');
  assert.deepEqual(standard.wet,wet.map(()=>({surface:{height:1.132,land:false,runway:false},fresh:true})));
  assert.deepEqual(stock.wet,wet.map(()=>({surface:{height:1.12,land:true,runway:false},fresh:false})));
  assert.deepEqual(standard.protected,stock.protected);
  assert.deepEqual(result.get('corrupt'),stock);
 }finally{
  globalThis.fetch=fetchOriginal;globalThis.document=oldDocument;
  THREE.TextureLoader.prototype.load=load;THREE.TextureLoader.prototype.loadAsync=loadAsync;
 }
});
