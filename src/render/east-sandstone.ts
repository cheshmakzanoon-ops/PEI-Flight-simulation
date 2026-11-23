/** Original, metre-scale coastal material. Reference images are not textures.
 * Both elevated land and the matching short waterline curtains evaluate this
 * world-space field, so geological layers don't restart at the mesh border.
 */
export const eastSandstoneGLSL=/*glsl*/`
 uniform vec4 eastRockBounds;  // west, north, inverse width/depth; 0 when unavailable
 vec2 eastRockPosition(vec2 p){return p-eastRockBounds.xy;}
 float eastRockRegion(vec2 local){
  if(eastRockBounds.z<=0.)return 0.;
  vec2 u=local*eastRockBounds.zw,edge=min(u,1.-u);
  return smoothstep(0.,.065,min(edge.x,edge.y));
 }
 float eastRockDistance(float d){return 1.-smoothstep(600.,1800.,d);}
 float eastRockLand(vec3 p,vec3 n,float shore,float weight){
  // Reference cliff exposures, not a new shore mask. Keep grass, parking,
  // dunes and level beaches on existing atlas materials even within the AOI.
  return weight*eastRockRegion(eastRockPosition(p.xz))*
    (1.-smoothstep(19.,32.,shore))*(1.-smoothstep(.73,.92,n.y))*smoothstep(.38,1.44,p.y);
 }
 float eastRockWall(vec3 p){
  // The curtain is only a narrow existing void guard, never a new cliff mesh.
  // Its submerged skirt and the low sandy coast retain their older material.
  return eastRockRegion(eastRockPosition(p.xz))*smoothstep(.32,1.65,p.y);
 }
 // A genuinely three-dimensional field avoids shearing a two-axis tile into
 // evenly repeated diagonal bands on steep, differently oriented faces.
 float rockHash(vec3 v){
  v=fract(v*vec3(.1031,.1099,.1379));v+=dot(v,v.zxy+31.32);
  return fract((v.x+v.y)*v.z);
 }
 float rockTexture(vec3 v){
  vec3 i=floor(v),r=fract(v);r=r*r*(3.-2.*r);
  vec4 a=vec4(rockHash(i),rockHash(i+vec3(1.,0.,0.)),rockHash(i+vec3(0.,1.,0.)),rockHash(i+vec3(1.,1.,0.)));
  i.z+=1.;
  vec4 b=vec4(rockHash(i),rockHash(i+vec3(1.,0.,0.)),rockHash(i+vec3(0.,1.,0.)),rockHash(i+vec3(1.,1.,0.)));
  vec4 c=mix(a,b,r.z);
  return mix(mix(c.x,c.y,r.x),mix(c.z,c.w,r.x),r.y);
 }
 vec3 eastSandstone(vec3 p,float d,vec3 px){
  vec2 q=eastRockPosition(p.xz);
  vec3 v=vec3(q.x,p.y,q.y);
  float stain=rockTexture(v*vec3(.29,.42,.31));
  float rock=rockTexture(vec3(v.z*.71+v.y*.19,v.x*.67+v.z*.26,v.y*.95+v.x*.23));
  float mottled=smoothstep(.20,.78,stain*.55+rock*.45);
  float weather=noise(q*.063+vec2(p.y*.028,11.07));
  float h=p.y+dot(q,vec2(.008,-.005))+.50*(stain-.5)+.20*(rock-.5);
  // Irregular pairs of thin ledges, with unequal spacing, weathered away
  // laterally and separated by thicker, unmarked weathered beds.
  float group=h/1.49,epoch=floor(group),phase=fract(group);
  float x=hash(vec2(epoch*.93,7.43)),y=hash(vec2(epoch*.61,31.7));
  float pxY=px.y+dot(px.xz,vec2(.013,.009));
  float blur=max(.014,pxY*.39);
  float a=phase-(.12+.25*x),b=phase-(.52+.31*y);
  float beds=(1.-smoothstep(.008,.035+blur,abs(a)))+(.32+.58*y)*(1.-smoothstep(.009,.038+blur,abs(b)));
  float lip=(1.-smoothstep(.01,.057+blur,abs(a+.044)))+(.35+.47*y)*(1.-smoothstep(.009,.058+blur,abs(b+.049)));
  float vein=smoothstep(.26,.77,noise(q*.17+vec2(epoch*.81,epoch*.33))*.8+.20*stain)*(1.-smoothstep(.14,.48,pxY));
  // Sparse broken joints, less dark than the horizontal recessed beds.
  float along=dot(q,vec2(.441,.897))*.44;
  float seam=along+.30*stain+.17*rock;
  float col=floor(seam),cut=abs(fract(seam)-(.30+.34*hash(vec2(col,15.7))));
  float fracture=(1.-smoothstep(.014,.050+.19*length(px.xz),cut))*smoothstep(.48,.79,rock);
  float visible=1.-smoothstep(.07,.29,max(px.x,max(px.y,px.z)));
  float grit=0.;
  if(visible>.01&&d<480.)grit=(rockTexture(v*vec3(4.1,5.6,3.7))-.5)*visible;
  vec3 dry=mix(vec3(.107,.061,.056),vec3(.201,.127,.110),mottled);
  vec3 wet=mix(vec3(.037,.035,.032),vec3(.113,.097,.083),mottled);
  float dryMask=smoothstep(.27,2.4,p.y+(weather-.5)*1.56);
  vec3 stone=mix(wet,dry,dryMask);
  stone*=.84+.20*weather+.15*rock-.28*beds*vein+.14*lip*vein-.21*fracture+.26*grit;
  return stone;
 }
`;
