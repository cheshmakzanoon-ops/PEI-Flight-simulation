import * as THREE from 'three';
import type {Cover} from '../sim/cover.ts';
import {readCoastalPack} from '../sim/coastal-packs.ts';
import {OCEAN_Y} from '../sim/terrain.ts';
import {QUARTERMASTER_DOCKS} from './quartermaster-docks.generated.ts';

type XZ=readonly [number,number];
type Rings=readonly (readonly XZ[])[];
type Deck=readonly [source:string,polygon:Rings,axis:XZ,origin:XZ];
type SourceWay=Readonly<{id:string;role:'spine'|'finger';sourceM:number;qualifiedM:number}>;
export type QuartermasterDocks=Readonly<{
 schema:1;id:'quartermaster-floating-docks-v1';coastSha256:string;
 originXZ:XZ;authoredNominalWidthM:{spine:number;finger:number};lossyGeometryRoundM:number;
 deckFaces:readonly Deck[];hull:readonly Rings[];renderedWays:readonly SourceWay[];
}>;

// Designed to resemble low floating timber decks, never a measurement of
// water level, pile geometry, freeboard, loading or position through the tide.
export const DECK_HEIGHT=OCEAN_Y+.38;
const EDGE_TOP=DECK_HEIGHT-.022,EDGE_BOTTOM=DECK_HEIGHT-.087;
const HULL_BOTTOM=OCEAN_Y-.09;

function signedArea(ring:readonly XZ[]){
 let sum=0;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];sum+=a[0]*b[1]-a[1]*b[0];}
 return .5*sum;
}
function readPack(buffer:ArrayBuffer){
 const p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer)) as QuartermasterDocks;
 const point=(a:XZ)=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite);
 const poly=(a:Rings)=>Array.isArray(a)&&a.length>0&&a.length<12&&a.every(r=>
  Array.isArray(r)&&r.length>=3&&r.length<1000&&r.every(q=>point(q)&&Math.max(Math.abs(q[0]),Math.abs(q[1]))<=500)&&Math.abs(signedArea(r))>1e-5);
 if(p.schema!==1||p.id!=='quartermaster-floating-docks-v1'||p.coastSha256!==QUARTERMASTER_DOCKS.coastSha256||
   !point(p.originXZ)||p.originXZ[0]!==5973||p.originXZ[1]!==29830||p.lossyGeometryRoundM!==.001||
   p.authoredNominalWidthM?.spine!==1.8||p.authoredNominalWidthM?.finger!==.92||
   p.deckFaces.length!==QUARTERMASTER_DOCKS.topPatches||!p.deckFaces.every(d=>/^[0-9]+$/.test(d[0])&&poly(d[1])&&
     point(d[2])&&Math.abs(Math.hypot(...d[2])-1)<1e-4&&point(d[3]))||
   p.hull.length!==QUARTERMASTER_DOCKS.hullComponents||!p.hull.every(poly)||
   p.renderedWays.length!==QUARTERMASTER_DOCKS.acceptedSpines+QUARTERMASTER_DOCKS.acceptedFingers||
   !p.renderedWays.every(w=>/^[0-9]+$/.test(w.id)&&(w.role==='spine'||w.role==='finger')&&
     Number.isFinite(w.qualifiedM)&&w.qualifiedM>0&&w.qualifiedM<=w.sourceM&&w.sourceM<300))
  throw Error('Invalid Quartermaster dock pack.');
 return p;
}

export function loadQuartermasterDocks(base:string,fetcher:typeof fetch=fetch,timeoutMs=1600){
 return readCoastalPack(base+QUARTERMASTER_DOCKS.asset,fetcher,timeoutMs,QUARTERMASTER_DOCKS,readPack);
}

export function quartermasterDockGeometry(p:QuartermasterDocks){
 const position:number[]=[],normal:number[]=[],boardUV:number[]=[],surface:number[]=[];
 type P=readonly [number,number,number];
 const vertex=(q:P,n:P,uv:XZ,k:number)=>{
  position.push(...q);normal.push(...n);boardUV.push(...uv);surface.push(k);
 };
 const up=[0,1,0] as const;
 for(const [,rings,axis,orig] of p.deckFaces){
  const vecs=rings.map(ring=>ring.map(([x,z])=>new THREE.Vector2(x,z)));
  const triangles=THREE.ShapeUtils.triangulateShape(vecs[0],vecs.slice(1));
  const pts=vecs.flat();
  for(const [i,j,k] of triangles){
   const a=pts[i],b=pts[j],c=pts[k],cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
   if(Math.abs(cross)<1e-9)continue;
   for(const q of cross<0?[a,b,c]:[a,c,b]){
    const x=q.x-orig[0],z=q.y-orig[1];
    vertex([q.x,DECK_HEIGHT,q.y],up,[axis[0]*x+axis[1]*z,-axis[1]*x+axis[0]*z],0);
   }
  }
 }
 // Only the union perimeter owns a vertical face. Terminating on an interior
 // articulation would put overlapping/ringing edges at every mapped joint.
 for(const rings of p.hull)for(const [r,ring] of rings.entries()){
  const winding=Math.sign(signedArea(ring))*(r===0?1:-1);
  let u=0;
  for(let i=0;i<ring.length;i++){
   const [x,z]=ring[i],[qx,qz]=ring[(i+1)%ring.length],dx=qx-x,dz=qz-z,d=Math.hypot(dx,dz);
   if(d<1e-6)continue;
   const n:[number,number,number]=[winding*dz/d,0,-winding*dx/d];
   const c:readonly P[]=[[x,HULL_BOTTOM,z],[x,DECK_HEIGHT,z],[qx,DECK_HEIGHT,qz],[qx,HULL_BOTTOM,qz]];
   for(const j of winding>0?[0,1,2,0,2,3]:[0,2,1,0,3,2])
    vertex(c[j],n,[u+(j>=2?d:0),c[j][1]-OCEAN_Y],1);
   u+=d;
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
 g.setAttribute('boardUV',new THREE.Float32BufferAttribute(boardUV,2));
 g.setAttribute('dockSurface',new THREE.Float32BufferAttribute(surface,1));
 g.computeBoundingBox();g.computeBoundingSphere();
 return g;
}

const vertexShader=/*glsl*/`
 attribute vec2 boardUV;
 attribute float dockSurface;
 varying vec3 dockPos,n;
 varying vec2 timberUV;
 varying float layer;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
  timberUV=boardUV;
  layer=dockSurface;
  dockPos=(modelMatrix*vec4(position,1.)).xyz;
  n=mat3(modelMatrix)*normal;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  #include <logdepthbuf_vertex>
 }
`;
const fragmentShader=/*glsl*/`
 uniform vec3 sun;
 varying vec3 dockPos,n;
 varying vec2 timberUV;
 varying float layer;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 float dockHash(vec2 p){
  vec3 q=fract(vec3(p.xyx)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
 }
 float dockNoise(vec2 p){
  vec2 i=floor(p),w=fract(p);w=w*w*(3.-2.*w);
  return mix(mix(dockHash(i),dockHash(i+vec2(1,0)),w.x),
             mix(dockHash(i+vec2(0,1)),dockHash(i+1.),w.x),w.y);
 }
 void main(){
  #include <logdepthbuf_fragment>
  vec3 normal=normalize(n);
  vec3 eye=cameraPosition-dockPos;
  float dist=length(eye);vec3 view=eye/max(dist,.01);
  vec2 q=timberUV;
  float light=max(0.,dot(normal,sun)),spec=max(0.,dot(normal,normalize(view+sun)));
  float px=max(fwidth(q.x),fwidth(q.y));
  float materialGrain=1.-smoothstep(.008,.058,px);
  vec3 col;
  if(layer<.25){
   // The deck width is real-world sized in the scene; narrow board gaps fade
   // to a mean contribution before falling inside a screen pixel.
   float planks=q.x/.142;
   float row=floor(planks);
   float fw=max(fwidth(planks),.001);
   float boards=1.-smoothstep(.05,.86,fw);
   float gap=1.-smoothstep(.016,.016+min(fw,.22),abs(fract(planks)-.5));
   float rng=(dockHash(vec2(row,19.5))-.5)*boards;
   float grain=(dockNoise(q*vec2(85.,3.2)+vec2(rng,0.))-.5)*materialGrain;
   float wear=dockNoise((dockPos.xz-vec2(5973.,29830.))*.54);
   col=mix(vec3(.231,.219,.198),vec3(.351,.331,.291),wear);
   col*=(.84+.23*light)*(1.+.095*rng+.085*grain-.17*gap*boards);
   col+=vec3(.052,.049,.045)*pow(spec,26.);
  }else{
   // Material bands share one vertical quad; filter their footprint before
   // the lip turns into a bright subpixel line in a higher overflight.
   float age=dockNoise(vec2(q.x*.22,4.6));
   float damp=smoothstep(.024,.132,q.y),fw=max(.004,fwidth(q.y));
   float upper=smoothstep(${(EDGE_BOTTOM-OCEAN_Y).toFixed(3)}-fw,${(EDGE_BOTTOM-OCEAN_Y).toFixed(3)}+fw,q.y);
   float lip=smoothstep(${(EDGE_TOP-OCEAN_Y).toFixed(3)}-fw,${(EDGE_TOP-OCEAN_Y).toFixed(3)}+fw,q.y);
   vec3 floats=mix(vec3(.052,.060,.059),vec3(.092,.091,.073),damp*age)*(.74+.33*light);
   vec3 metal=mix(vec3(.134,.148,.154),vec3(.218,.227,.222),age)*(.73+.24*light);
   metal+=vec3(.043,.050,.054)*pow(spec,37.);
   col=mix(mix(floats,metal,upper),vec3(.139,.123,.102)*(.76+.27*light),lip);
  }
  float haze=clamp(1.-exp(-dist*.000021),0.,.91);
  gl_FragColor=vec4(mix(col,vec3(.56,.68,.72),haze),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;

export function addQuartermasterDocks(scene:THREE.Scene,cover:Cover,sun:THREE.Vector3,p:QuartermasterDocks|undefined){
 if(!p||cover.harbour?.plan.sha256!==p.coastSha256)return;
 const mat=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:{sun:{value:sun}}});
 mat.name='Quartermaster weathered floating dock';
 const mesh=new THREE.Mesh(quartermasterDockGeometry(p),mat);
 mesh.position.set(p.originXZ[0],0,p.originXZ[1]);
 mesh.name=p.id;
 mesh.userData.sourceWays=p.renderedWays.map(w=>w.id);
 scene.add(mesh);
 return {id:p.id,spines:QUARTERMASTER_DOCKS.acceptedSpines,fingers:QUARTERMASTER_DOCKS.acceptedFingers,
    triangles:mesh.geometry.attributes.position.count/3};
}
