import * as THREE from 'three';
import {readCoastalPack} from '../sim/coastal-packs.ts';
import type {Terrain} from '../sim/terrain.ts';
import {sidewalkGrid,splitWalkCap} from './sidewalks.ts';
import {MAPPED_PARKING} from './parking-surfaces.generated.ts';
import {parkingMaterial} from './parking-material.ts';
import type {World} from './world.ts';

type Q=readonly [number,number,number];
type Rings=readonly (readonly Q[])[];
type Box=readonly [number,number,number,number];
type Lot=readonly [kind:number,core:readonly Rings[],rim:readonly Rings[]];
type Point={x:number;z:number;u:number;v:number};
type Ground=(x:number,z:number)=>number;
export type ParkingTile={id:string;ox:number;oz:number;box:Box;lots:readonly Lot[]};
type Grounded={geometry:THREE.BufferGeometry;lift:Float32Array};
const TILE=MAPPED_PARKING.projectedTileMetres,RANGE=2920,MAX_TILES=42,LIMIT_ALT=945;
const meters=(q:number)=>q*.001;

export function decodeParkingSurfaces(data:ArrayBuffer):ParkingTile[]{
 const src=new DataView(data);
 if(src.byteLength<12||src.getUint32(0)!==0x504b4731||src.getUint16(4,true)!==1)
  throw Error('Unsupported parking surface atlas');
 const n=src.getUint16(6,true),expected=src.getUint32(8,true);
 if(!n||n>512||!expected||expected>2600)throw Error('Parking atlas allocation invalid');
 let at=12,points=0,pieces=0;
 const byte=()=>{
  if(at>=src.byteLength)throw Error('Truncated parking surface bytes');
  return src.getUint8(at++);
 };
 const code=()=>{
  let x=0;
  for(let k=0;k<=21;k+=7){const b=byte();x+=(b&127)*2**k;if(b<128)return x;}
  throw Error('Invalid parking coordinate encoding');
 };
 const coord=()=>{const v=code();return (v>>>1)^-(v&1);};
 const ids=new Set<string>();
 const mapped:ParkingTile[]=[];
 for(let m=0;m<n;m++){
  if(at+6>src.byteLength)throw Error('Truncated parking tile values');
  const tx=src.getInt16(at,true),tz=src.getInt16(at+2,true),cp=src.getUint16(at+4,true);at+=6;
  if(tx< -110||tx>105||tz< -85||tz>70||!cp||cp>180)throw Error('Parking tile outside bounds');
  const id=tx+','+tz,ox=(tx+.5)*TILE,oz=(tz+.5)*TILE;
  if(ids.has(id))throw Error('Duplicate parking tile');
  ids.add(id);
  let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
  const lots:Lot[]=[];
  for(let j=0;j<cp;j++){
   const style=byte(),parts:Rings[][]=[];
   if(style>6)throw Error('Invalid mapped parking material');
   for(let band=0;band<2;band++){
    const n=code(),polys:Rings[]=[];
    if(!n||n>80)throw Error('Invalid parking band');
    for(let k=0;k<n;k++){
     const p=code(),poly:Q[][]=[];
     if(!p||p>34)throw Error('Invalid parking polygon');
     for(let h=0;h<p;h++){
      const q=code(),ring:Q[]=[];
      if(q<3||q>1600)throw Error('Invalid parking ring');
      let x=0,z=0;
      for(let l=0;l<q;l++){
       x+=coord();z+=coord();const s=band?byte():255;
       if(Math.abs(x)>3100000||Math.abs(z)>3100000||++points>350000)
        throw Error('Parking atlas vertex limit');
       const [a,b]=[ox+meters(x),oz+meters(z)];
       minX=Math.min(a,minX);minZ=Math.min(b,minZ);maxX=Math.max(a,maxX);maxZ=Math.max(b,maxZ);
       ring.push([x,z,s]);
      }
      poly.push(ring);
     }
     polys.push(poly);
    }
    parts.push(polys);
   }
   if(++pieces>2600)throw Error('Parking atlas piece limit');
   lots.push([style,parts[0],parts[1]]);
  }
  mapped.push({id,ox,oz,box:[minX,minZ,maxX,maxZ],lots});
 }
 if(pieces!==expected||at!==src.byteLength)throw Error('Unexpected parking buffer length');
 return mapped;
}

export function loadParkingSurfaces(base:string,fetcher:typeof fetch=fetch,timeoutMs=6900){
 return readCoastalPack(base+MAPPED_PARKING.asset,fetcher,timeoutMs,MAPPED_PARKING,b=>{
  const a=decodeParkingSurfaces(b);
  if(a.length!==MAPPED_PARKING.tiles||a.reduce((s,t)=>s+t.lots.length,0)!==MAPPED_PARKING.pieces)
   throw Error('Unexpected parking atlas revision');
  return a;
 });
}

const projectedArea=(a:Point,b:Point,c:Point,ox:number,oz:number)=>{
 const x=Math.fround(a.x-ox),z=Math.fround(a.z-oz);
 const u=Math.fround(b.x-ox)-x,v=Math.fround(b.z-oz)-z;
 const s=Math.fround(c.x-ox)-x,t=Math.fround(c.z-oz)-z;
 return u*t-v*s;
};
export function parkingGeometry(tile:ParkingTile,terrain:Terrain,land:(x:number,z:number)=>boolean,blocked?:(b:Box)=>boolean):Grounded{
 const grid=sidewalkGrid(terrain),p:number[]=[],lift:number[]=[],kind:number[]=[];
 const emit=(v:Point,style:number)=>{
  p.push(v.x-tile.ox,0,v.z-tile.oz);kind.push(style,v.u);
  // 17–40 mm of decorative cap thickness only. Actual terrain contact remains unchanged.
  lift.push(.017+.023*v.u);
 };
 for(const [style,core,rim] of tile.lots){
  for(const group of [core,rim])for(const poly of group){
   const r=poly.map(ring=>ring.map(q=>new THREE.Vector2(meters(q[0]),meters(q[1]))));
   const xy=poly.flat();
   if(!xy.every(q=>land(tile.ox+meters(q[0]),tile.oz+meters(q[1]))))continue;
   if(blocked){
    let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
    for(const [w,l] of xy){const x=tile.ox+meters(w),z=tile.oz+meters(l);a=Math.min(a,x);b=Math.min(b,z);c=Math.max(c,x);d=Math.max(d,z);}
    if(blocked([a,b,c,d]))continue;
   }
   for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(r[0],r.slice(1))){
    const a=[xy[i],xy[j],xy[k]].map(([x,z,e]):Point=>({x:tile.ox+meters(x),z:tile.oz+meters(z),u:e/255,v:0}));
    for(const b of splitWalkCap(a,grid))for(let i=1;i<b.length-1;i++){
     const [p,q,w]=[b[0],b[i],b[i+1]],area=projectedArea(p,q,w,tile.ox,tile.oz);
     if(Math.abs(area)<1e-7)continue;
     emit(p,style);emit(area<0?q:w,style);emit(area<0?w:q,style);
    }
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));
 geometry.setAttribute('parkLayer',new THREE.Float32BufferAttribute(kind,2));
 return {geometry,lift:Float32Array.from(lift)};
}
export function seatParking(model:Grounded,tile:ParkingTile,ground:Ground){
 const p=model.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setY(i,ground(tile.ox+p.getX(i),tile.oz+p.getZ(i))+model.lift[i]);
 p.needsUpdate=true;model.geometry.computeVertexNormals();model.geometry.computeBoundingSphere();
}
function d(b:Box,x:number,z:number){return Math.hypot(Math.max(0,b[0]-x,x-b[2]),Math.max(0,b[1]-z,z-b[3]));}
type Live={data:ParkingTile;mesh:THREE.Mesh;model:Grounded;stamp:string};
export class ParkingSurfaces{
 private readonly group=new THREE.Group();
 private readonly active=new Map<string,Live>();
 private readonly sceneWorld:World;
 private readonly atlas:ParkingTile[];
 private readonly material:THREE.ShaderMaterial;
 private todo:ParkingTile[]=[];
 private oldX=Infinity;private oldZ=Infinity;private oldEpoch=-1;
 constructor(scene:THREE.Scene,w:World,atlas:ParkingTile[],preserveSceneAlpha=false){
  this.sceneWorld=w;this.atlas=atlas;
  this.material=parkingMaterial(w.sun,w.buildingShadows,preserveSceneAlpha);
  this.group.name='Mapped PEI parking surfaces';this.group.visible=false;
  scene.add(this.group);
 }
 update(x:number,z:number,agl:number){
  const w=this.sceneWorld,active=agl<LIMIT_ALT,was=this.group.visible;
  this.group.visible=active;if(!active)return;
  this.material.uniforms.parkAltitude.value=agl;
  if(!was||Math.hypot(x-this.oldX,z-this.oldZ)>85||this.oldEpoch!==w.visualGroundEpoch){
   this.oldX=x;this.oldZ=z;this.oldEpoch=w.visualGroundEpoch;
   const near=this.atlas.map(t=>({t,d:d(t.box,x,z)})).filter(a=>a.d<RANGE).sort((a,b)=>a.d-b.d).slice(0,MAX_TILES);
   const retain=new Set(near.map(a=>a.t.id));
   for(const [id,live] of this.active)if(!retain.has(id)){
    this.group.remove(live.mesh);live.model.geometry.dispose();this.active.delete(id);
   }else this.refit(live);
   this.todo=near.filter(a=>!this.active.has(a.t.id)).map(a=>a.t);
  }
  const data=this.todo.shift();
  if(!data)return;
  const s=w.terrain.inlandGrids;
  const blocked=s.length?(b:Box)=>s.some(g=>b[0]<g.x1&&b[2]>g.x0&&b[1]<g.z1&&b[3]>g.z0):undefined;
  const model=parkingGeometry(data,w.terrain,(x,z)=>w.cover.distance(w.terrain,x,z)>=.55,blocked);
  const mesh=new THREE.Mesh(model.geometry,this.material);
  mesh.position.set(data.ox,0,data.oz);mesh.name='Mapped parking tile '+data.id;
  const live={data,model,mesh,stamp:''};
  this.refit(live);this.group.add(mesh);this.active.set(data.id,live);
 }
 private refit(live:Live){
  const w=this.sceneWorld,stamp=w.visualGroundSignature(live.data.box);
  if(stamp===live.stamp)return;
  // A later irregular survey can change the tessellation across this
  // regular cut. Keep that patch's old substrate rather than suspend a cap.
  live.mesh.visible=!stamp.includes('*');
  if(live.mesh.visible)seatParking(live.model,live.data,(x,z)=>w.visualGroundHeight(x,z));
  live.stamp=stamp;
 }
 get state(){return {id:MAPPED_PARKING.id,tiles:this.active.size,pending:this.todo.length,visible:this.group.visible};}
}
