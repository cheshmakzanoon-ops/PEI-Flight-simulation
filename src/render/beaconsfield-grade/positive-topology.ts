import * as T from 'three';
import type {Terrain} from '../../sim/terrain.ts';
import {CoastalGrid,GROUND_LIFT} from '../../sim/coastal-terrain.ts';
import {BEACON_GRADE as S} from '../../sim/beaconsfield-grade.generated.ts';
/** Preserve exactly the old triangulation, including the rasterized shade crossings over
 * unchanged lawn. Insert only strictly rising authorized half-cells into this same draw.
 * The local material masks the buried original terrain there, never elsewhere. */
export function positiveGround(g:T.BufferGeometry,t:Terrain,grid:CoastalGrid,cx:number,cz:number){
 const raw=grid.relativeSamples,op=g.getAttribute('position'),ou=g.getAttribute('uv'),on=g.getAttribute('normal'),old=g.index;
 if(grid.spec!==S||grid.nx!==129||grid.nz!==129||!raw||raw.some(x=>x<0)||!old||old.count!==25088*3||op.count!==113*113||!on)throw Error('Unsupported positive ground topology');
 const n=op.count,ids=Array.from(old.array),P=Array.from(op.array),U=Array.from(ou.array),N=Array.from(on.array),added=new Int32Array(raw.length).fill(-1);
 const vertex=(k:number)=>{
  if(added[k]>=n)return added[k];
  const i=k%129,j=Math.floor(k/129),x=grid.x0+i*grid.stepX,z=grid.z0+j*grid.stepZ,[u,v]=t.uv(x,z);
  const id=P.length/3;P.push(x-cx,grid.heights[k]+GROUND_LIFT,z-cz);U.push(u,v);N.push(0,1,0);added[k]=id;return id;
 };
 let moved=0;
 const part=(a:number,b:number,c:number)=>{if(!(raw[a]||raw[b]||raw[c]))return;ids.push(vertex(a),vertex(b),vertex(c));moved++;};
 for(let j=0;j<128;j++)for(let i=0;i<128;i++){const k=j*129+i;part(k,k+129,k+1);part(k+129,k+130,k+1);}
 if(moved!==3243||P.length/3>n+2300)throw Error('Changed positive receiver census');
 g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setIndex(ids);
}
