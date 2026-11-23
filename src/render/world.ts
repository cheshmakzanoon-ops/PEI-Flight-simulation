import * as THREE from 'three';
import {loadCoastalSurveys,GROUND_LIFT,WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import {insertCoastalGrid} from './coastal-patch.ts';
import { Terrain, OCEAN_Y, type TerrainSpec } from '../sim/terrain.ts';
import {unpackGzip} from '../sim/compression.ts';
import {loadHarbourCover} from '../sim/harbour-cover.ts';
import {harbourCoastGLSL} from './harbour-coast.ts';
import { Cover } from '../sim/cover.ts';
import { coastSegments } from '../sim/shoreline.ts';
import { eastBenchGLSL,loadEastBench,type EastBenchMask } from './east-bench.ts';
import { eastSandstoneGLSL } from './east-sandstone.ts';
import { lighthouseGroundGLSL } from './lighthouse-ground.ts';
import { loadSouthLake,southLakeGLSL,type SouthLakeMask } from './south-lake.ts';
import { shoreFoamGLSL } from './shore-foam.ts';
import { DetailImagery } from './detail.ts';
import {detailRetryAt} from './detail-retry.ts';
import { runwayAtlas } from './runway-paint.ts';
import { RUNWAYS,runwayAt } from '../sim/places.ts';
import type { Surface } from '../sim/flight.ts';
const base = import.meta.env.BASE_URL + 'world/';
const vertex=`
 varying vec3 p; varying vec2 vuv;
 #ifdef SURVEY_LIGHT
 attribute float surveyWeight; varying float vSurveyWeight; varying vec3 vSurveyNormal;
 #endif
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
 #ifdef SURVEY_LIGHT
 vSurveyWeight=surveyWeight;vSurveyNormal=mat3(modelMatrix)*normal;
 #endif
 vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;vuv=uv;gl_Position=projectionMatrix*viewMatrix*w;
 #include <logdepthbuf_vertex>
 }`;
const fp=`
 precision highp float;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 varying vec3 p; varying vec2 vuv; uniform vec3 sun; uniform float clock;
 float hash(vec2 f){vec3 p3=fract(vec3(f.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
 float noise(vec2 f){vec2 i=floor(f),u=fract(f);u=u*u*(3.-2.*u);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+1.),u.x),u.y);}
 float fbm(vec2 p){return .53*noise(p)+.264*noise(p*2.03+vec2(8.,1.))+.132*noise(p*4.09+vec2(3.,17.))+.067*noise(p*8.3)+.032*noise(p*16.4);}
 vec3 mist(vec3 col,float d,float h){float ext=(1.-exp(-d*(.000013+.000008*exp(-max(h,0.)/1100.))));return mix(col,vec3(.56,.68,.72),clamp(ext,0.,.91));}
`;
const out=`
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const skyFn=`
 uniform sampler2D skyMap;
 vec3 skyAt(vec3 rd){
  float u=.5+atan(rd.z,rd.x)*.159154943+.512;
  float v=.5+asin(clamp(rd.y,-.025,1.))*.3183099;
  vec2 suv=vec2(u,v),du=dFdx(suv),dv=dFdy(suv);
  du.x-=floor(du.x+.5);dv.x-=floor(dv.x+.5);
  vec3 c=textureGrad(skyMap,suv,du,dv).rgb;
  return mix(vec3(.52,.65,.77),c*.90,smoothstep(-.025,.038,rd.y));
 }`;
const skyFrag=fp+skyFn+`
 void main(){
 #include <logdepthbuf_fragment>
 gl_FragColor=vec4(skyAt(normalize(p-cameraPosition)),1.);`+out;
const waterFrag=(lake:boolean,harbour:boolean)=>fp+skyFn+shoreFoamGLSL+(lake?southLakeGLSL:'')+(harbour?harbourCoastGLSL:'')+`
 uniform sampler2D imageMap,coverMap,rippleMap; uniform vec4 extent;
 float filteredWave(vec2 xy,vec2 k,float phase){float arg=dot(xy,k)+phase;return cos(arg)*(1.-smoothstep(.27,2.55,fwidth(arg)));}
 void main(){
 #include <logdepthbuf_fragment>
 vec3 eye=cameraPosition-p;float dist=length(eye);vec3 view=eye/max(dist,.01);
 vec2 q=p.xz;float t=clock*.72;
 // Compact, metre-scale wind ripples form the near field. At a distance they become
 // roughness, not football-field-scale mirror bands or subpixel aliases.
 float fade=1.-smoothstep(4000.,17000.,dist);
 // Physically scaled synthetic slope spectrum. Mip derivatives integrate wave
 // slopes over each screen pixel to avoid repeating sine-grid bands in harbours.
 vec2 st=q/86.+t*vec2(.007,.002);
 vec2 a=texture2D(rippleMap,st).rg-.5;
 mat2 turn=mat2(.724,-.689,.689,.724);
 vec2 b=turn*(texture2D(rippleMap,transpose(turn)*q/43.-t*vec2(.002,.009)).rg-.5);
 float wind=1.5*noise(q*.018+vec2(t*.021,-t*.007));
 vec2 n=(a*.95+b*.44)*fade;
 n+=vec2(.71,.52)*filteredWave(q,vec2(.127,.059),t*.39+wind)*.006*fade;
 ${lake?`
 float shelter=southLakeShelter(q);
 if(shelter>0.)n*=1.-.70*shelter;
 `:''}
 ${harbour?`
 vec2 quay=harbourAt(q);float marinaCalm=harbourOptics(quay);
 if(marinaCalm>0.)n*=1.-.55*marinaCalm;
 `:''}
 vec3 normal=normalize(vec3(-n.x,1.,-n.y));vec3 refl=reflect(-view,normal);
 float ndv=clamp(dot(normal,view),0.,1.);
 // Reflection is filtered over a rough specular lobe, including the sky panorama's
 // most oblique horizon. Do not mirror sharp individual cloud shapes from offshore.
 vec2 envUV=vec2(1.012+atan(refl.z,refl.x)*.159154943,.5+asin(clamp(refl.y,.012,1.))*.3183099);
 vec3 reflection=textureLod(skyMap,envUV,3.95+1.55*(1.-ndv)).rgb;
 reflection=mix(vec3(.27,.37,.43),reflection*.86,.61);
 float fres=.045+.78*pow(1.-ndv,3.6);
 vec2 uv=(p.xz-extent.xy)/extent.zw;
 float shore=-254.;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){shore=(texture2D(coverMap,uv).g*255.-128.)*2.;}
 ${harbour?'shore=harbourFrom(shore,quay);':''}
 // Water must not overdraw surveyed land, including nearly flat coasts. A depth
 // comparison alone between an ocean surface and land a few cm above it is fragile.
 // Conservative phase footprint includes the spatial distortion from the
 // foam field. Derivatives are evaluated before discard and the coastal branch.
 float foamFootprint=.69*fwidth(shore)+.42*length(fwidth(q));
 if(shore>=0.)discard;
 float shallows=smoothstep(-175.,-7.,shore);
 vec3 deep=mix(vec3(.025,.073,.084),vec3(.080,.185,.163),shallows*.80);
 ${lake?`
 if(shelter>0.){
  float optical=.48+.19*smoothstep(25.,145.,-shore);
  deep=mix(deep,southLakeTint(q,shore),optical*shelter);
 }
 `:''}
 ${harbour?`
 if(marinaCalm>0.)deep=mix(deep,vec3(.023,.065,.068),marinaCalm*.54);
 `:''}
 // Tint changes slowly with wind and bed depth. Only the short ripple frequencies
 // modulate the reflection; large-scale swells scarcely change the surface normal.
 float undulation=noise(q*.012+vec2(t*.012,t*.007))-.5;
 deep*=1.+.17*undulation*fade;
 vec3 c=mix(deep,reflection,fres);c*=1.+.38*(n.x+.45*n.y);
 float glitter=pow(clamp(dot(normal,normalize(view+sun)),0.,1.),83.);
 ${harbour?`
 if(marinaCalm>0.)glitter*=1.-.34*marinaCalm;
 `:''}
 c+=vec3(.72,.61,.41)*glitter*(.32+.35*fade);
 ${lake?`
 // Keep a gradient at the safe inward mask edge; no breaking ocean waves
 // in the basin interior. Derivatives of the original phase stay intact.
 float foam=0.;
 if(shelter<.999){
  foam=shoreFoam(q,shore,t,dist,n,foamFootprint);
  if(shelter>0.){
   // Ocean breaker bands fade well before the stronger basin tint and
   // ripple change. A narrow unsupported bank keeps its former optics.
   float gain=1.-smoothstep(0.,.22,shelter);foam*=gain*gain;
  }
 }
 `:`float foam=shoreFoam(q,shore,t,dist,n,foamFootprint);`}
 ${harbour?`if(marinaCalm>0.)foam*=1.-smoothstep(0.,.23,marinaCalm);`:''}
 c=mix(c,vec3(.49,.58,.56),foam);
 gl_FragColor=vec4(mist(c,dist,p.y),1.);`+out;
const cliffFrag=(east:boolean)=>fp+(east?eastSandstoneGLSL:'')+`
 void main(){
 #include <logdepthbuf_fragment>
 float d=distance(cameraPosition,p), f=1.-smoothstep(250.,2200.,d);
 float strata=sin(p.y*6.1+noise(p.xz*.045)*3.8)*.05*f;
 vec3 col=mix(vec3(.31,.194,.116),vec3(.235,.094,.049),smoothstep(1.2,7.,p.y));
 col*=.90+strata+.18*noise(p.xz*.14+vec2(0.,p.y*.11));
 ${east?`
 float eastCover=eastRockWall(p)*eastRockDistance(d);
 vec3 rockPx=fwidth(p),face=normalize(cross(dFdx(p),dFdy(p)));
 if(eastCover>.001){
  if(dot(face,cameraPosition-p)<0.)face=-face;
  vec3 lithology=eastSandstone(p,d,rockPx)*(.90+.31*max(0.,dot(face,sun)));
  col=mix(col,lithology,eastCover);
 }
 `:''}
 gl_FragColor=vec4(mist(col,d,p.y),1.);`+out;
const landFrag=(east:boolean,bench=false,harbour=false)=>fp+lighthouseGroundGLSL+(east?eastSandstoneGLSL:'')+(bench?eastBenchGLSL:'')+(harbour?harbourCoastGLSL:'')+`
 #ifdef SURVEY_LIGHT
 varying float vSurveyWeight; varying vec3 vSurveyNormal;
 #endif
 uniform sampler2D imageMap,coverMap,detailMap,paintMap; uniform float hasDetail;uniform vec4 detailBox;
 uniform vec4 airport[3];uniform vec2 stripSize[3];
 void main(){
 #include <logdepthbuf_fragment>
 vec2 cover=texture2D(coverMap,vuv).rg;float coast=(cover.g*255.-128.)*2.;
 ${harbour?'coast=harbourDistance(coast,p.xz);':''}
 if(coast<0.)discard;
 vec2 uv=vec2(vuv.x,1.-vuv.y);
 vec3 col=texture2D(imageMap,uv).rgb;
 if(hasDetail>.5){vec2 q=(vuv-detailBox.xy)*detailBox.zw;col=texture2D(detailMap,vec2(q.x,1.-q.y)).rgb;}
 vec3 n=normalize(cross(dFdx(p),dFdy(p)));if(n.y<0.)n=-n;
 #ifdef SURVEY_LIGHT
 n=normalize(mix(n,normalize(vSurveyNormal),vSurveyWeight));
 #endif
 float d=distance(cameraPosition,p),light=clamp(dot(n,sun),0.,1.);
 // Inferred low beach substrate vs higher headlands; not a survey of coastal geology.
 float beach=(1.-smoothstep(4.,25.,coast))*(1.-smoothstep(4.,14.,p.y));
 float cliff=(1.-smoothstep(3.,15.,coast))*smoothstep(3.,16.,p.y);
 col=mix(col,vec3(.47,.34,.20)*(.89+.16*noise(p.xz*.057)),beach*.79);
 col=mix(col,vec3(.23,.091,.054),cliff*.7);
 float detailFade=1.-smoothstep(290.,1900.,d);
 // The cover category alone cannot establish a crop or a row bearing.
 // Leave field patterns to the georeferenced imagery. The existing neutral
 // surface grain is unchanged so unclassified land has no new styling.
 col*=1.+detailFade*(.13*(noise(p.xz*.46)-.5));
 col=stationGround(col,p.xz,coast);
 ${east?`
 vec3 rockPx=fwidth(p);
 float eastCover=eastRockLand(p,n,coast,vSurveyWeight)*eastRockDistance(d);
 if(eastCover>.001)col=mix(col,eastSandstone(p,d,rockPx),eastCover);
 `:''}
 ${bench?`
 // Evaluated only on land, after the unchanged shoreline rejection.
 float benchCover=eastBenchWeight(p,d);
 if(benchCover>.003){
  vec4 benchColor=eastBenchColor(p,rockPx);
  col=mix(col,benchColor.rgb,pow(benchCover,1.15)*benchColor.a);
 }
 `:''}
 col*=.90+.31*light;
 for(int i=0;i<3;i++){
  vec2 delta=p.xz-airport[i].xy,axis=airport[i].zw;float along=dot(delta,axis)/stripSize[i].x;
  float across=dot(delta,vec2(-axis.y,axis.x))/stripSize[i].y+.5;
  if(along>=0.&&along<=1.&&across>=0.&&across<=1.){vec2 u=vec2((float(i)+clamp(across,.005,.995))/3.,1.-along);col=texture2D(paintMap,u).rgb*(.90+.17*light);break;}
 }
 gl_FragColor=vec4(mist(col,d,p.y),1.);`+out;
export async function loadAtlas(progress:(s:string)=>void){
 const surveys=loadCoastalSurveys(base),bench=loadEastBench(base),southLake=loadSouthLake(base);
 // The elevation manifest does not describe the colour, cover, or sky assets.
 // Start their independent reads together; keep all required failures attached
 // to one promise and establish the world only after every layer can be decoded.
 const [elevation,img,cover,sky]=await Promise.all([
  loadElevation(progress),
  new THREE.TextureLoader().loadAsync(base+'color.webp'),
  loadCover(),
  new THREE.TextureLoader().loadAsync(base+'maritime-sky.webp')
 ]);
 img.colorSpace=THREE.SRGBColorSpace;img.anisotropy=4;
 sky.colorSpace=THREE.SRGBColorSpace;sky.wrapS=THREE.RepeatWrapping;
 const installed=await surveys;
 return {terrain:new Terrain(elevation.spec,new Int16Array(elevation.data),installed),img,cover,sky,
   bench:installed.some(s=>!!s.cliff)?await bench:undefined,southLake:await southLake};
}
async function loadElevation(progress:(s:string)=>void){
 const json=await fetch(base+'terrain.json');if(!json.ok)throw Error('The terrain manifest could not be loaded.');
 const spec:TerrainSpec&{file:string;sha256:string}=await json.json();
 progress('Reading surveyed elevations…');
 const response=await fetch(base+spec.file);
 if(!response.ok||!response.body)throw Error('The elevation archive could not be downloaded.');
 // Some static servers send Content-Encoding: gzip even for .gz assets and the browser has already decoded them.
 const data=await unpackGzip(await response.arrayBuffer());
 if(data.byteLength!==2*spec.width*spec.height)throw Error('The terrain download is incomplete. Please reload.');
 if(globalThis.crypto?.subtle && spec.sha256){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  if(Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')!==spec.sha256)throw Error('The terrain checksum does not match the manifest.');
 }
 return {spec,data};
}
async function loadCover(){
 const [cmeta,coverData,harbour]=await Promise.all([fetch(base+'cover.json'),fetch(base+'cover.bin.gz'),loadHarbourCover(base)]);
 if(!cmeta.ok||!coverData.ok)throw Error('The coastline and forest atlas could not be loaded.');
 const cs=await cmeta.json();const cb=await unpackGzip(await coverData.arrayBuffer());
 return new Cover(cs.width,cs.height,new Uint8Array(cb),harbour?.plan.pinCoverSha256===cs.compressedSha256?harbour:undefined);
}
interface Patch { id:string;i:number;j:number;lod:number;seams?:string;local:THREE.ShaderMaterial;status:'idle'|'loading'|'ready'|'missing'|'uncovered';retryAt?:number;failures?:number;detail?:THREE.Texture;coarse:THREE.Mesh;fine?:THREE.Mesh; x0:number;z0:number;w:number;d:number; }
export class World {
 private shoreFaces:THREE.Mesh[]=[];private tiles:Patch[]=[];private byId=new Map<string,Patch>();private mat:THREE.ShaderMaterial;private sky:THREE.Mesh;
 private t={value:0};private recent=0;private details=new DetailImagery();private loading=0;private lastX=0;private lastZ=0;
 readonly coastalBenches:readonly string[]; readonly shelteredWater:readonly string[];
 readonly sun=new THREE.Vector3(-.60,.74,-.31).normalize();
 constructor(readonly scene:THREE.Scene,readonly terrain:Terrain, img:THREE.Texture,readonly renderer:THREE.WebGLRenderer,readonly cover:Cover,sky:THREE.Texture,bench?:EastBenchMask,southLake?:SouthLakeMask){
   const T=terrain,east=T.coastalGrids.find(g=>g.cliff);
   const benchMask=east?bench:undefined;
   let benchMap:THREE.DataTexture|undefined;
   const benchBounds=new THREE.Vector4();
   if(benchMask){
    const {plan,values}=benchMask,[left,top,right,bottom]=plan.boundsXZ;
    // Reuse the atlas's two-channel GPU format so an optional 1.4 kB
    // mask change does not invalidate the larger, cached renderer module.
    const pixels=new Uint8Array(values.length*2);
    for(let i=0;i<values.length;i++)pixels[2*i]=values[i];
    benchMap=new THREE.DataTexture(pixels,plan.width,plan.height,THREE.RGFormat);
    benchMap.minFilter=benchMap.magFilter=THREE.LinearFilter;benchMap.needsUpdate=true;
    benchBounds.set(left,top,1/(right-left),1/(bottom-top));
   }
   this.coastalBenches=benchMask?[benchMask.plan.id]:[];
   const eastRockBounds={value:east?new THREE.Vector4(east.x0,east.z0,1/(east.x1-east.x0),1/(east.z1-east.z0)):new THREE.Vector4()};
   const cm=new THREE.DataTexture(cover.bytes,cover.width,cover.height,THREE.RGFormat);
   cm.magFilter=cm.minFilter=THREE.LinearFilter;cm.needsUpdate=true;
   const paint=runwayAtlas();const ripple=new THREE.TextureLoader().load(import.meta.env.BASE_URL+'art/wind-slopes.webp');ripple.wrapS=ripple.wrapT=THREE.RepeatWrapping;ripple.anisotropy=4;
   const uniforms={eastRockBounds,rippleMap:{value:ripple},sun:{value:this.sun},clock:this.t,imageMap:{value:img},skyMap:{value:sky},coverMap:{value:cm},detailMap:{value:img},hasDetail:{value:0},detailBox:{value:new THREE.Vector4(0,0,1,1)},paintMap:{value:paint.map},airport:{value:paint.orig},stripSize:{value:paint.size},extent:{value:new THREE.Vector4(T.left,T.top,T.right-T.left,T.bottom-T.top)}};
   const make=(fragmentShader:string,side:THREE.Side=THREE.FrontSide)=>new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader,side});
   this.sky=new THREE.Mesh(new THREE.SphereGeometry(290000,32,20),make(skyFrag,THREE.BackSide));this.sky.renderOrder=-10;this.sky.material && ((this.sky.material as THREE.Material).depthWrite=false);this.sky.frustumCulled=false;scene.add(this.sky);
   const harbour=cover.harbour,harbourUniforms:Record<string,THREE.IUniform>={};
   if(harbour){
    const {width,height,boundsXZ}=harbour.plan;
    const map=new THREE.DataTexture(harbour.bytes,width,height,THREE.RGFormat);
    map.magFilter=map.minFilter=THREE.LinearFilter;map.needsUpdate=true;
    harbourUniforms.harbourMask={value:map};
    harbourUniforms.harbourBounds={value:new THREE.Vector4(...boundsXZ)};
    harbourUniforms.harbourSize={value:new THREE.Vector2(width,height)};
   }
   const oceanMaterial=make(waterFrag(!!southLake,!!harbour));
   if(harbour)oceanMaterial.uniforms={...uniforms,...harbourUniforms};
   this.shelteredWater=southLake?[southLake.plan.id]:[];
   if(southLake){
    const {plan,values}=southLake,[a,b,c,d]=plan.rotatedBoundsXZ;
    // Reuse RG to keep the larger Three.js build cacheable across scenery changes.
    const bytes=new Uint8Array(values.length*2);for(let i=0;i<values.length;i++)bytes[i*2]=values[i];
    const map=new THREE.DataTexture(bytes,plan.width,plan.height,THREE.RGFormat);
    map.magFilter=map.minFilter=THREE.LinearFilter;map.needsUpdate=true;
    oceanMaterial.uniforms={...oceanMaterial.uniforms,southLakeMask:{value:map},
      southLakeAABB:{value:new THREE.Vector4(...plan.boundsXZ)},
      southLakeFrame:{value:new THREE.Vector4(...plan.worldAnchorXZ,...plan.rotationCS)},
      southLakeRect:{value:new THREE.Vector4(a,b,1/(c-a),1/(d-b))}};
   }
   const ocean=new THREE.Mesh(new THREE.PlaneGeometry(650000,650000,160,160),oceanMaterial);
   ocean.rotation.x=-Math.PI/2;ocean.position.y=OCEAN_Y;scene.add(ocean);
   this.mat=make(landFrag(false));
   this.addShoreFaces(make(cliffFrag(false),THREE.DoubleSide),east?make(cliffFrag(true),THREE.DoubleSide):undefined);
   const nx=WORLD_COLS,nz=WORLD_ROWS,w=(T.right-T.left)/nx,d=(T.bottom-T.top)/nz;
   for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x0=T.left+i*w,z0=T.top+j*d;
    const sx=Math.floor(i*T.spec.width/nx),ex=Math.ceil((i+1)*T.spec.width/nx);
    const sy=Math.floor(j*T.spec.height/nz),ey=Math.ceil((j+1)*T.spec.height/nz);
    let any=false;outer:for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++)if(T.samples[y*T.spec.width+x]!==-32768){any=true;break outer;}
    if(!any)continue;
    const survey=T.coastalGrids.some(g=>g.spec.tileX===i&&g.spec.tileZ===j);
    const rock=i===east?.spec.tileX&&j===east.spec.tileZ;
    const useBench=rock&&!!benchMap;
    const localHarbour=harbour?.intersects(x0,z0,x0+w,z0+d)??false;
    const benchUniforms:Record<string,THREE.IUniform>=useBench?{eastBenchMask:{value:benchMap},eastBenchBounds:{value:benchBounds}}:{};
    const local=new THREE.ShaderMaterial({defines:survey?{SURVEY_LIGHT:1}:{},uniforms:{...uniforms,...benchUniforms,...(localHarbour?harbourUniforms:{}),hasDetail:{value:0},detailMap:{value:img},detailBox:{value:new THREE.Vector4(i/nx,j/nz,nx,nz)}},vertexShader:vertex,fragmentShader:landFrag(rock,useBench,localHarbour)});
    const coarse=this.patch(x0,z0,w,d,8);coarse.material=local;scene.add(coarse);const tile:Patch={id:i+'-'+j,i,j,lod:8,local,status:'idle',coarse,x0,z0,w,d};this.tiles.push(tile);this.byId.set(tile.id,tile);
   }
   const hemi=new THREE.HemisphereLight(0xe3eeff,0x78654c,1.48);scene.add(hemi);
   const light=new THREE.DirectionalLight(0xffedda,2.2);light.position.copy(this.sun).multiplyScalar(40000);scene.add(light);
   const env=sky.clone();env.mapping=THREE.EquirectangularReflectionMapping;env.needsUpdate=true;scene.environment=env;scene.environmentIntensity=.77;
   scene.environmentRotation.y=-.512*Math.PI*2;
   
 }
 private addShoreFaces(material:THREE.ShaderMaterial,eastMaterial?:THREE.ShaderMaterial) {
  const groups=new Map<string,number[]>(),rockGroups=new Set<string>();
  const t=this.terrain,east=eastMaterial?t.coastalGrids.find(g=>g.cliff):undefined;
  for(const {ax,az,bx,bz} of coastSegments(this.cover,t)){
   const key=Math.floor(ax/12000)+','+Math.floor(az/12000);
   if(east&&Math.max(ax,bx)>=east.x0&&Math.min(ax,bx)<=east.x1&&Math.max(az,bz)>=east.z0&&Math.min(az,bz)<=east.z1)rockGroups.add(key);
   let vertices=groups.get(key);if(!vertices){vertices=[];groups.set(key,vertices);}
   // Follow the original shoreline segments, with finer vertical samples only where
   // measured relief exists. Neither survey coverage nor zero elevation defines coast.
   const local=t.coastalGrids.some(g=>Math.max(ax,bx)>=g.x0&&Math.min(ax,bx)<=g.x1&&Math.max(az,bz)>=g.z0&&Math.min(az,bz)<=g.z1);
   const steps=local?Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/2)):1;
   let px=ax,pz=az,ph=t.meshElevation(px,pz)+.72;
   for(let j=1;j<=steps;j++){
    const u=j/steps,qx=ax+(bx-ax)*u,qz=az+(bz-az)*u,qh=t.meshElevation(qx,qz)+.72;
    // Signed CGVD2013 land can sit below sea level. The curtain joins both
    // surfaces irrespective of which end is higher; do not clip the measured floor.
    const bottom=Math.min(-.14,ph-.82,qh-.82),pTop=Math.max(OCEAN_Y+.03,ph),qTop=Math.max(OCEAN_Y+.03,qh);
    vertices.push(px,bottom,pz,qx,bottom,qz,px,pTop,pz,px,pTop,pz,qx,bottom,qz,qx,qTop,qz);
    px=qx;pz=qz;ph=qh;
   }
  }
  for(const [key,vertices] of groups){
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(vertices.length/3*2),2));
   g.computeBoundingSphere();
   const m=new THREE.Mesh(g,rockGroups.has(key)?eastMaterial:material);m.name='shore-to-sea surface';this.shoreFaces.push(m);this.scene.add(m);
  }
 }
 private patch(x0:number,z0:number,w:number,d:number,n:number){
  const g=new THREE.PlaneGeometry(w,d,n,n);g.rotateX(-Math.PI/2);
  const pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)+x0+w/2,z=pos.getZ(i)+z0+d/2;
    pos.setY(i,this.terrain.atlasElevation(x,z)+GROUND_LIFT);
    const [u,v]=this.terrain.uv(x,z);uv.setXY(i,u,v);
  }
  const site=this.terrain.coastalGrids.find(g=>g.x0>x0&&g.x1<x0+w&&g.z0>z0&&g.z1<z0+d);
  if(site)insertCoastalGrid(g,n,{x:x0,z:z0,w,d},this.terrain,site);
  g.computeBoundingSphere();const m=new THREE.Mesh(g,this.mat);m.position.set(x0+w/2,0,z0+d/2);
  m.userData.subdiv=n;
  if(site)m.userData.coastalSurvey=site.spec.id;
  if(site?.cliff)m.userData.coastalRefinement=site.cliff.id;
  return m;
 }
 groundHeight(x:number,z:number,land?:boolean){
  // Both shaders use the continuous Cover mask. A missing province DEM cell
  // cannot revoke visible land, and even positive offshore survey samples
  // must not raise water contact above the rendered ocean.
  return this.terrain.contactHeight(x,z,land??(this.cover.distance(this.terrain,x,z)>=0));
 }
 surface(x:number,z:number):Surface{
  const land=this.cover.distance(this.terrain,x,z)>=0;
  return {height:this.groundHeight(x,z,land),land,runway:!!runwayAt(x,z)};
 }
 update(pos:THREE.Vector3,clock:number){
  this.sky.position.copy(pos);this.t.value=clock;this.lastX=pos.x;this.lastZ=pos.z;
  if(Math.abs(clock-this.recent)<.25&&this.recent>0)return;
  this.recent=clock;
  // The visible curtain fills close headlands. Beyond the horizon detail load
  // radius it has negligible screen height, so do not send those meshes to GL.
  for(const face of this.shoreFaces){
   const b=face.geometry.boundingSphere!;
   face.visible=Math.hypot(b.center.x-pos.x,b.center.z-pos.z)<17000+b.radius;
  }
  for(const tile of this.tiles){
   const dx=pos.x-(tile.x0+tile.w/2),dz=pos.z-(tile.z0+tile.d/2);
   const d2=dx*dx+dz*dz,old=tile.lod;
   tile.lod=d2<(old===112?6200:5300)**2?112:d2<(old>=56?11700:10500)**2?56:8;
   const fine=tile.lod>8;
   if(fine&&tile.fine?.userData.subdiv!==tile.lod){
     if(tile.fine){this.scene.remove(tile.fine);tile.fine.geometry.dispose();}
     tile.fine=this.patch(tile.x0,tile.z0,tile.w,tile.d,tile.lod);tile.fine.material=tile.local;this.scene.add(tile.fine);tile.seams=undefined;
   }
   if(tile.detail&&d2>19000**2){tile.detail.dispose();(tile.detail.image as ImageBitmap)?.close?.();tile.detail=undefined;tile.status='idle';tile.local.uniforms.hasDetail.value=0;tile.local.uniforms.detailMap.value=tile.local.uniforms.imageMap.value;}
   tile.coarse.visible=!fine;if(tile.fine){tile.fine.visible=fine;if(!fine&&d2>15000**2){this.scene.remove(tile.fine);tile.fine.geometry.dispose();tile.fine=undefined;tile.seams=undefined;}}
  }
  // On each LOD transition, conform the fine boundary vertices to the adjacent
  // coarser edge. This preserves the DEM's unsimplified edge when equally fine tiles
  // meet and avoids vertical skirts appearing along coastline/harbour tiles.
  for(const tile of this.tiles)if(tile.lod>8&&tile.fine){
    const n=tile.lod,levels=[[0,-1],[1,0],[0,1],[-1,0]].map(([ox,oz])=>Math.min(n,this.byId.get((tile.i+ox)+'-'+(tile.j+oz))?.lod??n));
    const key=n+':'+levels.join(',');if(tile.seams===key)continue;tile.seams=key;
    const pos=tile.fine.geometry.getAttribute('position');
    for(let side=0;side<4;side++){
      const m=levels[side],ratio=n/m;let a=0,b=0;
      const height=(t:number)=>this.terrain.atlasElevation(tile.x0+tile.w*(side%2===0?t:side===1?1:0),tile.z0+tile.d*(side%2===1?t:side===2?1:0))+.12;
      for(let k=0;k<=n;k++){
        if(k%ratio===0){a=height(k/n);b=height(Math.min(1,(k+ratio)/n));}
        const j=side===0?k:side===1?k*(n+1)+n:side===2?n*(n+1)+k:k*(n+1);
        pos.setY(j,a+(b-a)*(k%ratio)/ratio);
      }
    }
    pos.needsUpdate=true;
  }
  const now=performance.now();
  const near=this.tiles.filter(q=>q.status==='idle'&&(q.retryAt??0)<=now&&Math.hypot(pos.x-q.x0-q.w/2,pos.z-q.z0-q.d/2)<14500)
   .sort((a,b)=>Math.hypot(pos.x-a.x0-a.w/2,pos.z-a.z0-a.d/2)-Math.hypot(pos.x-b.x0-b.w/2,pos.z-b.z0-b.d/2));
  for(const q of near){if(this.loading>=3)break;this.request(q);}

 }
 detailState(){return {ready:this.tiles.filter(t=>t.status==='ready').length,loading:this.loading,
  missing:this.tiles.filter(t=>t.status==='missing').length,uncovered:this.tiles.filter(t=>t.status==='uncovered').length,
  retrying:this.tiles.filter(t=>t.status==='idle'&&t.retryAt!==undefined).length};}
 private request(tile:Patch){
  this.loading++;tile.status='loading';tile.retryAt=undefined;
  void this.details.load(tile.id).then(tex=>{if(!tex){tile.status='uncovered';return;}
   tile.failures=undefined;
   const dx=this.lastX-(tile.x0+tile.w/2),dz=this.lastZ-(tile.z0+tile.d/2);
   if(dx*dx+dz*dz>19000**2){tex.dispose();(tex.image as ImageBitmap)?.close?.();tile.status='idle';return;}
   tile.detail=tex;tile.status='ready';tile.local.uniforms.detailMap.value=tex;tile.local.uniforms.hasDetail.value=1;
  }).catch(e=>{
   tile.failures=(tile.failures??0)+1;
   tile.retryAt=detailRetryAt(e,tile.failures,performance.now());
   tile.status=tile.retryAt===undefined?'missing':'idle';
   if(tile.status==='missing')console.warn('Base atlas retained; detail tile unavailable',tile.id,e);
  }).finally(()=>this.loading--);
 }
}
