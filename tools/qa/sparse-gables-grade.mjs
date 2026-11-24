import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {BoundedGrade} from '../../src/sim/bounded-grade.ts';
import {GROUND_LIFT,WORLD_COLS,WORLD_ROWS} from '../../src/sim/coastal-terrain.ts';
import {insertCoastalGrid} from '../../src/render/coastal-patch.ts';
import {GABLES_GRADE as S} from '../../src/sim/gables-grade.generated.ts';
const root=new URL('../../public/world/',import.meta.url),R=x=>readFileSync(new URL(x,root));
const dem=gunzipSync(R('height.bin.gz')),p=JSON.parse(R('terrain.json'));
const atlas=new Terrain(p,new Int16Array(dem.buffer,dem.byteOffset,dem.length/2));
const data=gunzipSync(R(S.file)),len=data.length/3;
const off=new Int16Array(len),wt=new Uint8Array(len);
for(let k=0;k<len;k++){off[k]=data.readInt16LE(k*2);wt[k]=data[2*len+k];}
const w=(atlas.right-atlas.left)/WORLD_COLS,d=(atlas.bottom-atlas.top)/WORLD_ROWS;
const x=atlas.left+S.tileX*w,z=atlas.top+S.tileZ*d, shape={x,z,w,d},sample=(x,z)=>atlas.atlasElevation(x,z);
const sparse=new BoundedGrade(atlas,S,off,wt,sample),dense=new BoundedGrade(atlas,{...S,sparseRelative:false},off,wt,sample);
const mat=new T.MeshBasicMaterial({side:T.DoubleSide});
const make=(q)=>{
 const g=new T.PlaneGeometry(w,d,112,112).rotateX(-Math.PI/2),p=g.getAttribute('position'),u=g.getAttribute('uv');
 for(let i=0;i<p.count;i++){const xx=x+w/2+p.getX(i),zz=z+d/2+p.getZ(i);p.setY(i,sample(xx,zz)+GROUND_LIFT);u.setXY(i,...atlas.uv(xx,zz));}
 if(q)insertCoastalGrid(g,112,shape,atlas,q.grid);
 const m=new T.Mesh(g,mat);m.position.set(x+w/2,0,z+d/2);m.updateMatrixWorld();return m;
};
const old=make(dense),next=make(sparse),baseline=make();
const c=sparse.grid,r=new T.Raycaster(new T.Vector3(0,100,0),new T.Vector3(0,-1,0));
let max=0,maxCovered=0,maxOutside=0,count=0,changed=0;
for(let j=-3;j<=c.nz+2;j++)for(let i=-3;i<=c.nx+2;i++){
 const xx=c.x0+c.stepX*(i+.347),zz=c.z0+c.stepZ*(j+.463);
 r.ray.origin.set(xx,100,zz);
 const got=r.intersectObject(next,false)[0],before=r.intersectObject(old,false)[0];
 assert(got&&before);count++;
 const e=Math.abs(got.point.y-before.point.y);max=Math.max(max,e);
 if(sparse.weight(xx,zz)>0){maxCovered=Math.max(maxCovered,e);changed++;}else maxOutside=Math.max(maxOutside,e);
}
const report={baselineTriangles:baseline.geometry.index.count/3,denseTriangles:old.geometry.index.count/3,sparseTriangles:next.geometry.index.count/3,rays:count,coveredRays:changed,maxSparseDenseRayDeltaM:max,maxInside:maxCovered,maxOutside};
assert(max<.00015);assert(next.geometry.index.count<old.geometry.index.count);
console.log(JSON.stringify(report,null,2));
