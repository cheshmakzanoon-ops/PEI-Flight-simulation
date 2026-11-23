/** Original woodwork, sheltered paint and bedding, reusing the existing sky reflection. */
export const macdonaldMaterialGLSL=`
 void shadeMacdonald(inout vec3 c,vec2 uv,vec3 p,vec3 n,float role,float sun,float distanceM){
  float near=1.-smoothstep(.037,.33,length(fwidth(uv))),far=1.-smoothstep(48.,580.,distanceM);
  float stain=hallNoise(vec2(uv.x*.46,uv.y*.37)+p.xz*.13);
  float fine=hallNoise(uv*vec2(14.,2.6));
  float dry=hallNoise(vec2(uv.x*.19,uv.y*1.7)+vec2(12.6,8.7));
  if(role<50.5){
    float seam=band(uv.y/.142,.025,.088),edge=band(uv.y/.142,.094,.15);
    float grit=hallNoise(vec2(uv.x*15.5,uv.y*4.45));
    c*=mix(vec3(.85,.91,.93),vec3(1.04,1.03,.99),stain)*(.92+.15*stain+.095*(grit-.5)*near);
    c*=1.-(.22*seam)*near-.10*(1.-smoothstep(.0,.69,uv.y))*dry;
    c+=vec3(.021,.020,.018)*edge*near;
  }else if(role<51.5){
    vec2 stone=uv/vec2(.412,.237);
    stone.x+=.47*mod(floor(stone.y),2.);
    vec2 cell=floor(stone);float tint=hallHash(cell+vec2(.02,.31));
    float mortar=max(band(stone.x,.0,.062),band(stone.y,.0,.098));
    float weather=hallNoise(uv*vec2(.71,1.13));
    c*=.81+.23*tint+.11*weather+.15*(fine-.5)*near;
    c=mix(c,c*vec3(.80,.80,.74),mortar*.71*near);
  }else if(role<53.5||role>57.5){
    vec2 cell=uv/vec2(.34,.185);
    cell.x+=.39*mod(floor(cell.y),2.);
    float seam=max(band(cell.x,.00,.056),band(cell.y,.0,.092));
    float grime=hallNoise(uv*vec2(4.2,1.5)+2.3);
    c*=.82+.23*stain+.11*hallHash(floor(cell))*near+.15*(grime-.5)*near-.17*seam*near;
  }else if(role<54.5){
    c*=.89+.13*stain+.15*(fine-.5)*near;
    c+=vec3(.026,.030,.030)*near*pow(max(0.,dot(n,normalize(cameraPosition-p))),9.);
  }else if(role<55.5){
    vec3 view=normalize(cameraPosition-p),rr=reflect(-view,n);
    vec2 j=vec2(.5+atan(rr.z,rr.x)*.159154943+.512,.5+asin(clamp(rr.y,-.12,1.))*.3183099);
    vec2 a=dFdx(j),b=dFdy(j);a.x-=floor(a.x+.5);b.x-=floor(b.x+.5);
    float highlight=pow(1.-max(0.,dot(view,n)),4.6);
    vec3 sky=textureGrad(montagueSky,j,a*2.7,b*2.7).rgb;
    sky=mix(vec3(.174,.189,.174),sky,smoothstep(-.17,.26,rr.y));
    c=mix(vec3(.039,.049,.045)*(.79+.39*dry),sky,.25+.60*highlight);
  }else if(role<56.5){c*=.69+.17*sun+.16*stain;}
  else{
    float join=band(uv.x/.198,.0,.061);
    c*=.74+.21*stain+.10*fine*near-.28*join*near*far;
  }
 }
`;
