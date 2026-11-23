import {readCoastalPack} from './coastal-packs.ts';
import {FOREST_HEIGHTS} from './forest-heights.generated.ts';
import {clamp,project} from './geo.ts';

export class ForestHeights{
  private readonly windows=FOREST_HEIGHTS.windows.map(spec=>{
    const [west,south,east,north]=spec.bounds,a=project(west,north),b=project(east,south);
    return {...spec,x0:a.x,z0:a.z,x1:b.x,z1:b.z};
  });
  readonly ids=this.windows.map(w=>w.id);
  private readonly cells:Uint8Array;
  constructor(cells:Uint8Array){
    if(cells.byteLength!==FOREST_HEIGHTS.decodedBytes)throw Error('Invalid woodland height layer');
    this.cells=cells;
  }
  /** Offset existing inferred stems toward the sampled dominant stand height.
   * Do not infer species, add stems, or fill absent stand records. */
  height(x:number,z:number,defaultHeight:number,variation:number){
    for(const w of this.windows){
      if(x<=w.x0||x>=w.x1||z<=w.z0||z>=w.z1)continue;
      const {width,height}=FOREST_HEIGHTS;
      const u=clamp((x-w.x0)/(w.x1-w.x0)*width-.5,0,width-1);
      const v=clamp((z-w.z0)/(w.z1-w.z0)*height-.5,0,height-1);
      const i=Math.min(Math.floor(u),width-2),j=Math.min(Math.floor(v),height-2);
      const s=w.offset+j*width+i;
      const a=this.cells[s],b=this.cells[s+1],c=this.cells[s+width],d=this.cells[s+width+1];
      if(!a||!b||!c||!d)continue;
      const edge=Math.min(x-w.x0,w.x1-x,z-w.z0,w.z1-z),k=clamp(edge/21,0,1);
      const f=u-i,g=v-j;
      const stand=((a*(1-f)+b*f)*(1-g)+(c*(1-f)+d*f)*g)*.5;
      const modeled=clamp(stand*(.84+.26*variation),2.6,30);
      return defaultHeight+(modeled-defaultHeight)*(k*k*(3-2*k));
    }
    return defaultHeight;
  }
}

export function loadForestHeights(base:string,fetcher:typeof fetch=fetch,timeout=1600){
  return readCoastalPack(base+FOREST_HEIGHTS.asset,fetcher,timeout,FOREST_HEIGHTS,
    b=>new ForestHeights(new Uint8Array(b)));
}
