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

test('the reviewed Queens east-west join uses shared columns in the correct order',()=>{
 const copied:Array<[T.Texture,number,number,number,number]>=[];let builds=0;
 const gl={NO_ERROR:0,getError:()=>0,isContextLost:()=>false};
 const renderer={getContext:()=>gl,initTexture(){builds++;},
  copyTextureToTexture(src:T.Texture,dst:T.Texture,box:T.Box2,xy:T.Vector2){
   assert.equal(dst.image.width,4);assert.equal(dst.image.height,640);
   copied.push([src,box.min.x,box.max.x,box.max.y,xy.x]);
  }} as unknown as T.WebGLRenderer;
 const base=new T.Texture(),m=new OrthophotoSeams(renderer,base);
 const w=shader(),e=shader();m.bind('10-12',w);m.bind('11-12',e);
 assert(w.uniforms.orthoSharedRows===e.uniforms.orthoSharedRows&&w.uniforms.orthoRowsGain===e.uniforms.orthoRowsGain);
 assert(w.fragmentShader.includes('vuv.x*32. - 11.')&&e.fragmentShader===w.fragmentShader);
 assert(w.fragmentShader.includes('vec2(.5+crossTexel*.25,detailUV.y)'));
 const l=source(),r=source();
 m.verifiedDetail('10-12','aec5292f13fd5424f9881eb174e484b92313a885ac415b444640f298f633f65e',l);
 m.verifiedDetail('11-12','0872113e73cb6ca8a442ffc6b57c10c66e38e820f5b0e577bc6ecf3c78e55688',r);
 const ready=new Map([['10-12',{detail:l,detailSince:1,lod:112,status:'ready'}],['11-12',{detail:r,detailSince:1,lod:112,status:'ready'}]]);
 r.onUpdate!(r);m.update(2,k=>ready.get(k));assert.equal(builds,0);
 l.onUpdate!(l);m.update(2.2,k=>ready.get(k));m.advance(3);
 assert.equal(builds,1);assert.equal(w.uniforms.orthoRowsGain.value,1);
 assert.deepEqual(copied,[[l,638,640,640,0],[r,0,2,640,2]]);
 m.evict('10-12',l);assert(m.diagnostics().every(v=>!v.resident));
 assert(w.uniforms.orthoSharedRows.value===base&&e.uniforms.orthoRowsGain.value===0);
});

test('Standard bounds all four source pairs to close flight, with separate switches and unchanged historical study',()=>{
 const targets=['18-12 / 18-13','27-13 / 27-14','5-2 / 5-3','10-12 / 11-12'];
 const renderer={} as T.WebGLRenderer,base=new T.Texture();
 for(const scope of ['standard','counties','tracadie','study'] as const){
  const active=scope==='standard'?targets:scope==='tracadie'?targets.slice(0,1):targets.slice(1);
  const m=new OrthophotoSeams(renderer,base,scope);
  assert.deepEqual(m.diagnostics().map(p=>p.edge),active);
  for(const [pairId,pair] of targets.entries()){
   const isActive=active.includes(pair),materials=pair.split(' / ').map(id=>{
    const mat=shader();m.bind(id,mat);
    assert.equal('orthoRowsGain' in mat.uniforms,isActive);
    assert.equal(mat.fragmentShader.includes('smoothstep(205.,330.,distance(cameraPosition,p))'),isActive&&scope!=='study');
    return mat;
   });
   if(isActive){
    const shared=materials[0].uniforms.orthoRowsGain;
    assert.equal(materials[1].uniforms.orthoRowsGain,shared);assert.equal(shared.value,0);
    for(const other of targets.slice(pairId+1).filter(p=>active.includes(p))){
     const otherMaterial=shader();m.bind(other.split(' / ')[0],otherMaterial);
     assert.notEqual(otherMaterial.uniforms.orthoRowsGain,shared);
    }
   }
  }
  assert(m.diagnostics().every(p=>p.bytes===0&&!p.resident&&p.errors===0));
 }
});

test('two constrained inland windows have independent source cohorts, untouched historical owners, and exact northern row orientation',async()=>{
 const {INLAND_ORTHO_WINDOWS,inlandSourceWindows}=await import('../src/render/inland-ortho-windows.ts');
 const cover={bytes:new Uint8Array(4096*2720*2),width:4096,height:2720};
 assert.deepEqual(inlandSourceWindows(cover),[]);
 for(const p of INLAND_ORTHO_WINDOWS){
  const [x,z,w,h]=p.coverBox;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)for(let c=0;c<2;c++){
   cover.bytes[2*((z+j)*4096+x+i)+c]=p.coverRG[2*(j*w+i)+c];
  }
 }
 assert.deepEqual(inlandSourceWindows(cover),['west','central']);
 const west=INLAND_ORTHO_WINDOWS[0].coverBox;
 cover.bytes[2*(west[1]*4096+west[0])]^=1;
 assert.deepEqual(inlandSourceWindows(cover),['central']);
 const base=new T.Texture(),gpu={} as T.WebGLRenderer;
 const legacy=new OrthophotoSeams(gpu,base,'standard'),standard=new OrthophotoSeams(gpu,base,{tracadie:true,counties:true,inland:['west','central']});
 const all=new Set(standard.diagnostics().flatMap(p=>p.edge.split(' / ')));
 assert.equal(all.size,12);assert.equal(standard.diagnostics().length,6);
 const fx=(m:OrthophotoSeams,id:string)=>{const a=shader();m.bind(id,a);return a;};
 for(const row of legacy.diagnostics())for(const id of row.edge.split(' / ')){
  assert.equal(fx(legacy,id).fragmentShader,fx(standard,id).fragmentShader);
 }
 for(const p of INLAND_ORTHO_WINDOWS){
  const a=fx(standard,p.first),b=fx(standard,p.second),[lo,core,top,hi]=p.northRows;
  assert.equal(a.fragmentShader,b.fragmentShader);assert.equal(a.uniforms.orthoRowsGain,b.uniforms.orthoRowsGain);
  assert(a.fragmentShader.includes('(1.-detailUV.y)*640.'));
  assert(a.fragmentShader.includes('northSourceRow>'+lo+'.&&northSourceRow<'+hi+'.'));
  assert(a.fragmentShader.includes('smoothstep('+lo+'.,'+core+'.,northSourceRow)'));
  assert(a.fragmentShader.includes('smoothstep('+top+'.,'+hi+'.,northSourceRow)'));
  assert.equal('orthoRowsGain' in fx(legacy,p.first).uniforms,false);
  assert.equal('orthoRowsGain' in fx(new OrthophotoSeams(gpu,base,'study'),p.first).uniforms,false);
 }
});
