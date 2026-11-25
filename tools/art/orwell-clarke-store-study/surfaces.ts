import * as T from 'three';

/** Analytic, project-authored surfaces. No images, external texture assets or sampled source pixels. */
const wrap=(x:number,n:number)=>((x%n)+n)%n;
export function scalar(x:number,y:number,s=73){
 let j=Math.imul(x+s,0x68bc21eb)^Math.imul(y-s,0x02e5be93);
 j=Math.imul(j^(j>>>16),0x119de1f3);return ((j^(j>>>16))>>>0)/4294967296;
}
const E=(x:number)=>x*x*(3-2*x);
function periodic(u:number,v:number,n:number,m:number,s:number){
 const x=u*n,y=v*m,a=Math.floor(x),b=Math.floor(y),f=E(x-a),g=E(y-b);
 const h=(x:number,y:number)=>scalar(wrap(x,n),wrap(y,m),s);
 return (1-g)*((1-f)*h(a,b)+f*h(a+1,b))+g*((1-f)*h(a,b+1)+f*h(a+1,b+1));
}
const PI2=Math.PI*2;
export type Kind='paint'|'door'|'wood'|'stone'|'earth';
export function makeSurface(kind:Kind){
 const w=256,h=256,size=w*h,ink=new Uint8Array(size*4),normal=new Uint8Array(size*4),rough=new Uint8Array(size*4),relief=new Float32Array(size);
 const wood=kind==='paint'||kind==='door'||kind==='wood';
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=y*w+x,i=4*a,u=(x+.5)/w,v=(y+.5)/h,speck=scalar(x,y,7),bb=periodic(u,v,12,12,19);
  let light=0,k=.86,d=0,chip=0;
  if(wood){
   // Grain follows U (the length of the stock), including jitter around a small knot.
   const knot=(u-.58)-Math.round(u-.58),delta=(v-.43)-Math.round(v-.43),dist=Math.hypot(knot*.39,delta*1.5);
   const near=Math.exp(-dist*dist*83),irreg=.008*Math.sin(PI2*u)+.008*(periodic(u,v,3,7,19)-.5)+.014*near*Math.sin(7*Math.atan2(delta,knot*.24));
   const g=periodic(u,v+irreg,8,103,119),f=periodic(u,v+irreg,9,156,251),r=.5+.5*Math.sin(PI2*(v*31+.46*Math.sin(PI2*u)+(.10+g*.19)*near));
   const worn=periodic(u,v+irreg,6,29,27),hair=1-Math.abs(2*periodic(u,v+irreg,5,137,63)-1);
   const veining=(.42*g+.23*r+.20*f+.09*hair+.06*speck);
   const ring=.5+.5*Math.sin(PI2*(dist*77+g*.25+near*.20));
   chip=kind==='paint' ? Math.max(0,.20-Math.abs(f-.17))*worn*.2 : 0;
   light=kind==='paint'?231+9*veining+8*bb-chip*135:kind==='door'?193+30*veining+19*worn-8*(1-ring)*near:169+44*veining+26*worn-22*(1-ring)*near;
   d=(kind==='paint'?.18:.30)*veining + .043*near*ring+chip;
   k=kind==='paint'?.69+.23*g+.08*f:kind==='door'?.76+.19*g:.78+.18*f;
  }else{
   const g=periodic(u,v,51,37,101),f=periodic(u+.013*Math.cos(PI2*v),v,106,82,19),f2=periodic(u,v,157,160,49);
   const lines=periodic(u+.008*Math.sin(PI2*v),v,13,49,18),klein=periodic(u,v,7,17,59);
   const pore=(.56*g+.31*f+.13*speck),del=Math.min(1,1.8*Math.abs(f2-.5));
   light=kind==='stone'?161+32*pore+34*lines+19*klein:147+45*pore+25*klein+24*bb;
   d=kind==='stone' ? .43*pore+.11*del+.13*lines : .30*pore+.18*del+.19*bb;
   k=.81+.18*f;
  }
  const tint=kind==='wood'?[1.02,1,.96]:kind==='stone'?[1.02,1.01,.98]:kind==='earth'?[1.08,1,.90]:[1,1,.996];
  ink[i]=Math.min(255,light*tint[0]);ink[i+1]=Math.min(255,light*tint[1]);ink[i+2]=Math.min(255,light*tint[2]);ink[i+3]=255;
  rough[i]=rough[i+1]=rough[i+2]=Math.round(255*k);rough[i+3]=255;
  relief[a]=d;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const t=(y*w+x)*4,dx=-(relief[y*w+wrap(x+1,w)]-relief[y*w+wrap(x-1,w)])*1.4,dy=-(relief[wrap(y+1,h)*w+x]-relief[wrap(y-1,h)*w+x])*1.4,j=Math.hypot(dx,dy,1);
  normal[t]=(dx/j*.5+.5)*255;normal[t+1]=(dy/j*.5+.5)*255;normal[t+2]=(1/j*.5+.5)*255;normal[t+3]=255;
 }
 function tex(data:Uint8Array,color=false){
  const t=new T.DataTexture(data,w,h);t.wrapS=t.wrapT=T.RepeatWrapping;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=6;if(color)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;
 }
 return{map:tex(ink,true),normalMap:tex(normal),roughnessMap:tex(rough)};
}
/** Self-contained green-channel alpha sheet for directional shadowing, generated from point clusters. */
export function makeLeafScreen(){
 const n=320,buf=new Uint8Array(n*n*4);
 const centers=Array.from({length:29},(_,i)=>[scalar(i,2)*1.24-.12,scalar(i,6)*1.13-.065,.025+.135*scalar(i,50),.41+.64*scalar(i,68)]);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n,v=y/n,a=(y*n+x)*4;
  let cluster=0;
  for(const [p,q,r,o]of centers){const d=Math.hypot(u-p,(v-q)*o)/r;cluster=Math.max(cluster,1-d);}
  const twig=Math.max(0,.0042*(1-v)-Math.abs(u-(.52+.36*v+.046*Math.sin(PI2*v))))*81;
  const holes=.55*periodic(u,v,97,83,41)+.29*periodic(u,v,54,56,174)+.16*periodic(u,v,238,227,71);
  const foliage=Math.max(0,Math.min(1,(cluster+twig+(holes-.63)*.88-.17)*4.9));
  buf[a]=buf[a+1]=buf[a+2]=Math.round(foliage*255);buf[a+3]=255;
 }
 const t=new T.DataTexture(buf,n,n);t.generateMipmaps=true;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.needsUpdate=true;return t;
}
