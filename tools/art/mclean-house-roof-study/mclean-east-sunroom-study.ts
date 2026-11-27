import * as THREE from 'three';
import {MCLEAN_SUNROOM_INNER as measured} from './mclean-east-sunroom-roof.generated.ts';

type XYZ=readonly [number,number,number];
type XY=readonly [number,number];
type Height=number|((x:number,z:number)=>number);
type GlassClass=0|1;
export type McLeanSunroomQuality='near'|'mid';
const R=Object.freeze({roofSurface:0,technicalCut:1,roofUnder:2,timber:3,
 beam:4,moulding:5,sash:6,apron:7,lead:8,clear:9,blue:10,ochre:11,green:12,red:13} as const);
export const MCLEAN_SUNROOM_ROLE=R;
const colours=[
 0x56605a,0x414b46,0x656b5d,0x49575a,0x414f51,0x5b6a6b,0xb5ac94,0xb9aa90,0x414a49,
 0x839696,0x4c6287,0x93674c,0x50796c,0x8f615d
] as const;
const [A,B,C,D]=measured.vertices;
const loX=A[0],hiX=B[0],loZ=A[2],hiZ=D[2],cut=measured.renderCutY;
const xSlope=(B[1]-A[1])/(B[0]-A[0]),zSlope=(D[1]-A[1])/(D[2]-A[2]);
const topY=(u:number,v:number)=>A[1]-cut+xSlope*(u-loX)+zSlope*(v-loZ);
const thickness=.076;
const x0=1.027,x3=4.173,zFront=-4.862,zBack=-4.648,zGlass=-4.763;
const roofRef=topY((x0+x3)*.5,zFront);
const apronFoot=roofRef-2.223, apronTop=roofRef-2.027;
const sill=roofRef-2.00, mainHead=roofRef-.715, transomLow=roofRef-.669, transomHigh=roofRef-.327;
const levels=[x0,x0+(x3-x0)/3,x0+2*(x3-x0)/3,x3] as const;
const cutTop=measured.vertices.map(([x,y,z])=>[x,y-cut,z] as XYZ);
const B0=[0,-1,0] as const, U=[0,1,0] as const, F=[0,0,-1] as const, B1=[0,0,1] as const;
const L=[-1,0,0] as const,W=[1,0,0] as const,S=[0,0] as const;
const rsub=(a:XYZ,b:XYZ):XYZ=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:XYZ,b:XYZ):XYZ=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:XYZ,b:XYZ)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normal=(a:XYZ):XYZ=>{
 const l=Math.hypot(...a);if(!Number.isFinite(l)||l<1e-9)throw Error('invalid sunroom face');
 return [a[0]/l,a[1]/l,a[2]/l];
};
const SCOPE=Object.freeze({
 kind:'Detached measured interior roof with an illustrative three-light glazed screen',
 roofInteriorSourceSHA:measured.sourceSHA,roofInteriorAreaM2:measured.coreAreaM2,roofOnlyMeasured:true,
 roofEdgeIsNotObservedEave:true,screenDirection:'local illustrative -V cut, not calibrated photo or wall geometry',
 noCompleteFootprint:true,noFloorOrSiteJoin:true,noWesternAddition:true,noImagePixels:true,
 historicApparentTypeOnly:true,notInstalled:true
} as const);
const ORG=Object.freeze({
 measuredPatchSourceNodes:measured.vertices,screenSpans:Object.freeze(levels),
 paneZ:zGlass,cutApronBottom:apronFoot,glassMainSill:sill,glassMainHead:mainHead,
 transomLow,transomHigh
} as const);

function produce(quality:McLeanSunroomQuality){
 if(quality!=='near'&&quality!=='mid')throw Error('invalid sunroom quality');
 if(Math.abs(topY(C[0],C[2])-(C[1]-cut))>2e-13)throw Error('measured roof patch is not affine');
 const near=quality==='near',palette=colours.map(c=>new THREE.Color(c));
 const stream=()=>({p:[]as number[],n:[]as number[],c:[]as number[],r:[]as number[],
  t:[]as number[],m:[]as number[],pane:[]as number[],part:[]as number[]});
 const solid=stream(),light=stream();
 type Out=typeof solid;
 let pId=0,lightId=0;
 const local=(x:number,y:number):XY=>[(x-x0)/(x3-x0),(y-apronFoot)/(roofRef-apronFoot)];
 const point=(d:Out,v:XYZ,n:XYZ,k:number,glass:GlassClass,id:number)=>{
  if(!v.every(Number.isFinite)||v[0]<loX-1e-8||v[0]>hiX+1e-8||v[2]<loZ-1e-8||v[2]>hiZ+1e-8||
      v[1]>topY(v[0],v[2])+2e-9||v[1]<apronFoot-1e-9)
   throw Error('piece leaves certified plan or symbolic screen bounds');
  if(d===light&&(v[2]!==zGlass||!id))throw Error('pane outside one authorized plane');
  d.p.push(...v);d.n.push(...n);d.t.push(...local(v[0],v[1]));d.r.push(k);
  d.m.push(glass);d.pane.push(id);d.part.push(pId);
  const c=palette[k];d.c.push(c.r,c.g,c.b);
 };
 const tri=(d:Out,a:XYZ,b:XYZ,c:XYZ,dir:XYZ,k:number,t:GlassClass=0,id=0)=>{
  let n=normal(cross(rsub(b,a),rsub(c,a)));
  if(dot(n,dir)<0){[b,c]=[c,b];n=[-n[0],-n[1],-n[2]];}
  if(dot(n,dir)<.0001)throw Error('sunroom indeterminate face orientation');
  point(d,a,n,k,t,id);point(d,b,n,k,t,id);point(d,c,n,k,t,id);
 };
 const quad=(d:Out,a:XYZ,b:XYZ,c:XYZ,k:XYZ,dd:XYZ,r:number,t:GlassClass=0,id=0)=>{
  tri(d,a,b,c,dd,r,t,id);tri(d,a,c,k,dd,r,t,id);
 };
 const pushSolid=(a:XYZ,b:XYZ,c:XYZ,d:XYZ,n:XYZ,k:number)=>quad(solid,a,b,c,d,n,k);
 // First six submitted vertices are precisely the four authority nodes, emitted as two affine triangles.
 const [a,b,c,d]=cutTop;
 const pL=cutTop.map(([x,y,z])=>[x,y-thickness,z] as XYZ);
 pId++;
 pushSolid(a,d,c,b,U,R.roofSurface);
 pushSolid(pL[0],pL[1],pL[2],pL[3],B0,R.roofUnder);
 for(const [i,j,n] of [[0,1,F],[1,2,W],[2,3,B1],[3,0,L]]as const)
  pushSolid(cutTop[i],cutTop[j],pL[j],pL[i],n,R.technicalCut);
 const height=(f:Height,x:number,z:number)=>typeof f==='number'?f:f(x,z);
 const cuboid=(lx:number,hx:number,lz:number,hz:number,lo:Height,hi:Height,k:number)=>{
  if(hx-lx<.005||hz-lz<.005)throw Error('undersized timber prism');
  const pt=(x:number,z:number,sel:Height):XYZ=>[x,height(sel,x,z),z];
  const [a,b,c,d]=[pt(lx,lz,lo),pt(hx,lz,lo),pt(hx,hz,lo),pt(lx,hz,lo)];
  const [A,B,C,D]=[pt(lx,lz,hi),pt(hx,lz,hi),pt(hx,hz,hi),pt(lx,hz,hi)];
  if([A,B,C,D].some((p,i)=>p[1]<[a,b,c,d][i][1]+.004))throw Error('inverted timber height');
  pId++;
  pushSolid(a,b,B,A,F,k);pushSolid(b,c,C,B,W,k);pushSolid(c,d,D,C,B1,k);pushSolid(d,a,A,D,L,k);
  pushSolid(A,D,C,B,U,k);pushSolid(a,b,c,d,B0,k);
 };
 const modelTop=(x:number,z:number)=>topY(x,z)-.047;
 const outerRail=(x:number,z:number)=>topY(x,z)-.196;
 const quarterRail=(x:number,z:number)=>topY(x,z)-.139;
 // Four visually supported framing posts lead into the actual plane but claim no historical foot.
 for(const x of levels){
  cuboid(x-.070,x+.070,zFront-.015,zBack,apronFoot,modelTop,R.timber);
  if(near) cuboid(x-.052,x+.052,zFront-.038,zFront+.012,roofRef-.55,outerRail,R.moulding);
 }
 cuboid(x0-.078,x3+.078,zFront-.022,zBack+.016,transomHigh,modelTop,R.beam);
 cuboid(x0-.091,x3+.091,zFront-.062,zFront+.014,outerRail,quarterRail,R.moulding);
 // Open-ended vertical apron cut, not a foundation or a floor.
 cuboid(x0-.053,x3+.053,zFront+.009,zBack-.034,apronFoot,apronTop,R.apron);
 cuboid(x0-.086,x3+.086,zFront-.071,zBack+.013,apronTop-.018,sill,R.timber);
 const trimBottom=sill-.006;
 const trimTop=transomHigh+.008;
 function panePoly(poly:readonly XY[],kind:number,tinted:GlassClass){
  if(poly.length<3||poly.length>4)throw Error('bounded local glass shape');
  const p=poly.map(p=>[p[0],p[1],zGlass]as XYZ),slot=++lightId;
  if(p.length===3)tri(light,p[0],p[1],p[2],F,kind,tinted,slot);
  else quad(light,p[0],p[1],p[2],p[3],F,kind,tinted,slot);
 }
 function rect(x:number,X:number,y:number,Y:number,kind:number,tinted:GlassClass){
  if(X-x<.006||Y-y<.006)throw Error('glass part collapsed');
  panePoly([[x,y],[X,y],[X,Y],[x,Y]],kind,tinted);
 }
 function leading(a:XY,b:XY){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const u=(b[1]-a[1])*.006/len,v=(a[0]-b[0])*.006/len;
  const s=[[a[0]+u,a[1]+v],[b[0]+u,b[1]+v],[b[0]-u,b[1]-v],[a[0]-u,a[1]-v]]as const;
  const f=s.map(([x,y])=>[x,y,zGlass-.013]as XYZ),q=s.map(([x,y])=>[x,y,zGlass+.008]as XYZ);
  pId++;
  pushSolid(f[0],f[1],f[2],f[3],F,R.lead);
  pushSolid(q[0],q[1],q[2],q[3],B1,R.lead);
  for(let i=0;i<4;i++){
   const j=(i+1)%4;
   const dd=normal([(s[i][0]+s[j][0]-a[0]-b[0])*.5,(s[i][1]+s[j][1]-a[1]-b[1])*.5,0]);
   pushSolid(f[i],f[j],q[j],q[i],dd,R.lead);
  }
 }
 for(let j=0;j<3;j++){
  const p=levels[j],q=levels[j+1],a=p+.092,b=q-.092,center=(a+b)*.5;
  const sa=mainHead,ym=sill+(sa-sill)*.504,sx=near?.013:.017;
  cuboid(a-.027,a+.014,zFront+.011,zBack-.005,trimBottom,trimTop,R.sash);
  cuboid(b-.014,b+.027,zFront+.011,zBack-.005,trimBottom,trimTop,R.sash);
  cuboid(a,b,zFront+.025,zBack-.003,mainHead,transomLow,R.sash);
  cuboid(a,b,zFront+.026,zGlass+.016,ym-.018,ym+.018,R.sash);
  cuboid(center-sx,center+sx,zFront+.031,zGlass+.016,sill,mainHead,R.sash);
  for(const [l,u]of[[a,center-sx],[center+sx,b]])for(const [y,Y]of[[sill,ym-.018],[ym+.018,sa]])
   rect(l,u,y,Y,R.clear,0);
  if(j===1)rect(a,b,transomLow,transomHigh,R.clear,0);
  else {
   // Hand-authored abstract flank leaded motif; no proportions/pattern transcribed from the photo.
   const i=a+(b-a)*.276,k=a+(b-a)*.724,mu=(i+k)*.5;
   const lo=transomLow,hi=transomHigh,mid=(lo+hi)*.5;
   const x=i+.010,z=k-.010,d=(x+z)*.5,ym=(lo+hi)*.5;
   cuboid(i-.010,i+.010,zFront+.035,zGlass+.018,lo,hi,R.lead);
   cuboid(k-.010,k+.010,zFront+.035,zGlass+.018,lo,hi,R.lead);
   rect(a,i-.010,lo,hi,j===0?R.blue:R.green,1);
   rect(k+.010,b,lo,hi,j===0?R.ochre:R.blue,1);
   const e0=[x,lo]as const,e1=[z,lo]as const,e2=[z,hi]as const,e3=[x,hi]as const;
   const h0=[x,mid]as const,h1=[mu,lo]as const,h2=[z,mid]as const,h3=[mu,hi]as const;
   panePoly([e0,h1,h0],R.blue,1);panePoly([h1,e1,h2],R.ochre,1);
   panePoly([h2,e2,h3],R.green,1);panePoly([h3,e3,h0],R.blue,1);
   panePoly([h0,h1,h2,h3],j===0?R.red:R.ochre,1);
   if(near)for(const [f,g]of [[h0,h1],[h1,h2],[h2,h3],[h3,h0]])leading(f,g);
   if(Math.abs(d-mu)>1e-12||ym!==mid)throw Error('asymmetric leaded aperture');
  }
 }
 const geometry=(d:Out)=>{
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(d.p,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(d.n,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(d.c,3));
  g.setAttribute('mcSunroomRole',new THREE.Uint8BufferAttribute(d.r,1));
  g.setAttribute('mcSunroomTape',new THREE.Float32BufferAttribute(d.t,2));
  g.setAttribute('mcSunroomTint',new THREE.Float32BufferAttribute(d.m,1));
  g.setAttribute('mcSunroomPane',new THREE.Uint16BufferAttribute(d.pane,1));
  g.setAttribute('mcSunroomJoint',new THREE.Uint16BufferAttribute(d.part,1));
  g.computeBoundingBox();g.computeBoundingSphere();
  return g;
 };
 return {g0:geometry(solid),g1:geometry(light),opaqueTriangles:solid.p.length/9,
  glassTriangles:light.p.length/9,paneCount:lightId};
}
const optics=/*glsl*/`
varying vec2 mcGuv;
varying float mcGtint;
vec4 mcSunroomPane(vec4 src,vec3 n,vec3 eye,vec2 uv,float t){
 float de=clamp(abs(dot(n,eye))/max(length(n)*length(eye),1.e-4),0.,1.);
 float F=pow(1.-de,3.);
 float tint=clamp(t,0.,1.);
 float up=smoothstep(.18,.97,uv.y);
 vec3 film=mix(vec3(.129,.171,.184),vec3(.335,.436,.489),up);
 vec3 rgb=mix(src.rgb*(.80+.20*up),film,(.16+.18*F)*(1.-.57*tint));
 float coverage=mix(.19,.54,tint)+(.14-.062*tint)*F+.022*up;
 return vec4(rgb,coverage);
}
`;
function mats(){
 const o=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.82,metalness:0,
  transparent:false,side:THREE.FrontSide,depthWrite:true,depthTest:true});
 const g=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.44,metalness:0,
  transparent:true,side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false,depthTest:true,
  blending:THREE.NormalBlending,premultipliedAlpha:false,opacity:.32});
 // A single separated non-overlapping pane plane, no extra transmission or area reads.
 g.onBeforeCompile=shader=>{
  const v='#include <color_vertex>',n='#include <normal_fragment_begin>';
  if(shader.vertexShader.split(v).length!==2||shader.fragmentShader.split(n).length!==2)return;
  shader.vertexShader='attribute vec2 mcSunroomTape;attribute float mcSunroomTint;varying vec2 mcGuv;varying float mcGtint;\n'+
   shader.vertexShader.replace(v,v+'\n mcGuv=mcSunroomTape; mcGtint=mcSunroomTint;');
  shader.fragmentShader=optics+shader.fragmentShader.replace(n,n+
   '\n diffuseColor=mcSunroomPane(diffuseColor,normal,vViewPosition,mcGuv,mcGtint);');
 };
 g.customProgramCacheKey=()=> 'mclean-east-sunroom-detached-translucent-v1';
 return {o,g};
}
/** Partial historical screen underneath an exact 2020 roof interior. No site, floor or old actor scope. */
export function createMcLeanEastSunroomSection(quality:McLeanSunroomQuality='near'){
 const p=produce(quality),m=mats(),root=new THREE.Group(),wood=new THREE.Mesh(p.g0,m.o),glass=new THREE.Mesh(p.g1,m.g);
 root.name='McLean House Inn - detached east sunroom cutaway';
 wood.name='McLean east sunroom inner survey roof and historical timber study';
 glass.name='McLean east sunroom - isolated single glass plane';
 for(const k of [wood,glass]){k.castShadow=false;k.receiveShadow=false;}
 root.add(wood,glass);
 let closed=false;
 return Object.freeze({root,wood,glass,quality,scope:SCOPE,layout:ORG,opaqueTriangles:p.opaqueTriangles,
  glassTriangles:p.glassTriangles,paneCount:p.paneCount,close(){
   if(closed)return;closed=true;root.removeFromParent();wood.removeFromParent();glass.removeFromParent();
   p.g0.dispose();p.g1.dispose();m.o.dispose();m.g.dispose();
  }});
}
