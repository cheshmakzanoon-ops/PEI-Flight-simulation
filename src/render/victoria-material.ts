/** Local, entirely authored brick/limestone/joinery finish. Sky reflection
 * uses the scene's existing licensed sky, not any streetscape photograph. */
export const victoriaMaterialGLSL=`
 uniform sampler2D victoriaSky;
 float vRowHash(vec2 p){
  vec3 q=fract(vec3(p.xyx)*vec3(.1031,.11369,.0973));
  q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
 }
 float vRowNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(vRowHash(i),vRowHash(i+vec2(1,0)),f.x),
             mix(vRowHash(i+vec2(0,1)),vRowHash(i+vec2(1,1)),f.x),f.y);
 }
 vec3 vRowReflection(vec3 r,float rough){
  vec2 uv=vec2(.5+atan(r.z,r.x)*.159154943+.512,.5+asin(clamp(r.y,-.14,1.))*.3183099);
  vec2 a=dFdx(uv),b=dFdy(uv);a.x-=floor(a.x+.5);b.x-=floor(b.x+.5);
  vec3 sky=textureGrad(victoriaSky,uv,a*rough,b*rough).rgb;
  return mix(vec3(.219,.226,.211),sky,smoothstep(-.13,.255,r.y));
 }
 void shadeVictoria(inout vec3 c,vec2 uv,vec3 p,vec3 n,float style,float role,float k,float d){
  vec3 eye=normalize(cameraPosition-p);
  float px=length(fwidth(p)),close=1.-smoothstep(.016,.19,px);
  float m=vRowNoise(uv*.72+p.xz*.043), weather=vRowNoise(uv*.29+p.xz*.0095);
  float h=vRowNoise(vec2(uv.x*.93,uv.y*.18)+p.xz*.079);
  float rough=vRowNoise(uv*82.+vec2(19.1,1.5));
  float toe=1.-smoothstep(.22,1.55,uv.y);
  if(role<.5){
   vec2 lp=uv/vec2(.225,.070);
   float row=floor(lp.y);
   lp.x+=mod(row,2.)*.50;
   float single=vRowHash(floor(lp));
   float edges=max(band(lp.x,.039,.086),band(lp.y,.032,.142));
   vec3 mortar=mix(vec3(.151,.124,.094),vec3(.289,.252,.201),weather);
   float pocket=vRowNoise(vec2(uv.x*.21,uv.y*.82)+p.xz*.032);
   c*=1.+.23*(m-.5)+.31*close*(single-.5)+.13*close*(rough-.5)-.14*toe*.77;
   c*=.91+.17*pocket+.06*smoothstep(.10,.78,fract(lp.y))*close;
   c=mix(c,mortar,edges*(.22+.40*close));
   c*=.955+.083*h;
  }else if(role<31.5){
   vec2 u=uv/vec2(2.28,6.47);u.y+=.5*mod(floor(u.x),2.);
   float seams=max(band(u.x,.022,.047),band(u.y,.010,.026));
   float patches=vRowNoise(uv*.21),grain=vRowNoise(uv*11.3);
   c*=.83+.25*patches+.08*grain-.20*seams;
   c=mix(c,vec3(.135,.124,.107),.14*(.4+.6*weather));
  }else if(role<32.5){
   c*=.61+.29*weather-.11*band(uv.y/.153,.019,.074);
  }else if(role<33.5){
   float layered=band(uv.y/.376,.045,.088);
   float pore=vRowNoise(uv*22.0+p.xz*.071);
   c*=.72+.31*weather+.14*close*(rough-.5)+.11*close*(pore-.5)-.097*layered;
  }else if(role<34.5){
   // Geometry supplies actual jamb shadow; damp/recessed mineral color
   // adds a diffuse term without an artificial baked sun direction.
   c*=.56+.20*k+.10*weather;
  }else if(role<35.5||role>38.5){
   vec3 reflection=reflect(-eye,n);
   float g=pow(1.-max(0.,dot(eye,n)),4.8);
   vec3 s=vRowReflection(reflection,2.5+2.9*(1.-close));
   bool shop=role>38.5;
   float glassMottle=vRowNoise(uv*vec2(2.2,1.1)+vec2(.07,3.7));
   vec3 inner=mix(vec3(.026,.032,.033),vec3(.099,.082,.060),glassMottle*(shop?.66:.38));
   if(shop)inner*=.78+.45*smoothstep(.5,3.1,uv.y)+.11*close*rough;
   c=mix(inner,s,clamp((shop?.16:.095)+.58*g+.105*weather,0.,.75));
   c*=vec3(.88,.96,.93);
  }else if(role<36.5){
   c*=.73+.24*weather+.12*close*m;
   c+=vec3(.033,.031,.026)*pow(max(0.,dot(n,normalize(eye+vec3(-.6,.74,-.31)))),18.);
  }else if(role>37.5){
   float grain=vRowNoise(uv*vec2(17.4,1.82));
   float wear=vRowNoise(uv*1.19);
   c*=.67+.20*weather+.14*wear+.12*grain*close;
   c+=vec3(.023,.023,.019)*pow(max(0.,dot(n,normalize(eye+vec3(-.6,.74,-.31)))),16.);
  }else{
   c*=.70+.22*weather+.14*close*(rough-.5)-toe*.085;
  }
 }
`;
