import * as THREE from 'three';

/** Original, seamless appearance test only; no image reuse or site dimensions. */
type Family = "ashlar" | "rustic" | "cut" | "slate" | "apron";
const mod = (a: number, b: number) => ((a % b) + b) % b;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const sm = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x-a)/(b-a)));
  return t*t*(3-2*t);
};
function hash(i:number,j:number,seed:number) {
  let n = Math.imul(i|0, 0x9e3779b1) ^ Math.imul(j|0, 0x85ebca6b) ^ Math.imul(seed|0, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function field(u:number,v:number,cx:number,cy:number,seed:number) {
  let x=u*cx,y=v*cy, i=Math.floor(x), j=Math.floor(y);
  const a=sm(0,1,x-i),b=sm(0,1,y-j);
  i=mod(i,cx); j=mod(j,cy);
  const k=mod(i+1,cx),l=mod(j+1,cy);
  return mix(mix(hash(i,j,seed),hash(k,j,seed),a),mix(hash(i,l,seed),hash(k,l,seed),a),b);
}
export const stoneSpan = [9.6,4.8] as const;
export function stonePoint(u0:number,v0:number,family:Family,seed=31) {
  const u=mod(u0,1),v=mod(v0,1),rusticated=family==="rustic", cut=family==="cut", slate=family==="slate", apron=family==="apron";
  const rowCount=slate?28:apron?16:rusticated?10:12;
  const y=v*rowCount, row=Math.floor(y), h=stoneSpan[1]/rowCount;
  // Unequal stone widths and variable stagger without phase changes across the texture edge.
  const x=mod(u + .05 + (row%2)*.099 + (hash(row,1,seed)-.5)*.06,1);
  let left=0, right=1, block=0; const n=slate?32:apron?30:rusticated?13:15;
  for(let i=1;i<=n;i++){
    const next=i===n?1:(i+(hash(i,row,seed+8)-.5)*.51)/n;
    if (x<next){right=next;block=i-1;break;} left=next;
  }
  const wide=Math.min(x-left,right-x)*stoneSpan[0], tall=Math.min(y-row,1+row-y)*h;
  const chip=(field(u,v,71,34,seed)-.49)*.003;
  const bed=Math.min(wide,tall)+chip, mortar=cut?0:1-sm(.003,.009,bed);
  const blockId = hash(block,row,seed+12), patch = hash(block,row,seed+48);
  const t = (blockId-.5) * (apron?.041:slate?.061:rusticated?.063:.088);
  const band=field(u,v,13,111,seed+2)-.5;
  const grains=field(u,v,222,143,seed+3)-.5;
  const low=field(u,v,39,23,seed+4)-.5;
  const pocket=sm(.66,.96,field(u,v,129,91,seed+5))*sm(.52,.86,field(u,v,63,38,seed+7));
  const wash=field(u,v,17,29,seed+18)-.5;
  const cloud=field(u,v,61,44,seed+14)-.5;
  const fill=(slate?.35:apron?.51:cut?.612:rusticated?.591:.596)+(cut?0:t)+.013*band+.035*low+.025*grains-.053*pocket+.035*cloud+.023*wash;
  const mx=mix(fill, slate?.29:apron?.47:.425+.025*grains, mortar*(rusticated?.76:.64));
  const warm=cut?.080:slate?-.027:apron?.18:rusticated?.067+(patch-.5)*.071:(patch-.5)*.101+.072;
  let raised = cut?0:rusticated?.012:apron?.0028:slate?.0018:.0028;
  raised *= sm(.002,rusticated?.019:.009,bed);
  raised += (1-mortar) * (band*(cut?.00023:.00093) + grains*(rusticated?.0015:cut?.00026:.0008) - pocket*(cut?.0009:.0022) + low*(cut?.0006:.0019));
  return {height:raised,color:[mx*(1+warm*.43),mx*(.979-warm*.10),mx*(.944-warm*.62)],rough:(slate?.80:.79)+.10*mortar+.05*low};
}

export function ashlarMaps(family:Family,size=1024){
  const width=size,height=size>>1, albedo=new Uint8Array(width*height*4), now=new Uint8Array(albedo.length), rough=new Uint8Array(albedo.length);
  const cell=new Float32Array(width*height);
  const asByte=(u:number)=>Math.round(Math.max(0,Math.min(1,u))*255);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const c=stonePoint((i+.5)/width,(j+.5)/height,family), at=j*width+i,k=4*at;
    for(let n=0;n<3;n++) {albedo[k+n]=asByte(c.color[n]);rough[k+n]=asByte(c.rough);}
    albedo[k+3]=rough[k+3]=now[k+3]=255;
    cell[at]=c.height;
  }
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const v=(x:number,y:number)=>cell[mod(y,height)*width+mod(x,width)];
    const a=(v(i-1,j)-v(i+1,j))*width/(2*stoneSpan[0]),b=(v(i,j-1)-v(i,j+1))*height/(2*stoneSpan[1]);
    const d=Math.hypot(a,b,1),k=4*(j*width+i);
    now[k]=asByte(.5+a/(2*d));now[k+1]=asByte(.5+b/(2*d));now[k+2]=asByte(.5+.5/d);
  }
  const texture=(bytes:Uint8Array,srgb=false)=>{
    const m=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
    if(srgb)m.colorSpace=THREE.SRGBColorSpace;
    m.wrapS=m.wrapT=THREE.RepeatWrapping;m.magFilter=THREE.LinearFilter;m.minFilter=THREE.LinearMipmapLinearFilter;
    m.generateMipmaps=true;m.anisotropy=4;m.needsUpdate=true;return m;
  };
  return {map:texture(albedo,true),normalMap:texture(now),roughnessMap:texture(rough),height:cell};
}
