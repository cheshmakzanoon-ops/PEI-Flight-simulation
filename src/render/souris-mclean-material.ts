/** Original clapboard, mineral roof and softly reflective glass at 95 Main. */
export const sourisMcleanMaterialGLSL=`
 uniform sampler2D sourisMcleanSky;
 float sourisMainNoise(vec2 q){
  vec2 i=floor(q),u=fract(q);u=u*u*(3.-2.*u);
  return mix(mix(warmWindowHash(i),warmWindowHash(i+vec2(1.,0.)),u.x),
             mix(warmWindowHash(i+vec2(0.,1.)),warmWindowHash(i+1.),u.x),u.y);
 }
 void shadeSourisMclean(inout vec3 c,vec2 uv,vec3 p,vec3 n,float role,float dist){
  float fine=1.-smoothstep(.022,.22,length(fwidth(uv)));
  float damp=sourisMainNoise(vec2(uv.x*.46,uv.y*1.21)+p.xz*.026);
  if(role<62.5){
   float lap=band(uv.y/.142,.010,.073),bevel=band(uv.y/.142,.076,.150);
   float age=sourisMainNoise(uv*vec2(.71,.25)+vec2(2.7,4.2));
   float grain=sourisMainNoise(uv*vec2(1.83,27.0));
   c*=mix(vec3(.83,.90,.963),vec3(1.04,1.025,.968),age)*
      (.91+.15*damp-.27*lap*fine+.105*(grain-.5)*fine);
   c+=vec3(.024,.028,.032)*bevel*fine;
  }else if(role<65.5){
   // Smaller shingles can't hold a screen-sized contrast near the horizon.
   vec2 q=uv/vec2(role<63.5?.34:.46,role<63.5?.17:.25);
   q.x+=.51*mod(floor(q.y),2.);
   float joint=max(band(q.x,.012,.055),band(q.y,.01,.08));
   float chip=warmWindowHash(floor(q));
   float natural=sourisMainNoise(uv*.42+vec2(11.8,7.1));
   c*=.84+.25*natural+.13*chip*fine-.18*joint*fine;
  }else if(role<66.5){
   float weather=sourisMainNoise(uv*vec2(2.1,.72));
   c*=.83+.12*damp+.09*weather+.06*fine*(sourisMainNoise(uv*24.)-.5);
  }else if(role<67.5){
   c*=.67+.20*damp;
  }else if(role<68.5){
   vec3 view=normalize(cameraPosition-p),ray=reflect(-view,n);
   vec2 q=vec2(.5+atan(ray.z,ray.x)*.159154943+.512,.5+asin(clamp(ray.y,-.11,1.))*.3183099);
   vec2 a=dFdx(q),b=dFdy(q);a.x-=floor(a.x+.5);b.x-=floor(b.x+.5);
   vec3 reflected=textureGrad(sourisMcleanSky,q,a*2.1,b*2.1).rgb;
   reflected=mix(vec3(.109,.129,.135),reflected,smoothstep(-.13,.16,ray.y));
   float f=pow(1.-clamp(dot(view,n),0.,1.),4.4),depth=sourisMainNoise(uv*vec2(.8,.64));
   // Restrained interior tone; no invented fixtures, staging or occupancy.
   c=mix(vec3(.032,.046,.041)*(.85+.23*depth),reflected,.28+.61*f);
   c*=1.-.095*smoothstep(95.,680.,dist);
  }else if(role<69.5){
   vec2 q=uv/vec2(.39,.189);q.x+=.48*mod(floor(q.y),2.);
   float mortar=max(band(q.x,.0,.057),band(q.y,.0,.104));
   c*=.83+.20*warmWindowHash(floor(q))+.09*damp-.26*mortar*fine;
  }else{
   c*=.77+.14*damp;
  }
 }
 `;
