/** Private QA copy of literal existing original program; no photo donor. */
export const branchVertex=`
 attribute vec3 treeStem;
 attribute vec4 treeShape;
 attribute vec2 treeSpin;
#ifdef BLC_PILOT
 attribute float crownLift;
 uniform float crownVertical;
#endif
 attribute vec2 branchDetail;
 uniform vec3 volumeFade;
 #ifdef BARK_SCAN
 varying vec3 fBarkSpace;
 #endif
 varying vec3 fWorld,fNormal;
 varying vec2 fCard,fDetail;
 varying float fFade,fVariant;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 vec3 spun(vec3 q){return vec3(q.x*treeSpin.x-q.z*treeSpin.y,q.y,q.x*treeSpin.y+q.z*treeSpin.x);}
 void main(){
  vec3 scale=vec3(treeShape.y,treeShape.x,treeShape.y);
  vec3 vertex=position;
#ifdef BLC_PILOT
  // Anchor the root and the upper quarter, including the original top.
  const float ceiling=.76;
  if(crownLift>0. && vertex.y>0. && vertex.y<ceiling){
   float t=vertex.y/ceiling;
   float amplitude=(crownLift/treeShape.x)*(1.-smoothstep(27.,38.,length(treeStem.xz-cameraPosition.xz)))*crownVertical;
   float u=1.-t;
   // t(1-t)^3 peaks at 27/256; this is a genuine maximum shift.
   float k=amplitude*(256./27.);
   vertex.y+=k*t*u*u*u;
   scale.y*=1.+k*u*u*(1.-4.*t)/ceiling;
  }
#endif
  vec3 local=spun(vertex*vec3(treeShape.y,treeShape.x,treeShape.y));
  fWorld=treeStem+local;
  fNormal=normalize(spun(normal/scale));
#ifdef BARK_SCAN
  // Horizontal components are the same rest surface through a vertical
  // warp. Local displayed Y agrees on joins, without a wrapped UV.
  fBarkSpace=local+vec3(2.174*treeSpin.x+.9,2.031*treeSpin.y+1.1,2.593*treeSpin.y-.79*treeSpin.x);
#endif
  fCard=uv;fDetail=vec2(branchDetail.x,branchDetail.y*treeShape.w);fVariant=treeShape.z;
  fFade=volumeFade.z*(1.-smoothstep(volumeFade.x,volumeFade.y,length(treeStem.xz-cameraPosition.xz)));
  gl_Position=projectionMatrix*viewMatrix*vec4(fWorld,1.);
 #include <logdepthbuf_vertex>
 }`;
export const branchFragment=`
 #ifdef BARK_SCAN
 uniform sampler2D barkMap;
 uniform float barkGain;
 varying vec3 fBarkSpace;
 #endif
 varying vec3 fWorld,fNormal;
 varying vec2 fCard,fDetail;
 varying float fFade,fVariant;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 float branchHash(vec2 p){
  vec2 q=fract(p*vec2(.103,.139));return fract(dot(q.xy,q.yx+18.8)*41.6);
 }
 float leaves(vec2 p,bool needle,float seed){
  float mask=0.;
  for(int i=0;i<6;i++){
   float u=float(i),e=2.*mod(u,2.)-1.;
   float variation=fract(sin(u*11.44+seed*91.3)*1237.32);
   float y=-.69+u*.258+(variation-.5)*.093;
   float w=(1.-u*.086)*(.64+.35*variation);
   vec2 a=p-vec2(e*(.195+.098*variation)*w,y);
   float angle=e*(.35+.41*variation);
   float t=sin(angle),s=cos(angle);
   vec2 q=vec2(a.x*s+a.y*t,-a.x*t+a.y*s);
   q/=vec2((needle?.429:.39)*w,needle?.105:.171+variation*.054);
   float d=dot(q,q);
   if(!needle)d+=.015*sin(q.x*21.+q.y*13.+seed*6.)+.021*sin(q.y*16.-q.x*9.);
   mask=max(mask,1.-smoothstep(.69,1.10,d));
  }
  vec2 top=(p-vec2((seed-.5)*.13,.63))/vec2(.16,.29);
  return max(mask,1.-smoothstep(.77,1.12,dot(top,top)));
 }
 void main(){
#ifdef BARK_SCAN
  // Form derivatives before per-fragment alpha/range branches diverge.
  vec3 barkDx=dFdx(fBarkSpace),barkDy=dFdy(fBarkSpace);
#endif
 #include <logdepthbuf_fragment>
 if(fFade<.003)discard;
 vec3 n=normalize(fNormal),sun=normalize(vec3(-.60,.74,-.31));
 float fade=fFade,side=dot(n,sun),lift=.32+.22*abs(n.y);
 vec3 c;
 if(fDetail.x>.5){
  bool needle=fDetail.x>1.5;
  float seed=fract(fDetail.y*35.71);
  fade*=leaves(fCard,needle,seed);
  if(fade<.055)discard;
  float crisp=1.-smoothstep(.021,.115,length(fwidth(fWorld)));
  float tint=mix(seed,branchHash(floor(fWorld.xz*vec2(9.1,8.4)+fWorld.y*16.)),crisp);
  float axisShade=.83+.17*smoothstep(-.5,.79,fCard.y);
  // Keep the established original canopies' warm/cool families rather
  // than tinting every broadleaf or needle cluster one uniform green.
  vec3 broad=mix(vec3(.091,.127,.037),vec3(.048,.105,.028),step(.5,fVariant));
  vec3 needles=mix(vec3(.034,.080,.028),vec3(.028,.070,.025),step(2.5,fVariant));
  vec3 leaf=needle?needles:broad;
  c=leaf*fDetail.y*axisShade*(lift+.43*abs(side)+.215*tint);
  c+=vec3(.012,.021,.007)*max(0.,-side)*.24;
 }else{
  float grain=branchHash(vec2(floor(fCard.x*27.),floor(fWorld.y*15.)));
  float split=abs(fract(fCard.x*15.+floor(fWorld.y*1.1)*.127)-.5);
  c=mix(vec3(.041,.031,.019),vec3(.099,.081,.059),grain*.60+.35*split)*
   (.52+.47*max(0.,side));
#ifdef BARK_SCAN
  float weight=barkGain*(1.-smoothstep(11.,25.,length(fWorld-cameraPosition)));
  if(weight>.001){
   vec2 w=pow(abs(n.xz),vec2(3.5));float denom=w.x+w.y;
   w+=vec2(.5*max(0.,.001-denom));w/=max(.001,denom);
   bool needle=fVariant>=1.5;
   float rate=needle?.62:1.23;
   vec2 pu=fBarkSpace.xy*rate,pv=fBarkSpace.zy*rate;
   vec4 u=textureGrad(barkMap,pu,barkDx.xy*rate,barkDy.xy*rate);
   vec4 v=textureGrad(barkMap,pv,barkDx.zy*rate,barkDy.zy*rate);
   vec4 sampleValue=u*w.y+v*w.x;
   float diffuse=clamp(side,0.,1.),l=clamp(needle?sampleValue.g:sampleValue.r,0.,1.);
   float occ=needle?sampleValue.a:sampleValue.b;
   vec3 low=needle?vec3(.029,.018,.009):vec3(.034,.026,.016);
   vec3 high=needle?vec3(.165,.104,.061):vec3(.177,.146,.106);
   vec3 resolved=mix(low,high,pow(l,.71))*(.68+.32*diffuse)*(.77+.23*occ);
   c=mix(c,resolved,weight*.96);
  }
#endif
 }
 gl_FragColor=vec4(c,fade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
