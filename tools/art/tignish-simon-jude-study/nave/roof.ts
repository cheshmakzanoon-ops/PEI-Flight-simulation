import {BufferGeometry,Color,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,ShapeUtils,Vector2,Vector3} from 'three';
export type UV=[number,number];
export type Plane=[number,number,number]; // easting U, northing V, absolute CGVD2013: Y = C + slopeU U + slopeV V
type Window={id:string;u:UV;v:UV;planes:Plane[]};
export type RoofRecipe={schema:1;owner:'q221232/98';localYOrigin:number;world:{worldXZAtUV00:UV;worldXZPerU:UV;worldXZPerV:UV};outlineUV:UV[];patches:Window[]};
const EPS=2e-10;
const score=(p:Plane,[u,v]:UV)=>p[0]+p[1]*u+p[2]*v;
const minus=(a:Plane,b:Plane):Plane=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const near=(a:UV,b:UV)=>(a[0]-b[0])**2+(a[1]-b[1])**2<4e-20;
function cut(poly:UV[],eq:Plane){
 const d:UV[]=[];
 const append=(x:UV)=>{if(d.length===0||!near(d[d.length-1],x))d.push(x)};
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],s=score(eq,a),t=score(eq,b);
  if(s<EPS)append(a);
  if((s<-EPS&&t>EPS)||(t<-EPS&&s>EPS)){
   const f=s/(s-t);append([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
  }
 }
 if(d.length>=2&&near(d[0],d[d.length-1]))d.pop();return d.length>=3?d:[];
}
const area=(a:UV,b:UV,c:UV)=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
/** Partial measured witness only. Holes are intentional. There is no architecture outside the exact frozen roof masks. */
export function makeTignishRoof(p:RoofRecipe){
 if(p.owner!=='q221232/98'||p.schema!==1||p.patches.length!==11||p.outlineUV.length!==19)throw Error('Wrong Tignish roof scope');
 const group=new Group(),{world,localYOrigin}=p;group.name='Tignish q221232/98 · separated roof evidence (not scenery)';
 group.position.set(world.worldXZAtUV00[0],localYOrigin,world.worldXZAtUV00[1]);
 const cutout=ShapeUtils.triangulateShape(p.outlineUV.map(q=>new Vector2(q[0],q[1])),[]).map(t=>t.map(i=>p.outlineUV[i]));
 const loc=([u,v]:UV,plane:Plane)=>new Vector3(world.worldXZPerU[0]*u+world.worldXZPerV[0]*v,score(plane,[u,v])-localYOrigin,world.worldXZPerU[1]*u+world.worldXZPerV[1]*v);
 for(const patch of p.patches){
  let total=0;
  const box:Plane[]=[[patch.u[0],-1,0],[-patch.u[1],1,0],[patch.v[0],0,-1],[-patch.v[1],0,1]];
  const clips=cutout.map(q=>box.reduce((a,b)=>cut(a,b),q)).filter(q=>q.length>2);
  for(const [i,f]of patch.planes.entries()){
   const P:number[]=[],uv:number[]=[];let a=0,n=1;
   for(const sheet of clips){
    const footprint=patch.planes.reduce((g,q,k)=>i===k?g:cut(g,minus(f,q)),sheet);
    for(let i=1;i+1<footprint.length;i++){
     const F=[footprint[0],footprint[i],footprint[i+1]],A=area(F[0],F[1],F[2]);if(A<1e-8)continue;
     const V=F.map(q=>loc(q,f)),N=V[1].clone().sub(V[0]).cross(V[2].clone().sub(V[0]));
     if(N.y<0){[V[1],V[2]]=[V[2],V[1]];[F[1],F[2]]=[F[2],F[1]];N.negate();}
     n=Math.min(n,N.normalize().y);a+=A;total+=A;
     for(let i=0;i<3;i++){P.push(...V[i].toArray());uv.push(...F[i]);}
    }
   }
   if(!P.length)continue;
   const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(P,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();
   const c=patch.id.includes('crown')?0x9c9884:patch.id.includes('shoulder')?0x697b75:patch.id.startsWith('west')?0x9c6b54:0x7b7972;
   const mesh=new Mesh(g,new MeshStandardMaterial({color:new Color(c),roughness:.87,flatShading:true}));mesh.name=patch.id+'/'+i;mesh.userData={role:patch.id,minUpNormal:n,areaUV:a,mask:{u:patch.u,v:patch.v}};group.add(mesh);
  }
  const max=(patch.u[1]-patch.u[0])*(patch.v[1]-patch.v[0]),expected=clips.reduce((s,q)=>{for(let i=1;i+1<q.length;i++)s+=area(q[0],q[i],q[i+1]);return s;},0);
  if(total<=0||total>max+2e-6||Math.abs(total-expected)>3e-6)throw Error(`Gaps or overlaps inside ${patch.id}: ${total} / ${expected}`);
 }
 group.updateMatrixWorld(true);return group;
}
