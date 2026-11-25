import * as T from 'three';

/** Deterministic finish, generated in memory. No imagery or queried atmosphere. */
export function seed(i:number,j:number):number {
 let k=Math.imul(i+4721,0x2c1b3c6d)^Math.imul(j-987,0x297a2d39);
 k=Math.imul(k^(k>>>15),0x1b873593);
 return ((k^(k>>>13))>>>0)/4294967296;
}
const wrap=(x:number,n:number)=>((x%n)+n)%n;
const smooth=(x:number)=>x*x*(3-2*x);
function field(u:number,v:number,n:number,m:number,s:number) {
 const p=u*n,q=v*m,x=Math.floor(p),y=Math.floor(q),fu=smooth(p-x),fv=smooth(q-y);
 const a=seed(wrap(x,n)+s,wrap(y,m)+2*s),b=seed(wrap(x+1,n)+s,wrap(y,m)+2*s);
 const c=seed(wrap(x,n)+s,wrap(y+1,m)+2*s),d=seed(wrap(x+1,n)+s,wrap(y+1,m)+2*s);
 return T.MathUtils.lerp(T.MathUtils.lerp(a,b,fu),T.MathUtils.lerp(c,d,fu),fv);
}
export type Finish = 'wall'|'roof'|'trim'|'door'|'copper'|'ground';
export function finish(kind:Finish) {
 const W=512,H=384,C=new Uint8Array(W*H*4),R=new Uint8Array(W*H*4),N=new Uint8Array(W*H*4),h=new Float32Array(W*H);
 const swatch:Record<Finish,[number,number,number]>={wall:[75,63,54],roof:[114,118,119],trim:[206,209,202],door:[201,201,192],copper:[131,89,60],ground:[117,102,91]};
 const [r,g,b]=swatch[kind];
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){
  const u=(i+.5)/W,v=(j+.5)/H,f1=field(u,v,9,12,4),f2=field(u,v,23,35,19),f3=field(u,v,91,73,373);
  const grit=seed(i,j), grain=field(u+.007*(f1-.5),v,98,6,129);
  const line=Math.max(0,grain-.51)*Math.max(0,field(u,v,36,11,268)-.17);
  const isExterior=kind==='wall'||kind==='roof',isCoated=kind==='trim'||kind==='door';
  let tint=0,rough=0.7,bump=0.0,heat=0;
  if(isExterior){
   tint=(f1-.5)*11+(f2-.5)*5+(f3-.5)*3+(grit-.5)*3-line*14;
   bump=.075*f2+.065*f3+.055*grit;rough=.58+.16*f2+.08*grain+.09*line;
   heat=kind==='wall'?(f2-.53)*2:(f1-.5)*3;
  } else if(isCoated){
   const drip=kind==='door'?field(u+.008*(f2-.5),v,64,7,215):grain;
   tint=(f1-.5)*11+(f2-.5)*4+(grit-.5)*3-Math.max(0,drip-.5)*(17+16*f2);
   bump=.037*f1+.092*f3+.056*grit;rough=.57+.16*f3+.087*drip;heat=(.5-drip)*5.2;
  } else if(kind==='copper'){
   tint=21*(f1-.5)+20*(f2-.5)+8*(f3-.5)+8*(grit-.5);
   const dark=Math.max(0,field(u,v,20,31,239)-.45);tint-=43*dark;heat=-20*dark+5*(f2-.5);
   bump=.07*f2+.13*f3+.05*grit;rough=.58+.2*f2+.11*dark;
  } else {
   const coarse=field(u+.014*f2,v+.012*f2,104,91,99),rock=field(u,v,137,143,122);
   const bits=Math.pow(Math.max(0,rock-.38)*1.4,1.7);
   tint=(f1-.5)*16+(f2-.5)*9+(coarse-.5)*20+(grit-.5)*15+bits*34;
   bump=.08*coarse+.17*bits+.04*f3+.049*grit;rough=.82+.12*f3+.05*grit;heat=(f1-.43)*7;
  }
  const p=(i+j*W)*4;C[p]=Math.max(0,Math.min(255,r+tint+heat));C[p+1]=Math.max(0,Math.min(255,g+tint));
  C[p+2]=Math.max(0,Math.min(255,b+tint-heat*.52));C[p+3]=255;
  R[p]=R[p+1]=R[p+2]=Math.round(255*rough);R[p+3]=255;h[i+j*W]=bump;
 }
 for(let j=0;j<H;j++)for(let i=0;i<W;i++){
  const p=(i+j*W)*4,dx=h[wrap(i-1,W)+j*W]-h[wrap(i+1,W)+j*W],dy=h[i+wrap(j-1,H)*W]-h[i+wrap(j+1,H)*W],n=Math.hypot(dx,dy,1);
  N[p]=Math.round(127.5+127*dx/n);N[p+1]=Math.round(127.5+127*dy/n);N[p+2]=Math.round(127.5+127/n);N[p+3]=255;
 }
 const tex=(data:Uint8Array,colour=false)=>{
  const o=new T.DataTexture(data,W,H,T.RGBAFormat,T.UnsignedByteType);o.wrapS=o.wrapT=T.RepeatWrapping;
  if(colour)o.colorSpace=T.SRGBColorSpace;o.generateMipmaps=true;o.minFilter=T.LinearMipmapLinearFilter;o.magFilter=T.LinearFilter;o.anisotropy=8;o.needsUpdate=true;return o;
 };
 return {map:tex(C,true),normalMap:tex(N),roughnessMap:tex(R)};
}
