// Original, non-rowed meadow grain on the mapped grassland class only.
// Geometry, crop masks and permanent placement are not inferred.
export const meadowGLSL=`
 uniform float meadowStrength;
 uniform vec4 meadowTileBounds;
 uniform int meadowTileGuard;
 float meadowTileSupport(vec2 q){
  int guard=meadowTileGuard;
  if(guard==0)return 1.;
  vec2 a=max(vec2(0.),q-meadowTileBounds.xy),b=max(vec2(0.),meadowTileBounds.zw-q);
  float span=42.;
  if((guard&1)!=0)span=min(span,a.y);
  if((guard&2)!=0)span=min(span,b.x);
  if((guard&4)!=0)span=min(span,b.y);
  if((guard&8)!=0)span=min(span,a.x);
  if((guard&16)!=0)span=min(span,length(a));
  if((guard&32)!=0)span=min(span,length(vec2(b.x,a.y)));
  if((guard&64)!=0)span=min(span,length(b));
  if((guard&128)!=0)span=min(span,length(vec2(a.x,b.y)));
  return smoothstep(0.,42.,span);
 }
 float grassClass(sampler2D map,ivec2 q,ivec2 size){
  return float(abs(texelFetch(map,clamp(q,ivec2(0),size-1),0).r*255.-30.)<.1);
 }
 float grassInterior(sampler2D map,vec2 uv){
  ivec2 dims=textureSize(map,0);
  vec2 px=clamp(uv,vec2(0.),vec2(.99999))*vec2(dims),f=fract(px);
  ivec2 q=ivec2(px);
  if(grassClass(map,q,dims)<.5)return 0.;
  vec4 sides=vec4(grassClass(map,q+ivec2(-1,0),dims),grassClass(map,q+ivec2(1,0),dims),
                  grassClass(map,q+ivec2(0,-1),dims),grassClass(map,q+ivec2(0,1),dims));
  vec4 fade=smoothstep(vec4(0.),vec4(.67),vec4(f.x,1.-f.x,f.y,1.-f.y));
  vec4 w=mix(fade,vec4(1.),sides);
  float inside=min(min(w.x,w.y),min(w.z,w.w));
  // Every corner contributes continuously; selecting the nearest
  // categorical neighbour would create an artificial mid-texel seam.
  float nw=mix(smoothstep(0.,.67,length(f)),1.,grassClass(map,q+ivec2(-1,-1),dims));
  float ne=mix(smoothstep(0.,.67,length(vec2(1.-f.x,f.y))),1.,grassClass(map,q+ivec2(1,-1),dims));
  float sw=mix(smoothstep(0.,.67,length(vec2(f.x,1.-f.y))),1.,grassClass(map,q+ivec2(-1,1),dims));
  float se=mix(smoothstep(0.,.67,length(1.-f)),1.,grassClass(map,q+ivec2(1,1),dims));
  return min(inside,min(min(nw,ne),min(sw,se)));
 }
 void decorateMeadow(inout vec3 ground,inout vec3 normal,vec3 local,vec2 uv,sampler2D cover,float coast,float distanceM,float footprint){
  if(meadowStrength<.001||coast<185.||distanceM>180.||normal.y<.79)return;
  float weight=meadowStrength*grassInterior(cover,uv)*meadowTileSupport(local.xz)*smoothstep(185.,242.,coast)*
      (1.-smoothstep(45.,180.,distanceM))*(1.-smoothstep(.19,1.18,footprint))*smoothstep(.79,.93,normal.y);
  if(weight<.002)return;
  vec2 p=local.xz;
  vec2 warp=vec2(noise(p*.108+vec2(11.,-31.)),noise(p*.131+vec2(51.,7.)))-.5;
  vec2 bladeP=p+warp*.74;
  float aggregate=noise((p+warp*3.7)*.24+vec2(-25.,91.));
  float growth=smoothstep(.26,.76,aggregate*.73+noise(bladeP*.62)*.27);
  float fine=1.-smoothstep(.032,.27,footprint),mid=1.-smoothstep(.16,.82,footprint);
  float blade=mix(.5,noise(vec2(bladeP.x*.96+bladeP.y*.32,bladeP.y*.38-bladeP.x*.25)*9.3),fine);
  float stem=mix(.5,noise((p+warp*.4)*2.87+4.2),mid);
  float grassWeight=(.36+.38*growth)*weight;
  float Y=dot(ground,vec3(.2126,.7152,.0722));
  // Keep the source's actual broad colour. A grass-family land-cover
  // label does not justify turning a brown Sentinel tile green.
  float sourceGreen=smoothstep(.018,.21,(ground.g-ground.r)/max(Y,.014));
  float variedShade=.86+.29*growth+.35*(blade-.5)+.20*(stem-.5);
  vec3 natural=ground*variedShade;
  vec3 warmer=ground*mix(vec3(1.07,1.02,.92),vec3(.93,1.06,.93),growth);
  ground=mix(ground,mix(natural,warmer*variedShade,.37*sourceGreen),grassWeight);
  if(fine>.004){
   vec2 nudge=(vec2(noise(bladeP*9.78+7.3),noise(bladeP*10.24-13.1))-.5)*(.16*weight*fine);
   vec3 tangent=vec3(nudge.x,0.,nudge.y);normal=normalize(normal+tangent-normal*dot(normal,tangent));
  }
 }
`;
