// All periods are seconds in the renderer's animation clock (not network time).
export const DETAIL_NOT_READY=1e8;
export const DETAIL_FADE_SECONDS=.38;
export const DETAIL_TRANSITION_METRES=72;
// Precompute north, east, south, west, NE, SE, SW, NW.
export const DETAIL_NEIGHBOURS=[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]] as const;
export const detailBlendGLSL=`
uniform float detailClock,detailReady;
uniform vec4 detailCardinal,detailDiagonal;
uniform vec2 detailSize;
float arrival(float t){if(t>1.e7)return 0.;return smoothstep(t,t+${DETAIL_FADE_SECONDS.toFixed(2)},detailClock);}
float acrossDetail(float t,float metres){
 return mix(arrival(t),1.,smoothstep(0.,${DETAIL_TRANSITION_METRES.toFixed(2)},max(0.,metres)));
}
float detailAmount(vec2 uv){
 float own=arrival(detailReady);
 vec2 distances=min(uv,1.-uv)*detailSize;
 if(own==0.||min(distances.x,distances.y)>=${DETAIL_TRANSITION_METRES.toFixed(2)})return own;
 bool north=uv.y<.5,east=uv.x>=.5;
 float horizontal=acrossDetail(east?detailCardinal.y:detailCardinal.w,distances.x);
 float vertical=acrossDetail(north?detailCardinal.x:detailCardinal.z,distances.y);
 float corner=north?(east?detailDiagonal.x:detailDiagonal.w):(east?detailDiagonal.y:detailDiagonal.z);
 // A neighbour blends towards 1, then the minimum clips to the owner.
 // Blending towards the owner would make shared sides disagree during fades.
 // Use distance to the diagonal rectangle, not min of edge distances.
 // At a shared side this equals the relevant distance on the next owner.
 float diagonal=acrossDetail(corner,length(distances));
 return min(own,min(min(horizontal,vertical),diagonal));
}
`;
