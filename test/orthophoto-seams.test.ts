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

test('constrained inland windows retain separate source cohorts, historical owners and row or column orientation',async()=>{
 const {INLAND_ORTHO_WINDOWS,inlandSourceWindows}=await import('../src/render/inland-ortho-windows.ts');
 const cover={bytes:new Uint8Array(4096*2720*2),width:4096,height:2720};
 assert.deepEqual(inlandSourceWindows(cover),[]);
 for(const p of INLAND_ORTHO_WINDOWS){
  const [x,z,w,h]=p.coverBox;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)for(let c=0;c<2;c++){
   cover.bytes[2*((z+j)*4096+x+i)+c]=p.coverRG[2*(j*w+i)+c];
  }
 }
 const ids=INLAND_ORTHO_WINDOWS.map(w=>w.name);
 assert.deepEqual(inlandSourceWindows(cover),ids);
 const west=INLAND_ORTHO_WINDOWS[0].coverBox;
 cover.bytes[2*(west[1]*4096+west[0])]^=1;
 assert.deepEqual(inlandSourceWindows(cover),ids.filter(n=>n!=='west'));
 const base=new T.Texture(),gpu={} as T.WebGLRenderer;
 const legacy=new OrthophotoSeams(gpu,base,'standard'),standard=new OrthophotoSeams(gpu,base,{tracadie:true,counties:true,inland:ids});
 const all=new Set(standard.diagnostics().flatMap(p=>p.edge.split(' / ')));
 const ink=['edge-12-16e','edge-22-13s','edge-13-15e'];
 const westExtra=["edge-9-10e", "edge-1-7e"];
 const next=["edge-17-14s","edge-9-13s","edge-6-10s"];
 const added=[...westExtra,...next];
 assert.deepEqual(ids.slice(-3-added.length,-added.length),ink);
 assert.deepEqual(ids.slice(-added.length),added);
 assert.equal(standard.diagnostics().length,23+ink.length+added.length);
 const lockOwners=new Set(standard.diagnostics().slice(0,-added.length).flatMap(p=>p.edge.split(' / ')));
 for(const id of ['20-16','20-17','20-18','20-19'])lockOwners.add(id);
 for(const plan of INLAND_ORTHO_WINDOWS.filter(p=>added.includes(p.name)))for(const key of [plan.first,plan.second]){
  assert(!lockOwners.has(key));lockOwners.add(key);
 }
 assert.equal(new Set(INLAND_ORTHO_WINDOWS.map(p=>p.axis)).size,2);
 assert.equal(all.size,standard.diagnostics().length*2-7);
 const fx=(m:OrthophotoSeams,id:string)=>{const a=shader();m.bind(id,a);return a;};
 for(const row of legacy.diagnostics())for(const id of row.edge.split(' / ')){
  assert.equal(fx(legacy,id).fragmentShader,fx(standard,id).fragmentShader);
 }
 for(const p of INLAND_ORTHO_WINDOWS){
  const solo=new OrthophotoSeams(gpu,base,{tracadie:false,counties:false,inland:[p.name]});
  const a=fx(solo,p.first),b=fx(solo,p.second),[lo,core,top,hi]='northRows' in p?p.northRows:p.alongSourceTexels;
  const v='northRows' in p?'northSourceRow':'sourceAlong';
  assert.equal(a.fragmentShader,b.fragmentShader);assert.equal(a.uniforms.orthoRowsGain,b.uniforms.orthoRowsGain);
  assert(a.fragmentShader.includes(p.axis==='x'?'(1.-detailUV.y)*640.':'detailUV.x*640.'));
  assert(a.fragmentShader.includes(v+'>'+lo+'.&&'+v+'<'+hi+'.'));
  assert(a.fragmentShader.includes('smoothstep('+lo+'.,'+core+'.,'+v+')'));
  assert(a.fragmentShader.includes('smoothstep('+top+'.,'+hi+'.,'+v+')'));
  assert.equal('orthoRowsGain' in fx(legacy,p.first).uniforms,false);
  assert.equal('orthoRowsGain' in fx(new OrthophotoSeams(gpu,base,'study'),p.first).uniforms,false);
 }
});

test('new narrow field lanes leave all preexisting owners first and fail to the original sampler',async()=>{
 const {INLAND_ORTHO_WINDOWS}=await import('../src/render/inland-ortho-windows.ts');
 const base=new T.Texture(),pairs=[
  ['12-16','south-central-fields','edge-12-16e'],
  ['13-16','queens-southwest-fields','edge-12-16e'],
  ['22-13','kings-central-cropland','edge-22-13s'],
  ['14-15','edge-14-15s','edge-13-15e'],
 ] as const;
 for(const [shared,old,next] of pairs){
  const picks=INLAND_ORTHO_WINDOWS.filter(p=>p.name===old||p.name===next);
  assert.deepEqual(picks.map(p=>p.name),[old,next]);
  assert.equal(picks[0].first===shared?picks[0].nsha:picks[0].ssha,picks[1].first===shared?picks[1].nsha:picks[1].ssha);
  for(const supported of [true,false]){
   const r={capabilities:{isWebGL2:true,maxTextures:supported?16:15}} as T.WebGLRenderer;
   const m=new OrthophotoSeams(r,base,{tracadie:false,counties:false,inland:[old,next]});
   const a=shader(),before=shader(),after=shader();
   const peer=(j:number)=>picks[j].first===shared?picks[j].second:picks[j].first;
   m.bind(shared,a);m.bind(peer(0),before);m.bind(peer(1),after);
   assert.equal(a.uniforms.orthoRowsGain,before.uniforms.orthoRowsGain);
   assert.notEqual(a.uniforms.orthoRowsGain,after.uniforms.orthoRowsGain);
   if(supported)assert.equal(a.uniforms.orthoRowsGainLane2,after.uniforms.orthoRowsGain);
   else assert.equal(a.uniforms.orthoRowsGainLane2,undefined);
  }
 }
});

test('bounded Kings north/south pair rejects its wrong owner, then binds exact bottom-origin donor lanes', async()=>{
 const {INLAND_ORTHO_WINDOWS}=await import('../src/render/inland-ortho-windows.ts');
 const plan=INLAND_ORTHO_WINDOWS.find(p=>p.name==='east-fields')!;
 const n=source(),s=source(),bad=source(),base=new T.Texture();
 const copies:Array<[T.Texture,number,number,number]>=[];
 const renderer={getContext:()=>({NO_ERROR:0,getError:()=>0,isContextLost:()=>false}),
  initTexture(){},copyTextureToTexture(src:T.Texture,dst:T.Texture,box:T.Box2,xy:T.Vector2){
   assert.equal(dst.image.width,640);assert.equal(dst.image.height,4);
   copies.push([src,box.min.y,box.max.y,xy.y]);
  }} as unknown as T.WebGLRenderer;
 const m=new OrthophotoSeams(renderer,base,{tracadie:true,counties:true,inland:[plan.name]});
 const a=shader(),b=shader();m.bind(plan.first,a);m.bind(plan.second,b);
 const row=(detail:T.Texture)=>({detail,detailSince:1,lod:112,status:'ready'});
 const ready=new Map([[plan.first,row(bad)],[plan.second,row(s)]]);
 m.verifiedDetail(plan.second,plan.ssha,s);s.onUpdate!(s);
 m.verifiedDetail(plan.first,plan.ssha,bad);
 assert.equal(bad.onUpdate,null);m.update(2,id=>ready.get(id));
 assert.deepEqual(copies,[]);assert.equal(a.uniforms.orthoSharedRows.value,base);
 ready.set(plan.first,row(n));m.verifiedDetail(plan.first,plan.nsha,n);n.onUpdate!(n);
 m.update(2.1,id=>ready.get(id));m.advance(3);
 assert.deepEqual(copies,[[s,638,640,0],[n,0,2,2]]);
 assert.equal(a.uniforms.orthoRowsGain.value,1);
 assert.equal(b.uniforms.orthoSharedRows.value,a.uniforms.orthoSharedRows.value);
 m.evict(plan.first,n);
 assert.equal(b.uniforms.orthoRowsGain.value,0);
 assert.equal(a.uniforms.orthoSharedRows.value,base);
 assert(m.diagnostics().every(p=>!p.resident&&p.errors===0));
});

test('a stock tile can witness two independent close lanes and retire each without invalidating the other',async()=>{
 const {INLAND_ORTHO_WINDOWS}=await import('../src/render/inland-ortho-windows.ts');
 const west=INLAND_ORTHO_WINDOWS.find(p=>p.name==='central')!;
 const east=INLAND_ORTHO_WINDOWS.find(p=>p.name==='queens-shared-west')!;
 assert.equal(west.second,east.first);assert.equal(west.ssha,east.nsha);
 const caps={maxTextures:16,isWebGL2:true},base=new T.Texture();let strips=0;
 const renderer={capabilities:caps,getContext:()=>({NO_ERROR:0,getError:()=>0,isContextLost:()=>false}),
  initTexture(){strips++;},copyTextureToTexture(){}} as unknown as T.WebGLRenderer;
 const make=()=>new OrthophotoSeams(renderer,base,{tracadie:false,counties:false,inland:[west.name,east.name]});
 const normal=make(),material=shader(),left=shader(),right=shader();
 normal.bind(west.first,left);normal.bind(west.second,material);normal.bind(east.second,right);
 assert.equal(material.uniforms.orthoRowsGain,left.uniforms.orthoRowsGain);
 assert.equal(material.uniforms.orthoRowsGainLane2,right.uniforms.orthoRowsGain);
 assert.notEqual(material.uniforms.orthoSharedRows,material.uniforms.orthoSharedRowsLane2);
 assert(material.fragmentShader.includes('orthoSharedRowsLane2')&&material.fragmentShader.includes('sourceAlong'));
 const ready=new Map<string,Owner>();
 for(const [id,sha] of [[west.first,west.nsha],[west.second,west.ssha],[east.second,east.ssha]]){
  const t=source();ready.set(id,{detail:t,detailSince:1,lod:112,status:'ready'});
  normal.verifiedDetail(id,sha,t);t.onUpdate!(t);
 }
 normal.update(2,id=>ready.get(id));normal.update(2.2,id=>ready.get(id));normal.advance(3);
 assert.equal(strips,2);assert.equal(material.uniforms.orthoRowsGain.value,1);
 assert.equal(material.uniforms.orthoRowsGainLane2.value,1);
 const old=ready.get(west.second)!.detail;
 let disposed=0;
 for(const key of ['orthoSharedRows','orthoSharedRowsLane2'])
  material.uniforms[key].value.addEventListener('dispose',()=>{disposed++;});
 normal.evict(west.second,old);
 assert.equal(disposed,2);
 assert.equal(material.uniforms.orthoRowsGain.value,0);
 assert.equal(material.uniforms.orthoRowsGainLane2.value,0);
 assert.equal(material.uniforms.orthoSharedRows.value,base);
 assert.equal(material.uniforms.orthoSharedRowsLane2.value,base);
 const reload=source();
 ready.set(west.second,{detail:reload,detailSince:3,lod:112,status:'ready'});
 normal.verifiedDetail(west.second,west.ssha,reload);reload.onUpdate!(reload);
 normal.update(4,id=>ready.get(id));normal.update(4.2,id=>ready.get(id));normal.advance(5);
 assert.equal(strips,4);
 assert.equal(material.uniforms.orthoRowsGain.value,1);
 assert.equal(material.uniforms.orthoRowsGainLane2.value,1);
 normal.evict(east.second,ready.get(east.second)!.detail);
 assert.equal(material.uniforms.orthoRowsGain.value,1);
 assert.equal(material.uniforms.orthoRowsGainLane2.value,0);
 normal.evict(west.second,ready.get(west.second)!.detail);
 assert.equal(material.uniforms.orthoRowsGain.value,0);
 caps.maxTextures=15;
 const limited=make(),one=shader();limited.bind(west.second,one);
 assert.equal('orthoSharedRowsLane2' in one.uniforms,false);
 assert('orthoSharedRows' in one.uniforms);
 caps.maxTextures=16;
 const atCapacity=shader();atCapacity.fragmentShader='uniform sampler2D fixed[15];\n'+atCapacity.fragmentShader;
 make().bind(west.second,atCapacity);
 assert('orthoSharedRows' in atCapacity.uniforms);
 assert.equal('orthoSharedRowsLane2' in atCapacity.uniforms,false);
});

test('one eastern terrain owner keeps independent row and column strips, with exact old-lane fallback',async()=>{
 const {INLAND_ORTHO_WINDOWS}=await import('../src/render/inland-ortho-windows.ts');
 const north=INLAND_ORTHO_WINDOWS.find(p=>p.name==='east-fields')!;
 const east=INLAND_ORTHO_WINDOWS.find(p=>p.name==='kings-shared-fields')!;
 assert.equal(north.axis,'z');assert.equal(east.axis,'x');
 assert.equal(north.second,east.first);assert.equal(north.ssha,east.nsha);
 const base=new T.Texture(),copied:Array<[number,number]>=[];
 const caps={maxTextures:16,isWebGL2:true};
 const renderer={capabilities:caps,getContext:()=>({NO_ERROR:0,getError:()=>0,isContextLost:()=>false}),
  initTexture(){},copyTextureToTexture(_:T.Texture,dst:T.Texture){copied.push([dst.image.width,dst.image.height]);}} as unknown as T.WebGLRenderer;
 const make=(newLane:boolean)=>new OrthophotoSeams(renderer,base,{tracadie:false,counties:false,inland:newLane?[north.name,east.name]:[north.name]});
 const m=make(true),old=make(false),mixed=shader(),prior=shader(),a=shader(),b=shader();
 m.bind(north.first,a);m.bind(east.first,mixed);m.bind(east.second,b);old.bind(north.second,prior);
 assert.equal(mixed.uniforms.orthoRowsGain,a.uniforms.orthoRowsGain);
 assert.equal(mixed.uniforms.orthoRowsGainLane2,b.uniforms.orthoRowsGain);
 assert(mixed.fragmentShader.includes('vuv.y*22.')&&mixed.fragmentShader.includes('vuv.x*32.'));
 const ready=new Map<string,Owner>();
 const put=(id:string,sha:string)=>{
  const t=source();ready.set(id,{detail:t,detailSince:1,lod:112,status:'ready'});
  m.verifiedDetail(id,sha,t);
  t.onUpdate?.(t);
 };
 const update=(t:number)=>m.update(t,id=>ready.get(id));
 put(north.first,north.nsha);put(north.second,north.ssha);put(east.second,north.nsha);
 update(2);update(2.2);m.advance(3);
 assert.deepEqual(copied,[[640,4],[640,4]]);
 assert.equal(mixed.uniforms.orthoRowsGain.value,1);
 assert.equal(mixed.uniforms.orthoRowsGainLane2.value,0);
 put(east.second,east.ssha);update(3.1);m.advance(4);
 assert.deepEqual(copied,[[640,4],[640,4],[4,640],[4,640]]);
 assert.equal(mixed.uniforms.orthoRowsGainLane2.value,1);
 const removed=ready.get(east.second)!.detail;
 m.evict(east.second,removed);ready.delete(east.second);
 assert.equal(mixed.uniforms.orthoRowsGain.value,1);
 assert.equal(mixed.uniforms.orthoRowsGainLane2.value,0);
 assert.equal(mixed.uniforms.orthoSharedRowsLane2.value,base);
 caps.maxTextures=15;
 const constrained=shader();make(true).bind(north.second,constrained);
 assert.equal(constrained.fragmentShader,prior.fragmentShader);
 assert(!constrained.uniforms.orthoRowsGainLane2);
});
