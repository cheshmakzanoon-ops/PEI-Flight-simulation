import * as THREE from 'three';
import {buildBaywalkRoad,type BaywalkRoad,type RoadPoint} from './baywalk-road.ts';
import {BAYWALK_ROAD_SHA,BAYWALK_ROAD_ORDINAL,BAYWALK_ROAD_FLAGS} from '../sim/baywalk-native.ts';
import {unpackGzip} from '../sim/compression.ts';
import {isConfederationBridge} from '../sim/confederation.ts';
import { project } from '../sim/geo.ts';
import {cutInlandRoad} from '../sim/inland-road.ts';
import type {CoastalGrid} from '../sim/coastal-terrain.ts';
import {RoadFloatChunks,normalizeRoadTriangles,expandRoadBounds} from './road-buffer-slices.ts';
import {advanceRoadBuild,ROAD_BUILD_SLICE_MS} from './road-build-budget.ts';
import {roadContactAt,seatRibbon} from './road-contact.ts';
import {sidewalkGrid} from './sidewalks.ts';
import type {World} from './world.ts';
import {RoadPavement} from './road-pavement.ts';
import {applyGravelPilot,classifiedGravel,gravelAuthority,GRAVEL_INTERNAL_FLAG,GRAVEL_KIND,type GravelPilot} from './aggregate.ts';
import {GRAVEL_DRAW_RANGE,nearestRegisteredGravel,type GravelEye,type GravelSeatGuard} from './aggregate-admission.ts';
import {matchesVictoriaPaving,VICTORIA_PAVER_FLAG,VICTORIA_PAVER_KIND} from './victoria-pavers.ts';
import type {NorthCapeShadow} from './north-cape-shadow.ts';
import {addRoadSurface} from './road-surface.ts';
import type {BuildingShadows} from './local-building-shadows.ts';
import {NRN_DIRT_SOURCE_SHA256,NRN_DIRT_SOURCE_COUNT,NRN_DIRT_SOURCE_BITS} from './road-surface-type.generated.ts';
import type { Terrain } from '../sim/terrain.ts';
import {buildMontagueBridge} from './montague-bridge.ts';
import {MONTAGUE_CUTS,MONTAGUE_GROUND_ID,montagueBridgeRows} from '../sim/montague-bridge.ts';

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
async function roadHash(data:ArrayBuffer){
 if(!globalThis.crypto?.subtle)return;
 try{const r=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  return Array.from(r,x=>x.toString(16).padStart(2,'0')).join('');
 }catch{return;}
}
export async function classifiedDirt(data:ArrayBuffer,count:number,verifiedDigest?:string){
 if(count!==NRN_DIRT_SOURCE_COUNT)return;
 try{
  if((verifiedDigest??await roadHash(data))!==NRN_DIRT_SOURCE_SHA256)return;
  const bits=atob(NRN_DIRT_SOURCE_BITS);
  if(bits.length!==Math.ceil(count/8))return;
  return bits;
 }catch{return;}
}
type PackedRoadNetwork={data:ArrayBuffer;roads:Road[];digest?:string;montagueVerified:boolean};
async function roadNetwork(signal?:AbortSignal):Promise<PackedRoadNetwork>{
 const response=await fetch(`${import.meta.env.BASE_URL}world/roads.bin.gz`,{signal});
 if(!response.ok||!response.body)throw new Error(`Road data request failed: ${response.status}`);
 const data=await unpackGzip(await response.arrayBuffer());
 const roads=decodeRoads(data),digest=await roadHash(data);
 return {data,roads,digest,montagueVerified:montagueBridgeRows(digest,roads)};
}
type Tile = {x: number; z: number; segments: number[]; victoria?:boolean; gravel?:boolean};
export class Roads {
  private readonly root = new THREE.Group();
  private readonly pavement=new RoadPavement(import.meta.env?.BASE_URL??"/");
  /** Original local mesh identity only; no editing the province-wide shared road material. */
  basilicaSunRoad(ours?:THREE.Material){
   const t=this.tiles.get('1,5'),m=this.visible.get('1,5');
   if(this.sourceGeometrySha256!=='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1'||
      !t||!m||!m.visible||!this.root.visible||m.parent!==this.root)return;
   const base=this.tileMaterial(t);if((m.material!==base&&m.material!==ours)||
    base.customProgramCacheKey()!=='pei-road-surface-v3-pavement-victoria|mapped-aggregate-b1')return;
   return {mesh:m,base:base as THREE.Material};
  }
  get pavementStatus(){return this.pavement.state;}
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.98, side: THREE.DoubleSide,
    alphaToCoverage: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  private readonly victoriaMaterial?:THREE.MeshStandardMaterial;
  private readonly capeMaterial?:THREE.MeshStandardMaterial;
  private readonly cape?:NorthCapeShadow;
  readonly verifiedGravelSource:boolean;
  private tileMaterial(t:Tile){
   if(t.victoria&&this.victoriaMaterial)return this.victoriaMaterial;
   const half=TILE*.5+130;
   return this.cape?.intersects(t.x-half,t.z-half,t.x+half,t.z+half)?this.capeMaterial!:this.material;
  }
  private readonly visible = new Map<string, THREE.Mesh>();
  private readonly madeVariants=new Map<string,Map<string,THREE.BufferGeometry>>();
  private readonly previewBridge?:THREE.Group;
  private readonly previewOwners:readonly string[];
  private readonly baywalkRoad?:BaywalkRoad;private readonly baywalkOwners:readonly string[];
  get baywalkRoadActive(){return !!this.baywalkRoad;}
  get bridgePreviewActive(){return !!this.previewBridge;}
  private readonly nearPatches?:()=>readonly CoastalGrid[];
  private readonly seated?:World;
  private readonly seat?:ReturnType<typeof roadContactAt>;
  private readonly seatGain={value:0};
  private previousSeat='';
  private pendingSeat=false;
  private seatBuild?:{key:string;mode:string;generator:Generator<void,THREE.Mesh>};
  private lastSliceMS=0;
  private lastBuildSteps=0;
  private seatedAt=Infinity;
  get seatState(){return this.seat?{pending:this.pendingSeat,gain:this.seatGain.value,lastSliceMS:this.lastSliceMS,lastBuildSteps:this.lastBuildSteps,
    ready:Array.from(this.visible.values()).filter(q=>String(q.userData.inlandMode).includes('|seat:')).length}:null;}

  private lastPatchKey='';
  private lastX = Infinity;
  private lastZ = Infinity;

  private readonly tiles: Map<string, Tile>;
  private readonly terrain: Terrain;
  readonly sourceGeometrySha256?:string;
  private constructor(scene: THREE.Scene, tiles: Map<string, Tile>, terrain: Terrain, casts?:BuildingShadows, nearPatches?:()=>readonly CoastalGrid[], digest?:string, seated?:World, bridge?:World,previewOwners:readonly string[]=[],court?:{world:World;points:readonly RoadPoint[];owners:string[]},cape?:NorthCapeShadow,gravelPilot?:GravelPilot,verifiedGravel=false) {
    this.verifiedGravelSource=verifiedGravel;
    this.tiles=tiles;this.terrain=terrain;this.previewOwners=previewOwners;this.nearPatches=nearPatches;this.sourceGeometrySha256=digest;
    this.root.name = 'PEI National Road Network';
    this.baywalkOwners=court?.owners??[];
    if(court){
     this.baywalkRoad=buildBaywalkRoad(court.points,court.world,this.material,tarmac);
     if(this.baywalkRoad)this.root.add(this.baywalkRoad.mesh);
    }
    this.seated=seated;this.seat=seated?roadContactAt(seated):undefined;
    addRoadSurface(this.material,casts,this.pavement,this.seat?this.seatGain:undefined);
    if(gravelPilot)applyGravelPilot(this.material,gravelPilot);
    this.cape=cape;
    if(cape){
     this.capeMaterial=this.material.clone();
     addRoadSurface(this.capeMaterial,casts,this.pavement,this.seat?this.seatGain:undefined,false,cape);
     if(gravelPilot)applyGravelPilot(this.capeMaterial,gravelPilot);
    }
    if(Array.from(tiles.values()).some(t=>t.victoria)){
      this.victoriaMaterial=this.material.clone();
      addRoadSurface(this.victoriaMaterial,casts,this.pavement,this.seat?this.seatGain:undefined,true);
      if(gravelPilot)applyGravelPilot(this.victoriaMaterial,gravelPilot);
    }
    if(bridge){
     const h=terrain.inlandGrids.length
       ?(x:number,z:number)=>terrain.coastalGrids.find(g=>g.near(x,z))?.height(x,z)??terrain.atlasElevation(x,z)
       :(x:number,z:number)=>terrain.meshElevation(x,z);
     this.previewBridge=buildMontagueBridge(this.material,h,(x,z)=>bridge.cover.distance(terrain,x,z));
     this.root.add(this.previewBridge);
    }
    scene.add(this.root);
  }

  /** Optional preflight only: no water or terrain preview when the
   * corresponding full road replacement cannot be registered. A complete
   * but changed road asset remains usable by the ordinary ribbon layer. */
  static async prepareMontague(){
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),2300);
   try{return await roadNetwork(ctrl.signal);}
   catch{return undefined;}
   finally{clearTimeout(timer);}
  }

  static async create(scene: THREE.Scene, terrain: Terrain, casts?:BuildingShadows, nearPatches?:()=>readonly CoastalGrid[], seated?:World,preview?:World,prepared?:PackedRoadNetwork,cape?:NorthCapeShadow,gravelPilot?:GravelPilot) {
    const {data,roads,digest,montagueVerified}=prepared??await roadNetwork();
    const tiles = new Map<string, Tile>(),dirtBits=digest?await classifiedDirt(data,roads.length,digest):undefined;
    const gravelBits=gravelPilot&&gravelAuthority(roads.length,digest);
    const register=!!preview?.cover.montague&&terrain.coastalSurveys.includes(MONTAGUE_GROUND_ID)&&montagueVerified;
    const owners=new Set<string>(),courtOwners=new Set<string>();
    const courtRow=preview?.baywalkActive&&digest===BAYWALK_ROAD_SHA&&roads[BAYWALK_ROAD_ORDINAL]?.flags===BAYWALK_ROAD_FLAGS
      ?roads[BAYWALK_ROAD_ORDINAL].points:undefined;
    for (let ordinal=0;ordinal<roads.length;ordinal++) {
      const omit=register&&(MONTAGUE_CUTS as readonly number[]).includes(ordinal);
      const {points,flags:sourceFlags}=roads[ordinal];
      const isDirt=!!dirtBits&&!(sourceFlags&24)&&!!(dirtBits.charCodeAt(ordinal>>3)&(1<<(ordinal&7)));
      const victoria=matchesVictoriaPaving(digest,ordinal,sourceFlags,points);
      const flags=victoria?sourceFlags|VICTORIA_PAVER_FLAG:isDirt?sourceFlags|32:
        classifiedGravel(gravelBits,ordinal,sourceFlags)?sourceFlags|GRAVEL_INTERNAL_FLAG:sourceFlags;
      for(let i=1; i<points.length; i++) {
        const a=points[i-1], b=points[i], dx=b.x-a.x, dz=b.z-a.z;
        const len=Math.hypot(dx,dz);
        if (len<0.05) continue;
        // Long chords are split first, so their whole extent isn't assigned to a remote tile.
        const n=Math.ceil(len/500);
        for(let j=0; j<n; j++) {
          const p=j/n, q=(j+1)/n, x=a.x+p*dx, z=a.z+p*dz, u=a.x+q*dx, v=a.z+q*dz;
          const tx=Math.floor((x+u)/2/TILE), tz=Math.floor((z+v)/2/TILE), key=`${tx},${tz}`;
          if(omit){owners.add(key);continue;}
          if(courtRow&&ordinal===BAYWALK_ROAD_ORDINAL&&(i===2||i===3)){courtOwners.add(key);continue;}
          let tile=tiles.get(key);
          if(!tile) {
            tile={x:(tx+0.5)*TILE,z:(tz+0.5)*TILE,segments:[]};
            tiles.set(key,tile);
          }
          if(victoria)tile.victoria=true;
          if(flags&GRAVEL_INTERNAL_FLAG)tile.gravel=true;
          tile.segments.push(x,z,u,v,flags);
        }
      }
    }
    return new Roads(scene,tiles,terrain,casts,nearPatches,digest,seated,register?preview:undefined,Array.from(owners),
     courtRow&&preview?{world:preview,points:courtRow,owners:Array.from(courtOwners)}:undefined,cape,gravelPilot,!!gravelBits);
  }

  private mesh(tile:Tile,patches:readonly CoastalGrid[]=[],seated=false){
    const task=this.meshSteps(tile,patches,seated,false);
    const next=task.next();
    if(!next.done)throw Error('Unbudgeted road mesh must finish synchronously');
    return next.value;
  }
  private *meshSteps(tile:Tile,patches:readonly CoastalGrid[],seated:boolean,cooperate:boolean):Generator<void,THREE.Mesh>{
    const pos:RoadFloatChunks|number[]=cooperate?new RoadFloatChunks():[],colors:RoadFloatChunks|number[]=cooperate?new RoadFloatChunks():[],
      surface:RoadFloatChunks|number[]=cooperate?new RoadFloatChunks(v=>v/127):[],seatDelta:RoadFloatChunks|number[]=cooperate?new RoadFloatChunks():[];
    const layout=seated?sidewalkGrid(this.terrain):null;
    const baselineHeight=this.terrain.inlandGrids.length
      ?(x:number,z:number)=>this.terrain.coastalGrids.find(g=>g.near(x,z))?.height(x,z)??this.terrain.atlasElevation(x,z)
      :(x:number,z:number)=>this.terrain.meshElevation(x,z);
    for(let i=0;i<tile.segments.length;i+=5){
      if(cooperate&&i)yield;
      const [x0,z0,x1,z1,flags]=tile.segments.slice(i,i+5);
      const dx=x1-x0, dz=z1-z0, len=Math.hypot(dx,dz), width=HALF_WIDTH[flags&7];
      const rx=dz*width/len, rz=-dx*width/len, n=Math.ceil(len/28);
      const isBridge=!!(flags&16), color=isBridge?bridge:(flags&8)?tarmac:(flags&32)?dirt:gravel;
      for(let k=0;k<n;k++){
        if(cooperate&&k>0&&(k&3)===0)yield;
        const p=k/n,q=(k+1)/n,x=x0+p*dx,z=z0+p*dz,u=x0+q*dx,v=z0+q*dz;
        const mx=(x+u)/2,mz=(z+v)/2;
        if(isBridge ? isConfederationBridge(mx,mz) : !this.terrain.isLand(mx,mz))continue;
        const lift=isBridge?3:0.55;
        const py=baselineHeight(x,z)+lift, qy=baselineHeight(u,v)+lift;
        const kind=isBridge?127:(flags&VICTORIA_PAVER_FLAG)?VICTORIA_PAVER_KIND:(flags&8)?64:(flags&32)?-64:(flags&GRAVEL_INTERNAL_FLAG)?GRAVEL_KIND:0;
        const cuts=!isBridge&&patches.length?cutInlandRoad([
          {x:x+rx,z:z+rz,y:py,edge:127},{x:x-rx,z:z-rz,y:py,edge:-127},
          {x:u-rx,z:v-rz,y:qy,edge:-127},{x:u+rx,z:v+rz,y:qy,edge:127} ],patches):undefined;
        if(cuts){
         for(const v of cuts){pos.push(v.x-tile.x,v.y,v.z-tile.z);colors.push(color.r,color.g,color.b);surface.push(Math.round(v.edge),kind);if(this.seat)seatDelta.push(0);}
         continue;
        }
        if(layout&&this.seat&&!isBridge){
         const a={x:x+rx,z:z+rz,u:127,v:py},b={x:x-rx,z:z-rz,u:-127,v:py},
          c={x:u+rx,z:v+rz,u:127,v:qy},d={x:u-rx,z:v-rz,u:-127,v:qy};
         const pending:{x:number;z:number;q:typeof a;offset:number}[]=[];
         const emit=(q:typeof a,offset:number)=>{
          pending.push({x:Math.fround(q.x-tile.x),z:Math.fround(q.z-tile.z),q,offset});
          if(pending.length<3)return;
          const [a,b,c]=pending;
          const signed=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
          // Near-collinear clipped wedges can collapse in the final GPU
          // Float32 lattice. Do not submit zero-area faces or flipped normals.
          if(signed!==0)for(const v of (signed>0?[a,c,b]:pending)){
           pos.push(v.x,v.q.v,v.z);colors.push(color.r,color.g,color.b);
           surface.push(v.q.u,kind);seatDelta.push(v.offset);
          }
          pending.length=0;
         };
         seatRibbon([a,b,c],layout,this.seat,emit);seatRibbon([c,b,d],layout,this.seat,emit);
         continue;
        }
        const lx=x-tile.x,lz=z-tile.z,lu=u-tile.x,lv=v-tile.z;
        pos.push(
          lx+rx,py,lz+rz, lx-rx,py,lz-rz, lu+rx,qy,lv+rz,
          lu+rx,qy,lv+rz, lx-rx,py,lz-rz, lu-rx,qy,lv-rz,
        );
        for(let k=0;k<6;k++){
          colors.push(color.r,color.g,color.b);
          surface.push(k===1||k===4||k===5?-127:127,kind);if(this.seat)seatDelta.push(0);
        }
      }
    }
    if(cooperate)yield;
    const g=new THREE.BufferGeometry();
    if(pos instanceof RoadFloatChunks&&colors instanceof RoadFloatChunks&&surface instanceof RoadFloatChunks&&seatDelta instanceof RoadFloatChunks){
     g.setAttribute('position',new THREE.BufferAttribute(yield* pos.finish(),3));yield;
     g.setAttribute('color',new THREE.BufferAttribute(yield* colors.finish(),3));yield;
     g.setAttribute('roadSurface',new THREE.BufferAttribute(yield* surface.finish(),2));yield;
     yield* normalizeRoadTriangles(g);yield;
     const delta=yield* seatDelta.finish();
     g.setAttribute('roadSeatDelta',new THREE.BufferAttribute(delta,1));yield;
     yield* expandRoadBounds(g,delta);
    }else{
     g.setAttribute('position',new THREE.Float32BufferAttribute(pos as number[],3));
     g.setAttribute('color',new THREE.Float32BufferAttribute(colors as number[],3));
     const packed=surface as number[];
     g.setAttribute('roadSurface',seated?new THREE.Float32BufferAttribute(packed.map(v=>v/127),2):new THREE.Int8BufferAttribute(packed,2,true));
     g.computeVertexNormals();
     if(this.seat){
      const delta=new Float32Array(seatDelta as number[]);
      let maxDrop=0;
      for(const amount of delta)maxDrop=Math.max(maxDrop,Math.abs(amount));
      g.setAttribute('roadSeatDelta',new THREE.BufferAttribute(delta,1));
      g.computeBoundingSphere();if(g.boundingSphere)g.boundingSphere.radius+=maxDrop;
     }
    }
    const mesh=new THREE.Mesh(g,this.tileMaterial(tile));
    mesh.position.set(tile.x,0,tile.z);
    return mesh;
  }

  /** True scene-space slant admission from the same submitted triangle buffers.
   * Owner centres are 5 km apart; an accepted chord spans at most 500 m plus
   * 6.4 m nominal half width, entirely within the 260 m owner apron. */
  nearestGravel(eye:GravelEye,radius:number,dry:GravelSeatGuard){
   if(!this.verifiedGravelSource||!(radius>0&&radius<=GRAVEL_DRAW_RANGE)||
      !Number.isFinite(eye.x)||!Number.isFinite(eye.y)||!Number.isFinite(eye.z))return Infinity;
   const apron=TILE*.5+260;
   let best=radius*radius,found=false;
   for(const [key,mesh] of this.visible){
    const tile=this.tiles.get(key);
    if(!mesh.visible||!tile?.gravel)continue;
    const dx=Math.max(0,Math.abs(tile.x-eye.x)-apron),dz=Math.max(0,Math.abs(tile.z-eye.z)-apron);
    if(dx*dx+dz*dz>=best)continue;
    const hit=nearestRegisteredGravel(mesh.geometry,tile.x,tile.z,eye,best,this.seatGain.value,dry);
    if(hit<best){best=hit;found=true;}
   }
   return found?Math.sqrt(best):Infinity;
  }

  update(x: number, z: number, agl=Infinity) {
    this.pavement.update(agl);this.baywalkRoad?.sync();
    const time=performance.now(),h=THREE.MathUtils.clamp((194-agl)/82,0,1);
    if(this.seat&&(agl>=209||Math.hypot(x-this.lastX,z-this.lastZ)>1600))this.seatedAt=Infinity;
    const fade=THREE.MathUtils.clamp((time-this.seatedAt)/725,0,1);
    this.seatGain.value=h*h*(3-2*h)*fade*fade*(3-2*fade);
    const nearby:{id:string;d:number}[]=[];
    if(this.seated&&agl<209){
     const i=Math.floor(x/TILE),j=Math.floor(z/TILE);
     for(let z0=j-2;z0<=j+2;z0++)for(let x0=i-2;x0<=i+2;x0++){
      const id=x0+','+z0,t=this.tiles.get(id);if(!t)continue;
      const d=Math.hypot(t.x-x,t.z-z);if(d<6100)nearby.push({id,d});
     }
    }
    const wanted=nearby.sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).slice(0,4).map(t=>t.id);
    const seatKey=wanted.join(';');
    const budgetStart=performance.now(),deadline=budgetStart+ROAD_BUILD_SLICE_MS;
    this.lastSliceMS=0;this.lastBuildSteps=0;
    if(this.seatBuild&&!wanted.includes(this.seatBuild.key)){
     this.seatBuild.generator.return(undefined!);this.seatBuild=undefined;
    }
    const shown=this.nearPatches?.(),patchKey=shown?.map(g=>g.spec.id).join(',')??'';
    const moved=Math.hypot(x-this.lastX,z-this.lastZ)>=420;
    if(!moved&&patchKey===this.lastPatchKey&&seatKey===this.previousSeat&&!this.pendingSeat)return;
    if(!moved){x=this.lastX;z=this.lastZ;}else{this.lastX=x;this.lastZ=z;}
    this.lastPatchKey=patchKey;this.previousSeat=seatKey;this.pendingSeat=false;
    const minX=Math.floor((x-VIEW)/TILE), maxX=Math.floor((x+VIEW)/TILE);
    const minZ=Math.floor((z-VIEW)/TILE), maxZ=Math.floor((z+VIEW)/TILE);
    if(this.previewBridge){
     // Exactly the stock road batch's square, tile padding and 420m
     // position reuse. Omitting the three old rows cannot reveal a gap.
     this.previewBridge.visible=this.previewOwners.some(owner=>{
      const [i,j]=owner.split(',').map(Number);
      return i>=minX&&i<=maxX&&j>=minZ&&j<=maxZ;
     });
    }
    if(this.baywalkRoad)this.baywalkRoad.mesh.visible=this.baywalkOwners.some(owner=>{
     const [i,j]=owner.split(',').map(Number);return i>=minX&&i<=maxX&&j>=minZ&&j<=maxZ;
    });
    const keep=new Set<string>();
    for(let tz=minZ;tz<=maxZ;tz++) for(let tx=minX;tx<=maxX;tx++) {
      const key=`${tx},${tz}`, t=this.tiles.get(key);
      if(!t) continue;
      keep.add(key);
      const bound=TILE*.5+265; // split half-length plus road width
      const candidates=shown?.filter(q=>q.x1>t.x-bound&&q.x0<t.x+bound&&q.z1>t.z-bound&&q.z0<t.z+bound)??[];
      const base=candidates.map(g=>g.spec.id).join(',');
      const opted=wanted.includes(key);
      let mode=opted?base+'|seat:regular112':base;
      const current=this.visible.get(key);
      if(current&&current.userData.inlandMode===mode)continue;
      if(!this.nearPatches&&!this.seat){
        const mesh=this.mesh(t);mesh.userData.inlandMode='';
        this.root.add(mesh);this.visible.set(key,mesh);continue;
      }
      // Keep both possible meshes for these few local tiles while visible;
      // when the tile streams out both cached buffers are freed.
      const variants=this.madeVariants.get(key)??new Map<string,THREE.BufferGeometry>();
      this.madeVariants.set(key,variants);
      let cached=variants.get(mode);
      if(opted&&!cached){
       if(this.seatBuild?.key===key&&this.seatBuild.mode!==mode){
        this.seatBuild.generator.return(undefined!);this.seatBuild=undefined;
       }
       if(!this.seatBuild)this.seatBuild={key,mode,generator:this.meshSteps(t,candidates,true,true)};
       if(this.seatBuild.key===key){
        const at=performance.now(),result=advanceRoadBuild(this.seatBuild.generator,deadline);
        this.lastBuildSteps+=result.steps;this.lastSliceMS+=performance.now()-at;
        if(result.done){cached=result.value.geometry;variants.set(mode,cached);this.seatBuild=undefined;}
       }
       if(!cached){this.pendingSeat=true;mode=base;cached=variants.get(base);}
      }
      if(current&&current.userData.inlandMode===mode)continue;
      if(!cached){cached=this.mesh(t,candidates,mode.includes('|seat:')).geometry;variants.set(mode,cached);}
      if(current){current.geometry=cached;current.userData.inlandMode=mode;}
      else{
        const mesh=new THREE.Mesh(cached,this.tileMaterial(t));mesh.position.set(t.x,0,t.z);
        mesh.userData.inlandMode=mode;this.root.add(mesh);this.visible.set(key,mesh);
      }
      for(const [stale,geo] of variants)if(stale.includes('|seat:')&&stale!==mode){geo.dispose();variants.delete(stale);}
    }
    if(wanted.length&&!this.pendingSeat&&this.seatedAt===Infinity)this.seatedAt=time;
    for(const [key,mesh] of this.visible) {
      if(keep.has(key)) continue;
      this.root.remove(mesh);
      for(const g of this.madeVariants.get(key)?.values()??[mesh.geometry])g.dispose();
      this.madeVariants.delete(key);
      this.visible.delete(key);
    }
  }
}
