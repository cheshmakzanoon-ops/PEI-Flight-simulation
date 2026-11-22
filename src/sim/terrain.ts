import { project, clamp } from './geo.ts';
export interface TerrainSpec { width: number; height: number; bounds: [number,number,number,number]; }
/** Pixel-edge geographic bounds, north-first signed little-endian metre samples, -32768 is water. */
export class Terrain {
  readonly left: number; readonly right: number; readonly top: number; readonly bottom: number;
  readonly spec: TerrainSpec; readonly samples: Int16Array;
  constructor(spec: TerrainSpec, samples: Int16Array) {
    this.spec=spec;this.samples=samples;
    const {width:w,height:h,bounds:[W,S,E,N]}=spec;
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<2||h<2||samples.length!==w*h||!(W<E&&S<N)) throw new Error('Invalid terrain dimensions or extent');
    this.left=project(W,N).x; this.right=project(E,S).x; this.top=project(W,N).z; this.bottom=project(E,S).z;
  }
  uv(x:number,z:number){ return [(x-this.left)/(this.right-this.left),(z-this.top)/(this.bottom-this.top)] as const; }
  index(x:number,z:number){
    const {width:w,height:h}=this.spec;
    const a=(x-this.left)/(this.right-this.left), b=(z-this.top)/(this.bottom-this.top);
    if(a<0||b<0||a>=1||b>=1)return -1;
    return Math.floor(b*h)*w+Math.floor(a*w);
  }
  isLand(x:number,z:number){const i=this.index(x,z);return i>=0&&this.samples[i]!==-32768;}
  elevation(x:number,z:number) {
    if(!this.isLand(x,z))return 0;
    return this.meshElevation(x,z);
  }
  /** Weighted interpolation of valid samples; no interpolation of the missing-value sentinel into land. */
  meshElevation(x:number,z:number) {
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
