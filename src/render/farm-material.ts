/** Original meter-scaled joinery and weathered metal/paint. Not site photographs. */
export const farmMaterialGLSL=`
 float farmNoise(vec2 x) {
  vec2 b=floor(x),t=fract(x);t=t*t*(3.-2.*t);
  return mix(mix(warmWindowHash(b),warmWindowHash(b+vec2(1,0)),t.x),
      mix(warmWindowHash(b+vec2(0,1)),warmWindowHash(b+vec2(1,1)),t.x),t.y);
 }
 void shadeFarm(inout vec3 c,vec2 uv,vec3 p,vec3 n,float type,float form,float k,float fine,float distanceM) {
  float wood=1.-step(7.5,type);
  if(form>3.5){
   float kinks=band(uv.x/2.1,.009,.035),wear=farmNoise(vec2(uv.x*.57,uv.y*.16));
   c*=mix(.87,1.09,wear)*(1.-.17*kinks);c+=vec3(.017,.018,.019)*k;return;
  }
  if(form>2.5){c*=.43;return;} // Under the inboard eave, not a lit undersurface.
  if(form>1.5){c*=.64+.24*k;return;}
  vec2 world=p.xz*.45;
  if(form< -2.5){
   float grain=farmNoise(vec2(uv.x*2.22,p.y*6.8)+world)*.64+farmNoise(world*1.8)*.36;
   c*=mix(.79,1.06,grain)*mix(.78,1.,smoothstep(.52,.89,uv.y));return;
  }
  if(form< -1.5){c*=.49+.16*k;return;}
  if(form<-.5) {
   float lamella=band(uv.y/.286,.075,.15),boards=band(uv.x*18.,.048,.139);
   float pair=band(uv.x,.492,.508)*wood;
   float trimShadow=(1.-smoothstep(.015,.038,min(uv.x,1.-uv.x)))*.31;
   float rails=(band(uv.y/3.17,.122,.155)+band(uv.y/3.17,.857,.891))*wood;
   float latch=band(uv.x,.467,.482)*band(uv.y/3.2,.276,.322)*wood;
   float drizzle=farmNoise(vec2(floor(uv.x*21.)*.831,p.y*.32));
   float sunBleach=farmNoise(vec2(uv.x*2.5,uv.y*.82)+vec2(.55,.57));
   c*=mix(.78,1.13,drizzle)*mix(.93,1.10,sunBleach)*
      (1.-fine*(.195*lamella*(1.-wood)+.18*boards*wood+.48*pair+trimShadow+.18*rails+.50*latch));
   return;
  }
  float farFine=1.-smoothstep(68.,440.,distanceM);
  if(form>.5){
   float pitch=mix(.597,.515,wood), seam=uv.x/pitch;
   float sheet=farmNoise(vec2(floor(seam)*.683,uv.y*.27));
   float dark=band(seam,.032,.089), lip=band(seam,.089,.156);
   float matte=farmNoise(uv*.65);
   float stains=(farmNoise(uv*vec2(.73,.369)+vec2(.9,1.27))*.66+farmNoise(uv*.89)*.34);
   float corrosion=smoothstep(.54,.84,stains)*mix(.42,.75,wood);
   float zinc=farmNoise(uv*2.1+vec2(0.,matte*.17));
   vec3 eye=normalize(cameraPosition-p),sun=normalize(vec3(-.60,.74,-.31));
   float sheen=pow(max(dot(normalize(eye+sun),n),0.),28.)*k;
   c*=mix(.95,1.04,sheet)*(1.-.145*dark*farFine)*mix(.83,1.16,stains)*mix(.94,1.07,zinc);
   c=mix(c,c*vec3(1.24,.80,.59),corrosion);
   c+=vec3(.053,.064,.073)*(lip*farFine+.71*sheen)*(1.-.51*matte);
   return;
  }
  float pitch=mix(.335,.237,wood), t=uv.x/pitch;
  float shadow=band(t,.04,.14), lip=band(t,.20,.29);
  float stack=farmNoise(vec2(floor(t)*.771+floor(world.x),uv.y*mix(.11,.48,wood)+world.y));
  float wear=farmNoise(vec2(uv.x*1.18,p.y*.32)+world*.42);
  float runoff=farmNoise(vec2(floor(uv.x/.82)*.479+world.x,p.y*.138+world.y));
  float skirt=1.-smoothstep(.67,1.27,uv.y);
  float streak=(.78+.22*runoff)*(.91+.17*wear);
  float grain=farmNoise(vec2(uv.x*21.7,p.y*1.8)+world);
  float plank=1.-farFine*(.135*shadow+.088*wood*band(uv.y/.271,.066,.105));
  c*=plank*streak*mix(.85,1.14,stack)*mix(1.,mix(.91,1.08,grain),farFine*wood);
  c+=vec3(.016,.018,.017)*lip*farFine;
  c=mix(c,mix(vec3(.104,.091,.070),vec3(.183,.166,.131),stack),skirt*.20);
 }
`;
