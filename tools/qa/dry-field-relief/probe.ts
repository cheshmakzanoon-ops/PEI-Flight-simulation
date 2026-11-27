/** Detached, loopback-only native render QA. This module is not imported by
 * the player. No runtime mount, sources, asset I/O, shader patch or physics. */
import * as T from 'three';
import {BoundedGrade} from '../../../src/sim/bounded-grade.ts';
import {verifyDecodedCover} from '../../../src/sim/cover-proof.ts';
import {standardLandAtlasMatches} from '../../../src/render/meadow-standard.ts';
import type {World} from '../../../src/render/world.ts';
export const INSET2_PIN=Object.freeze({
 id:'17-15',gradeId:'detached-17-15-inset2-visual',northSeams:'112:56,56,112,56',
 northP:'a95d62da0a3a445d3560dc97afa499f87564ed9e88940b609ce9db1e77490fba',
 source:'70ebceb7390a284eb770c7bb225c433fbf34d8a568d704e31a76d5d531e53067',
 terrain:'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
 cover:'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
 profiles:Object.freeze({
  '112:112,56,56,56':Object.freeze({oldP:'c4070f38a756b7680f33e4a30ba322bfdf5089040950f5610330726c0e695594',nextP:'0782847d045e4d79fe9b0cae0fbe13b5c7b118a126fe1d879c837c4475abbdc7'}),
  '112:112,112,56,56':Object.freeze({oldP:'a2440c0ab3d599994a6d28d020441b54609a5e655615d46e7d418a4cefc9fc88',nextP:'405774d74a75cbec6685568b5bc05666e18e10d2d2e16e562ab8fac843587a71'}),
 }),
 oldN:'25c0b802f5de393db35a237c1df4fa7cb66db176d9d923248c40c231bd906f11',
 oldUV:'f9666b0e5a9f835d04dfa7469c0a839feb8e94a6269c2d49053198278c309cb7',
 oldI:'33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa',
 nextUV:'4884fd633572b7ab9eada230da1f56760a85b82db39f6dca6e0595f580c221f6',
 nextI:'aedd20898ea9459cd005e70b8ef288b0bec25202cd73975e05767617f8966b99',
 verts:12769,proposedVerts:13330,stockTris:25088,proposedTris:26198,
 rect:[10717.206019529789,21326.32610070525,10826.01014155574,21378.65842909608] as const,
});
type Fine=T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
type GroundOwner={id:string;lod:number;seams:string;fine?:Fine;coarse:T.Mesh;local:T.ShaderMaterial;relief?:unknown;x0:number;z0:number;w:number;d:number};
type WorldQA={
 byId:Map<string,GroundOwner>;grades:Map<string,BoundedGrade>;
 patch:(x:number,z:number,w:number,d:number,n:number,grade:BoundedGrade)=>Fine;
 copyNearEdge:(old:Fine,dup:Fine)=>void;
};
const pin=INSET2_PIN;
const digest=async(a:ArrayBuffer|ArrayBufferView)=>{
 const b=a instanceof ArrayBuffer?a:new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b as BufferSource)),v=>v.toString(16).padStart(2,'0')).join('');
};
const noShapeOverride=(g:T.BufferGeometry)=>g.groups.length===0&&g.drawRange.start===0&&g.drawRange.count===Infinity;
function buffer(g:T.BufferGeometry,k:string,components:number,n:number,type:typeof Float32Array|typeof Uint16Array|typeof Int16Array|typeof Uint8Array=Float32Array,normalized=false){
 const a=k==='index'?g.index:g.getAttribute(k);
 if(!(a instanceof T.BufferAttribute)||a.itemSize!==components||a.normalized!==normalized||a.count!==n||
  !(a.array instanceof type)||a.array.length!==n*components||!(a.array.buffer instanceof ArrayBuffer))throw Error('unexpected '+k+' ABI');
 return a;
}
const stamp=(a:T.BufferAttribute)=>{
 const {array,version,itemSize,normalized,count}=a;return ()=>a.array===array&&a.version===version&&
  a.itemSize===itemSize&&a.normalized===normalized&&a.count===count;
};
const exactPrefix=(a:ArrayLike<number>,b:ArrayLike<number>)=>{
 for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))throw Error('unchanged stock prefix mismatch');
};
const packStamp=(g:T.BufferGeometry)=>{
 const old=Object.entries(g.attributes).map(([n,a])=>[n,a,stamp(a as T.BufferAttribute)] as const);
 const idx=g.index,checkI=idx?stamp(idx):()=>false;
 return ()=>g.index===idx&&checkI()&&Object.keys(g.attributes).length===old.length&&old.every(([n,a,k])=>g.getAttribute(n)===a&&k())&&noShapeOverride(g);
};
export type DryInsetProbe={
 withDraw<TOut>(show:boolean|'tessellation',render:()=>TOut):{shown:boolean;result:TOut};
 dispose():void;
 readonly witness:Readonly<{seam:string,source:string,position:string,uv:string,index:string,normal32:string,tessellationP:string,stockTriangles:number,triangles:number,unchangedRegularTriangles:number,changedPerimeterTriangles:number}>;
};
export async function prepareDryInset2Probe(world:World,terrainSHA:string|undefined,camera:T.PerspectiveCamera,wire:ArrayBuffer):Promise<DryInsetProbe|undefined>{
 let owned:T.BufferGeometry|undefined,controlOwned:T.BufferGeometry|undefined;
 try{
  // Only expected stock RGBA/4x/log-depth, no shared scene mutations.
  const r=world.renderer,gl=r.getContext(),scene=world.scene,cover=world.cover,terrain=world.terrain,w=world as unknown as WorldQA;
  const base=()=>T.REVISION==='187'&&r.getContext()===gl&&!gl.isContextLost()&&gl.getParameter(gl.SAMPLES)===4&&
   gl.getContextAttributes()?.alpha===true&&gl.getContextAttributes()?.depth===true&&gl.getContextAttributes()?.antialias===true&&
   !scene.overrideMaterial&&!r.xr.isPresenting&&!r.getRenderTarget()&&r.capabilities.logarithmicDepthBuffer&&!r.capabilities.reversedDepthBuffer&&
   !r.shadowMap.enabled&&!r.localClippingEnabled&&!r.clippingPlanes.length&&camera.layers.mask===1&&
   r.outputColorSpace===T.SRGBColorSpace&&r.toneMapping===T.ACESFilmicToneMapping&&r.toneMappingExposure===1;
  if(!base()||terrainSHA!==pin.terrain||!standardLandAtlasMatches(terrain,terrainSHA,cover)||
     terrain.surveyGrids.some(p=>p.spec.tileX===17&&p.spec.tileZ===15)||wire.byteLength!==1683)return;
  const source=wire.slice(0);
  if(await digest(source)!==pin.source||await verifyDecodedCover(cover)!==pin.cover)return;
  const t=w.byId.get(pin.id),stock=t?.fine,north=w.byId.get('17-14'),nFine=north?.fine;
  if(!t||!stock||!north||!nFine)return;
  const seam=t.seams,profile=pin.profiles[seam as keyof typeof pin.profiles];
  if(!profile)return;
  const nGeometry=nFine.geometry,nMat=north.local,nStamp=packStamp(nGeometry);
  const g=stock.geometry,m=t.local,F=t.fine,origin=stock.position.clone(),zero=new T.Quaternion(),one=new T.Vector3(1,1,1);
  const normMaterial=(s:T.ShaderMaterial)=>s instanceof T.ShaderMaterial&&s.visible&&!s.defines.SURVEY_LIGHT&&
   s.side===T.FrontSide&&s.depthWrite&&s.depthTest&&s.colorWrite&&!s.transparent&&!s.polygonOffset&&!s.alphaToCoverage&&!s.stencilWrite;
  if(!normMaterial(m)||!normMaterial(nMat)||!noShapeOverride(g))return;
  const geom0=packStamp(g),matVersion=m.version,defines=m.defines,v=m.vertexShader,f=m.fragmentShader,uniforms=m.uniforms;
  const bindings=(p:T.ShaderMaterial)=>Object.entries(p.uniforms).filter(([k])=>k.startsWith('orthoRowsGain')||k.startsWith('orthoSharedRows'));
  const signedGain=bindings(m),northGain=bindings(nMat);
  const samePair=(name:string)=>signedGain.filter(([k,u])=>k.startsWith(name)&&northGain.some(([j,v])=>j.startsWith(name)&&u===v));
  const gg=samePair('orthoRowsGain'),ss=samePair('orthoSharedRows'),map=ss[0]?.[1].value;
  if(gg.length!==1||ss.length!==1||!(map instanceof T.DataTexture)||map.image.width!==640||map.image.height!==4||
   map.format!==T.RGBAFormat||map.type!==T.UnsignedByteType||map.colorSpace!==T.NoColorSpace||
   map.magFilter!==T.LinearFilter||map.minFilter!==T.LinearFilter)return;
  const pairActive=()=>{
   if(gg[0][1].value!==1||ss[0][1].value!==map)return false;
   const eye=world.orthoSeams?.diagnostics().filter(v=>v.edge==='17-14 / 17-15');
   return !!eye&&eye.length===1&&eye[0].resident&&eye[0].gain===1&&eye[0].bytes===10240&&!eye[0].errors;
  };
  const nc=[nMat.version,nMat.vertexShader,nMat.fragmentShader,nMat.uniforms,nMat.defines] as const;
  if(!pairActive())return;
  const live=()=>base()&&world.cover===cover&&world.terrain===terrain&&w.byId.get(pin.id)===t&&t.fine===F&&
   scene===stock.parent&&t.lod===112&&t.seams===seam&&stock.userData.subdiv===112&&stock.visible&&!t.coarse.visible&&!t.relief&&!w.grades.has(pin.id)&&
   w.byId.get('17-14')===north&&north.fine===nFine&&north.lod===112&&north.seams===pin.northSeams&&!north.coarse.visible&&!north.relief&&
   !w.grades.has('17-14')&&nFine.visible&&nFine.parent===scene&&nFine.geometry===nGeometry&&nStamp()&&nFine.material===nMat&&
   northGain.every(([k,u])=>nMat.uniforms[k]===u)&&nMat.version===nc[0]&&nMat.vertexShader===nc[1]&&nMat.fragmentShader===nc[2]&&nMat.uniforms===nc[3]&&nMat.defines===nc[4]&&normMaterial(nMat)&&!nFine.userData.localGrade&&!nFine.userData.coastalSurvey&&!nFine.userData.coastalRefinement&&
   !stock.userData.localGrade&&!stock.userData.coastalSurvey&&!stock.userData.coastalRefinement&&
   stock.geometry===g&&geom0()&&stock.material===m&&t.local===m&&normMaterial(m)&&pairActive()&&m.version===matVersion&&m.defines===defines&&
   !m.defines.SURVEY_LIGHT&&m.vertexShader===v&&m.fragmentShader===f&&m.uniforms===uniforms&&signedGain.every(([k,u])=>uniforms[k]===u)&&
   stock.layers.mask===1&&stock.matrixAutoUpdate&&stock.position.equals(origin)&&
   stock.position.x===t.x0+t.w/2&&stock.position.y===0&&stock.position.z===t.z0+t.d/2&&stock.quaternion.equals(zero)&&stock.scale.equals(one);
  if(!live())return;
  const op=buffer(g,'position',3,pin.verts),ou=buffer(g,'uv',2,pin.verts),on=buffer(g,'normal',3,pin.verts),
   oi=buffer(g,'index',1,pin.stockTris*3,Uint16Array),nP=buffer(nGeometry,'position',3,pin.verts),
   nI=buffer(nGeometry,'index',1,pin.stockTris*3,Uint16Array);
  const actual0=await Promise.all([op,on,ou,oi,nP,nI].map(a=>digest(a.array)));
  if(!live()||actual0[0]!==profile.oldP||actual0[1]!==pin.oldN||actual0[2]!==pin.oldUV||actual0[3]!==pin.oldI||
   actual0[4]!==pin.northP||actual0[5]!==pin.oldI)return;
  const offsets=new Int16Array(561),data=new DataView(source);
  for(let k=0;k<offsets.length;k++){
   offsets[k]=data.getInt16(2*k,true);if(offsets[k]>0)return;
  }
  const spec={
   id:pin.gradeId,tileX:17,tileZ:15,firstX:85,firstZ:2,cellsX:2,cellsZ:1,sub:16,
   kind:'inland',relativeToParent:true,maxRelativeDeltaCm:149,sha256:pin.source,
  } as const;
  const grade=(o:Int16Array,w:Uint8Array)=>new BoundedGrade(terrain,spec,o,w,(x,z)=>terrain.atlasElevation(x,z));
  const shape=grade(offsets,new Uint8Array(source,1122,561));
  const bracket=w.patch(t.x0,t.z0,t.w,t.d,112,shape),a=owned=bracket.geometry;
  if(bracket.parent||bracket.userData.localGrade!==pin.gradeId||bracket.userData.subdiv!==112||
     !bracket.position.equals(origin)||!noShapeOverride(a))return;
  w.copyNearEdge(stock,bracket);
  const np=buffer(a,'position',3,pin.proposedVerts),nu=buffer(a,'uv',2,pin.proposedVerts),
   nn=buffer(a,'normal',3,pin.proposedVerts,Int16Array,true),ni=buffer(a,'index',1,pin.proposedTris*3,Uint16Array);
  buffer(a,'surveyWeight',1,pin.proposedVerts,Uint8Array,true);
  exactPrefix(op.array,np.array);
  exactPrefix(ou.array,nu.array);
  // Preserve every existing Float32 normal raw value. Appended normalized
  // values are decoded, not interpreted as raw +/-32767; this original
  // land material uses derivatives (SURVEY_LIGHT is deliberately absent).
  const n32=new Float32Array(pin.proposedVerts*3);
  n32.set(on.array);
  for(let k=pin.verts;k<pin.proposedVerts;k++){
   n32[3*k]=nn.getX(k);n32[3*k+1]=nn.getY(k);n32[3*k+2]=nn.getZ(k);
  }
  a.setAttribute('normal',new T.BufferAttribute(n32,3));a.computeBoundingSphere();
  exactPrefix(on.array,n32);
  const actual1=await Promise.all([np.array,nu.array,ni.array,n32].map(digest));
  if(!live()||actual1[0]!==profile.nextP||actual1[1]!==pin.nextUV||actual1[2]!==pin.nextI)return;
  // Non-site numerical control: same actual tessellation/zipper and stock
  // plane heights. Any residual image difference here is not measured relief.
  const neutral=w.patch(t.x0,t.z0,t.w,t.d,112,grade(new Int16Array(561),new Uint8Array(561))),flat=controlOwned=neutral.geometry;
  if(neutral.parent||neutral.userData.localGrade!==pin.gradeId||!neutral.position.equals(origin)||!noShapeOverride(flat))return;
  w.copyNearEdge(stock,neutral);
  const fp=buffer(flat,'position',3,pin.proposedVerts),fu=buffer(flat,'uv',2,pin.proposedVerts),
   fi=buffer(flat,'index',1,pin.proposedTris*3,Uint16Array);
  exactPrefix(ni.array,fi.array);exactPrefix(nu.array,fu.array);exactPrefix(op.array,fp.array);
  flat.setAttribute('normal',new T.BufferAttribute(n32.slice(),3));flat.computeBoundingSphere();
  const tessellationP=await digest(fp.array);
  if(!live())return;
  const geom1=packStamp(a),geomFlat=packStamp(flat),W=[pin.rect[0],pin.rect[1],pin.rect[2],pin.rect[3]];
  let busy=false,retired=false;
  const witness=Object.freeze({
   seam,source:pin.source,position:actual1[0],uv:actual1[1],index:actual1[2],normal32:actual1[3],tessellationP,
   stockTriangles:pin.stockTris,triangles:pin.proposedTris,unchangedRegularTriangles:25078,changedPerimeterTriangles:96,
  });
  const candidate=()=>{
   if(retired||busy||!live()||!geom1())return false;
   const p=camera.position;
   const eye=Math.hypot(Math.max(0,W[0]-p.x,p.x-W[2]),Math.max(0,W[1]-p.z,p.z-W[3]));
   return Number.isFinite(p.y)&&p.y>=45&&p.y<=130&&eye<260;
  };
  const shot=<O>(show:boolean|'tessellation',render:()=>O)=>{
   if(busy)throw Error('diagnostic may not nest a changed render draw');
   if(!show||!candidate())return {shown:false,result:render()};
   if(show==='tessellation'&&!geomFlat())return {shown:false,result:render()};
   const draw=show==='tessellation'?flat:a;
   busy=true;stock.geometry=draw;
   try{return {shown:true,result:render()};}
   finally{if(stock.geometry===draw)stock.geometry=g;busy=false;}
  };
  const use={withDraw:shot,witness,dispose(){
   if(retired)return;
   if(busy)throw Error('retirement requires the stock render state');
   retired=true;a.dispose();flat.dispose();
  }};
  owned=undefined;controlOwned=undefined;return use;
 }catch{return;}
 finally{owned?.dispose();controlOwned?.dispose();}
}
