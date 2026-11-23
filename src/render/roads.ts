import * as THREE from 'three';
import {unpackGzip} from '../sim/compression.ts';
import {isConfederationBridge} from '../sim/confederation.ts';
import { project } from '../sim/geo.ts';
import {cutInlandRoad} from '../sim/inland-road.ts';
import type {CoastalGrid} from '../sim/coastal-terrain.ts';
import {addRoadSurface} from './road-surface.ts';
import type {BuildingShadows} from './local-building-shadows.ts';
import {NRN_DIRT_SOURCE_SHA256,NRN_DIRT_SOURCE_COUNT,NRN_DIRT_SOURCE_BITS} from './road-surface-type.generated.ts';
import type { Terrain } from '../sim/terrain.ts';

type Road = { flags: number; points: {x: number; z: number}[] };
const TILE = 5000;
const VIEW = 9500;
const HALF_WIDTH = [2.0, 2.8, 3.6, 4.8, 6.4];
const tarmac = new THREE.Color(0x5e5b52);
const gravel = new THREE.Color(0x9f7658);
const dirt = new THREE.Color(0x885d43);
const bridge = new THREE.Color(0x757777);

export function decodeRoads(data: ArrayBuffer): Road[] {
  const src = new DataView(data);
  if (src.byteLength < 10 || src.getUint32(0) !== 0x50454952 || src.getUint16(4) !== 1)
    throw new Error('Unsupported PEI road data format');
  const count = src.getUint32(6);
  if (count > 50000) throw new Error('Invalid PEI road segment count');
  const roads: Road[] = [];
  let i = 10;
  for (let j=0; j<count; j++) {
    if (i+3 > src.byteLength) throw new Error('Truncated PEI road block');
    const n = src.getUint16(i), flags = src.getUint8(i+2);
    i += 3;
    if (n < 2 || i + 8*n > src.byteLength || (flags & 7) > 4 || flags > 31)
      throw new Error('Invalid PEI road segment');
    const points: Road['points'] = [];
    for (let k=0; k<n; k++,i+=8) {
      const lon = src.getUint32(i)/100000 - 65, lat = src.getUint32(i+4)/100000 + 45;
      if(lon < -65 || lon > -61 || lat < 45 || lat > 48) throw new Error('PEI road extent invalid');
      points.push(project(lon,lat));
    }
    roads.push({flags, points});
  }
  if (i !== src.byteLength) throw new Error('Unexpected extra PEI road bytes');
  return roads;
}

// These ordinal flags are safe only for the packed geometry record that was
// replayed against the same official source. They never alter road geometry.
export async function classifiedDirt(data:ArrayBuffer,count:number){
 if(count!==NRN_DIRT_SOURCE_COUNT||!globalThis.crypto?.subtle)return;
 try{
  const r=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  if(Array.from(r,x=>x.toString(16).padStart(2,'0')).join('')!==NRN_DIRT_SOURCE_SHA256)return;
  const bits=atob(NRN_DIRT_SOURCE_BITS);
  if(bits.length!==Math.ceil(count/8))return;
  return bits;
 }catch{return;}
}
type Tile = {x: number; z: number; segments: number[]};
export class Roads {
  private readonly root = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.98, side: THREE.DoubleSide,
    alphaToCoverage: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  private readonly visible = new Map<string, THREE.Mesh>();
  private readonly madeVariants=new Map<string,Map<string,THREE.BufferGeometry>>();
  private readonly nearPatches?:()=>readonly CoastalGrid[];
  private lastPatchKey='';
  private lastX = Infinity;
  private lastZ = Infinity;

  private readonly tiles: Map<string, Tile>;
  private readonly terrain: Terrain;
  private constructor(scene: THREE.Scene, tiles: Map<string, Tile>, terrain: Terrain, casts?:BuildingShadows, nearPatches?:()=>readonly CoastalGrid[]) {
    this.tiles=tiles;this.terrain=terrain;this.nearPatches=nearPatches;
    this.root.name = 'PEI National Road Network';
    addRoadSurface(this.material,casts);
    scene.add(this.root);
  }

  static async create(scene: THREE.Scene, terrain: Terrain, casts?:BuildingShadows, nearPatches?:()=>readonly CoastalGrid[]) {
    const response = await fetch(`${import.meta.env.BASE_URL}world/roads.bin.gz`);
    if (!response.ok || !response.body) throw new Error(`Road data request failed: ${response.status}`);
    const data = await unpackGzip(await response.arrayBuffer());
    const tiles = new Map<string, Tile>();
    const roads=decodeRoads(data),dirtBits=await classifiedDirt(data,roads.length);
    for (let ordinal=0;ordinal<roads.length;ordinal++) {
      const {points,flags:sourceFlags}=roads[ordinal];
      const isDirt=!!dirtBits&&!(sourceFlags&24)&&!!(dirtBits.charCodeAt(ordinal>>3)&(1<<(ordinal&7)));
      const flags=isDirt?sourceFlags|32:sourceFlags;
      for(let i=1; i<points.length; i++) {
        const a=points[i-1], b=points[i], dx=b.x-a.x, dz=b.z-a.z;
        const len=Math.hypot(dx,dz);
        if (len<0.05) continue;
        // Long chords are split first, so their whole extent isn't assigned to a remote tile.
        const n=Math.ceil(len/500);
        for(let j=0; j<n; j++) {
          const p=j/n, q=(j+1)/n, x=a.x+p*dx, z=a.z+p*dz, u=a.x+q*dx, v=a.z+q*dz;
          const tx=Math.floor((x+u)/2/TILE), tz=Math.floor((z+v)/2/TILE), key=`${tx},${tz}`;
          let tile=tiles.get(key);
          if(!tile) {
            tile={x:(tx+0.5)*TILE,z:(tz+0.5)*TILE,segments:[]};
            tiles.set(key,tile);
          }
          tile.segments.push(x,z,u,v,flags);
        }
      }
    }
    return new Roads(scene,tiles,terrain,casts,nearPatches);
  }

  private mesh(tile: Tile,patches:readonly CoastalGrid[] = []) {
    const pos:number[]=[], colors:number[]=[], surface:number[]=[];
    const baselineHeight=this.terrain.inlandGrids.length
      ?(x:number,z:number)=>this.terrain.coastalGrids.find(g=>g.near(x,z))?.height(x,z)??this.terrain.atlasElevation(x,z)
      :(x:number,z:number)=>this.terrain.meshElevation(x,z);
    for(let i=0;i<tile.segments.length;i+=5){
      const [x0,z0,x1,z1,flags]=tile.segments.slice(i,i+5);
      const dx=x1-x0, dz=z1-z0, len=Math.hypot(dx,dz), width=HALF_WIDTH[flags&7];
      const rx=dz*width/len, rz=-dx*width/len, n=Math.ceil(len/28);
      const isBridge=!!(flags&16), color=isBridge?bridge:(flags&8)?tarmac:(flags&32)?dirt:gravel;
      for(let k=0;k<n;k++){
        const p=k/n,q=(k+1)/n,x=x0+p*dx,z=z0+p*dz,u=x0+q*dx,v=z0+q*dz;
        const mx=(x+u)/2,mz=(z+v)/2;
        if(isBridge ? isConfederationBridge(mx,mz) : !this.terrain.isLand(mx,mz))continue;
        const lift=isBridge?3:0.55;
        const py=baselineHeight(x,z)+lift, qy=baselineHeight(u,v)+lift;
        const kind=isBridge?127:(flags&8)?64:(flags&32)?-64:0;
        const cuts=!isBridge&&patches.length?cutInlandRoad([
          {x:x+rx,z:z+rz,y:py,edge:127},{x:x-rx,z:z-rz,y:py,edge:-127},
          {x:u-rx,z:v-rz,y:qy,edge:-127},{x:u+rx,z:v+rz,y:qy,edge:127} ],patches):undefined;
        if(cuts){
         for(const v of cuts){pos.push(v.x-tile.x,v.y,v.z-tile.z);colors.push(color.r,color.g,color.b);surface.push(Math.round(v.edge),kind);}
         continue;
        }
        const lx=x-tile.x,lz=z-tile.z,lu=u-tile.x,lv=v-tile.z;
        pos.push(
          lx+rx,py,lz+rz, lx-rx,py,lz-rz, lu+rx,qy,lv+rz,
          lu+rx,qy,lv+rz, lx-rx,py,lz-rz, lu-rx,qy,lv-rz,
        );
        for(let k=0;k<6;k++){
          colors.push(color.r,color.g,color.b);
          surface.push(k===1||k===4||k===5?-127:127,kind);
        }
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setAttribute('roadSurface',new THREE.Int8BufferAttribute(surface,2,true));
    g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,this.material);
    mesh.position.set(tile.x,0,tile.z);
    return mesh;
  }

  update(x: number, z: number) {
    const shown=this.nearPatches?.(),patchKey=shown?.map(g=>g.spec.id).join(',')??'';
    const moved=Math.hypot(x-this.lastX,z-this.lastZ)>=420;
    if(!moved&&patchKey===this.lastPatchKey)return;
    if(!moved){x=this.lastX;z=this.lastZ;}else{this.lastX=x;this.lastZ=z;}
    this.lastPatchKey=patchKey;
    const minX=Math.floor((x-VIEW)/TILE), maxX=Math.floor((x+VIEW)/TILE);
    const minZ=Math.floor((z-VIEW)/TILE), maxZ=Math.floor((z+VIEW)/TILE);
    const keep=new Set<string>();
    for(let tz=minZ;tz<=maxZ;tz++) for(let tx=minX;tx<=maxX;tx++) {
      const key=`${tx},${tz}`, t=this.tiles.get(key);
      if(!t) continue;
      keep.add(key);
      const bound=TILE*.5+265; // split half-length plus road width
      const candidates=shown?.filter(q=>q.x1>t.x-bound&&q.x0<t.x+bound&&q.z1>t.z-bound&&q.z0<t.z+bound)??[];
      const mode=candidates.map(g=>g.spec.id).join(',');
      const current=this.visible.get(key);
      if(current&&current.userData.inlandMode===mode)continue;
      if(!this.nearPatches){
        const mesh=this.mesh(t);mesh.userData.inlandMode='';
        this.root.add(mesh);this.visible.set(key,mesh);continue;
      }
      // Keep both possible meshes for these few local tiles while visible;
      // when the tile streams out both cached buffers are freed.
      const variants=this.madeVariants.get(key)??new Map<string,THREE.BufferGeometry>();
      this.madeVariants.set(key,variants);
      let cached=variants.get(mode);
      if(current){
        if(!cached){cached=this.mesh(t,candidates).geometry;variants.set(mode,cached);}
        current.geometry=cached;current.userData.inlandMode=mode;
      }else{
        const mesh=this.mesh(t,candidates);
        variants.set(mode,mesh.geometry);mesh.userData.inlandMode=mode;
        this.root.add(mesh);this.visible.set(key,mesh);
      }
    }
    for(const [key,mesh] of this.visible) {
      if(keep.has(key)) continue;
      this.root.remove(mesh);
      for(const g of this.madeVariants.get(key)?.values()??[mesh.geometry])g.dispose();
      this.madeVariants.delete(key);
      this.visible.delete(key);
    }
  }
}
