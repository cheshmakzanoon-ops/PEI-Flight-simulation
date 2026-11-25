import * as T from 'three';

// Closed periodic fields, designed here. None are materials sampled from site photos.
const mod=(a:number,b:number)=>((a%b)+b)%b;
export function rand(x:number,y:number){let h=Math.imul(x+37,0x68bc21eb)^Math.imul(y-199,0x02e5be93);h=Math.imul(h^(h>>>16),0x119de1f3);return((h^(h>>>16))>>>0)/4294967296;}
const ease=(t:number)=>t*t*(3-2*t);
function f(u:number,v:number,k:number,l:number,s:number){
 const a=k*u,b=l*v,x=Math.floor(a),y=Math.floor(b),x0=ease(a-x),y0=ease(b-y);
 const p=(i:number,j:number)=>rand(mod(i,k)+s,mod(j,l)+s);
 return(1-y0)*((1-x0)*p(x,y)+x0*p(x+1,y))+y0*((1-x0)*p(x,y+1)+x0*p(x+1,y+1));
}
type Surface='red-clay'|'lime'|'stone'|'paint'|'ground';
export function tignishMaterial(kind:Surface){
 const W=384,H=256,size=W*H,A=new Uint8Array(4*size),R=new Uint8Array(4*size),N=new Uint8Array(4*size),bump=new Float32Array(size);
 const sat=(x:number)=>Math.min(1,Math.max(0,x)),to8=(x:number)=>Math.min(255,Math.max(0,Math.round(x)));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=x+y*W,at=4*i,u=(x+.5)/W,v=(y+.5)/H,point=rand(x,y);
  const slab=f(u,v,5,8,39),cloud=f(u+.013*Math.sin(v*6.283),v,27,22,87),holes=f(u,v,107,95,177),freck=f(u,v,167,127,211),pits=sat((.205-holes)*4.7);
  const score=f(u,v+.008*Math.cos(u*6.283),15,59,61),kiln=f(u,v,17,14,76)*.65+cloud*.35;
  let grey=0,r=0,g=0,b=0,rough=.9,depth=.2;
  if(kind==='red-clay'){
   const run=sat((slab*.42+cloud*.24+f(u,v,8,72,75)*.34-.61)*2.7);
   const scuff=sat((score*.67+freck*.12+slab*.21-.70)*2.45);
   grey=170+38*kiln+20*slab+10*cloud-30*pits+11*(point-.5)+16*scuff;
   r=grey+8+2*run;g=grey+1+9*run;b=grey-5+11*run;rough=.86+.067*holes+.045*score;depth=.44*holes+.11*freck+.13*score+.12*cloud-.32*pits;
  }else if(kind==='lime'){
   grey=169+29*cloud+24*holes+17*freck-19*pits+10*point;
   r=grey+5;g=grey+4;b=grey+1;depth=.56*holes+.155*freck+.17*cloud-.21*pits;rough=.87+.09*freck;
  }else if(kind==='stone'){
   grey=151+35*score+20*cloud+33*holes+12*slab+6*point-17*pits;
   r=grey+4;g=grey+4;b=grey;depth=.38*holes+.15*freck+.32*score-.28*pits;rough=.83+.14*holes;
  }else if(kind==='paint'){
   const fibre=f(u,v,7,114,152),layers=f(u,v,8,46,228);
   grey=225+17*fibre+7*slab+5*point;
   r=grey+2;g=grey;b=grey-3;depth=.16*fibre+.11*layers+.06*holes;rough=.65+.19*cloud+.13*fibre;
  }else{
   const sediment=f(u,v,11,10,88),weed=f(u,v,6,9,227);
   grey=135+26*sediment+31*holes+13*slab+19*point; r=grey+5;g=grey+1+7*weed;b=grey-8;
   depth=.28*cloud+.27*holes+.135*freck;rough=.93+.04*point;
  }
  A[at]=to8(r);A[at+1]=to8(g);A[at+2]=to8(b);A[at+3]=255;R[at]=R[at+1]=R[at+2]=to8(255*rough);R[at+3]=255;bump[i]=depth;
 }
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=4*(x+y*W),dx=(bump[y*W+mod(x-1,W)]-bump[y*W+(x+1)%W])*1.71,dy=(bump[mod(y-1,H)*W+x]-bump[((y+1)%H)*W+x])*1.5,L=Math.hypot(dx,dy,1);
  N[i]=to8((.5+dx/L/2)*255);N[i+1]=to8((.5+dy/L/2)*255);N[i+2]=to8((.5+.5/L)*255);N[i+3]=255;
 }
 function tex(buf:Uint8Array,colour=false){
  const t=new T.DataTexture(buf,W,H);t.wrapS=t.wrapT=T.RepeatWrapping;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=6;if(colour)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;
 }
 return{map:tex(A,true),normalMap:tex(N),roughnessMap:tex(R)};
}

/** Soft studio tree shadow only: three clustered lobes and fine perforations; no surveyed tree. */
export function tignishCanopy(){
 const n=288,buf=new Uint8Array(4*n*n);
 const spots=Array.from({length:23},(_,i)=>({x:.24+rand(i,3)*.69,y:.20+rand(i,78)*.87,w:.039+rand(i,45)*.173,q:.69+.36*rand(i,17)}));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n,v=y/n,i=(x+y*n)*4;
  let l=0;
  for(const p of spots)l=Math.max(l,1-Math.hypot(u-p.x,(v-p.y)*p.q)/p.w);
  const edge=f(u,v,73,88,251)*.64+f(u,v,39,52,108)*.36;
  buf[i]=buf[i+1]=buf[i+2]=Math.min(255,Math.max(0,293*(l+edge-.51)));
  buf[i+3]=255;
 }
 const m=new T.DataTexture(buf,n,n);m.magFilter=T.LinearFilter;m.minFilter=T.LinearMipmapLinearFilter;m.generateMipmaps=true;m.needsUpdate=true;return m;
}
