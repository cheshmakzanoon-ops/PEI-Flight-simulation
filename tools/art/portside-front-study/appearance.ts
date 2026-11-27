/** Detached author trial ONLY, under PORTSIDE-V3-LOCK-MANIFEST.md.
 *
 * The single original plane is retained: normalized U starts at the east
 * corner, V at the existing wall foot. The four oxide fields, continuous
 * pale backplate and 2 grouped central readings are interpretive optics,
 * not measurements, actual openings, a new curtain wall or source imagery.
 * Exact existing owner/EBO/linked material custody is checked by the studio.
 */
const tuple=<T extends readonly number[]>(...v:T):Readonly<T>=>Object.freeze(v);
export const PORTSIDE_V3=Object.freeze({
 manifest:'70d205601405d857f8ec3a5879da33f5b19a6d49c5321bad216f791934f26beb',
 tile:'q032001',ordinal:381,from:68742,end:68748,vertices:69906,elements:69615,
 dimensions:tuple(67.5440709638077,19.829999566078186),
 body:tuple(.006,.994,.110,.971),full:tuple(.014,.986,.122,.959),
 fade:tuple(410,640),east:tuple(.028,.520),west:tuple(.641,.972),
 center:tuple(.520,.641),centerU:tuple(.547,.620),
 groupUpper:tuple(.747,.821),groupLower:tuple(.608,.701),separator:tuple(.701,.747),
 joinEast:tuple(.006,.040),joinWest:tuple(.960,.994),
 stileEast:tuple(.006,.022),stileWest:tuple(.979,.994),
 red:Object.freeze([tuple(.242,.377),tuple(.401,.527),tuple(.550,.679),tuple(.701,.834)]),
 windowsEast:Object.freeze([
  tuple(.062,.0126),tuple(.151,.0108),tuple(.204,.0110),tuple(.261,.0167),
  tuple(.322,.0120),tuple(.385,.0179),tuple(.432,.0100),tuple(.487,.0108)
 ]),
 windowsWest:Object.freeze([
  tuple(.666,.0093),tuple(.720,.0140),tuple(.774,.0095),tuple(.830,.0135),tuple(.884,.0108)
 ]),
 westOpeningRows:Object.freeze([
  tuple(.174,.018),tuple(.308,.024),tuple(.459,.023),
  tuple(.588,.025),tuple(.733,.025),tuple(.894,.026)
 ]),
 centerMinor:tuple(.557,.606),
 protected:Object.freeze({e1:tuple(68748,68754),e2:tuple(68754,68760),e3:tuple(68760,68766),
  roof:tuple(68766,68778),cap:tuple(68778,68784)}),
});
const s=PORTSIDE_V3;
const m0='#include <common>',mv='void main(){townWall=townWallFit*.01;vec4 p=';
const mf=' void main(){',log=' #include <logdepthbuf_fragment>\n';
const oldGeneric=' else if(roof<.5){\n  vec2 grid=uv2d/vec2(2.62,3.08);';
const oldWindowFinish='c+=vec3(.028)*(sill+mullion);';
const oldLower='  c*=1.-.11*fine*band(uv2d.y*4.5,.0,.18);c*=.81+.19*smoothstep(0.,3.8,uv2d.y);';
const oldLighting=' c*=.61+.51*k;';
const oldOutput='vec4(mix(c,vec3(.56,.68,.72),mist),1.)';

const marks=Object.freeze({
 common:Object.freeze(['// Q381_V3_COMMON_BEGIN','// Q381_V3_COMMON_END']),
 pixels:Object.freeze(['// Q381_V3_PIXEL_BEGIN','// Q381_V3_PIXEL_END']),
 surface:Object.freeze(['// Q381_V3_SURFACE_BEGIN','// Q381_V3_SURFACE_END']),
});
const once=(a:string,b:string)=>a.indexOf(b)>=0&&a.indexOf(b)===a.lastIndexOf(b);
const g=(v:number)=>Number.isInteger(v)?v.toFixed(1):String(v);
const v2=(a:readonly number[])=>'vec2('+a.map(g).join(',')+')';
const v4=(a:readonly number[])=>'vec4('+a.map(g).join(',')+')';
const rc=s.red.map(r=>(r[0]+r[1])*.5);
const nearRow=(y:number,h:number)=>'q381v3Near(q.y,fw.y,'+g(y)+','+g(h)+')';
const row=(east:boolean,y:number,h:number)=>' q381v3Row(q,fw,look,'+g(y)+','+g(h)+','+(east?'true':'false')+')';
function lineWindow(w:readonly [number,number]){
 return '    result+=q381v3Window(q,fw,shift,'+g(w[0])+','+g(w[1])+',y,h,'+(w[1]>.013?'.53':'.45')+');';
}

/** Exact typed-source splice only; no operation on a scene. Does not verify
 * the runtime asset authority by itself. Every original term remains.
 */
export function patchPortsideFacadeV3(vertex:string,fragment:string){
 if(/q381v3|q381v2|q381SeaWall|terminalWallLive/.test(vertex+fragment)||
  ![m0,mv].every(k=>once(vertex,k))||
  ![mf,log,oldGeneric,oldWindowFinish,oldLower,oldLighting,oldOutput,
    'uniform sampler2D waterStreetSky;','uniform sampler2D townWallSky;',
    'uniform float townWallGain;'].every(k=>once(fragment,k)))return;
 const taggedVertex=vertex.replace(m0,m0+'\n flat varying float q381v3Plane;')
  .replace(mv,'void main(){q381v3Plane=(gl_VertexID>='+s.from+'&&gl_VertexID<'+s.end+')?1.:0.;townWall=townWallFit*.01;vec4 p=');
 const coat=fragment.replace(mf,marks.common[0]+`
 flat varying float q381v3Plane;
 uniform float q381v3Gain;
 const vec4 q381v3Body=${v4(s.body)},q381v3Feather=${v4(s.full)};
 const vec2 q381v3OxEnd=${v2(s.east)},q381v3West=${v2(s.west)};
 const vec2 q381v3Pair=${v2(s.centerU)};
 const vec3 q381v3Pale=vec3(.490,.512,.500);
 const vec3 q381v3Cladding=vec3(.311,.099,.080);
 // Analytically integrated area of finite intervals. Filter widths come
 // from the uniform branch above inherited material selection; the scope
 // gate still uses the genuine undilated position, not this filter kernel.
 float q381v3Span(float p,float w,float a,float b){
   return clamp((min(p+.5*w,b)-max(p-.5*w,a))/w,0.,1.);
 }
 float q381v3Band(float p,float w,vec2 b){
   return q381v3Span(p,w,b.x,b.y);
 }
 float q381v3Rect(vec2 q,vec2 fw,vec2 x,vec2 y){
   return q381v3Band(q.x,fw.x,x)*q381v3Band(q.y,fw.y,y);
 }
 bool q381v3Near(float y,float dy,float c,float h){
   return abs(y-c)<h+dy*.5;
 }
 float q381v3NarrowStile(float u,vec2 ends){
   return smoothstep(ends.x,ends.x+.004,u)*(1.-smoothstep(ends.y-.004,ends.y,u));
 }
 float q381v3WallGate(vec2 q){
   return smoothstep(q381v3Body.x,q381v3Feather.x,q.x)*
      (1.-smoothstep(q381v3Feather.y,q381v3Body.y,q.x))*
      smoothstep(q381v3Body.z,q381v3Feather.z,q.y)*
      (1.-smoothstep(q381v3Feather.w,q381v3Body.w,q.y));
 }
 // Filtered paint/reveal approximation on the opaque stock plane.
 // Variable width/rail line is suggested, not a survey or new opening.
 vec3 q381v3Window(vec2 q,vec2 fw,vec2 shift,float x,float w,float y,float h,float split){
   if(!q381v3Near(q.x,fw.x,x,w))return vec3(0.);
   vec2 ux=x+vec2(-w,w),vy=y+vec2(-h,h);
   float o=q381v3Rect(q,fw,ux,vy);
   vec2 lip=vec2(.00145,.0040);
   vec2 lensX=ux+vec2(lip.x+max(0.,shift.x),-lip.x+min(0.,shift.x));
   vec2 lensY=vy+vec2(lip.y+max(0.,shift.y),-lip.y+min(0.,shift.y));
   float l=min(o,q381v3Rect(q,fw,lensX,lensY));
   float sx=mix(ux.x,ux.y,split);
   float mull=min(l,q381v3Rect(q,fw,sx+vec2(-.00045,.00045),lensY));
   return vec3(o,l,mull);
 }
 vec3 q381v3Row(vec2 q,vec2 fw,vec2 shift,float y,float h,bool east){
   vec3 result=vec3(0.);
   if(east){
`+s.windowsEast.map(lineWindow).join('\n')+`
   }else{
`+s.windowsWest.map(lineWindow).join('\n')+`
   }
   return result;
 }
 vec3 q381v3Cluster(vec3 base,vec2 q,vec3 re,float facing){
   float surround=clamp(re.x,0.,1.);
   float core=min(surround,clamp(re.y,0.,1.));
   float mid=min(core,clamp(re.z,0.,1.));
   // Passively reflecting blue-grey daylight, never emissive, black
   // stamped glass, a property photo or a simulated tenant interior.
   float gradient=.50+.29*sin(11.*q.y+6.4*q.x)+.13*(1.-facing);
   vec3 glass=mix(vec3(.116,.154,.164),vec3(.228,.275,.279),gradient)*(.96+.04*facing);
   vec3 frame=mix(base,vec3(.492,.520,.503),.55);
   return base*(1.-surround)+frame*(surround-core)+glass*(core-mid*.70)+frame*(mid*.70);
 }
 vec3 q381v3Central(vec3 base,vec2 q,vec2 fw,vec2 look,float facing){
   const vec2 hi=${v2(s.groupUpper)},lo=${v2(s.groupLower)},mid=${v2(s.separator)};
   // Only the short independently documented oxide infill, not a new
   // light stripe, curtain, ledge, simulated balcony or canopy.
   float stripe=q381v3Rect(q,fw,q381v3Pair,mid);
   vec3 oxideStop=vec3(.277,.102,.092);
   vec3 outC=mix(base,oxideStop,stripe);
   float oh=q381v3Rect(q,fw,q381v3Pair,hi);
   float ol=q381v3Rect(q,fw,q381v3Pair,lo);
   vec2 innerU=q381v3Pair+vec2(.0033+max(0.,look.x),-.0033+min(0.,look.x));
   float ih=min(oh,q381v3Rect(q,fw,innerU,hi+vec2(.0060+max(look.y,0.),-.0100+min(look.y,0.))));
   float il=min(ol,q381v3Rect(q,fw,innerU,lo+vec2(.0063+max(look.y,0.),-.0078+min(look.y,0.))));
   float mullHi=min(ih,q381v3Rect(q,fw,vec2(.5779,.5790),hi));
   float mullLo=min(il,q381v3Rect(q,fw,vec2(.5917,.5930),lo));
   float lightLook=.88+.12*facing;
   vec3 topLens=mix(vec3(.083,.122,.129),vec3(.142,.181,.188),smoothstep(.753,.819,q.y))*lightLook;
   vec3 lowLens=mix(vec3(.208,.269,.287),vec3(.300,.354,.365),smoothstep(.615,.691,q.y))*lightLook;
   vec3 paleFrame=mix(base,vec3(.542,.550,.529),.62);
   // Integrate each disjoint height interval out of SAME backplate.
   // No train of RGB overwrites or stacking overlapping alpha masks.
   outC+=(paleFrame-base)*(max(oh-ih,0.)+max(ol-il,0.)+.74*(mullHi+mullLo));
   outC+=(topLens-base)*(ih-.74*mullHi)+(lowLens-base)*(il-.74*mullLo);
   // A few smaller ordinary paired apertures beneath the grouped
   // optics; none in the central lower approach/foot/entrance proxy.
   vec3 small=vec3(0.);
   if(q.y>.241&&q.y<.608){
     if(q381v3Near(q.y,fw.y,.315,.019)){
       small+=q381v3Window(q,fw,look,.557,.0087,.315,.019,.44);
       small+=q381v3Window(q,fw,look,.606,.0083,.315,.018,.47);
     }
     if(q381v3Near(q.y,fw.y,.455,.021)){
       small+=q381v3Window(q,fw,look,.557,.0086,.455,.021,.51);
       small+=q381v3Window(q,fw,look,.606,.0087,.455,.020,.47);
     }
     if(q381v3Near(q.y,fw.y,.557,.019)){
       small+=q381v3Window(q,fw,look,.557,.0092,.555,.018,.52);
       small+=q381v3Window(q,fw,look,.606,.0083,.557,.018,.47);
     }
   }
   return q381v3Cluster(outC,q,small,facing);
 }
 vec3 q381v3Surface(vec2 q,vec2 fw,vec3 viewToEye,vec3 normal){
   float facing=clamp(dot(normal,viewToEye),0.,1.);
   vec2 look=clamp(vec2(dot(viewToEye.xz,vec2(-.9978308678,-.0658297539))*.00105,viewToEye.y*.00321)/
      max(.39,facing),vec2(-.0022,-.0041),vec2(.0022,.0041));
   float eastPanel=smoothstep(q381v3OxEnd.x,q381v3OxEnd.x+.006,q.x)*
      (1.-smoothstep(q381v3OxEnd.y-.008,q381v3OxEnd.y,q.x));
   float oxide=clamp(${s.red.map(r=>'q381v3Band(q.y,fw.y,'+v2(r)+')').join('+')},0.,1.);
   // Everything starts at the same physical pale backplate. A gentle
   // continuous high-to-low response and a weak inboard/corner contrast
   // do not recreate the two detached V2 inserts.
   float softly=.975+.021*smoothstep(.149,.925,q.y)+.012*cos(7.8*q.x+4.9*q.y);
   vec3 pale=q381v3Pale*softly;
   float endShield=q381v3NarrowStile(q.x,${v2(s.stileEast)})+q381v3NarrowStile(q.x,${v2(s.stileWest)});
   pale=mix(pale,vec3(.525,.534,.514)*softly,endShield*.52);
   vec3 mutedOxide=q381v3Cladding*(.981+.020*cos(8.1*q.x-2.95*q.y));
   vec3 base=mix(pale,mutedOxide,eastPanel*oxide);
   vec3 q381v3Groups=vec3(0.);
   // The role checks below only bound work. At most one left-right
   // family evaluated at a fragment; no texture or per-fragment loops.
   if(q.x>q381v3OxEnd.x&&q.x<q381v3OxEnd.y){
`+rc.map((y,i)=>'    if('+nearRow(y,[.025,.025,.024,.026][i])+')q381v3Groups+='+row(true,y,[.025,.025,.024,.026][i])+';').join('\n')+`
    if(${nearRow(.174,.020)})q381v3Groups+=${row(true,.174,.020)};
    if(${nearRow(.896,.024)})q381v3Groups+=${row(true,.896,.024)};
   }else if(q.x>q381v3West.x&&q.x<q381v3West.y){
`+s.westOpeningRows.map(([y,h])=>'    if('+nearRow(y,h)+')q381v3Groups+='+row(false,y,h)+';').join('\n')+`
   }
   if(q.x>=${g(s.center[0])}&&q.x<=${g(s.center[1])})
     return q381v3Central(base,q,fw,look,facing);
   return q381v3Cluster(base,q,q381v3Groups,facing);
 }
`+marks.common[1]+'\n'+mf)
 .replace(log,log+marks.pixels[0]+`
  vec2 q381v3Point=uv2d/${v2(s.dimensions)};
  vec2 q381v3Foot=vec2(.00010);
  if(q381v3Gain>0.)q381v3Foot=clamp(fwidth(q381v3Point),vec2(.00010),vec2(.15));
`+marks.pixels[1]+'\n')
 .replace(oldWindowFinish,oldWindowFinish+'\n'+marks.surface[0]+`
  // The compositor, downstream footing/sill shading, shared town core,
  // depth, alpha, scene fog and sky remain the original shader.
  if(q381v3Gain>0. && q381v3Plane>.5 && gl_FrontFacing && roof<.5 && facade<.5 &&
     townWall.x==0. && d<${g(s.fade[1])} &&
     q381v3Point.x>q381v3Body.x && q381v3Point.x<q381v3Body.y &&
     q381v3Point.y>q381v3Body.z && q381v3Point.y<q381v3Body.w){
    float amount=clamp(q381v3Gain,0.,1.)*(1.-smoothstep(${g(s.fade[0])},${g(s.fade[1])},d))*q381v3WallGate(q381v3Point);
    if(amount>0.){
      vec3 facingRay=(cameraPosition-wp)/max(d,.001);
      c=mix(c,q381v3Surface(q381v3Point,q381v3Foot,facingRay,n),amount);
    }
  }
`+marks.surface[1]+'\n');
 return {vertex:taggedVertex,fragment:coat,uniformName:'q381v3Gain' as const};
}
