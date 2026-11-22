import * as THREE from 'three';
import type {Terrain} from '../sim/terrain.ts';
import type {Cover} from '../sim/cover.ts';
import {runwayAt} from '../sim/places.ts';
const foliage=[new THREE.Color(0x556748),new THREE.Color(0x344a3c)];
function rand(x:number,z:number,s=0){let n=Math.imul(x^s,2246822519)^Math.imul(z,3266489917);n=Math.imul(n^(n>>>15),2246822519);return ((n^(n>>>13))>>>0)/4294967296;}
// Two original, deliberately low-poly silhouette families. Real WorldCover determines woodland;
// exact stems and species are synthesized. Coordinates are regenerated deterministically.
function crowns(needle:boolean){
 const vs:number[]=[],colors:number[]=[];const push=(p:[number,number,number],color:number)=>{
  vs.push(...p);colors.push(color*.81,color,color*.77);};
 const tri=(a:[number,number,number],b:[number,number,number],c:[number,number,number],v:number)=>{push(a,v*.8);push(b,v);push(c,v*.90);};
 if(needle){
  for(let j=0;j<3;j++){const base=.13+j*.23,peak=.59+j*.205,rad=.23-j*.062;
   const ring:Array<[number,number,number]>=[];for(let n=0;n<7;n++){const a=n/7*Math.PI*2+j*.6;
    ring.push([Math.cos(a)*rad,base+(n%2)*.04,Math.sin(a)*rad]);}
   for(let n=0;n<7;n++)tri(ring[n],ring[(n+1)%7],[0,peak,0],.72+.09*j+.06*rand(n,j));
  }
 }else{
  for(let j=0;j<3;j++){const cc=[[0,.62,0,.28,.35],[.17,.51,.04,.22,.22],[-.15,.57,-.065,.23,.24]][j],n=7;
   const ring:Array<[number,number,number]>=[];
   for(let i=0;i<n;i++){const a=i/n*Math.PI*2+j*.7,r=cc[3]*(.83+.30*rand(i,j));ring.push([cc[0]+Math.cos(a)*r,cc[1]+(rand(j,i)-.5)*.09,cc[2]+Math.sin(a)*r]);}
   for(let i=0;i<n;i++){tri(ring[i],ring[(i+1)%n],[cc[0]-.055,cc[1]+cc[4],cc[2]-.04],.81+.14*rand(i,j));
    tri(ring[(i+1)%n],ring[i],[cc[0],cc[1]-cc[4]*.79,cc[2]],.57);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
export class Vegetation {
 private meshes:THREE.InstancedMesh[];private lastX=Infinity;private lastZ=Infinity;private transform=new THREE.Object3D();private tint=new THREE.Color();
 constructor(private scene:THREE.Scene,private t:Terrain,private cover:Cover){
  this.meshes=[false,true].map((needle)=>{const m=new THREE.InstancedMesh(crowns(needle),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide,flatShading:false}),10000);m.count=0;m.frustumCulled=false;m.name=needle?'Conifer canopy':'Broadleaf canopy';m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(m);return m;});
 }
 update(x:number,z:number,alt:number){
  if(Math.hypot(x-this.lastX,z-this.lastZ)<210)return;
  this.lastX=x;this.lastZ=z;const counts=[0,0],pitch=22,R=1040,minX=Math.floor((x-R)/pitch),maxX=Math.floor((x+R)/pitch),minZ=Math.floor((z-R)/pitch),maxZ=Math.floor((z+R)/pitch);
  for(let j=minZ;j<=maxZ;j++)for(let i=minX;i<=maxX;i++){
   const px=(i+rand(i,j,11))*pitch,pz=(j+rand(i,j,84))*pitch,ds=(px-x)**2+(pz-z)**2;
   if(ds>R*R||this.cover.sample(this.t,px,pz)!==10||!this.t.isLand(px,pz)||runwayAt(px,pz))continue;
   const k=rand(i,j,43)<.34?1:0;if(counts[k]>=this.meshes[k].instanceMatrix.count)continue;
   const height=8+rand(i,j,35)*10, width=height*(.77+rand(i,j,9)*.38);
   const d=this.transform;d.position.set(px,this.t.meshElevation(px,pz)-.1,pz);d.rotation.y=rand(i,j,69)*6.28;d.scale.set(width,height,width);d.updateMatrix();
   this.tint.copy(foliage[k]).multiplyScalar(.76+rand(i,j,21)*.49);
   const m=this.meshes[k];m.setMatrixAt(counts[k],d.matrix);m.setColorAt(counts[k]++,this.tint);
  }
  for(let i=0;i<2;i++){const m=this.meshes[i];m.count=counts[i];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.visible=alt<4200;}
 }
}
