/** Real r187 owned objects/buffers and digest archives; host probes simulated. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {SEALED} from '../tools/art/woodland-envelope/envelope-seal.generated.ts';
import {prepareEnvelopeSource,bindFreshEnvelope,createBeginLatch,COVER} from '../tools/art/woodland-envelope/envelope-lease.ts';
import {detachedEnvelopeGroup} from '../tools/art/woodland-envelope/envelopes.ts';
import {opaqueCoverageBlend} from '../src/render/opaque-coverage-alpha.ts';
import {branchFragment,branchVertex} from '../tools/art/woodland-envelope/original-program.ts';
const C=fileURLToPath(new URL('..',import.meta.url));
const frames=JSON.parse(readFileSync(new URL('../tools/art/woodland-envelope/archive-intact-actors.json',import.meta.url),'utf8')).frames;
const sha=b=>createHash('sha256').update(b).digest('hex');
const shape=b=>Buffer.from(b.buffer,b.byteOffset,b.byteLength);
function packet(sub,id,indexSHA){
 const d=join(C,'public/world/woodland',sub),idx=readFileSync(join(d,'index.json'));
 assert.equal(sha(idx),indexSHA);
 const p=JSON.parse(idx),t=p.tiles.find(q=>q.id===id),f=p.packs[t.pack],b=readFileSync(join(d,f.file));
 assert.equal(sha(b),f.sha256);
 return gunzipSync(b.subarray(t.offset,t.offset+t.bytes));
}
const staged=async row=>{
 const crown=packet('crown-v1',row.owner,'54e8689b87a9dc0009ca79e92635460afb459813100d95f634af4be8cf86655a');
 const height=packet('stream-v1',row.owner,'5878c49f6a6c2cb896606c07be2d2943586edad10f45871116d36ef88d716efe');
 const source=await prepareEnvelopeSource(row.route,crown,height);
 assert.ok(source);
 return {source,crown,height};
};
const material=()=>{
 const m=new T.ShaderMaterial({vertexShader:branchVertex,fragmentShader:branchFragment,alphaToCoverage:true,side:T.DoubleSide,
  uniforms:{volumeFade:{value:new T.Vector3(79,86,1)}},...opaqueCoverageBlend});
 return m;
};
const make=(row,source,phase)=>{
 const scene=new T.Scene(),g=new T.InstancedBufferGeometry(),tex=new T.Texture(),canopy=new T.ShaderMaterial({uniforms:{canopy:{value:tex}}});
 const crown=new T.Mesh(g,canopy),shade=new T.Mesh(g,new T.ShaderMaterial({transparent:true,depthWrite:false})),peer=new T.Mesh(new T.BufferGeometry(),new T.ShaderMaterial());
 scene.add(crown,shade,peer);
 const facts={phase:phase??'dispatch',route:row.route,flight:{},heightPlan:{},source,signedBase:true,defaultStandard:true,
  view:'Chase',stockChoice:false,trustedIntactHost:true,nativeViewport:true,raster:[4,8,24],residentCover:COVER,originalCrown:crown,originalShade:shade,scene,
  regionId:row.region,regionalState:row.mandatoryPeerWordBytes?'ready-and-cleared':'proved-disjoint',regionalProof:{},
  protectedWords:Uint8Array.from({length:row.mandatoryPeerWordBytes??80},(_,j)=>j%251),otherProtectedOwners:[peer]};
 return {facts,scene,g,tex,shade,crown,peer,read:()=>facts};
};
function art(row,id,another=false){
 const f=frames.find(q=>q.route===row.route&&q.frame===id);
 let a=f.actors;
 if(another){
  const x=a[0],i=[...x.input];i[0]=Math.fround(i[0]+1.03125);
  a=[...a,{input:i,e:x.e}];
 }
 const o=detachedEnvelopeGroup(a,'original');
 assert.ok(o);
 return o;
}
const queen=SEALED[1],sourceQ=await staged(queen);
function start(row,source,view){
 const host=make(row,source),latch=createBeginLatch(),grant=latch.begin(host.read,source);
 assert.ok(grant);
 host.facts.phase='flight';return {host,latch,grant,art:art(row,view)};
}
function open(T0){
 const e=bindFreshEnvelope(T0.grant,T0.art.meshes);
 assert.ok(e);
 for(const m of T0.art.meshes){m.visible=true;T0.host.scene.add(m);}
 return e;
}
test('same pose and exact old full-branch geometry, actors, refs, texture, off/shape/restore; all three source cohorts',async()=>{
 for(const row of SEALED){
  const {source}=await staged(row);
  for(const f of row.archivePositive){
   const t=start(row,source,f.frame),{host}=t;
   const pins=t.art.meshes.map(m=>({m,g:m.geometry,p:m.material,u:m.material.uniforms.volumeFade,
    a:Object.entries(m.geometry.attributes).map(([k,a])=>[k,a,a.array,Buffer.from(shape(a.array))]),
    e:m.geometry.index,et:Buffer.from(shape(m.geometry.index.array))}));
   const prior=[host.crown.geometry,host.crown.material,host.shade.geometry,host.shade.material,host.tex.source,host.tex.source.version,host.tex.version,
    host.crown.material.uniforms.canopy,host.crown.material.uniforms.canopy.value,host.peer.geometry,host.peer.material];
   const e=open(t);
   assert.equal(e.log().styled,f.branches);
   assert.equal(e.log().triangles,f.triangles);
   assert.ok(e.log().draws<=4);
   let shots=0;
   const run=w=>()=>{
    shots++;assert.equal(e.log().gain,w);
    pins.forEach(({m,g,p,u,a,e,et})=>{
     assert.equal(m.geometry,g);assert.equal(m.material,p);assert.equal(p.uniforms.volumeFade,u);assert.equal(p.uniforms.peiEnvelopeGain.value,w);
     assert.equal(m.geometry.index,e);assert.ok(shape(e.array).equals(et));
     for(const [k,at,ref,b] of a){
      assert.equal(g.attributes[k],at);assert.equal(g.attributes[k].array,ref);assert.ok(shape(g.attributes[k].array).equals(b));
     }
    });
    assert.deepEqual([host.crown.geometry,host.crown.material,host.shade.geometry,host.shade.material,host.tex.source,host.tex.source.version,host.tex.version,
     host.crown.material.uniforms.canopy,host.crown.material.uniforms.canopy.value,host.peer.geometry,host.peer.material],prior);
    return w;
   };
   assert.equal(e.draw('off',run(0)),0);
   assert.equal(e.draw('shape',run(1)),1);
   assert.equal(e.draw('off',run(0)),0);
   assert.equal(shots,3);assert.equal(e.log().gain,0);
   e.close();assert.equal(e.draw('shape',run(0)),0);
   t.art.dispose();
  }
 }
});
test('corrupt sources, one-shot early click, incompatible viewport standard or mode, and absent protected source never arm',async()=>{
 const {source,crown,height}=sourceQ,h=make(queen,source),bad=Uint8Array.from(crown);bad[5]^=1;
 assert.equal(await prepareEnvelopeSource(queen.route,bad,height),undefined);
 assert.equal(await prepareEnvelopeSource(queen.route,crown,height.subarray(1)),undefined);
 assert.equal(await prepareEnvelopeSource('harbour-low',crown,height),undefined);
 const latch=createBeginLatch();
 assert.equal(latch.begin(h.read,undefined),undefined);
 assert.equal(latch.begin(h.read,source),undefined);
 const reject=d=>{const good=make(queen,source);Object.assign(good.facts,d);assert.equal(createBeginLatch().begin(good.read,source),undefined);};
 for(const d of [{raster:[0,8,24]},{phase:'flight'},{defaultStandard:false},{stockChoice:true},{trustedIntactHost:false},{regionId:'wrong'},
  {regionalState:'proved-disjoint'},{protectedWords:new Uint8Array(4)},{signedBase:false},{view:'Cockpit'},{nativeViewport:false},{source:{...source}}])reject(d);
 assert.equal(createBeginLatch().begin(()=>{throw Error('observer unavailable');},source),undefined);
});
test('unmatched original branches remain exact neutral; old EBO, position, W or spin defects reject before any installation',()=>{
 const t=start(queen,sourceQ.source,190);
 const a=art(queen,190,true);
 const e=bindFreshEnvelope(t.grant,a.meshes);assert.ok(e);assert.equal(e.log().styled,15);
 assert.ok(a.meshes.some(m=>{
  const q=m.geometry.attributes.treeEnvelope.array;
  return Array.from({length:q.length/3},(_,i)=>i*3).some(ix=>q[ix]===0&&q[ix+1]===0&&q[ix+2]===0);
 }));
 a.dispose();t.art.dispose();
 for(const defect of ['width','spin','ebo','xyz','blend']){
  const t=start(queen,sourceQ.source,190),m=t.art.meshes[0],g=m.geometry;
  if(defect==='width')g.attributes.treeShape.array[1]=Math.fround(g.attributes.treeShape.array[1]+.0625);
  if(defect==='spin')g.attributes.treeSpin.array[0]=.5;
  if(defect==='ebo')g.index.array[0]++;
  if(defect==='xyz')g.attributes.position.array[0]+=.0625;
  if(defect==='blend')m.material.blendSrcAlpha=T.OneFactor;
  assert.equal(bindFreshEnvelope(t.grant,t.art.meshes),undefined);
  assert.ok(t.art.meshes.every(o=>!o.geometry.attributes.treeEnvelope&&o.material.vertexShader===branchVertex&&!o.material.uniforms.peiEnvelopeGain));
  t.art.dispose();
 }
});
test('viewer, protected peer, source, in-place owner and renderer faults fail closed without touching a borrowed uniform/texture',()=>{
 for(const dir of ['peer','shadow','source','view','data','shader','reader','leave','texture','visibility','apart','peerMaterial']){
  const t=start(queen,sourceQ.source,340),g=open(t),a=t.art.meshes[0];
  if(dir==='peer')t.host.facts.protectedWords[21599]^=1;
  if(dir==='shadow')t.host.shade.material.depthWrite=true;
  if(dir==='source')t.host.facts.heightPlan={};
  if(dir==='view')t.host.facts.raster=[0,8,24];
  if(dir==='data')a.geometry.attributes.treeShape.array[1]+=1/16;
  if(dir==='shader')a.material.blendSrcAlpha=T.OneFactor;
  if(dir==='reader')Object.defineProperty(t.host.facts,'heightPlan',{get(){throw Error('unavailable observer');}});
  if(dir==='leave')t.latch.leave();
  if(dir==='texture')t.host.tex.source.needsUpdate=true;
  if(dir==='visibility')a.visible=false;
  if(dir==='apart')a.removeFromParent();
  if(dir==='peerMaterial')t.host.peer.material=new T.ShaderMaterial();
  assert.equal(g.draw('shape',()=>g.log().gain),0,dir);
  assert.equal(g.log().gain,0);g.close();t.art.dispose();
 }
 const t=start(queen,sourceQ.source,190),g=open(t),err=Error('render threw');
 assert.throws(()=>g.draw('shape',()=>{assert.equal(g.log().gain,1);throw err;}),x=>x===err);
 assert.equal(g.log().gain,0);
 assert.throws(()=>g.draw('shape',()=>g.draw('off',()=>{})),/already drawing/);
 assert.equal(g.log().gain,0);
 g.draw('shape',()=>{assert.equal(g.log().gain,1);t.host.facts.protectedWords[1]^=1;});
 assert.equal(g.log().gain,0);assert.equal(g.log().refusal,'post-render custody');assert.equal(g.log().retired,true);
 assert.equal(g.draw('shape',()=>g.log().gain),0);t.art.dispose();
});

test('the factory meshes bind directly, and observed old geometry or material aliases are never patched',()=>{
 for(const role of ['geometry','material','marker'] as const){
  const t=start(queen,sourceQ.source,190),first=t.art.meshes[0];
  let marker: T.ShaderMaterial|undefined;
  if(role==='geometry') t.host.peer.geometry=first.geometry;
  if(role==='material') t.host.peer.material=first.material;
  if(role==='marker'){marker=material();t.host.peer.material=marker;}
  const old=t.host.peer.material.vertexShader;
  assert.equal(bindFreshEnvelope(t.grant,t.art.meshes,marker),undefined);
  assert.equal(t.host.peer.material.vertexShader,old);
  assert.equal(t.host.peer.material.uniforms.peiEnvelopeGain,undefined);
  assert.equal(first.geometry.getAttribute('treeEnvelope'),undefined);
  t.art.dispose();
 }
});
