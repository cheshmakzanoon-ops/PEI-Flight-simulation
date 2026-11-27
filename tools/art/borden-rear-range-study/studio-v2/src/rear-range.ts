import * as T from 'three';

/** Detached historic exterior study. These are editable local artist dimensions, not an OGL fit.
 * 12.8 m overall is documentary; individual levels, section widths and all axis bearings are inferred.
 * No anchor, grade, lighting apparatus, stock-owner removal, side stairs, lower structure, or site code.
 */
export interface TowerDimensions {
 shaftBase: number;
 shaftNeck: number;
 shaftTop: number;
 gallerySide: number;
 galleryDepth: number;
 galleryTop: number;
 railHeight: number;
 lanternSide: number;
 lanternEave: number;
 capSide: number;
 capApex: number;
 finialTop: number;
}
export const BORDEN_STUDY_DIMENSIONS: Readonly<TowerDimensions> = Object.freeze({
 shaftBase:5.28,shaftNeck:2.47,shaftTop:9.49,
 gallerySide:3.67,galleryDepth:.19,galleryTop:9.67,railHeight:.88,
 lanternSide:1.93,lanternEave:11.81,capSide:2.22,capApex:12.48,finialTop:12.8,
});
export type Level='close'|'medium';
type Key='shaft'|'gallery'|'bracket'|'guard'|'lantern'|'cap'|'terminal';
type P=readonly [number,number,number];
type UV=readonly [number,number];
export type Span=readonly [number,number];
export type TowerArt={mesh:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 roles:Readonly<Record<Key,Span>>; upperSash:Span; dimensions:Readonly<TowerDimensions>; detail:Level};
const up=new T.Vector3(0,1,0);
const KEY='borden-rear-white-shingle-detached-v2';
const C={
 // Original daylight material names/colors, not calibrated or copied from photography.
 white:0xdcd9d0,eave:0xe3e0d7,bottom:0xc1beb1,iron:0x909183,
 rail:0x51504b,post:0x68615b,red:0x934039,roof:0x93433a,tin:0x773a34,
 liner:0x52433e,capTip:0x713532,
 case:0xdad4c7,lanternWhite:0xcac5b8,lanternSill:0xbeb4a4,shutter:0x873e36,
 oxide:0x82766d,jamb:0x827568,brow:0x878276,lightGlass:0x627476,shGlass:0x475b5d,
};
const V=(a:P)=>new T.Vector3(...a);
const point=(a:T.Vector3):P=>[a.x,a.y,a.z];
function dimensions(input:Partial<TowerDimensions>):Readonly<TowerDimensions>{
 const d={...BORDEN_STUDY_DIMENSIONS,...input};
 if(Object.keys(d).length!==Object.keys(BORDEN_STUDY_DIMENSIONS).length||
  Object.values(d).some(v=>!Number.isFinite(v))||
  !(4.9<=d.shaftBase&&d.shaftBase<=5.8&&d.shaftNeck>2.05&&
    d.shaftNeck<d.gallerySide-.52&&d.gallerySide<d.shaftBase-.3&&
    d.shaftTop>8.65&&d.shaftTop<10.15&&d.galleryDepth>.1&&d.galleryDepth<.36&&
    d.galleryTop-d.galleryDepth<=d.shaftTop&&d.galleryTop-d.galleryDepth>d.shaftTop-.03&&
    d.railHeight>.63&&d.railHeight<1.15&&d.lanternSide>1.55&&d.lanternSide<d.shaftNeck-.25&&
    d.capSide>d.lanternSide+.12&&d.capSide<d.shaftNeck+.12&&
    d.lanternEave>d.galleryTop+d.railHeight+.56&&d.lanternEave<d.capApex-.42&&
    d.capApex<d.finialTop-.10&&d.capApex>d.finialTop-.48&&d.finialTop===12.8))
  throw new RangeError('Unsupported illustrative Borden tower dimensions');
 return Object.freeze(d);
}
class Batch {
 private pos:number[]=[]; private norm:number[]=[]; private col:number[]=[];
 private tex:number[]=[]; private clad:number[]=[];
 readonly roles={} as Record<Key,Span>;
 get count(){return this.pos.length/3;}
 private colors=new Map<number,T.Color>();
 role(key:Key,emit:()=>void){
  if(key in this.roles)throw new Error('Duplicate tower role');
  const a=this.pos.length/3;
  emit();
  const b=this.pos.length/3;
  if(a===b||b%3)throw new Error('Broken tower role');
  this.roles[key]=Object.freeze([a,b]);
 }
 tri(a:P,b:P,c:P,rgb:number,uv?:readonly [UV,UV,UV]){
  const n=V(b).sub(V(a)).cross(V(c).sub(V(a)));
  if(n.lengthSq()<1e-15)throw new Error('Degenerate tower triangle');
  n.normalize();
  let col=this.colors.get(rgb);
  if(!col){col=new T.Color(rgb);this.colors.set(rgb,col);}
  for(const [j,q] of [a,b,c].entries()){
   this.pos.push(...q);this.norm.push(n.x,n.y,n.z);
   this.col.push(col.r,col.g,col.b);
   this.tex.push(...(uv?.[j]??[0,0]));this.clad.push(uv?1:0);
  }
 }
 quad(a:P,b:P,c:P,d:P,rgb:number,uv?:readonly [UV,UV,UV,UV]){
  this.tri(a,b,c,rgb,uv&&[uv[0],uv[1],uv[2]]);
  this.tri(a,c,d,rgb,uv&&[uv[0],uv[2],uv[3]]);
 }
 box(cx:number,cy:number,cz:number,w:number,h:number,l:number,rgb:number){
  for(let i=0;i<6;i++){
   const m=boxFaces[i],v=m.map(([x,y,z])=>[cx+x*w/2,cy+y*h/2,cz+z*l/2] as P);
   this.quad(v[0],v[1],v[2],v[3],rgb);
  }
 }
 beam(a:P,b:P,w:number,rgb:number,d=w){
  const av=V(a),bv=V(b),dir=bv.clone().sub(av),len=dir.length();
  if(len<1e-5)throw new Error('Short tower bracket');
  const q=new T.Quaternion().setFromUnitVectors(up,dir.divideScalar(len));
  const mid=av.lerp(bv,.5);
  for(const face of boxFaces){
   const v=face.map(([x,y,z])=>point(new T.Vector3(x*w/2,y*len/2,z*d/2).applyQuaternion(q).add(mid)));
   this.quad(v[0],v[1],v[2],v[3],rgb);
  }
 }
 finish(close:boolean){
  const g=new T.BufferGeometry();
  for(const [k,values,size] of [['position',this.pos,3],['normal',this.norm,3],['color',this.col,3]] as const)
   g.setAttribute(k,new T.Float32BufferAttribute(values,size));
  if(close){
   g.setAttribute('bordenCladUv',new T.Float32BufferAttribute(this.tex,2));
   g.setAttribute('bordenClad',new T.Float32BufferAttribute(this.clad,1));
  }
  g.computeBoundingBox();g.computeBoundingSphere();
  return g;
 }
}
const boxFaces:readonly (readonly P[])[]=[
 [[-1,-1,-1],[-1,1,-1],[1,1,-1],[1,-1,-1]],
 [[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],
 [[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,1]],
 [[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],
 [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],
 [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],
];
const ring=(side:number,y:number):P[]=>{
 const a=side*.5;return [[-a,y,-a],[a,y,-a],[a,y,a],[-a,y,a]];
};
// Four cardinal local outward normals and their increasing horizontal right-hand tangent.
const siteP=(face:number,y:number,d:number,u:number):P=>
 face===0?[u,y,-d]:face===1?[d,y,u]:face===2?[-u,y,d]:[-d,y,-u];
const siteQ=(b:Batch,f:number,d:number,u0:number,u1:number,y0:number,y1:number,rgb:number)=>{
 b.quad(siteP(f,y0,d,u0),siteP(f,y1,d,u0),siteP(f,y1,d,u1),siteP(f,y0,d,u1),rgb);
};
const wallR=(d:Readonly<TowerDimensions>,y:number)=>d.shaftBase*.5+(d.shaftNeck-d.shaftBase)*.5*y/d.shaftTop;
const SHAFT_SASH=Object.freeze({face:1,left:-.21,right:.31,sill:5.76,head:6.94,inset:.075,footBreak:.105});
function shaftParts(b:Batch,d:Readonly<TowerDimensions>,detail:boolean):Span {
 const a=SHAFT_SASH,SF=a.face;
 const at=(f:number,y:number,u:number,offset=0)=>siteP(f,y,wallR(d,y)+offset,u);
 const ab=(f:number,y:number)=>[-wallR(d,y),...(f===SF?[a.left,a.right]:[]),wallR(d,y)];
 const rows=[0,a.footBreak,a.sill,a.head,d.shaftTop];
 for(let f=0;f<4;f++){
  for(let j=0;j<rows.length-1;j++){
   const y0=rows[j],y1=rows[j+1],k0=ab(f,y0),k1=ab(f,y1);
   for(let i=0;i<k0.length-1;i++){
    if(f===SF&&j===2&&i===1)continue;
    const w0=k0[i],w1=k0[i+1],u0=k1[i],u1=k1[i+1];
    b.quad(at(f,y0,w0),at(f,y1,u0),at(f,y1,u1),at(f,y0,w1),j?C.white:C.oxide,
     j&&detail?[[w0,y0],[u0,y1],[u1,y1],[w1,y0]]:undefined);
   }
  }
  // Weld to each segmented shell edge exactly. No lost foot corners / non-planar lip.
  const lo=ab(f,0),hi=ab(f,d.shaftTop);
  for(let i=0;i<lo.length-1;i++)b.tri([0,0,0],at(f,0,lo[i]),at(f,0,lo[i+1]),C.bottom);
  for(let i=0;i<hi.length-1;i++)b.tri([0,d.shaftTop,0],at(f,d.shaftTop,hi[i+1]),at(f,d.shaftTop,hi[i]),C.eave);
 }
 // Closed hard sash aperture, following the exact tapered substrate plane.
 const start=b.count,{left:l,right:r,sill:s,head:h,inset:w}=a;
 b.quad(at(SF,s,l),at(SF,h,l),at(SF,h,l,-w),at(SF,s,l,-w),C.jamb);
 b.quad(at(SF,s,r,-w),at(SF,h,r,-w),at(SF,h,r),at(SF,s,r),C.jamb);
 b.quad(at(SF,h,l),at(SF,h,r),at(SF,h,r,-w),at(SF,h,l,-w),C.jamb);
 b.quad(at(SF,s,l,-w),at(SF,s,r,-w),at(SF,s,r),at(SF,s,l),C.case);
 b.quad(at(SF,s,l,-w),at(SF,h,l,-w),at(SF,h,r,-w),at(SF,s,r,-w),C.shGlass);
 // Slim joinery, which remains visible as actual edge depth rather than a painted rectangle.
 const inset=-.046,trim=detail?.036:.044;
 for(const u of [l+.025,r-.025])
  b.beam(at(SF,s+.007,u,inset),at(SF,h-.012,u,inset),trim,C.red);
 const mid=s+(h-s)*.45;
 b.beam(at(SF,mid,l+.027,inset),at(SF,mid,r-.027,inset),trim,C.case);
 if(detail)b.beam(at(SF,mid,(l+r)/2,-.055),at(SF,h-.012,(l+r)/2,-.055),.022,C.case);
 const bl=l-.055,br=r+.055;
 // Shed brow: fitted high back and shallow shed roof toward the opening, no added lower annex.
 const high=h+.11,low=h+.047,front=.108,back=-.029,thick=.038;
 const A=at(SF,high,bl,back),B=at(SF,high,br,back),P=at(SF,low,bl,front),Q=at(SF,low,br,front);
 const A0=at(SF,high-thick,bl,back),B0=at(SF,high-thick,br,back),P0=at(SF,low-thick,bl,front),Q0=at(SF,low-thick,br,front);
 b.quad(A,B,Q,P,C.brow); b.quad(P0,P,Q,Q0,C.case);
 b.quad(A0,B0,B,A,C.jamb); b.quad(A0,A,P,P0,C.case);
 b.quad(B0,Q0,Q,B,C.case); b.quad(A0,P0,Q0,B0,C.jamb);
 return Object.freeze([start,b.count]);
}
function backedLantern(b:Batch,d:Readonly<TowerDimensions>,detail:boolean) {
 const r=d.lanternSide*.5,y0=d.galleryTop+.136,y1=d.lanternEave-.10;
 const h0=y0+.21,h1=y1-.17;
 for(let f=0;f<4;f++){
  const primary=f===2,secondary=f===3,open=primary||secondary;
  const a=primary?.38:secondary?.29:f===0?.43:.31;
  const center=primary?-.05:secondary?.235:f===0?.13:-.12;
  const A=center-a,B=center+a;
  // Continuous light timber casing and red backing; never a cladding decal.
  siteQ(b,f,r,-r,-r+.125,y0,y1,C.case);
  siteQ(b,f,r,r-.125,r,y0,y1,C.case);
  siteQ(b,f,r,-r+.125,r-.125,y0,y0+.118,C.lanternSill);
  siteQ(b,f,r,-r+.125,r-.125,y1-.145,y1,C.case);
  const lo=y0+.118,hi=y1-.145;
  siteQ(b,f,r,-r+.125,A,lo,hi,C.lanternWhite);
  siteQ(b,f,r,B,r-.125,lo,hi,C.lanternWhite);
  siteQ(b,f,r,A,B,lo,h0,C.red);siteQ(b,f,r,A,B,h1,hi,C.red);
  if(!open){
   // Protected, possibly shuttered side: no added glass lantern/light or false optics.
   siteQ(b,f,r,A,B,h0,h1,C.shutter);continue;
  }
  const u=r-(primary?.108:.078),liner=primary?C.liner:C.jamb;
  b.quad(siteP(f,h0,r,A),siteP(f,h1,r,A),siteP(f,h1,u,A),siteP(f,h0,u,A),liner);
  b.quad(siteP(f,h0,u,B),siteP(f,h1,u,B),siteP(f,h1,r,B),siteP(f,h0,r,B),liner);
  b.quad(siteP(f,h1,r,A),siteP(f,h1,r,B),siteP(f,h1,u,B),siteP(f,h1,u,A),C.liner);
  b.quad(siteP(f,h0,u,A),siteP(f,h0,u,B),siteP(f,h0,r,B),siteP(f,h0,r,A),C.lanternSill);
  // Matte depth-backed historic openings. No emitted light, literal window pane count, or mirror.
  const pane=primary?C.lightGlass:C.shGlass;
  siteQ(b,f,u,A,B,h0,h1,pane);
  for(const w of (detail||primary?[A+.027,B-.027]:[]))b.beam(siteP(f,h0,r-.045,w),siteP(f,h1,r-.045,w),.052,C.case);
  const middle=h0+(h1-h0)*.53;
  b.beam(siteP(f,middle,r-.045,A),siteP(f,middle,r-.045,B),detail?.041:.047,primary?C.case:C.red);
  if(detail&&primary)b.beam(siteP(f,middle,r-.056,center),siteP(f,h1,r-.056,center),.029,C.case);
 }
}
function shingledCoat(close:boolean) {
 const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:T.FrontSide,
  roughness:.83,metalness:.01,transparent:false,depthWrite:true, depthTest:true});
 if(!close)return m;
 m.customProgramCacheKey=()=>KEY;
 m.onBeforeCompile=shader=>{
  const vs='#include <begin_vertex>',fs='#include <color_fragment>';
  if(shader.vertexShader.split(vs).length!==2||shader.fragmentShader.split(fs).length!==2)
   throw new Error('Unexpected Three opaque shingle anchors');
  shader.vertexShader='attribute vec2 bordenCladUv;\nattribute float bordenClad;\nvarying vec2 vBordenCladUv;\nvarying float vBordenClad;\nvarying vec3 vBordenWorldLocal;\n'+
   shader.vertexShader.replace(vs,vs+'\nvBordenCladUv = bordenCladUv;\nvBordenClad = bordenClad;\nvBordenWorldLocal = position;');
  shader.fragmentShader=`varying vec2 vBordenCladUv;
varying float vBordenClad;
varying vec3 vBordenWorldLocal;
float bordenRND(vec2 a) {
 return fract(sin(dot(a,vec2(9.4187,18.1361)))*4365.3387);
}
float borden3(vec3 a) {
 vec3 b=fract(a*vec3(.1031,.11369,.13787));
 b+=dot(b,b.yxz+28.39);
 return fract((b.x+b.y)*b.z);
}
float bordenCloud(vec3 p) {
 vec3 a=floor(p), b=fract(p); b=b*b*(3.-2.*b);
 return mix(mix(mix(borden3(a),borden3(a+vec3(1,0,0)),b.x),mix(borden3(a+vec3(0,1,0)),borden3(a+vec3(1,1,0)),b.x),b.y),
   mix(mix(borden3(a+vec3(0,0,1)),borden3(a+vec3(1,0,1)),b.x),mix(borden3(a+vec3(0,1,1)),borden3(a+vec3(1,1,1)),b.x),b.y),b.z);
}
`+shader.fragmentShader.replace(fs,fs+`
     // Inferred paint over staggered shingles, no data texture or point-height input.
     // Preserve end lap at optical scale while damping subpixel drift.
     vec2 bordenUV=vBordenCladUv;
     float bordenPhase = .052*sin(bordenUV.x*2.11+bordenUV.y*.51)+.036*sin(bordenUV.x*5.48-bordenUV.y*1.54);
     float bordenRow = bordenUV.y*7.20 + bordenPhase;
     float bordenAcross=bordenUV.x*4.75 + .067*sin(bordenUV.y*2.14-bordenUV.x*.73);
     vec2 bordenAa=max(fwidth(vec2(bordenAcross,bordenRow)),vec2(.002));
     if(vBordenClad>.5){
     float bordenT=fract(bordenRow);
     float bordenRI=floor(bordenRow);
     float bordenShuffle=fract(sin(bordenRI*6.7431)*2791.131)-.5;
     float bordenAlong=bordenAcross+mod(bordenRI,2.)*.43+.23*bordenShuffle;
     float bordenLap=1.-smoothstep(.026,.089+bordenAa.y,min(bordenT,1.-bordenT));
     float bordenS=fract(bordenAlong);
     float bordenSide=1.-smoothstep(.027,.059+bordenAa.x,min(bordenS,1.-bordenS));
     float bordenAaRow=1.-smoothstep(.15,.46,bordenAa.y);
     float bordenAaSide=(1.-smoothstep(.12,.42,bordenAa.x))*bordenAaRow;
     float bordenPiece=bordenRND(floor(vec2(bordenAlong,bordenRI)))-.5;
     // Irregular broad and mid-metre paint age, continuous across face corners in local 3D.
     float bordenDrift=bordenCloud(vBordenWorldLocal*.59)-.49;
     float bordenWear=bordenCloud(vBordenWorldLocal*2.21+vec3(1.1,3.27,-5.16))-.49;
     float bordenPatch=smoothstep(.55,.88,bordenCloud(vBordenWorldLocal*12.1+vec3(7.,-11.,3.)));
     float bordenSmall=bordenPatch*(1.-smoothstep(.23,.60,max(bordenAa.x,bordenAa.y)));
     float bordenCoat=.014+.029*bordenDrift+.038*bordenWear-.073*bordenSmall;
     float bordenSmallGrain=.044*bordenPiece-.026*bordenSide;
     diffuseColor.rgb*=(1.+vBordenClad*(bordenCoat
      +bordenAaRow*(.015-.068*bordenLap)+bordenAaSide*bordenSmallGrain));
     }`);
 };
 return m;
}
export function buildBordenRearTower(level:Level,input:Partial<TowerDimensions>={}):TowerArt{
 if(level!=='close'&&level!=='medium')throw new TypeError('Unsupported detached visual LOD');
 const d=dimensions(input),b=new Batch(),detail=level==='close';
 let upperSash:Span=[0,0];
 b.role('shaft',()=>{upperSash=shaftParts(b,d,detail);});
 b.role('gallery',()=>{
  // One tight shallow local gallery on the shaft; intentionally not the ground-level park platform.
  b.box(0,d.galleryTop-d.galleryDepth*.5,0,d.gallerySide,d.galleryDepth,d.gallerySide,C.eave);
  const threshold=d.lanternSide+.17;
  b.box(0,d.galleryTop+.068,0,threshold,.136,threshold,C.eave);
 });
 b.role('bracket',()=>{
  const floor=d.galleryTop-d.galleryDepth,low=d.shaftTop-.64,r=d.gallerySide*.5;
  const shaftAt=d.shaftBase*.5+(d.shaftNeck*.5-d.shaftBase*.5)*(low/d.shaftTop);
  for(let f=0;f<4;f++)for(const u of (detail?[-.87,.87]:[0])){
   b.beam(siteP(f,low,shaftAt-.025,u),siteP(f,floor+.027,r-.09,u),detail?.081:.099,C.iron);
  }
 });
 b.role('guard',()=>{
  const r=d.gallerySide*.5-.079,y=d.galleryTop,top=y+d.railHeight;
  // Open simple oxidized metal bars. Only a plausible rhythm is illustrated, not a counted hardware replica.
  for(const [x,_,z] of ring(r*2,y))b.beam([x,y,z],[x,top+.019,z],.043,C.post);
  for(let f=0;f<4;f++){
   b.beam(siteP(f,top,r,-r),siteP(f,top,r,r),.047,C.rail);
   if(detail){
    for(const u of [-r*.37,r*.37])b.beam(siteP(f,y,r,u),siteP(f,top,r,u),.040,C.post);
    for(const h of [.29,.61])b.beam(siteP(f,y+d.railHeight*h,r,-r),siteP(f,y+d.railHeight*h,r,r),.030,C.rail);
   }else b.beam(siteP(f,y+d.railHeight*.46,r,-r),siteP(f,y+d.railHeight*.46,r,r),.038,C.rail);
  }
 });
 b.role('lantern',()=>backedLantern(b,d,detail));
 b.role('cap',()=>{
  b.box(0,d.lanternEave-.017,0,d.capSide,.166,d.capSide,C.tin);
  const eaves=ring(d.capSide,d.lanternEave+.066);
  for(let f=0;f<4;f++)b.tri(eaves[f],[0,d.capApex,0],eaves[(f+1)%4],C.roof);
 });
 b.role('terminal',()=>{
  // Photo shows a tiny silhouette above cap only; no exact vane or navigational apparatus.
  const base=d.capApex-.022,top=d.finialTop,mid=top-.072;
  b.beam([0,base,0],[0,mid,0],detail?.033:.045,C.capTip);
  const r=ring(detail?.110:.12,mid);
  for(let f=0;f<4;f++)b.tri(r[f],[0,top,0],r[(f+1)%4],C.capTip);
 });
 const g=b.finish(detail),mesh=new T.Mesh(g,shingledCoat(detail));
 mesh.name='Private Borden rear range · '+level+' · V2';
 mesh.castShadow=false;mesh.receiveShadow=false;
 return {mesh,roles:Object.freeze(b.roles),upperSash,dimensions:d,detail:level};
}
