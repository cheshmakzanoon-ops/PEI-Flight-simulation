import * as T from 'three';

export type BeaconPaint='ochre'|'fret'|'sash'|'trim'|'slate'|'frame'|'brick'|'deck'|'foundation'|'glass'|'zinc'|'interior'|'skirt';
const colors:Record<BeaconPaint,number>={ochre:0xc59d57,fret:0xc9a358,sash:0x663739,trim:0x69746a,slate:0x63676e,frame:0x889185,brick:0x934f44,deck:0x79827b,foundation:0x504b44,glass:0x727e8a,zinc:0x798586,interior:0x292725,skirt:0x5c3034};
export const beaconsfieldPaints=Object.freeze(Object.keys(colors) as BeaconPaint[]);
const trimFamily=new Set<BeaconPaint>(['trim','sash','fret','frame','zinc','foundation']);
const gridNoise=`float rando(vec2 xy){ vec3 p=fract(vec3(xy.xyx)*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
float aggregate(vec2 uv){vec2 d=floor(uv),v=fract(uv);v=v*v*(3.-2.*v);return mix(mix(rando(d),rando(d+vec2(1,0)),v.x),mix(rando(d+vec2(0,1)),rando(d+vec2(1,1)),v.x),v.y);}`;
export function finishBeaconsfieldMaterial(kind:BeaconPaint){
 const raw=new T.MeshStandardMaterial({color:colors[kind], roughness:kind==='glass'?.30:kind==='zinc'?.61:kind==='slate'?.74:.82, metalness:kind==='zinc'?.19:0});
 if(['ochre','slate','deck','brick','glass','skirt','foundation'].includes(kind)||trimFamily.has(kind)){
   raw.customProgramCacheKey=()=>`beaconsfield-appearance-1:${kind}`;
   raw.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vCraftUv; varying vec3 vCraftPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vCraftUv=uv;vCraftPoint=position;');
    let blend='',normals='';
    if(kind==='ochre'){
     blend=`vec2 st=vCraftUv;float f=abs(fwidth(st.y))/.108;float vis=1.-smoothstep(.24,.60,f);float lap=fract(st.y/.108);float seam=(1.-smoothstep(.00,.085,lap))*(.088+.063*aggregate(vec2(st.x*4.,st.y*8.)));float face=(lap-.5)*.086;float drift=(aggregate(st*3.7)-.5)*.085+(aggregate(st*21.)-.5)*.048;diffuseColor.rgb *= 1.+drift+(face-seam)*vis;`;
     normals=`float h = .00145 * vis * lap;vec3 px=dFdx(vViewPosition),pz=dFdy(vViewPosition);vec3 rx=cross(pz,normal), rz=cross(normal,px);float det=dot(px,rx);normal=normalize(max(1.e-6,abs(det))*normal-sign(det)*(dFdx(h)*rx+dFdy(h)*rz));`;
    }else if(kind==='slate') blend=`vec2 st=vCraftUv;float row=floor(st.y/.116),odd=mod(row,2.);vec2 f=vec2(st.x/.235+odd*.50,st.y/.116);vec2 k=floor(f); vec2 q=fract(f);float fac=1.-smoothstep(.24,.60,max(fwidth(f.x),fwidth(f.y)));float grout=(1.-smoothstep(.017,.080,q.y))*.25+(1.-smoothstep(.01,.052,q.x))*.12;float grain=(aggregate(st*12.)-.5)*.112;diffuseColor.rgb*=1.+( (rando(k)-.5)*.23-grout )*fac+grain;`;
    else if(kind==='brick') blend=`vec2 st=vCraftUv;float row=floor(st.y/.073);vec2 f=vec2(st.x/.217+mod(row,2.)*.5,st.y/.073),q=fract(f);float grid=1.-smoothstep(.018,.09,min(q.x,q.y));float vis=1.-smoothstep(.2,.53,max(fwidth(f.x),fwidth(f.y)));diffuseColor.rgb=mix(diffuseColor.rgb*(.84+.29*rando(floor(f))),vec3(.20,.139,.115),grid*vis*.83);`;
    else if(kind==='deck') blend=`vec2 st=vCraftUv;float j=fract(st.x/.137);float marks=(1.-smoothstep(.006,.075,j))*(1.-smoothstep(.23,.58,fwidth(st.x)/.137));diffuseColor.rgb*=1.+(aggregate(st*4.)-.5)*.16-.15*marks;`;
    else if(kind==='skirt'){
     blend=`vec2 st=vCraftUv;vec2 uv=vec2(st.x+st.y,st.x-st.y)*12.;vec2 q=abs(fract(uv)-.5);float w=max(fwidth(uv.x),fwidth(uv.y));float l=1.-smoothstep(.14,.22,min(q.x,q.y));float crisp=1.-smoothstep(.18,.76,w);diffuseColor.rgb *= mix(.74, .51+.49*l, crisp)+.08*(aggregate(st*5.)-.5);`;
    }else if(kind==='foundation'){
     blend=`vec2 st=vCraftUv;float aggregateTone=aggregate(st*4.6);float row=floor(st.y/.225);vec2 f=vec2(st.x/.533+.53*mod(row,2.),st.y/.225),q=fract(f+vec2(.012,.029)*(aggregateTone-.5));float calm=1.-smoothstep(.21,.6,max(fwidth(f.x),fwidth(f.y)));float joint=(1.-smoothstep(.012,.065,min(q.x,q.y)))*calm;diffuseColor.rgb*=.91+.15*aggregateTone+(.15*aggregate(floor(f)*1.43)-.08)*calm-.13*joint;`;
    }else if(kind==='glass'){
      blend=`vec3 nn=normalize(vNormal), v=normalize(vViewPosition);vec3 r=reflect(-v,nn);vec3 d=transpose(mat3(viewMatrix))*r;float sky=smoothstep(-.28,.63,d.y);float fr=.052+.948*pow(1.-max(0.,dot(nn,v)),5.);float wav=.65+.35*aggregate(d.xz*8.5);vec3 reflection=mix(vec3(.042,.071,.055),vec3(.44,.63,.79),sky)*wav; diffuseColor.rgb=vec3(.024,.020,.018);`;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance += reflection * (.20+fr*.48);');
    }else blend=`float grain=(aggregate(vCraftUv*5.3)-.5)*.09+(aggregate(vCraftUv*19.)-.5)*.032; diffuseColor.rgb*=1.+grain;`;
    shader.fragmentShader='varying vec2 vCraftUv; varying vec3 vCraftPoint;\n'+gridNoise+'\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+blend).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+normals);
   };
 }
 return raw;
}
