import * as THREE from 'three';
import {OCEAN_Y,type Terrain} from '../sim/terrain.ts';
import type {ShoreSegment} from '../sim/shoreline.ts';
type Bounds=readonly [number,number,number,number];
type Chunk={
 mesh:THREE.Mesh;original:THREE.BufferGeometry;refined?:THREE.BufferGeometry;
 bounds:Bounds;stockCull:THREE.Sphere; arcs:ShoreSegment[];revision?:string;
};
const registerDistance=8050,keepDistance=8550;
const bucket=5000,verticalStep=1.05;
function geometry(p:number[]){
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(p.length/3*2),2));
 g.computeBoundingSphere();return g;
}
function add(a:ShoreSegment,y:(x:number,z:number)=>number,terrain:Terrain,buffer:number[],step:number){
 let x=a.ax,z=a.az;
 const n=Math.max(1,Math.ceil(Math.hypot(a.bx-x,a.bz-z)/step)),m=(a:number,b:number,t:number)=>a+(b-a)*t;
 const join=a.seatJoin,h0=join?terrain.meshElevation(a.ax,a.az)+.72:0,h1=join?terrain.meshElevation(a.bx,a.bz)+.72:0;
 const stockBottom=Math.min(-.14,h0-.82,h1-.82);
 const span=(x:number,z:number,u:number)=>{
  const h=y(x,z),lower=Math.min(h,OCEAN_Y)-.10,upper=Math.max(h,OCEAN_Y)+.10;
  if(!join||join[0]&&join[1])return [lower,upper];
  let t=join[0]?u:1-u;t=Math.min(1,Math.max(0,(t-.25)/.75));
  const blend=t*t*(3-2*t);
  const stockTop=m(Math.max(OCEAN_Y+.03,h0),Math.max(OCEAN_Y+.03,h1),u);
  return [m(lower,stockBottom,blend),m(upper,stockTop,blend)];
 };
 let [low,up]=span(x,z,0);
 for(let i=1;i<=n;i++){
  const u=i/n,q=a.ax+(a.bx-a.ax)*u,r=a.az+(a.bz-a.az)*u,[yl,yr]=span(q,r,u);
  buffer.push(x,low,z,q,yl,r,x,up,z,x,up,z,q,yl,r,q,yr,r);
  x=q;z=r;low=yl;up=yr;
 }
}
export const stockShoreKey=(a:ShoreSegment)=>Math.floor(a.ax/12000)+','+Math.floor(a.az/12000);
export function appendStockCurtain(a:ShoreSegment,terrain:Terrain,v:number[]){
 const {ax:x,az:z,bx:u,bz:w}=a,ph=terrain.meshElevation(x,z)+.72,qh=terrain.meshElevation(u,w)+.72;
 const bottom=Math.min(-.14,ph-.82,qh-.82),pTop=Math.max(OCEAN_Y+.03,ph),qTop=Math.max(OCEAN_Y+.03,qh);
 v.push(x,bottom,z,u,bottom,w,x,pTop,z,x,pTop,z,u,bottom,w,u,qTop,w);
}
export function stockShoreSphere(a:readonly number[],b:readonly number[]){
 // The stock geometry computes its sphere after Float32 conversion.
 const box=new THREE.Box3(),p=new THREE.Vector3(),sphere=new THREE.Sphere();
 const visit=(f:(p:THREE.Vector3)=>void)=>{
  for(const range of [a,b])for(let i=0;i<range.length;i+=3)
   f(p.set(Math.fround(range[i]),Math.fround(range[i+1]),Math.fround(range[i+2])));
 };
 visit(p=>box.expandByPoint(p));box.getCenter(sphere.center);
 let max=0;visit(p=>{max=Math.max(max,p.distanceToSquared(sphere.center));});
 sphere.radius=Math.sqrt(max);return sphere;
}
export class LegacyShoreCurtains {
 private readonly chunks:Chunk[]=[];
 private refined=0;
 private readonly terrain:Terrain;
 constructor(scene:THREE.Scene,material:THREE.ShaderMaterial,east:THREE.ShaderMaterial|undefined,eastGroups:ReadonlySet<string>,terrain:Terrain,arcs:readonly ShoreSegment[],owners:ReadonlyMap<string,THREE.Sphere>,private readonly additive=false,stageName='Selective legacy coast arcs'){
  this.terrain=terrain;
  const groups=new Map<string,{owner:string;arcs:ShoreSegment[]; original:Set<ShoreSegment>}>();
  for(const q of arcs){
   const p=q.seatedLegacyArc;if(!p)continue;
   const owner=stockShoreKey(p),key=owner+':'+Math.floor((p.ax+p.bx)*.5/bucket)+','+Math.floor((p.az+p.bz)*.5/bucket);
   const g=groups.get(key)??{owner,arcs:[],original:new Set<ShoreSegment>()};
   g.arcs.push(q);g.original.add(p);groups.set(key,g);
  }
  for(const g of groups.values()){
   const bounds:[number,number,number,number]=[Infinity,Infinity,-Infinity,-Infinity],p:number[]=[];
   for(const a of g.original){
    if(!additive)appendStockCurtain(a,terrain,p);
    bounds[0]=Math.min(bounds[0],a.ax,a.bx);bounds[1]=Math.min(bounds[1],a.az,a.bz);
    bounds[2]=Math.max(bounds[2],a.ax,a.bx);bounds[3]=Math.max(bounds[3],a.az,a.bz);
   }
   for(const a of g.arcs){
    bounds[0]=Math.min(bounds[0],a.ax,a.bx);bounds[1]=Math.min(bounds[1],a.az,a.bz);
    bounds[2]=Math.max(bounds[2],a.ax,a.bx);bounds[3]=Math.max(bounds[3],a.az,a.bz);
   }
   const original=geometry(p),mesh=new THREE.Mesh(original,east&&eastGroups.has(g.owner)?east:material);
   const stockCull=owners.get(g.owner);if(!stockCull)throw Error('Missing legacy coast owner');
   mesh.name=stageName;scene.add(mesh);this.chunks.push({mesh,original,bounds,stockCull,arcs:g.arcs});
  }
 }
 materialReceivers(){return this.chunks.map(q=>q.mesh);}
 update(x:number,z:number,signature:(b:Bounds)=>string,height:(x:number,z:number)=>number){
  let refined=0;
  for(const q of this.chunks){
   const base=q.stockCull;
   q.mesh.visible=Math.hypot(base.center.x-x,base.center.z-z)<17000+base.radius;
   const [a,b,c,d]=q.bounds;
   const dx=Math.max(a-x,0,x-c),dz=Math.max(b-z,0,z-d);
   if(!q.mesh.visible||dx*dx+dz*dz>(q.refined?keepDistance:registerDistance)**2){
    if(q.refined){q.mesh.geometry=q.original;q.refined.dispose();q.refined=undefined;q.revision=undefined;}
    if(this.additive)q.mesh.visible=false;
    continue;
   }
   const id=signature(q.bounds);
   if(q.revision!==id||!q.refined){
    const p:number[]=[];
    for(const a of q.arcs)add(a,height,this.terrain,p,verticalStep);
    q.refined?.dispose();q.refined=geometry(p);q.mesh.geometry=q.refined;q.revision=id;
   }
   refined++;
  }
  this.refined=refined;
 }
 get state(){return {chunks:this.chunks.length,refined:this.refined};}
}
