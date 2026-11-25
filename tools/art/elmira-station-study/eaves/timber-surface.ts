// Author-painted, deterministic wood grain from periodic scalar fields.
// No photos, swatches sampled from photos, glyph bitmaps, or external textures.
import * as T from 'three';
const TPI=Math.PI*2, ease=(t:number)=>t*t*(3-2*t);
function hash(x:number,y:number,seed:number){
 let h=Math.imul(x^seed,0x45d9f3b)^Math.imul(y+seed,0x119de1f3);
 h=Math.imul(h^(h>>>16),0x27d4eb2d);return ((h^(h>>>15))>>>0)/4294967296;
}
function fnoise(u:number,v:number,n:number,m:number,seed:number){
 const a=u*n,b=v*m,i=Math.floor(a),j=Math.floor(b),fx=ease(a-i),fy=ease(b-j);
 const h=(x:number,y:number)=>hash((x%n+n)%n,(y%m+m)%m,seed);
 return (1-fy)*((1-fx)*h(i,j)+fx*h(i+1,j))+fy*((1-fx)*h(i,j+1)+fx*h(i+1,j+1));
}
export function cedarSurface(worn=false){
 const w=256,h=256,ink=new Uint8Array(w*h*4),normal=new Uint8Array(w*h*4),rgh=new Uint8Array(w*h*4),height=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w,v=(y+.5)/h,at=(y*w+x)*4;
  const wander=.009*Math.sin(TPI*v)+.009*(fnoise(u,v,5,4,23)-.5);
  const cx=.43+.012*Math.sin(TPI*(v+.07)),kx=(u-cx)-Math.round(u-cx),ky=(v-.49)-Math.round(v-.49);
  const knotDist=Math.hypot(kx*2.05,ky*.59),knotHalo=Math.exp(-knotDist*knotDist/.0053);
  const U=u+wander+(worn?.017:.005)*knotHalo*Math.sin(6.6*Math.atan2(ky*.7,kx*2.0)), fibre=fnoise(U,v,149,11,119),summer=fnoise(U,v,67,5,177),broad=fnoise(U,v,9,3,261),speck=fnoise(u,v,149,126,329);
  const line=.5+.5*Math.sin(TPI*(u*41+(.57+.13*Math.sin(TPI*2*u))*Math.sin(TPI*v)+summer*.18));
  // Narrow grooves carry edge glints and directional roughness; washed fibres stay matte.
  const rings=.5+.5*Math.sin(TPI*(knotDist*71+fibre*.23+summer*.10));
  const growth=.52*fibre+.23*summer+.15*line+.10*speck;
  const ridges=growth+(worn?.13:.035)*(rings-.45)*knotHalo;
  height[y*w+x]=ridges;
  const silver=fnoise(U,v,15,6,662);
  const lum=Math.round(worn?166+32*broad+36*ridges+12*silver+6*speck-17*knotHalo*(1-rings):206+19*broad+20*ridges+8*speck);

  ink[at]=lum;ink[at+1]=Math.min(255,lum+(worn?-1:1));ink[at+2]=Math.min(255,lum+(worn?-5:1));ink[at+3]=255;
  const rough=(worn?178:160)+Math.floor(48*fibre+17*speck);rgh[at]=rgh[at+1]=rgh[at+2]=rough;rgh[at+3]=255;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,dx=-(height[y*w+(x+1)%w]-height[y*w+(x+w-1)%w])*1.02,dy=-(height[((y+1)%h)*w+x]-height[((y+h-1)%h)*w+x])*.78,len=Math.hypot(dx,dy,1);
  normal[i]=Math.round((.5+.5*dx/len)*255);normal[i+1]=Math.round((.5+.5*dy/len)*255);normal[i+2]=Math.round((.5+.5/len)*255);normal[i+3]=255;
 }
 function create(buf:Uint8Array,isColor=false){
  const t=new T.DataTexture(buf,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;
  if(isColor)t.colorSpace=T.SRGBColorSpace;
  t.anisotropy=4;t.needsUpdate=true;return t;
 }
 return {map:create(ink,true),normalMap:create(normal),roughnessMap:create(rgh)};
}
