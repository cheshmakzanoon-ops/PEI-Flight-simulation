import {CoastalGrid,GROUND_LIFT,type CoastalSource} from './coastal-terrain.ts';
import { project, clamp } from './geo.ts';
export const OCEAN_Y=-.055;
export interface TerrainSpec { width: number; height: number; bounds: [number,number,number,number]; }
/** Pixel-edge geographic bounds, north-first signed little-endian metre samples, -32768 is water. */
export class Terrain {
  readonly left: number; readonly right: number; readonly top: number; readonly bottom: number;
  readonly spec: TerrainSpec; readonly samples: Int16Array;
  readonly coastalGrids: readonly CoastalGrid[]; readonly coastalSurveys: readonly string[]; readonly coastalRefinements: readonly string[];
  constructor(spec: TerrainSpec, samples: Int16Array, surveys: readonly CoastalSource[] = []) {
    this.spec=spec;this.samples=samples;
    const {width:w,height:h,bounds:[W,S,E,N]}=spec;
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<2||h<2||samples.length!==w*h||!(W<E&&S<N)) throw new Error('Invalid terrain dimensions or extent');
    this.left=project(W,N).x; this.right=project(E,S).x; this.top=project(W,N).z; this.bottom=project(E,S).z;
    this.coastalGrids=surveys.map(s=>new CoastalGrid(this,s,(x,z)=>this.atlasElevation(x,z)));
    this.coastalSurveys=this.coastalGrids.map(g=>g.spec.id);
    this.coastalRefinements=this.coastalGrids.flatMap(g=>g.cliff?[g.cliff.id]:[]);
  }
  uv(x:number,z:number){ return [(x-this.left)/(this.right-this.left),(z-this.top)/(this.bottom-this.top)] as const; }
  index(x:number,z:number){
    const {width:w,height:h}=this.spec;
    const a=(x-this.left)/(this.right-this.left), b=(z-this.top)/(this.bottom-this.top);
    if(a<0||b<0||a>=1||b>=1)return -1;
    return Math.floor(b*h)*w+Math.floor(a*w);
  }
  isLand(x:number,z:number){const i=this.index(x,z);return i>=0&&this.samples[i]!==-32768;}
  detailElevation(x:number,z:number):number|undefined {
    for(const grid of this.coastalGrids){const h=grid.height(x,z);if(h!==undefined)return h;}
  }
  elevation(x:number,z:number) {
    return this.detailElevation(x,z)??(this.isLand(x,z)?this.atlasElevation(x,z):0);
  }
  meshElevation(x:number,z:number) {return this.detailElevation(x,z)??this.atlasElevation(x,z);}
  /** Land is classified by the same continuous Cover mask used by the land/water shaders.
   * A positive offshore DTM and an inland NoData cell are not contact classifications. */
  contactHeight(x:number,z:number,coveredLand:boolean){return coveredLand?this.meshElevation(x,z)+GROUND_LIFT:OCEAN_Y;}
  /** Weighted interpolation of valid samples; no interpolation of the missing-value sentinel into land. */
  atlasElevation(x:number,z:number) {
    const {width:w,height:h}=this.spec;
    const fx=clamp((x-this.left)/(this.right-this.left)*w-.5,0,w-1),fy=clamp((z-this.top)/(this.bottom-this.top)*h-.5,0,h-1);
    const ix=Math.floor(fx),iy=Math.floor(fy),dx=fx-ix,dy=fy-iy;
    let sum=0, mass=0;
    for(let j=0;j<2;j++)for(let i=0;i<2;i++){
      const n=this.samples[Math.min(h-1,iy+j)*w+Math.min(w-1,ix+i)];
      const k=(i?dx:1-dx)*(j?dy:1-dy);
      if(n!==-32768){sum+=n*k;mass+=k;}
    }
    return mass>0?Math.max(0,sum/mass):0;
  }
}
