import * as THREE from 'three';
import {readCoastalPack} from '../sim/coastal-packs.ts';
import {project} from '../sim/geo.ts';
import {BASIN_SCAN} from './basin-head-scan-pin.generated.ts';
import {BASIN_SAND} from './basin-head-sand-pin.generated.ts';

const [west,north,east,south]=BASIN_SAND.bounds;
const a=project(west,north),b=project(east,south);
export const BASIN_SAND_BOUNDS=[a.x,a.z,b.x,b.z] as const;
export function basinSandIntersects(x0:number,z0:number,x1:number,z1:number){
 return x0<b.x&&x1>a.x&&z0<b.z&&z1>a.z;
}
export async function loadBasinSand(base:string,fetcher:typeof fetch=fetch){
 const load=(stamp:typeof BASIN_SCAN|typeof BASIN_SAND)=>readCoastalPack(base+stamp.asset,fetcher,1800,stamp,b=>b);
 const [raw,scan]=await Promise.all([load(BASIN_SAND),load(BASIN_SCAN)]);
 if(!raw||!scan)return;
 const data=new Uint8Array(raw);
 const map=new THREE.DataTexture(data,BASIN_SAND.width,BASIN_SAND.height,THREE.RGFormat);
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.needsUpdate=true;
 const detail=new THREE.DataTexture(new Uint8Array(scan),BASIN_SCAN.width,BASIN_SCAN.height,THREE.RGBAFormat);
 detail.magFilter=THREE.LinearFilter;detail.minFilter=THREE.LinearMipmapLinearFilter;
 detail.wrapS=detail.wrapT=THREE.RepeatWrapping;detail.generateMipmaps=true;detail.anisotropy=4;detail.needsUpdate=true;
 return {basinSandScan:{value:detail},basinSandMap:{value:map},basinSandBox:{value:new THREE.Vector4(a.x,a.z,1/(b.x-a.x),1/(b.z-a.z))}};
}
export type BasinSand=Awaited<ReturnType<typeof loadBasinSand>>;

export const basinSandGLSL=`
uniform sampler2D basinSandMap,basinSandScan;
uniform vec4 basinSandBox;
vec3 basinSand(vec3 col,vec3 p,vec3 n,float coast,float d){
 vec2 uv=(p.xz-basinSandBox.xy)*basinSandBox.zw;
 vec2 dx=dFdx(uv),dy=dFdy(uv);
 mat2 orient=mat2(.830,-.557,.557,.830);
 vec2 sandUV=orient*(p.xz/30.);
 vec2 gdx=dFdx(sandUV),gdy=dFdy(sandUV);
 float px=max(length(dFdx(p.xz)),length(dFdy(p.xz)));
 float gate=smoothstep(.77,.94,n.y)*(1.-smoothstep(5.8,10.2,p.y))
   *(1.-smoothstep(29.,74.,coast))*(1.-smoothstep(600.,1450.,d));
 if(gate<=0.||any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return col;
 // Mipmaps are for smooth strength only. Never promote another WorldCover
 // class/water into mapped exposed sand across a bilinear or mip footprint.
 vec2 dims=vec2(textureSize(basinSandMap,0)),cell=uv*dims;
 ivec2 pixel=ivec2(cell);
 vec2 attributeAt=texelFetch(basinSandMap,pixel,0).rg;
 if(attributeAt.r<=0.)return col;
 float valid=textureGrad(basinSandMap,uv,dx,dy).r;
 if(valid<.002)return col;
 int flags=int(attributeAt.g*255.+.5);
 vec2 metres=1./(dims*basinSandBox.zw),low=fract(cell)*metres,high=metres-low;
 float nearest=min(metres.x,metres.y);
 if((flags&1)!=0)nearest=min(nearest,low.y);
 if((flags&2)!=0)nearest=min(nearest,high.x);
 if((flags&4)!=0)nearest=min(nearest,high.y);
 if((flags&8)!=0)nearest=min(nearest,low.x);
 if((flags&16)!=0)nearest=min(nearest,length(vec2(high.x,low.y)));
 if((flags&32)!=0)nearest=min(nearest,length(high));
 if((flags&64)!=0)nearest=min(nearest,length(vec2(low.x,high.y)));
 if((flags&128)!=0)nearest=min(nearest,length(low));
 // Continuous feather to exact zero inside open loose-sand cells; no
 // painted 10m zig-zag or support spilling into adjacent grass/water.
 valid*=smoothstep(0.,min(6.1,min(metres.x,metres.y)),nearest);
 // Site documented as pale silica sand; these are original art values, not a BRDF survey.
 float dry=smoothstep(1.3,6.5,coast+.48*noise(p.xz*.091));
 float broad=noise(p.xz*.067);
 vec3 pale=mix(vec3(.282,.236,.173),vec3(.520,.478,.390),dry);
 float grain=mix(.5,noise(p.xz*3.8),1.-smoothstep(.10,.48,px));
 // Derivative-filtered scan relief and original fine grain, no displacement.
 // Change only the optical appearance of existing sandy land.
 vec4 scan=textureGrad(basinSandScan,sandUV,gdx,gdy);
 float relief=1.-smoothstep(.22,.95,px);
 vec2 slope=transpose(orient)*(scan.gb*2.-1.);
 vec3 micro=normalize(n+vec3(slope.x,0.,slope.y)*relief*.42);
 float light=max(0.,dot(micro,sun))-max(0.,dot(n,sun));
 pale*=.94+.10*broad+.075*(grain-.5)+.32*(scan.r-.50)+relief*(.34*light-.063*(1.-scan.a));
 return mix(col,pale,min(1.,valid*1.13)*gate*.90);
}
`;
