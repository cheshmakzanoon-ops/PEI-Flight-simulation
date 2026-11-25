/**
 * Original q20213/192 QA trial, based on bounded 2020 industrial massing.
 * Not a claim about today's layout. No yards, other bins, colliders or
 * terrain are altered by this model.
 */
import * as T from 'three';
import {FORM}from'./q192-form.generated.ts';
type UV=readonly[number,number];
type XYZ=readonly[number,number,number];
type Draw= 'cladding'|'roof';
type G=(x:number,z:number)=>number;
const OLD_OWNER={ordinal:192,vertices:32049,start:13392,end:13449} as const;
const identityPose=(o:T.Object3D)=>o.matrixAutoUpdate&&o.matrixWorldAutoUpdate&&o.layers.mask===1&&o.renderOrder===0&&
 o.quaternion.x===0&&o.quaternion.y===0&&o.quaternion.z===0&&o.quaternion.w===1&&
 o.scale.x===1&&o.scale.y===1&&o.scale.z===1;
const i0=(i:number)=>i*.61803398875-Math.floor(i*.61803398875);
const at=([u,v]:UV,y:number):XYZ=>[FORM.frame.uXZ[0]*u+FORM.frame.vXZ[0]*v,y,FORM.frame.uXZ[1]*u+FORM.frame.vXZ[1]*v];
const mix=(a:UV,b:UV,f:number):UV=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
const ridgeU=(v:number)=>-.85-.1725*v;
function ridgeAt(a:UV,b:UV):UV{
 const u=(ridgeU(a[1])-a[0])/((b[0]-a[0])+.1725*(b[1]-a[1]));
 if(!(u>.05&&u<.95))throw Error('Low roof ridge left the original support');
 return mix(a,b,u);
}
export function buildDetachedIndustrial192(ground:G){
 const points:Record<Draw,number[]>={cladding:[],roof:[]},cols:typeof points={cladding:[],roof:[]};
 const [X,Z]=FORM.frame.originXZ;
 const atGround=(p:UV)=>{const [x,,z]=at(p,0);const y=ground(X+x,Z+z);if(!Number.isFinite(y))throw Error('No native visual support');return y;};
 const anchor=atGround([-3,5]),support:[UV,UV][]=[];
 const wallBase=(p:UV)=>atGround(p)-anchor-.095;
 const topH=(p:UV)=>5.215+.0016*p[1]-.407*Math.abs(p[0]-ridgeU(p[1]));
 function emit(draw:Draw,poly:readonly XYZ[],colour:number,spin=1){
  const shade=new T.Color(colour).multiplyScalar(spin);
  for(const q of poly){points[draw].push(...q);cols[draw].push(shade.r,shade.g,shade.b);}
 }
 function upward(draw:Draw,a:XYZ,b:XYZ,c:XYZ,colour:number,spin=1){
  let cross=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
  emit(draw,cross>=0?[a,b,c]:[a,c,b],colour,spin);
 }
 function quad(draw:Draw,a:XYZ,b:XYZ,c:XYZ,d:XYZ,colour:number,spin=1){
  emit(draw,[a,b,c,a,c,d],colour,spin);
 }
 // Keep all ridge/corner meetings inside measurement-backed OGL game outline.
 const [A,B,C,D]=FORM.shed,M=ridgeAt(A,B),N=ridgeAt(D,C);
 // Build wall from short true 3D panels. No invented apertures, services,
 // brand signage, ventilator hardware or material copied from photographs.
 const walk=[A,M,B,C,N,D] as readonly UV[];
 function dressedWall(a:UV,b:UV,top:(q:UV)=>number,hues:readonly[number,number],pitch:number){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.round(len/pitch));
  const outward:UV=[(b[1]-a[1])/len,-(b[0]-a[0])/len];
  function out(p:UV,m:number):UV{return[p[0]+outward[0]*m,p[1]+outward[1]*m];}

  for(let j=0;j<count;j++){
   const a0=mix(a,b,j/count),a1=mix(a,b,(j+1)/count),y0=wallBase(a0),y1=wallBase(a1),
    h0=top(a0),h1=top(a1);
   if(Math.max(y0,y1)>Math.min(h0,h1)-2.65)throw Error('Shed supports do not meet certified original ground');
   support.push([a0,a1]);
   const belt0=y0+(h0-y0)*.30,belt1=y1+(h1-y1)*.30;
   const shade=.94+.105*i0(j+7);
   quad('cladding',at(a0,y0),at(a0,belt0),at(a1,belt1),at(a1,y1),hues[0],shade);
   quad('cladding',at(a0,belt0),at(a0,h0),at(a1,h1),at(a1,belt1),hues[1],shade);
   // Small continuous folded corner. Its projection is checked separately
   // against the old owner; spacing is authored, not measured panel stock.
   if(j===0)continue;
   const q=mix(a0,a1,Math.min(.14,.038*count/len)),o=out(a0,.019);
   quad('cladding',at(a0,y0+.17),at(a0,h0-.055),at(o,h0-.055),at(o,y0+.17),hues[1],shade*.88);
   quad('cladding',at(o,y0+.17),at(o,h0-.055),at(q,top(q)-.055),at(q,wallBase(q)+.17),hues[1],shade*1.07);
  }
 }
 for(let i=0;i<walk.length;i++)dressedWall(walk[i],walk[(i+1)%walk.length],topH,[0x777570,0x999d98],.48);
 // Shallow low gable is supported by the independent 159-cell fitted cross
 // pitch. The chosen roof is a simple authored shape, not traced elevation.
 function shedPlane(left0:UV,right0:UV,left1:UV,right1:UV,steps:number){
  for(let i=0;i<steps;i++){
   const a=mix(left0,left1,i/steps),b=mix(right0,right1,i/steps),c=mix(right0,right1,(i+1)/steps),d=mix(left0,left1,(i+1)/steps);
   const shade=.955+.090*i0(i+31);
   upward('roof',at(a,topH(a)),at(b,topH(b)),at(c,topH(c)),0x858b89,shade);
   upward('roof',at(a,topH(a)),at(c,topH(c)),at(d,topH(d)),0x858b89,shade);
  }
 }
 shedPlane(A,M,D,N,47);shedPlane(M,B,N,C,47);
 const tallWall=()=>13.61;
 for(let i=0;i<FORM.tower.length;i++)dressedWall(FORM.tower[i],FORM.tower[(i+1)%FORM.tower.length],tallWall,[0x838784,0xa3aaa9],.39);
 // Small pale square cap and overhang are directly observed in the dated
 // legal photograph; the inches, pitch and unsupported clutter are not.
 const y0=13.56,y=13.93,[a,b,c,d]=FORM.cap;
 for(let i=0;i<FORM.cap.length;i++){
  const v=FORM.cap[i],w=FORM.cap[(i+1)%FORM.cap.length];
  quad('roof',at(v,y0),at(v,y),at(w,y),at(w,y0),0xa7afad,i%2?.96:1.01);
 }
 upward('roof',at(a,y),at(b,y),at(c,y),0xa7afad);
 upward('roof',at(a,y),at(c,y),at(d,y),0xa7afad);
 quad('roof',at(a,y0),at(b,y0),at(c,y0),at(d,y0),0x828986);
 const group=new T.Group();group.name='O’Leary q192 original industrial form study';group.position.set(X,anchor,Z);group.visible=false;
 for(const draw of ['cladding','roof']as const){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(points[draw],3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(cols[draw],3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:draw==='roof'?.72:.78,metalness:draw==='roof'?.10:.065,side:T.FrontSide});
  material.name='q192 authored '+draw;
  const m=new T.Mesh(geometry,material);
  m.name='q192 '+draw;group.add(m);
 }
 const identity=group.children.map(q=>{
  const mesh=q as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>,geo=mesh.geometry,mat=mesh.material;
  const attrs=Object.entries(geo.attributes).map(([name,v])=>{const a=v as T.BufferAttribute;return {name,a,raw:a.array,version:a.version};});
  return {q,mesh,geo,mat,attrs,rough:mat.roughness,metal:mat.metalness,c:mat.onBeforeCompile,key:mat.customProgramCacheKey,
   version:mat.version,b:mesh.onBeforeRender,a:mesh.onAfterRender};
 });
 let disposed=false;
 return {owner:OLD_OWNER,group,support,datumGameM:anchor,
  intact(){return !disposed&&group.children.length===2&&group.position.x===X&&group.position.y===anchor&&group.position.z===Z&&
   identityPose(group)&&
   identity.every((p,i)=>group.children[i]===p.q&&p.q.parent===group&&p.mesh.geometry===p.geo&&p.mesh.material===p.mat&&
    identityPose(p.mesh)&&p.mesh.position.x===0&&p.mesh.position.y===0&&p.mesh.position.z===0&&!p.mesh.children.length&&
    p.mesh.onBeforeRender===p.b&&p.mesh.onAfterRender===p.a&&p.mesh.frustumCulled&&p.mat.visible&&!p.mat.wireframe&&!p.mat.transparent&&
    p.mat.opacity===1&&p.mat.alphaTest===0&&p.mat.colorWrite&&p.mat.depthTest&&p.mat.depthWrite&&p.mat.version===p.version&&
    !p.mat.map&&!p.mat.envMap&&!p.mesh.castShadow&&!p.mesh.receiveShadow&&
    p.mat.vertexColors&&p.mat.side===T.FrontSide&&p.mat.roughness===p.rough&&p.mat.metalness===p.metal&&p.mat.onBeforeCompile===p.c&&p.mat.customProgramCacheKey===p.key&&
    !p.geo.index&&!p.geo.groups.length&&!Object.keys(p.geo.morphAttributes).length&&Object.keys(p.geo.attributes).length===3&&
    p.geo.drawRange.start===0&&p.geo.drawRange.count===Infinity&&
    p.attrs.every(({name,a,raw,version})=>p.geo.getAttribute(name)===a&&a.array===raw&&a.version===version));},
  dispose(){if(disposed)return;disposed=true;group.visible=false;group.removeFromParent();for(const q of identity){q.geo.dispose();q.mesh.material.dispose();}}};
}
