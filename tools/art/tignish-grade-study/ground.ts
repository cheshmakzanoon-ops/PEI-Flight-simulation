/** Detached source-matched ground profile. Does not edit World or collision. */
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Uint16BufferAttribute} from 'three';
type Pair=readonly [number,number];
const count=96,datum=21;
const base=[-64174.409261538094,-50513.956572702205] as const;
const col=[.8838188922748154,.4638614881371395] as const;
const row=[-.4678056080084889,.876367319204727] as const;
export const TIGNISH_GRADE_FRAME=Object.freeze({count,datum,base:Object.freeze(base),col:Object.freeze(col),row:Object.freeze(row)});
export type GroundRegistration={
 height:number;width:number;maxLocalRegistrationM:number;worldXZAtFirstSample:Pair;
 worldXZForColumn:Pair;worldXZForRow:Pair;northWestPixelEdge:Pair;
};
const eq=(a:Pair,b:Pair)=>a.length===2&&b.length===2&&a[0]===b[0]&&a[1]===b[1];

export function makeTignishGradeStudy(samples:Float32Array,reg:GroundRegistration){
 if(reg.height!==count||reg.width!==count||samples.length!==count*count||
   !eq(reg.worldXZAtFirstSample,base)||!eq(reg.worldXZForColumn,col)||!eq(reg.worldXZForRow,row)||
   !eq(reg.northWestPixelEdge,[2284098,338817])||
   !Number.isFinite(reg.maxLocalRegistrationM)||reg.maxLocalRegistrationM<=0||reg.maxLocalRegistrationM>=.001||
   samples.some(y=>!Number.isFinite(y)||y<10||y>40))throw new RangeError('unsupported Tignish registered ground window');
 const p=new Float32Array(count*count*3),index=new Uint16Array((count-1)**2*6);
 let at=0;
 for(let j=0;j<count;j++)for(let i=0;i<count;i++){
  const v=(j*count+i),k=v*3;
  p[k]=col[0]*i+row[0]*j;p[k+1]=samples[v]-datum;p[k+2]=col[1]*i+row[1]*j;
  if(i+1<count&&j+1<count){
   index[at++]=v;index[at++]=v+count;index[at++]=v+1;
   index[at++]=v+count;index[at++]=v+count+1;index[at++]=v+1;
  }
 }
 if(at!==index.length)throw Error('inconsistent detached sample topology');
 const geo=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(p,3)).setIndex(new Uint16BufferAttribute(index,1));
 geo.computeVertexNormals();geo.computeBoundingSphere();geo.computeBoundingBox();
 const mat=new MeshStandardMaterial({color:0x72766c,roughness:1}),mesh=new Mesh(geo,mat),group=new Group();
 group.name='Tignish • detached 1 m grade',group.position.set(base[0],datum,base[1]);group.add(mesh);group.updateMatrixWorld(true);
 return {mesh,group,dispose(){group.removeFromParent();geo.dispose();mat.dispose();}};
}
