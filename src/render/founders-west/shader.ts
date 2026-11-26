// Authored opaque Three.js west façade. Preserves the original two triangles.
const ATTR='varying vec2 uv2d;';
const POS='wp=p.xyz;';
const HEAD='float k=clamp(dot(n,normalize(vec3(-.60,.74,-.31))),0.,1.);';
const LIGHT='\n c*=.61+.51*k;\n';
const END='gl_FragColor=vec4(mix(c,vec3(.56,.68,.72),mist),1.);';
const code=`
 flat varying float foundersWestOwner;
 uniform float foundersWestGain;
 float fWestAA(vec2 size2){
   return max(.025,.43*length(size2));
 }
 float fWestMask(float signedDistance,float aa){
   return 1.-smoothstep(-aa,aa,signedDistance);
 }
 float fWestLine(float x,float width,float aa){
   return 1.-smoothstep(max(0.,width-aa),width+aa,abs(x));
 }
 float fWestArch(float x,float y,float halfWidth,float spring,float rise,float base){
   float cap=length(vec2(x/halfWidth,max(0.,y-spring)/rise))-1.;
   return max(base-y,cap*min(halfWidth,rise));
 }
 vec3 fWestShell(vec2 q,vec2 footprint,float d,vec3 n,vec3 p){
   // Any measured-looking proportions here deliberately match only the
   // artist's approximate normalized three-bay layout, not photogrammetry.
   float a=max(fWestAA(footprint),.037);
   float wash=.042*sin(q.x*.96+q.y*.64)+.047*sin(q.y*1.19-q.x*.39);
   vec3 brick=vec3(.293,.119,.091)*(1.+wash);
   float grain=1.-smoothstep(.018,.15,max(footprint.x,footprint.y));
   if(grain>0.){
     vec2 cell=q/vec2(.245,.076);
     float row=floor(cell.y),s=cell.x+mod(row,2.)*.5;
     float mortar=max(fWestLine(fract(s+.5)-.5,.065,footprint.x/.245*.32),
       fWestLine(fract(cell.y+.5)-.5,.082,footprint.y/.076*.29));
     float firing=fract(sin(dot(vec2(floor(s),row),vec2(12.9898,78.233)))*43758.5453);
     brick=mix(brick*(1.+(firing-.5)*.17*grain),vec3(.238,.188,.166),mortar*.41*grain);
   }
   brick*=.88+.12*smoothstep(2.3,3.25,q.y);
   vec3 endWall=brick;
   for(int i=0;i<3;i++){
     float mid=i==1?1.:0.;
     float centre=i==0?.168:(i==1?.492:.813);
     float width=i==0?.222:(i==1?.242:.218);
     float x=q.x-centre*19.132497787475586,hw=width*19.132497787475586*.5;
     float openingBase=2.52-.14*mid,upperY=9.43+.37*mid;
     float rise=1.12+.22*mid,spring=upperY-rise;
     float D=fWestArch(x,q.y,hw,spring,rise,openingBase);
     float rim=fWestMask(D-.33,a);
     float mouth=fWestMask(D+.07,a);
     float head=1.-smoothstep(spring-.02,spring+.53,q.y);
     vec3 randHue=vec3(.230,.166,.139)*(0.89+.12*head-.08*clamp(x/hw,-1.,1.));
     endWall=mix(endWall,randHue,rim);
     // Positive width trims and baked optical reveal. No aperture is cut
     // or allowed to carry an actual sky/background depth or alpha.
     float inner=fWestMask(D+.245,a);
     vec3 jamb=mix(vec3(.238,.249,.219),vec3(.385,.398,.343),.47+.27*clamp(x/hw,-1.,1.));
     endWall=mix(endWall,jamb,mouth);
     vec3 v=normalize(cameraPosition-p);
     float viewSky=pow(1.-abs(dot(n,v)),2.);
     float height=smoothstep(3.0,9.9,q.y);
     vec3 glass=mix(vec3(.083,.110,.115),vec3(.174,.222,.215),.69*height+.21*viewSky);
     float westBand=smoothstep(5.43-a,5.43+a,q.y)*(1.-smoothstep(6.89-a,6.89+a,q.y));
     vec3 pane=glass;
     vec3 lowerEdge=vec3(.072,.075,.068);
     float boarded=.95+.035*sin(x*6.1-q.y*4.0)*(1.-smoothstep(.03,.18,max(footprint.x,footprint.y)));
     vec3 spandrel=lowerEdge*boarded*(.89+.17*smoothstep(5.4,6.9,q.y));
     pane=mix(pane,spandrel,westBand);
     // Piecewise broad pale case on the old art's two divided levels,
     // restrained enough to leave the three dark opaque bands legible.
     float sash=fWestLine(x,.078,max(.05,footprint.x*.36))*(1.-westBand);
     float highTransom=fWestLine(q.y-7.34,.11,max(.04,footprint.y*.37));
     float lowTransom=fWestLine(q.y-4.02,.078,max(.04,footprint.y*.39));
     float seam=max(sash,max(lowTransom,highTransom))*.88;
     pane=mix(pane,vec3(.390,.416,.363),seam);
     pane*=.80+.20*smoothstep(0.,.70,abs(x)-hw+1.05);
     endWall=mix(endWall,pane,inner);
   }
   return endWall;
 }`;
const once=(s:string,k:string)=>s.split(k).length===2;
export function patchFoundersWestWall(v:string,f:string) {
 if(![ATTR,POS].every(x=>once(v,x))||![ATTR,HEAD,LIGHT,END].every(x=>once(f,x)))return;
 if(v.includes('foundersWestOwner')||f.includes('foundersWestOwner'))return;
 const grad=`
 vec2 westDF=vec2(0.);
 if(foundersWestGain>0.)westDF=fwidth(vec2(uv2d.x,wp.y));
 `;
 const local=`
 float westGate=0.;
 if(foundersWestOwner>.5&&gl_FrontFacing&&roof<.5&&foundersWestGain>0.&&d<510.){
   westGate=clamp(foundersWestGain,0.,1.)*(1.-smoothstep(330.,510.,d));
   westGate*=smoothstep(.10,.47,uv2d.x)*smoothstep(.10,.47,19.132497787475586-uv2d.x);
   westGate*=smoothstep(2.10,2.44,wp.y)*(1.-smoothstep(13.82,14.18,wp.y));
   if(westGate>0.)c=mix(c,fWestShell(vec2(uv2d.x,wp.y),westDF,d,n,wp),westGate);
 }
 `;
 const vb=v.replace(ATTR,'flat varying float foundersWestOwner;'+ATTR)
  .replace(POS,POS+'foundersWestOwner=(gl_VertexID>=23004&&gl_VertexID<23010)?1.:0.;');
 const fb=f.replace(ATTR,code+'\n'+ATTR).replace(HEAD,HEAD+grad).replace(LIGHT,local+LIGHT);
 return {vertexShader:vb,fragmentShader:fb};
}
