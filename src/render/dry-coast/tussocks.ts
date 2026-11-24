// Original dry turf silhouettes for the small architectural study, never an ecology inventory.
import * as T from 'three';
import type {World} from '../world.ts';
import type {BoundedGrade} from '../../sim/bounded-grade.ts';
import {DRY_FRAME,drySupport,dryToWorld,soilPlantPattern,n} from './soil.ts';
import {ENTRY,WALL0,rearU,farU,negV,posV} from '../north-rustico/frame.ts';
import {RUSTICO_SHADE} from '../north-rustico/shade.generated.ts';

type Root={u:number;v:number;x:number;y:number;z:number;canopy:number;shape:number;seed:number};
const unit=(s:number)=>{
 let a=s|0;a^=a<<13;a^=a>>>17;a^=a<<5;return (a>>>0)/4294967296;
};
const GEOMETRY_LIMIT=300;
const rand=(a:number,b:number,i:number)=>unit(Math.imul(a+341,73856093)^Math.imul(b+512,19349663)^Math.imul(i+39,83492791));
const box=(x:number,y:number,l:number,r:number,t:number,b:number,margin:number)=>x>=l-margin&&x<=r+margin&&y>=t-margin&&y<=b+margin;
const shortSlope=(q:(x:number,z:number)=>number,x:number,z:number,step=.21)=>{
 const U=(q(x+step,z)-q(x-step,z))/(2*step),V=(q(x,z+step)-q(x,z-step))/(2*step);
 return 1/Math.sqrt(U*U+V*V+1);
};
const insideDryPlantHardReserve=(u:number,v:number)=>!box(u,v,rearU(WALL0),farU(WALL0),negV(WALL0),posV(WALL0),.49)
 && !box(u,v,ENTRY.left,ENTRY.right,ENTRY.back,ENTRY.front,.51);
export function tussockRoots(world:World,grade:BoundedGrade){
 const list:Root[]=[],scale=.519,[a,b]=DRY_FRAME.center,[rx,rz]=DRY_FRAME.radius;
 const C=world.cover,t=world.terrain,q=world.visualGroundHeight.bind(world);
 for(let j=Math.floor((b-rz)/scale);j<Math.ceil((b+rz)/scale);j++){
  for(let i=Math.floor((a-rx)/scale);i<Math.ceil((a+rx)/scale);i++){
   const u=(i+.11+.78*rand(i,j,0))*scale,v=(j+.11+.78*rand(i,j,1))*scale;
   if(!insideDryPlantHardReserve(u,v))continue;
   const [x,z]=dryToWorld(u,v),y=q(x,z),c=C.sample(t,x,z),sg=C.distance(t,x,z);
   const w=grade.weight(x,z),up=shortSlope(q,x,z),eligible=drySupport(u,v,c,sg,y,up,w);
   if(eligible<.49||w<.90||sg<39||y<2.28||y>3.52)continue;
   // Four complete-world clearance points leave natural gaps along the two hard structures
   // and ensure actual leaf tips do not reach an invalid/wet class or lowered floor.
   let safe=true;
   for(const [s,t2] of [[-.27,0],[.27,0],[0,-.27],[0,.27]]){
    const [X,Z]=dryToWorld(u+s,v+t2);
    if(grade.weight(X,Z)<.79||C.sample(t,X,Z)!==30||C.distance(t,X,Z)<37||!insideDryPlantHardReserve(u+s,v+t2)){safe=false;break;}
   }
   if(!safe)continue;
   const plant=soilPlantPattern(u,v),islet=n(u*.94+5.83,v*.94-22.148);
   if(plant<.36||islet<.29||rand(i,j,2)>(.123+.66*plant)*islet*eligible)continue;
   list.push({u,v,x,y,z,canopy:.66+.44*rand(i,j,3),shape:rand(i,j,4),seed:rand(i,j,5)});
  }
 }
 // Stable resource cap, never preferentially draw the north edge of the finite candidate grid.
 return list.sort((a,b)=>b.seed-a.seed).slice(0,GEOMETRY_LIMIT);
}
function geometry(){
 // Each narrow leaf is a three-segment blade with actual outward lean and a tapered apex.
 // One small tuft is 12 leaves x 5 triangles; no card vegetation, masks, or external textures.
 const xyz:number[]=[],uv:number[]=[],leaf:number[]=[],idx:number[]=[];
 const rings=[0,.34,.71,1],N=12;
 for(let k=0;k<N;k++){
  const a=2.39996323*k+.35*unit(1463+k*37654);
  const cos=Math.cos(a),sin=Math.sin(a),base=.017+.049*unit(7231+k*77376),w=.010+.015*unit(44581+k*57361),L=.048+.105*unit(94222+k*59133),lean=.061+.106*unit(8511+k*93113),curl=.026+.047*unit(3331+k*12437);
  const bk=xyz.length/3;
  for(let j=0;j<rings.length;j++){
   const s=rings[j],C=(base+lean*s*s*.96),off=curl*s*s*(k%3===0?-1:1),y=L*(s-.068*s*s)-.014;
   for(let side=-1;side<=1;side+=2){
    if(j===3&&side===1)continue;
    const W=Math.max(0,w*.5*(1-s*s));
    xyz.push(C*cos-(off+W*side)*sin,y,C*sin+(off+W*side)*cos);
    uv.push((side+1)*.5,s);leaf.push(unit(72153+k*74269));
   }
   const j0=bk+(j-1)*2;
   if(j===1||j===2)idx.push(j0,j0+2,j0+1,j0+1,j0+2,j0+3);
   else if(j===3)idx.push(j0,j0+2,j0+1);
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('leaf',new T.Float32BufferAttribute(leaf,1));g.setIndex(idx);
 return g;
}

export function makeDryTussocks(world:World,grade:BoundedGrade){
 const {n,x,z,dx,dz,alpha}=RUSTICO_SHADE;
 const roots=tussockRoots(world,grade);
 if(!roots.length)return;
 const tex=new T.DataTexture(Uint8Array.from(atob(alpha),i=>i.charCodeAt(0)),n,n,T.RedFormat);
 tex.magFilter=tex.minFilter=T.LinearFilter;tex.needsUpdate=true;
 const mat=new T.ShaderMaterial({
  vertexShader:/*glsl*/`
   attribute float leaf; attribute vec3 nursery;
   varying vec3 world; varying vec2 shade;varying vec4 part;
   #include <common>
   #include <logdepthbuf_pars_vertex>
   void main(){
    vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
    float d=distance(cameraPosition,root);
    float fade=(1.-smoothstep(22.,58.,d))*nursery.x;
    vec3 p=position;
    float variety=fract(leaf*.873+nursery.z*1.187+nursery.y);
    p.xz*=mix(.62,1.08,fade)*(.74+.47*variety);p.y*=mix(.38,1.,fade)*(.75+.58*variety);
    p.xz+=vec2(.082,-.013)*uv.y*uv.y*(nursery.z-.40);
    world=(modelMatrix*instanceMatrix*vec4(p,1.)).xyz;
    shade=root.xz;
    part=vec4(uv.y,leaf,nursery.y,fade);
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:/*glsl*/`
   varying vec3 world;varying vec2 shade;varying vec4 part;
   uniform vec3 sunlight;uniform sampler2D leafExteriorShade;uniform vec4 leafExteriorBounds;uniform float leafShadowN;
   #include <common>
   #include <logdepthbuf_pars_fragment>
   void main(){
    #include <logdepthbuf_fragment>
    if(part.w<=.015)discard;
    vec3 normal=normalize(cross(dFdx(world),dFdy(world)));
    float lit=abs(dot(normal,sunlight));
    float y=clamp(part.x,0.,1.);
    float bot=smoothstep(.01,.76,y);
    vec3 olive=mix(vec3(.071,.093,.044),vec3(.173,.198,.109),bot);
    vec3 hay=mix(vec3(.102,.107,.061),vec3(.236,.205,.133),bot);
    float dried=smoothstep(.55,.91,part.y*.55+part.z*.53)*.91;
    vec3 col=mix(olive,hay,dried)*(.67+.38*lit+.13*smoothstep(.31,.9,y));
    vec2 uv=(shade-leafExteriorBounds.xy)*leafExteriorBounds.zw;
    if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){
     float shadow=texture2D(leafExteriorShade,(uv*(leafShadowN-1.)+.5)/leafShadowN).r;
     col*=1.-.26*shadow;
    }
    gl_FragColor=vec4(col,smoothstep(.022,.62,part.w));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
  uniforms:{sunlight:{value:world.sun},leafExteriorShade:{value:tex},
     leafExteriorBounds:{value:new T.Vector4(x,z,1/((n-1)*dx),1/((n-1)*dz))},leafShadowN:{value:n}},
  side:T.DoubleSide,depthWrite:true,alphaToCoverage:true,
 });
 const g=geometry(),v=new Float32Array(roots.length*3),mesh=new T.InstancedMesh(g,mat,roots.length);
 const rot=new T.Object3D();
 mesh.name='Authored near coastal tussocks (dry only)';
 const origin=DRY_FRAME.origin;
 mesh.position.set(origin[0],0,origin[1]);mesh.visible=false;
 for(let i=0;i<roots.length;i++){
  const u=roots[i];rot.position.set(u.x-origin[0],u.y-.014,u.z-origin[1]);rot.rotation.set(0,u.seed*6.2831853,0);
  const k=.76+u.shape*.59;
  rot.scale.set(k,k*(.68+.40*u.shape),k);rot.updateMatrix();mesh.setMatrixAt(i,rot.matrix);
  v[i*3]=u.canopy;v[i*3+1]=u.seed;v[i*3+2]=u.shape;
 }
 g.setAttribute('nursery',new T.InstancedBufferAttribute(v,3));
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
 return {mesh,roots,triangles:(g.index!.count/3)*roots.length,
   dispose:()=>{mesh.removeFromParent();mesh.dispose();g.dispose();mat.dispose();tex.dispose();}};
}
