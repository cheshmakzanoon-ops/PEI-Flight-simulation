import * as T from 'three';
export const paints={
 whitewood:0xe1e0d0, soffit:0xc1c6b7, whiteframe:0xdddcd2,
 green:0x31554b, greenTrim:0x2d4b3c, roof:0x344e42, porchRoof:0x626e60,
 glass:0x4d635f, door:0x253e32, dark:0x292a27, hardware:0x646253,
 brick:0x914e3d, capstone:0xaa8373, stone:0x77725f, threshold:0x93948c, lawn:0x758449,
} as const;
export type GreenPaint=keyof typeof paints;
const noise=`
 float ggHash(vec2 p){vec3 g=fract(vec3(p.xyx)*.1031);g+=dot(g,g.yzx+33.33);return fract((g.x+g.y)*g.z);}
 float ggNoise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(ggHash(a),ggHash(a+vec2(1,0)),f.x),mix(ggHash(a+vec2(0,1)),ggHash(a+vec2(1)),f.x),f.y);}
`;
export function greenPaint(k:GreenPaint){
 const m=new T.MeshStandardMaterial({color:paints[k],roughness:k==='glass'?.27:k==='hardware'?.68:k==='greenTrim'?.63:.81,metalness:k==='hardware'?.31:0});
 m.customProgramCacheKey=()=>`green-gables-original-1:${k}`;
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 gUv;varying vec3 gArch;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n gUv=uv;gArch=position;');
  let src='vec2 q=gUv;float relief=0.;diffuseColor.rgb*=.955+.095*ggNoise(q*8.);',emit='';
  if(k==='whitewood'||k==='green'){
   src=`vec2 q=gUv; float row=floor(q.y/.119),x=q.x/.174+.49*mod(row,2.);
    vec2 uv=fract(vec2(x,q.y/.119)); float ww=max(fwidth(q.x),fwidth(q.y));
    float show=1.-smoothstep(.035,.101,ww);
    float overlap=(1.-smoothstep(.006,.087,uv.y));
    float joint=(1.-smoothstep(.006,.061,min(uv.x,1.-uv.x)))*(.3+.7*(1.-uv.y));
    vec2 tile=vec2(floor(x),row);
    float variation=(ggHash(tile)-.5)*.116+(ggNoise(q*2.6)-.5)*.11+(ggNoise(vec2(q.x*53.,q.y*4.))-.5)*.046;
    float stain=(1.-smoothstep(.0,.72,gArch.y))*(.052+.068*ggNoise(vec2(q.x*4.6,q.y*9.)));
    diffuseColor.rgb*=1.+variation-show*(.109*overlap+.123*joint+.035*uv.y)-stain;
    float relief=show*(.0022*(1.-uv.y)-.00125*joint);
   `;
  }else if(k==='roof'||k==='porchRoof'){
   src=`vec2 q=gUv;float ru=q.y/.162,rv=q.x/.285+.499*mod(floor(ru),2.);
    vec2 f=fract(vec2(rv,ru));float w=max(fwidth(q.x),fwidth(q.y)),v=1.-smoothstep(.033,.119,w);
    float cut=(1.-smoothstep(.007,.086,f.y))*.156+(1.-smoothstep(.001,.032,min(f.x,1.-f.x)))*.131;
    diffuseColor.rgb*=1.+(.128*(ggHash(floor(vec2(rv,ru)))-.5)-cut)*v+(.190*(ggNoise(q*37.)-.5))+.059*(ggNoise(q*2.)-.5);
    float relief=.0024*v*(1.-f.y)+.0011*(ggNoise(q*63.)-.5);
   `;
  }else if(k==='glass'){
   src=`vec2 q=gUv;vec3 n=normalize(vNormal),v=normalize(vViewPosition),dir=transpose(mat3(viewMatrix))*reflect(-v,n);
    float fres=.038+.962*pow(1.-max(0.,dot(n,v)),5.);
    float sky=smoothstep(-.13,.68,dir.y),field=ggNoise(dir.xz*8.4),cloud=ggNoise(dir.xz*(5.1/max(.13,dir.y+.45)));
    float screenDir=.49+.51*smoothstep(.11,.65,field);
    vec3 lit=mix(vec3(.082,.121,.085)*screenDir,vec3(.30,.44,.54)*(.82+.18*cloud),sky);
    vec3 reflectPane=lit*(.24+.54*fres);
    diffuseColor.rgb=vec3(.020,.022,.017)*(.82+.18*ggNoise(q*3.1));float relief=0.;
   `;emit='totalEmissiveRadiance+=reflectPane;';
  }else if(k==='brick'||k==='stone'){
   src=`vec2 q=gUv;vec2 metre=kBrick>.5?vec2(.205,.067):vec2(.384,.242);
    vec2 m=q/metre;m.x+=.5*mod(floor(m.y),2.);vec2 f=fract(m);
    float seam=min(min(f.x,1.-f.x)*metre.x,min(f.y,1.-f.y)*metre.y);
    float good=1.-smoothstep(.02,.098,max(fwidth(q.x),fwidth(q.y)));
    float b=smoothstep(.003,.010,seam);float more=ggHash(floor(m)),rough=ggNoise(q*31.);
    diffuseColor.rgb*=.84+.301*more+.112*rough-.207*good*(1.-b);
    float relief=good*(.0024*b+.0014*rough);
   `.replace('kBrick',k==='brick'?'1.':'0.');
  }else if(k==='lawn'){
   src=`vec2 q=gUv;float spread=ggNoise(q*.29),fine=ggNoise(q*17.)*.57+ggNoise(q*41.)*.43;
   float greens=ggNoise(q*.79);diffuseColor.rgb*=.72+spread*.32+fine*.28+greens*.09;
   float relief=.009*(fine-.55);
   `;
  }else if(k==='greenTrim'||k==='door'){
   src=`vec2 q=gUv;float grain=ggNoise(vec2(q.x*49.,q.y*4.3));float broad=ggNoise(q*2.8);
   diffuseColor.rgb*=.91+.124*grain+.058*broad;float relief=(grain-.5)*.00092;`;
  }
  shader.fragmentShader='varying vec2 gUv;varying vec3 gArch;\n'+noise+shader.fragmentShader
    .replace('#include <map_fragment>','#include <map_fragment>\n'+src)
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+emit)
    .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     { vec3 gg1=dFdx(vViewPosition),gg2=dFdy(vViewPosition),gGu=cross(gg2,normal),gGv=cross(normal,gg1);
       float ggD=dot(gg1,gGu);if(abs(ggD)>1.e-8)normal=normalize(abs(ggD)*normal-sign(ggD)*(dFdx(relief)*gGu+dFdy(relief)*gGv));
     }
    `);
 };
 return m;
}
