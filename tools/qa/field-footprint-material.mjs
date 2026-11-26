/** Export the actual Three.js terrain programs, signed field residents and
 * neutral chase poses for the isolated province-furrow EGL comparison. */
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {PerspectiveCamera,Vector3} from 'three';
import {registerHooks} from 'node:module';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {WORLD_COLS,WORLD_ROWS} from '../../src/sim/coastal-terrain.ts';
const repo=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const loader=registerHooks({load(u,c,next){const q=next(u,c);return u.startsWith('file://'+repo+'/src/')&&q.source?{...q,
 source:(q.source.toString().includes('import.meta.env')?"import.meta.env={BASE_URL:'/',DEV:false,PROD:true,MODE:'production'};\n":'')+q.source+
 (u.endsWith('/src/render/world.ts')?'\nexport {landFrag,vertex};':'')}:q;}});
const {World,landFrag,vertex}=await import(repo+'/src/render/world.ts');loader.deregister();
import {Cover} from '../../src/sim/cover.ts';
import {Terrain} from '../../src/sim/terrain.ts';
import {FIXED_STEP,neutral,spawn,step} from '../../src/sim/flight.ts';
import {SITES,KINGS_MAPPED_FARMLAND_DEPARTURE,runwayAt} from '../../src/sim/places.ts';
import {FIELD_PILOT} from '../../src/render/fields-pilot.generated.ts';
import {FIELD_DIRECTORY_PIN} from '../../src/render/province-fields.generated.ts';
import {FieldShardSource,fieldCandidates} from '../../src/sim/field-shards.ts';
const own=repo+'/public/world/',r=n=>read(own+n),j=n=>JSON.parse(r(n)),sha=n=>createHash('sha256').update(n).digest('hex');
const files=new Map(),receipts=new Map();
const local=async (url,opt={})=>{
 assert(url.startsWith('world:fields-province/v2/'));
 const path=url.slice(6),h=new Headers(opt.headers??{}),range=h.get('range');
 if(!files.has(path))files.set(path,r(path));
 const file=files.get(path);
 if(!range)return new Response(new Uint8Array(file),{status:200,headers:{'Content-Length':String(file.length)}});
 const [,a,b]=range.match(/^bytes=(\d+)-(\d+)$/)??[];
 assert(a!==undefined&&Number(b)>=Number(a)&&Number(b)<file.length);
 const s=file.subarray(Number(a),Number(b)+1);
 receipts.set(path+'/'+range,s.length);
 return new Response(new Uint8Array(s),{status:206,headers:{'Content-Range':`bytes ${a}-${b}/${file.length}`,'Content-Length':s.length}});
};
const src=await FieldShardSource.open('world:fields-province/v2/',FIELD_DIRECTORY_PIN,local);assert(src);
const bufs=new Map();
async function available(x,z){
 const hits=fieldCandidates(x,z,src.dir),now=new Map();
 for(const item of hits){
  if(!bufs.has(item.key)){const b=await src.load(item);assert(b);bufs.set(item.key,b);}
  now.set(item.key,bufs.get(item.key));
 }
 return now;
}
const t=j('terrain.json'),c=j('cover.json'),g=gunzipSync(r(t.file)),packedCover=r(c.file);
assert.equal(sha(g),t.sha256);
assert.equal(sha(packedCover),c.compressedSha256);
const atlas='color.webp',scan='furrow-relief.webp',atlasSha=sha(r(atlas)),scanSha=sha(r(scan));
assert.equal(atlasSha,j('color.sources.json').sha256);
assert.equal(scanSha,FIELD_PILOT.scanSha);
const m=gunzipSync(packedCover);
const terrain=new Terrain(t,new Int16Array(g.buffer,g.byteOffset,g.length/2)),cover=new Cover(c.width,c.height,m);
const sample=(x,z)=>{const land=cover.distance(terrain,x,z)>=0;return {height:terrain.contactHeight(x,z,land),land,runway:!!runwayAt(x,z)};};
const all=['prince-fields','queens-fields','kings-fields','kings-mapped-farmland-pass'];
const id=process.argv[2];assert(all.includes(id),'name one qualified departure');
const site=[...SITES,KINGS_MAPPED_FARMLAND_DEPARTURE].find(x=>x.id===id);assert(site);
const q=spawn(site,sample),cam=new PerspectiveCamera(53,1.5,.08,350000),eye=new Vector3(),aim=new Vector3(),look=new Vector3();
const frames=[2,4,6,8,11,14],captures=[];
const ww=(terrain.right-terrain.left)/WORLD_COLS,dd=(terrain.bottom-terrain.top)/WORLD_ROWS;
const state={scene:new T.Scene(),terrain,cover,pondMeshes:[],mat:new T.ShaderMaterial(),grades:new Map(),byId:new Map(),reliefActive:new Set()};
const world=Object.assign(Object.create(World.prototype),state);
const pack=(a)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const meshes={};
function take(x,z){
 const [u,v]=terrain.uv(x,z),i=Math.floor(u*WORLD_COLS),j=Math.floor(v*WORLD_ROWS),id=i+'-'+j;
 if(!meshes[id]){
  const x0=terrain.left+i*ww,z0=terrain.top+j*dd,mesh=world.patch(x0,z0,ww,dd,112);
  mesh.updateMatrixWorld();
  const g=mesh.geometry,indices=g.index.array;
  meshes[id]={terrainId:id,model:mesh.matrixWorld.toArray(),positions:pack(g.getAttribute('position').array),
   uv:pack(g.getAttribute('uv').array),index:pack(indices),indexWidth:indices.BYTES_PER_ELEMENT,
   indexCount:indices.length,detailBox:[i/WORLD_COLS,j/WORLD_ROWS,WORLD_COLS,WORLD_ROWS]};
 }
 return id;
}
for(let i=0;i<=90*frames.at(-1);i++){
 const dx=Math.sin(q.heading),dz=-Math.cos(q.heading);
 eye.set(q.x-16.8*dx,q.y+4.2,q.z-16.8*dz);
 eye.y=Math.max(eye.y,sample(eye.x,eye.z).height+.58);
 cam.position.lerp(eye,i?1-Math.exp(-FIXED_STEP*7):1);
 aim.lerp(look.set(q.x+7.8*dx,q.y+1.18+Math.sin(q.pitch)*4.5,q.z+7.8*dz),i?1-Math.exp(-FIXED_STEP*10):1);
 cam.lookAt(aim);cam.updateMatrixWorld();
 if(i%90===0&&frames.includes(i/90)){
  const [x,y,z]=cam.position.toArray(),fields=await available(x,z);
  const meshes=[...new Set([[-500,-500],[500,500],[-500,500],[500,-500],[0,0]].map(([dx,dz])=>take(x+dx,z+dz)))];
  const slots=[...fields.keys()].map(k=>{const [x,z]=k.split(':').map(Number);
   const bits=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]].reduce((a,[dx,dz],j)=>a|(src.dir.cells.has((x+dx)+':'+(z+dz))?1<<j:0),0);
   return {k,x:x*1024,z:z*1024,blends:bits};});
  captures.push({time:i/90,eye:cam.position.toArray(),view:cam.matrixWorldInverse.toArray(),projection:cam.projectionMatrix.toArray(),log:2/Math.log2(cam.far+1),slots,meshes});
 }
 step(q,neutral,sample);
}
// The final true requests only the Expanded farmland fragment variant.
const flags=Array(16).fill(false);flags[15]=true;
const shaders={};
const actual=landFrag(...flags);
const lane='paintProvinceFields(col,n,p,d,coast);';
assert(actual.indexOf(lane)===actual.lastIndexOf(lane)&&actual.includes(lane));
const mask=actual.replace(lane,'float f=paintProvinceFields(col,n,p,d,coast); gl_FragColor=f>0.?vec4(1.,0.,1.,1.):vec4(0.,0.,0.,1.); return;');
for(const [name,fragmentShader] of [['terrain',actual],['stock',landFrag(false)],['mask',mask]]){
 const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,createShader:type=>({type}),
 shaderSource:(s,src)=>{shaders[name+(s.type===35633?'.vert':'.frag')]=src;},
 compileShader:()=>{},createProgram:()=>({}),attachShader:()=>{},bindAttribLocation:()=>{},linkProgram:()=>{}};
 new WebGLProgram({getContext:()=>gl},name,{
 shaderType:'ShaderMaterial',shaderName:'',precision:'highp',vertexShader:vertex,fragmentShader,defines:{},vertexColors:false,
 outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,doubleSided:false,
 logarithmicDepthBuffer:true,opaque:true,hasPositionAttribute:true,numSunLights:0,numSunLightShadows:0,numLightProbeGrids:0,
 numPointLights:0,numSpotLights:0,numDirLights:0,numRectAreaLights:0,numHemiLights:0,numLightProbes:0,numClippingPlanes:0,numClipIntersection:0,
 numSpotLightMaps:0,numSpotLightShadows:0,numSpotLightShadowsWithMaps:0,numDirLightShadows:0,numPointLightShadows:0},{});
}
console.log(JSON.stringify({id,shaders,meshes,captures,fields:Object.fromEntries([...bufs.entries()].map(([k,v])=>[k,pack(v)])),
 world:{bounds:[terrain.left,terrain.top,terrain.right,terrain.bottom],color:atlas,colorSha:atlasSha,cover:c.file,scan,scanSha,width:c.width,height:c.height,shadow:[-.60,.74,-.31]}}));
