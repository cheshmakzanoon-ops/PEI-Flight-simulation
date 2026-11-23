/** Original materials for the fitted Water Street shells. No facade image
 * or official photo is bundled. Glass samples the existing CC0 sky dome. */
export const waterStreetMaterialGLSL=`
 uniform sampler2D waterStreetSky;
 float wStreetHash(vec2 p){
  vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
  q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
 }
 float wStreetNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(wStreetHash(i),wStreetHash(i+vec2(1,0)),f.x),
             mix(wStreetHash(i+vec2(0,1)),wStreetHash(i+vec2(1,1)),f.x),f.y);
 }
 vec3 wStreetReflection(vec3 v,float broad){
  float u=.5+atan(v.z,v.x)*.159154943+.512;
  float h=.5+asin(clamp(v.y,-.025,1.))*.3183099;
  // Explicit gradient avoids dragging a blurred seam through storefront glass.
  vec2 uv=vec2(u,h),a=dFdx(uv),b=dFdy(uv);a.x-=floor(a.x+.5);b.x-=floor(b.x+.5);
  vec3 cold=textureGrad(waterStreetSky,uv,a*broad,b*broad).rgb;
  return mix(vec3(.30,.35,.34),cold,smoothstep(-.055,.09,v.y));
 }
 void shadeWaterStreet(inout vec3 c,vec2 uv,vec3 p,vec3 n,float style,float role,float k,float fine,float d){
  float px=length(fwidth(p)),close=1.-smoothstep(.10,.56,px);
  vec2 xz=p.xz;
  vec3 toEye=normalize(cameraPosition-p);
  float large=wStreetNoise(floor(xz*.027)+vec2(.34,.69));
  float m=wStreetNoise(xz*.40+uv*.14),weather=wStreetNoise(uv*.69+vec2(large*5.7,1.9));
  float porous=wStreetNoise(uv*63.+vec2(19.3,7.7));
  float toe=1.-smoothstep(.45,1.4,uv.y);
  if(role<.5){
   bool masonry=style!=14.;
   if(masonry){
    vec2 brick=uv/vec2(.214,.069);
    float row=floor(brick.y);
    brick.x+=mod(row,2.)*.5;
    float individual=wStreetHash(floor(brick));
    float vert=band(brick.x,.046,.082),horiz=band(brick.y,.037,.132);
    float grout=max(vert,horiz)*fine;
    c*=1.+.19*(m-.5)+.21*(individual-.5)*close+.09*(porous-.5)*close;
    vec3 mortar=mix(vec3(.129,.115,.092),vec3(.213,.189,.151),weather);
    c=mix(c,mortar,grout*.65);
    c*=1.-.115*toe*(.45+.55*weather);
   }else{
    // Painted mineral cladding on the selected modern shop-front zones;
    // quiet sidelight and damp colour variations, no made-up shop signs.
    float lap=band(uv.y/.157,.065,.134),ends=band(uv.x/2.44,.043,.058);
    c*=1.+.17*(m-.5)+.12*(weather-.5)-fine*(.16*lap+.063*ends);
    c*=1.-toe*.095;
   }
  }else if(role<21.5){
   float stains=wStreetNoise(uv*.176),grit=wStreetNoise(uv*4.64);
   float seam=band(uv.x/1.91,.02,.031)+band((uv.y+floor(uv.x/1.91)*1.47)/5.77,.014,.026);
   vec3 dust=mix(vec3(.091,.079,.059),vec3(.129,.122,.108),stains);
   c=mix(c,dust,.20+.12*weather);
   c*=1.+.29*(stains-.5)+.16*(grit-.5)*fine-.26*seam;
  }else if(role<22.5){
   c*=.80+.11*m-.11*band(uv.x/1.8,.032,.073);
  }else if(role<23.5){
   float facing=max(0.,dot(toEye,n));
   c*=.69+.23*k+.15*weather+.065*close*(porous-.5);
   c+=vec3(.032,.028,.022)*pow(1.-facing,2.)*.34;
  }else if(role<24.5){
   vec3 v=reflect(-toEye,n);
   float grazing=pow(1.-max(.0,dot(toEye,n)),4.1);
   vec3 glare=wStreetReflection(v,1.7+3.5*(1.-fine));
   vec3 shadowedRoom=mix(vec3(.036,.040,.039),vec3(.095,.093,.072),weather*.70);
   // Transparent-looking dark recess plus front-glass Fresnel; no invented interiors.
   c=mix(shadowedRoom,glare,clamp(.16+.63*grazing+.055*weather,0.,.8));
   c*=vec3(.86,.93,.90);
  }else if(role<25.5){
   c*=.63+.24*weather+.12*close*porous;
  }else{
   c*=.82+.27*weather;
   vec3 s=normalize(vec3(-.60,.74,-.31));
   c+=vec3(.067,.063,.056)*pow(max(0.,dot(n,normalize(toEye+s))),15.);
  }
 }
`;
