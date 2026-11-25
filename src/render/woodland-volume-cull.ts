import {Box3, Camera, Frustum, InstancedBufferAttribute, Matrix4, WebGLCoordinateSystem} from 'three';

const FENCE=.75; // metres beyond each original rotated template; intentionally not a screen-size LOD
const RADIUS_FENCE=.10;
const tags=['treeStem','treeShape','treeSpin','crownLift'] as const;
type Tag=typeof tags[number];
/** Authoritative per-variant input, untouched by view selection and available to all original consumers. */
export type WoodlandStreams={treeStem:InstancedBufferAttribute;treeShape:InstancedBufferAttribute;
 treeSpin:InstancedBufferAttribute;crownLift?:InstancedBufferAttribute};
export interface WoodlandCullGroup{
 streams:WoodlandStreams;
 readonly templateBox:Box3;
 readonly triangleCount:number;
 sourceCount:number;
}
/** Derive a view stream, never an admission/appearance mask. The full canonical attribute objects are
 * still owned by the original layer. Only a different link to the GPU-side instance stream is used. */
export class WoodlandViewRows{
 readonly slots:Uint16Array;
 readonly compact:WoodlandStreams;
 private readonly bound:Float64Array;
 private readonly previous:Uint16Array;
 private sourceRev=-1;
 private packedRev=-1;
 private packedCount=-1;
 private readonly box=new Box3();
 private readonly source:WoodlandCullGroup;
 constructor(source:WoodlandCullGroup,capacity:number){
  this.source=source;
  this.slots=new Uint16Array(capacity);
  this.previous=new Uint16Array(capacity);
  this.bound=new Float64Array(capacity*6);
  const clone=(a:InstancedBufferAttribute)=>new InstancedBufferAttribute(new Float32Array(capacity*a.itemSize),a.itemSize).setUsage(a.usage);
  const a=source.streams;
  this.compact={treeStem:clone(a.treeStem),treeShape:clone(a.treeShape),treeSpin:clone(a.treeSpin),...(a.crownLift?{crownLift:clone(a.crownLift)}:{})};
 }
 private bounds(revision:number){
  if(this.sourceRev===revision)return;
  this.sourceRev=revision;
  const {streams:s,templateBox:b}=this.source,bs=this.bound;
  const lx=(b.min.x+b.max.x)*.5,ly=(b.min.y+b.max.y)*.5,lz=(b.min.z+b.max.z)*.5,
   dx=(b.max.x-b.min.x)*.5,dy=(b.max.y-b.min.y)*.5,dz=(b.max.z-b.min.z)*.5;
  for(let i=0;i<this.source.sourceCount;i++){
   const x=s.treeStem.getX(i),y=s.treeStem.getY(i),z=s.treeStem.getZ(i),w=s.treeShape.getY(i),h=s.treeShape.getX(i),
    c=s.treeSpin.getX(i),v=s.treeSpin.getY(i),lift=s.crownLift?.getX(i)??0,k=i*6;
   if(!Number.isFinite(x+y+z+w+h+c+v+lift)||w<=0||h<=0||Math.max(w,h)>512||Math.abs(c*c+v*v-1)>.001||lift<0||lift>1.651){
    bs[k]=NaN;continue;
   }
   const cx=x+w*(c*lx-v*lz),cy=y+h*ly,cz=z+w*(v*lx+c*lz),
    hx=w*(Math.abs(c)*dx+Math.abs(v)*dz)+FENCE,hy=h*dy+FENCE,hz=w*(Math.abs(v)*dx+Math.abs(c)*dz)+FENCE;
   bs[k]=cx-hx;bs[k+1]=cy-hy;bs[k+2]=cz-hz;
   bs[k+3]=cx+hx;bs[k+4]=cy+hy+lift;bs[k+5]=cz+hz;
  }
 }
 select(frustum:Frustum,x:number,z:number,outer:number,revision:number){
  this.bounds(revision);
  const b=this.bound,box=this.box,s=this.source.streams.treeStem,r2=(outer+RADIUS_FENCE)**2;
  let n=0;
  for(let i=0;i<this.source.sourceCount;i++){
   const k=i*6;
   if(Number.isFinite(b[k])){
    if((s.getX(i)-x)**2+(s.getZ(i)-z)**2>r2)continue; // all old shader coverage is exactly zero
    box.min.set(b[k],b[k+1],b[k+2]);box.max.set(b[k+3],b[k+4],b[k+5]);
    if(!frustum.intersectsBox(box))continue; // includes entire original geometry plus continuous crown warp
   }
   this.slots[n++]=i;
  }
  return n;
 }
 pack(n:number,revision:number){
  let changed=this.packedCount!==n||this.packedRev!==revision;
  if(!changed)for(let i=0;i<n;i++)if(this.previous[i]!==this.slots[i]){changed=true;break;}
  if(!changed)return;
  this.packedCount=n;this.packedRev=revision;this.previous.set(this.slots.subarray(0,n));
  for(const k of tags){const src=this.source.streams[k],dst=this.compact[k];if(!src||!dst)continue;
   const a=src.array as Float32Array,b=dst.array as Float32Array,w=src.itemSize;
   for(let i=0;i<n;i++){const start=this.slots[i]*w;for(let j=0;j<w;j++)b[i*w+j]=a[start+j];}
   if(n){dst.clearUpdateRanges();dst.addUpdateRange(0,n*w);dst.needsUpdate=true;}
  }
 }
}
export const WOODLAND_STREAM_TAGS:readonly Tag[]=tags;
/** Accept bounded ordinary perspective only. XR/multiview, unsupported projection and invalid source
 * all keep legacy circular submission. No CPU call updates an unrelated camera or scene. */
export function woodlandEye(camera:Camera|undefined,vp:Matrix4,f:Frustum){
 const c=camera as (Camera&{isPerspectiveCamera?:boolean;isArrayCamera?:boolean;near:number;far:number})|undefined;
 if(!c?.isPerspectiveCamera||c.isArrayCamera||c.coordinateSystem!==WebGLCoordinateSystem||c.reversedDepth||
    !Number.isFinite(c.near+c.far)||c.near<=0||c.far<=c.near)return false;
 const p=c.projectionMatrix.elements,m=c.matrixWorldInverse,w=c.matrixWorld.elements;
 if(!p.every(Number.isFinite)||!m.elements.every(Number.isFinite)||!w.every(Number.isFinite)||
    !(p[0]>0&&p[5]>0&&p[3]===0&&p[7]===0&&p[11]===-1&&p[15]===0)||
    Math.abs(m.determinant())<1e-8)return false;
 vp.multiplyMatrices(c.projectionMatrix,m);
 if(!Number.isFinite(vp.determinant())||Math.abs(vp.determinant())<1e-12)return false;
 f.setFromProjectionMatrix(vp,WebGLCoordinateSystem,false);
 return f.planes.every(q=>Number.isFinite(q.constant)&&Number.isFinite(q.normal.lengthSq())&&q.normal.lengthSq()>.99);
}
