import * as THREE from 'three';
import {COASTAL_SPECS} from '../sim/coastal-surveys.generated.ts';
import {SURVEY_LOD,WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import {readCoastalPack} from '../sim/coastal-packs.ts';
import type {Terrain} from '../sim/terrain.ts';
import type {World} from './world.ts';
import {SIDEWALKS} from './sidewalks.generated.ts';
import {sidewalkMaterial} from './sidewalk-material.ts';

export const WALK_TOP=.082, WALK_FOOT=-.045;
const TILE=SIDEWALKS.projectedTileMetres, VIEW=1540, CLOSE=530, ALT=430;
const MAX_VISIBLE=27;
type XZ={x:number;z:number};
type Box=readonly [left:number,top:number,right:number,bottom:number];
type Point=XZ&{u:number;v:number};
type Ground=(x:number,z:number)=>number;
type Land=(x:number,z:number)=>boolean;
export type WalkPath={style:number;width:number;phase:number;points:XZ[]};
export type WalkTile={id:string;ox:number;oz:number;box:Box;paths:WalkPath[]};
type Grid={x0:number;z0:number;dx:number;dz:number};

/** Versioned and bounded; from OSM, not an inferred province-wide street offset. */
export function decodeSidewalks(buffer:ArrayBuffer):WalkTile[]{
 const a=new DataView(buffer);
 if(a.byteLength<16||a.getUint32(0)!==0x53574b31||a.getUint16(4,true)!==1)
  throw Error('Unsupported PEI sidewalk format');
 const n=a.getUint16(6,true),total=a.getUint32(8,true),allPoints=a.getUint32(12,true);
 if(!n||n>512||!total||total>8000||!allPoints||allPoints>80000)
  throw Error('Invalid PEI sidewalk atlas allocation');
 let at=16,count=0,seenPoints=0;
 const tiles=new Map<string,WalkTile>();
 const c16=()=>{const v=a.getUint16(at,true);at+=2;return v;};
 const i16=()=>{const v=a.getInt16(at,true);at+=2;return v;};
 const i32=()=>{const v=a.getInt32(at,true);at+=4;return v;};
 for(let i=0;i<n;i++){
  if(at+6>a.byteLength)throw Error('Truncated sidewalk tile');
  const tx=i16(),tz=i16(),paths=c16(),id=tx+','+tz,ox=(tx+.5)*TILE,oz=(tz+.5)*TILE;
  if(tx< -125||tx>122||tz< -85||tz>72||!paths||paths>500||tiles.has(id))throw Error('Invalid sidewalk tile');
  let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
  const list:WalkPath[]=[];
  for(let j=0;j<paths;j++){
   if(at+15>a.byteLength)throw Error('Truncated sidewalk path');
   const style=a.getUint8(at++),width=c16()*.01,phase=c16(),m=c16();
   let ix=i32(),iz=i32();
   if(style>5||width<.90||width>2.80||m<2||m>480||at+4*(m-1)>a.byteLength)
    throw Error('Invalid sidewalk path');
   const points:XZ[]=[];
   for(let k=0;k<m;k++){
    if(k){const dx=i16(),dz=i16();if(dx===0&&dz===0)throw Error('Zero-length sidewalk edge');ix+=dx;iz+=dz;}
    const x=ix*.01,z=iz*.01;
    if(Math.abs(x-ox)>2000||Math.abs(z-oz)>2000)throw Error('Sidewalk path outside tile guard');
    points.push({x,z});l=Math.min(l,x-width);t=Math.min(t,z-width);r=Math.max(r,x+width);b=Math.max(b,z+width);
   }
   count++;seenPoints+=m;list.push({style,width,phase,points});
  }
  tiles.set(id,{id,ox,oz,box:[l,t,r,b],paths:list});
 }
 if(at!==a.byteLength||count!==total||seenPoints!==allPoints)throw Error('Mismatched sidewalk atlas counts');
 return [...tiles.values()];
}

export function loadSidewalks(base:string,fetcher:typeof fetch=fetch,timeoutMs=6500){
 return readCoastalPack(base+SIDEWALKS.asset,fetcher,timeoutMs,SIDEWALKS,b=>{
  const p=decodeSidewalks(b);
  if(p.length!==SIDEWALKS.tiles)throw Error('Unexpected sidewalk revision');
  return p;
 });
}

const cross=(a:XZ,b:XZ,c:XZ)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function lerp(a:Point,b:Point,t:number):Point{
 return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t};
}
const gridValue=(p:XZ,g:Grid,axis:number)=>{
 const u=(p.x-g.x0)/g.dx,v=(p.z-g.z0)/g.dz;
 return axis===0?u:axis===1?v:u+v;
};
function halves(poly:Point[],vals:number[],cut:number){
 const a:Point[]=[],b:Point[]=[];
 for(let i=0;i<poly.length;i++){
  const j=(i+1)%poly.length,p=poly[i],u=vals[i]-cut,v=vals[j]-cut;
  if(u<=1e-10)a.push(p);
  if(u>=-1e-10)b.push(p);
  if(u*v<0&&Math.min(Math.abs(u),Math.abs(v))>1e-10){
   const q=lerp(p,poly[j],u/(u-v));a.push(q);b.push(q);
  }
 }
 return [a,b].filter(q=>q.length>=3);
}

/** A 112-grid cut also contains the 56- and 8-grid triangles and their diagonals.
 * Each emitted cap triangle lives in exactly one visible terrain facet at any LOD. */
export function splitWalkCap(face:Point[],g:Grid){
 let parts=[face];
 for(let axis=0;axis<3;axis++){
  const vals=face.map(p=>gridValue(p,g,axis));
  for(let h=Math.floor(Math.min(...vals))+1;h<Math.max(...vals)-1e-9;h++){
   const split:Point[][]=[];
   for(const poly of parts){
    const v=poly.map(p=>gridValue(p,g,axis));
    if(Math.min(...v)<h-1e-9&&Math.max(...v)>h+1e-9)split.push(...halves(poly,v,h));
    else split.push(poly);
   }
   parts=split;
  }
 }
 return parts;
}
function splitWalkEdge(a:Point,b:Point,g:Grid){
 const k=[0,1];
 for(let axis=0;axis<3;axis++){
  const p=gridValue(a,g,axis),q=gridValue(b,g,axis);
  for(let h=Math.floor(Math.min(p,q))+1;h<Math.max(p,q)-1e-9;h++)k.push((h-p)/(q-p));
 }
 const at=k.sort((u,v)=>u-v).filter((v,i,p)=>!i||v-p[i-1]>1e-8);
 return at.map(t=>lerp(a,b,t));
}

/** Mitered pedestrian strip with a hard radius limit (also used by the bake clearance).
 * Near joints share exact XZ at both sides, rather than overlapping rectangles. */
export function walkSections(path:WalkPath):[Point,Point][]{
 const a=path.points,normal:XZ[]=[];
 for(let i=1;i<a.length;i++){
  const dx=a[i].x-a[i-1].x,dz=a[i].z-a[i-1].z,L=Math.hypot(dx,dz);
  normal.push({x:dz/L,z:-dx/L});
 }
 let chainage=(path.phase/65536)*14.3;
 return a.map((p,i)=>{
  if(i)chainage+=Math.hypot(p.x-a[i-1].x,p.z-a[i-1].z);
  const h=path.width*.5,prev=normal[Math.max(0,i-1)],next=normal[Math.min(normal.length-1,i)];
  const mx=prev.x+next.x,mz=prev.z+next.z,L=Math.hypot(mx,mz);
  const x=L>1e-8?mx/L:next.x,z=L>1e-8?mz/L:next.z,s=h*Math.min(1.155,1/Math.max(.01,x*next.x+z*next.z));
  return [-1,1].map(u=>({x:p.x+x*s*u,z:p.z+z*s*u,u,v:chainage})) as [Point,Point];
 });
}

export type WalkMesh={geometry:THREE.BufferGeometry;offsets:Float32Array;top:number};
export function sidewalkGeometry(tile:WalkTile,g:Grid,land:Land,blocked?:(box:Box)=>boolean):WalkMesh{
 const caps:Point[]=[],walls:{p:Point;y:number;kind:number;w:number}[]=[],styles:number[]=[],widths:number[]=[];
 const wall=(a:Point,b:Point,kind:number,w:number)=>{
  const q=splitWalkEdge(a,b,g);
  for(let i=1;i<q.length;i++){
   const p=q[i-1],v=q[i];
   for(const [p2,y] of [[p,WALK_TOP],[v,WALK_TOP],[p,WALK_FOOT],[v,WALK_TOP],[v,WALK_FOOT],[p,WALK_FOOT]] as const)
    walls.push({p:p2,y,kind,w});
  }
 };
 for(const path of tile.paths){
  const s=walkSections(path),good:boolean[]=[];
  for(let i=1;i<s.length;i++){
   const [a,b]=s[i-1],[d,c]=s[i];
   // Pinned Cover proof is made offline for the full rectangle. Disabling
   // any visibly wet/invalid span is a second conservative recovery guard.
   const x=[a.x,b.x,c.x,d.x],z=[a.z,b.z,c.z,d.z];
   if(cross(a,b,c)<1e-8||cross(a,c,d)<1e-8||[a,b,c,d].some(p=>!land(p.x,p.z))||
      blocked?.([Math.min(...x),Math.min(...z),Math.max(...x),Math.max(...z)])){good.push(false);continue;}
   good.push(true);
   for(const poly of splitWalkCap([a,b,c,d],g))for(let j=1;j<poly.length-1;j++){
    const [a,b,c]=[poly[0],poly[j],poly[j+1]];
    if(cross(a,b,c)<1e-8)continue;
    caps.push(a,c,b);styles.push(path.style);widths.push(path.width);
   }
   wall(b,c,path.style,path.width);wall(d,a,path.style,path.width);
  }
  for(let i=0;i<good.length;i++)if(good[i]){
   if(!good[i-1])wall(s[i][0],s[i][1],path.style,path.width);
   if(!good[i+1])wall(s[i+1][1],s[i+1][0],path.style,path.width);
  }
 }
 const len=caps.length+walls.length,pos=new Float32Array(len*3),uv=new Float32Array(len*2),mark=new Float32Array(len*3),offsets=new Float32Array(len);
 const put=(i:number,p:Point,y:number,kind:number,edge:number,w:number)=>{
  pos[i*3]=p.x-tile.ox;pos[i*3+2]=p.z-tile.oz;uv[i*2]=p.u;uv[i*2+1]=p.v;
  mark[i*3]=kind;mark[i*3+1]=edge;mark[i*3+2]=w*.5;offsets[i]=y;
 };
 caps.forEach((p,i)=>put(i,p,WALK_TOP,styles[Math.floor(i/3)],0,widths[Math.floor(i/3)]));
 walls.forEach(({p,y,kind,w},j)=>put(caps.length+j,p,y,kind,1,w));
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 geometry.setAttribute('walkStyle',new THREE.BufferAttribute(mark,3));
 return {geometry,offsets,top:caps.length};
}

export function fitSidewalk(mesh:WalkMesh,tile:WalkTile,ground:Ground){
 const p=mesh.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setY(i,ground(tile.ox+p.getX(i),tile.oz+p.getZ(i))+mesh.offsets[i]);
 p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
}

export function sidewalkGrid(terrain:Terrain):Grid{
 return {x0:terrain.left,z0:terrain.top,dx:(terrain.right-terrain.left)/(WORLD_COLS*SURVEY_LOD),
  dz:(terrain.bottom-terrain.top)/(WORLD_ROWS*SURVEY_LOD)};
}
function boxDistance(b:Box,x:number,z:number){return Math.hypot(Math.max(0,b[0]-x,x-b[2]),Math.max(0,b[1]-z,z-b[3]));}
type Resident={model:WalkMesh;mesh:THREE.Mesh;tile:WalkTile;ground:string};

export class Sidewalks{
 private readonly root=new THREE.Group();
 private readonly mat:THREE.ShaderMaterial;
 private readonly resident=new Map<string,Resident>();
 private pending:WalkTile[]=[];
 private lastX=Infinity;private lastZ=Infinity;private pastEpoch=-1;private wasActive=false;
 private readonly grid:Grid;
 private readonly world:World;
 private readonly atlas:WalkTile[];
 constructor(scene:THREE.Scene,world:World,atlas:WalkTile[],preserveSceneAlpha=false){
  this.world=world;this.atlas=atlas;this.grid=sidewalkGrid(world.terrain);
  this.mat=sidewalkMaterial(world.sun,world.buildingShadows,preserveSceneAlpha);
  this.root.name='Mapped PEI sidewalk ribbons';this.root.visible=false;scene.add(this.root);
 }
 update(x:number,z:number,agl:number){
  const on=agl<ALT,s=this.world;
  this.mat.uniforms.walkAltitude.value=agl;
  if(!on){if(this.wasActive){this.root.visible=false;this.wasActive=false;}return;}
  const epoch=s.visualGroundEpoch;
  if(!this.wasActive||Math.hypot(x-this.lastX,z-this.lastZ)>64||epoch!==this.pastEpoch){
   this.wasActive=true;this.root.visible=true;this.lastX=x;this.lastZ=z;this.pastEpoch=epoch;
   const inView=this.atlas.map(t=>({t,d:boxDistance(t.box,x,z)})).filter(a=>a.d<VIEW)
    .sort((a,b)=>a.d-b.d).slice(0,MAX_VISIBLE);
   const ids=new Set(inView.map(a=>a.t.id));
   for(const [id,item] of this.resident)if(!ids.has(id)){
    this.root.remove(item.mesh);item.model.geometry.dispose();this.resident.delete(id);
   }
   for(const {t,d} of inView){
    const item=this.resident.get(t.id);if(!item)continue;
    this.refresh(item,d);
   }
   this.pending=inView.filter(a=>!this.resident.has(a.t.id)).map(a=>a.t);
  }
  const t=this.pending.shift();if(!t)return; // never build a whole district in one frame
  const allowed=(x:number,z:number)=>s.cover.distance(s.terrain,x,z)>.3
   &&!COASTAL_SPECS.some(q=>{const [u,v]=s.terrain.uv(x,z);return Math.floor(u*WORLD_COLS)===q.tileX&&Math.floor(v*WORLD_ROWS)===q.tileZ;});
  // The regular cut proof doesn't cover a separately inserted irregular
  // terrain patch. Protect it even if a future opt-in survey extends here.
  const blocked=s.terrain.inlandGrids.length?(b:Box)=>s.terrain.inlandGrids.some(g=>
   b[0]<g.x1&&b[2]>g.x0&&b[1]<g.z1&&b[3]>g.z0):undefined;
  const model=sidewalkGeometry(t,this.grid,allowed,blocked),mesh=new THREE.Mesh(model.geometry,this.mat);
  mesh.name='Mapped sidewalk tile '+t.id;mesh.position.set(t.ox,0,t.oz);
  const item={model,mesh,tile:t,ground:''};
  this.refresh(item,boxDistance(t.box,x,z));this.resident.set(t.id,item);this.root.add(mesh);
 }
 private refresh(a:Resident,d:number){
  const s=this.world,stamp=s.visualGroundSignature(a.tile.box);
  if(a.ground!==stamp){
   fitSidewalk(a.model,a.tile,(x,z)=>s.visualGroundHeight(x,z));
   a.ground=stamp;
  }
  const g=a.model.geometry;
  g.setDrawRange(0,d<CLOSE?g.getAttribute('position').count:a.model.top);
 }
 /** The actual receiver refreshes its existing vertex heights when the ground changes. */
 basilicaSunWalk(ours?:THREE.Material){
  const m=this.resident.get('6,34')?.mesh;
  if(SIDEWALKS.sha256!=='e2dce7c86c4b5cd45ea45fb92ed89c2ae504306e4349e1291e627a669630e384'||
     !this.root.visible||!m?.visible||m.parent!==this.root||(m.material!==this.mat&&m.material!==ours))return;
  return {mesh:m,base:this.mat as THREE.Material};
 }
 get state(){
  return {id:SIDEWALKS.id,tiles:this.resident.size,pending:this.pending.length,visible:this.root.visible};
 }
}
