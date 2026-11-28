/** Detached North Cape screen-space transition policy. Nothing in the app imports this study. */
export type Vec3=readonly [number,number,number];
type Clip=readonly [number,number,number,number];
export type CapeLevel='near'|'middle'|'not-drawn';
export type Projection={
 viewportWidth:number;viewportHeight:number;
 // Local box to homogeneous clip transform (P × V × M), in column-major order.
 // Do not infer apparent size from a nominal CSS viewport or a metre radius.
 localToClip:ArrayLike<number>;
 min:Vec3;max:Vec3;
};
export type Aperture={kind:'visible'|'outside'|'uncertain';spanPx:number};
const plane=(p:Clip,i:number,s:number)=>p[3]+s*p[i];
const uncertain:Aperture=Object.freeze({kind:'uncertain',spanPx:Infinity});
const outside:Aperture=Object.freeze({kind:'outside',spanPx:0});
/** Screen bounds on every point inside a conservative local 3D box, not a visibility or occlusion witness. */
export function capeAperture({viewportWidth:w,viewportHeight:h,localToClip:M,min,max}:Projection):Aperture{
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<=0||h<=0||M.length!==16||
    Array.from(M).some(v=>!Number.isFinite(v))||min.some((v,i)=>!Number.isFinite(v)||!Number.isFinite(max[i])||v>=max[i]))return uncertain;
 const v:Clip[]=[];
 for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){
  const k=(i:number)=>M[i]*x+M[i+4]*y+M[i+8]*z+M[i+12];
  const p:Clip=[k(0),k(1),k(2),k(3)];
  if(p.some(u=>!Number.isFinite(u)))return uncertain;
  v.push(p);
 }
 // If every corner is strictly outside one common homogeneous clip plane, the convex box cannot draw.
 for(let i=0;i<3;i++)for(const s of [-1,1]){
  if(v.every(p=>plane(p,i,s)<-1e-6))return outside;
 }
 // If any corner meets the near plane, retain near geometry rather than divide by an unsafe w.
 if(v.some(p=>p[3]<=1e-6||p[2]<=-p[3]+1e-6))return uncertain;
 const axes=[0,1].map(i=>v.map(p=>p[i]/p[3]));
 const ext=(a:number[])=>Math.max(...a)-Math.min(...a);
 const span=Math.max(w*.5*ext(axes[0]),h*.5*ext(axes[1]));
 return Number.isFinite(span)&&span>0?{kind:'visible',spanPx:span}:uncertain;
}
// Hysteresis is in actual drawing-buffer pixels, not route range. Outside is not a material transition.
export const capeDiagnosticLimits=Object.freeze({nearEnterPx:19,nearLeavePx:15,drawEnterPx:1.35,drawLeavePx:.8});
export function capeStudyLevel(previous:CapeLevel,aperture:Aperture):{level:CapeLevel;mayDraw:boolean}{
 if(aperture.kind==='outside')return {level:previous,mayDraw:false};
 const p=aperture.spanPx,L=capeDiagnosticLimits;
 if(aperture.kind==='uncertain'||!Number.isFinite(p)||p<0)return {level:'near',mayDraw:true};
 if(previous==='near'&&p>L.nearLeavePx||p>=L.nearEnterPx)return {level:'near',mayDraw:true};
 if(previous==='not-drawn'&&p<L.drawEnterPx||p<=L.drawLeavePx)return {level:'not-drawn',mayDraw:false};
 return {level:'middle',mayDraw:true};
}
