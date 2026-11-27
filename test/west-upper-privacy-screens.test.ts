import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {addLighthouseScenery} from '../src/render/lighthouses.ts';
import {appendWestUpperPrivacyScreens} from '../src/render/west-upper-privacy-screens.ts';
import {Terrain} from '../src/sim/terrain.ts';

const f=(p:string)=>readFileSync(new URL('../public/world/'+p,import.meta.url));
const spec=JSON.parse(f('terrain.json').toString()),z=gunzipSync(f(spec.file));
const terrain=new Terrain(spec,new Int16Array(z.buffer,z.byteOffset,z.byteLength/2));
const [east,west]=addLighthouseScenery(new T.Scene(),terrain);
const body=(a:T.LOD,i:number)=>(a.levels[i].object.children[0] as T.Mesh).geometry;
const sha=(x:Buffer)=>createHash('sha256').update(x).digest('hex');
const bytes=(a:T.BufferAttribute|T.InterleavedBufferAttribute)=>{
  const v=a.array;return Buffer.from(v.buffer,v.byteOffset,v.byteLength);
};

test('West Point adds five screens in its existing batch without changing the other light station or LODs',()=>{
 const w=body(west,0);
 assert.equal(w.attributes.position.count,16803);
 assert.equal(body(west,1).attributes.position.count,1686);
 assert.equal(body(east,0).attributes.position.count,8727);
 assert.equal(body(east,1).attributes.position.count,1836);
 assert.equal(w.index,null);
 assert.equal(w.groups.length,0);
 assert.deepEqual(west.levels.map(l=>[l.distance,l.hysteresis]),[[0,0],[750,.08],[8500,.06]]);
 assert.equal(sha(bytes(w.attributes.position).subarray(0,15963*3*4)),'db364cd3b2d81c9acc40caa4002cbdad3f9ab3253ee3f251a119a6ef2e14d24e');
 assert.equal(sha(bytes(w.attributes.position)),'4dab799da23f4d03c46f70f7b98af7927180bbfce271f40fd1e09ee78613c908');
 assert.equal(appendWestUpperPrivacyScreens(body(west,1)),body(west,1));
});

test('each West Point board stays closed and seated at the original upper floor height',()=>{
 const p=body(west,0).attributes.position,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 const key=(r:T.Vector3)=>r.toArray().map(v=>String(v)).join('/');
 const deckTop=Math.fround(3.26);
 for(let k=0;k<5;k++){
  const first=15963+k*168,edges=new Map<string,[number,number]>();
  let volume=0,minY=Infinity,maxY=-Infinity;
  for(let j=first;j<first+168;j+=3){
   a.fromBufferAttribute(p,j);b.fromBufferAttribute(p,j+1);c.fromBufferAttribute(p,j+2);
   minY=Math.min(minY,a.y,b.y,c.y);maxY=Math.max(maxY,a.y,b.y,c.y);
   assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-10);
   volume+=a.dot(b.clone().cross(c))/6;
   for(const [l,r]of [[key(a),key(b)],[key(b),key(c)],[key(c),key(a)]]){
    const k=l<r?l+' '+r:r+' '+l,q=edges.get(k)??[0,0];edges.set(k,[q[0]+1,q[1]+(l<r?1:-1)]);
   }
  }
  assert.ok(edges.size===84&&[...edges.values()].every(([n,sign])=>n===2&&sign===0));
  assert.equal(minY,deckTop);
  assert.ok(maxY<=4.96&&volume>.18&&volume<.20);
 }
});

test('do not add West screens when the protected deck top does not match',()=>{
 const all=body(west,0),old=new T.BufferGeometry();
 for(const [k,a] of Object.entries(all.attributes)){
  const x=a.array.slice(0,15963*a.itemSize);
  old.setAttribute(k,new T.BufferAttribute(x,a.itemSize));
 }
 const position=old.attributes.position;
 position.setY(12807,position.getY(12807)-.01);
 assert.equal(appendWestUpperPrivacyScreens(old),old);
 assert.equal(old.attributes.position.count,15963);
 old.dispose();
});

test('only the new boards acquire an opaque fade, ending before both stock LOD thresholds',()=>{
 const old=(east.levels[0].object.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>).material;
 const near=(west.levels[0].object.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>).material;
 assert.notEqual(near,old);
 assert.equal(near.transparent,old.transparent);
 assert.equal(near.alphaToCoverage,old.alphaToCoverage);
 assert.equal(near.depthWrite,old.depthWrite);
 const g=body(west,0).getAttribute('clad');
 for(let i=0;i<g.count;i++)assert.ok(i<15963?g.getX(i)>=0:g.getX(i)===-1);
 const args={
  uniforms:{},
  vertexShader:T.ShaderLib.standard.vertexShader,
  fragmentShader:T.ShaderLib.standard.fragmentShader
 };
 near.onBeforeCompile(args,{} as T.WebGLRenderer);
 assert.equal(args.vertexShader.split('smoothstep(320.,650.,').length,2);
 assert.ok(args.fragmentShader.includes('if(vClad<-.5&&vWestScreenGain<1.)'));
 assert.ok(args.fragmentShader.includes('if(vWestScreenGain<=0.)discard;'));
 assert.equal(args.fragmentShader.split('const mat4 ranks=').length,2);
 assert.ok(args.fragmentShader.indexOf('#include <dithering_fragment>')<args.fragmentShader.indexOf('if(vClad<-.5'));
 assert.ok(650<750*(1-.08));
});
