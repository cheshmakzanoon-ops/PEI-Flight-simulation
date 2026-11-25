// Original optics for mapped coastal marsh over existing authoritative land.
// Dated footprint masks do not establish tide, water level, vegetation census,
// or any modification to physical contact.
export const marshSurfaceGLSL=/*glsl*/`
 uniform sampler2D marshMap;
 uniform vec4 marshBounds;
 uniform float marshGain;
 float marshWeight(vec2 p,float distanceM,float coast){
  if(marshGain<=.0001||coast<=28.||distanceM>=390.)return 0.;
  if(any(lessThanEqual(p,marshBounds.xy))||any(greaterThanEqual(p,marshBounds.zw)))return 0.;
  vec2 uv=(p-marshBounds.xy)/(marshBounds.zw-marshBounds.xy);
  return marshGain*texture2D(marshMap,uv).r*
     smoothstep(28.,42.,coast)*(1.-smoothstep(215.,390.,distanceM));
 }
 float leaningDuff(vec2 p,float footprint){
  if(footprint>.36)return 0.;
  vec2 flow=vec2(noise(p*.27+vec2(8.3,15.7)),noise(p*.34+vec2(1.8,-19.5)))-.5;
  vec2 q=(p+flow*1.15)*vec2(2.5,4.3);
  vec2 cell=floor(q);vec2 f=fract(q)-.5;
  float seed=noise(cell*.83+17.2),birth=noise(cell*.921+vec2(31.6,12.8));
  if(birth<.32)return 0.;
  float phi=(seed-.5)*1.54+.48*noise(p*.226),len=.17+.16*birth;
  f-=vec2(seed-.5,birth-.54)*.40;
  vec2 r=vec2(f.x*cos(phi)-f.y*sin(phi),f.x*sin(phi)+f.y*cos(phi));
  float bod=1.-smoothstep(len*.40,len,abs(r.x));
  float halfWidth=.019+.045*seed;
  float aa=clamp(footprint*1.65,.022,.13);
  float h=1.-smoothstep(max(0.,halfWidth-aa),halfWidth+aa,abs(r.y+.31*r.x*r.x));
  return (h*bod*(.44+seed*.54)-.035)*(1.-smoothstep(.061,.31,footprint));
 }
 void marshOptics(inout vec3 col,inout vec3 n,vec3 world,float coast,float d){
  vec2 q=world.xz;
  vec2 dx=dFdx(q),dy=dFdy(q);
  float pixelM=max(length(dx),length(dy));
  float mixWeight=marshWeight(q,d,coast);
  if(mixWeight<=.002||n.y<.72)return;
  // Broad damp/matted differences break up solid blocks without claiming
  // the positions of tidal channels or individual habitat boundaries.
  vec2 p=q+2.35*vec2(noise(q*.051+vec2(17.,6.)),noise(q*.062+vec2(39.,-6.)));
  float low=noise(p*vec2(.12,.095))* .67 +noise(p*.251+vec2(23.,1.))* .33;
  float damps=smoothstep(.29,.78,low);
  vec2 slope=vec2(.81*p.x+.586*p.y,-.586*p.x+.81*p.y);
  float resolved=1.-smoothstep(.22,1.75,pixelM);
  float stands=noise(slope*vec2(.41,.76)+vec2(49.,12.));
  float tuft=(stands-.5)*.24*resolved;
  float softMat=1.-smoothstep(.031,.22,pixelM);
  float blades=(noise(slope*vec2(7.9,19.6)+vec2(15.,21.))-.5)*.35*softMat*
    smoothstep(.25,.72,stands);
  float Y=dot(col,vec3(.2126,.7152,.0722));
  vec3 warm=Y*vec3(1.19,1.13,.71);
  vec3 dryOlive=Y*vec3(.88,1.13,.57);
  vec3 moisture=Y*vec3(.68,.87,.57);
  vec3 styled=mix(mix(warm,dryOlive,smoothstep(.27,.72,stands)),moisture,.76*damps);
  float mat=leaningDuff(slope+vec2(1.6,5.1),pixelM)*(.16+.23*stands);
  vec3 straw=Y*vec3(1.34,1.15,.70);
  styled=(mix(styled,col,.30)+vec3(.006,.011,.002))*(1.+tuft+blades);
  styled+=mix(vec3(.017,.019,.007),straw,clamp(stands,0.,1.))*mat;
  col=mix(col,styled,mixWeight*.76);
  // Only unresolved light detail changes; all elevation and contacts stay stock.
  float closeDetail=mixWeight*softMat* .064;
  vec2 normals=(vec2(noise(slope*vec2(5.4,8.1)+vec2(6.,8.)),noise(slope*vec2(5.6,7.3)+vec2(18.,-5.)))-.5)*closeDetail;
  vec3 bend=vec3(normals.x,0.,normals.y);n=normalize(n+bend-n*dot(n,bend));
 }
`;
