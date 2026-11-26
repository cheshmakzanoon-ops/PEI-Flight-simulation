import { MeshStandardMaterial, type Material } from 'three';
import { doironEntryOpeningCue, makeDoironEntryStudy } from './doiron-entry-study.ts';

/** Detached optical refinement. It assumes the exact historical comparison
 * panel and its own shallow hood, never a stock/tile/scene transform. */
type Role='lap'|'shingle'|'trim'|'sill'|'door'|'glass'|'canopy'|'soffit'|'back';
export type DoironEntryOpticStage='off'|'glass'|'eave'|'edge'|'full';
type Optics={stage?:DoironEntryOpticStage;hood?:boolean};
const front=new Set<Role>(['lap','shingle','trim','sill','door','glass']);
const edgeRoles=new Set<Role>(['shingle','trim','sill','door','glass']);
const all=(s:string,words:string[])=>words.every(k=>s.indexOf(k)>=0&&s.indexOf(k)===s.lastIndexOf(k));
const clips=doironEntryOpeningCue().map(q=>{
 const v=(n:number)=>n.toFixed(4);
 return `vec4(${v((q.x0+q.x1)*.5)},${v((q.y0+q.y1)*.5)},${v((q.x1-q.x0)*.5)},${v((q.y1-q.y0)*.5)})`;
});
const eave=/* glsl */`
float doironEntryEave(vec3 localP){
 // Fixed geometry coverage cue, not a sunlight ray, shadow pass or scale claim.
 float left=smoothstep(-3.800,-3.340,localP.x);
 float right=1.-smoothstep(3.450,3.990,localP.x);
 float drop=2.459-localP.y;
 // Bias the dark band immediately under the modeled soffit; gently disperse
 // downward to just above the sill, and to zero before leaving this hood.
 float underneath=smoothstep(-.038,.048,drop);
 float falloff=1.-smoothstep(.015,1.208,drop);
 float wall=1.-smoothstep(.085,.184,abs(localP.z));
 return .38*left*right*underneath*falloff*wall;
}
`;
const edge=/* glsl */`
float doironEntryRectEdge(vec2 p,vec4 rect){
 vec2 q=abs(p-rect.xy)-rect.zw;
 float s=length(max(q,vec2(0.)))+min(max(q.x,q.y),0.);
 float px=clamp(fwidth(s),.012,.10);
 return 1.-smoothstep(max(0.,.014-.25*px),.088+.42*px,abs(s));
}
float doironEntryEdge(vec3 p){
 float cut=max(doironEntryRectEdge(p.xy,${clips[0]}),
           max(doironEntryRectEdge(p.xy,${clips[1]}),doironEntryRectEdge(p.xy,${clips[2]})));
 return .093*cut*mix(.44,1.,1.-smoothstep(-.110,-.008,p.z));
}
`;
const glass=/* glsl */`
vec3 doironEntryGlaze(vec3 lit,vec3 surfaceN,vec3 viewRay){
 vec3 n=normalize(surfaceN), e=normalize(viewRay);
 vec3 worldRay=inverseTransformDirection(reflect(-e,n),viewMatrix);
 float up=smoothstep(-.26,.46,worldRay.y);
 float band=1.-smoothstep(.02,.33,abs(worldRay.y-.03));
 vec3 low=vec3(.029,.037,.043), high=vec3(.094,.133,.168);
 vec3 ambient=mix(low,high,up);
 ambient=mix(ambient,vec3(.141,.168,.181),.59*band);
 float grazes=pow(1.-clamp(dot(n,e),0.,1.),4.);
 // A bounded display approximation for old opaque glazing; not an extra
 // scene environment, real cloud reflection or view through to an interior.
 float coat=.46+.33*grazes;
 return mix(lit*.78,ambient,coat);
}
`;
export function patchDoironEntryOptics(vertex:string,fragment:string,role:Role,options:Optics={}){
 const stage=options.stage??'full';
 const g=role==='glass'&&(stage==='glass'||stage==='full');
 const e=options.hood!==false&&front.has(role)&&(stage==='eave'||stage==='full');
 const d=edgeRoles.has(role)&&(stage==='edge'||stage==='full');
 const p=e||d;
 const common='#include <common>', begin='#include <begin_vertex>', opaque='#include <opaque_fragment>';
 if((!p&&!g)||!all(vertex,[common,begin])||!all(fragment,[common,opaque])||
  vertex.includes('vDoironEntryOpticP')||fragment.includes('doironEntryGlaze')||fragment.includes('vDoironEntryOpticP'))return;
 const varying='\nvarying vec3 vDoironEntryOpticP;';
 const additions=(p?varying:'')+'\n'+(e?eave:'')+(d?edge:'')+(g?glass:'');
 if(p)vertex=vertex.replace(common,common+varying).replace(begin,begin+'\nvDoironEntryOpticP=position;');
 const compose=(g?'outgoingLight=doironEntryGlaze(outgoingLight,normal,isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition));\n':'')+
  (e?'outgoingLight*=1.-doironEntryEave(vDoironEntryOpticP);\n':'')+
  (d?'outgoingLight*=1.-doironEntryEdge(vDoironEntryOpticP);\n':'');
 fragment=fragment.replace(common,common+additions).replace(opaque,compose+opaque);
 return {vertex,fragment};
}

export function makeDoironEntryOpticalStudy(options:{hood?:boolean;finish?:boolean;neutralCut?:boolean;ashShingles?:boolean;materialFor?:(r:Role)=>Material|undefined;stage?:DoironEntryOpticStage}={}){
 const {hood,finish,materialFor,neutralCut,ashShingles,stage='full'}=options;
 const external = new Set<Material>();
 const g=makeDoironEntryStudy({hood,finish,neutralCut,ashShingles,materialFor:r=>{
  const m=materialFor?.(r);
  if(m)external.add(m);
  return m;
 }});
 if(stage==='off')return g;
 for(const o of g.children){
  if(!('material' in o)||!(o.material instanceof MeshStandardMaterial))continue;
  const role=o.userData.role as Role;
  // A caller-material coupon stays entirely owned by its author.
  if(external.has(o.material))continue;
  const mightBeAffected=(role==='glass'&&(stage==='glass'||stage==='full'))||
   (hood!==false&&front.has(role)&&(stage==='eave'||stage==='full'))||
   (edgeRoles.has(role)&&(stage==='edge'||stage==='full'));
  if(!mightBeAffected)continue;
  const m=o.material, base=m.onBeforeCompile.bind(m), key=m.customProgramCacheKey();
  m.onBeforeCompile=(q,r)=>{
   base(q,r);
   const effect=patchDoironEntryOptics(q.vertexShader,q.fragmentShader,role,{hood,stage});
   if(effect){q.vertexShader=effect.vertex;q.fragmentShader=effect.fragment;}
  };
  m.customProgramCacheKey=()=>key+`/doiron-entry-optics/${role}/${stage}/${hood!==false}`;
 }
 return g;
}
