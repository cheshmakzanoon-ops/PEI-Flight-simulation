import * as T from 'three';
import {DUNE_GRASS_AUTHORITY as A} from './dune-grass-authority.generated.ts';
import {openDuneGrassAuthority, type GrassAuthorityStamp} from './dune-grass-authority.ts';
import {DUNE_GRASS_MATERIAL as P} from './dune-grass-material.generated.ts';
import type {Terrain} from '../sim/terrain.ts';
import {WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import {CANOPY_FENCE} from './canopy-fence.generated.ts';

const key=(x:number,z:number)=>x+'-'+z;
const none=new T.DataTexture(new Uint8Array([0]),1,1,T.RedFormat);none.needsUpdate=true;
export const blendGrassSeam=(g:number,a:number,b:number,c:number,u:number,v:number)=>g*(1-u)*(1-v)+Math.min(g,a)*u*(1-v)+Math.min(g,b)*(1-u)*v+Math.min(g,a,b,c)*u*v;
const outside=(v:number,l:number,h:number)=>v<l?l-v:v>h?v-h:0;
export function duneGrassBaseMetadata(terrain:string|undefined,cover:string|undefined,t:Terrain,dimensions:readonly [number,number]){
 const p=CANOPY_FENCE.pins,bounds=[-64.47,45.94,-61.93,47.1];
 return terrain===p.terrain&&cover===p.cover&&t.spec.width===4096&&t.spec.height===2720&&
  dimensions[0]===4096&&dimensions[1]===2720&&
  t.spec.bounds.length===4&&bounds.every((x,i)=>t.spec.bounds[i]===x)&&!!globalThis.crypto?.subtle;
}
export function duneGrassBase(terrain?:string,cover?:string,decoded?:string){
 const p=CANOPY_FENCE.pins;return terrain===p.terrain&&cover===p.cover&&decoded===p.coverDecoded;
}
export function duneGrassInfrastructure(road?:string,bldg?:string,path?:string,lot?:string){
 const p=CANOPY_FENCE.pins;return road===p.road&&bldg===p.buildings&&path===p.sidewalk&&lot===p.parking;
}
async function surfacePhoto(base:string,get:typeof fetch){
 if(!globalThis.crypto?.subtle||!globalThis.createImageBitmap)return;
 const ctl=AbortSignal.timeout(3200);
 try{
  const r=await get(base+P.file,{signal:ctl});
  if(r.status!==200||!r.body){void r.body?.cancel().catch(()=>{});return;}
  const data=new Uint8Array(P.wireBytes),read=r.body.getReader();let n=0;
  try{
   for(;;){const c=await read.read();if(c.done)break;if(n+c.value.length>data.length)return;data.set(c.value,n);n+=c.value.length;}
  }finally{void read.cancel().catch(()=>{});read.releaseLock();}
  if(ctl.aborted||n!==data.length)return;
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  if(sha!==P.sha256||ctl.aborted)return;
  const image=await createImageBitmap(new Blob([data],{type:'image/png'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  if(image.height!==P.pixels||image.width!==P.pixels||ctl.aborted){image.close();return;}
  const t=new T.Texture(image);
  t.name='Sparse Grass: generic CC0 photometric material';
  t.flipY=false;t.colorSpace=T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.generateMipmaps=true;
  t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=4;t.needsUpdate=true;return t;
 }catch{return;}
}
type Row={s:GrassAuthorityStamp,live:boolean,failed:boolean,loaded?:T.DataTexture,loading?:Promise<void>,visibleAt:number,
 vars:{duneTuftGroundBounds:{value:T.Vector4},duneTuftGroundPhoto:{value:T.Texture},duneTuftGroundMask:{value:T.Texture},duneTuftGroundGain:{value:number},duneTuftGroundPhase:{value:T.Vector2},duneTuftTerrainBox:{value:T.Vector4},duneTuftNeighbours:{value:T.Vector4},duneTuftCorners:{value:T.Vector4}}};
export class DuneGrassSurface{
 readonly shader=duneTuftGroundGLSL;
 private rows=new Map<string,Row>();
 private base:string;private get:typeof fetch;
 private authorized=false;
 private verify?:()=>Promise<boolean>;private verificationPending=false;
 private data?:Promise<readonly [NonNullable<Awaited<ReturnType<typeof openDuneGrassAuthority>>>,T.Texture]|undefined>;
 private live=new Set<Row>();
 private lastX=Infinity;private lastZ=Infinity;private cameraY=Infinity;private refreshFrames=0;
 constructor(base:string,terrain:Terrain,get:typeof fetch=fetch,protectedTiles:ReadonlySet<string>=new Set()){
  this.base=base;this.get=get;
  for(const s of A.index){
   if(protectedTiles.has(key(s.tile[0],s.tile[1])))continue;
   const b=new T.Vector4(s.uvOrigin[0],s.uvOrigin[1],s.cells[0]*5,s.cells[1]*5);
   const fract=(v:number)=>v-Math.floor(v);
   this.rows.set(key(s.tile[0],s.tile[1]),{s,live:false,failed:false,visibleAt:Infinity,
    vars:{duneTuftGroundBounds:{value:b},duneTuftGroundPhoto:{value:none},duneTuftGroundMask:{value:none},duneTuftGroundGain:{value:0},duneTuftGroundPhase:{value:new T.Vector2(fract(Math.fround(b.x)*.5),fract(Math.fround(b.y)*.5))},
    duneTuftTerrainBox:{value:new T.Vector4(terrain.left+(terrain.right-terrain.left)*s.tile[0]/WORLD_COLS,
      terrain.top+(terrain.bottom-terrain.top)*s.tile[1]/WORLD_ROWS,
      terrain.left+(terrain.right-terrain.left)*(s.tile[0]+1)/WORLD_COLS,
      terrain.top+(terrain.bottom-terrain.top)*(s.tile[1]+1)/WORLD_ROWS)},
    duneTuftNeighbours:{value:new T.Vector4()},duneTuftCorners:{value:new T.Vector4()}}});
  }
 }
 permit(verify?:()=>Promise<boolean>){
  if(!verify)this.authorized=true;
  else this.verify=verify;
 }
 uniforms(i:number,j:number){return this.rows.get(key(i,j))?.vars;}
 diagnostics(){return {authorized:this.authorized,active:[...this.live].filter(r=>r.vars.duneTuftGroundGain.value>0).map(r=>r.s.tile),
  pending:[...this.live].filter(r=>r.loading).length,failed:[...this.live].filter(r=>r.failed).length};}
 private async acquire(){
  const [authority,t]=await Promise.all([openDuneGrassAuthority(this.base,this.get),surfacePhoto(this.base,this.get)]);
  if(authority&&t)return [authority,t] as const;
  if(t){t.dispose();(t.image as ImageBitmap).close();}
 }
 private load(r:Row){
  r.loading=(async()=>{
   const p=await(this.data??=this.acquire());
   if(!p){r.failed=true;return;}
   if(!r.live)return;
   const bytes=await p[0].read(r.s);
   if(!bytes){r.failed=true;return;}
   if(!r.live)return;
   const [w,h]=r.s.cells,t=new T.DataTexture(bytes,w,h,T.RedFormat,T.UnsignedByteType);
   t.magFilter=t.minFilter=T.LinearFilter;t.generateMipmaps=false;t.unpackAlignment=1;t.needsUpdate=true;
   r.loaded=t;r.vars.duneTuftGroundMask.value=t;r.vars.duneTuftGroundPhoto.value=p[1];
   r.visibleAt=performance.now();
  })().catch(()=>{r.failed=true;}).finally(()=>{r.loading=undefined;});
 }
 update(x:number,y:number,z:number){
  if((!this.authorized&&!this.verify)||this.verificationPending||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return;
  const now=performance.now();
  if(Math.hypot(x-this.lastX,z-this.lastZ)>=20||Math.abs(y-this.cameraY)>10||this.refreshFrames++>=30){
   this.lastX=x;this.lastZ=z;this.cameraY=y;this.refreshFrames=0;
   const dist=(r:Row)=>{
    const b=r.vars.duneTuftGroundBounds.value;
    return Math.hypot(outside(x,b.x,b.x+b.z),outside(z,b.y,b.y+b.w));
   };
   const next=new Set([...this.rows.values()].map(r=>({r,dist:dist(r)})).filter(q=>q.dist<210&&y<q.r.s.terrainYMax+115)
    .sort((a,b)=>a.dist-b.dist).slice(0,4).map(q=>q.r));
   if(!this.authorized){
    if(next.size&&this.verify){
     const verify=this.verify;this.verify=undefined;this.verificationPending=true;
     // No texture, mask or live gain before the exact existing bytes match.
     // Completion only authorizes data: the next eye position selects demand.
     void Promise.resolve().then(verify).then(ok=>{this.authorized=ok===true;},()=>{})
      .finally(()=>{this.verificationPending=false;this.lastX=Infinity;});
    }
    return;
   }
   for(const r of this.live)if(!next.has(r)){
    r.live=false;r.loaded?.dispose();r.loaded=undefined;r.vars.duneTuftGroundMask.value=none;
    r.vars.duneTuftGroundGain.value=0;r.visibleAt=Infinity;
   }
   this.live=next;
   for(const r of next){
    r.live=true;
    if(!r.loaded&&!r.loading&&!r.failed)this.load(r);
   }
  }
  for(const r of this.live){
   const t=y>=r.s.terrainYMax+105?0:Math.max(0,Math.min(1,(now-r.visibleAt)/370));
   r.vars.duneTuftGroundGain.value=t*t*(3-2*t);
  }
  // Resolve visibility synchronously across edges. Missing, protected, failed
  // and pending neighbours all act as zero until their own exact source fades in.
  const gain=(x:number,z:number)=>this.rows.get(key(x,z))?.vars.duneTuftGroundGain.value??0;
  for(const r of this.live){
   const [i,j]=r.s.tile;
   r.vars.duneTuftNeighbours.value.set(gain(i-1,j),gain(i+1,j),gain(i,j-1),gain(i,j+1));
   r.vars.duneTuftCorners.value.set(gain(i-1,j-1),gain(i+1,j-1),gain(i-1,j+1),gain(i+1,j+1));
  }
 }
}
const duneTuftGroundGLSL=`
 uniform sampler2D duneTuftGroundPhoto,duneTuftGroundMask;
 uniform vec4 duneTuftGroundBounds,duneTuftTerrainBox,duneTuftNeighbours,duneTuftCorners;
 uniform float duneTuftGroundGain;uniform vec2 duneTuftGroundPhase;
 float duneSewnGain(vec2 p){
  vec4 e=duneTuftTerrainBox,v=duneTuftNeighbours,k=duneTuftCorners;
  float dx=p.x-e.x,dz=p.y-e.y,ex=e.z-p.x,ez=e.w-p.y;
  bool left=dx<ex,north=dz<ez;
  float u=1.-smoothstep(0.,12.,min(dx,ex)),v0=1.-smoothstep(0.,12.,min(dz,ez));
  float g=min(1.,duneTuftGroundGain),gX=min(g,left?v.x:v.y),gZ=min(g,north?v.z:v.w);
  float gXZ=min(min(gX,gZ),north?(left?k.x:k.y):(left?k.z:k.w));
  return mix(mix(g,gX,u),mix(gZ,gXZ,u),v0);
 }
 void paintDuneTuftGround(inout vec3 col,inout vec3 n,vec3 world,float coast){
  if(duneTuftGroundGain<=0.)return;
  vec2 p=world.xz-duneTuftGroundBounds.xy,dx=dFdx(p),dy=dFdy(p);
  vec2 uv=p/duneTuftGroundBounds.zw;
  float d=distance(cameraPosition,world);
  if(d>=105.||world.y<=.65||n.y<.74||coast<=33.||any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return;
  float authority=textureLod(duneTuftGroundMask,uv,0.).r;
  float w=duneSewnGain(world.xz)*authority*(1.-smoothstep(42.,105.,d))*smoothstep(33.,48.,coast)*smoothstep(.74,.91,n.y);
  if(w<.001)return;
  float drift=noise(world.xz*.096+vec2(13.,47.));
  vec2 q=fract(p*.5+duneTuftGroundPhase)+vec2(noise(world.xz*.07),noise(world.xz*.074-55.))*.30;
  vec4 m=textureGrad(duneTuftGroundPhoto,q,dx*.5,dy*.5);
  float mottle=smoothstep(.26,.73,.61*drift+.39*noise(world.xz*.36+8.));
  float tuft=smoothstep(.016,.30,m.a);
  vec3 sed=vec3(.218,.165,.109);
  vec3 moss=mix(vec3(.110,.137,.055),vec3(.082,.128,.047),mottle);
  vec3 leaf=mix(sed,moss,clamp(.13+mottle*.63+tuft*.31,0.,1.));
  leaf*=.81+.32*m.b;
  col=mix(col,leaf,w*.82);
  n=normalize(n+vec3(-m.r+.5,0.,m.g-.5)*w*.17);
 }`;
