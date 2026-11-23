import {BufferAttribute, BufferGeometry, Vector3} from 'three';
import {WOODLAND_VOLUMES} from './woodland-volume.generated.ts';

function unpack(value:string,num:number,scale:number){
 const a=Uint8Array.from(atob(value),v=>v.charCodeAt(0));
 if(a.length!==num*14)throw Error('Woodland art record size mismatch');
 const v=new DataView(a.buffer);
 return Array.from({length:num},(_,j)=>Array.from({length:7},(_,k)=>v.getInt16(j*14+k*2,true)/scale));
}
/** Four low-altitude synthetic geometry meshes derived from the existing leaf
 * model, not measured trees. Meter dimensions come from each installed instance.
 * Rock/drainage/road/shore assets and legacy canopy textures are untouched. */
export function branchedCrown(variant:number){
 const spec=WOODLAND_VOLUMES[variant];
 if(!spec)throw Error('Unknown woodland volume template');
 const wood=unpack(spec.wood,spec.woodCount,16000),sprigs=unpack(spec.sprigs,spec.sprigCount,4000);
 const xyz:number[]=[],normal:number[]=[],uv:number[]=[],detail:number[]=[],idx:number[]=[];
 const put=(p:Vector3,n:Vector3,u:number,v:number,m:number,g:number)=>{
  const at=xyz.length/3;xyz.push(p.x,p.y,p.z);normal.push(n.x,n.y,n.z);uv.push(u,v);detail.push(m,g);return at;
 };
 const o=new Vector3(),a=new Vector3(),b=new Vector3(),axis=new Vector3();
 const j=new Vector3(),k=new Vector3(),p=new Vector3(),q=new Vector3();
 for(const [ax,ay,az,bx,by,bz,w] of wood){
  a.set(ax,ay,az);b.set(bx,by,bz);axis.subVectors(b,a).normalize();
  const up=Math.abs(axis.y)>.91?o.set(1,0,0):o.set(0,1,0);
  j.crossVectors(axis,up).normalize();k.crossVectors(axis,j).normalize();
  const start=xyz.length/3,wide=w*.54,narrow=w*(ay<.01?.31:.19),sides=6;
  for(let i=0;i<sides;i++){
   const angle=i/sides*Math.PI*2;
   p.copy(j).multiplyScalar(Math.cos(angle)).addScaledVector(k,Math.sin(angle));
   put(q.copy(a).addScaledVector(p,wide),p,i/sides,0,0,1);
   put(q.copy(b).addScaledVector(p,narrow),p,i/sides,1,0,1);
  }
  for(let i=0;i<sides;i++){
   const n=start+i*2,m=start+(i+1)%sides*2;
   idx.push(n,m,n+1,n+1,m,m+1);
  }
 }
 for(const [x,y,z,size,bias,yaw,pitch] of sprigs){
  const sy=Math.sin(yaw),cy=Math.cos(yaw),ce=Math.cos(pitch),se=Math.sin(pitch);
  a.set(x,y,z);j.set(cy,0,sy);k.set(-sy*se,ce,cy*se);
  axis.crossVectors(j,k).normalize();
  const start=xyz.length/3;
  for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]])
   put(q.copy(a).addScaledVector(j,u*size).addScaledVector(k,v*size*.79),axis,u,v,spec.needle?2:1,bias);
  idx.push(start,start+1,start+2,start,start+2,start+3);
 }
 const geo=new BufferGeometry();
 geo.setAttribute('position',new BufferAttribute(Float32Array.from(xyz),3));
 geo.setAttribute('normal',new BufferAttribute(Float32Array.from(normal),3));
 geo.setAttribute('uv',new BufferAttribute(Float32Array.from(uv),2));
 geo.setAttribute('branchDetail',new BufferAttribute(Float32Array.from(detail),2));
 geo.setIndex(new BufferAttribute(Uint16Array.from(idx),1));geo.computeBoundingSphere();
 return geo;
}
