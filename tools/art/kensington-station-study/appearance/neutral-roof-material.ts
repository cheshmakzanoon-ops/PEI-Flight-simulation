import {MeshStandardMaterial} from 'three';

/** Generic, original graphite cover for a detached station study. This makes
 * no claim about shingles, asphalt, roof zones, panel sizes or reflectance
 * measured from the aerial reference. Geometry is a separate evidence scope. */
export const neutralRoofVariation = `
float krHash(vec2 p) {
  vec3 q=fract(p.xyx*vec3(.1031,.1030,.0973));
  q+=dot(q,q.yzx+31.32);
  return fract((q.x+q.y)*q.z);
}
float krNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(krHash(i),krHash(i+vec2(1.,0.)),f.x),
      mix(krHash(i+vec2(0.,1.)),krHash(i+vec2(1.,1.)),f.x),f.y);
}
vec2 krGraphite(vec2 p) {
  float footprint=max(length(dFdx(p)),length(dFdy(p)));
  float grain=1.-smoothstep(.006,.054,footprint);
  float chips=1.-smoothstep(.023,.18,footprint);
  float cloud=krNoise(vec2(p.x*.54,p.y*.89))-0.5;
  float edges=krNoise(p*vec2(4.67,6.32)+8.0)-0.5;
  float specks=krNoise(p*vec2(22.2,28.4)+23.2)-0.5;
  float exposure=pow(max(0.,1.-abs(krNoise(vec2(p.x*.82,p.y*.19)+7.)-.37)*3.6),3.);
  return vec2(1.+.15*cloud+.10*chips*edges+.15*grain*specks-.034*exposure,
              clamp(.92-.08*chips*edges+.044*cloud,.84,.97));
}`;
export function createNeutralStationRoofMaterial() {
  const r=new MeshStandardMaterial({name:'Kensington neutral graphite study (cover unknown)',color:0x62696e,metalness:0,roughness:.92});
  r.customProgramCacheKey=()=> 'kensington-neutral-graphite-v1';
  r.onBeforeCompile=s=>{
    const inc='#include <common>',v='#include <begin_vertex>',f='#include <roughnessmap_fragment>';
    for(const [t,tag] of [[s.vertexShader,inc],[s.fragmentShader,inc],[s.vertexShader,v],[s.fragmentShader,f]])
      if(!t.includes(tag)||t.indexOf(tag)!==t.lastIndexOf(tag))throw Error('Three roof helper changed');
    s.vertexShader=s.vertexShader.replace(inc,inc+'\nvarying vec2 krLocal;').replace(v,v+'\nkrLocal=position.xz;');
    s.fragmentShader=s.fragmentShader.replace(inc,inc+'\nvarying vec2 krLocal;\n'+neutralRoofVariation)
      .replace(f,f+'\nvec2 krStockCover=krGraphite(krLocal);\ndiffuseColor.rgb*=krStockCover.x;\nroughnessFactor=krStockCover.y;\n');
  };
  return r;
}
