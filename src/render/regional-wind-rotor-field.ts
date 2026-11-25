import * as T from 'three';
import {WIND_PROFILE} from './regional-wind-geometry.ts';
import type {WindFarmId} from './regional-wind-stream.ts';
export const ROTOR_PINS:Record<WindFarmId,string>={
 'west-cape':'c919e7adaa9fef49a761beb69ece04ff06606115952912cb09863d7d11c5f7fe',
 'east-point-i':'f092cb254d1d7a40b4e2e629b86b7d74e6e8cbafecb5b96c4d4b71ef2f492888',
 hermanville:'b5086b330284b5d2ab4b77b0e33f224de023631014fddb39341b8f0c1c1fc919',
};
export const ROTOR_INDEX='5300d63cc945cc6af1e039005d6cb343788291b8f85d722806458b1afe2478e5';
export const ROTOR_LIMIT:Record<WindFarmId,number>={'west-cape':10,'east-point-i':6,hermanville:5};
export const ROTOR_REACH:Record<WindFarmId,number>={'west-cape':149,'east-point-i':156,hermanville:183};
export const ROTOR_CLOCK:Record<WindFarmId,string>={
 'west-cape':(15.5*Math.PI*2/60).toFixed(10),'east-point-i':(16.1*Math.PI*2/60).toFixed(10),hermanville:(12.3*Math.PI*2/60).toFixed(10),
};
export const SUN=new T.Vector3(-.60,.74,-.31).normalize();
export const PITCH_M=.15, EDGE_PAD_M=2;
const up=new T.Vector3(0,1,0),wz=new T.Vector3(0,0,1);
export function rotorFrame(id:WindFarmId){
 const rot=new T.Quaternion().setFromAxisAngle(up,-2.62).multiply(new T.Quaternion().setFromAxisAngle(wz,WIND_PROFILE[id].shaftTilt*Math.PI/180));
 const cols=[new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)].map(r=>r.applyQuaternion(rot));
 const x=new T.Vector3().crossVectors(SUN,cols[0]).normalize(),y=new T.Vector3().crossVectors(SUN,x).normalize();
 return {x,y,cols,sun:SUN};
}
/** Whole-rotation analytic projections of every original vertex, before looking at
 * any phase. Coord = u0*shellX + sqrt(wingY²+wingZ²) * a continuous sin/cos. */
export function rotorLayout(id:WindFarmId,p:T.BufferAttribute|T.InterleavedBufferAttribute,hardwareMax:number){
 const {x,y,cols,sun}=rotorFrame(id);const limits=[x,y,sun].map(b=>{
  let lo=Infinity,hi=-Infinity;const ax=b.dot(cols[0]),s=Math.hypot(b.dot(cols[1]),b.dot(cols[2]));
  for(let i=0;i<p.count;i++){const c=ax*p.getX(i),r=s*Math.hypot(p.getY(i),p.getZ(i));lo=Math.min(lo,c-r);hi=Math.max(hi,c+r);}
  if(!Number.isFinite(lo+hi))throw Error('Unbounded source');
  return [Math.floor((lo-EDGE_PAD_M)/PITCH_M)*PITCH_M,Math.ceil((hi+EDGE_PAD_M)/PITCH_M)*PITCH_M];
 });
 const [ox,oy,depth]=limits;const w=Math.ceil((ox[1]-ox[0])/PITCH_M),h=Math.ceil((oy[1]-oy[0])/PITCH_M);
 const cap=ROTOR_LIMIT[id];let best:{cols:number;rows:number;ax:number;ay:number}|undefined;
 for(let c=1;c<=cap;c++){const rows=Math.ceil(cap/c),ax=c*w,ay=rows*h;
  if(ax>hardwareMax||ay>hardwareMax)continue;
  if(!best||Math.max(ax,ay)<Math.max(best.ax,best.ay)||Math.max(ax,ay)===Math.max(best.ax,best.ay)&&ax*ay<best.ax*best.ay)best={cols:c,rows,ax,ay};}
 if(!best)return;
 return {...best,w,h,lowU:ox[0],lowV:oy[0],loD:depth[0],hiD:depth[1],x,y,sun,cols3:cols};
}
export type RotorLayout=NonNullable<ReturnType<typeof rotorLayout>>;
export const RECEIVER_DECL=`
#define PEI_MOVING_ROTOR_RECEIVER 1
uniform highp sampler2DShadow regionalRotorDepth;
uniform vec3 rotorRight,rotorUp,rotorSun;
uniform vec4 rotorLocalRect,rotorCellRect,rotorDepthParams;
uniform highp vec4 rotorOrigins[10];
uniform int rotorCount;
float rotorDepthTap(vec2 uv,float receiver){
 // A linear comparison read averages four depth comparisons, not four depths.
 return 1.-textureGrad(regionalRotorDepth,vec3(uv,receiver),vec2(0.),vec2(0.));
}
float windRotorDirect(vec3 p,float dist,float pixel){
 if(dist>=570.||rotorCount<1)return 0.;
 for(int i=0;i<10;i++){
  if(i>=rotorCount)break;
  vec3 h=p-rotorOrigins[i].xyz;
  if(dot(h.xz,h.xz)>35344.)continue;
  vec2 q=vec2(dot(h,rotorRight),dot(h,rotorUp));
  vec2 local=(q-rotorLocalRect.xy)*rotorLocalRect.zw;
  if(any(lessThan(local,vec2(0.)))||any(greaterThanEqual(local,vec2(1.))))continue;
  float along=dot(h,rotorSun);
  if(along>=rotorDepthParams.x) return 0.;
  // Intersect a ray with the tilted shaft's radial plane to estimate the actual
  // finite solar-disc footprint. This changes only the penumbra; every tap
  // still compares this receiver against a real rendered three-blade depth.
  float axial=-(q.x*rotorDepthParams.z+q.y*rotorDepthParams.w);
  float radius=.00465*max(0.,axial-along);
  float ref=clamp((rotorDepthParams.x-along-.025)*rotorDepthParams.y,.000005,.99997);
  float slot=float(i);vec2 cell=vec2(mod(slot,rotorCellRect.z),floor(slot/rotorCellRect.z));
  vec2 uv=(cell+local)*rotorCellRect.xy;
  vec2 d=rotorLocalRect.zw*rotorCellRect.xy*radius;
  // 16 fixed equal-area deterministic disk sites (4 crossed inner, 8 middle,
  // 4 rim with angular phase skew). No time noise and no filled rotor disc.
  float b=0.;
  b+=rotorDepthTap(uv+d*vec2(.1531,.0634),ref);b+=rotorDepthTap(uv+d*vec2(-.1837,.4437),ref);
  b+=rotorDepthTap(uv+d*vec2(-.3656,-.1514),ref);b+=rotorDepthTap(uv+d*vec2(.1324,-.3199),ref);
  b+=rotorDepthTap(uv+d*vec2(.5199,.1441),ref);b+=rotorDepthTap(uv+d*vec2(.3098,.5204),ref);
  b+=rotorDepthTap(uv+d*vec2(-.2062,.5863),ref);b+=rotorDepthTap(uv+d*vec2(-.5774,.3238),ref);
  b+=rotorDepthTap(uv+d*vec2(-.6886,-.2105),ref);b+=rotorDepthTap(uv+d*vec2(-.3836,-.6699),ref);
  b+=rotorDepthTap(uv+d*vec2(.2217,-.7569),ref);b+=rotorDepthTap(uv+d*vec2(.6909,-.4166),ref);
  b+=rotorDepthTap(uv+d*vec2(.8915,.3207),ref);b+=rotorDepthTap(uv+d*vec2(-.3814,.8463),ref);
  b+=rotorDepthTap(uv+d*vec2(-.8424,-.3387),ref);b+=rotorDepthTap(uv+d*vec2(.3737,-.9034),ref);
  return b*(1./16.)*(1.-smoothstep(370.,570.,dist));
 }
 return 0.;
}
`;
export function casterVertex(id:WindFarmId){return `precision highp float;precision highp int;
 in vec3 position;in float windSeed;in mat4 instanceMatrix;
 uniform highp float windClock;uniform vec3 rotorRight,rotorUp,rotorSun;uniform vec4 rotorLocalRect,rotorCellRect,rotorDepthParams;
 void main(){
  float a=windSeed-windClock*${ROTOR_CLOCK[id]},c=cos(a),s=sin(a);
  vec3 p=mat3(instanceMatrix)*vec3(position.x,mat2(c,s,-s,c)*position.yz);
  vec2 q=vec2(dot(p,rotorRight),dot(p,rotorUp));
  vec2 local=(q-rotorLocalRect.xy)*rotorLocalRect.zw;float slot=float(gl_InstanceID);
  vec2 cell=vec2(mod(slot,rotorCellRect.z),floor(slot/rotorCellRect.z));
  vec2 uv=(cell+local)*rotorCellRect.xy;
  float dep=(rotorDepthParams.x-dot(p,rotorSun))*rotorDepthParams.y;
  gl_Position=vec4(uv*2.-1.,dep*2.-1.,1.);
 }`;}
