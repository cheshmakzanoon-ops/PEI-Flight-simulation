/** Original art, only the evidenced historic outer pier; no World/physics imports. */
import * as T from 'three';
import {OUTER_PIER_STUDY as O} from './georgetown-outer-deck.generated.ts';
type XYZ=[number,number,number];
type UV=[number,number];
type B={p:XYZ; uv:UV};
const name='Georgetown historic Marine Terminal outer-pier study';
const packed=(p:readonly number[])=>(p.map(Math.fround) as XYZ);
const δ=(a:readonly number[],b:readonly number[])=>a.map((v,i)=>v-b[i]) as XYZ;
const normal=(a:XYZ,b:XYZ,c:XYZ)=>new T.Vector3(...δ(b,a)).cross(new T.Vector3(...δ(c,a))).normalize();
const xy=(a:XYZ,b:XYZ)=>new T.Vector3(a[0]-b[0],0,a[2]-b[2]);
const mid=(a:XYZ,b:XYZ):XYZ=>a.map((v,k)=>(v+b[k])*.5) as XYZ;
const f=(a:XYZ,v:UV):B=>({p:a,uv:v});
const stem=(a:B):B=>f([a.p[0],O.courtship.edgeBottomY,a.p[2]],a.uv);
const topRole=0,minusRole=1,plusRole=2,tipRole=3;
const VERT=`
 precision highp float;
 attribute float marinePart;
 varying vec3 marineP,marineN;
 varying vec2 marineUV;
 varying float marineRole;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
  marineP=(modelMatrix*vec4(position,1.)).xyz;
  marineN=mat3(modelMatrix)*normal;
  marineUV=uv;marineRole=marinePart;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  #include <logdepthbuf_vertex>
 }
`;
const FRAG=`
 precision highp float;
 uniform vec3 pierSun;
 varying vec3 marineP,marineN;
 varying vec2 marineUV;
 varying float marineRole;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 float pierHash(vec2 v){
  vec3 t=fract(vec3(v.xyx)*.1031);t+=dot(t,t.yzx+33.33);return fract((t.x+t.y)*t.z);
 }
 float pierField(vec2 v){
  vec2 c=floor(v),d=fract(v); d=d*d*(3.-2.*d);
  return mix(mix(pierHash(c),pierHash(c+vec2(1.,0.)),d.x),mix(pierHash(c+vec2(0.,1.)),pierHash(c+vec2(1.)),d.x),d.y);
 }
 void main(){
  #include <logdepthbuf_fragment>
  vec2 footprint=fwidth(marineUV);
  float rm=max(footprint.x,footprint.y);
  vec2 uv0=marineUV;
  float coarse=pierField(uv0*vec2(.135,.157))-.5;
  float mineral=(pierField(uv0*vec2(.45,.57)+vec2(13.7,35.1))-.5)*(1.-smoothstep(.75,2.25,rm));
  vec3 n=normalize(marineN);
  float lambert=clamp(dot(n,pierSun),0.,1.),e=length(cameraPosition-marineP);
  vec3 c;
  if(marineRole<.5){
   // Weathered neutral cast/mineral reading only: no claimed joint rhythm,
   // bands, equipment, marketing, logos or source-derived pattern.
   c=vec3(.326,.315,.282)*(.83+.25*lambert+.105*coarse+.030*mineral);
  }else{
   // Lower edge sits near the rendered water. Quiet continuous shadowed
   // rise is a graphic finish, not a surveyed facade depth/material.
   float dampEdge=smoothstep(.02,.67,marineP.y);
   vec3 wet=vec3(.063,.079,.076),dry=vec3(.199,.191,.169);
   c=mix(wet,dry,dampEdge)*(.74+.26*lambert+.12*coarse+.025*mineral);
  }
  float haze=clamp(1.-exp(-e*.000021),0.,.83);
  gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),haze),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;
export const GEORGETOWN_OUTER_PIER_STUDY=Object.freeze({
 name,originGameXZ:O.originGameXZ,gameBoundsXZ:O.gameBoundsXZ,
 nominalTipU:O.courtship.outerEndU,openJoinU:O.courtship.openInnerU,classification:'detached historic exterior only',
 sourceDigests:O.source,terrainGrade:false,collider:false,underside:false,appendage:false,userResource:false,
 authorRoofRelation:'/338 active unchanged; lid visually occludes embedded part of existing stock stem',
 guardedBuilding:'/106 untouched and beyond this scope', expectedRoleTriangles:[66,22,22,6] as const,
});
export function createDetachedGeorgetownOuterPier(sun:T.Vector3){
 if(![sun.x,sun.y,sun.z].every(Number.isFinite)||Math.abs(sun.length()-1)>.005)throw Error('Expected normalized existing natural sun');
 const rows=O.pierStations.map(r=>r.columns.map(c=>f(packed(c.local),[r.u,c.v]))),pos:number[]=[],nr:number[]=[],uv:number[]=[],part:number[]=[];
 const put=(a:B,b:B,c:B,out:T.Vector3,tag:number)=>{
  let n=normal(a.p,b.p,c.p);
  if(n.dot(out)<0){[b,c]=[c,b];n=normal(a.p,b.p,c.p);}
  if(!(n.dot(out)>0))throw Error('Invalid one-sided original pier facet');
  for(const p of [a,b,c]){pos.push(...p.p);uv.push(...p.uv);nr.push(...n.toArray());part.push(tag);}
 };
 for(let i=0;i<rows.length-1;i++){
  const a=rows[i],b=rows[i+1],up=new T.Vector3(0,1,0);
  for(let c=0;c<a.length-1;c++){
   put(a[c],b[c],a[c+1],up,topRole);put(a[c+1],b[c],b[c+1],up,topRole);
  }
  for(const [j,role,other] of [[0,minusRole,3],[3,plusRole,0]]){
   const pf=xy(mid(a[j].p,b[j].p),mid(a[other].p,b[other].p));
   put(a[j],stem(a[j]),b[j],pf,role);put(b[j],stem(a[j]),stem(b[j]),pf,role);
  }
 }
 const a=rows[0],b=rows[1],out=xy(mid(a[0].p,a[3].p),mid(b[0].p,b[3].p));
 for(let j=0;j<a.length-1;j++){
  put(a[j],stem(a[j]),a[j+1],out,tipRole);put(a[j+1],stem(a[j]),stem(a[j+1]),out,tipRole);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geo.setAttribute('normal',new T.Float32BufferAttribute(nr,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geo.setAttribute('marinePart',new T.Float32BufferAttribute(part,1));
 const mat=new T.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,uniforms:{pierSun:{value:sun}},side:T.FrontSide,
  depthWrite:true,depthTest:true,depthFunc:T.LessEqualDepth,transparent:false,toneMapped:true});
 mat.name='Georgetown historic matte mineral floor and damp edge study';geo.computeBoundingBox();geo.computeBoundingSphere();
 const m=new T.Mesh(geo,mat);
 m.name=name;m.position.set(O.originGameXZ[0],0,O.originGameXZ[1]);
 m.userData.georgetownHistoricOuterProof=GEORGETOWN_OUTER_PIER_STUDY;
 m.visible=false;m.castShadow=false;m.receiveShadow=false;
 return m;
}
