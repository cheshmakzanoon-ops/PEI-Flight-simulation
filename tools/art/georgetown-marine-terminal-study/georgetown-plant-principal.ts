/** Original 2020 Georgetown shore plant bulk, expressly incomplete. No app/site imports. */
import * as T from 'three';
import {GEORGETOWN_PLANT_PRINCIPAL as G} from './georgetown-plant-principal.generated.ts';

type V3=[number,number,number];
type UV=[number,number];
type Tag=0|1|2|3; // lower roof, upper roof, proven rise, retained original perimeter.
type V={p:V3;uv:UV};
type Spec=0|1|2;
const over=new T.Vector3(0,1,0);
const pierActor='Georgetown historical shore plant principal volumes study';
const fmt=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const coord=(v:number,y:number):V=>{
 const [u,c,x,z]=G.vertices[v];
 return {p:[x,y,z],uv:[u,c]};
};
function Y(vertex:number,level:number,which:number){
 if(level<0||level>2||which<0||which>1||level!==0&&which!==0)throw Error('Unknown historical plane marker');
 return G.heights[vertex][level===0?which:level+1];
}
const vert=`
 precision highp float;
 attribute float plantPart;
 varying vec3 historicalN,historicalP;
 varying vec2 historicalUV;
 varying float historicalPart;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
  historicalP=(modelMatrix*vec4(position,1.)).xyz;
  historicalN=mat3(modelMatrix)*normal;
  historicalUV=uv;historicalPart=plantPart;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  #include <logdepthbuf_vertex>
 }
`;
const frag=`
 precision highp float;
 uniform vec3 plantSun;
 varying vec3 historicalN,historicalP;
 varying vec2 historicalUV;
 varying float historicalPart;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 float georgetownWeatherSeed(vec2 v){
  vec3 n=fract(vec3(v.xyx)*.1031);
  n+=dot(n,n.yzx+33.33);return fract((n.x+n.y)*n.z);
 }
 float georgetownWeather(vec2 v){
  vec2 c=floor(v),d=fract(v);d=d*d*(3.-2.*d);
  return mix(mix(georgetownWeatherSeed(c),georgetownWeatherSeed(c+vec2(1.,0.)),d.x),
             mix(georgetownWeatherSeed(c+vec2(0.,1.)),georgetownWeatherSeed(c+vec2(1.)),d.x),d.y);
 }
 void main(){
  #include <logdepthbuf_fragment>
  vec3 n=normalize(historicalN);
  float d=distance(historicalP,cameraPosition);
  vec2 working=vec2(historicalUV.x*.074,historicalUV.y*.087+historicalP.y*.084);
  vec2 aa=fwidth(working);
  float shade=(georgetownWeather(working)-.5)*(1.-smoothstep(.4,.9,max(aa.x,aa.y)));
  float sun=clamp(dot(n,plantSun),0.,1.);
  vec3 c;
  if(historicalPart<1.5){
   // Two broad, quiet cool-pale roof families; no inferred seams, skylights
   // or counted hardware on a historically evidenced plane.
   vec3 base=historicalPart<.5?vec3(.438,.433,.394):vec3(.384,.402,.392);
   c=base*(.81+.24*sun+.102*shade);
  }else{
   // Subdued continuous industrial exterior study. No guessed windows,
   // logos, egress doors or exact panels. Shading knows the real tonal planes.
   c=vec3(.583,.554,.508)*(.81+.19*sun+.082*shade);
   c*=.947+.053*smoothstep(1.9,4.5,historicalP.y);
   if(historicalPart<2.5)c*=.97;
  }
  float haze=clamp(1.-exp(-d*.000021),0.,.83);
  gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),haze),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

export const GEORGETOWN_PRINCIPAL_PLANT_STUDY=Object.freeze({
 name:pierActor,scope:'Exploratory incomplete original bulk only; omitted unknown edges intentionally open',
 stockRow:'q11220/106',expectedOriginalRange:[7362,7644] as const,
 visibleInitially:false,sceneManaged:false,sourceAudit:G.parentAuditSHA256,
 modelAreaM2:G.areaM2,sourceFootprintAreaM2:G.retainedExactSiteAreaM2,unfilledM2:G.unsolvedFootprintM2,
 openEdges:G.omittedOpenEdges,castsAndCollides:false,
 authoritativeRoofTierNotModelCurrent:'Historic principal planes only; not survey or supported complete envelope.',
});

export function createDetachedGeorgetownPrincipalPlant(sun:T.Vector3){
 if(![sun.x,sun.y,sun.z].every(Number.isFinite)||Math.abs(sun.length()-1)>.005)
  throw Error('Detached study expects existing normalized daylight');
 const pos:number[]=[],normal:number[]=[],uv:number[]=[],role:number[]=[];
 const counts=[0,0,0,0],g=new T.BufferGeometry();
 const put=(a:V,b:V,c:V,tag:Tag,dir:T.Vector3)=>{
  let v=new T.Vector3(...fmt(b.p,a.p)).cross(new T.Vector3(...fmt(c.p,a.p)));
  if(v.dot(dir)<0){[b,c]=[c,b];v.negate();}
  if(!Number.isFinite(v.lengthSq())||v.lengthSq()<1e-13||!(v.dot(dir)>0))
   throw Error('Degenerate root-approved partial envelope '+tag);
  v.normalize();
  for(const k of [a,b,c]){pos.push(...k.p);normal.push(...v.toArray());uv.push(...k.uv);role.push(tag);}
  counts[tag]++;
 };
 const incidence=Array.from({length:G.vertices.length},()=>new Set<number>());
 // Preserve exact plane-sharing endpoints in top triangulation. Earcut can
 // simplify collinear points; insert them back on the corresponding original
 // boundary subsegment, which avoids a cutline joint becoming a T.
 for(const [tag,part,ids0] of G.faces){
  const ids=Array.from(ids0) as number[];
  const poly=ids.map(i=>{
   const [u,v]=G.vertices[i];incidence[i].add(Y(i,tag,part));return new T.Vector2(u,v);
  });
  const tri=T.ShapeUtils.triangulateShape(poly,[]);
  if(!tri.length)throw Error('Lost one measured plane patch');
  const use=tag===0?0:1;
  const v=(i:number)=>coord(ids[i],Y(ids[i],tag,part));
  const chosen=new Set(tri.flat());
  const unique=Array.from(new Set(ids.map((_,q)=>q))).filter(q=>!chosen.has(q));
  const rewound=new Set<number>();
  for(const t of tri){
   const ordered:number[]=[];
   for(let j=0;j<3;j++){
    const a=t[j],b=t[(j+1)%3],from=poly[a],to=poly[b].clone().sub(from),s=to.lengthSq();
    const interior=unique.flatMap(k=>{
     const x=poly[k].clone().sub(from),r=x.dot(to)/s;
     const gap=x.addScaledVector(to,-r).length();
     return r>1e-8&&r<1-1e-8&&gap<1e-7?[[k,r] as const]:[];
    }).sort((x,y)=>x[1]-y[1]);
    ordered.push(a,...interior.map(e=>e[0]));
    for(const [k] of interior)rewound.add(k);
   }
   if(ordered.length===3)put(v(t[0]),v(t[1]),v(t[2]),use,over);
   else{
    const original=t.map(v),p=original[0].p.map((_,i)=>Math.fround((original[0].p[i]+original[1].p[i]+original[2].p[i])/3)) as V3;
    const q=original[0].uv.map((_,i)=>(original[0].uv[i]+original[1].uv[i]+original[2].uv[i])/3) as UV;
    const c={p,uv:q};
    for(let i=0;i<ordered.length;i++)put(c,v(ordered[i]),v(ordered[(i+1)%ordered.length]),use,over);
   }
  }
  if(rewound.size!==unique.length)throw Error('Incomplete source roof boundary retessellation');
 }
 function mountStrip(p:number,q:number,lo0:number,hi0:number,lo1:number,hi1:number,tag:Tag,n:T.Vector3){
  const rows=[[p,lo0,hi0],[q,lo1,hi1]].map(([i,lo,hi])=>{
   const y=[lo,...Array.from(incidence[i]).filter(a=>lo<a&&a<hi).sort((a,b)=>a-b),hi];
   if(!(hi>lo+.000001))throw Error('Original closure inverted');
   return y.map(h=>coord(i,h));
  });
  const [a,b]=rows;
  const frac=(p:V[],i:number)=>(p[i].p[1]-p[0].p[1])/(p.at(-1)!.p[1]-p[0].p[1]);
  let i=0,j=0;
  while(i<a.length-1||j<b.length-1){
   const r=i<a.length-1?frac(a,i+1):Infinity,s=j<b.length-1?frac(b,j+1):Infinity;
   if(r<=s){put(a[i],b[j],a[i+1],tag,n);i++;}
   else{put(a[i],b[j],b[j+1],tag,n);j++;}
  }
 }
 for(const [p,q,t,tSide,,dir] of G.oldExternalWallSegments){
  const pa=G.vertices[p][4],pb=G.vertices[q][4];
  if(pa===null||pb===null)throw Error('Attempted wall with unsurveyed original XY foot');
  mountStrip(p,q,pa,Y(p,t,tSide),pb,Y(q,t,tSide),3,new T.Vector3(...dir));
 }
 for(const [p,q,lo,slo,hi,shi,dir] of G.qualifiedStepSegments)
  mountStrip(p,q,Y(p,lo,slo),Y(p,hi,shi),Y(q,lo,slo),Y(q,hi,shi),2,new T.Vector3(...dir));
 if(counts.some(n=>!n)||pos.length/9>400)throw Error('Partial study exceeds original fixed geometry work scope');
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setAttribute('plantPart',new T.Float32BufferAttribute(role,1));
 g.computeBoundingSphere();g.computeBoundingBox();
 const mat=new T.ShaderMaterial({vertexShader:vert,fragmentShader:frag,
  uniforms:{plantSun:{value:sun}},side:T.FrontSide,depthWrite:true,depthTest:true,transparent:false,toneMapped:true});
 mat.name='Original Georgetown pale industrial principal bulk, source-limited';
 const m=new T.Mesh(g,mat);m.name=pierActor;m.position.set(...G.originGameXYZ);
 m.visible=false;m.castShadow=false;m.receiveShadow=false;
 m.userData.georgetownDetachedOwner=GEORGETOWN_PRINCIPAL_PLANT_STUDY;
 m.userData.roleTriangles=Object.freeze(counts);
 return m;
}
