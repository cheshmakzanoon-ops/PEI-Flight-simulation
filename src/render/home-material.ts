/** Original architectural materials; glazing and joinery are representative art. */
export const homeMaterialGLSL=`
 float homeTurbulence(vec2 x) {
  vec2 a=floor(x),s=fract(x);s=s*s*(3.-2.*s);
  float ab=mix(warmWindowHash(a),warmWindowHash(a+vec2(1,0)),s.x);
  float cd=mix(warmWindowHash(a+vec2(0,1)),warmWindowHash(a+vec2(1,1)),s.x);
  return mix(ab,cd,s.y);
 }
 void shadeHome(inout vec3 c,vec2 uv,vec3 p,vec3 n,float kind,float form,float k,float d) {
  vec2 heat=p.xz*.203;
  if(form< -4.5)form=-1.;
  if(form>2.5){c*=.78+.17*k;return;}
  if(form>1.5){c*=.65;return;}
  if(form< -3.5){
   float rock=homeTurbulence(vec2(uv.x*11.5,uv.y*9.)+heat);
   float damp=homeTurbulence(vec2(uv.x*1.9,uv.y*3.2)+heat.yx);
   c*=mix(.70,1.20,rock)*mix(.81,1.08,damp);return;
  }
  if(form< -2.5){
   float jamb=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
   vec3 joinery=vec3(.33,.31,.27);
   float panels=(band(uv.x,.13,.15)+band(uv.x,.855,.875))*band(uv.y,.11,.91)
    +band(uv.x,.135,.86)*(band(uv.y,.11,.13)+band(uv.y,.57,.589)+band(uv.y,.895,.915));
   float handle=band(uv.x,.817,.851)*band(uv.y,.459,.497);
   c*=.63+.12*homeTurbulence(uv*9.+heat);
   c=mix(c,joinery,1.-smoothstep(.045,.072,jamb));
   c*=1.-.35*panels;c+=vec3(.10,.085,.058)*handle;return;
  }
  if(form< -1.5){c*=mix(.54,.82,uv.y);return;}
  if(form< -.5){
   vec3 eye=normalize(cameraPosition-p),ref=reflect(-eye,n);
   float f=.08+.64*pow(1.-clamp(abs(dot(eye,n)),0.,1.),5.);
   vec3 sky=mix(vec3(.21,.246,.224),vec3(.49,.66,.75),smoothstep(-.20,.61,ref.y));
   float horizon=1.-smoothstep(.015,.045,abs(ref.y+.075));
   vec3 lit=vec3(.037,.048,.049)*(1.-.27*horizon);
   float lace=band(uv.y,.126,.373)*smoothstep(.05,.17,uv.x)*(1.-smoothstep(.74,.93,uv.x));
   c=mix(lit,sky,f)+.05*vec3(.57,.61,.55)*lace;
   float rim=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
   float sill=1.-smoothstep(.054,.082,rim);
   float mull=band(uv.y,.472,.527)+band(uv.x,.489,.513)*step(kind,10.5);
   vec3 sash=vec3(.53,.493,.407)*(.76+.17*k);
   c=mix(c,sash,clamp(sill*.91+mull*.89,0.,1.));
   return;
  }
  float close=1.-smoothstep(45.,420.,d);
  if(form>.5){
   float row=uv.y/.177,slot=uv.x/.32+.52*mod(floor(row),2.);
   float kerf=band(slot,.014,.061),course=band(row,.03,.092);
   float patina=homeTurbulence(uv*.53+heat),stones=homeTurbulence(uv*19.0+heat*.91);
   float tabs=homeTurbulence(vec2(floor(slot),floor(row))*.688+heat);
   c*=mix(.77,1.15,patina)*mix(.84,1.15,tabs)*(1.-close*(.105*course+.08*kerf));
   c+=vec3(.015,.016,.017)*mix(.2,1.,stones)*close;
   return;
  }
  float board=uv.y/mix(.185,.154,step(kind,10.5));
  float lip=band(board,.10,.21),seam=band(board,.024,.106);
  float ripple=homeTurbulence(vec2(uv.x*1.25,uv.y*7.7)+heat);
  float aging=homeTurbulence(vec2(uv.x*1.62,uv.y*.49)+heat.yx);
  float skirting=1.-smoothstep(.69,1.56,uv.y);
  c*=mix(.89,1.06,aging)*mix(.95,1.06,ripple)*(1.-close*.18*seam-.10*skirting);
  c+=vec3(.031,.031,.028)*lip*close;
 }
`;
