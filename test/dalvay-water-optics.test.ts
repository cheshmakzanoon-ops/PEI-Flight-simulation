import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BufferGeometry,Mesh,MeshBasicMaterial,ShaderMaterial,Texture} from 'three';
import {dalvayWaterRequested,sourisKnightRequested,standardSourisShoreline} from '../src/app/scenery-profile.ts';
import {DALVAY_WATER_VISUAL as D,decodeDalvayOptics,loadDalvayOptics,DalvayLakeOptics} from '../src/render/dalvay-lake-optics.ts';
const wire=new Uint8Array(readFileSync(new URL('../public/world/'+D.file,import.meta.url)));
const query=(s:string)=>new URLSearchParams(s);
const v='varying vec3 p; varying vec2 vuv; void main(){vec4 w=vec4(position,1.);p=w.xyz;vuv=uv;}';
test('Dalvay water is independent and opt-in only, with an explicit stock comparison',()=>{
 for(const s of ['', 'stockDalvayWaterOptics','dalvayWaterOptics&stockDalvayWaterOptics','dalvayWaterOptics&scenery=detail',
  'dalvayWaterOptics&scenery=standard&scenery=detail','dalvayWaterOptics&surveyRelief'])assert(!dalvayWaterRequested(query(s)),s);
 const a=query('dalvayWaterOptics&diagnostics&sourisKnightExterior&departure=souris-waterfront-pass');
 assert(dalvayWaterRequested(a));assert(sourisKnightRequested(a));assert(standardSourisShoreline(a));
});
test('Authenticates finite mask bytes twice and fails closed to missing or malformed optional data',async()=>{
 const got=await decodeDalvayOptics(wire.buffer);assert(got);assert.equal(got.length,D.width*D.height);
 assert.equal(got.filter(x=>x>0).length,7146);
 assert.equal(got.filter(x=>x===255).length,5433);
 const changed=wire.slice();changed[61]^=1;
 assert.equal(await decodeDalvayOptics(changed.buffer),undefined);
 assert.equal(await loadDalvayOptics('/world/',async()=>new Response(new Uint8Array(D.bytes+1))),undefined);
 assert.equal(await loadDalvayOptics('/world/',async()=>new Response('',{status:404})),undefined);
 assert.deepEqual(await loadDalvayOptics('/world/',async()=>new Response(wire)),got);
});
test('Acquires two complete original shader owners atomically without changing geometry and restores both',()=>{
 const make=(id:string)=>{
  const sky=new Texture(),stock=new ShaderMaterial({vertexShader:v,uniforms:{skyMap:{value:sky},clock:{value:0}},fragmentShader:
   'void main(){vec3 terrainDx=vec3(1.);gl_FragColor=vec4(mist(col,d,p.y),1.);}'});
  const geo=new BufferGeometry(),mesh=new Mesh(geo,stock);return {id,mesh,stock,geo,sky};
 };
 const a=[make('17-12'),make('17-13')],opt=new DalvayLakeOptics(new Uint8Array(D.width*D.height));
 const sw=()=>opt.update(()=>a.every(t=>t.mesh.material===t.stock)?a:undefined);
 const orig=a.map(t=>t.stock.fragmentShader);opt.update(()=>[a[0]]);assert(!opt.active);
 sw();assert(opt.active);
 assert.deepEqual(opt.state.receivers,[...D.tiles]);const pairs=a.map(q=>q.mesh.material);
 for(const t of a){assert.equal(t.mesh.geometry,t.geo);assert.equal(t.mesh.material,t.stock);assert(t.stock.vertexShader.includes('centroid varying vec3 dlvReceiverPos;'));assert.equal(t.mesh.material.uniforms.dlvSkyMap,t.stock.uniforms.skyMap);}
 sw();assert.equal(opt.state.mounts,1);assert.deepEqual(a.map(t=>t.mesh.material),pairs);
 const other=new MeshBasicMaterial();let removed=false;other.addEventListener('dispose',()=>{removed=true;});
 (a[0].mesh as Mesh).material=other;sw();assert(!opt.active);
 assert.equal(a[0].mesh.material,other);assert.equal(a[1].mesh.material,a[1].stock);assert(!removed);
 a[0].mesh.material=a[0].stock;sw();assert(opt.active);opt.dispose();
 assert.equal(a[0].mesh.material,a[0].stock);assert.equal(a[1].mesh.material,a[1].stock);
 assert(a.every(q=>!('dlvWaterMask' in q.stock.uniforms)&&!('dlvBox' in q.stock.uniforms)));
 assert.deepEqual(a.map(t=>t.stock.fragmentShader),orig);assert(a.every(t=>t.stock.vertexShader===v));
 other.dispose();for(const t of a){t.geo.dispose();t.sky.dispose();t.stock.dispose();}
});
test('Keeps the authored atmosphere and shared sky sampler on the supported Standard receiver',()=>{
 const standard='gl_FragColor=vec4(peiairSurface(mist(col,d,p.y),col,p,cameraPosition,d),1.);';
 const sky=new Texture();
 const targets=D.tiles.map(id=>{
  const skyUniform={value:sky};
  const stock=new ShaderMaterial({vertexShader:v,uniforms:{skyMap:skyUniform,clock:{value:0}},fragmentShader:
   'uniform sampler2D skyMap;\nvoid main(){vec3 terrainDx=vec3(1.);'+standard+'}'});
  return {id,stock,mesh:new Mesh(new BufferGeometry(),stock)};
 });
 const opt=new DalvayLakeOptics(new Uint8Array(D.width*D.height));
 opt.update(()=>targets);assert(opt.active);
 for(const r of targets){
  const display=r.mesh.material;
  assert.equal(display.uniforms.skyMap,r.stock.uniforms.skyMap);
  assert.equal(display.uniforms.dlvSkyMap,undefined);
  assert.equal(display.fragmentShader.split(standard).length,2);
  assert(display.fragmentShader.includes('col=dlvPaint(col,dlvReceiverPos,terrainDx,terrainDy,d,sun,clock);'));
  assert(!display.fragmentShader.includes('dlvSkyMap'));
 }
 opt.dispose();
 targets[1].stock.fragmentShader=targets[1].stock.fragmentShader.replace(standard,'unsupportedTerminalOutput();');
 opt.update(()=>targets);assert(!opt.active);
 for(const {stock,mesh} of targets){assert.equal(mesh.material,stock);stock.dispose();mesh.geometry.dispose();}
 sky.dispose();
});
