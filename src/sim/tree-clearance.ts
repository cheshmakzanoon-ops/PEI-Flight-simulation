import {roofCellCount,roofCellDeltas} from './tree-clearance.generated.ts';
import {treeTileStart} from './tree-layout.ts';

/** Decode once on startup (~72 KB resident). Each varint is the positive delta
 * from its predecessor, ordered by tile and then the 16×16 local cell number. */
export function decodeTreeCells(base64:string,count:number):Uint32Array {
  const packed=atob(base64),keys=new Uint32Array(count);
  let offset=0,prev=0;
  for(let k=0;k<count;k++){
    let delta=0,power=1,b=0;
    do{
      if(offset>=packed.length||power>128**4)throw Error('Invalid roof clearance varint.');
      b=packed.charCodeAt(offset++);
      delta+=(b&127)*power;power*=128;
    }while(b&128);
    if((k!==0&&delta===0)||prev+delta>=2**30)throw Error('Invalid roof clearance cell.');
    keys[k]=prev+=delta;
  }
  if(offset!==packed.length)throw Error('Unexpected extra roof clearance data.');
  return keys;
}
const cells=decodeTreeCells(roofCellDeltas,roofCellCount);

/** Called once on a vegetation tile cache miss, never per frame or per tree.
 * Fill a caller-owned 32-byte mask; leave all bits zero for an ordinary tile. */
export function fillRoofTile(tx:number,tz:number,bits:Uint32Array):boolean{
  bits.fill(0);
  const start=treeTileStart(tx,tz);
  if(start<0)return false;
  let lo=0,hi=cells.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(cells[mid]<start)lo=mid+1;else hi=mid;}
  const end=start+256,first=lo;
  while(lo<cells.length&&cells[lo]<end){
    const local=cells[lo++]-start;
    bits[local>>>5]|=(1<<(local&31));
  }
  return first!==lo;
}
