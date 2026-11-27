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
 roles:Readonly<Record<Key,Span>>; dimensions:Readonly<TowerDimensions>; detail:Level};
const up=new T.Vector3(0,1,0);
const PITCH=7.2,WIDTH=4.75,KEY='borden-rear-white-shingle-r3';
const C={
 // Original daylight material names/colors, not calibrated or copied from photography.
 white:0xdcd9d0,eave:0xe3e0d7,bottom:0xc1beb1,iron:0x909183,
 rail:0x51504b,post:0x68615b,red:0x934039,roof:0x93433a,tin:0x773a34,
 liner:0x624742,glass:0x566060,capTip:0x713532,sash:0xd3c9b8,
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
function shingledCoat(close:boolean) {
 const m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:T.FrontSide,
  roughness:.83,metalness:.01,transparent:false,depthWrite:true, depthTest:true});
 if(!close)return m;
 m.customProgramCacheKey=()=>KEY;
 m.onBeforeCompile=shader=>{
  const vs='#include <begin_vertex>',fs='#include <color_fragment>';
  if(shader.vertexShader.split(vs).length!==2||shader.fragmentShader.split(fs).length!==2)
   throw new Error('Unexpected Three opaque shingle anchors');
  shader.vertexShader='attribute vec2 bordenCladUv;\nattribute float bordenClad;\nvarying vec2 vBordenCladUv;\nvarying float vBordenClad;\n'+
   shader.vertexShader.replace(vs,vs+'\nvBordenCladUv = bordenCladUv;\nvBordenClad = bordenClad;');
  shader.fragmentShader='varying vec2 vBordenCladUv;\nvarying float vBordenClad;\n'+
   shader.fragmentShader.replace(fs,fs+`
     // Stable dim seams, no normal bump, texture samples, or lighting changes.
     // Derivatives for ordinary local metres are all evaluated before any role mask.
     float bordenRow=vBordenCladUv.y*${PITCH.toFixed(2)};
     float bordenAcross=vBordenCladUv.x*${WIDTH.toFixed(2)};
     vec2 bordenAa=max(fwidth(vec2(bordenAcross,bordenRow)),vec2(.002));
     float bordenT=fract(bordenRow);
     float bordenAlong=bordenAcross+mod(floor(bordenRow),2.)*.49;
     float bordenLap=1.-smoothstep(.03,.102+bordenAa.y,min(bordenT,1.-bordenT));
     float bordenS=fract(bordenAlong);
     float bordenSide=1.-smoothstep(.025,.058+bordenAa.x,min(bordenS,1.-bordenS));
     float bordenAaRow=1.-smoothstep(.15,.45,bordenAa.y);
     float bordenAaSide=(1.-smoothstep(.12,.39,bordenAa.x))*bordenAaRow;
     float bordenPiece=fract(sin(dot(vec2(floor(bordenAlong),floor(bordenRow)),vec2(6.1231,13.2265)))*1973.971)-.5;
     diffuseColor.rgb*=1.+vBordenClad*(bordenAaRow*(.018-.073*bordenLap)
       +bordenAaSide*(.024*bordenPiece-.031*bordenSide));`);
 };
 return m;
}
export function buildBordenRearTower(level:Level,input:Partial<TowerDimensions>={}):TowerArt{
 if(level!=='close'&&level!=='medium')throw new TypeError('Unsupported detached visual LOD');
 const d=dimensions(input),b=new Batch(),detail=level==='close';
 const base=ring(d.shaftBase,0),neck=ring(d.shaftNeck,d.shaftTop);
 b.role('shaft',()=>{
  for(let i=0;i<4;i++){
   const j=(i+1)%4;
   b.quad(base[i],neck[i],neck[j],base[j],C.white,
    detail?[[-d.shaftBase/2,0],[-d.shaftNeck/2,d.shaftTop],[d.shaftNeck/2,d.shaftTop],[d.shaftBase/2,0]]:undefined);
  }
  b.quad(base[0],base[1],base[2],base[3],C.bottom);
  b.quad(neck[3],neck[2],neck[1],neck[0],C.eave);
 });
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
 b.role('lantern',()=>{
  const r=d.lanternSide*.5,y0=d.galleryTop+.136,y1=d.lanternEave-.10;
  for(const f of [0,1,3])siteQ(b,f,r,-r,r,y0,y1,C.red);
  // The historical single light opening establishes an illustrative orientation only.
  // +Z is a local art face, not the actual compass axis. Deep matte pane, no interior or emissive light.
  const f=2,u=.36,lo=y0+.31,hi=y1-.24,pane=r-.078;
  siteQ(b,f,r,-r,-u,y0,y1,C.red);siteQ(b,f,r,u,r,y0,y1,C.red);
  siteQ(b,f,r,-u,u,y0,lo,C.red);siteQ(b,f,r,-u,u,hi,y1,C.red);
  b.quad(siteP(f,lo,r,-u),siteP(f,hi,r,-u),siteP(f,hi,pane,-u),siteP(f,lo,pane,-u),C.liner);
  b.quad(siteP(f,lo,pane,u),siteP(f,hi,pane,u),siteP(f,hi,r,u),siteP(f,lo,r,u),C.liner);
  b.quad(siteP(f,hi,r,-u),siteP(f,hi,r,u),siteP(f,hi,pane,u),siteP(f,hi,pane,-u),C.liner);
  b.quad(siteP(f,lo,pane,-u),siteP(f,lo,pane,u),siteP(f,lo,r,u),siteP(f,lo,r,-u),C.sash);
  siteQ(b,f,pane,-u,u,lo,hi,C.glass);
  if(detail){
   const t=.037;
   b.beam(siteP(f,lo,r-.018,-u+.017),siteP(f,hi,r-.018,-u+.017),t,C.sash);
   b.beam(siteP(f,lo,r-.018,u-.017),siteP(f,hi,r-.018,u-.017),t,C.sash);
   b.beam(siteP(f,hi-.017,r-.018,-u),siteP(f,hi-.017,r-.018,u),t,C.sash);
  }
 });
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
 mesh.name='Private Borden rear range · '+level;
 mesh.castShadow=false;mesh.receiveShadow=false;
 return {mesh,roles:Object.freeze(b.roles),dimensions:d,detail:level};
}
