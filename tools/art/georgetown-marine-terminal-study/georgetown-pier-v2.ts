/** Detached original historic deck + bounded surveyed connection. No world/route imports. */
import * as T from 'three';
import {OUTER_PIER_STUDY as O} from './georgetown-outer-deck.generated.ts';
import {createDetachedGeorgetownOuterPier} from './georgetown-outer-deck.ts';
import {GEORGETOWN_PIER_V2_GENERATED as G} from './georgetown-pier-v2.generated.ts';

type V3=[number,number,number];
type XY=[number,number];
type Tag=0|1|2|3|4|5;
type Vertex={p:V3,uv:XY};
const allName='Georgetown historic Marine Terminal connected-pier V2 study';
const TOP=4, LANE=5;
const seedM=116*3;
const vertexKey=(u:number,v:number)=>u+'/'+v;
const VEC=new T.Vector3(0,1,0);
const side=(a:Vertex,other:Vertex)=>new T.Vector3(a.p[0]-other.p[0],0,a.p[2]-other.p[2]);
const stem=(a:Vertex):Vertex=>({uv:a.uv,p:[a.p[0],Math.fround(O.courtship.edgeBottomY),a.p[2]]});
const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];

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
  vec2 c=floor(v),d=fract(v);d=d*d*(3.-2.*d);
  return mix(mix(pierHash(c),pierHash(c+vec2(1.,0.)),d.x),mix(pierHash(c+vec2(0.,1.)),pierHash(c+vec2(1.)),d.x),d.y);
 }
 float pierAreaWeight(vec2 st){
  vec2 w=fwidth(st);
  return 1.-smoothstep(.27,.95,max(w.x,w.y));
 }
 void main(){
  #include <logdepthbuf_fragment>
  vec2 a=mat2(.057,.006,-.013,.146)*marineUV+vec2(8.17,13.56);
  vec2 b=mat2(.103,-.021,.037,.253)*marineUV+vec2(23.09,50.21);
  float zones=(pierField(a)-.5)*pierAreaWeight(a),aggregate=(pierField(b)-.5)*pierAreaWeight(b);
  vec3 n=normalize(marineN);
  float lit=clamp(dot(n,pierSun),0.,1.),e=length(cameraPosition-marineP);
  vec3 c;
  if(marineRole<.5||marineRole>3.5){
   // Paired broad, weakly directional working-surface variation. Original
   // reflection-free field only; no panel joints, striped lane, or image hue.
   c=vec3(.261,.253,.235)*(.83+.24*lit+.25*zones+.10*aggregate);
  }else{
   // Keep the mapped outer flank slender. Only near-water portion is dark
   // enough to read as wet; do not paint a pale curb or invented fenders.
   float wetness=smoothstep(.035,.88,marineP.y);
   c=mix(vec3(.060,.073,.070),vec3(.161,.156,.141),wetness)*(.78+.22*lit+.12*zones+.025*aggregate);
  }
  float haze=clamp(1.-exp(-e*.000021),0.,.83);
  gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),haze),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;
const ratios=(a:Vertex[],i:number)=>(a[i].uv[1]-a[0].uv[1])/(a[a.length-1].uv[1]-a[0].uv[1]);

export const GEORGETOWN_PIER_V2=Object.freeze({
 name:allName,
 classification:'detached historical visual assistance only',
 outerExactPrefix:seedM, originGameXZ:O.originGameXZ,sourcePlan:G.sourcePlan,
 nominalTipU:O.courtship.outerEndU,exactOuterJoinU:59,openBroadComplementEndU:78,terminalBurialU:172,
 /** 0 original top, 1-/2+ existing and broad approach side, 3 outer end, 4 broad top, 5 clipped negative top */
 roleOpticalABI:'top:0/4/5, fascia:1/2/3',
 noPlantOrShedChange:true,noSeaOrLandChange:true,noCollider:true,noPositiveLane:true,noWorkshopProps:true,
 expectedRoleTriangles:[66,30,30,6,54,472] as const,
});

export function createDetachedGeorgetownPierV2(sun:T.Vector3){
 const m=createDetachedGeorgetownOuterPier(sun);
 const g=m.geometry;
 const attrs=g.attributes;
 const old=(name:string,n:number)=>{
  const q=attrs[name];
  if(!q||q.count!==seedM||q.itemSize!==n||q.normalized||q.array.constructor!==Float32Array)
   throw Error('Unknown original detached pier geometry '+name);
  return q.array as Float32Array;
 };
 if(g.index||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||m.visible||m.parent)
  throw Error('Unproven isolated original pier');
 const pos=[...old('position',3)],normal=[...old('normal',3)],uv=[...old('uv',2)],part=[...old('marinePart',1)];
 const counts=[66,22,22,6,0,0];
 const verts=new Map<string,Vertex>();
 for(const [u,v,x,y,z] of G.vertices){
  if(verts.has(vertexKey(u,v)))throw Error('Duplicated surveyed study node');
  verts.set(vertexKey(u,v),{p:[x,y,z],uv:[u,v]});
 }
 const get=(u:number,v:number)=>{
  const t=verts.get(vertexKey(u,v)); if(!t)throw Error('Unknown original continuation node');
  return t;
 };
 function add(a:Vertex,b:Vertex,c:Vertex,tag:Tag,dir:T.Vector3){
  let n=new T.Vector3(...sub(b.p,a.p)).cross(new T.Vector3(...sub(c.p,a.p))).normalize();
  if(n.dot(dir)<0){[b,c]=[c,b];n.negate();}
  if(!(n.dot(dir)>0))throw Error('Degenerate Georgetown continuation surface');
  for(const t of [a,b,c]){pos.push(...t.p);normal.push(...n.toArray());uv.push(...t.uv);part.push(tag);}
  counts[tag]++;
 }
 const e=O.pierStations.at(-1);
 if(!e||e.u!==59)throw Error('Missing exact old seam');
 const seam=e.columns.map(({local,v})=>({p:local.map(Math.fround) as V3,uv:[59,v] as XY}));
 const full=[seam,...G.crossRows.map(([u,vs])=>vs.map(v=>get(u,v)))];
 for(let q=0;q<full.length-1;q++){
  const A=full[q],B=full[q+1];
  let i=0,j=0;
  while(i<A.length-1||j<B.length-1){
   const r=i<A.length-1?ratios(A,i+1):Infinity,s=j<B.length-1?ratios(B,j+1):Infinity;
   if(r<=s){add(A[i],B[j],A[i+1],TOP,VEC);i++;}
   else{add(A[i],B[j],B[j+1],TOP,VEC);j++;}
  }
  for(const [i,j,tag] of [[0,0,1],[A.length-1,B.length-1,2]] as const){
   const out=side(A[i],A[i?0:A.length-1]);const a=A[i],b=B[j];
   add(a,stem(a),b,tag,out);
   add(b,stem(a),stem(b),tag,out);
  }
 }
 // Actual occupied/protected 1m squares only, never a hull or a strip
 // extended across unsurveyed bay or concealed beneath the separate plant.
 for(const [u,v] of G.allowedLaneCells){
  const a=get(u,v),b=get(u+1,v),c=get(u,v+1),d=get(u+1,v+1);
  add(a,b,c,LANE,VEC);add(c,b,d,LANE,VEC);
 }
 if(counts.join('/')!==GEORGETOWN_PIER_V2.expectedRoleTriangles.join('/'))throw Error('Unexpected continuation triangle budget '+counts);
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setAttribute('marinePart',new T.Float32BufferAttribute(part,1));
 g.computeBoundingBox();g.computeBoundingSphere();m.material.fragmentShader=FRAG;
 m.material.name='Georgetown historic maintained matte hardstand V2, studio only';
 m.name=allName;m.userData.georgetownHistoricContinuationProof=GEORGETOWN_PIER_V2;
 return m;
}
