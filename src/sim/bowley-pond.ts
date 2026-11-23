import {readCoastalPack} from './coastal-packs.ts';
import {BOWLEY_POND} from './bowley-pond.generated.ts';

export type BowleySpec=Readonly<{id:string;width:number;height:number;left:number;top:number;step:number;units:number;waterY:number}>;
export type BowleyShoreRun=readonly [number,number,number,number];

export class BowleyPond {
 readonly x1:number;
 readonly z1:number;
 readonly bounds:readonly [number,number,number,number];
 readonly spec:BowleySpec;
 readonly bytes:Uint8Array;
 constructor(spec:BowleySpec,bytes:Uint8Array) {
  this.spec=spec;this.bytes=bytes;
  const {width,height,left,top,step,waterY,units}=spec;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||bytes.length!==width*height||
   !Number.isFinite(left+top+step+units+waterY)||step<=0||units<=0)throw Error('Invalid Bowley surface dimensions');
  this.x1=left+step*width;this.z1=top+step*height;
  this.bounds=[left,top,this.x1,this.z1];
 }
 intersects(x0:number,z0:number,x1:number,z1:number){
  const s=this.spec;
  return x1>=s.left&&x0<=this.x1&&z1>=s.top&&z0<=this.z1;
 }
 /** Pixel-centred, exactly shared with the level plane and the local land mask.
  * Negative area is a dated floating water surface, not depth. */
 distance(x:number,z:number){
  const s=this.spec;
  if(!(x>=s.left&&z>=s.top&&x<this.x1&&z<this.z1))return 127/s.units;
  const a=Math.min(s.width-1,Math.max(0,(x-s.left)/s.step-.5));
  const b=Math.min(s.height-1,Math.max(0,(z-s.top)/s.step-.5));
  const i=Math.floor(a),j=Math.floor(b),d=a-i,e=b-j,k=j*s.width+i;
  const r=i<s.width-1?1:0,t=j<s.height-1?s.width:0;
  const q=this.bytes;
  return ((((1-d)*q[k]+d*q[k+r])*(1-e)+((1-d)*q[k+t]+d*q[k+t+r])*e)-128)/s.units;
 }
 water(x:number,z:number){return this.distance(x,z)<0;}
 /** March only mixed source cells. Small exact-bilinear subcells preserve
  * bends and handle both saddle cases without default/ocean shores. */
 contours():BowleyShoreRun[]{
  const {width:w,height:h,step:s,left:l,top:t}=this.spec,raw=this.bytes,out:BowleyShoreRun[]=[];
  const divisions=2,d=s/divisions;
  const add=(x:number,z:number,a:number,b:number,c:number,e:number)=>{
   const wet=(a<0?1:0)|(b<0?2:0)|(c<0?4:0)|(e<0?8:0);
   if(wet===0||wet===15)return;
   const p:[number,number][]=[];
   if((a<0)!==(b<0))p.push([x+d*a/(a-b),z]);
   if((b<0)!==(c<0))p.push([x+d,z+d*b/(b-c)]);
   if((e<0)!==(c<0))p.push([x+d*e/(e-c),z+d]);
   if((a<0)!==(e<0))p.push([x,z+d*a/(a-e)]);
   const k0=a,kx=b-a,kz=e-a,kxz=a-b+c-e;
   const at=([lx,lz]:[number,number],[rx,rz]:[number,number],t:number):[number,number]=>{
    const u=(lx+(rx-lx)*t-x)/d,v=(lz+(rz-lz)*t-z)/d;
    if(Math.abs(rx-lx)>=Math.abs(rz-lz)){
     const den=kz+kxz*u;if(Math.abs(den)<1e-10)return [x+d*u,z+d*v];
     return [x+d*u,z-d*(k0+kx*u)/den];
    }
    const den=kx+kxz*v;if(Math.abs(den)<1e-10)return [x+d*u,z+d*v];
    return [x-d*(k0+kz*v)/den,z+d*v];
   };
   const trace=(l:[number,number],r:[number,number],depth:number)=>{
    const dx=r[0]-l[0],dz=r[1]-l[1],len=Math.hypot(dx,dz);
    if(len<1e-7)return;
    const m=at(l,r,.5);
    const gap=(p:[number,number])=>Math.abs(dx*(p[1]-l[1])-dz*(p[0]-l[0]))/len;
    const valid=m.every(Number.isFinite)&&m[0]>=x-1e-7&&m[0]<=x+d+1e-7&&m[1]>=z-1e-7&&m[1]<=z+d+1e-7;
    if(depth<5&&valid&&(len>.25||Math.max(gap(at(l,r,.25)),gap(m),gap(at(l,r,.75)))>.0015)){
     trace(l,m,depth+1);trace(m,r,depth+1);
    }else out.push([...l,...r]);
   };
   const emit=(a:number,b:number)=>trace(p[a],p[b],0);
   if(p.length===2)emit(0,1);
   else if(p.length===4){
    // Use the true asymptotic saddle, not a center-value heuristic.
    const u=-kz/kxz,v=-kx/kxz;
    const saddle=u>0&&u<1&&v>0&&v<1?k0+kx*u+kz*v+kxz*u*v:(a+b+c+e)*.25;
    if((saddle<0)===(wet===5)){emit(0,1);emit(2,3);}
    else{emit(0,3);emit(1,2);}
   }
  };
  for(let j=0;j<h-1;j++)for(let i=0;i<w-1;i++){
   const k=j*w+i,a=raw[k]-128,b=raw[k+1]-128,c=raw[k+w+1]-128,e=raw[k+w]-128;
   if((a<0)===(b<0)&&(a<0)===(c<0)&&(a<0)===(e<0))continue;
   const x=l+(i+.5)*s,z=t+(j+.5)*s;
   const field=(u:number,v:number)=>a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+e*(1-u)*v;
   for(let v=0;v<divisions;v++)for(let u=0;u<divisions;u++)
    add(x+u*d,z+v*d,field(u/divisions,v/divisions),field((u+1)/divisions,v/divisions),
     field((u+1)/divisions,(v+1)/divisions),field(u/divisions,(v+1)/divisions));
  }
  return out;
 }
}
export function bowleyAtlasMatches(terrainSha?:string,coverCompressed?:string,coverDecoded?:string){
 return terrainSha===BOWLEY_POND.terrainSha256&&coverCompressed===BOWLEY_POND.coverCompressedSha256&&coverDecoded===BOWLEY_POND.coverDecodedSha256;
}
export function loadBowleyPond(base:string,request:typeof fetch=fetch,timeoutMs=1400){
 return readCoastalPack(base+BOWLEY_POND.file,request,timeoutMs,BOWLEY_POND,raw=>{
  const bytes=new Uint8Array(raw),{width,height}=BOWLEY_POND;
  for(let x=0;x<width;x++)if(bytes[x]<128||bytes[(height-1)*width+x]<128)throw Error('Bowley texture crosses its reserve');
  for(let y=0;y<height;y++)if(bytes[y*width]<128||bytes[y*width+width-1]<128)throw Error('Bowley texture crosses its reserve');
  return new BowleyPond(BOWLEY_POND,bytes);
 });
}
