import * as THREE from 'three';
import {CONFEDERATION_TRAIL as STAMP} from './confederation-trail.generated.ts';
import {confederationMaterial} from './confederation-trail-material.ts';
import {sidewalkGrid,splitWalkCap} from './sidewalks.ts';
import {COASTAL_SPECS} from '../sim/coastal-surveys.generated.ts';
import {WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import {RUNWAYS,runwayAt} from '../sim/places.ts';
import type {Terrain} from '../sim/terrain.ts';
import type {World} from './world.ts';

export const TRAIL_RANGE=1420, TRAIL_MAX_AGL=335, TRAIL_MAX_RESIDENT=12;
const FETCH_RANGE=1485, TILE=STAMP.projectedTileMetres, CAMERA_STEP=58, DEADLINE=4500;
const MAX_CAP_VERTICES=38000;
type Box=readonly [number,number,number,number];
type Point={x:number;z:number;u:number;v:number};
type Cut=Readonly<{x:number;z:number;wX:number;wZ:number;fade:number}>;
export type TrailPath=Readonly<{way:number;kind:number;tagged:boolean;width:number;cuts:Cut[]}>;
export type TrailTile=Readonly<{key:string;ox:number;oz:number;box:Box;paths:TrailPath[]}>;
type Ground=(x:number,z:number)=>number;
type Surface=(x:number,z:number)=>boolean;
const positiveCover=new Set([10,20,30,40,50,60]);
const fixedKeys=new Set(STAMP.keys.map(([x,z])=>x+','+z));
const dist=(b:Box,x:number,z:number)=>Math.hypot(Math.max(0,b[0]-x,x-b[2]),Math.max(0,b[1]-z,z-b[3]));

/** A bounded version of the ODbL asset grammar. SHA verification is separate. */
export function decodeConfederationTrail(buffer:ArrayBuffer){
 const v=new DataView(buffer);
 if(v.byteLength<16||v.getUint32(0)!==0x43544631||v.getUint16(4,true)!==1)throw Error('Unsupported trail atlas');
 const n=v.getUint16(6,true),np=v.getUint32(8,true),nv=v.getUint32(12,true);
 if(!n||n>512||!np||np>6400||!nv||nv>65000)throw Error('Trail atlas allocation limit');
 let i=16,ps=0,vs=0;
 const tile=new Map<string,TrailTile>();
 const check=(n:number)=>{if(i+n>v.byteLength)throw Error('Truncated trail atlas');};
 const b=()=>v.getUint8(i++);
 const w=()=>{const n=v.getUint16(i,true);i+=2;return n;};
 const s=()=>{const n=v.getInt16(i,true);i+=2;return n;};
 const l=()=>{const n=v.getInt32(i,true);i+=4;return n;};
 const ul=()=>{const n=v.getUint32(i,true);i+=4;return n;};
 for(let k=0;k<n;k++){
  check(6);
  const tx=s(),tz=s(),m=w(),key=tx+','+tz,ox=(tx+.5)*TILE,oz=(tz+.5)*TILE;
  if(Math.abs(tx)>125||Math.abs(tz)>85||!m||m>=300||tile.has(key))throw Error('Invalid trail cell');
  const box:[number,number,number,number]=[Infinity,Infinity,-Infinity,-Infinity];
  const paths:TrailPath[]=[];
  for(let p=0;p<m;p++){
   check(10);const kind=b(),tag=b(),width=w()*.01,way=ul(),len=w();
   if(kind>1||tag>1||width<1||width>3||!way||len<2||len>1000||++ps>np||vs+len>nv)
    throw Error('Invalid trail membership');
   const cuts:Cut[]=[];
   check(13);let x=l(),z=l();
   for(let j=0;j<len;j++){
    if(j){
     check(9);const dx=s(),dz=s();if(!dx&&!dz)throw Error('Zero-length trail segment');
     x+=dx;z+=dz;
    }
    const dx=s(),dz=s(),fade=b()/255;
    const X=x*.01,Z=z*.01,wX=dx*.01,wZ=dz*.01,d=Math.hypot(wX,wZ);
    // Interpolated cut widths may be very slightly narrower than at authored rows.
    if(Math.abs(X-ox)>TILE*.5+.025||Math.abs(Z-oz)>TILE*.5+.025||
      d<width*.45||d>width*.581+.015)throw Error('Trail section outside sealed limits');
    box[0]=Math.min(box[0],X-Math.abs(wX));box[1]=Math.min(box[1],Z-Math.abs(wZ));
    box[2]=Math.max(box[2],X+Math.abs(wX));box[3]=Math.max(box[3],Z+Math.abs(wZ));
    cuts.push({x:X,z:Z,wX,wZ,fade});
   }
   vs+=len;paths.push({way,kind,tagged:tag===1,width,cuts});
  }
  tile.set(key,{key,ox,oz,box,paths});
 }
 if(vs!==nv||ps!==np||i!==v.byteLength)throw Error('Unexpected trail atlas length');
 return tile;
}

const sha=async(buf:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buf)),x=>x.toString(16).padStart(2,'0')).join('');
class TrailBytesError extends Error {}
async function bounded(body:ReadableStream<Uint8Array>|null,max:number,signal:AbortSignal){
 if(!body||signal.aborted)throw new TrailBytesError('Missing or expired bytes');
 const out=new Uint8Array(max),r=body.getReader();
 let n=0;const stop=()=>void r.cancel().catch(()=>{});
 signal.addEventListener('abort',stop,{once:true});
 try{
  for(;;){
   const v=await r.read();
   if(signal.aborted)throw new TrailBytesError('Expired trail bytes');
   if(v.done)return out.buffer.slice(0,n);
   if(n+v.value.length>max){stop();throw new TrailBytesError('Oversized trail bytes');}
   out.set(v.value,n);n+=v.value.length;
  }
 }finally{signal.removeEventListener('abort',stop);r.releaseLock();}
}
export async function loadConfederationTrail(base:string,fetcher:typeof fetch=fetch,timeoutMs=DEADLINE){
 if(!globalThis.crypto?.subtle)return;
 // Bound compressed AND decoded length, verify both supported HTTP forms, and
 // never arm an incomplete source even if an abort-insensitive reader resolves.
 const controller=new AbortController(),t=performance.now()+timeoutMs;
 const expired=()=>controller.signal.aborted||performance.now()>=t;
 const validLength=(n:number)=>n===STAMP.compressedBytes||n===STAMP.decodedBytes;
 const read=async()=>{
  const r=await fetcher(base+STAMP.asset,{signal:controller.signal,redirect:'error'});
  const len=r.headers.get('Content-Length'),enc=r.headers.get('Content-Encoding')?.toLowerCase().trim();
  if(expired()||r.status!==200||r.headers.has('Content-Range')||
    (enc&&enc!=='gzip'&&enc!=='x-gzip'&&enc!=='identity')||
    (len!==null&&(!/^\d+$/.test(len)||!validLength(Number(len))))){
   void r.body?.cancel().catch(()=>{});return;
  }
  let bytes=await bounded(r.body,STAMP.decodedBytes,controller.signal);
  if(expired())return;
  if(bytes.byteLength===STAMP.compressedBytes){
   if(await sha(bytes)!==STAMP.wireSha256||expired()||typeof DecompressionStream==='undefined')return;
   bytes=await bounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),STAMP.decodedBytes,controller.signal);
  }
  if(expired()||bytes.byteLength!==STAMP.decodedBytes||await sha(bytes)!==STAMP.sha256||expired())return;
  const result=decodeConfederationTrail(bytes);
  if(result.size!==STAMP.tiles||Array.from(result.keys()).some(k=>!fixedKeys.has(k)))return;
  return result;
 };
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([read(),new Promise<undefined>(ok=>{timer=setTimeout(()=>{controller.abort();ok(undefined);},timeoutMs);})]);}
 catch{return undefined;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}

const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function section(c:Cut,side:number):Point{return{x:c.x+c.wX*side,z:c.z+c.wZ*side,u:side,v:c.fade};}
function landmarks(terrain:Terrain){
 const w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS;
 return COASTAL_SPECS.map(({tileX,tileZ}):Box=>[terrain.left+tileX*w,terrain.top+tileZ*d,terrain.left+(tileX+1)*w,terrain.top+(tileZ+1)*d]);
}
const overlaps=(a:Box,b:Box)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
/** Real positive-area caps only. Every fan is cut at the 112 grid axes and
 * diagonals, which also partition the regular 56 and 8 ground meshes. */
export function confederationGeometry(tile:TrailTile,terrain:Terrain,land:Surface,block?:(b:Box)=>boolean,canopy?:Surface){
 const grid=sidewalkGrid(terrain),pos:number[]=[],tex:number[]=[],tag:number[]=[];
 const put=(p:Point,path:TrailPath)=>{
  pos.push(p.x-tile.ox,0,p.z-tile.oz);tex.push(p.u,p.v);tag.push(path.kind*255,canopy?.(p.x,p.z)?255:0);
  if(pos.length/3>MAX_CAP_VERTICES)throw Error('Trail tile exceeded cap budget');
 };
 const stable=(a:Point,b:Point,c:Point)=>{
  const lx=Math.fround(a.x-tile.ox),lz=Math.fround(a.z-tile.oz);
  const ux=Math.fround(b.x-tile.ox)-lx,uz=Math.fround(b.z-tile.oz)-lz;
  const vx=Math.fround(c.x-tile.ox)-lx,vz=Math.fround(c.z-tile.oz)-lz;
  return ux*vz-uz*vx>1e-7;
 };
 for(const path of tile.paths)for(let j=1;j<path.cuts.length;j++){
  const a=section(path.cuts[j-1],-1),b=section(path.cuts[j-1],1),c=section(path.cuts[j],1),d=section(path.cuts[j],-1);
  if(cross(a,b,c)<=1e-8||cross(a,c,d)<=1e-8)continue;
  const cells=[a,b,c,d],x=cells.map(p=>p.x),z=cells.map(p=>p.z);
  if(block?.([Math.min(...x),Math.min(...z),Math.max(...x),Math.max(...z)])||
    cells.some(p=>!land(p.x,p.z)))continue;
  for(const q of splitWalkCap(cells,grid))for(let i=1;i<q.length-1;i++){
   const[p,r,s]=[q[0],q[i],q[i+1]];
   if(!stable(p,r,s))continue;
   put(p,path);put(s,path);put(r,path);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));
 g.setAttribute('trailOptic',new THREE.Uint8BufferAttribute(tag,2,true));
 return g;
}
export function seatConfederation(g:THREE.BufferGeometry,tile:TrailTile,visual:Ground){
 const p=g.getAttribute('position'),uv=g.getAttribute('uv');
 for(let k=0;k<p.count;k++){
  const ground=visual(tile.ox+p.getX(k),tile.oz+p.getZ(k));
  if(!Number.isFinite(ground))throw Error('Unreliable trail terrain');
  // 20 to 33 mm lift; a visual separation, not a wall, bank or collision surface.
  p.setY(k,ground+.020+.013*(1.-Math.abs(uv.getX(k))));
 }
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
}
type Inhabitant={mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;tile:TrailTile;stamp:string};
type LoadState='pending-pins'|'source-mismatch'|'idle'|'checking'|'verified'|'loading'|'ready'|'unavailable';
export function confederationTrailRequested(o:URLSearchParams){
 return !o.has('stockConfederationTrail')&&o.get('scenery')!=='detail'&&
  !['inlandRelief','surveyRelief','adaptiveTerrain','basinChannel','montagueFoundationPreview','northBaywalkPreview'].some(k=>o.has(k));
}
export function confederationTerrainPins(terrainSha:string|undefined,coverSha:string|undefined){
 return terrainSha===STAMP.pins.terrain&&coverSha===STAMP.pins.cover&&
  RUNWAYS.length===STAMP.runways.length&&RUNWAYS.every((r,i)=>{
   const [id,x,z,X,Z,width]=STAMP.runways[i];
   return id===r.id&&Math.max(Math.abs(x-r.p.x),Math.abs(z-r.p.z),Math.abs(X-r.q.x),Math.abs(Z-r.q.z),Math.abs(width-r.width))<.001;
  })&&COASTAL_SPECS.length===STAMP.protectedCoasts.length&&COASTAL_SPECS.every((r,i)=>
   r.tileX===STAMP.protectedCoasts[i][0]&&r.tileZ===STAMP.protectedCoasts[i][1]);
}
export function confederationSceneryPins(roads:string|undefined,buildings:string|undefined,walks:string|undefined,parking:string|undefined){
 return roads===STAMP.pins.roads&&buildings===STAMP.pins.buildings&&walks===STAMP.pins.sidewalk&&parking===STAMP.pins.parking;
}
function rangeCells(x:number,z:number,r:number){
 const list:string[]=[];
 for(let j=Math.floor((z-r)/TILE);j<=Math.floor((z+r)/TILE);j++)
 for(let i=Math.floor((x-r)/TILE);i<=Math.floor((x+r)/TILE);i++){
  const key=i+','+j;
  if(fixedKeys.has(key)&&dist([i*TILE,j*TILE,(i+1)*TILE,(j+1)*TILE],x,z)<r+1.3)list.push(key);
 }
 return list;
}

export class ConfederationTrail{
 private readonly group=new THREE.Group();
 private readonly material:THREE.ShaderMaterial;
 private readonly coast:Box[];
 private readonly active=new Map<string,Inhabitant>();
 private readonly rejected=new Map<string,string>();
 private next:TrailTile[]=[];
 private map?:Map<string,TrailTile>;
 private phase:LoadState='pending-pins';
 private verify?:()=>Promise<string|undefined>;
 private attempts=0;
 private oldX=Infinity;private oldZ=Infinity;private epoch=-1;private on=false;
 private readonly world:World;
 private readonly base:string;
 private readonly request:typeof fetch;
 constructor(scene:THREE.Scene,world:World,base:string,msaa:boolean,request:typeof fetch=fetch){
  this.world=world;this.base=base;this.request=request;
  this.material=confederationMaterial(world.sun,msaa,world.buildingShadows);
  this.coast=landmarks(world.terrain);
  this.group.name='Main Confederation Trail – mapped stone dust';this.group.visible=false;scene.add(this.group);
 }
 permit(q:undefined|(()=>Promise<string|undefined>)){
  if(this.phase!=='pending-pins')return;
  this.phase=q?'idle':'source-mismatch';this.verify=q;
 }
 update(x:number,z:number,agl:number,flight:boolean){
  const allowed=flight&&Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(agl)&&agl>=0&&agl<TRAIL_MAX_AGL;
  if(this.phase==='source-mismatch'||this.phase==='unavailable'||this.phase==='pending-pins')return;
  if(!allowed){
   if(this.on){this.group.visible=false;this.on=false;}
   return;
  }
  if(this.phase==='idle'||this.phase==='verified'){
   if(Math.hypot(x-this.oldX,z-this.oldZ)<CAMERA_STEP)return;
   this.oldX=x;this.oldZ=z;
   if(!rangeCells(x,z,FETCH_RANGE).length)return;
   if(this.phase==='idle'){
    this.phase='checking';
    void Promise.resolve().then(()=>this.verify?.()).then(s=>{
     this.phase=s===STAMP.pins.coverDecoded?'verified':'source-mismatch';this.oldX=Infinity;
    },()=>{this.phase='source-mismatch';});
   }else{
    this.attempts++;this.phase='loading';
    void loadConfederationTrail(this.base,this.request).then(m=>{
     this.map=m;this.phase=m?'ready':'unavailable';this.oldX=Infinity;
    },()=>{this.phase='unavailable';});
   }
   return;
  }
  const map=this.map;if(!map||this.phase!=='ready')return;
  const w=this.world;this.material.uniforms.trailAGL.value=agl;
  const ep=w.visualGroundEpoch;
  if(!this.on||ep!==this.epoch||Math.hypot(x-this.oldX,z-this.oldZ)>CAMERA_STEP){
   this.on=true;this.group.visible=true;this.epoch=ep;this.oldX=x;this.oldZ=z;
   const ring=rangeCells(x,z,TRAIL_RANGE).map(k=>map.get(k)!)
    .filter(t=>dist(t.box,x,z)<TRAIL_RANGE).sort((a,b)=>dist(a.box,x,z)-dist(b.box,x,z)||a.key.localeCompare(b.key))
    .slice(0,TRAIL_MAX_RESIDENT);
   const desired=new Set(ring.map(t=>t.key));
   for(const[k,v]of this.active)if(!desired.has(k)){
    this.group.remove(v.mesh);v.mesh.geometry.dispose();this.active.delete(k);
   }else if(v.stamp!==w.visualGroundSignature(v.tile.box))v.mesh.visible=false;
   for(const k of this.rejected.keys())if(!desired.has(k))this.rejected.delete(k);
   this.next=ring.filter(t=>{
    const stamp=w.visualGroundSignature(t.box),a=this.active.get(t.key);
    if(a?.stamp===stamp){a.mesh.visible=true;return false;}
    return this.rejected.get(t.key)!==stamp;
   });
  }
  const task=this.next.shift();if(!task)return;
  const stamp=w.visualGroundSignature(task.box),stale=this.active.get(task.key);
  // The proof only covers regular terrain; separate grade/relief geometry must
  // not inherit these triangle partitions, even in a future optional mode.
  if(/(?:g|\*|-);/.test(stamp)||!stamp){
   if(stale){this.group.remove(stale.mesh);stale.mesh.geometry.dispose();this.active.delete(task.key);}
   this.rejected.set(task.key,stamp);return;
  }
  const blocked=(b:Box)=>this.coast.some(o=>overlaps(b,o))||w.terrain.inlandGrids.some(g=>overlaps(b,[g.x0,g.z0,g.x1,g.z1]));
  const valid=(x:number,z:number)=>w.cover.distance(w.terrain,x,z)>.6&&
   positiveCover.has(w.cover.sample(w.terrain,x,z))&&!runwayAt(x,z);
  let g:THREE.BufferGeometry|undefined;
  try{
   g=stale?.mesh.geometry??confederationGeometry(task,w.terrain,valid,blocked,(x,z)=>w.cover.sample(w.terrain,x,z)===10);
   if(!g.getAttribute('position').count){g.dispose();this.rejected.set(task.key,stamp);return;}
   seatConfederation(g,task,(x,z)=>w.visualGroundHeight(x,z));
   if(stale){stale.stamp=stamp;stale.mesh.visible=true;return;}
   const m=new THREE.Mesh(g,this.material);
   m.position.set(task.ox,0,task.oz);m.name='Confederation Trail tile '+task.key;
   this.group.add(m);this.active.set(task.key,{mesh:m,tile:task,stamp});
  }catch{
   if(stale){this.group.remove(stale.mesh);this.active.delete(task.key);}
   g?.dispose();this.rejected.set(task.key,stamp);
  }
 }
 get state(){
  let verts=0,visible=0;
  if(this.group.visible)for(const v of this.active.values())if(v.mesh.visible){visible++;verts+=v.mesh.geometry.getAttribute('position').count;}
  return {status:this.phase,attempts:this.attempts,resident:this.active.size,visible,pending:this.next.length,triangles:verts/3,active:visible>0};
 }
}
