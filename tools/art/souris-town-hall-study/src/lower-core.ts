/** Source-correlated lower rear core only. The measured high-east tier is held. */
import {area,at,PLAN,type Plane,type P2} from './survey.ts';
export const LOWER_PLANE:Plane=[19.255668517667715,0.017023026549675663,-0.17614765759250123];
export const CUT:readonly Plane[]=[[-9.108848163462577,0.17009856814245983,1.0],[0.0156684927293691,-1.0,-0.15316033205458032]];
export const REAR_JOIN_COVERAGE=0.164;
export const lowerY=(q:P2)=>at(LOWER_PLANE,q);
export const inCore=(q:P2)=>CUT.every(k=>at(k,q)>=-1e-10);
const cp2=(a:P2,b:P2,s:number):P2=>[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s];
export type Sample=readonly [u:number,v:number,y:number];
const xy=([u,v]:Sample):P2=>[u,v];
function sample(v:Sample,w:Sample,t:number):Sample{return [...cp2(xy(v),xy(w),t),v[2]+(w[2]-v[2])*t];}
function clipFace(q:readonly Sample[],p:Plane,sgn:number){
 const a:Sample[]=[];
 const m=1e-10;
 for(let i=0;i<q.length;i++){
  const q0=q[i],q1=q[(i+1)%q.length],v=sgn*at(p,xy(q0)),w=sgn*at(p,xy(q1));
  if(v>=-m)a.push(q0);
  if((v<-m&&w>m)||(v>m&&w<-m))a.push(sample(q0,q1,v/(v-w)));
 }
 return a;
}
export function clipCore(p:readonly Sample[],enabled:boolean){
 if(!enabled||CUT.some(k=>p.every(q=>at(k,xy(q))<=1e-10)))return [{q:p,low:false}];
 if(p.every(v=>inCore(xy(v))))return [{q:p,low:true}];
 let q=p;const outside:{q:readonly Sample[];low:boolean}[]=[];
 for(const cut of CUT){
  const old=clipFace(q,cut,-1);
  if(old.length>=3&&Math.abs(area(old.map(xy)))>1e-10)outside.push({q:old,low:false});
  q=clipFace(q,cut,1);
 }
 if(q.length>=3&&Math.abs(area(q.map(xy)))>1e-10)outside.push({q,low:true});
 return outside;
}
export function cutParameters(a:P2,b:P2){
 const ts=[0.,1.];
 for(const n of CUT){
  const s=at(n,a),e=at(n,b);if(s*e<0&&Math.abs(s-e)>1e-12)ts.push(s/(s-e));
 }
 return ts.sort((a,b)=>a-b).filter((c,i,z)=>!i||c-z[i-1]>1e-7);
}
const polygon=clipCore(PLAN.map(p=>[...p,0]),true).find(k=>k.low)!.q.map(xy);
export const CORE_OUTLINE=polygon;
export function coreJoints(){
 const joints:{a:P2;b:P2;normal:readonly [number,number,number]}[]=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length];
  for(const k of CUT)if(Math.abs(at(k,a))<1e-7&&Math.abs(at(k,b))<1e-7)joints.push({a,b,normal:[k[1],0.,-k[2]]});
 }
 return joints;
}
