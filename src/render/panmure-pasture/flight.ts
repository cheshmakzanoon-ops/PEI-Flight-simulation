/** This registration is not a new parcel/landcover classifier. The one-metre
 * texture is bounded to one already vetted/eroded 2020 field interior. */
import { CANOPY_FENCE } from '../canopy-fence.generated.ts';
export const PASTURE = {
  tile:'25-18', i:25,j:18,
  bounds:[56051.91317458963,39478.53617316754,56264.91317458963,39714.53617316754] as const,
  width:213,height:236, mask:'787ffcf201dcaddded604c11423361cfa175545f24e44272a117903f74a06b01',
  image:'444dcbdb31052c27e6142ba1a73c56f8abb86b7c93cba0b87465018c4a9d3349',
  owner:'q1120',offset:1962687,size:24414,ownerSha:'8836784fd9f9ad9d399ad4f6ac6b2290a9b29de120970ec2bac01e35fb6035af',
} as const;
type Eye = Readonly<{x:number;y:number;z:number}>;
type Tile = {id:string;i:number;j:number;x0:number;z0:number;w:number;d:number};
export function pastureTile(t:Tile) {
  const b=PASTURE.bounds;
  return t.id===PASTURE.tile&&t.i===PASTURE.i&&t.j===PASTURE.j&&
    t.x0<=b[0]&&t.z0<=b[1]&&t.x0+t.w>=b[2]&&t.z0+t.d>=b[3];
}
export function correctPastureFrame(bounds:readonly number[],shape:readonly number[]) {
  return bounds.length===4&&shape.length===2&&shape[0]===PASTURE.height&&shape[1]===PASTURE.width&&
    PASTURE.bounds.every((x,i)=>x===bounds[i])&&bounds[2]-bounds[0]===shape[1]&&bounds[3]-bounds[1]===shape[0];
}
const cubic=(x:number)=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
/** At 275 m absolute height the response and its derivative are already zero.
 * The radial condition is only a load gate, deliberately outside the shader's 458 m cutoff. */
export function pastureEyeGain(p:Eye) {
  if(!Number.isFinite(p.y)||p.y>=275||p.y<=-8)return 0;
  const b=PASTURE.bounds,x=Math.max(b[0]-p.x,0,p.x-b[2]),z=Math.max(b[1]-p.z,0,p.z-b[3]);
  return x*x+z*z<695**2?1-cubic((p.y-180)/95):0;
}
export async function pastureDigest(bytes:ArrayBuffer) {
  if(!globalThis.crypto?.subtle)return;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),c=>c.toString(16).padStart(2,'0')).join('');
}
type Art = {gain:{value:number};install:()=>boolean;dispose:()=>void};
export class PanmurePastureFlight {
  private proof:'cold'|'checking'|'ready'|'stock'='cold';
  private owner?:ArrayBuffer;
  private active?:ArrayBuffer;
  private permitted?:boolean;
  private art?:Art;
  private mounted=false;
  private since?:number;
  private readonly readCover:()=>Promise<string|undefined>;
  private readonly loadArt:()=>Promise<Art|undefined>;
  constructor(readCover:()=>Promise<string|undefined>,loadArt:()=>Promise<Art|undefined>){this.readCover=readCover;this.loadArt=loadArt;}
  permit(allowed:boolean){this.permitted=allowed;if(!allowed)this.proof='stock';}
  get state(){return {proof:this.proof,mounted:this.mounted,gain:this.art?.gain.value??0};}
  /** Verify the exact ordinary *drawn* building bytes used for the safety moats;
   * do not fetch a second copy of roads, cover, buildings, or the landscape. */
  update(eye:Eye,seconds:number,playing:boolean,retain:boolean,source:()=>ArrayBuffer|undefined){
    const gain=retain&&Number.isFinite(seconds)?pastureEyeGain(eye):0;
    const raw=gain&&this.permitted&&this.proof!=='stock'?source():undefined;
    this.active=raw;
    if(!raw){this.since=undefined;if(this.art)this.art.gain.value=0;return;}
    if(this.owner!==raw){
      this.since=undefined;if(this.art)this.art.gain.value=0;
      if(!playing)return;
      this.owner=raw;this.proof='checking';
      const current=()=>this.active===raw&&this.owner===raw&&this.permitted;
      void Promise.resolve().then(async()=>{
        if(!current())return;
        if(raw.byteLength!==PASTURE.size||await this.readCover()!==CANOPY_FENCE.pins.coverDecoded)return false;
        if(!current())return;
        if(await pastureDigest(raw)!==PASTURE.ownerSha)return false;
        if(!current())return;
        if(!this.art){
          const loaded=await this.loadArt();
          if(!current()){loaded?.dispose();return;}
          this.art=loaded;
        }
        return !!this.art;
      }).then(ok=>{
        if(this.owner!==raw||!this.permitted)return;
        if(ok===undefined||!current()){this.owner=undefined;this.proof='cold';}
        else this.proof=ok?'ready':'stock';
      },()=>{if(this.owner===raw)this.proof='stock';});
    }
    if(this.proof!=='ready'||!this.art)return;
    if(!this.mounted){
      if(!playing)return;
      try{this.mounted=this.art.install();}catch{this.mounted=false;}
      if(!this.mounted){this.art.dispose();this.art=undefined;this.proof='stock';return;}
    }
    if(this.since===undefined){if(!playing)return;this.since=seconds;}
    this.art.gain.value=gain*cubic((seconds-this.since)/.42);
  }
}
