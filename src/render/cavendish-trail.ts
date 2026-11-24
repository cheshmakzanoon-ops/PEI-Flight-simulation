import {GABLES_TRAIL} from './cavendish-trail.generated.ts';
import {project} from '../sim/geo.ts';
const centers=GABLES_TRAIL.derivedLineWgs84.map(([lo,la])=>project(lo,la));
const origin=[centers[0].x,centers[0].z] as const;
const points=centers.map(({x,z})=>[x-origin[0],z-origin[1]] as const);
const spans=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
const cumul=[0];
for(const x of spans)cumul.push(cumul.at(-1)!+x);
const b=[Math.min(...centers.map(q=>q.x))-.7,Math.min(...centers.map(q=>q.z))-.7,
 Math.max(...centers.map(q=>q.x))+.7,Math.max(...centers.map(q=>q.z))+.7] as const;
export function gablesTrailIntersects(x:number,z:number,r:number,d:number){
 return x<=b[2]&&r>=b[0]&&z<=b[3]&&d>=b[1];
}
export function trailLateral(x:number,z:number){
 let nearest=Infinity,along=0;
 const px=x-origin[0],pz=z-origin[1];
 for(let i=0;i<spans.length;i++){
  const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],lx=px-a[0],lz=pz-a[1];
  const u=Math.max(0,Math.min(1,(lx*dx+lz*dz)/(dx*dx+dz*dz))),d=Math.hypot(lx-u*dx,lz-u*dz);
  if(d<nearest){nearest=d;along=cumul[i]+u*spans[i];}
 }
 return {nearest,along};
}
const f=(x:number)=>x.toFixed(8),v=(q:readonly number[])=>'vec2('+f(q[0])+','+f(q[1])+')';
export const gablesTrailGLSL=/*glsl*/`
uniform float gablesTrailStrength;
vec2 pathStation(vec2 p,vec2 a,vec2 b,float s,float started){
 vec2 v=b-a,h=p-a;
 float u=clamp(dot(h,v)/dot(v,v),0.,1.);
 return vec2(length(h-v*u),started+u*s);
}
void lowerHauntedTrail(inout vec3 col,vec3 p,float d,float coast){
 // Derivatives must be collected before the per-fragment range branches.
 vec2 footprint=fwidth(p.xz);
 float sampleM=max(footprint.x,footprint.y);
 if(gablesTrailStrength<.01||d>230.||coast<35.) return;
 vec2 xy=p.xz-${v(origin)};
 if(any(lessThan(xy,${v([b[0]-origin[0],b[1]-origin[1]])}))||
    any(greaterThan(xy,${v([b[2]-origin[0],b[3]-origin[1]])})))return;
 vec2 h=vec2(900.,0.),t;
 ${spans.map((s,i)=>'t=pathStation(xy,'+v(points[i])+','+v(points[i+1])+','+f(s)+','+f(cumul[i])+');if(t.x<h.x)h=t;').join('\n ')}
 float edge=(1.-smoothstep(.38,.70,h.x));
 float ends=smoothstep(0.,4.5,h.y)*smoothstep(0.,3.3,${f(cumul.at(-1)!)}-h.y);
 float visible=(1.-smoothstep(100.,230.,d))*edge*ends*gablesTrailStrength;
 if(visible<.001)return;
 float packed=mix(.5,noise(xy*1.34+vec2(8.32,1.2)),1.-smoothstep(.34,.9,sampleM*1.34));
 float fine=(noise(xy*26.7+vec2(1.26,3.4))-.5)*(1.-smoothstep(22.,64.,d))*(1.-smoothstep(.3,.9,sampleM*26.7));
 vec3 color=mix(vec3(.105,.095,.078),vec3(.164,.149,.122),packed)+fine*.028;
 col=mix(col,color,visible*.62);
}
`;
