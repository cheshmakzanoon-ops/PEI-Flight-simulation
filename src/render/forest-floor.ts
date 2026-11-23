import * as THREE from 'three';
import {FOREST_FLOOR_ASSETS} from './forest-floor.generated.ts';

const assetHash=async(data:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
async function readFloor(base:string,a:typeof FOREST_FLOOR_ASSETS[number]){
 const r=await fetch(base+'art/forest-floor/'+a.file,{signal:AbortSignal.timeout(22000)});
 if(!r.ok||Number(r.headers.get('Content-Length'))>a.bytes)throw Error('No optional woodland ground map');
 const data=await r.arrayBuffer();
 if(data.byteLength!==a.bytes||await assetHash(data)!==a.sha256)throw Error('Wrong optional woodland ground map');
 const bitmap=await createImageBitmap(new Blob([data],{type:'image/webp'}),{imageOrientation:'none',colorSpaceConversion:'none',premultiplyAlpha:'none'});
 if(bitmap.width!==384||bitmap.height!==384){bitmap.close();throw Error('Malformed woodland ground texture dimensions');}
 const t=new THREE.Texture(bitmap);t.flipY=false;t.name=a.file;t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.colorSpace=THREE.NoColorSpace;t.anisotropy=8;t.needsUpdate=true;return t;
}
export class ForestFloor{
 readonly uniforms={forestFloorA:{value:null as THREE.Texture|null},forestFloorB:{value:null as THREE.Texture|null},forestFloorMix:{value:0}};
 private readonly base:string;
 private mode:'idle'|'loading'|'ready'|'failed'='idle';
 private since=0;
 constructor(base:string){this.base=base;}
 get state(){return this.mode;}
 update(near:boolean,now=performance.now()){
  if(this.mode==='ready'){this.uniforms.forestFloorMix.value=Math.max(0,Math.min(1,(now-this.since)/730));return;}
  if(!near||this.mode!=='idle'||!globalThis.crypto?.subtle||!globalThis.createImageBitmap)return;
  this.mode='loading';
  void Promise.allSettled(FOREST_FLOOR_ASSETS.map(a=>readFloor(this.base,a))).then(parts=>{
   const [a,b]=parts;
   if(a.status==='fulfilled'&&b.status==='fulfilled'){
    this.uniforms.forestFloorA.value=a.value;this.uniforms.forestFloorB.value=b.value;
    this.since=performance.now();this.mode='ready';
   }else{
    for(const p of parts)if(p.status==='fulfilled'){(p.value.image as ImageBitmap).close();p.value.dispose();}
    this.mode='failed';
   }
  });
 }
}

export const forestFloorGLSL=`
 uniform sampler2D forestFloorA,forestFloorB;
 uniform float forestFloorMix;
 uniform vec4 floorTileBounds;
 uniform int floorTileGuard;
 float safeForestTile(vec2 world){
  int guard=floorTileGuard;
  if(guard==0)return 1.;
  vec2 a=max(vec2(0.),world-floorTileBounds.xy),b=max(vec2(0.),floorTileBounds.zw-world);
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
 float pureForestCell(sampler2D map,ivec2 p,ivec2 bound){
  return abs(texelFetch(map,clamp(p,ivec2(0),bound-ivec2(1)),0).r*255.-10.)<.1?1.:0.;
 }
 // Categorical land cover must not become a plausible woodland value by
 // bilinear interpolation between two completely different classes.
 float woodlandInterior(sampler2D map,vec2 uv){
  ivec2 size=textureSize(map,0);
  vec2 px=clamp(uv,vec2(0.),vec2(.999999))*vec2(size);
  ivec2 c=ivec2(px);
  if(pureForestCell(map,c,size)<.5)return 0.;
  vec2 frac=fract(px);
  float n=pureForestCell(map,c+ivec2(0,-1),size),e=pureForestCell(map,c+ivec2(1,0),size);
  float s=pureForestCell(map,c+ivec2(0,1),size),w=pureForestCell(map,c+ivec2(-1,0),size);
  float side=min(min(mix(smoothstep(0.,.65,frac.x),1.,w),mix(smoothstep(0.,.65,1.-frac.x),1.,e)),
    min(mix(smoothstep(0.,.65,frac.y),1.,n),mix(smoothstep(0.,.65,1.-frac.y),1.,s)));
  // At a diagonal non-forest corner its distance agrees with the
  // neighbouring forest cell's edge fade. Without it an inner forest edge
  // develops a hard line even when no land-cover boundary is crossed.
  float nw=mix(smoothstep(0.,.65,length(frac)),1.,pureForestCell(map,c+ivec2(-1,-1),size));
  float ne=mix(smoothstep(0.,.65,length(vec2(1.-frac.x,frac.y))),1.,pureForestCell(map,c+ivec2(1,-1),size));
  float sw=mix(smoothstep(0.,.65,length(vec2(frac.x,1.-frac.y))),1.,pureForestCell(map,c+ivec2(-1,1),size));
  float se=mix(smoothstep(0.,.65,length(vec2(1.)-frac)),1.,pureForestCell(map,c+ivec2(1,1),size));
  return min(side,min(min(nw,ne),min(sw,se)));
 }
 void enrichWoodlandFloor(inout vec3 col,inout vec3 n,sampler2D cover,vec2 uv,vec3 local,float distanceM,float coast,bool preserve){
  vec2 p=local.xz,dX=dFdx(p),dY=dFdy(p);
  float footprint=max(length(dX),length(dY));
  if(preserve||forestFloorMix<.001||coast<92.||distanceM>260.||n.y<.68)return;
  float mask=woodlandInterior(cover,uv);
  float weight=forestFloorMix*mask*safeForestTile(p)*smoothstep(92.,172.,coast)*
    (1.-smoothstep(52.,260.,distanceM))*(1.-smoothstep(.15,.63,footprint));
  if(weight<.002)return;
  mat2 spin=mat2(.917,.399,-.399,.917);
  // Slow, continuous phase jitter separates the repeating two-metre
  // tiles without placing any object or inventing stand boundaries.
  vec2 shift=vec2(noise(p*.154+vec2(4.2,9.3)),noise(p*.196+vec2(19.2,-3.1)))-.5;
  vec2 aUV=(p+shift*.81)*.5,bUV=spin*(p-shift*.72)*.5+vec2(.171,.367);
  vec4 a=textureGrad(forestFloorA,aUV,dX*.5,dY*.5);
  vec4 b=textureGrad(forestFloorB,bUV,spin*dX*.5,spin*dY*.5);
  float litterBlend=smoothstep(.20,.79,noise(p*.057)*.67+noise(p*.138+vec2(2.1,8.3))*.33);
  float grain=mix(a.r,b.r,litterBlend);
  vec3 base=col;
  // Add relative material color to the existing measured broad scene
  // brightness. Do not substitute a brown autumn aerial map for tree cover.
  vec3 warmth=mix(vec3(1.13,.98,.72),vec3(1.30,.93,.63),litterBlend);
  float ao=mix(a.a,b.a,litterBlend);
  float Y=dot(base,vec3(.2126,.7152,.0722));
  vec3 substrate=mix(base,Y*warmth,mix(.31,.78,litterBlend));
  float aggregate=exp((grain-.5)*2.42);
  vec3 lit=substrate*aggregate*mix(.70,1.19,ao)*1.17;
  col=mix(base,lit,weight*.88);
  vec2 tangent=mix((a.gb*2.-1.)*vec2(1.,-1.),transpose(spin)*((b.gb*2.-1.)*vec2(1.,-1.)),litterBlend);
  vec3 bend=vec3(tangent.x,0.,tangent.y)*(.27*weight);
  n=normalize(n+bend-n*dot(n,bend));
 }
`;
