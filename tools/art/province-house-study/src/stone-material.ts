import * as T from 'three';
import { encoded, families, profile, toneRange, warmthRange } from './masonry';
import type { Family, StoneBatch, StonePlane } from './masonry';

type Ready = { status:'ready'|'fallback'; rawBytes:number; mipBytes:number; workerMs:number; bakeMs:number; scratchBytes:number; byWidthMs:Record<string,number> };
const defaultResult:Ready={status:'fallback', rawBytes:0, mipBytes:0, workerMs:0, bakeMs:0, scratchBytes:0, byWidthMs:{}};
const mippedBytes=(w:number,h:number)=>{let n=0;while(true){n+=4*w*h;if(w===1&&h===1)return n;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}};
function texture(plane:StonePlane){
  const t=new T.DataTexture(plane.pixels,plane.width,plane.height,T.RGBAFormat,T.UnsignedByteType);
  t.name=`stone:${plane.family}`;t.colorSpace=T.NoColorSpace;
  t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;
  t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}
function preview(family:Family){
  const p=profile[family];
  return texture({family,width:1,height:1,pixels:new Uint8Array([encoded((p.bias-toneRange[0])/toneRange[1]),encoded((p.warmth-warmthRange[0])/warmthRange[1]),128,128])});
}

export function stoneMaterials(){
  const configured=new Map<Family,{material:T.MeshStandardMaterial;tex:T.DataTexture}>();
  let pending:Promise<Ready>|undefined;
  function create(family:Family,bump:number){
    const initial=preview(family), p=profile[family];
    // Alias the texture (not a second GL allocation) to enable Three's UV-derived tangent frame.
    // The normal fragment reads the single already-sampled vec4; no second sampler is actually used.
    const material=new T.MeshStandardMaterial({map:initial,normalMap:initial,roughness:p.rough,normalScale:new T.Vector2(bump,bump), vertexColors:true});
    material.customProgramCacheKey=()=> 'detached-sandstone-tone-warm-xy-v1';
    material.onBeforeCompile=(shader)=>{
      shader.uniforms.stoneRoughBand={value:new T.Vector2(...p.roughLuma)};
      shader.fragmentShader='uniform vec2 stoneRoughBand;\n'+shader.fragmentShader
        .replace('#include <map_fragment>',`vec4 stone = texture2D(map,vMapUv);
          float tone = ${toneRange[0]} + ${toneRange[1]} * stone.r;
          float warm = ${warmthRange[0]} + ${warmthRange[1]} * stone.g;
          vec3 tint = tone * vec3(1.0+warm*.43, .979-warm*.10, .944-warm*.62);
          diffuseColor *= sRGBTransferEOTF(vec4(tint,1.0));`)
        .replace('#include <roughnessmap_fragment>',`float grainRough = 1.0 - smoothstep(stoneRoughBand.x,stoneRoughBand.y,tone);
          float roughnessFactor = roughness + .082 * grainRough;`)
        .replace('#include <normal_fragment_maps>',`vec2 stoneXY = stone.ba * 2.0 - 1.0;
          vec3 stoneN = vec3(stoneXY * normalScale, sqrt(max(.001,1.0-dot(stoneXY,stoneXY))));
          normal = normalize(tbn * stoneN);`);
    };
    configured.set(family,{material,tex:initial});return material;
  }
  function start():Promise<Ready>{
    if(pending)return pending;
    pending=new Promise<Ready>((resolve)=>{
      let w:Worker;
      try { w=new Worker(new URL('./masonry.worker.ts',import.meta.url),{type:'module'}); }
      catch {resolve(defaultResult);return;}
      const t0=performance.now();
      let terminal=false;
      const finish=(r:Ready)=>{
        if(terminal) return;
        terminal=true;clearTimeout(deadline);w.terminate();resolve(r);
      };
      const fallback=()=>finish({...defaultResult,workerMs:performance.now()-t0});
      const deadline=setTimeout(fallback,7500);
      w.onerror=(e)=>{e.preventDefault();fallback();};
      w.onmessageerror=fallback;
      w.onmessage=(e:MessageEvent<StoneBatch>)=>{
        const raw=e.data;
        if(raw?.kind!=='stone-v1'||!Array.isArray(raw.planes)||raw.planes.length!==families.length){fallback();return;}
        const accepted=new Map<Family,StonePlane>();
        for(const v of raw.planes){
          const def=configured.has(v?.family)?profile[v.family]:undefined;
          if(!def||accepted.has(v.family)||v.width!==def.w||v.height!==def.w>>1||!(v.pixels instanceof Uint8Array)||v.pixels.byteLength!==v.width*v.height*4){fallback();return;}
          accepted.set(v.family,v);
        }
        let rawBytes=0,mipBytes=0;
        for(const [family,plane] of accepted){
          const old=configured.get(family)!;
          const next=texture(plane);old.material.map=old.material.normalMap=next;old.material.needsUpdate=true;
          old.tex.dispose();old.tex=next;
          rawBytes+=plane.pixels.byteLength;mipBytes+=mippedBytes(plane.width,plane.height);
        }
        finish({status:'ready',rawBytes,mipBytes,workerMs:performance.now()-t0,bakeMs:raw.bakeMs,scratchBytes:raw.peakWorkingBytes,byWidthMs:raw.byWidthMs});
      };
    });
    return pending;
  }
  return {create,start};
}
