import { type ShaderMaterial, type Texture } from 'three';
import { project } from '../sim/geo.ts';

export type TownWallOptics=Readonly<{panorama:Texture;gain:{value:number}}>;
export const TOWN_WALL_ATLAS='538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557';
export const TOWN_WALL_MAX_DISTANCE=255;
/** Extra unnormalized I16 vertex datum: conservative centimetre rounding. */
export function townWallVertex(width:number,floor:number,top:number):[number,number,number]{
 if(width===-1)return [-100,0,0];
 const w=Math.floor(width*100),f=Math.ceil(floor*100),e=Math.floor(top*100);
 if(!Number.isFinite(w+f+e)||w<=15||w>32767||f< -32768||f>32767||e< -32768||e>32767)return [0,0,0];
 return [w,f,e];
}
export const townWallRequested=(opts:URLSearchParams)=>opts.has('townWallStudy')&&opts.get('scenery')!=='detail';
export const TOWN_WALL_AREAS=[
 {id:'charlottetown-north',p:project(-63.11965,46.24398),r:390},
 {id:'summerside-centre',p:project(-63.79010,46.39349),r:390},
 {id:'souris-main',p:project(-62.25688,46.35259),r:375},
] as const;

export function townFaceRegion(x:number,z:number):boolean{
 return TOWN_WALL_AREAS.some(({p,r})=>(x-p.x)**2+(z-p.z)**2<r*r);
}
export function townTileRegion(x0:number,z0:number,x1:number,z1:number):boolean{
 return TOWN_WALL_AREAS.some(({p,r})=>x1>=p.x-r&&x0<=p.x+r&&z1>=p.z-r&&z0<=p.z+r);
}

const vertexArm='attribute vec3 townWallFit;varying vec3 townWall;\n';
const varyingArm='varying vec3 townWall; uniform float townWallGain;uniform sampler2D townWallSky;';

export const genericTownWallGLSL=/*glsl*/`
 ${varyingArm}
 float townBand(float a,float b,float x,float w){
  return smoothstep(a-w,a+w,x)*(1.-smoothstep(b-w,b+w,x));
 }
 float townNoise(vec2 q){
  vec2 k=floor(q),f=fract(q);f*=f*(3.-2.*f);
  return mix(mix(warmWindowHash(k),warmWindowHash(k+vec2(1.,0.)),f.x),
      mix(warmWindowHash(k+vec2(0.,1.)),warmWindowHash(k+1.),f.x),f.y);
 }
 float townRepeat(float a,float b,float x,float w){
  return (area(x+w*.5,a,b)-area(x-w*.5,a,b))/w;
 }
 vec3 townWallColour(vec3 wall,vec3 n,vec3 wp,vec2 legacyUV,vec2 pxUV){
  // Dimensions follow the existing wall envelope; absolute elevations grade
  // visually parallel casing within one building. The openings are artistic.
  float W=townWall.x,floorY=townWall.y,top=townWall.z;
  float usableH=top-floorY-.27;
  float x=legacyUV.x,y=wp.y-floorY;
  float side=clamp(.30+W*.047,.38,.95);
  float usable=max(0.,W-2.*side);
  float nCols=clamp(floor(usable/2.54+.23),1.,30.);
  float colWidth=max(.70,usable/nCols);
  const float pitch=2.84;
  float nRows=clamp(floor((usableH+.18)/pitch),0.,28.);
  vec2 grid=vec2((x-side)/colWidth,y/pitch);
  vec2 fw=max(vec2(.001),pxUV/vec2(colWidth,pitch));
  float windowScale=smoothstep(1.48,2.16,W)*step(1.,nRows);
  float footprint=max(pxUV.x,pxUV.y);
  float fine=1.-smoothstep(.11,.82,footprint);
  // Low-contrast authored finish, not an identification of cladding.
  float wear=townNoise(vec2(legacyUV.x,wp.y)*.88+vec2(63.,13.));
  float mineral=townNoise(vec2(legacyUV.x,wp.y)*6.18+vec2(17.,32.));
  float edgeDistance=min(x,W-x);
  float baseShade=1.-smoothstep(.12,1.53,legacyUV.y);
  // Retain the original shell palette. The soft footing/corner cues
  // read at flight height; no invented masonry, trim record or labels.
  wall*=1.-.160*baseShade-.071*(1.-smoothstep(.070,.58,edgeDistance));
  wall*=mix(1.,.960+.081*wear,fine);
  wall*=mix(1.,.975+.054*mineral,1.-smoothstep(.039,.19,footprint));
  float stepCap=smoothstep(.062,.27,top-wp.y);
  wall*=.91+.09*stepCap;
  if(windowScale<=0.)return wall;
  float support=(step(0.,grid.x)*step(0.,grid.y))*(1.-step(nCols,grid.x))*(1.-step(nRows,grid.y))*windowScale;
  if(support<=0.)return wall;
  float x0=.191,x1=.809,y0=.282,y1=.798;
  float outer=townRepeat(x0-.045,x1+.045,grid.x,fw.x)*townRepeat(y0-.031,y1+.032,grid.y,fw.y)*support;
  float glass=townRepeat(x0,x1,grid.x,fw.x)*townRepeat(y0,y1,grid.y,fw.y)*support;
  if(outer<=.0001)return wall;
  vec3 view=normalize(cameraPosition-wp);
  float v=fract(grid.y),u=fract(grid.x);
  vec3 reflected=reflect(-view,n);
  vec2 skyUV=vec2(1.012+atan(reflected.z,reflected.x)*.159154943,
   .5+asin(clamp(reflected.y,.018,1.))*.3183099);
  vec3 s=textureLod(townWallSky,skyUV,3.2).rgb;
  float facing=clamp(dot(n,view),0.,1.);
  float fres=pow(1.-facing,3.4);
  // A small visual recess. The virtual pane can only shrink the surface
  // aperture from this viewing angle; it never cuts/renders real holes.
  vec2 along=vec2(-n.z,n.x);
  vec2 shift=clamp(.108*vec2(dot(view.xz,along),view.y)/max(.28,facing),-.22,.22);
  shift*=fine/vec2(colWidth,pitch);
  vec2 glazed=grid-shift;
  float open=townRepeat(x0,x1,glazed.x,fw.x)*townRepeat(y0,y1,glazed.y,fw.y)*support;
  float pane=min(glass,open);
  float variation=warmWindowHash(floor(grid)+vec2(floor(floorY*2.30),floor(W*.80)));
  float skyShare=mix(.29,.87,smoothstep(.22,.86,v))*(.84+.24*variation);
  float angle=smoothstep(-.14,.19,reflected.y);
  vec3 bounced=mix(vec3(.24,.25,.245),s,.33+.67*angle);
  vec3 lit=vec3(.039,.045,.046)+bounced*skyShare*(.162+.22*fres);
  // Small roughness/lead contrast plus a narrow painted casework edge.
  // The reflection is daylight only and not a view inside a real address.
  vec3 frame=mix(vec3(.147,.144,.132),max(wall*.86,vec3(.10)),.66);
  vec3 reveal=frame*(.60+.08*smoothstep(.4,.7,v));
  vec3 outColor=mix(wall,frame,outer*.87);
  float lintel=townBand(.754,.840,v,fw.y*.47);
  float jamb=townBand(x0,x0+.041,u,fw.x*.46)+townBand(x1-.041,x1,u,fw.x*.46);
  lit*=1.-fine*clamp(.23*lintel+.32*jamb,0.,.45);
  float divider=townRepeat(.481,.518,glazed.x,fw.x)*fine;
  outColor=mix(outColor,reveal,glass*.89);
  outColor=mix(outColor,lit,pane*.98);
  outColor=mix(outColor,frame,pane*divider*.72);
  float sill=townRepeat(.226,.259,grid.y,fw.y)*townRepeat(.137,.863,grid.x,fw.x)*support;
  return outColor+wall*.25*sill*fine;
 }
`;

export function fittedWallMaterial(base:ShaderMaterial,optics:TownWallOptics):ShaderMaterial{
 const oldFrag=base.fragmentShader,oldVert=base.vertexShader;
 const marker=' else if(roof<.5){\n  vec2 grid=uv2d/vec2(2.62,3.08);';
 const stableEnd='  c*=1.-.11*fine*band(uv2d.y*4.5,.0,.18);c*=.81+.19*smoothstep(0.,3.8,uv2d.y);';
 if(!oldFrag.includes(marker)||!oldFrag.includes(stableEnd)||!oldVert.includes('void main(){vec4 p='))return base;
 const m=base.clone();
 m.uniforms={...base.uniforms,townWallGain:optics.gain,townWallSky:{value:optics.panorama}};
 m.vertexShader=oldVert.replace('void main(){vec4 p=',vertexArm+'void main(){townWall=townWallFit*.01;vec4 p=');
 m.fragmentShader=oldFrag.replace(' void main(){',genericTownWallGLSL+'\n void main(){')
    .replace(' float d=distance(wp,cameraPosition)', ' vec2 townPixel=vec2(1.);if(townWallGain>0.)townPixel=vec2(fwidth(uv2d.x),fwidth(wp.y));\n float d=distance(wp,cameraPosition)')
    .replace(stableEnd,stableEnd+`
  if(townWallGain>0.&&abs(townWall.x)>.15&&d<${TOWN_WALL_MAX_DISTANCE.toFixed(1)}){
   float gain=townWallGain*(1.-smoothstep(140.,${TOWN_WALL_MAX_DISTANCE.toFixed(1)},d));
   vec3 fitted=townWall.x<0.?tint*.948:townWallColour(tint,n,wp,uv2d,townPixel);
   c=mix(c,fitted,gain);
  }`);
 return m;
}
