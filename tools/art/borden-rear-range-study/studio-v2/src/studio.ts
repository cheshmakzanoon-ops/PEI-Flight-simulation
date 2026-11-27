import * as T from 'three';
import {buildBordenRearTower as oldTower} from '../../studio/src/rear-range.ts';
import {buildBordenRearTower as newTower} from './rear-range.ts';

const cs=[
 {id:'opening',level:'close',eye:[14.6,12.2,23.4],target:[0,6.35,0],fov:34},
 {id:'reciprocal',level:'close',eye:[-15.1,11.5,-23.4],target:[0,6.4,0],fov:34},
 {id:'medium',level:'medium',eye:[24.2,20.3,22.3],target:[0,6.35,0],fov:33.6},
] as const;
type Spec=typeof cs[number];
const PALETTE=0x2d3a35;
function roles(g:T.BufferGeometry,s:readonly number[],l:readonly number[],b?:readonly number[]) {
 const count=g.attributes.position.count; const out=new Float32Array(3*count);
 for(const [pair,k] of [[s,0],[l,1],[b,2]] as const){
  if(!pair)continue;
  if(pair.length!==2||pair.some(x=>x%3||x<0||x>count)||pair[0]>=pair[1])throw new Error('Unbound audit role');
  for(let x=pair[0];x<pair[1];x++)out[3*x+k]=1;
 }
 return new T.BufferAttribute(out,3);
}
function marker(base:T.MeshStandardMaterial,tag:string) {
 const m=new T.MeshStandardMaterial().copy(base);
 m.customProgramCacheKey=()=>base.customProgramCacheKey()+':bordenAB:'+tag;
 m.onBeforeCompile=(p,r)=>{
  base.onBeforeCompile(p,r);
  const v='#include <project_vertex>',f='#include <colorspace_fragment>';
  if(p.vertexShader.split(v).length!==2||p.fragmentShader.split(f).length!==2)throw new Error('Borden audit shader stage moved');
  p.vertexShader='attribute vec3 aBRRRole;\nvarying vec3 vBRRRole;\n'+
   p.vertexShader.replace(v,v+'\nvBRRRole=aBRRRole;');
  p.fragmentShader='varying vec3 vBRRRole;\n'+
   p.fragmentShader.replace(f,f+'\ngl_FragColor=vec4(vBRRRole,1.);');
 };
 return m;
}
function experiment(spec:Spec){
 const canvas=document.querySelector<HTMLCanvasElement>('#'+spec.id)!;const w=canvas.width,h=canvas.height;
 const r=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
 r.setPixelRatio(1);r.setSize(w,h,false);r.outputColorSpace=T.SRGBColorSpace;
 r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1;
 const scene=new T.Scene();const bg=new T.Color(PALETTE),black=new T.Color(0);scene.background=bg;
 const sun=new T.DirectionalLight(0xfff3e1,2.15);sun.position.set(8,15,10);scene.add(sun);
 const bounce=new T.DirectionalLight(0xc5d1d2,.62);bounce.position.set(-8,9,-9);scene.add(bounce);
 scene.add(new T.HemisphereLight(0xe2e7df,0xa59988,1.60));
 const c=new T.PerspectiveCamera(spec.fov,w/h,.05,140);
 c.position.set(spec.eye[0],spec.eye[1],spec.eye[2]);c.lookAt(spec.target[0],spec.target[1],spec.target[2]);c.updateMatrixWorld(true);
 const old=oldTower(spec.level),next=newTower(spec.level);
 const m=old.mesh,g0=m.geometry,g1=next.mesh.geometry,p0=m.material,p1=next.mesh.material;
 const roles0=roles(g0,old.roles.shaft,old.roles.lantern),roles1=roles(g1,next.roles.shaft,next.roles.lantern,next.upperSash);
 const ownMark0=marker(p0,'old:'+spec.level),ownMark1=marker(p1,'new:'+spec.level);
 const gl=r.getContext();scene.add(m);
 if(Object.values(p1).some(v=>v instanceof T.Texture)||r.info.memory.textures!==0)throw new Error('Borden studio texture input');
 const rows: Record<string,string>={};
 type Pass={bytes:Uint8Array;calls:number;tris:number;textures:number;error:number};
 function draw(label:string,save:boolean):Pass{
  r.render(scene,c);
  const bytes=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
  if(save)rows[label]=canvas.toDataURL('image/png').split(',')[1];
  return {bytes,calls:r.info.render.calls,tris:r.info.render.triangles,textures:r.info.memory.textures,error:gl.getError()};
 }
 // Ordinary V1 and V2 never have the diagnostic attributes. Probes use a
 // temporary exact flat primitive attribute + same material, shader path and raster state.
 const before=draw('v1',true);
 scene.background=black;g0.setAttribute('aBRRRole',roles0);m.material=ownMark0;
 const depthOld=draw('role-v1',true);
 g0.deleteAttribute('aBRRRole');
 m.geometry=g1;g1.setAttribute('aBRRRole',roles1);m.material=ownMark1;
 const depthNext=draw('role-v2',true);
 g1.deleteAttribute('aBRRRole');
 m.material=p1;scene.background=bg;
 const after=draw('v2',true);
 m.geometry=g0;m.material=p0;
 const rollback=draw('restored-v1',false);
 // Leave only the V2 visual in the private triptych UI, after the exact restore witnesses.
 m.geometry=g1;m.material=p1;const finish=draw('v2-repeat',false);
 ownMark0.dispose();ownMark1.dispose();
 let eligible=0,sash=0,lanternCount=0,shaftCount=0,changed=0,strong=0,lanternChanged=0,lanternStrong=0,
  sashStrong=0,alpha=0,nonOpaque=0,outside=0,restBytes=0,repeatBytes=0,protectedSeen=0,protectedChanges=0,
  silhouette=0,peak=0,signedShaftSum=0,signedShaftN=0,categorized=0;
 const bgRgb=Array.from(before.bytes.subarray(0,3));
 const isBG=(p:Pass,i:number)=>p.bytes[i]===bgRgb[0]&&p.bytes[i+1]===bgRgb[1]&&p.bytes[i+2]===bgRgb[2];
 const example: Array<readonly number[]>=[];
 for(let i=0;i<before.bytes.length;i+=4){
  const o=depthOld.bytes,n=depthNext.bytes;
  const scope=!!(o[i]||o[i+1]||n[i]||n[i+1]);
  if(scope)eligible++;
  if(n[i+1])lanternCount++;
  if(n[i])shaftCount++;
  if(n[i+2])sash++;
  if(isBG(before,i)!==isBG(after,i))silhouette++;
  if(!scope&&!isBG(before,i))protectedSeen++;
  const a=after.bytes,b=before.bytes,delta=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
  if(a[i+3]!==b[i+3])alpha++;
  if(a[i+3]!==255||b[i+3]!==255)nonOpaque++;
  if(delta){
   changed++;peak=Math.max(peak,delta);
   if(n[i+1])lanternChanged++;
   if(!scope){ outside++;if(!isBG(before,i))protectedChanges++;
    if(example.length<12)example.push([(i>>2)%w,h-1-Math.floor((i>>2)/w),delta]);
   }
   if(delta>2){strong++;if(n[i+1])lanternStrong++;if(n[i+2])sashStrong++;}
   if(n[i]||n[i+1])categorized++;
  }
  if(n[i]&&!n[i+2]&&o[i]&&i%4===0&&delta<35){
   signedShaftN++;signedShaftSum+=(a[i]-b[i]+a[i+1]-b[i+1]+a[i+2]-b[i+2])/3;
  }
  for(let k=0;k<4;k++){
   if(before.bytes[i+k]!==rollback.bytes[i+k])restBytes++;
   if(after.bytes[i+k]!==finish.bytes[i+k])repeatBytes++;
  }
 }
 const stats={eligible,sash,lanternCount,shaftCount,changed,strong,lanternChanged,lanternStrong,sashStrong,alpha,nonOpaque,outside,restBytes,repeatBytes,
  protectedSeen,protectedChanges,silhouette,peak,meanStockShaftCode:signedShaftSum/Math.max(1,signedShaftN),categorized,example};
 const strip=({bytes:_,...stamp}:Pass)=>stamp;
 const draws={before:strip(before),depthOld:strip(depthOld),depthNext:strip(depthNext),after:strip(after),rollback:strip(rollback),finish:strip(finish)};
 const checks={
  exact:!alpha&&!nonOpaque&&!outside&&!restBytes&&!repeatBytes&&protectedSeen>0&&!protectedChanges,
  draw:Object.values(draws).every(p=>!p.error&&p.calls===1&&p.textures===1),
  strong:spec.level==='medium'||(strong>=1800&&lanternChanged>=350),
  sash:spec.id!=='opening'||sash>=35,
  samples:gl.getParameter(gl.SAMPLES)===4&&gl.getContextAttributes()?.alpha===true,
 };
 return {id:spec.id,view:[spec.eye,spec.target],level:spec.level,shape:[w,h],draws,stats,checks,rows};
}
(async()=>{
 const results=cs.map(experiment),proof=results.map(({rows:_,...r})=>r);
 (window as unknown as Record<string,unknown>).__bordenStudio={type:'Detached V2 vs immutable V1. Not a placement or flight.',proof,
  read:()=>results.map(({id,rows})=>({id,rows})),ready:proof.every(p=>Object.values(p.checks).every(v=>v))};
 document.documentElement.dataset.studio='ready';
})();
