import * as T from 'three';
import {buildBeaconsfield} from './beaconsfield-model.ts';
import {BEACON_REVIEW as S} from '../../src/render/beaconsfield-review-spec.ts';

type XZ=readonly [number,number];
type P=[number,number,number,number,number,number,number,number]; // position, UV, normal
const side=(a:XZ,b:XZ,p:XZ)=> (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const signArea=(r:readonly XZ[])=>r.reduce((sum,a,i)=>sum+a[0]*r[(i+1)%r.length][1]-a[1]*r[(i+1)%r.length][0],0);
function clip(points:P[],a:XZ,b:XZ):P[]{
 const f=(p:P)=>(b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const out:P[]=[];if(!points.length)return out;
 let p=points[points.length-1],d=f(p);
 for(const n of points){const e=f(n);if((d<0)!==(e<0)){const t=d/(d-e);out.push(p.map((v,i)=>v+t*(n[i]-v)) as P);}if(e>=0)out.push(n);p=n;d=e;}
 return out;
}
const ring=signArea(S.insetXZ)>0?S.insetXZ:[...S.insetXZ].reverse();
const ids=T.ShapeUtils.triangulateShape(ring.map(v=>new T.Vector2(...v)),[]);
const cells=ids.map(i=>{
 const r=i.map(v=>ring[v]);if(signArea(r)<0)r.reverse();return {r,x0:Math.min(...r.map(v=>v[0])),x1:Math.max(...r.map(v=>v[0])),z0:Math.min(...r.map(v=>v[1])),z1:Math.max(...r.map(v=>v[1]))};
});
function ringInside(x:number,z:number){let q=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const [a,b]=ring[j],[c,d]=ring[i];if((b>z)!==(d>z)&&x<a+(c-a)*(z-b)/(d-b))q=!q;
}return q;}
function geoInside(x:number,z:number){let q=false;for(let i=0,j=S.ringXZ.length-1;i<S.ringXZ.length;j=i++){
 const [a,b]=S.ringXZ[j],[c,d]=S.ringXZ[i];if((b>z)!==(d>z)&&x<a+(c-a)*(z-b)/(d-b))q=!q;
}return q;}
const distance=(x:number,z:number)=>Math.min(...S.ringXZ.map(([a,b],i)=>{
 const [u,v]=S.ringXZ[(i+1)%S.ringXZ.length],dx=u-a,dz=v-b,t=T.MathUtils.clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a-t*dx,z-b-t*dz);
}));
function applyPlan(g:T.BufferGeometry){
 const ap=g.getAttribute('position'),au=g.getAttribute('uv'),an=g.getAttribute('normal');
 const positions:number[]=[],uvs:number[]=[],normals:number[]=[];const eps=.000003;
 function emit(a:P,b:P,c:P){
  const [dx,dy,dz]=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ex=c[0]-a[0],ey=c[1]-a[1],ez=c[2]-a[2];
  if(Math.hypot(dy*ez-dz*ey,dz*ex-dx*ez,dx*ey-dy*ex)<1e-9)return;
  for(const p of [a,b,c]){positions.push(p[0],p[1],p[2]);uvs.push(p[3],p[4]);const n=Math.hypot(p[5],p[6],p[7])||1;normals.push(p[5]/n,p[6]/n,p[7]/n);}
 }
 for(let i=0;i<ap.count;i+=3){
  const p:P[]=[i,i+1,i+2].map(j=>[ap.getX(j),ap.getY(j),ap.getZ(j),au.getX(j),au.getY(j),an.getX(j),an.getY(j),an.getZ(j)] as P);
  const X0=Math.min(p[0][0],p[1][0],p[2][0]),X1=Math.max(p[0][0],p[1][0],p[2][0]),Z0=Math.min(p[0][2],p[1][2],p[2][2]),Z1=Math.max(p[0][2],p[1][2],p[2][2]);
  // Interiors far from the plan edge never need subdivision. The distance proof bounds all parts of this triangle.
  const cx=(X0+X1)*.5,cz=(Z0+Z1)*.5,r=Math.hypot(X1-cx,Z1-cz);
  if(geoInside(cx,cz)&&distance(cx,cz)>r+.019){emit(...p as [P,P,P]);continue;}
  for(const {r,x0,x1,z0,z1} of cells){
   if(x0>X1+eps||x1<X0-eps||z0>Z1+eps||z1<Z0-eps)continue;
   let a=p;
   for(let j=0;j<3&&a.length;j++)a=clip(a,r[j],r[(j+1)%3]);
   for(let j=2;j<a.length;j++)emit(a[0],a[j-1],a[j]);
  }
 }
 const gg=new T.BufferGeometry();gg.setAttribute('position',new T.Float32BufferAttribute(positions,3));gg.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));gg.setAttribute('normal',new T.Float32BufferAttribute(normals,3));gg.computeBoundingSphere();return gg;
}

// The hand-authored rear return can cross a concave extraction step. Seal only that prior authored
// occupied volume along an inward owner edge, never make a new wall to enlarge the site outline.
function closure(source:T.Group){
 source.updateMatrixWorld(true);const check=new T.Raycaster();
 const vertices:number[]=[],UV:number[]=[],toes:number[]=[],toesUV:number[]=[],skirt:number[]=[],skirtUV:number[]=[];
 const body=(x:number,z:number)=>x> -7.16&&x<6.14&&z> -5.57&&z<7.49 || x>.33&&x<6.29&&z> -18.05&&z< -5.31;
 const deck=(x:number,z:number)=>x> -9.43&&x<8.10&&z>7.30&&z<10.30||x> -9.43&&x< -7.10&&z> -.63&&z<7.30||x>6.14&&x<8.10&&z>4.15&&z<7.31;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ix=-dz/len,iz=dx/len,n=Math.ceil(len/.24);
  const find=(x:number,z:number)=>{check.set(new T.Vector3(x,19,z),new T.Vector3(0,-1,0));return check.intersectObject(source,true).find(h=>h.object.name==='slate'&&h.point.y>4.8)?.point.y;};
  for(let j=0;j<n;j++){
   const u=j/n,v=(j+1)/n,m=(u+v)*.5,cx=a[0]+dx*m,cz=a[1]+dz*m;
   const closed=body(cx-ix*.024,cz-iz*.024)&&body(cx+ix*.035,cz+iz*.035),verandah=deck(cx-ix*.012,cz-iz*.012)&&deck(cx+ix*.035,cz+iz*.035);
   if(!closed&&!verandah)continue;
   const x=a[0]+dx*u+ix*.002,z=a[1]+dz*u+iz*.002,X=a[0]+dx*v+ix*.002,Z=a[1]+dz*v+iz*.002;
   if(closed){const y=find(x+ix*.008,z+iz*.008),Y=find(X+ix*.008,Z+iz*.008);
    if(y!==undefined&&Y!==undefined) for(const q of [[x,.57,z],[x,y,z],[X,Y,Z],[x,.57,z],[X,Y,Z],[X,.57,Z]]){vertices.push(...q);UV.push(Math.abs(dx)>=Math.abs(dz)?q[0]:q[2],q[1]);}
   }
   const profile=(lo:number,hi:number,p:number[],uv:number[])=>{
    for(const q of [[x,lo,z],[x,hi,z],[X,hi,Z],[x,lo,z],[X,hi,Z],[X,lo,Z]]){p.push(...q);uv.push(Math.abs(dx)>=Math.abs(dz)?q[0]:q[2],q[1]);}
   };
   profile(-1.20,closed?.603:.256,toes,toesUV);
   if(!closed&&verandah)profile(.256,.678,skirt,skirtUV);
  }
 }
 function compose(p:number[],u:number[]){
  if(!p.length)return undefined;
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(p,3)).setAttribute('uv',new T.Float32BufferAttribute(u,2));g.computeVertexNormals();return g;
 }
 return {top:compose(vertices,UV),foot:compose(toes,toesUV),skirt:compose(skirt,skirtUV)};
}
export function disposeBeaconsfieldPreview(obj:T.Group){
 const mat=new Set<T.Material>();obj.traverse(m=>{if(m instanceof T.Mesh){m.geometry.dispose();mat.add(m.material);}});for(const v of mat)v.dispose();
}
export function makeBeaconsfieldPreview(){
 const {model,simple}=buildBeaconsfield(true);
 // A preview never touches the world terrain, route pack, aircraft, shadow caster or contact.
 // Preserve the absolute LiDAR roof. A below-grade support toe is clipped with the same ownership plan.
 const cg=closure(model);
 for(const [section,mat] of [[cg.top,'ochre'],[cg.foot,'foundation'],[cg.skirt,'skirt']] as const){
  const fix=model.children.find(m=>m.name===mat) as T.Mesh;
  if(section&&fix){const facing=new T.Mesh(section,fix.material);facing.name='inside-outline closure: '+mat;model.add(facing);}
 }
 const keep=new Set(model.children.map(o=>(o as T.Mesh).material));
 for(const m of simple.children as T.Mesh<T.BufferGeometry,T.Material>[]){m.geometry.dispose();if(!keep.has(m.material))m.material.dispose();}
 let verts=0,violations=0,minimumGap=Infinity;
 for(const m of model.children as T.Mesh[]){
   const g=m.geometry;m.geometry=applyPlan(g);g.dispose();const a=m.geometry.getAttribute('position');verts+=a.count;
   for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i);if(!geoInside(x,z))violations++;minimumGap=Math.min(minimumGap,distance(x,z));}
 }
 if(violations||!verts||minimumGap<.008){disposeBeaconsfieldPreview(model);return;}
 const [a,b]=S.basisXZ,[x,z]=S.centroidXZ;
 model.matrixAutoUpdate=false;model.matrix.set(a[0],0,b[0],x,0,1,0,S.floorCGVD,a[1],0,b[1],z,0,0,0,1);
 model.name='Beaconsfield Historic House · bounded exterior preview';
 model.userData={beaconsfield:true,minimumPlanInsetM:minimumGap,vertices:verts,triangles:verts/3,absoluteBase:S.floorCGVD};
 return model;
}
