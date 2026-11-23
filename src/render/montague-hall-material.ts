/** Original stained wood shingles, weathered concrete and flat-roof optics. */
export const montagueHallMaterialGLSL=`
 uniform sampler2D montagueSky;
 float hallHash(vec2 p){
  vec3 h=fract(vec3(p.xyx)*vec3(.1031,.10439,.0973));
  h+=dot(h,h.yzx+33.33);return fract((h.x+h.y)*h.z);
 }
 float hallNoise(vec2 p){
  vec2 i=floor(p),t=fract(p);t=t*t*(3.-2.*t);
  return mix(mix(hallHash(i),hallHash(i+vec2(1,0)),t.x),mix(hallHash(i+vec2(0,1)),hallHash(i+1.),t.x),t.y);
 }
 void shadeMontagueHall(inout vec3 c,vec2 uv,vec3 p,vec3 normal,float role,float sun){
  vec3 view=normalize(cameraPosition-p);vec2 dp=fwidth(uv);
  float near=1.-smoothstep(.024,.27,length(dp));
  float stain=hallNoise(uv*vec2(.66,.33)+p.xz*.102);
  float dirty=hallNoise(uv*vec2(.11,1.6)+vec2(13.57,2.91));
  float contact=1.-smoothstep(.30,1.40,uv.y);
  if(role<.5){
   vec2 cell=uv/vec2(.159,.138);
   cell.x+=mod(floor(cell.y),2.)*.49;
   float direct=hallHash(floor(cell));
   float seam=band(cell.x,.021,.066),course=band(cell.y,.046,.138);
   vec2 woodGrit=vec2(uv.x*88.,uv.y*13.05);
   float grain=hallNoise(woodGrit+vec2(direct*2.,0.));
   vec3 weather=mix(vec3(.87,.92,.96),vec3(1.08,1.03,.99),stain);
   c*=weather*(.92+.14*stain+.23*(direct-.5)*near+.11*(grain-.5)*near);
   c*=1.-(.29*course+.20*seam)*near-.10*contact*dirty;
   c+=vec3(.029,.022,.016)*band(cell.y,.158,.202)*near;
  }else if(role<40.5){
   float small=hallNoise(uv*13.1),pores=hallNoise(uv*103.);
   float stain1=hallNoise(vec2(uv.x*1.15,uv.y*.22)+vec2(8.7,3.9));
   float lifted=hallNoise(vec2(uv.x*.18,uv.y*1.9)+vec2(9.2,17.));
   c*=.83+.20*stain+.09*small+.125*(pores-.5)*near-.26*contact*(.23+.77*stain1);
   c*=1.-.105*band(uv.y/1.46,.013,.036)*near-.08*lifted;
  }else if(role<41.5){
   float jo=max(band(uv.x/1.53,.022,.048),band(uv.y/4.3,.017,.039));
   c*=.78+.29*stain+.11*hallNoise(uv*7.8)-.17*jo;
  }else if(role<44.5){
   c*=.76+.27*stain+.09*dirty*near;
   c+=vec3(.029,.028,.024)*pow(max(0.,dot(view,normal)),8.)*.21;
  }else if(role<45.5){
   vec3 rr=reflect(-view,normal);
   vec2 u=vec2(.5+atan(rr.z,rr.x)*.159154943+.512,.5+asin(clamp(rr.y,-.12,1.))*.3183099);
   vec2 a=dFdx(u),b=dFdy(u);a.x-=floor(a.x+.5);b.x-=floor(b.x+.5);
   vec3 env=textureGrad(montagueSky,u,a*2.7,b*2.7).rgb;
   env=mix(vec3(.174,.189,.174),env,smoothstep(-.17,.26,rr.y));
   float g=pow(1.-max(0.,dot(view,normal)),4.8);
   float uneven=hallNoise(uv*vec2(.29,.93)+p.xz*.017);
   c=mix(vec3(.042,.047,.044)*(.72+.48*uneven),env,.26+.56*g)*vec3(.94,.98,.97);
  }else c*=.62+.23*sun+.14*stain;
 }
`;
