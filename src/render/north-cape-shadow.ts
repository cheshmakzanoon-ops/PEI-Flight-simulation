import {Vector4} from 'three';
import {project} from '../sim/geo.ts';
import {NORTH_CAPE_V47} from './north-cape.generated.ts';
import {NORTH_CAPE_HUB_M,NORTH_CAPE_ROTOR_OFFSET} from './north-cape-geometry.ts';

export const NORTH_CAPE_AZIMUTH=Math.PI-.39,NORTH_CAPE_RPM=28.5,NORTH_CAPE_ROTATION_OFFSET=2.399963229728653;
export const NORTH_CAPE_SITES=NORTH_CAPE_V47.map(([id,lon,lat])=>({id,...project(lon,lat)}));
const reach=82;
export class NorthCapeShadow {
 readonly data=NORTH_CAPE_SITES.map(s=>new Vector4(s.x,0,s.z,0));
 readonly uniforms={capeCaster:{value:this.data},capeClock:{value:0},capeExtent:{value:new Vector4(
  Math.min(...NORTH_CAPE_SITES.map(s=>s.x))-reach,Math.min(...NORTH_CAPE_SITES.map(s=>s.z))-reach,
  Math.max(...NORTH_CAPE_SITES.map(s=>s.x))+reach,Math.max(...NORTH_CAPE_SITES.map(s=>s.z))+reach)}};
 intersects(x0:number,z0:number,x1:number,z1:number){
  return NORTH_CAPE_SITES.some(s=>s.x+reach>x0&&s.x-reach<x1&&s.z+reach>z0&&s.z-reach<z1);
 }
 setBase(i:number,y:number){const a=this.data[i];a.y=Number.isFinite(y)?y:0;a.w=Number(Number.isFinite(y));}
}
export const northCapeShadowGLSL=`
 uniform vec4 capeCaster[16];
 uniform float capeClock;uniform vec4 capeExtent;
 float capeShade(vec3 ground,vec3 light,float dist){
  if(dist>620.||any(lessThan(ground.xz,capeExtent.xy))||any(greaterThan(ground.xz,capeExtent.zw)))return 0.;
  float best=0.;
  const vec2 rotorNormal=vec2(${Math.cos(NORTH_CAPE_AZIMUTH)},${-Math.sin(NORTH_CAPE_AZIMUTH)});
  const vec2 crossRotor=vec2(${Math.sin(NORTH_CAPE_AZIMUTH)},${Math.cos(NORTH_CAPE_AZIMUTH)});
  float phase=-mod(capeClock,${60/NORTH_CAPE_RPM})*${2*Math.PI*NORTH_CAPE_RPM/60};
  for(int i=0;i<16;i++){
   vec4 base=capeCaster[i];
   vec2 p=ground.xz-base.xz;
   if(base.w<.5||dot(p,p)>6724.)continue;
   vec2 horizontal=light.xz;
   float height=ground.y-base.y;
   float travel=max(0.,-dot(p,horizontal)/dot(horizontal,horizontal));
   vec2 toward=p+travel*horizontal;
   float y=height+travel*light.y;
   float taper=mix(1.65,1.,clamp(y/50.,0.,1.));
   float edge=mix(.17,.66,clamp(y/50.,0.,1.))+min(.46,dist*.0015);
   float tower=(1.-smoothstep(taper-edge,taper+edge,length(toward)))*
     smoothstep(-1.3,-.08,y)*(1.-smoothstep(49.15,50.05,y));
   vec2 hub=rotorNormal*${NORTH_CAPE_ROTOR_OFFSET};
   float at=dot(hub-p,rotorNormal)/dot(horizontal,rotorNormal);
   float z=dot(p+at*horizontal-hub,crossRotor);
   vec2 crossSection=vec2(height+at*light.y-${NORTH_CAPE_HUB_M.toFixed(1)},z);
   float r=length(crossSection);
   float swept=0.;
   if(at>0.&&r<24.&&dist<500.){
    float p0=phase+float(i)*${NORTH_CAPE_ROTATION_OFFSET};
    for(int j=0;j<3;j++){
     float a=p0+float(j)*2.0943951024;
     vec2 axis=vec2(cos(a),sin(a));
     float along=dot(crossSection,axis);
     float bladeWidth=mix(.83,.07,clamp((along-4.)/19.5,0.,1.));
     float bladeSweep=-clamp(along/23.5,0.,1.)*.99;
     float across=dot(crossSection,vec2(-axis.y,axis.x))-bladeSweep;
     float cut=(1.-smoothstep(bladeWidth*.16,bladeWidth+.63,abs(across)))*
       smoothstep(.41,2.2,along)*(1.-smoothstep(22.5,23.86,along));
     swept=max(swept,cut);
    }
    swept=max(swept,1.-smoothstep(.5,1.12,r));
   }
   best=max(best,max(tower*.80,swept*.47));
  }
  return best*(1.-smoothstep(410.,620.,dist));
 }`;
