/** Original illustrative Charlottetown FSS exterior. Unitless, detached, no scene/world dependencies beyond Three. */
import * as T from 'three';

export const FSS_ART_SOURCE = Object.freeze({
  role:'Detached flight-service-station exterior, visually referenced; not production or survey',
  location:'Charlottetown, Prince Edward Island',
  historicName:'Operations Building / Control Tower',
  sourceStock:'q120023/47 (reference only; not removed/edited)',
  authority:'Independent Airport Authority and NAV CANADA exterior observations; 2022 is a dated reference, not an exact present-day copy',
  units:'Normalized artist proportions, including eight approximate cab facets, not metres, a calibrated count or placement',
  nearDrawBudget:2,nearTriBudget:650,midTriBudget:440
});
const CAB_ASPECT=.16/.175;
export const FSS_ART_PROFILE = Object.freeze({
  body:Object.freeze([.236,.198] as const), baseHalf:Object.freeze([.343,.263] as const), podiumTop:.294,shaftTop:.830,
  neckLow:.830,neckTop:.854,cabRise:.952,capBeltTop:.986,roofTip:1,shoulderBevel:.0065,baseBevel:.009,
  cabSillR:Object.freeze([.115,.115*CAB_ASPECT] as const), cabGlassR:Object.freeze([.168,.168*CAB_ASPECT] as const), capR:Object.freeze([.175,.175*CAB_ASPECT] as const), facets:8
});
export type FssLod='near'|'mid';
type Point=[number,number,number];
type Face=(u:number,y:number,d?:number)=>Point;
type Role=
 'plinth'|'lowOxide'|'lowPale'|'podiumShelf'|'shaftShoulder'|'shaftOxide'|'shaftReveal'|
 'smallSash'|'neck'|'cabGlass'|'cabMullion'|'fascia'|'roof';
type Kit='body'|'glass';
type Pairs=[Point,Point,Point,Point];
type Pane={u:number,y:number,w:number,h:number};

const palette={
  plinth:0x555450,lower:0x886455,lowerSoft:0x956b57,
  podiumLight:0xc4c2b5,podiumEnd:0xbdb9ad,podiumShelf:0xaaa699,
  stone:0xd0cfc5,stoneSide:0xc9c7bb,stoneTop:0xbcbab0,
  oxide:0x925640,oxideDay:0x985740,oxideSide:0x88513e,oxideBack:0x905340,
  reveal:0x6d574b,smallSash:0x3b3f40,
  neck:0xbbb8aa,neckInset:0xaaa99b,cabBase:0x4c5452,cabPost:0x535755,
  glassA:0x465252,glassB:0x485555,glassC:0x424f51,glassD:0x425052,
  fascia:0x999890,fasciaTop:0xa9a69a,capRim:0x75796f,capSurface:0x848a82
};
const C=(x:number)=>new T.Color(x);
const P=FSS_ART_PROFILE;
const cat=(p:Point,q:Point,n:number):Point=>[
  p[0]+(q[0]-p[0])*n,p[1]+(q[1]-p[1])*n,p[2]+(q[2]-p[2])*n];
const colourEntries=new Map<number,T.Color>();
const col=(x:number)=>{let c=colourEntries.get(x);if(!c){c=C(x);colourEntries.set(x,c);}return c;};
type Piece={p:Point[],c:T.Color[],role:Role,kind:Kit};
const finishCode:Readonly<Record<Role,number>>=Object.freeze({
 'plinth':1,'lowOxide':2,'lowPale':1,'podiumShelf':1,'shaftShoulder':1,'shaftOxide':2,
 'shaftReveal':0,'smallSash':4,'neck':1,'cabGlass':5,'cabMullion':3,'fascia':3,'roof':3
});
/** Contiguous ownership ranges are an offline studio aid; no global material patches. */
class Shell {
  private readonly pieces:Piece[]=[];
  tri(p:Point,q:Point,r:Point,color:number|readonly [number,number,number],role:Role,kind:Kit='body'){
    const local=[p,q,r];
    if(local.some(v=>!v.every(Number.isFinite)))throw new Error('Non-finite art');
    const x=new T.Vector3().fromArray(q).sub(new T.Vector3().fromArray(p));
    const y=new T.Vector3().fromArray(r).sub(new T.Vector3().fromArray(p));
    if(x.cross(y).lengthSq()<1e-18)throw new Error('Degenerate art triangle');
    const c=typeof color==='number'?[col(color),col(color),col(color)]:color.map(col);
    this.pieces.push({p:local,c,role,kind});
  }
  quad(t:Pairs,c:number,role:Role,kind:Kit='body'){
    this.tri(t[0],t[1],t[2],c,role,kind);this.tri(t[0],t[2],t[3],c,role,kind);
  }
  geometry(kind:Kit){
    const vs:number[]=[],cs:number[]=[],finish:number[]=[],roles:Record<string,[number,number][]>=Object.create(null);
    let n=0;
    for(const part of this.pieces)if(part.kind===kind){
      for(let i=0;i<3;i++){vs.push(...part.p[i]);cs.push(part.c[i].r,part.c[i].g,part.c[i].b);finish.push(finishCode[part.role]);}
      const list=roles[part.role]??(roles[part.role]=[]);
      if(list.length&&list.at(-1)![1]===n)list.at(-1)![1]+=3;else list.push([n,n+3]);
      n+=3;
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(vs,3));
    g.setAttribute('color',new T.Float32BufferAttribute(cs,3));
    g.setAttribute('fssFinish',new T.Float32BufferAttribute(finish,1));
    g.computeVertexNormals();g.computeBoundingSphere();
    g.userData={artRoles:roles};
    return g;
  }
}
function rectChamfer(x:number,z:number,y:number,c:number):Point[]{
  return [[-x+c,y,-z],[-x,y,-z+c],[-x,y,z-c],[-x+c,y,z],
          [x-c,y,z],[x,y,z-c],[x,y,-z+c],[x-c,y,-z]];
}
const shaftLoop=(y:number)=>rectChamfer(P.body[0],P.body[1],y,P.shoulderBevel);
// Clocking to local artist axes intentionally approximate; no geometry is inferred from images.
function octo(x:number,y:number):Point[]{
  const z=x*CAB_ASPECT;
  return Array.from({length:P.facets},(_,i)=>{
    const a=Math.PI-Math.PI/8-i*Math.PI/4;return [x*Math.cos(a),y,z*Math.sin(a)];
  });
}
function loft(s:Shell,a:Point[],b:Point[],c:number|number[],role:Role,kind:Kit='body'){
  if(a.length!==b.length)throw new Error('Mismatched rings');
  for(let i=0;i<a.length;i++){const j=(i+1)%a.length;
    s.quad([a[i],a[j],b[j],b[i]],typeof c==='number'?c:c[i%c.length],role,kind);}
}
const projected=(v:Point)=>new T.Vector2(v[0],v[2]);
/** A true level polygon shelf/floor; nothing decorative intersects its plane. */
function horizontal(s:Shell,o:Point[],inner:Point[]|undefined,up:boolean,colour:number,role:Role){
  const f=T.ShapeUtils.triangulateShape(o.map(projected),inner?[inner.map(projected)]:[]);
  const k=inner?[...o,...inner]:o;
  for(const [i,j,l] of f){
    const [p,q,r]=[k[i],k[j],k[l]];
    const normalY=(q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]);
    const correct=(normalY>0)===up; s.tri(p,correct?q:r,correct?r:q,colour,role);
  }
}
const outward=(face:number,u:number,y:number,d=0):Point=>{
 const [x,z]=P.body;
 switch(face){
 case 0:return [u,y,z+d];
 case 1:return [x+d,y,-u];
 case 2:return [-u,y,-z-d];
 default:return [-x-d,y,u];
 }
};
function faceQuad(s:Shell,F:Face,u0:number,u1:number,y0:number,y1:number,d:number,c:number,role:Role,kind:Kit='body'){
  s.quad([F(u0,y0,d),F(u1,y0,d),F(u1,y1,d),F(u0,y1,d)],c,role,kind);
}
/** Frame a physical opening/inset, each quad faces the cavity and isn't a painted pane. */
function recess(s:Shell,F:Face,u0:number,u1:number,y0:number,y1:number,d0:number,d1:number,c:number,role:Role){
 const A=F(u0,y0,d0),B=F(u1,y0,d0),C=F(u1,y1,d0),D=F(u0,y1,d0),
       a=F(u0,y0,d1),b=F(u1,y0,d1),k=F(u1,y1,d1),d=F(u0,y1,d1);
 s.quad([A,B,b,a],c,role);s.quad([B,C,k,b],c,role);
 s.quad([C,D,d,k],c,role);s.quad([D,A,a,d],c,role);
}
const wc=(u:number,y:number,w=.019,h=.028):Pane=>({u,y,w,h});
const panesNear=[
 [wc(-.126,.462),wc(-.124,.572),wc(.128,.404),wc(.128,.515),wc(.126,.644),wc(.127,.744)],
 [wc(-.096,.540,.015),wc(-.095,.655,.015),wc(.099,.425,.012)],
 [wc(-.12,.717,.016),wc(.12,.714,.016)],
 []
];
const panesMid=[
 [panesNear[0][0],panesNear[0][3],panesNear[0][5]],
 [panesNear[1][1]],
 [...panesNear[2]],
 []
];
const shaftY=[P.podiumTop,P.podiumTop+.013,P.shaftTop-.020,P.shaftTop] as const;
function panelWithOpenings(s:Shell,F:Face,w:number,L:number,H:number,depth:number,c:number,
  openings:readonly (readonly [number,number,number,number])[]){
 const ring=(a:number,b:number,c:number,d:number)=>[
   new T.Vector2(a,c),new T.Vector2(b,c),new T.Vector2(b,d),new T.Vector2(a,d)
 ];
 const outer=ring(-w,w,L,H),holes=openings.map(r=>ring(...r));
 const list=T.ShapeUtils.triangulateShape(outer,holes),vs=[...outer,...holes.flat()];
 for(const [i,j,k]of list){
  const [p,q,r]=[vs[i],vs[j],vs[k]],turn=(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const map=(v:T.Vector2)=>F(v.x,v.y,depth);
  if(turn===0)throw new Error('nonconforming panel triangulation');
  s.tri(map(p),map(turn>0?q:r),map(turn>0?r:q),c,'shaftOxide');
 }
}
function oxideFace(s:Shell,f:number,near:boolean){
 const F:Face=(u,y,d=0)=>outward(f,u,y,d);
 const half=f%2?P.body[1]:P.body[0], U=half-P.shoulderBevel,w=half*.72,
    [lo,L,H,hi]=shaftY,D=-.011,left=F(-U,lo),right=F(U,hi);
 const pale=f%2?palette.stoneSide:palette.stone,
   base=[palette.oxideDay,palette.oxideSide,palette.oxideBack,palette.oxide][f];
 // The head bands share the same exact lower/upper boundaries as the
 // separate pier-and-recess topology, with no strip T-junctions.
 const head=[-U,-w,w,U].map(t=>F(t,H)),foot=[-U,-w,w,U].map(t=>F(t,L));
 for(let i=0;i<3;i++)s.tri(head[i],head[i+1],F(-U,hi),pale,'shaftShoulder');
 s.tri(head[3],right,F(-U,hi),pale,'shaftShoulder');
 s.tri(left,F(U,lo),foot[3],pale,'shaftShoulder');
 for(let i=3;i>0;i--)s.tri(left,foot[i],foot[i-1],pale,'shaftShoulder');
 faceQuad(s,F,-U,-w,L,H,0,pale,'shaftShoulder');
 faceQuad(s,F,w,U,L,H,0,pale,'shaftShoulder');
 recess(s,F,-w,w,L,H,0,D,palette.reveal,'shaftReveal');
 const windows=(near?panesNear:panesMid)[f].map(z=>[z.u-z.w*.5,z.u+z.w*.5,z.y-z.h*.5,z.y+z.h*.5] as const);
 panelWithOpenings(s,F,w,L,H,D,base,windows);
 for(const [u0,u1,y0,y1] of windows){
   if(near)recess(s,F,u0,u1,y0,y1,D,D-.009,palette.reveal,'shaftReveal');
   faceQuad(s,F,u0,u1,y0,y1,near?D-.009:D,palette.smallSash,'smallSash','glass');
 }
}
/** One small source-visible foreground break, explicitly local and illustrative.
 * Quiet reciprocal surfaces stay mostly pale and uninterrupted. */
function lowLoop(x:number,z:number,y:number,inset:number):Point[]{
 const c=P.baseBevel, u=.101;
 return [[-x+c,y,-z],[-x,y,-z+c],[-x,y,z-c],[-x+c,y,z],
   [u-c,y,z],[u,y,z-c],[u,y,z-inset],[x-c,y,z-inset],
   [x,y,z-inset-c],[x,y,-z+c],[x-c,y,-z]];
}
function createPodium(s:Shell){
 const lo=lowLoop(.315,.247,0,.019),
   band=lowLoop(.315,.247,.112,.019),
   ledge=lowLoop(P.baseHalf[0],P.baseHalf[1],.116,.027),
   shoulder=lowLoop(P.baseHalf[0],P.baseHalf[1],P.podiumTop-.007,.027),
   top=lowLoop(P.baseHalf[0]-.006,P.baseHalf[1]-.006,P.podiumTop,.027);
 horizontal(s,lo,undefined,false,palette.plinth,'plinth');
 for(let i=0;i<lo.length;i++){
  const j=(i+1)%lo.length, observed=(i===2||i===3||i===4);
  s.quad([lo[i],lo[j],band[j],band[i]],
      observed?(i===3?palette.lowerSoft:palette.lower):palette.podiumEnd,
      observed?'lowOxide':'lowPale');
 }
 loft(s,band,ledge,palette.podiumEnd,'lowPale');
 loft(s,ledge,shoulder,[palette.podiumEnd,palette.podiumLight],'lowPale');
 loft(s,shoulder,top,palette.podiumShelf,'podiumShelf');
 horizontal(s,top,shaftLoop(P.podiumTop),true,palette.podiumShelf,'podiumShelf');
}
function cornerReturns(s:Shell){
 const levels=shaftY.map(shaftLoop);
 for(let h=0;h<levels.length-1;h++){
  const [a,b]=[levels[h],levels[h+1]];
  for(const i of [0,2,4,6]){
    const j=i+1;s.quad([a[i],a[j],b[j],b[i]],palette.stoneSide,'shaftShoulder');
  }
 }
}
// Match the exact near pane and frame boundaries to the neighboring crown.
function frameEdge(a:Point,b:Point){
 return [a,cat(a,b,.044),cat(a,b,.956),b];
}
function loftAtGlass(s:Shell,a:Point[],b:Point[],splitLow:boolean,c:number,role:Role){
 for(let i=0;i<a.length;i++){
  const j=(i+1)%a.length;
  if(splitLow){
   const low=frameEdge(a[i],a[j]);
   for(let k=0;k<3;k++)s.tri(low[k],low[k+1],b[i],c,role);
   s.tri(low[3],b[j],b[i],c,role);
  }else{
   const high=frameEdge(b[i],b[j]);
   s.tri(a[i],a[j],high[3],c,role);
   for(let k=3;k>0;k--)s.tri(a[i],high[k],high[k-1],c,role);
  }
 }
}
function createCab(s:Shell,near:boolean){
 const square=shaftLoop(P.shaftTop), neck0=octo(.137,P.neckLow),neck1=octo(.135,.845),
       neck2=octo(.119,P.neckTop),bottom=octo(P.cabSillR[0],.860),
       mid=octo(P.cabGlassR[0],P.cabRise),fascia=octo(P.capR[0],.957),
       high=octo(P.capR[0],P.capBeltTop),topEdge=octo(.168,.996),roof=octo(.159,P.roofTip);
 horizontal(s,square,neck0,true,palette.stoneTop,'podiumShelf');
 loft(s,neck0,neck1,palette.neck,'neck');loft(s,neck1,neck2,palette.neckInset,'neck');
 if(near)loftAtGlass(s,neck2,bottom,false,palette.cabBase,'neck');else loft(s,neck2,bottom,palette.cabBase,'neck');
 const facetColour=[palette.glassA,palette.glassB,palette.glassC,palette.glassD,palette.glassA,palette.glassD,palette.glassC,palette.glassB];
 for(let i=0;i<P.facets;i++){
   const j=(i+1)%P.facets;
   if(!near){s.quad([bottom[i],bottom[j],mid[j],mid[i]],facetColour[i],'cabGlass','glass');continue;}
   // Dark framing follows the plane without painting sky, hardware or an interior.
   const [,q,r]=frameEdge(bottom[i],bottom[j]),[,a,b]=frameEdge(mid[i],mid[j]);
   s.quad([bottom[i],q,a,mid[i]],palette.cabPost,'cabMullion');
   s.quad([r,bottom[j],mid[j],b],palette.cabPost,'cabMullion');
   s.quad([q,r,b,a],facetColour[i],'cabGlass','glass');
 }
 if(near)loftAtGlass(s,mid,fascia,true,palette.capRim,'fascia');else loft(s,mid,fascia,palette.capRim,'fascia');
 loft(s,fascia,high,[palette.fascia,palette.fasciaTop,palette.fascia,palette.fascia],'fascia');
 loft(s,high,topEdge,palette.fasciaTop,'fascia');
 loft(s,topEdge,roof,palette.capSurface,'roof');
 horizontal(s,roof,undefined,true,palette.capSurface,'roof');
}
/** Only the two uniquely owned detached materials pass through these hooks.
 * Both GLSL programs retain Three's view, lighting, opacity, and output path. */
const privateVertex=/* glsl */`
 attribute float fssFinish;
 varying vec3 fssObject;
 varying float fssRole;
`;
const privateFragment=/* glsl */`
 varying vec3 fssObject;
 varying float fssRole;
`;
function anchored(s:string,where:string,add:string){
 const bits=s.split(where);
 if(bits.length!==2)throw new Error('Unsupported detached stock Three shader anchor: '+where);
 return bits[0]+where+'\n'+add+'\n'+bits[1];
}
const authoredNoise=/* glsl */`
 float fssHash(vec3 p){
   p=fract(p*.1031);p+=dot(p,p.yzx+33.33);
   return fract((p.x+p.y)*p.z);
 }
 float fssNoise(vec3 p){
   vec3 f=floor(p),u=fract(p);u=u*u*(3.-2.*u);
   float a=mix(fssHash(f),fssHash(f+vec3(1,0,0)),u.x);
   float b=mix(fssHash(f+vec3(0,1,0)),fssHash(f+vec3(1,1,0)),u.x);
   float c=mix(fssHash(f+vec3(0,0,1)),fssHash(f+vec3(1,0,1)),u.x);
   float d=mix(fssHash(f+vec3(0,1,1)),fssHash(f+vec3(1,1,1)),u.x);
   return mix(mix(a,b,u.y),mix(c,d,u.y),u.z);
 }
`;
const surfaceAlbedo=/* glsl */`
 // The analytic surface is world-free, derivative filtered before material roles.
 // No fixed seams, tinted crack map, roof hardware, or captured texels.
 float fssFoot=max(length(dFdx(fssObject)),length(dFdy(fssObject)));
 float fssRoughnessNudge=0.;
 float fssBroad=fssNoise(fssObject*9.)-.5;
 float fssFine=(fssNoise(fssObject*67.+vec3(.72,-.14,1.6))-.5)*
             (1.-smoothstep(.25,.66,fssFoot*67.));
 if(fssRole>.5&&fssRole<1.5){
   diffuseColor.rgb*=clamp(1.+.098*fssBroad+.036*fssFine,.92,1.085);
   fssRoughnessNudge=.070*fssBroad+.020*fssFine;
 }else if(fssRole>1.5&&fssRole<2.5){
   float fssVertical=fssNoise(fssObject*vec3(67.,4.,67.))-.5;
   float fssFade=1.-smoothstep(.22,.72,fssFoot*67.);
   diffuseColor.rgb*=clamp(1.+.082*fssBroad+.076*fssVertical*fssFade,.92,1.085);
   fssRoughnessNudge=.061*fssBroad+.018*fssVertical*fssFade;
 }else if(fssRole>2.5&&fssRole<3.5){
   diffuseColor.rgb*=clamp(1.+.057*fssBroad+.021*fssFine,.92,1.085);
   fssRoughnessNudge=.063*fssBroad;
 }
`;
const facetedGlazing=/* glsl */`
 // Dark glass is exterior only. Put a quiet analytic reflected sky/ground
 // lobe into the existing linear-light response, not into emissive or alpha.
 vec3 fssToEye=normalize(vViewPosition);
 vec3 fssRay=normalize((vec4(reflect(-fssToEye,normal),0.)*viewMatrix).xyz);
 float fssHorizon=smoothstep(-.82,.29,fssRay.y);
 float fssHeight=smoothstep(.855,.952,fssObject.y);
 float fssFresnel=pow(1.-clamp(dot(normal,fssToEye),0.,1.),4.);
 vec3 fssLower=vec3(.029,.039,.043),fssDay=vec3(.221,.294,.334);
 float fssSkyWeight=clamp(.66*fssHorizon+.27*fssHeight+.075*fssFresnel,0.,1.);
 vec3 fssReflected=mix(fssLower,fssDay,fssSkyWeight);
 if(fssRole>4.5)outgoingLight=mix(outgoingLight,fssReflected,.35+.20*fssFresnel);
 else outgoingLight=mix(outgoingLight, fssLower+vec3(.015)*fssHorizon,.14);
`;
function baseFinish(shader:Parameters<T.Material['onBeforeCompile']>[0]){
 shader.vertexShader=privateVertex+anchored(shader.vertexShader,'#include <begin_vertex>',
   'fssObject=position;fssRole=fssFinish;');
 shader.fragmentShader=privateFragment+shader.fragmentShader;
}
function decorateBody(m:T.MeshStandardMaterial){
 m.onBeforeCompile=(shader)=>{
  baseFinish(shader);
  shader.fragmentShader=anchored(shader.fragmentShader,'#include <common>',authoredNoise);
  shader.fragmentShader=anchored(shader.fragmentShader,'#include <color_fragment>',surfaceAlbedo);
  shader.fragmentShader=anchored(shader.fragmentShader,'#include <roughnessmap_fragment>',
    'roughnessFactor=clamp(roughnessFactor+fssRoughnessNudge,.67,.995);');
 };
 m.customProgramCacheKey=()=>'fss-documentary-detached-v2-matte';
}
function decorateGlazing(m:T.MeshStandardMaterial){
 m.onBeforeCompile=(shader)=>{
  baseFinish(shader);
  // Three's standard outgoingLight has already included the original PBR
  // response; this doesn't replace the responsive surface with a flat color.
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',()=>{
    if(shader.fragmentShader.split('#include <opaque_fragment>').length!==2)
      throw new Error('Unsupported detached glass shader anchor');
    return facetedGlazing+'\n#include <opaque_fragment>';
  });
  if(!shader.fragmentShader.includes(facetedGlazing))throw new Error('Detached glass shader anchor missing');
 };
 m.customProgramCacheKey=()=>'fss-documentary-detached-v2-glass';
}
export function makeCharlottetownFssExterior(lod:FssLod='near'){
 if(lod!=='near'&&lod!=='mid')throw new Error('Choose near or mid detached exterior');
 const shell=new Shell(),near=lod==='near';createPodium(shell);
 for(let i=0;i<4;i++)oxideFace(shell,i,near);
 cornerReturns(shell);
 createCab(shell,near);
 const group=new T.Group();group.name='Charlottetown FSS – documented detached exterior study';
 const baseline={vertexColors:true,transparent:false,side:T.FrontSide,toneMapped:true};
 const body=new T.Mesh(shell.geometry('body'),new T.MeshStandardMaterial({...baseline,roughness:.91,metalness:.012}));
 const glass=new T.Mesh(shell.geometry('glass'),new T.MeshStandardMaterial({...baseline,roughness:.32,metalness:.055}));
 decorateBody(body.material);decorateGlazing(glass.material);
 body.name='Illustrative opaque walls, cap, mullions and lower volume';
 glass.name='Muted opaque exterior glazing only';
 group.add(body,glass);group.userData={reviewOnly:true,photographicPixels:false,noOperationalElements:true,lod};
 const counts={draws:2,body:body.geometry.attributes.position.count/3,glass:glass.geometry.attributes.position.count/3};
 const triangles=counts.body+counts.glass;
 if(triangles>(near?FSS_ART_SOURCE.nearTriBudget:FSS_ART_SOURCE.midTriBudget))
  throw new Error('Detached geometry budget');
 let disposed=false;
 return {group,body,glass,counts:{...counts,triangles},dispose(){
   if(disposed)return;disposed=true;body.removeFromParent();glass.removeFromParent();
   body.geometry.dispose();glass.geometry.dispose();body.material.dispose();glass.material.dispose();
 }};
}
