import * as THREE from 'three';

export type HedgeSeat = Readonly<{
  id:string; ix:number; style:1|2|3; coords:readonly [number,number,number];
  shape:readonly [number,number,number,number]; ground:number; bandAxisYaw:number; closureM:number;
}>;
const MAX_COHORT=320, MAX_TRIS=330_000, MAX_TEMPLATE_TRIS=1250;
type Vec=[number,number,number];
type Clump=[Vec,Vec,number]; // centre, radii in old H/W units, crown luminance family
const X = new THREE.Vector3(1,0,0);
const BP=[0x4b5735,0x40562e,0x35452e,0x394b31].map(c=>new THREE.Color(c));
const bark=new THREE.Color(0x4b4b30);
const tau=2*Math.PI;
const length2=(x:number,z:number)=>Math.hypot(x,z);
const signal=(v:number)=>{const q=Math.sin(v*73.12559+11.5381)*24317.35813;return q-Math.floor(q);};
const v3=(v:Vec)=>new THREE.Vector3(...v);
const resetColor=(c:THREE.Color)=>[c.r,c.g,c.b];

type ArtBuffer={P:number[];C:number[];I:number[];bark:number[];lh:number[]};
export type HedgePrototype=Readonly<{
  positions:Float32Array; normals:Float32Array; colors:Float32Array;
  barkMask:Uint8Array; crownHeight:Float32Array; indices:Uint16Array;
  triangles:number; radius:number; pieceRanges:readonly [number,number][];
}>;
const templates=new Map<string,HedgePrototype>();
function sampleClump(g:ArtBuffer,raw:Clump,v:number,s:number,edge:boolean){
  const [C,R,gain]=raw,[sx,sy,sz]=C,[rx,ry,rz]=R;
  const start=g.P.length/3,startI=g.I.length,width=edge?7:13,bands=edge?3:6;
  const palette = BP[v].clone().multiplyScalar(gain);
  const color=(y:number,variation:number)=>
    palette.clone().multiplyScalar((.88+.22*Math.max(0,(y-.27)/.73))*(.90+.18*variation));
  const append=(x:number,y:number,z:number,q:number)=>{
    g.P.push(x,y,z);g.C.push(...resetColor(color(y,q)));g.bark.push(0);g.lh.push(y);
  };
  append(sx,sy-ry*.91,sz,.38);
  for(let j=1;j<bands;j++){
    const lat=-Math.PI*.5+j*Math.PI/bands;
    for(let k=0;k<width;k++){
      const yaw=k*tau/width+.17*signal(s+.128);
      // Asymmetric large fronds plus a small irregular shoulder. No infinite
      // speckle/discard or arbitrary preset per metre; literal 3D lobes.
      const swell=1+.120*Math.sin(3*yaw+1.3*lat+s)*Math.cos(lat)+.055*Math.cos(5*yaw-3*lat+s*.8);
      const eta=.94+.10*signal(s+k*.349+j*1.461);
      const a=Math.cos(lat)*swell*eta;
      const xx=sx+Math.cos(yaw)*rx*a+.09*rx*Math.sin(lat+.6+s);
      const zz=sz+Math.sin(yaw)*rz*a-.06*rz*Math.sin(lat+s);
      const yy=sy+Math.sin(lat)*ry*(1+.067*Math.sin(yaw*2+s))+.054*ry*Math.cos(3*yaw+s)*Math.cos(lat);
      append(xx,yy,zz,signal(s+31*k+14.1*j));
    }
  }
  const apex=g.P.length/3;append(sx+.02*rx,sy+ry,sz,.72);
  const first=start+1;
  for(let k=0;k<width;k++){
    const k1=(k+1)%width;
    g.I.push(start,first+k,first+k1);
    for(let j=0;j<bands-2;j++){
      const a=first+j*width;
      g.I.push(a+k,a+width+k,a+k1,a+k1,a+width+k,a+width+k1);
    }
    g.I.push(apex,apex-width+k1,apex-width+k);
  }
  return [startI/3,g.I.length/3] as [number,number];
}
function twig(g:ArtBuffer,spine:readonly Vec[], radii:readonly number[],v:number,seed:number){
  const ix=g.I.length/3, start=g.P.length/3,N=7;
  const add=(p:THREE.Vector3,c:number)=>{
    g.P.push(p.x,p.y,p.z);
    g.C.push(...resetColor(bark.clone().multiplyScalar(c)));
    g.bark.push(255);g.lh.push(p.y);
  };
  add(v3(spine[0]),.76);
  for(let i=0;i<spine.length;i++){
    const center=v3(spine[i]),
      d=v3(spine[Math.min(spine.length-1,i+1)]).sub(v3(spine[Math.max(0,i-1)])).normalize(),
      r=new THREE.Vector3().crossVectors(d,X).normalize(), s=new THREE.Vector3().crossVectors(r,d).normalize();
    for(let k=0;k<N;k++){
      const a=k*tau/N,q=Math.max(.0065,radii[i])*(.94+.12*signal(k+seed));
      const p=center.clone().addScaledVector(r,Math.cos(a)*q).addScaledVector(s,Math.sin(a)*q);
      add(p,(.70+.3*i/Math.max(1,spine.length-1))*(.88+.25*signal(k+seed)));
    }
  }
  const top=g.P.length/3;add(v3(spine.at(-1)!),1.02);
  for(let k=0;k<N;k++){
    const j=(k+1)%N;
    g.I.push(start,start+1+j,start+1+k);
    for(let n=0;n<spine.length-1;n++){
      const i=start+1+n*N;
      g.I.push(i+k,i+j,i+k+N,i+j,i+j+N,i+k+N);
    }
    g.I.push(top,top-N+k,top-N+j);
  }
  return [ix,g.I.length/3] as [number,number];
}
function outward(g:ArtBuffer,a:number,b:number){
  // Orient outward using independently signed volume of each closed piece.
  let s=0;
  for(let i=a*3;i<b*3;i+=3){
    const [k,l,m]=[g.I[i]*3,g.I[i+1]*3,g.I[i+2]*3],A=g.P;
    s+=A[k]*(A[l+1]*A[m+2]-A[l+2]*A[m+1])+A[k+1]*(A[l+2]*A[m]-A[l]*A[m+2])+
      A[k+2]*(A[l]*A[m+1]-A[l+1]*A[m]);
  }
  if(Math.abs(s)<1e-7||!Number.isFinite(s))throw Error('open/degenerate piece');
  if(s<0)for(let i=a*3;i<b*3;i+=3)[g.I[i+1],g.I[i+2]]=[g.I[i+2],g.I[i+1]];
}
export function hedgePrototype(family:'shrub'|'broad'|'tall',variant:number):HedgePrototype {
  if(!Number.isInteger(variant)||variant<0||variant>3)throw Error('unregistered stock family');
  const key=family+':'+variant;
  const previous=templates.get(key);if(previous)return previous;
  const g:ArtBuffer={P:[],C:[],I:[],bark:[],lh:[]}, pieces:[number,number][]=[];
  const v=variant, b=.5+v*.31;
  const low=family==='shrub',tall=family==='tall';
  let field:Clump[];
  if(low){
    field=[
      [[-.172,.43,.030],[.209,.296,.209],.91],
      [[.183,.465,-.014],[.196,.307,.190],1.03],
      [[-.070,.66,-.081],[.207,.311,.202],1.08],
      [[.063,.578,.123],[.177,.275,.203],.96],
      [[-.228,.333,-.101],[.154,.218,.143],.91],
      [[.093,.574,-.150],[.131,.160,.132],1.0],
    ];
    pieces.push(twig(g,[[0,0,0],[-.038,.20,0],[-.135,.46,.023]],[.018,.014,.005],v,b));
    pieces.push(twig(g,[[0,0,0],[.061,.20,-.011],[.174,.49,-.01]],[.016,.013,.004],v,b+1.));
    pieces.push(twig(g,[[0,.024,0],[-.008,.28,.09],[.065,.54,.135]],[.014,.010,.003],v,b+3.));
  }else if(tall){
    field=[
      [[-.108,.49,.040],[.185,.181,.196],.94],
      [[.158,.59,-.035],[.215,.179,.176],.97],
      [[-.127,.662,-.083],[.208,.195,.182],1.0],
      [[.019,.725,.106],[.220,.195,.201],.97],
      [[.021,.841,-.037],[.147,.163,.141],1.09],
      [[.13,.746,-.105],[.114,.14,.130],1.0],
    ];
    pieces.push(twig(g,[[0,0,0],[-.021,.32,.015],[.025,.67,-.02],[.021,.89,-.037]],[.023,.021,.014,.005],v,b));
    for(const [x,y,z] of field.slice(0,4).map(c=>c[0])){
      pieces.push(twig(g,[[0,y-.27,0],[x*.46,y-.13,z*.35],[x,y,z]],[.012,.010,.004],v,b+y));
    }
  }else{
    field=[
      [[-.170,.636,-.067],[.207,.202,.217],.99],
      [[.154,.64,.056],[.211,.213,.206],.95],
      [[.006,.786,-.051],[.227,.214,.220],1.08],
      [[-.035,.706,.166],[.215,.189,.172],.97],
      [[.111,.725,-.165],[.175,.174,.149],.96],
      [[-.211,.568,.092],[.168,.146,.135],.94],
    ];
    if(v===1){
      for(const [c,r] of field){c[0]*=.83;c[1]=.14+.86*c[1];c[2]*=1.04;r[1]*=1.02;}
    }
    pieces.push(twig(g,[[0,0,0],[-.032,.27,.027],[-.009,.53,.029],[.012,.83,-.034]],[.025,.023,.016,.008],v,b));
    for(const [x,y,z] of field.filter((_,j)=>j!==2).map(c=>c[0])){
      pieces.push(twig(g,[[-.022,y-.36,.013],[x*.54,y-.14,z*.52],[x,y-.012,z]],[.013,.011,.006],v,b+y));
    }
  }
  const taken=[...field];
  // These six end bunches overlap their physically continuous parent
  // lobe. No disconnected invented shrubs or thin floating masks.
  for(let i=0;i<field.length;i++){
    const [c,r,z]=field[i],yaw=Math.atan2(c[2],c[0]),dx=Math.cos(yaw),dz=Math.sin(yaw);
    const a=i%3===0?.69:.62, up=i===2?.64:.20;
    taken.push([[c[0]+dx*r[0]*a,c[1]+r[1]*up,c[2]+dz*r[2]*a],
      [r[0]*(i%2?.37:.43),r[1]*(i%2?.43:.37),r[2]*.39],z*.94]);
  }
  for(let i=0;i<taken.length;i++)pieces.push(sampleClump(g,taken[i],v,b+i*1.747,i>=4));
  for(const [a,b] of pieces)outward(g,a,b);
  const maxY=Math.max(...g.P.filter((_,i)=>i%3===1)),minY=Math.min(...g.P.filter((_,i)=>i%3===1));
  const far = Math.max(...g.P.filter((_,i)=>i%3===0).map((p,j)=>length2(p,g.P[j*3+2])));
  const s=.482/far, dy=1/(maxY-minY);
  for(let i=0;i<g.P.length;i+=3){
    const [x,y,z]=g.P.slice(i,i+3);g.P[i]=s*x;g.P[i+1]=(y-minY)*dy;g.P[i+2]=.54*s*z;g.lh[i/3]=g.P[i+1];
  }
  const P=new Float32Array(g.P), I=new Uint16Array(g.I);
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.BufferAttribute(P,3));geom.setIndex(new THREE.BufferAttribute(I,1));
  geom.computeVertexNormals();
  const N=Float32Array.from(geom.getAttribute('normal').array);
  geom.dispose();
  if (I.length/3>MAX_TEMPLATE_TRIS)throw Error('primitive budget');
  const art=Object.freeze({positions:P,normals:N,colors:new Float32Array(g.C),indices:I,
    barkMask:new Uint8Array(g.bark),crownHeight:new Float32Array(g.lh),triangles:I.length/3,
    radius:.482,pieceRanges:Object.freeze(pieces)});
  templates.set(key,art);return art;
}
const decl=`
attribute vec4 hedgeSeat; attribute vec4 hedgeArt; attribute vec3 hedgePigment; attribute float hedgeWood;
varying vec3 artNormal,artColor,leafLocation;varying float artWood,artHeight;
varying vec3 leafBasis;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  float cs=cos(hedgeArt.z),sn=sin(hedgeArt.z);
  vec3 k=position*vec3(hedgeSeat.w,hedgeArt.x,hedgeSeat.w);
  vec3 q=hedgeSeat.xyz+vec3(cs*k.x+sn*k.z,k.y,-sn*k.x+cs*k.z);
  vec3 n=normal/vec3(hedgeSeat.w,hedgeArt.x,hedgeSeat.w);
  artNormal=normalize(vec3(cs*n.x+sn*n.z,n.y,-sn*n.x+cs*n.z));
  artColor=hedgePigment*hedgeArt.y;artWood=hedgeWood;artHeight=position.y;
  leafLocation=k+vec3(fract(hedgeSeat.x*.0623),0.,fract(hedgeSeat.z*.0419));
  leafBasis=vec3(hedgeArt.w,hedgeArt.y,hedgeArt.x);
  gl_Position=projectionMatrix*viewMatrix*vec4(q,1.);
  #include <logdepthbuf_vertex>
}
`;
const frag=`
varying vec3 artNormal,artColor,leafLocation,leafBasis;
varying float artWood,artHeight; uniform vec3 artSun;uniform float artMark;
uniform sampler2D stockLeafArt;
vec4 leafSwatch(vec2 p,bool roof,float family){
  vec2 d=vec2(.165,.38)*vec2(1.,.77);
  vec2 f=fract(p);
  vec2 q=vec2((family+.17)*.25,roof?.12:.60)+f*d;
  return textureGrad(stockLeafArt,q,d*dFdx(p),d*dFdy(p));
}
vec3 borrowedHue(vec3 p,vec3 n,float family,float l,vec3 prior){
  vec3 w=abs(n);w*=w;w/=max(w.x+w.y+w.z,.02);
  vec4 a=leafSwatch(p.xy+vec2(.24,.12),false,family);
  vec4 b=leafSwatch(p.zy+vec2(.57,.77),false,family);
  vec4 c=leafSwatch(p.xz+vec2(.76,.35),true,family);
  vec3 r=mix(prior,a.rgb*l,smoothstep(.40,.92,a.a))*w.z
        +mix(prior,b.rgb*l,smoothstep(.40,.92,b.a))*w.x
        +mix(prior,c.rgb*l,smoothstep(.40,.92,c.a))*w.y;
  return r;
}
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
 #include <logdepthbuf_fragment>
 vec3 n=normalize(artNormal);
 float E=smoothstep(-.32,.83,dot(n,artSun));
 float airy=smoothstep(.27,.77,artHeight);
 float receive=.770+.172*E+.064*airy;
 float mantle=.028*(1.-artWood)*max(0.,dot(n,artSun));
 vec3 hue=mix(vec3(.97,1.012,1.029),vec3(1.024,1.013,.971),E);
 // No colour can change a leaf mask, depth, or any original height/width.
 // Rough local authored pigment, not plant/photo projection or glitter.
 vec3 pig=borrowedHue(leafLocation*vec3(.79,.74,.83),n,leafBasis.x,leafBasis.y,artColor);
 vec3 surface=mix(artColor*vec3(.82,.86,.86),pig,.67*(1.-artWood));
 vec3 lit=surface*receive*hue+surface*mantle;
 if(artMark>=0.){gl_FragColor=vec4(vec3(artMark),1.);return;}
 gl_FragColor=vec4(lit,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
function seatOk(o:HedgeSeat){
 const [x,y,z]=o.coords,[h,w,f,l]=o.shape;
 return !!o.id.match(/^\d{1,2}-\d{1,2}$/)&&Number.isSafeInteger(o.ix)&&o.ix>=0&&[1,2,3].includes(o.style)&&
   [x,y,z,h,w,f,l,o.ground,o.bandAxisYaw,o.closureM].every(Number.isFinite)&&
   [x,y,z,h,w,f,l].every(k=>Math.fround(k)===k)&&h>=2&&h<=16&&w>=h*.86&&w<=h*1.69&&
   Math.floor(f)===f&&f>=0&&f<=3&&l>=.73&&l<=1.17&&o.closureM>=0&&
   Math.abs(y+((o.style===1)?.22:.20)-o.ground)<.000012;
}
export const shaderUnderTest=Object.freeze({vertex:decl,fragment:frag});
/** Image-free, closed 360-degree authoring, exact old seats in one detached
 * geometry group. Geodetic admission and live rendered roster are separate.
 * This factory cannot suppress original vegetation or re-sequence a slot. */
export function createDetachedHedgeBand(rows:readonly HedgeSeat[],sun:THREE.Vector3,borrowed:THREE.Texture){
 if(!borrowed?.isTexture||borrowed.colorSpace!==THREE.SRGBColorSpace||
    borrowed.minFilter!==THREE.LinearMipmapLinearFilter||borrowed.magFilter!==THREE.LinearFilter||
    borrowed.anisotropy!==2||!borrowed.generateMipmaps||
    !rows.length||rows.length>MAX_COHORT||!Number.isFinite(sun.lengthSq())||
    Math.abs(sun.lengthSq()-1)>.002||!rows.every(seatOk))return;
 if(new Set(rows.map(r=>r.id+':'+r.ix)).size!==rows.length||
    new Set(rows.map(r=>r.coords[0]+':'+r.coords[2])).size!==rows.length)return;
 const material=new THREE.ShaderMaterial({vertexShader:decl,fragmentShader:frag,
  uniforms:{artSun:{value:sun.clone()},artMark:{value:-1},stockLeafArt:{value:borrowed}},side:THREE.FrontSide,transparent:false,
  depthWrite:true,depthTest:true,blending:THREE.CustomBlending,
  blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.ZeroFactor,
  blendEquationAlpha:THREE.AddEquation,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor});
 const bands=new Map<string,HedgeSeat[]>();
 for(const r of rows){
  const kind=r.style===1?'shrub':r.shape[2]>=2?'tall':'broad',key=kind+':'+r.shape[2];
  const a=bands.get(key)??[];a.push(r);bands.set(key,a);
 }
 const group=new THREE.Group();group.visible=false;group.name='Detached mapped hedgerow authored volumetric canopy';
 let triangles=0,bytes=0;
 const batches: {family:string; variant:number; rows:readonly HedgeSeat[]; mesh:THREE.Mesh}[]=[];
 for(const [key,v] of bands){
   const [family,k]=key.split(':') as ['shrub'|'broad'|'tall',string],variant=+k;
   const a=hedgePrototype(family,variant),g=new THREE.InstancedBufferGeometry();
   const n=v.length,X=new Float32Array(4*n),S=new Float32Array(4*n);
   for(let i=0;i<n;i++){
    const r=v[i],[h,w,f,l]=r.shape;
    X.set([...r.coords,w],4*i);S.set([h,l,r.bandAxisYaw,f],4*i);
   }
   g.setAttribute('position',new THREE.BufferAttribute(Float32Array.from(a.positions),3));
   g.setAttribute('normal',new THREE.BufferAttribute(Float32Array.from(a.normals),3));
   g.setAttribute('hedgePigment',new THREE.BufferAttribute(Float32Array.from(a.colors),3));
   g.setAttribute('hedgeWood',new THREE.BufferAttribute(Uint8Array.from(a.barkMask),1,true));
   g.setAttribute('hedgeSeat',new THREE.InstancedBufferAttribute(X,4));
   g.setAttribute('hedgeArt',new THREE.InstancedBufferAttribute(S,4));
   g.setIndex(new THREE.BufferAttribute(Uint16Array.from(a.indices),1));
   g.instanceCount=n;const m=new THREE.Mesh(g,material);m.frustumCulled=false;
   triangles+=a.triangles*n;
   bytes+=a.positions.byteLength+a.normals.byteLength+a.colors.byteLength+a.barkMask.byteLength+a.indices.byteLength+X.byteLength+S.byteLength;
   group.add(m);batches.push({family,variant,rows:v,mesh:m});
 }
 let live=true;
 const dispose=()=>{if(!live)return;live=false;for(const v of batches)v.mesh.geometry.dispose();material.dispose();group.removeFromParent();};
 if(triangles>MAX_TRIS){dispose();return;}
 return {group,material,batches,triangles,bytes,dispose};
}
