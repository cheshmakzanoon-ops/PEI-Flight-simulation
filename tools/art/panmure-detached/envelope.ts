/** Panmure Head lower frame study. This is not a final site placement,
 * validated facade compass assignment, a lantern facet-count assertion,
 * or an asset imported by PEI Flight Sim. Everything here is authored. */
import * as T from 'three';
export const PANMURE_DRAFT = Object.freeze({
  datum:9.46, bearing:9.27, deck:23.677, approximateTopBand:26.96,
  baseApothem:4.324, galleryApothem:3.267, taper:.13727,
  sourceEpoch:2020, heldFit:'pending', worldPlacement:false
} as const);
const p=PANMURE_DRAFT, y=(a:number)=>a-p.datum, deck=y(p.deck);
const pose=(i:number)=>i*Math.PI/4;
const sides=8;
const body=(h:number)=>p.baseApothem-p.taper*Math.max(0,h+.039);
type MaterialRole='paint'|'trim'|'dark'|'glass'|'concrete'|'rail'|'deck';
type V=readonly[number,number,number];
const xyz=(x:number,y:number,z:number):V=>[x,y,z];
const makeFace=(side:number,u:number,h:number,r:number):V=>{
 const a=pose(side),c=Math.cos(a),s=Math.sin(a);
 return xyz(c*r-s*u,h,s*r+c*u);
};
const flat=(u:number,v:number,h:number,k:number)=>[new T.Vector2(u,h),new T.Vector2(v,h),new T.Vector2(v,k),new T.Vector2(u,k)];
const capR=(rad:number)=>rad*Math.tan(Math.PI/8);
const fract=(x:number)=>x-Math.floor(x);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
function cedarMap(){
 const n=256,data=new Uint8Array(n*n*4);
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  const u=(c+.5)/n,v=(r+.5)/n,row=Math.floor(v*6),lap=fract(6*v);
  const chip=fract(11*u+row*.5+.14*Math.sin(row*4.7)),joint=Math.min(chip,1-chip);
  const crease=(1-clamp(lap/.114))*.17+(1-clamp(joint/.029))*.031;
  const w=.91-crease+.021*Math.sin(64*Math.PI*u+row)*Math.sin(Math.PI*lap)+.028*Math.sin(27*Math.PI*u+2*row);
  const k=(r*n+c)*4,d=Math.round(255*clamp(w));data[k]=d;data[k+1]=d;data[k+2]=Math.min(255,d+1);data[k+3]=255;
 }
 const map=new T.DataTexture(data,n,n,T.RGBAFormat);
 map.colorSpace=T.SRGBColorSpace;map.repeat.set(1/.91,1/.81);
 map.wrapS=map.wrapT=T.RepeatWrapping;
 map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;
 map.generateMipmaps=true;map.needsUpdate=true;return map;
}
const roleMaterials=()=>({
 paint:new T.MeshStandardMaterial({color:0xd3d1c7,roughness:.95,vertexColors:true,map:cedarMap()}),
 trim:new T.MeshStandardMaterial({color:0xa62b27,roughness:.73,vertexColors:true}),
 dark:new T.MeshStandardMaterial({color:0x332b28,roughness:.94,vertexColors:true}),
 glass:new T.MeshPhysicalMaterial({color:0x4d626a,roughness:.22,clearcoat:.65,clearcoatRoughness:.14,vertexColors:true}),
 concrete:new T.MeshStandardMaterial({color:0x88877a,roughness:.92,vertexColors:true}),
 rail:new T.MeshStandardMaterial({color:0x872822,roughness:.53,metalness:.23,vertexColors:true}),
 deck:new T.MeshStandardMaterial({color:0xaaa596,roughness:.96,vertexColors:true})
});
const openings=new Map<number,readonly [number,number,'door'|'window'][]>([
 [0,[[0,.85,'door']]], // art-clock sector, not an azimuth for simulation
 [1,[[0,.67,'window'],[0,3.98,'window'],[0,7.13,'window'],[0,10.18,'window']]],
 [3,[[0,.73,'window'],[0,4.20,'window']]]
]);
export function lowerPanmureEnvelope() {
 const G=new T.Group();
 G.name='Panmure Head architecture envelope, unsited';
 G.userData.panMure={...p};
 const mat=roleMaterials(),out=new Map<MaterialRole,{P:number[];C:number[];UV:number[]}>();
 function tri(role:MaterialRole,points:readonly[V,V,V],uv:readonly[T.Vector2,T.Vector2,T.Vector2],tint:number){
  const b=out.get(role)??{P:[],C:[],UV:[]};out.set(role,b);
  for(let i=0;i<3;i++){b.P.push(...points[i]);b.UV.push(uv[i].x,uv[i].y);b.C.push(tint,tint,tint);}
 }
 function quad(role:MaterialRole,a:V,b:V,c:V,d:V,tint=1){
  const uv=[new T.Vector2(0,0),new T.Vector2(1,0),new T.Vector2(1,1),new T.Vector2(0,1)];
  tri(role,[a,b,c],[uv[0],uv[1],uv[2]],tint);tri(role,[a,c,d],[uv[0],uv[2],uv[3]],tint);
 }
 const sleeve=(role:MaterialRole,low:number,high:number,r0:number,r1:number)=>{
  for(let s=0;s<sides;s++){const a=capR(r0),b=capR(r1);
   quad(role,makeFace(s,a,low,r0),makeFace(s,-a,low,r0),makeFace(s,-b,high,r1),makeFace(s,b,high,r1));}
 };
 const exactSurface=(s:number,a:T.Vector2,offset=0)=>makeFace(s,a.x,a.y,body(a.y)+offset);
 const inset=(role:MaterialRole,s:number,x0:number,x1:number,z0:number,z1:number,offset:number,tint=1)=>{
  const pts=flat(x0,x1,z0,z1).reverse().map(q=>exactSurface(s,q,offset));
  quad(role,pts[0],pts[1],pts[2],pts[3],tint);
 };
 const finishFace=(s:number,i:number)=>{
  const b=i?1.5:1.022;
  return b+.026*Math.sin(s*15.3+i*2);
 };
 const eave=deck-.46;
 sleeve('concrete',y(p.bearing),.44,body(0)-.06,body(.44));
 for(let s=0;s<8;s++){
  const doorList=(openings.get(s)??[]).map(([u,h,k])=>{
   const w=k==='door'?.61:.53,h1=h+(k==='door'?2.35:1.42);
   return {u,h,h1,k,w};
  });
  const pts=[new T.Vector2(-capR(body(.44)),.44),new T.Vector2(capR(body(.44)),.44),new T.Vector2(capR(body(eave)),eave),new T.Vector2(-capR(body(eave)),eave)];
  const holes=doorList.map(q=>flat(q.u-q.w,q.u+q.w,q.h,q.h1));
  const joined=pts.concat(...holes);
  for(const [a,b,c]of T.ShapeUtils.triangulateShape(pts,holes)){
   tri('paint',[exactSurface(s,joined[c]),exactSurface(s,joined[b]),exactSurface(s,joined[a])],
     [joined[c],joined[b],joined[a]],finishFace(s,0));
  }
  for(const {u,h,h1,k,w} of doorList){
   const l=u-w,r=u+w,points=flat(l,r,h,h1);
   for(let j=0;j<4;j++){
    const a=points[j],b=points[(j+1)%4];
    quad('deck',exactSurface(s,a),exactSurface(s,b),exactSurface(s,b,-.13),exactSurface(s,a,-.13),.82);
   }
   inset('dark',s,l,r,h,h1,-.136,.68);
   inset(k==='door'?'trim':'glass',s,l+.06,r-.06,h+.06,h1-.06,-.117);
   for(const v of [l,r])inset('trim',s,v-.06,v+.06,h-.08,h1+.04,.025);
   for(const z of [h,h1])inset('trim',s,l-.06,r+.06,z-.05,z+.07,.035);
   if(k==='door'){
    inset('dark',s,l+.14,r-.14,h+.65,h1-.16,-.087,.72);
    inset('glass',s,l+.22,r-.22,h+.75,h1-.24,-.066,.63);
    inset('trim',s,l+.075,r-.075,h+.28,h+.47,-.041,.85);
    inset('rail',s,r-.138,r-.086,h+1.21,h+1.36,-.032,.81);
   }
   if(k==='window') {
    for(const v of [u-.155,u+.155])inset('paint',s,v-.014,v+.014,h+.08,h1-.04,-.073);
    for(let j=1;j<=3;j++){
     const z=h+j*(h1-h)/4,t=j===2?.030:.014;inset('paint',s,l+.06,r-.06,z-t,z+t,-.072);
    }
   }
   const x=l-.13,v=r+.13,zb=h1+.065,zt=zb+.36;
   const a=exactSurface(s,new T.Vector2(x,zb),.04),b=exactSurface(s,new T.Vector2(v,zb),.04),c=exactSurface(s,new T.Vector2(u,zt),.04);
   const A=exactSurface(s,new T.Vector2(x,zb),.28),B=exactSurface(s,new T.Vector2(v,zb),.28),C=exactSurface(s,new T.Vector2(u,zt),.28);
   tri('paint',[B,A,C],[new T.Vector2(1,0),new T.Vector2(0,0),new T.Vector2(.5,1)],.88);
   quad('trim',a,A,C,c,.97);quad('trim',c,C,B,b,.91);
  }
 }
 sleeve('paint',eave,deck-.255,body(eave),p.galleryApothem-.13);
 sleeve('deck',deck-.255,deck-.149,p.galleryApothem-.13,p.galleryApothem);
 sleeve('paint',deck-.149,deck,p.galleryApothem,p.galleryApothem);
 for(let s=0;s<sides;s++){
  const a=capR(p.galleryApothem);
  const center=xyz(0,deck,0),l=makeFace(s,-a,deck,p.galleryApothem),r=makeFace(s,a,deck,p.galleryApothem);
  tri('deck',[center,r,l],[new T.Vector2(.5,.5),new T.Vector2(1,0),new T.Vector2(0,0)],.88);
 }

 // Original profiles drawn from documented scrolled support and metal rail
 // arrangement. Positions around the ring are authoring coordinates, not a
 // dated structural plan or an engineering description.
 const beam=(role:MaterialRole,A:V,B:V,width:number)=>{
  const p0=new T.Vector3(...A),p1=new T.Vector3(...B),u=p1.clone().sub(p0).normalize();
  const r=u.clone().cross(new T.Vector3(0,Math.abs(u.y)<.8?1:0,Math.abs(u.y)<.8?0:1)).normalize().multiplyScalar(width*.5);
  const v=u.clone().cross(r).normalize().multiplyScalar(width*.5);
  const pts=([p0,p1]).map(c=>[[-1,-1],[-1,1],[1,1],[1,-1]].map(([i,j])=>
    c.clone().addScaledVector(r,i).addScaledVector(v,j).toArray() as unknown as V));
  quad(role,pts[0][3],pts[0][2],pts[0][1],pts[0][0],.9);
  quad(role,pts[1][0],pts[1][1],pts[1][2],pts[1][3],.94);
  for(let i=0;i<4;i++){const j=(i+1)%4;quad(role,pts[0][i],pts[0][j],pts[1][j],pts[1][i],.93);}
 };
 for(const [i,entries] of openings)for(const [u,h,kind] of entries){
  const w=kind==='door'?.61:.53;
  const z=h+(kind==='door'?2.35:1.42)+.065;
  const a=exactSurface(i,new T.Vector2(u-w-.16,z),.29);
  const b=exactSurface(i,new T.Vector2(u,z+.36),.29);
  const c=exactSurface(i,new T.Vector2(u+w+.16,z),.29);
  beam('trim',a,b,.046);beam('trim',b,c,.046);
 }
 for(let i=0;i<8;i++){
  const a=capR(p.galleryApothem-.10);
  const at=(u:number,h:number)=>makeFace(i,u,h,p.galleryApothem-.10);
  for(const h of [deck+.42,deck+1.00])beam('rail',at(-a,h),at(a,h),h>deck+.9?.042:.030);
  for(const a0 of [-a,0])beam('rail',at(a0,deck-.035),at(a0,deck+1.05),.058);
  for(const u of [-.8,.8]){
   const root=body(deck-1.3)+.02;
   const P=[makeFace(i,u,deck-1.44,root),makeFace(i,u,deck-1.26,root+.19),
      makeFace(i,u,deck-.87,root+.25),makeFace(i,u,deck-.57,p.galleryApothem-.28)];
   for(let k=0;k<3;k++)beam('trim',P[k],P[k+1],.126-.016*k);
   beam('trim',makeFace(i,u,deck-.60,p.galleryApothem-.28),makeFace(i,u,deck-.26,p.galleryApothem-.28),.255);
  }
 }
 for(const [role,b]of out){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(b.P,3));
  g.setAttribute('color',new T.Float32BufferAttribute(b.C,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(b.UV,2));
  g.computeVertexNormals();g.computeBoundingBox();
  const m=new T.Mesh(g,mat[role]);m.name=role;G.add(m);
 }
 return G;
}
