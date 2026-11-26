import {BufferGeometry,Float32BufferAttribute,Mesh,type Material} from 'three';
import {buildFoundersRailShop,makeFoundersMaterial} from './founders-rail-shop-study.ts';
import {WEST_CLIP_FIXTURE as F} from './founders-west-clip-fixture.generated.ts';

type Case='mainRoof'|'railBrick';
const ownable=['mainRoof','railBrick'] as const,key=['position','normal','uv'] as const;
const sha=async(q:Uint8Array<ArrayBuffer>)=>{
 const c=globalThis.crypto?.subtle;
 if(!c)throw Error('Local SHA-256 unavailable');
 const a=new Uint8Array(await c.digest('SHA-256',q));
 return [...a].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const wire=(a:Float32Array)=>new Uint8Array(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
function decode(s:string,n:number){
 const raw=Uint8Array.from(atob(s),x=>x.charCodeAt(0));
 if(raw.length!==4*n)throw Error('Invalid detached west clip fixture span');
 const v=new DataView(raw.buffer);
 return Float32Array.from({length:n},(_,i)=>v.getFloat32(4*i,true));
}
function integrate(material:Material,active:{value:number},role:Case){
 const hook=material.onBeforeCompile.bind(material),cache=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>cache+'|founders-v7-exact-retained-vertices:'+role;
 material.onBeforeCompile=(b,r)=>{
  hook(b,r);b.uniforms.westProofActive=active;
  const v='#include <begin_vertex>',f='#include <opaque_fragment>';
  if(!b.vertexShader.includes(v)||!b.fragmentShader.includes(f))throw Error('Unexpected original Three program layout; fail this detached proof');
  b.vertexShader='attribute float westStripMode; varying float wExchangeMode, wExchangeD;\n'+b.vertexShader.replace(v,v+'\n wExchangeMode=westStripMode; wExchangeD=position.x-position.z*(.3332852869069711/19.393325445415954);');
  // Original shading is computed before the local coverage decision in both modes.
  b.fragmentShader='uniform float westProofActive; varying float wExchangeMode, wExchangeD;\n'+b.fragmentShader.replace(f,`
  float clipRight = step(2.480001,wExchangeD);
  bool activate = westProofActive > .5;
  if(wExchangeMode > 3.5 && !activate) discard; // entirely original front candidate
  else if(wExchangeMode > 2.5 && wExchangeMode < 3.5 && activate) discard; // old front selected replacement
  else if(wExchangeMode > 1.5 && wExchangeMode < 2.5 && (!activate || clipRight > .5)) discard; // new near strip only
  else if(wExchangeMode > .5 && wExchangeMode < 1.5 && activate && clipRight < .5) discard; // old inside strip only
  `+f);
 };
}

/** Developer-only detached comparison. No world, physics, placement, scene updates or fetches.
 * Keep stock on if verified is false, or before the optional artist shaders link in the caller.
 * The source byte pins themselves are checked by west-clip.test.mjs before the TypeScript build. */
export async function buildFoundersWestClipStudy(){
 const stock=buildFoundersRailShop(),active={value:0},prepared:{mesh:Mesh<BufferGeometry,Material>;geometry:BufferGeometry;material:Material}[]=[];
 try{
  if(stock.triangles!==F.oldTriangles||stock.batches!==F.draws)throw Error('Unexpected artist asset scope');
  const visible=new Map(stock.group.children.map(o=>[o.name,o as Mesh<BufferGeometry,Material>]));
  if(visible.size!==F.draws||Object.keys(F.original).length!==F.draws)throw Error('Unexpected original draw inventory');
  await Promise.all(Object.entries(F.original).map(async([r,p])=>{
   const o=visible.get(r),g=o?.geometry;
   if(!g||g.index!==null||g.groups.length!==0||g.drawRange.start!==0||g.drawRange.count!==Infinity)throw Error('Wrong original draw body');
   const names=g.userData.face as string[]|undefined;
   if(!names||names.length!==p.triangles||await sha(new TextEncoder().encode(JSON.stringify(names)))!==p.labels)
    throw Error('Original face registry mismatch');
   for(const k of key){
    const a=g.attributes[k];
    if(!a||!(a.array instanceof Float32Array)||a.count!==3*p.triangles||
       await sha(wire(a.array))!==p.channels[k])throw Error('Unrecognized old attribute payload');
   }
  }));
  for(const r of ownable){
   const mesh=visible.get(r)!;
   const f=F.localAppend[r],old=mesh.geometry,geometry=new BufferGeometry(),m=new Float32Array((f.base+f.append)*3),seen=new Set<number>();
   for(const [tag,vals]of Object.entries(f.switchIndices)){
    const mode=Number(tag);
    if(mode<1||mode>4)throw Error('Invalid local exchange role');
    for(const i of vals){
     if(seen.has(i)||!Number.isInteger(i)||i<0||i>=f.base+f.append||(mode===1||mode===3)!==(i<f.base))throw Error('Invalid local exchange index');
     seen.add(i);m.fill(mode,i*3,i*3+3);
    }
   }
   if(m.slice(3*f.base).some(x=>x!==2&&x!==4))throw Error('Unregistered original append');
   for(const k of key){
    const orig=old.attributes[k],width=k==='uv'?2:3;
    if(orig.itemSize!==width||orig.count!==f.base*3)throw Error('Wrong original attribute layout');
    const a=new Float32Array((f.base+f.append)*width*3);
    a.set(orig.array);a.set(decode(f.positionsNormalsUV[k],f.append*3*width),orig.array.length);
    if(await sha(wire(a))!==f.compositeChecksums[k])throw Error('Wrong sealed detached candidate buffer');
    geometry.setAttribute(k,new Float32BufferAttribute(a,width));
   }
   geometry.setAttribute('westStripMode',new Float32BufferAttribute(m,1));
   geometry.userData.face=[...old.userData.face,...f.compositeLabels];geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const mat=makeFoundersMaterial(r,true);integrate(mat,active,r);
   prepared.push({mesh,geometry,material:mat});
  }
 }catch{
  for(const p of prepared){p.geometry.dispose();p.material.dispose();}
  return {group:stock.group,triangles:stock.triangles,batches:stock.batches,verified:false,setEnabled:(_on:boolean)=>false};
 }
 for(const d of prepared){
  d.mesh.geometry.dispose();d.mesh.material.dispose();d.mesh.geometry=d.geometry;d.mesh.material=d.material;
 }
 return {group:stock.group,triangles:F.submittedTriangles,batches:F.draws,verified:true,
  setEnabled(on:boolean){active.value=on===true?1:0;return active.value===1;}
 };
}
