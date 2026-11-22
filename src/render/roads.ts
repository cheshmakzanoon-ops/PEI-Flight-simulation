import * as THREE from 'three';
import {unpackGzip} from '../sim/compression.ts';
import { project } from '../sim/geo.ts';
import type { Terrain } from '../sim/terrain.ts';

type Road = { flags: number; points: {x: number; z: number}[] };
const TILE = 5000;
const VIEW = 9500;
const HALF_WIDTH = [2.0, 2.8, 3.6, 4.8, 6.4];
const tarmac = new THREE.Color(0x5e5b52);
const gravel = new THREE.Color(0x9f7658);
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

type Tile = {x: number; z: number; segments: number[]};
export class Roads {
  private readonly root = new THREE.Group();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.98, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  private readonly visible = new Map<string, THREE.Mesh>();
  private lastX = Infinity;
  private lastZ = Infinity;

  private constructor(scene: THREE.Scene, private readonly tiles: Map<string, Tile>, private readonly terrain: Terrain) {
    this.root.name = 'PEI National Road Network';
    scene.add(this.root);
  }

  static async create(scene: THREE.Scene, terrain: Terrain) {
    const response = await fetch(`${import.meta.env.BASE_URL}world/roads.bin.gz`);
    if (!response.ok || !response.body) throw new Error(`Road data request failed: ${response.status}`);
    const data = await unpackGzip(await response.arrayBuffer());
    const tiles = new Map<string, Tile>();
    for (const {points, flags} of decodeRoads(data)) {
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
    return new Roads(scene,tiles,terrain);
  }

  private mesh(tile: Tile) {
    const pos:number[]=[], colors:number[]=[];
    for(let i=0;i<tile.segments.length;i+=5){
      const [x0,z0,x1,z1,flags]=tile.segments.slice(i,i+5);
      const dx=x1-x0, dz=z1-z0, len=Math.hypot(dx,dz), width=HALF_WIDTH[flags&7];
      const rx=dz*width/len, rz=-dx*width/len, n=Math.ceil(len/28);
      const isBridge=!!(flags&16), color=isBridge?bridge:(flags&8)?tarmac:gravel;
      for(let k=0;k<n;k++){
        const p=k/n,q=(k+1)/n,x=x0+p*dx,z=z0+p*dz,u=x0+q*dx,v=z0+q*dz;
        if(!isBridge&&!this.terrain.isLand((x+u)/2,(z+v)/2))continue;
        const lift=isBridge?3:0.55;
        const py=this.terrain.meshElevation(x,z)+lift, qy=this.terrain.meshElevation(u,v)+lift;
        const lx=x-tile.x,lz=z-tile.z,lu=u-tile.x,lv=v-tile.z;
        pos.push(
          lx+rx,py,lz+rz, lx-rx,py,lz-rz, lu+rx,qy,lv+rz,
          lu+rx,qy,lv+rz, lx-rx,py,lz-rz, lu-rx,qy,lv-rz,
        );
        for(let k=0;k<6;k++)colors.push(color.r,color.g,color.b);
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,this.material);
    mesh.position.set(tile.x,0,tile.z);
    return mesh;
  }

  update(x: number, z: number) {
    if (Math.hypot(x-this.lastX,z-this.lastZ) < 420) return;
    this.lastX=x;
    this.lastZ=z;
    const minX=Math.floor((x-VIEW)/TILE), maxX=Math.floor((x+VIEW)/TILE);
    const minZ=Math.floor((z-VIEW)/TILE), maxZ=Math.floor((z+VIEW)/TILE);
    const keep=new Set<string>();
    for(let tz=minZ;tz<=maxZ;tz++) for(let tx=minX;tx<=maxX;tx++) {
      const key=`${tx},${tz}`, t=this.tiles.get(key);
      if(!t) continue;
      keep.add(key);
      if(this.visible.has(key)) continue;
      const mesh=this.mesh(t);
      this.root.add(mesh);
      this.visible.set(key,mesh);
    }
    for(const [key,mesh] of this.visible) {
      if(keep.has(key)) continue;
      this.root.remove(mesh);
      mesh.geometry.dispose();
      this.visible.delete(key);
    }
  }
}
