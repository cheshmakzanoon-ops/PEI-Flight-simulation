import {BASILICA_CAST as L} from './basilica-cast-source.ts';
const vec=(a:readonly number[])=>'vec3('+a.map(v=>v.toFixed(11)).join(',')+')';
const f=(x:number)=>x.toFixed(10);
const h=L.hiD-L.loD;
export const CREATOR_COORDS=`
 const vec3 bsRight=${vec(L.directions[0])},bsUp=${vec(L.directions[1])},bsSun=${vec(L.directions[2])};
 const vec2 bsMin=vec2(${L.loUV.map(f).join(',')});
 const float bsTexel=.0625,bsSize=1024.,bsTop=${f(L.hiD)},bsDepth=${f(h)};
`;
export const DEPTH_VERTEX=`precision highp float;
in vec3 position;${CREATOR_COORDS}
void main(){
 const float cs=${f(Math.cos(L.yaw))},ss=${f(Math.sin(L.yaw))};
 vec3 p=vec3(cs*position.x+ss*position.z,position.y,-ss*position.x+cs*position.z);
 vec2 uv=(vec2(dot(p,bsRight),dot(p,bsUp))-bsMin)/(bsSize*bsTexel);
 gl_Position=vec4(uv*2.-1.,(bsTop-dot(p,bsSun))*2./bsDepth-1.,1.);
}`;
export const SHADOW_FIELD=`
${CREATOR_COORDS}
uniform sampler2D bsSourceDepth;
uniform float bsLive;
float bsTopAt(vec2 cell){return bsTop-texture2D(bsSourceDepth,(cell+.5)/bsSize).r*bsDepth;}
float bsTap(vec2 p,float z,vec2 g,vec2 j){
 vec2 i=floor(p+j);float q=bsTopAt(i);
 return q>bsTop-bsDepth+.001&&q>z+dot(g,(i+.5-p)*bsTexel)+.025?1.:0.;
}
float basilicaDirect(vec3 world,vec3 physicalN){
 if(bsLive<=0.||dot(physicalN,bsSun)<=.05)return 0.;
 vec3 w=world-${vec(L.origin)};
 if(any(greaterThan(abs(w),vec3(76.,57.,80.))))return 0.;
 vec2 p=(vec2(dot(w,bsRight),dot(w,bsUp))-bsMin)/bsTexel;
 if(any(lessThan(p,vec2(8.)))||any(greaterThan(p,vec2(bsSize-8.))))return 0.;
 float z=dot(w,bsSun);if(z>=bsTop)return 0.;
 // Upper blocker sampled near the central ray determines only the finite, bounded solar radius.
 // Compare each D16 texel on the *true tilted receiver plane*. Do not grade a tangent roof as its own caster.
 vec2 j=floor(p);float broad=bsTopAt(j);
 broad=max(broad,max(bsTopAt(j+vec2(4.,0.)),bsTopAt(j-vec2(4.,0.))));
 broad=max(broad,max(bsTopAt(j+vec2(0.,4.)),bsTopAt(j-vec2(0.,4.))));
 float rad=clamp((broad-z)*.0046426/bsTexel,.38,6.);
 vec2 g=-vec2(dot(physicalN,bsRight),dot(physicalN,bsUp))/max(.05,dot(physicalN,bsSun));
 float hard=bsTap(p,z,g,vec2(0.));
 const float d=.615;float a=0.;
 a+=bsTap(p,z,g,vec2(rad*.86,0.));a+=bsTap(p,z,g,vec2(-rad*.86,0.));
 a+=bsTap(p,z,g,vec2(0.,rad*.86));a+=bsTap(p,z,g,vec2(0.,-rad*.86));
 a+=bsTap(p,z,g,vec2(rad*d,rad*d));a+=bsTap(p,z,g,vec2(-rad*d,rad*d));
 a+=bsTap(p,z,g,vec2(rad*d,-rad*d));a+=bsTap(p,z,g,vec2(-rad*d,-rad*d));
 return bsLive*(hard*.2+a*.1);
}
`;
