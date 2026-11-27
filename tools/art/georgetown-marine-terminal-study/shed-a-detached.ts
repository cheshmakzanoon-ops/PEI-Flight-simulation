/** Detached 2020 envelope and original appearance hypothesis for Transit Shed A. */
import * as T from 'three';
import {SHED_A_INPUT as I} from './shed-a-input.generated.ts';
type V=[number,number,number];
type P={p:V;u:number;v:number};
const H=(q:readonly number[],u:number,v:number)=>q[0]*u+q[1]*v+q[2];
const G=(x:number,y:number,z:number)=>[x,y,z].map(Math.fround) as V;
const c=I.signedXZ.map(([x,z],i)=>{
 const [u,v]=I.metricUV[i];return {u,v,p:G(x,H(v<0?I.planeMinus:I.planePlus,u,v),z)};
});
const apex=(a:P,b:P):P=>{
 const delta=(p:P)=>H(I.planeMinus,p.u,p.v)-H(I.planePlus,p.u,p.v);
 const t=delta(a)/(delta(a)-delta(b));
 if(!(t>.48&&t<.53))throw Error('Unsupported ridge crossing');
 const u=a.u+(b.u-a.u)*t,v=a.v+(b.v-a.v)*t;
 return {u,v,p:G(a.p[0]+(b.p[0]-a.p[0])*t,H(I.planePlus,u,v),a.p[2]+(b.p[2]-a.p[2])*t)};
};
const base=(a:P):P=>({...a,p:G(a.p[0],I.floorClosure,a.p[2])});
const xyz=(a:P)=>new T.Vector3(...a.p);
const shaderV=`
attribute float surfacePart;
varying vec3 worldP,worldN;varying vec2 opUV;varying float part;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
 worldP=(modelMatrix*vec4(position,1.)).xyz;worldN=mat3(modelMatrix)*normal;
 part=surfacePart;opUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
 #include <logdepthbuf_vertex>
}
`;
const shaderF=`
uniform vec3 sceneSun;
varying vec3 worldP,worldN;varying vec2 opUV;varying float part;
#include <common>
#include <logdepthbuf_pars_fragment>
float hashG(vec2 p){vec3 n=fract(vec3(p.xyx)*.1031);n+=dot(n,n.yzx+33.33);return fract((n.x+n.y)*n.z);}
float finish(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);
 return mix(mix(hashG(a),hashG(a+vec2(1.,0.)),b.x),mix(hashG(a+vec2(0.,1.)),hashG(a+vec2(1.)),b.x),b.y);}
void main(){
 #include <logdepthbuf_fragment>
 float roof=part<.5?1.:0.,light=max(0.,dot(normalize(worldN),sceneSun));
 float broad=finish(opUV*vec2(.24,.35))-.5;
 float reach=max(fwidth(opUV.x),fwidth(opUV.y));
 float wear=(finish(opUV*vec2(3.2,2.1))-.5)*(1.-smoothstep(.15,.55,reach));
 float wet=1.-smoothstep(1.73,2.36,worldP.y);
 vec3 material=mix(vec3(.56,.565,.55),vec3(.66,.655,.62),roof);
 vec3 paint=material*(mix(.71,.84,roof)+mix(.28,.20,roof)*light+.065*broad+.023*wear-.105*wet);
 float haze=1.-exp(-length(cameraPosition-worldP)*.000020);
 gl_FragColor=vec4(mix(paint,vec3(.56,.68,.72),haze),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
export function createDetachedTransitShedA(sun:T.Vector3){
 if(!Number.isFinite(sun.lengthSq())||Math.abs(sun.lengthSq()-1)>.01)throw Error('Expected native daylight');
 const south=apex(c[0],c[3]),north=apex(c[1],c[2]),up=new T.Vector3(0,1,0);
 const centre=c.reduce((a,b)=>a.add(xyz(b)),new T.Vector3()).multiplyScalar(.25);
 const P:number[]=[],N:number[]=[],UV:number[]=[],M:number[]=[];
 const put=(a:P,b:P,c:P,want:T.Vector3,r:number)=>{
  const n=xyz(b).sub(xyz(a)).cross(xyz(c).sub(xyz(a))).normalize();
  if(n.dot(want)<0){[b,c]=[c,b];n.negate();}
  if(!(n.dot(want)>.1))throw Error('Degenerate historic shell facet');
  for(const q of [a,b,c]){P.push(...q.p);N.push(...n.toArray());UV.push(q.u,r===0?q.v:q.p[1]);M.push(r);}
 };
 for(let i=0;i<4;i++){
  const a=c[i],b=c[(i+1)%4],normal=xyz(a).add(xyz(b)).multiplyScalar(.5).sub(centre).setY(0).normalize();
  put(base(a),a,b,normal,1);put(base(a),b,base(b),normal,1);
  if(i===1)put(a,north,b,normal,1);
  if(i===3)put(a,south,b,normal,1);
 }
 put(c[0],c[1],north,up,0);put(c[0],north,south,up,0);
 put(c[3],north,c[2],up,0);put(c[3],south,north,up,0);
 const g=new T.BufferGeometry();
 for(const [name,v,s] of [['position',P,3],['normal',N,3],['uv',UV,2],['surfacePart',M,1]] as const)
  g.setAttribute(name,new T.Float32BufferAttribute(v,s));
 g.computeBoundingBox();g.computeBoundingSphere();
 const mesh=new T.Mesh(g,new T.ShaderMaterial({vertexShader:shaderV,fragmentShader:shaderF,uniforms:{sceneSun:{value:sun}},
  side:T.FrontSide,transparent:false,depthWrite:true,depthTest:true,toneMapped:true}));
 mesh.position.set(I.origin[0],0,I.origin[1]);mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.name='Historical Georgetown Transit Shed A';
 mesh.userData.originEvidence={originalOwner:I.oldSignedRowSHA,ridge:[south.p[1],north.p[1]],visualOnly:true};
 return mesh;
}
