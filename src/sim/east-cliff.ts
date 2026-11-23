import {EAST_CLIFF} from './east-cliff.generated.ts';

export const CLIFF_SPLIT=4;
const STRIDE=CLIFF_SPLIT+1,SAMPLES=STRIDE*STRIDE,HEADER=12,RECORD=2+2*SAMPLES;
export interface CliffSource {
 cells:Uint16Array;
 deltaCm:Int16Array;
 stream:Uint8Array;
 bits:number;
 triangles:number;
}
export function decodeEastCliff(buffer:ArrayBuffer,cols:number,rows:number):CliffSource{
 const b=new DataView(buffer),cells=b.getUint16(4,true),bits=b.getUint16(6,true),triangles=b.getUint16(8,true);
 if(b.getUint32(0,false)!==0x45504331||cells!==EAST_CLIFF.cells||bits!==EAST_CLIFF.lodBits||triangles!==EAST_CLIFF.lodTriangles||
    b.getUint16(10,true)!==CLIFF_SPLIT||buffer.byteLength!==HEADER+cells*RECORD+Math.ceil(bits/8))throw Error('Invalid East Point cliff header');
 const slots=new Uint16Array(cells),data=new Int16Array(cells*SAMPLES);
 for(let i=0;i<cells;i++){
  const k=HEADER+i*RECORD,j=slots[i]=b.getUint16(k,true),x=j%cols,z=Math.floor(j/cols);
  if(x<1||z<1||x>=cols-1||z>=rows-1||(i&&j<=slots[i-1]))throw Error('Invalid cliff cell order or edge');
  for(let p=0;p<SAMPLES;p++)data[i*SAMPLES+p]=b.getInt16(k+2+2*p,true);
 }
 return {cells:slots,deltaCm:data,stream:new Uint8Array(buffer,HEADER+cells*RECORD),bits,triangles};
}

/** Sparse, signed centimeter offsets from the inherited NE–SW parent triangles.
 * Integer coordinates in the embedded subgrid are the mesh's actual vertices.
 */
export class EastCliff {
 readonly id=EAST_CLIFF.id;
 readonly source:CliffSource;
 private readonly cols:number;
 private readonly index:Uint16Array;
 private readonly heights:Float32Array;
 constructor(cols:number,rows:number,source:CliffSource,parent:(i:number,j:number)=>number){
  this.cols=cols;this.source=source;
  this.index=new Uint16Array(cols*rows);
  this.heights=new Float32Array(source.deltaCm.length);
  for(const [i,key] of source.cells.entries()){
   this.index[key]=i+1;
   const x=key%cols,z=Math.floor(key/cols);
   for(let j=0;j<STRIDE;j++)for(let k=0;k<STRIDE;k++){
    const p=i*SAMPLES+j*STRIDE+k;
    this.heights[p]=parent(x+k/CLIFF_SPLIT,z+j/CLIFF_SPLIT)+.01*source.deltaCm[p];
   }
  }
 }
 active(i:number,j:number){return i>=0&&i<this.cols&&j>=0&&!!this.index[j*this.cols+i];}
 samples(i:number,j:number,u:number,v:number){
  const slot=this.index[j*this.cols+i];if(!slot)return;
  const x=Math.min(CLIFF_SPLIT-1,Math.floor(u)),z=Math.min(CLIFF_SPLIT-1,Math.floor(v)),p=(slot-1)*SAMPLES+z*STRIDE+x;
  const nw=this.heights[p],ne=this.heights[p+1],sw=this.heights[p+STRIDE],se=this.heights[p+STRIDE+1];
  const a=u-x,b=v-z;
  return a+b<=1?nw+(ne-nw)*a+(sw-nw)*b:se+(sw-se)*(1-a)+(ne-se)*(1-b);
 }
 forEachCell(visit:(i:number,j:number)=>void){for(const s of this.source.cells)visit(s%this.cols,Math.floor(s/this.cols));}
}
