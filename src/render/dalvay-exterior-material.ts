import * as T from 'three';
export type DalvayFinish='masonry'|'render'|'joinery'|'shingles'|'glazing';
/** Local non-photographic finishes. No shared scenery material or source pixels. */
export function dalvayFinish(k:DalvayFinish){
   const m=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:k==='glazing'?.29:k==='masonry'?.92:.79,metalness:k==='glazing'?.08:0});m.name='Dalvay · '+k;
   if(k==='masonry'||k==='shingles'){
    m.customProgramCacheKey=()=>'dalvay-original-'+k+'-v1';
    m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 dalvayCourse;').replace('#include <begin_vertex>','#include <begin_vertex>\ndalvayCourse=uv;');
     const f=k==='masonry'?`
       vec2 q=dalvayCourse;float pixel=max(length(dFdx(q)),length(dFdy(q)));
       float atten=1.-smoothstep(.065,.21,pixel);
       vec2 pos=q*vec2(1.90,3.16);pos.x+=.09*sin(q.y*7.+sin(q.x*4.));
       vec2 id=floor(pos),fr=fract(pos);float best=8.,next=9.;vec2 winner=vec2(0.);
       for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){vec2 c=vec2(float(i),float(j)),a=id+c;vec2 jitter=fract(sin(vec2(dot(a,vec2(19.317,83.257)),dot(a,vec2(73.32,57.11))))*4617.1);
       vec2 r=c+.5+(jitter-.5)*.62-fr;float d=dot(r,r);if(d<best){next=best;best=d;winner=a;}else next=min(next,d);}}
       float seam=1.-smoothstep(.018,.12+min(pixel,.07)*1.6,next-best);
       float mineral=fract(sin(dot(winner,vec2(19.41,73.83)))*7186.3)-.5;
       vec3 block=vec3(1.+.36*mineral,1.+.28*mineral,1.+.20*mineral);
       diffuseColor.rgb*=mix(vec3(1.),mix(block,vec3(.59,.64,.66),seam),atten);
      `:`
       vec2 q=dalvayCourse;float pixel=max(length(dFdx(q)),length(dFdy(q)));
       float strength=1.-smoothstep(.045,.18,pixel);float row=floor(q.y/.205);
       float v=fract(q.y/.205)*.205,u=fract((q.x+.161*mod(row,2.)+.020*sin(row*1.31))/.341)*.341;
       float line=(1.-smoothstep(.0015,.012+min(pixel,.09),v))*.16+(1.-smoothstep(.001,.009+min(pixel,.09),min(u,.341-u)))*.085;
       float tone=fract(sin(dot(vec2(floor((q.x+.161*mod(row,2.))/.341),row),vec2(13.55,49.11)))*7199.4)-.5;
       diffuseColor.rgb*=1.+strength*(.12*tone-line);
      `;
     s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 dalvayCourse;').replace('#include <color_fragment>','#include <color_fragment>\n{'+f+'}\n');};
   }
 return m;
}
