import * as T from 'three';

// Original finish maps generated from periodic scalar fields, not from building imagery.
const wrap=(i:number,n:number)=>(i%n+n)%n;
export const r=(i:number,j:number)=>{let h=Math.imul(i+17,0x78bc21eb)^Math.imul(j-199,0x02e5be93);h=Math.imul(h^(h>>>16),0x119de1f3);return ((h^(h>>>16))>>>0)/4294967296;};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t,ease=(a:number)=>a*a*(3-2*a);
function f(u:number,v:number,n:number,m:number,k:number){
 const u0=u*n,v0=v*m,i=Math.floor(u0),j=Math.floor(v0),a=ease(u0-i),b=ease(v0-j),o=(i:number,j:number)=>r(wrap(i,n)+k,wrap(j,m)+k);
 return lerp(lerp(o(i,j),o(i+1,j),a),lerp(o(i,j+1),o(i+1,j+1),a),b);
}
export function finish(kind:'paint'|'siding'|'granular'){
 const W=384,H=256,C=new Uint8Array(W*H*4),R=new Uint8Array(W*H*4),N=new Uint8Array(W*H*4),Y=new Float32Array(W*H);
 const clamp=(a:number)=>Math.min(255,Math.max(0,a));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const u=(x+.5)/W,v=(y+.5)/H,i=x+y*W,p=i*4,grit=r(x,y),macro=f(u,v,7,10,133),meso=f(u,v,43,31,211);
  let value,k,d,cr,cg,cb;
  if(kind==='granular'){
   const micro=f(u,v,151,139,33),dirt=f(u+.019*Math.cos(6.283*v),v,19,55,61),spall=f(u,v,111,127,72);
   const blur=f(u,v,13,8,167);
   const pores=Math.max(0,(.39-micro)*1.7);value=157+21*blur+18*meso+11*grit+31*spall-16*pores;
   k=.84+.09*micro+.064*grit;d=.45*micro+.17*spall+.13*meso+.12*grit-.21*pores;cr=3+5*dirt;cg=1;cb=-3+2*blur;
  }else{
   const fibre=f(u,v+.012*Math.sin(u*6.283)+.008*(macro-.5),8,122,183),ceruse=f(u,v,17,62,81),run=f(u,v,40,53,17);
   value=(kind==='paint'?225:211)+10*macro+13*fibre+7*ceruse+5*grit+4*run;
   d=.25*fibre+.093*ceruse+.077*grit+.053*meso;k=.71+.19*fibre+.083*run;cr=kind==='paint'?2:5;cg=1;cb=kind==='paint'?-1:-4;
  }
  C[p]=clamp(value+cr);C[p+1]=clamp(value+cg);C[p+2]=clamp(value+cb);C[p+3]=255;
  R[p]=R[p+1]=R[p+2]=255*k;R[p+3]=255;Y[i]=d;
 }
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const j=4*(y*W+x),dx=-(Y[y*W+wrap(x+1,W)]-Y[y*W+wrap(x-1,W)])*1.9,dy=-(Y[wrap(y+1,H)*W+x]-Y[wrap(y-1,H)*W+x])*1.6,e=Math.hypot(dx,dy,1);
  N[j]=255*(.5+dx/e*.5);N[j+1]=255*(.5+dy/e*.5);N[j+2]=255*(.5+.5/e);N[j+3]=255;
 }
 function tex(data:Uint8Array,colour=false){
  const t=new T.DataTexture(data,W,H);t.wrapS=t.wrapT=T.RepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;
  t.anisotropy=8;if(colour)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;
 }
 return{map:tex(C,true),normalMap:tex(N),roughnessMap:tex(R)};
}
