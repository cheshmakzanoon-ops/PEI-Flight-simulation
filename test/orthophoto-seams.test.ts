import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {OrthophotoSeams,seamOptions} from '../src/render/orthophoto-seams.ts';

const N='4b1451500baea6ed936476e3dc39d7200ba281174ae7638dcf702b78745a13cb';
const S='7503afe173dde2532289bcc8ec93dc3753207f49f29070427e619c30744829';
// Read the exact source hash used by the sealed generation.
const SOUTH='7503afe173dde2532289bcc8ec93dc375ce3207f49f29070427e619c30744829';
const ids=['27-13','27-14'] as const;
const shader=()=>new T.ShaderMaterial({fragmentShader:
 'void main(){\n  col=textureGrad(detailMap,detailUV,du,dv).rgb;\n}'});
const source=()=>Object.assign(new T.Texture({width:640,height:640}),{flipY:false});
type Owner={detail:T.Texture;detailSince:number;lod:number;status:string};
function harness(reject=false){
 const copied:Array<[T.Texture,number,number]>=[];let built=0,lost=false;
 const renderer={getContext:()=>({NO_ERROR:0,getError:()=>0,isContextLost:()=>lost}),
  initTexture(){built++;},
  copyTextureToTexture(src:T.Texture,dst:T.Texture,box:T.Box2,xy:T.Vector2){
   copied.push([src,box.min.y,xy.y]);if(reject)throw Error('test allocation error');
   assert.equal(dst.image.width,640);assert.equal(dst.image.height,4);assert.equal(box.max.x-box.min.x,640);
 }} as unknown as T.WebGLRenderer;
 const base=new T.Texture(),module=new OrthophotoSeams(renderer,base);
 const a=shader(),b=shader(),out=shader();module.bind(ids[0],a);module.bind(ids[1],b);module.bind('other',out);
 assert(a.uniforms.orthoRowsGain===b.uniforms.orthoRowsGain);
 assert(a.uniforms.orthoSharedRows===b.uniforms.orthoSharedRows);
 assert(a.uniforms.orthoSharedRows.value===base&&!out.fragmentShader.includes('orthoSharedRows'));
 const owners=new Map<string,Owner>();
 const register=(side:number,decoded=source(),ok=true)=>{
  const id=ids[side],sha=side===0?N:SOUTH;
  module.verifiedDetail(id,ok?sha:S,decoded);
  owners.set(id,{detail:decoded,detailSince:1,lod:112,status:'ready'});
  return decoded;
 };
 return {module,copied,base,a,b,owners,register,update:(now:number)=>module.update(now,id=>owners.get(id)),
  allocations:()=>built,setLost:()=>{lost=true;}};
}
test('opt-in strip remains bilateral as tiles arrive, retire and return',()=>{
 const h=harness();assert(!seamOptions(new URLSearchParams()));
 assert(!seamOptions(new URLSearchParams('orthophotoSeamStudy&scenery=detail')));
 assert(!seamOptions(new URLSearchParams('orthophotoSeamStudy&surveyRelief')));
 assert(seamOptions(new URLSearchParams('orthophotoSeamStudy')));
 const n=h.register(0);n.onUpdate!(n);h.update(1.6);assert.equal(h.allocations(),0);
 const s=h.register(1);h.update(2);assert.equal(h.allocations(),0);
 s.onUpdate!(s);h.update(2.1);assert.equal(h.allocations(),1);
 assert.deepEqual(h.copied,[[s,638,0],[n,0,2]]);
 const strip=h.a.uniforms.orthoSharedRows.value;
 assert(strip===h.b.uniforms.orthoSharedRows.value&&strip!==h.base);
 assert.equal(h.a.uniforms.orthoRowsGain.value,0);
 h.update(2.18);assert(h.a.uniforms.orthoRowsGain.value>.45&&h.a.uniforms.orthoRowsGain.value<.55);
 h.update(3);h.update(3.1);assert.equal(h.a.uniforms.orthoRowsGain.value,1);assert.equal(h.allocations(),1);
 let retired=false;strip.addEventListener('dispose',()=>{retired=true;});
 h.module.evict(ids[1],s);h.owners.delete(ids[1]);h.update(4);
 assert(retired&&h.a.uniforms.orthoSharedRows.value===h.base&&h.b.uniforms.orthoRowsGain.value===0);
 const replacement=h.register(1);replacement.onUpdate!(replacement);h.update(5);h.update(6);
 assert.equal(h.a.uniforms.orthoRowsGain.value,1);assert.equal(h.allocations(),2);
 h.setLost();h.update(7);assert.equal(h.a.uniforms.orthoRowsGain.value,0);
});
test('wrong bytes and copy failure do not leave a half-bound strip or retry every frame',()=>{
 const h=harness(true),n=h.register(0),wrong=h.register(1,source(),false);
 n.onUpdate!(n);assert.equal(wrong.onUpdate,null);h.update(2);
 assert.equal(h.allocations(),0);
 const s=h.register(1);s.onUpdate!(s);h.update(3);h.update(4);
 assert.equal(h.allocations(),1);assert.equal(h.a.uniforms.orthoRowsGain.value,0);
 assert.equal(h.b.uniforms.orthoSharedRows.value,h.base);
 assert.equal(h.module.diagnostics()[0].errors,1);
});
