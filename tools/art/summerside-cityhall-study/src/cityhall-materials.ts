import * as T from 'three';
export const palette={
 brick:0xa4604b,arch:0xa8614b,foundation:0x786853,ashlar:0xaa997d,
 slate:0x736e63,membrane:0x4b4b44,copper:0x69917a,copperBright:0x8aa28b,
 rail:0x36383a,aluminum:0x686d67,glass:0x63767d,sash:0x353a35,clock:0x85897c,
 hands:0x292e2b,shadow:0x26241f,wood:0x404e49,pavement:0x777672,lawn:0x777958,
} as const;
export type Colour=keyof typeof palette;
const noise=`
float bHash(vec2 x){vec3 h=fract(vec3(x.xyx)*.1031);h+=dot(h,h.yzx+33.33);return fract((h.x+h.y)*h.z);}
float bNoise(vec2 uv){vec2 q=floor(uv),f=fract(uv);f=f*f*(3.-2.*f);return mix(mix(bHash(q),bHash(q+vec2(1,0)),f.x),mix(bHash(q+vec2(0,1)),bHash(q+vec2(1)),f.x),f.y);}
`;
export function makeMaterial(k:Colour){
 const glass=k==='glass',cu=k==='copper'||k==='copperBright',m=new T.MeshStandardMaterial({color:palette[k],roughness:glass?.279:cu?.55:k==='rail'?.71:.829,metalness:cu?.26:k==='rail'?.31:0});
 m.customProgramCacheKey=()=>`summer-cityhall-A/${k}`;
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 opUv; varying vec3 opPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n opUv=uv; opPoint=position;');
  const grain='vec2 uv=opUv;float relief=0.;';let info='',emit='';
  if(k==='brick'||k==='arch'){
   info=`
    vec2 uv=opUv;float depth=max(abs(fwidth(uv.x)),abs(fwidth(uv.y)));
    float y=uv.y/.077;float row=floor(y),head=step(4.5,mod(row,6.));
    float dx=mix(.228,.112,head),x=uv.x/dx+mod(row,2.)*.5;
    vec2 ij=vec2(floor(x),row);vec2 s=fract(vec2(x,y));
    float edge=min(min(s.x,1.-s.x)*dx,min(s.y,1.-s.y)*.077);
    float anti=1.-smoothstep(.022,.068,depth);
    float lip=smoothstep(.0041,.0084,edge);
    float shade=bNoise(uv*.67)*.25+(bHash(ij)-.5)*.24+(bNoise(uv*52.)-.5)*.13;
    vec3 mortar=mix(vec3(.176,.137,.109),vec3(.220,.187,.141),bNoise(uv*8.));
    diffuseColor.rgb=mix(diffuseColor.rgb*(.84+shade),mortar,anti*(1.-lip)*.90);
    float damp=(bNoise(vec2(uv.x*1.59,uv.y*.58))-.5)*.23;
    diffuseColor.rgb*=1.+damp;
    float relief=anti*(lip*.0021+(bNoise(uv*52.)-.5)*.0015);
   `;
  }else if(k==='foundation'||k==='ashlar'){
   info=`
    vec2 uv=opUv;float row=floor(uv.y/.245),vx=uv.x/.435+.46*mod(row,2.);
    vec2 s=fract(vec2(vx,uv.y/.245));float seam=min(min(s.x,1.-s.x)*.435,min(s.y,1.-s.y)*.245);
    float aa=1.-smoothstep(.025,.13,max(fwidth(uv.x),fwidth(uv.y)));
    float body=smoothstep(.008,.024,seam);
    float ore=bNoise(uv*5.)*.23+(bNoise(uv*41.)-.5)*.16;
    diffuseColor.rgb*=.88+ore+(bHash(vec2(floor(vx),row))-.5)*.217-aa*(1.-body)*.27;
    float relief=aa*(.009*body+(.0046-abs(.0046*(2.*bNoise(uv*33.)-1.))));
   `;
  }else if(k==='slate'){
   info=`
    vec2 uv=opUv;float dy=uv.y/.246;float dx=uv.x/.233+.5*mod(floor(dy),2.);vec2 s=fract(vec2(dx,dy));
    float edge=min(s.y*.246,min(s.x,1.-s.x)*.233);float vis=1.-smoothstep(.045,.151,max(fwidth(uv.x),fwidth(uv.y)));
    float tone=(bHash(floor(vec2(dx,dy)))-.5)*.154+(bNoise(uv*4.5)-.5)*.131;
    diffuseColor.rgb*=.94+tone*vis+(bNoise(uv*27.)-.5)*.13-.22*vis*(1.-smoothstep(.001,.011,edge));
    float relief=vis*(.003*s.y+.001*(bNoise(uv*19.)-.5));
   `;
  }else if(cu){
   info=`
    vec2 uv=opUv;float g1=bNoise(uv*1.6),g2=bNoise(uv*12.);float streak=bNoise(vec2(uv.x*9.8,uv.y*.69));
    float oxid=smoothstep(.09,.89,.34*g1+.22*g2+.44*streak);
    vec3 dark=vec3(.108,.163,.121),green=diffuseColor.rgb*.94,crust=vec3(.236,.344,.268);
    diffuseColor.rgb=mix(mix(dark,green,oxid),crust,smoothstep(.65,.98,g1)*.28)*( .93+.09*g2);
    float relief=(g2-.5)*.0025;
   `;
  }else if(glass){
   info=`
    vec2 uv=opUv;vec3 n=normalize(vNormal),v=normalize(vViewPosition),rv=transpose(mat3(viewMatrix))*reflect(-v,n);
    float up=smoothstep(-.42,.61,rv.y),fr=.043+.957*pow(1.-max(dot(n,v),0.),5.);
    vec3 reflection=mix(vec3(.057,.071,.070),vec3(.28,.39,.48),up)*(.79+.21*bNoise(rv.xz*9.));
    vec3 reflected=reflection*(.21+.62*fr);
    diffuseColor.rgb=vec3(.025,.034,.031)*(1.+.31*bNoise(uv*1.4));float relief=0.;
   `;
   emit='totalEmissiveRadiance+=reflected;';
  }else if(k==='pavement'||k==='lawn'||k==='membrane'){
   info=`
     vec2 uv=opUv;float fine=bNoise(uv*38.),macro=bNoise(uv*.64);
     diffuseColor.rgb*=.81+.23*macro+.24*fine;float relief=(fine-.5)*.003;
   `;
  }else info=grain+'diffuseColor.rgb*=.91+.15*bNoise(uv*6.)+.048*bNoise(uv*23.);';
  shader.fragmentShader='varying vec2 opUv; varying vec3 opPoint;\n'+noise+shader.fragmentShader
   .replace('#include <map_fragment>','#include <map_fragment>\n'+info)
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+emit)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 d1=dFdx(vViewPosition),d2=dFdy(vViewPosition),r1=cross(d2,normal),r2=cross(normal,d1);
    float det=dot(d1,r1);if(abs(det)>1.e-8)normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2));
   `);
 };
 return m;
}
