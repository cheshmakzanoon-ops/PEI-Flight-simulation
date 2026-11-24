import * as T from 'three';
import {GROUND_LIFT} from '../../sim/coastal-terrain.ts';
import type {BoundedGrade} from '../../sim/bounded-grade.ts';

/** Original precomputed visible-sun coverage from the landmark geometry.
 * A single matched receiver lies on the surveyed fine mesh, never the water
 * or surrounding stock render meshes. No shadow render target is created. */
export function rusticoShade(g:BoundedGrade,mask:Uint8Array,r:{n:number;x:number;z:number;dx:number;dz:number}){
 const {n,x,z,dx,dz}=r,a=g.grid;
 if(n<32||n>128||mask.length!==n*n||!(dx>0&&dz>0))throw Error('Invalid landmark shadow mask');
 const width=(n-1)*dx,depth=(n-1)*dz;
 const x0=Math.max(0,Math.floor((x-a.x0)/a.stepX)),z0=Math.max(0,Math.floor((z-a.z0)/a.stepZ));
 const xe=Math.min(a.nx-1,Math.ceil((x+width-a.x0)/a.stepX)),ze=Math.min(a.nz-1,Math.ceil((z+depth-a.z0)/a.stepZ));
 const pos:number[]=[],uv:number[]=[],index:number[]=[];
 for(let j=z0;j<=ze;j++)for(let i=x0;i<=xe;i++){
  const wx=a.x0+i*a.stepX,wz=a.z0+j*a.stepZ;
  pos.push(wx-x,a.indexHeight(i,j)+GROUND_LIFT+.024,wz-z);
  uv.push((wx-x)/width,(wz-z)/depth);
  if(i===xe||j===ze)continue;
  const h=(j-z0)*(xe-x0+1)+i-x0,b=h+xe-x0+1;
  index.push(h,b,h+1,b,b+1,h+1);
 }
 const tex=new T.DataTexture(mask,n,n,T.RedFormat,T.UnsignedByteType);
 tex.minFilter=T.LinearFilter;tex.magFilter=T.LinearFilter;tex.needsUpdate=true;
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.setIndex(index);geometry.computeBoundingSphere();
 const mat=new T.ShaderMaterial({
  vertexShader:`
  varying vec2 st;varying vec3 world;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){
   st=uv;world=(modelMatrix*vec4(position,1.)).xyz;
   gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
   #include <logdepthbuf_vertex>
  }`,
  fragmentShader:`
   uniform sampler2D shadeMask;uniform float size;varying vec2 st;varying vec3 world;
   #include <common>
   #include <logdepthbuf_pars_fragment>
   void main(){
    #include <logdepthbuf_fragment>
    if(any(lessThan(st,vec2(0.)))||any(greaterThan(st,vec2(1.))))discard;
    float a=texture2D(shadeMask,(st*(size-1.)+.5)/size).r;
    a*=1.-smoothstep(140.,470.,distance(world,cameraPosition));
    if(a<.016)discard;
    gl_FragColor=vec4(.018,.024,.029,a*.31);
    #include <colorspace_fragment>
   }`,
  uniforms:{shadeMask:{value:tex},size:{value:n}},
  transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-.45,polygonOffsetUnits:-1,
 });
 const m=new T.Mesh(geometry,mat);m.position.set(x,0,z);m.name='Measured landmark shadow receiver';
 m.visible=false;return m;
}
