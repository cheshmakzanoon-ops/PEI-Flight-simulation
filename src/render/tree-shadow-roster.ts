import {TREE_PITCH,TREE_TILE_SIDE} from '../sim/tree-layout.ts';
export const SHADOW_CAPTURE_RADIUS=380;
export const SHADOW_SLOT_CAP=(Math.ceil(SHADOW_CAPTURE_RADIUS*2/TREE_PITCH)+1)**2;
export const SHADOW_BLOCK_CAP=(Math.ceil(SHADOW_CAPTURE_RADIUS*2/(TREE_PITCH*TREE_TILE_SIDE))+1)**2;
const STRIDE=4, TILE=TREE_PITCH*TREE_TILE_SIDE;
const CELL_SIDE=Math.ceil(SHADOW_CAPTURE_RADIUS*2/TREE_PITCH)+3;
/** Appends only known original slots from Vegetation's existing iteration.
 * Empty/high/late transactions never renumber or modify the tree roster. */
export class ShadowSlotRoster{
 readonly slots=new Uint16Array(SHADOW_SLOT_CAP);
 readonly blocks=new Int32Array(SHADOW_BLOCK_CAP*STRIDE);
 // Canonical world-tree grid. Ambiguous quantized edge coincidences can
 // still build normally; they merely veto preservation of an old binding.
 private readonly cells=new Int32Array(CELL_SIDE*CELL_SIDE);
 private i0=0;private j0=0;
 size=0;blockCount=0;x=0;z=0;revision=-1;valid=false;
 private cell(x:number,z:number){
  const i=Math.floor(x/TREE_PITCH)-this.i0,j=Math.floor(z/TREE_PITCH)-this.j0;
  return Number.isInteger(i+j)&&i>=0&&j>=0&&i<CELL_SIDE&&j<CELL_SIDE?j*CELL_SIDE+i:-1;
 }
 slotAt(x:number,z:number){
  const index=this.valid?this.cell(x,z):-1;
  return index>=0?this.cells[index]:-1;
 }
 start(x:number,z:number,revision:number){
  this.cells.fill(-1);
  this.i0=Math.floor((x-SHADOW_CAPTURE_RADIUS)/TREE_PITCH)-1;
  this.j0=Math.floor((z-SHADOW_CAPTURE_RADIUS)/TREE_PITCH)-1;
  this.size=this.blockCount=0;this.x=x;this.z=z;this.revision=revision;this.valid=true;
 }
 append(slot:number,distanceSquared:number,x?:number,z?:number){
  if(!this.valid||distanceSquared>SHADOW_CAPTURE_RADIUS**2)return;
  if(this.size>=this.slots.length||slot>=65536||slot<0){this.valid=false;return;}
  this.slots[this.size++]=slot;
  if(x!==undefined&&z!==undefined){
   const index=this.cell(x,z);
   if(index>=0)this.cells[index]=this.cells[index]===-1?slot:-2;
  }
 }
 sealBlock(tx:number,tz:number,first:number){
  if(!this.valid||first===this.size)return;
  if(this.blockCount>=SHADOW_BLOCK_CAP){this.valid=false;return;}
  const q=this.blockCount++*STRIDE;
  this.blocks[q]=tx;this.blocks[q+1]=tz;this.blocks[q+2]=first;this.blocks[q+3]=this.size;
 }
 contains(x:number,z:number,radius:number){
  return this.valid&&Math.hypot(x-this.x,z-this.z)<=SHADOW_CAPTURE_RADIUS-radius;
 }
 /** At most a few existing 192m source tiles intersect a 100m query. */
 nearby(x:number,z:number,radius:number,into:Int32Array){
  if(!this.contains(x,z,radius))return -1;
  let n=0;
  for(let q=0;q<this.blockCount*STRIDE;q+=STRIDE){
   const a=this.blocks[q]*TILE,b=this.blocks[q+1]*TILE;
   if(Math.max(0,a-x,x-a-TILE)**2+Math.max(0,b-z,z-b-TILE)**2>radius*radius)continue;
   if(n+2>into.length)return -1;
   into[n++]=this.blocks[q+2];into[n++]=this.blocks[q+3];
  }
  return n;
 }
}
