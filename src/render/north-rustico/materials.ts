import * as T from 'three';

export type MaterialKey='siding'|'white'|'red'|'iron'|'window'|'shadow'|'seal'|'door'|'deck'|'fascia'|'optic'|'shingle'|'brick'|'chimneyCap'|'lantern'|'foundation';
export type RusticoMaterials=Record<MaterialKey,T.MeshStandardMaterial|T.MeshPhysicalMaterial>;
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const fract=(v:number)=>v-Math.floor(v);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(q:number)=>q*q*(3-2*q);
const hash=(x:number,y:number,k:number)=>{
  let h=Math.imul(x+107,374761393)^Math.imul(y+211,668265263)^Math.imul(k+19,889523592);
  h=Math.imul(h^(h>>>13),1274126177);return (((h^(h>>>16))>>>0)&0xffff)/65535;
};
const periodic=(u:number,v:number,a:number,b:number,k:number)=>{
  const x=u*a,y=v*b,X=Math.floor(x),Y=Math.floor(y);
  const wrap=(i:number,n:number)=>((i%n)+n)%n;
  const x0=wrap(X,a),x1=wrap(X+1,a),y0=wrap(Y,b),y1=wrap(Y+1,b);
  const fx=smooth(fract(x)),fy=smooth(fract(y));return mix(mix(hash(x0,y0,k),hash(x1,y0,k),fx),mix(hash(x0,y1,k),hash(x1,y1,k),fx),fy);
};
function material(hex:number,r:number,metal=0){return new T.MeshStandardMaterial({color:hex,roughness:r,metalness:metal,vertexColors:true});}
export function plainRusticoMaterials():RusticoMaterials{
  const sash=new T.MeshPhysicalMaterial({color:0x3a5258,roughness:.23,metalness:.15,clearcoat:.56,clearcoatRoughness:.23,envMapIntensity:.62,vertexColors:true});
  const lantern=new T.MeshPhysicalMaterial({color:0x476063,roughness:.205,metalness:.12,clearcoat:.64,clearcoatRoughness:.207,envMapIntensity:.37,transparent:true,opacity:.635,depthWrite:false,vertexColors:true});
  return {
    siding:material(0xe1e2db,.70,.06),white:material(0xe1e1d5,.72),red:material(0x9b352c,.435,.22),iron:material(0x333331,.53,.38),window:sash,
    shadow:material(0x282b29,.97),seal:material(0xa8a79b,.82),door:material(0xcec9b8,.74),deck:material(0x777166,.83),fascia:material(0xbfbfb1,.82),
    optic:new T.MeshPhysicalMaterial({color:0x978067,roughness:.35,metalness:.18,clearcoat:.35,envMapIntensity:.25,vertexColors:true}),
    shingle:material(0x6f443b,.96),brick:material(0x674840,.88),chimneyCap:material(0x7d726b,.82),lantern,
    foundation:material(0x666962,.96),
  };
}
type RGB=readonly [number,number,number];
type Layer={c:RGB;h:number};
function texture(bytes:Uint8Array,n:number,w:number,space:string,x:number,y:number){
  const ta=new T.DataTexture(bytes,n,w,T.RGBAFormat,T.UnsignedByteType);
  ta.colorSpace=space;ta.generateMipmaps=true;ta.minFilter=T.LinearMipmapLinearFilter;ta.magFilter=T.LinearFilter;
  ta.wrapS=ta.wrapT=T.RepeatWrapping;ta.repeat.set(1/x,1/y);ta.anisotropy=4;ta.needsUpdate=true;
  return ta;
}
function layer(m:T.MeshStandardMaterial,w:number,h:number,U:number,V:number,fn:(u:number,v:number)=>Layer,normal:true|false=true){
  const bytes=new Uint8Array(w*h*4),heights=new Float32Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const l=fn((i+.5)/w,(j+.5)/h),idx=i+j*w,o=idx*4;
    heights[idx]=l.h;for(let c=0;c<3;c++)bytes[o+c]=Math.round(clamp(l.c[c],0,255));bytes[o+3]=255;
  }
  m.color.set(0xffffff);m.map=texture(bytes,w,h,T.SRGBColorSpace,U,V);
  if(!normal)return;
  const nm=new Uint8Array(w*h*4);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const x0=(i+w-1)%w,x1=(i+1)%w,y0=(j+h-1)%h,y1=(j+1)%h;
    const X=(heights[j*w+x0]-heights[j*w+x1])*w/(2*U),Y=(heights[y0*w+i]-heights[y1*w+i])*h/(2*V);
    const z=1/Math.sqrt(1+X*X+Y*Y),o=(i+j*w)*4;
    nm[o]=Math.round((X*z*.5+.5)*255);nm[o+1]=Math.round((Y*z*.5+.5)*255);nm[o+2]=Math.round((z*.5+.5)*255);nm[o+3]=255;
  }
  m.normalMap=texture(nm,w,h,T.NoColorSpace,U,V);
}
export function makeRusticoMaterials():RusticoMaterials{
  const m=plainRusticoMaterials();
  layer(m.siding,384,384,4.16,3.072,(u,v)=>{
    const courses=24,row=Math.floor(v*courses),t=fract(v*courses);
    const snow=periodic(u,v,7,8,9)-.5, broad=periodic(u,v,3,3,45)-.5, drape=periodic(u,v,12,3,44)-.5;
    const pollen=periodic(u,v,77,44,4)-.5;
    const edge=clamp(t/.064)*(1-clamp((t-.084)/.060));
    const faintCourse=3.5*(hash(4,row,36)-.5);
    const l=220+8.6*snow+14*broad+5.9*drape+5.4*pollen+faintCourse-9.6*edge;
    return {c:[l+.9,l+.37,l-3.20+2.6*broad],h:.007*(1-t)*clamp(t/.045)+.00032*pollen+.0009*drape};
  });
  layer(m.white,128,128,2.20,1.19,(u,v)=>{
    const long=periodic(u,v,12,4,18)-.5, blur=periodic(u,v,5,3,49)-.5;
    const g=periodic(u,v,95,8,21)-.5;const c=229+7*long+7*blur+3*g;
    return {c:[c+2.1,c+1.5,c-5],h:.0015*g+.0007*long};
  });
  layer(m.deck,192,192,4.56,3.984,(u,v)=>{
    const t=fract(v*24),col=Math.floor(v*24),weather=periodic(u,v,5,6,49)-.5,gr=periodic(u,v,11,114,19)-.5;
    const c=107+22*weather+12*gr+11*(hash(7,col,88)-.5)-21*clamp((.048-t)/.048);
    return {c:[c+5,c+2,c-5],h:gr*.0018+.006*Math.min(1,t/.068)};
  });
  layer(m.red,160,160,1.9,1.58,(u,v)=>{
    const sc=periodic(u,v,52,51,79)-.5, salt=periodic(u,v,7,6,18)-.5, fade=periodic(u,v,3,3,6)-.5;
    const flick=((sc>.31)?(sc-.31)*53:0)+fade*8+salt*7;
    return {c:[147+flick,46+flick*.73,37+flick*.62],h:.0008*sc+.00065*salt};
  });
  layer(m.shingle,384,256,2.96,2.612,(u,v)=>{
    const courseN=17,row=Math.floor(v*courseN),vy=fract(v*courseN);
    const j0=fract(u+((row&1)?.049:0)+(hash(row,0,71)-.5)*.04)*9, unit=Math.floor(j0), ux=fract(j0);
    const grain=periodic(u,v,155,124,41)-.5, along=periodic(u,v,46,37,72)-.5;
    const a=periodic(u,v,7,4,32)-.5, z=hash(unit,row,17)-.5;
    const course=clamp((.071-vy)/.071), st=clamp((.021-Math.min(ux,1-ux))/.021)*(1-course);
    const dl=12*grain+8*along+18*a+13*z-15*course-10*st;
    return {c:[106+dl,62+dl*.86,52+dl*.78],h:.0011*grain+.0016*along+.0038*(1-vy)*clamp(vy/.071)-.0037*st};
  });
  layer(m.brick,256,256,1.42,1.116,(u,v)=>{
    const courseN=18,xN=7, row=Math.floor(v*courseN),vy=fract(v*courseN);
    const x=fract(u+.5/xN*(row%2))*xN,col=Math.floor(x),ux=fract(x),f=periodic(u,v,61,55,9)-.5;
    const e=Math.min(Math.min(vy,1-vy)*.62,Math.min(ux,1-ux));
    const mortar=1-clamp((e+f*.028-.014)/.032),a=hash(col,row,8)-.5, tide=periodic(u,v,13,14,41)-.5;
    const br=111+29*a+22*f+17*tide;
    return {c:[mix(br+4,142+21*f,mortar),mix(br-33,125+18*f,mortar),mix(br-39,112+14*f,mortar)],h:.0014*f+(1-mortar)*.0038};
  });
  layer(m.foundation,128,96,2.91,1.11,(u,v)=>{
    const gray=periodic(u,v,31,27,5)-.5, dust=periodic(u,v,7,3,11)-.5, c=99+15*gray+19*dust;
    return {c:[c+1.3,c+1.5,c-4.6],h:.006*gray};
  });
  return m;
}
export function releaseRusticoMaterials(m:RusticoMaterials){
  const seen=new Set<T.Texture>();
  for(const material of Object.values(m)){
    for(const tex of [material.map,material.normalMap,material.roughnessMap])if(tex&&!seen.has(tex)){seen.add(tex);tex.dispose();}
    material.dispose();
  }
}
