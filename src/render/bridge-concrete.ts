import type {MeshStandardMaterial} from 'three';

/** Original marine concrete, with filtered, world-scale formwork and waterline wear. */
export function addBridgeConcrete(material:MeshStandardMaterial, surface:'deck'|'shaft'|'shield'){
  const deck=surface==='deck',shield=surface==='shield';
  material.customProgramCacheKey=()=> 'pei-bridge-concrete-v1-'+surface;
  material.onBeforeCompile=(shader)=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`
      #include <common>
      varying vec3 vBridgeConcrete;
    `).replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vec4 bridgePoint=vec4(position,1.);
      #ifdef USE_INSTANCING
        bridgePoint=instanceMatrix*bridgePoint;
      #endif
      vBridgeConcrete=(modelMatrix*bridgePoint).xyz;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
      #include <common>
      varying vec3 vBridgeConcrete;
      float bridgeHash(vec3 p){
        p=fract(p*vec3(.1031,.1099,.0973));
        p+=dot(p,p.yzx+33.33);
        return fract((p.x+p.y)*p.z);
      }
      float bridgeNoise(vec3 p){
        vec3 i=floor(p),f=fract(p);
        f=f*f*(3.-2.*f);
        vec4 a=vec4(bridgeHash(i),bridgeHash(i+vec3(1,0,0)),bridgeHash(i+vec3(0,1,0)),bridgeHash(i+vec3(1,1,0)));
        i.z+=1.;
        vec4 b=vec4(bridgeHash(i),bridgeHash(i+vec3(1,0,0)),bridgeHash(i+vec3(0,1,0)),bridgeHash(i+vec3(1,1,0)));
        vec4 c=mix(a,b,f.z);
        return mix(mix(c.x,c.y,f.x),mix(c.z,c.w,f.x),f.y);
      }
    `).replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 bc=vBridgeConcrete+vec3(0.,6.,1700.);
      float bp=max(length(dFdx(bc)),length(dFdy(bc)));
      float broad=bridgeNoise(bc*vec3(.086,.27,.086))-.5;
      float medium=1.-smoothstep(.40,1.65,bp);
      float fine=1.-smoothstep(.14,.70,bp);
      float patina=0.,aggregate=0.;
      if(medium>.001){
        float run=bridgeNoise(bc*vec3(1.22,.087,1.22))-.5;
        float damp=bridgeNoise(bc*vec3(.42,.19,.42)+42.)-.5;
        patina=(.14*run+.16*damp)*medium;
        if(fine>.001)aggregate=(bridgeNoise(bc*2.25)-.5)*.085*fine;
      }
      // Faint casting courses, not masonry blocks. Only the shaft shows these
      // nearly horizontal lift lines; the deck spans retain a continuous finish.
      float lifts=0.;
      ${(!deck&&!shield)?`
        float seam=abs(fract(bc.y*.64+.13)-.5);
        lifts=(1.-smoothstep(.026,.09,seam))*.06*fine;
      `:''}
      float splash=${deck?'0.':`
        (1.-smoothstep(.08,2.6,vBridgeConcrete.y+broad*.8))*.30
      `};
      diffuseColor.rgb*=1.+broad*.21+patina+aggregate-lifts-splash;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.94,.98,1.04),splash*1.5);
    `);
  };
}
