import {BufferAttribute, type BufferGeometry,Sphere,Vector3} from 'three';

const EACH=8192;
export class RoadFloatChunks{
 private readonly transform:(x:number)=>number;
 private readonly blocks:Float32Array[]=[];
 private size=0;
 constructor(transform:(x:number)=>number=(x)=>x){this.transform=transform;}
 push(...items:number[]){
  for(const value of items){
   const which=this.size>>13,offset=this.size&(EACH-1);
   const block=this.blocks[which]??(this.blocks[which]=new Float32Array(EACH));
   block[offset]=this.transform(value);this.size++;
  }
 }
 *finish():Generator<void,Float32Array>{
  const all=new Float32Array(this.size);
  for(let i=0;i<this.blocks.length;i++){
   if(i)yield;
   const at=i*EACH,block=this.blocks[i];all.set(this.size-at<EACH?block.subarray(0,this.size-at):block,at);
  }
  this.blocks.length=0;
  return all;
 }
}

// Identical canonical Float32 intermediate and normalization to Three's
// triangle-soup computeVertexNormals in the pinned renderer. No indexed geometry uses this helper.
export function* normalizeRoadTriangles(mesh:BufferGeometry):Generator<void,void>{
 const pos=mesh.getAttribute('position');
 const normal=new BufferAttribute(new Float32Array(pos.count*3),3);
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),cb=new Vector3(),ab=new Vector3();
 const n=new Vector3();
 for(let i=0;i<pos.count;i+=3){
  if(i&&i%3072===0)yield;
  a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,i+1);c.fromBufferAttribute(pos,i+2);
  cb.subVectors(c,b);ab.subVectors(a,b);cb.cross(ab);
  n.set(Math.fround(cb.x),Math.fround(cb.y),Math.fround(cb.z)).normalize();
  normal.setXYZ(i,n.x,n.y,n.z);normal.setXYZ(i+1,n.x,n.y,n.z);normal.setXYZ(i+2,n.x,n.y,n.z);
 }
 normal.needsUpdate=true;mesh.setAttribute('normal',normal);
}

export function* expandRoadBounds(mesh:BufferGeometry,delta:Float32Array):Generator<void,void>{
 const pos=mesh.getAttribute('position'),s=new Sphere(),min=new Vector3(Infinity,Infinity,Infinity),
  max=new Vector3(-Infinity,-Infinity,-Infinity),q=new Vector3();
 let drop=0,square=0;
 for(let i=0;i<pos.count;i++){
  if(i&&i%4096===0)yield;
  q.fromBufferAttribute(pos,i);min.min(q);max.max(q);
  drop=Math.max(drop,Math.abs(delta[i]));
 }
 if(pos.count)s.center.addVectors(min,max).multiplyScalar(.5);
 yield;
 for(let i=0;i<pos.count;i++){
  if(i&&i%4096===0)yield;
  q.fromBufferAttribute(pos,i);square=Math.max(square,s.center.distanceToSquared(q));
 }
 s.radius=Math.sqrt(square)+drop;mesh.boundingSphere=s;
}
