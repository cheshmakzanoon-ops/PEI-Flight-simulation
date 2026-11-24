import {smoothShoreTone} from './shore-tone.ts';
import {KINGS_DRY_CROWN} from '../sim/kings-dry-crown.generated.ts';
import {KINGS_CROWN_ZERO_M,KingsCrownMorph,kingsCrownBlendForDistance} from './kings-crown-rolloff.ts';
import type {OrthophotoSeams} from './orthophoto-seams.ts';
import type {AerialWorldOptics,VerifiedAerialSky,VerifyAerialSky} from './aerial-perspective-lab.ts';
import type {DuneGrassSurface} from './dune-grass-surface.ts';
import type {DuneSand} from './dune-sand.ts';
import {HOG_WEST_GRADE} from '../sim/hog-west-grade.generated.ts';
import {hogPhotoGLSL,westDuneAerialGLSL,type HogPhoto,type WestDuneOptics} from './hog-photo.ts';
import {project} from '../sim/geo.ts';
import {churchSunGLSL,type ChurchGroundSun} from './indian-river/church-ground-sun.ts';
import {shortGrassHeightFade,sourceGrassNapGLSL} from './source-grass-nap.ts';
import {provinceGrassGLSL,type ProvinceGrassStudy} from './province-grass.ts';
import {DRY_FRAME,drySoilGLSL,makeDrySoilUniforms} from './dry-coast/soil.ts';
import {gablesTrailGLSL,gablesTrailIntersects} from './cavendish-trail.ts';
import {gablesFairwayGLSL,type GablesFairway} from './gables-fairway.ts';
import {gablesGravelGLSL,gablesGravelIntersects} from './gables-gravel.ts';
import {boundedGradeTiles,type BoundedGrade} from '../sim/bounded-grade.ts';
import {provinceFieldOpticsGLSL,type ProvinceFieldStudy} from './province-fields.ts';
import {fieldPilotGLSL,type FieldPilot} from './fields-pilot.ts';
import {meadowGLSL} from './meadow-optics.ts';
import {NorthCapeShadow,northCapeShadowGLSL} from './north-cape-shadow.ts';
import {BowleyWaterMesh,bowleyClipGLSL,bowleyWaterGLSL,bowleyShoreGLSL,bowleyUniforms} from './bowley-pond.ts';
import {admitPondTiles,bowleyAtlasMatches,type BowleyPond} from '../sim/bowley-pond.ts';
import {ForestFloor,forestFloorGLSL} from './forest-floor.ts';
import {nativeBankMesh} from './native-bank-mesh.ts';
import {adaptiveGround} from './adaptive-ground.ts';
import type {ReliefPacks} from '../sim/relief-pack.ts';
import type {ReliefSeed} from '../sim/relief-seed.ts';
import * as THREE from 'three';
import {verifiedBaywalkRoadSupport,type RoadPoint} from './baywalk-road.ts';
import {BaywalkGround,baywalkCourtOpticsGLSL,baywalkLandGLSL,baywalkUniforms} from './baywalk-land.ts';
import {BaywalkNative,supportedBaywalkCourt,type BaywalkCourtData} from '../sim/baywalk-native.ts';
import {verifiedBaywalkDeckClearance,type SpinnakersDeck} from './spinnakers-deck.ts';
import {facet,loadCoastalSurveys,GROUND_LIFT,WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import {insertCoastalGrid} from './coastal-patch.ts';
import {alteredPatchHeight} from './render-patch-height.ts';
import {MONTAGUE_GROUND_ID} from '../sim/montague-bridge.ts';
import {loadInlandSurveys} from '../sim/inland-terrain.ts';
import {INLAND_TERRAIN_SHA,INLAND_COVER_SHA} from '../sim/inland-surveys.generated.ts';
import {loadMontagueFoundation,supportedMontagueFoundation} from '../sim/montague-foundation.ts';
import {montagueBankGLSL} from './montague-bank.ts';
import {COASTAL_SPECS} from '../sim/coastal-surveys.generated.ts';
import {LegacyShoreCurtains,appendStockCurtain,stockShoreKey,stockShoreSphere} from './legacy-shore-curtains.ts';
import {montagueShoreReview,seatedMontagueCurtain,type ReviewBounds} from './montague-shore.ts';
import { Terrain, OCEAN_Y, type TerrainSpec } from '../sim/terrain.ts';
import {unpackGzip} from '../sim/compression.ts';
import {loadBasinGround,NativeBank,type NativeBankSource} from '../sim/basin-bank-relief.ts';
import {BASIN_GROUND} from '../sim/basin-bank-relief.generated.ts';
import {BASIN_CHANNEL} from '../sim/basin-head-channel.generated.ts';
import {loadBasinChannel,loadHarbourCover,type WaterInset} from '../sim/harbour-cover.ts';
import {basinChannelGLSL,harbourCoastGLSL} from './harbour-coast.ts';
import { Cover } from '../sim/cover.ts';
import {DETAIL_NEIGHBOURS,DETAIL_NOT_READY,detailBlendGLSL} from './detail-blend.ts';
import {BANK_TILE,basinBankGeometry,basinBankJoins,inBasinBank,intersectsBasinLegacyBank} from './basin-channel-bank.ts';
import type {ShoreSegment} from '../sim/shoreline.ts';
import {basinSandGLSL,basinSandIntersects,loadBasinSand,type BasinSand} from './basin-head-sand.ts';
import { coastSegments } from '../sim/shoreline.ts';
import { allowOrbyZeroArc,ORBY_COVER_SHA } from '../sim/orby-shore-closure.ts';
import { eastBenchGLSL,loadEastBench,type EastBenchMask } from './east-bench.ts';
import {sourisLightingForTerrain,sourisOcclusionGLSL,sourisGroundLightGLSL,type SourisLighting} from './souris-light.ts';
import { eastSandstoneGLSL } from './east-sandstone.ts';
import { lighthouseGroundGLSL } from './lighthouse-ground.ts';
import { loadSouthLake,southLakeGLSL,type SouthLakeMask } from './south-lake.ts';
import { shoreFoamGLSL,brokenShoreFoamGLSL } from './shore-foam.ts';
import {nearshoreFoamGLSL,nearshoreFoamRouterGLSL,nearshoreFoamMatches} from './nearshore-foam.ts';
import {BuildingShadows,buildingShadowGLSL} from './local-building-shadows.ts';
import { DetailImagery } from './detail.ts';
import {detailRetryAt} from './detail-retry.ts';
import { runwayAtlas } from './runway-paint.ts';
import { RUNWAYS,runwayAt } from '../sim/places.ts';
import type { Surface } from '../sim/flight.ts';
const base = import.meta.env.BASE_URL + 'world/';
const BASILICA_RECEIVER_GUARD=project(-63.125295,46.233718);
const vertex=`
 varying vec3 p; varying vec2 vuv;
 #ifdef SOURCE_GRASS_NAP_METRIC
 varying vec3 shortGrassMetric;
 #endif
 #ifdef SURVEY_LIGHT
 attribute float surveyWeight; varying float vSurveyWeight; varying vec3 vSurveyNormal;
 #endif
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
 #ifdef SURVEY_LIGHT
 vSurveyWeight=surveyWeight;vSurveyNormal=mat3(modelMatrix)*normal;
 #endif
 #ifdef SOURCE_GRASS_NAP_METRIC
 shortGrassMetric=mat3(modelMatrix)*position;
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
// The sky is an image of a viewing direction, not distant geometry.
 // A screen surface avoids distant-sphere interpolation and never writes
 // a land or ocean depth sample.
const screenSkyV=`
 uniform mat4 skyInverseProjection,skyEyeToWorld;
 varying vec3 skyRay;
 void main(){
  vec4 dir=skyInverseProjection*vec4(position.xy,1.,1.);
  skyRay=mat3(skyEyeToWorld)*dir.xyz;
  gl_Position=vec4(position.xy,1.,1.);
 }`;
const skyFrag=skyFn+`
 varying vec3 skyRay;uniform float skyDiagnostic;
 void main(){
  if(skyDiagnostic>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}
  vec3 c=skyAt(normalize(skyRay));
  gl_FragColor=vec4(c,1.);`+out;
const waterFrag=(lake:boolean,harbour:boolean,basin:boolean,montague=false,montagueOptics=false,foamDetail=false,baywalk=false,nearshoreFoam=false)=>{
 const foam=nearshoreFoam?'chooseNearshoreFoam(q,uv,shore,t,dist,n,foamFootprint,foamPixelM,foamDX,foamDY,extent.zw,coverMap)':
  foamDetail?'brokenShoreFoam(q,shore,t,dist,n,foamFootprint,foamPixelM)':'shoreFoam(q,shore,t,dist,n,foamFootprint)';
 return fp+skyFn+shoreFoamGLSL+(foamDetail||nearshoreFoam?brokenShoreFoamGLSL:'')+(baywalk?baywalkLandGLSL:'')+(montague?montagueBankGLSL:'')+(lake?southLakeGLSL:'')+(harbour?harbourCoastGLSL:'')+(basin?basinChannelGLSL:'')+(nearshoreFoam?nearshoreFoamGLSL+nearshoreFoamRouterGLSL(foamDetail):'')+`
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
 ${montague?'vec2 reach=montagueWaterSample(q);':''}
 ${montagueOptics?`
 float riverCalm=montagueStillWater(reach);
 if(riverCalm>0.)n*=1.-.61*riverCalm;`:''}
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
 ${basin?'vec2 inlet=basinChannelAt(p.xz);shore=mergeWharfToe(basinChannelFrom(shore,inlet),p.xz);float basinShelter=BasinWetReach(p.xz,inlet);':''}
 ${montague?'shore=montagueFrom(shore,reach);':''}
 ${baywalk?'shore=northCourtDistance(shore,q);':''}
 // Water must not overdraw surveyed land, including nearly flat coasts. A depth
 // comparison alone between an ocean surface and land a few cm above it is fragile.
 // Conservative phase footprint includes the spatial distortion from the
 // foam field. Derivatives are evaluated before discard and the coastal branch.
 float foamPixelM=length(fwidth(q));
 float foamFootprint=.69*fwidth(shore)+.42*foamPixelM;
 ${nearshoreFoam?'vec2 foamDX=dFdx(q),foamDY=dFdy(q);':''}
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
 ${basin?'deep=mix(deep,vec3(.037,.110,.090),.34*basinShelter);':''}
 ${montagueOptics?'if(riverCalm>0.)deep=mix(deep,vec3(.021,.053,.067),riverCalm*.68);':''}
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
  foam=${foam};
  if(shelter>0.){
   // Ocean breaker bands fade well before the stronger basin tint and
   // ripple change. A narrow unsupported bank keeps its former optics.
   float gain=1.-smoothstep(0.,.22,shelter);foam*=gain*gain;
  }
 }
 `:`float foam=${foam};`}
 ${harbour?`if(marinaCalm>0.)foam*=1.-smoothstep(0.,.23,marinaCalm);`:''}
 ${basin?'foam*=1.-.86*basinShelter;':''}
 ${montagueOptics?'if(riverCalm>0.)foam*=1.-smoothstep(0.,.255,riverCalm);':''}
 c=mix(c,vec3(.49,.58,.56),foam);
 gl_FragColor=vec4(mist(c,dist,p.y),1.);`+out;
};
const cliffFrag=(east:boolean,basin=false,baywalk=false)=>fp+(east?eastSandstoneGLSL:'')+(basin?basinChannelGLSL:'')+
  (baywalk?baywalkLandGLSL+baywalkCourtOpticsGLSL:'')+`
 ${baywalk?'uniform sampler2D coverMap;uniform vec4 extent;':''}
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
 ${basin?`
 if(underWharfFacade(p,cameraPosition))discard;
 // A restrained sediment wall; no guessed piling or structural extents.
 vec2 inlet=basinChannelAt(p.xz);
 float use=BasinWetReach(p.xz,inlet);
 vec3 rel=vec3(p.x,p.y,p.z);
 float grain=noise(rel.xz*.83+vec2(0.,rel.y*.71));
 float damp=1.-smoothstep(.13,.61,rel.y);
 vec3 bank=mix(vec3(.24,.215,.156),vec3(.135,.126,.094),damp);
 bank*=.91+.16*grain;
 col=mix(col,bank,use*.94);
 `:''}
 ${baywalk?`
 float old=(texture2D(coverMap,(p.xz-extent.xy)/extent.zw).g*255.-128.)*2.;
 float northMix=smoothstep(.08,.65,-old)*(1.-smoothstep(.13,.46,abs(northCourtSigned(p.xz))));
 if(northMix>0.)col=mix(col,northCourtBankOptics(p),northMix);
 `:''}
 gl_FragColor=vec4(mist(col,d,p.y),1.);`+out;
const landFrag=(east:boolean,bench=false,harbour=false,souris=false,castBuildings=false,showFloor=false,showBasin=false,basin=false,bankSmooth=false,montague=false,baywalkCourt=false,cape=false,bowley=false,meadow=false,fieldPilot=false,provinceFields=false,gablesGravel=false,gablesFairway=false,localTrail=false,dryCoast=false,grassStudy=false,churchSun=false,hogIsland=false,nearGrassNap=false,westDuneAerial=false,duneSandShader='',grassCoastShader='')=>fp+duneSandShader+grassCoastShader+(westDuneAerial?westDuneAerialGLSL:'')+(hogIsland?hogPhotoGLSL:'')+(churchSun?churchSunGLSL:'')+(grassStudy?provinceGrassGLSL:'')+(nearGrassNap?sourceGrassNapGLSL:'')+(dryCoast?drySoilGLSL:'')+(localTrail?gablesTrailGLSL:'')+(gablesFairway?gablesFairwayGLSL:'')+(gablesGravel?gablesGravelGLSL:'')+(provinceFields?provinceFieldOpticsGLSL:'')+(fieldPilot?fieldPilotGLSL:'')+(meadow?meadowGLSL:'')+(bowley?bowleyClipGLSL:'')+lighthouseGroundGLSL+(cape?northCapeShadowGLSL:'')+(baywalkCourt?baywalkLandGLSL+baywalkCourtOpticsGLSL:'')+(montague?montagueBankGLSL:'')+(east?eastSandstoneGLSL:'')+(bench?eastBenchGLSL:'')+(harbour?harbourCoastGLSL:'')+(basin?basinChannelGLSL:'')+(souris?sourisOcclusionGLSL+sourisGroundLightGLSL:'')+(castBuildings?buildingShadowGLSL:'')+(showFloor?forestFloorGLSL:'')+detailBlendGLSL+(showBasin?basinSandGLSL:'')+`
 #ifdef SURVEY_LIGHT
 varying float vSurveyWeight; varying vec3 vSurveyNormal;
 #endif
 uniform sampler2D imageMap,coverMap,detailMap,paintMap; uniform float hasDetail;uniform vec4 detailBox;
 uniform vec4 airport[3];uniform vec2 stripSize[3];
 ${showFloor&&montague?'uniform vec4 montagueGroundBounds;':''}
 void main(){
 #include <logdepthbuf_fragment>
 ${nearGrassNap?`
 // Derivatives must execute before any pixel-varying condition or discard.
 // The uniform test avoids doing this work on high or inactive frames.
 vec3 napDx=vec3(0.),napDy=vec3(0.);
 if(shortGrassNapMix>.001){
  napDx=dFdx(shortGrassMetric);
  napDy=dFdy(shortGrassMetric);
 }
 `:''}
 vec2 cover=texture2D(coverMap,vuv).rg;float coast=(cover.g*255.-128.)*2.;
 ${harbour?'coast=harbourDistance(coast,p.xz);':''}
 ${basin?'if(basinChannelDistance(coast,p.xz)<0.)discard;':''}
 ${montague?'if(montagueWaterDistance(coast,p.xz)<0.)discard;':''}
 ${baywalkCourt?'if(coast>=0.||northCourtSigned(p.xz)<=0.)discard;':'if(coast<0.)discard;'}
 ${bowley?'/* Do not remove terrain if this screen sample has no verified level-water replacement. */ if(bowleyDistance(p.xz)<0.&&bowleyRasterDistance()<0.)discard;':''}
 vec2 uv=vec2(vuv.x,1.-vuv.y);
 vec2 q=(vuv-detailBox.xy)*detailBox.zw;
 float amount=hasDetail>.5?detailAmount(q):0.;
 // Use original unwrapped derivatives so crossing a feather boundary cannot
 // switch mip levels on either image. Settled tiles take one texture sample.
 vec2 detailUV=vec2(q.x,1.-q.y),du=dFdx(detailUV),dv=dFdy(detailUV);
 vec2 bu=dFdx(uv),bv=dFdy(uv);
 vec3 col;
 if(amount<=0.)col=textureGrad(imageMap,uv,bu,bv).rgb;
 else{
  col=textureGrad(detailMap,detailUV,du,dv).rgb;
  if(amount<1.)col=mix(textureGrad(imageMap,uv,bu,bv).rgb,col,amount);
 }
 // The Sentinel-2 TCI product linearly maps 0–25% BOA reflectance
 // to display bytes. Interpret the same scale for both texture LODs
 // before applying the scene's light and tone mapping.
 col*=.25;
 ${hogIsland?'paintHogPhoto(col,p,distance(cameraPosition,p),coast);':''}
 ${westDuneAerial?'paintWestDuneAerial(col,p,coast);':''}
 vec3 n=normalize(cross(dFdx(p),dFdy(p)));if(n.y<0.)n=-n;
 ${duneSandShader?'paintDuneSand(col,n,p,coast,distance(cameraPosition,p));':''}
 ${grassCoastShader?'paintDuneTuftGround(col,n,p,coast);':''}
 ${nearGrassNap?`
 float napAuthority=0.;
 if(shortGrassNapMix>.001&&coast>=82.){
  vec3 napMetricN=normalize(cross(napDx,napDy));
  if(napMetricN.y<0.)napMetricN=-napMetricN;
  if(napMetricN.y>=.76&&distance(cameraPosition,p)<=18.){
   napAuthority=shortGrassNapAuthority(p.xz);
   // World-X/Z interpolation loses small derivative differences in western
   // near terrain. Compute the very same face normal before translation.
   // No input to unadmitted pieces, or the high frame, is changed.
   if(napAuthority>.001)n=napMetricN;
  }
 }
 `:''}
 ${bankSmooth&&castBuildings?'vec3 bankShadowReceiver=n;':''}
 #ifdef SURVEY_LIGHT
 ${bankSmooth?'if(vSurveyWeight>0.)':''}n=normalize(mix(n,normalize(vSurveyNormal),vSurveyWeight));
 #endif
 float d=distance(cameraPosition,p);
 ${showFloor&&castBuildings?'vec3 receiverPlane=n;':''}
 ${meadow&&castBuildings?'vec3 meadowReceiver=n;':''}
 ${showFloor?`
 bool preserveFloor=false;
 if(forestFloorMix>.001&&d<260.){
  ${montague?`preserveFloor=all(greaterThanEqual(p.xz,montagueGroundBounds.xy))&&all(lessThanEqual(p.xz,montagueGroundBounds.zw));`:''}
  for(int k=0;k<3;k++){
   vec2 offs=p.xz-airport[k].xy,axis=airport[k].zw;
   float along=dot(offs,axis), across=abs(dot(offs,vec2(-axis.y,axis.x)));
   if(along>=-34.&&along<=stripSize[k].x+34.&&across<=stripSize[k].y*.5+34.)preserveFloor=true;
  }
 }
 enrichWoodlandFloor(col,n,coverMap,vuv,p,d,coast,preserveFloor);`:''}
 ${meadow?`
 // Also protect the inputs to the existing runway paint/light shader:
 // exact cover class alone does not prove a grass pixel is off-runway.
 float meadowFootprint=max(length(dFdx(p.xz)),length(dFdy(p.xz)));
 bool awayFromRunway=true;
 if(abs(meadowStrength)>.001&&d<180.&&coast>185.){
  for(int i=0;i<3;i++){
   vec2 off=p.xz-airport[i].xy,axis=airport[i].zw;
   float along=dot(off,axis),across=abs(dot(off,vec2(-axis.y,axis.x)));
   if(along>=-42.&&along<=stripSize[i].x+42.&&across<=stripSize[i].y*.5+30.)awayFromRunway=false;
  }
  if(awayFromRunway)decorateMeadow(col,n,p,vuv,coverMap,coast,d,meadowFootprint);
 }
 `:''}
 ${fieldPilot?'paintDatedFields(col,n,p,d,coast);':''}
 ${provinceFields?(grassStudy?'float liveField=':'')+'paintProvinceFields(col,n,p,d,coast);':''}
 ${grassStudy?'shadeSourceGrass(col,n,p,d,coast,'+(provinceFields?'liveField':'0.')+');':''}
 ${gablesGravel?'paintGablesGravel(col,p,d,coast);':''}
 ${gablesFairway?'paintGablesFairway(col,p,d);':''}
 ${localTrail?'lowerHauntedTrail(col,p,d,coast);':''}
 ${dryCoast?'col=lowMaritimeSoil(col,p,n,coast,d,vuv,coverMap);':''}
 float light=clamp(dot(n,sun),0.,1.);
 // Inferred low beach substrate vs higher headlands; not a survey of coastal geology.
 float beach=(1.-smoothstep(4.,25.,coast))*(1.-smoothstep(4.,14.,p.y));
 float cliff=(1.-smoothstep(3.,15.,coast))*smoothstep(3.,16.,p.y);
 ${baywalkCourt?'col=northCourtDryOptics(p,coast);beach=0.;cliff=0.;':''}
 col=mix(col,vec3(.47,.34,.20)*(.89+.16*noise(p.xz*.057)),beach*.79);
 col=mix(col,vec3(.23,.091,.054),cliff*.7);
 float detailFade=1.-smoothstep(290.,1900.,d);
 // The cover category alone cannot establish a crop or a row bearing.
 // Leave field patterns to the georeferenced imagery. The existing neutral
 // surface grain is unchanged so unclassified land has no new styling.
 col*=1.+detailFade*(.13*(noise(p.xz*.46)-.5));
 ${showBasin?'col=basinSand(col,p,n,coast,d);':''}
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
 ${castBuildings?` float castShade=buildingShade(p,${bankSmooth?'bankShadowReceiver':showFloor?'receiverPlane':meadow?'meadowReceiver':'n'},d);
 col*=mix(vec3(1.),vec3(.69,.74,.81),castShade*(.39+.61*light));`:''}
 ${churchSun?`float churchOcc=churchDirectOcclusion(p,d,coast);
 col*=(.90+.31*light*(1.-.96*churchOcc))*mix(vec3(1.),vec3(.94,.97,1.),churchOcc*light);`:'col*=.90+.31*light;'}
 ${cape?`float castCape=capeShade(p,sun,d);
 col*=mix(vec3(1.),vec3(.54,.60,.65),castCape);`:''}
 ${souris?'col=sourisSoil(col,p,detailFade,max(length(dFdx(p.xz)),length(dFdy(p.xz))));':''}
 for(int i=0;i<3;i++){
  vec2 delta=p.xz-airport[i].xy,axis=airport[i].zw;float along=dot(delta,axis)/stripSize[i].x;
  float across=dot(delta,vec2(-axis.y,axis.x))/stripSize[i].y+.5;
  if(along>=0.&&along<=1.&&across>=0.&&across<=1.){vec2 u=vec2((float(i)+clamp(across,.005,.995))/3.,1.-along);col=texture2D(paintMap,u).rgb*(.90+.17*light);break;}
 }
 ${nearGrassNap?'if(napAuthority>.001)sourceGrassNap(col,n,p,d,coast,napAuthority,'+(provinceFields?'liveField':'0.')+',napDx.xz,napDy.xz);':''}
 gl_FragColor=vec4(mist(col,d,p.y),1.);`+out;
export type BaywalkRegistration={court:BaywalkCourtData;deck:SpinnakersDeck;road:readonly RoadPoint[]};
export async function loadAtlas(progress:(s:string)=>void,tryInland=false,tryBasin=false,tryBasinChannel=false,montagueRoadVerified?:Promise<boolean>,tryWharfToe=false,
 baywalkRequested?:Promise<BaywalkRegistration|undefined>,bowleyRequested?:Promise<BowleyPond|undefined>,verifyCoverForReview=false,verifySky?:VerifyAerialSky){
 const foundationJob=montagueRoadVerified?loadMontagueFoundation(base):Promise.resolve(undefined);
 const surveys=loadCoastalSurveys(base),bench=loadEastBench(base),southLake=loadSouthLake(base);
 // The elevation manifest does not describe the colour, cover, or sky assets.
 // Start their independent reads together; keep all required failures attached
 // to one promise and establish the world only after every layer can be decoded.
 const localSand=tryBasin?loadBasinSand(base):Promise.resolve(undefined);
 const elevationJob=loadElevation(progress);
 const bankJob=tryBasinChannel?loadBasinGround(base):Promise.resolve(undefined);
 const skyAsset=base+'maritime-sky.webp',stockSky=(s:string)=>new THREE.TextureLoader().loadAsync(s);
 let certifiedSky:VerifiedAerialSky|undefined;
 const skyJob=verifySky?verifySky(skyAsset,stockSky).then(checked=>{
  certifiedSky=checked;
  return checked?.texture??stockSky(skyAsset);
 },()=>stockSky(skyAsset)):stockSky(skyAsset);
 const [elevation,img,cover,sky,requestedBank]=await Promise.all([
  elevationJob,
  new THREE.TextureLoader().loadAsync(base+'color.webp'),
  loadCover(tryBasinChannel,!!montagueRoadVerified||!!baywalkRequested||!!bowleyRequested||verifyCoverForReview),
  skyJob,bankJob
 ]);
 img.colorSpace=THREE.NoColorSpace;img.anisotropy=4;
 sky.colorSpace=THREE.SRGBColorSpace;sky.wrapS=THREE.RepeatWrapping;
 const installed=await surveys;
 const inland=tryInland&&elevation.spec.sha256===INLAND_TERRAIN_SHA&&cover.sourceSha===INLAND_COVER_SHA?await loadInlandSurveys(base):[];
 const bankGround=cover.basin?.plan.sha256===BASIN_GROUND.pinBasinSha256&&elevation.spec.sha256===BASIN_GROUND.pinTerrainSha256?requestedBank:undefined;
 // Each local geography installs independently with its coherent terrain.
 const basin=bankGround?cover.basin:undefined;
 const foundation=supportedMontagueFoundation(cover.sourceSha,elevation.spec.sha256,cover.sourceDecodedSha)&&await montagueRoadVerified?
  await foundationJob:undefined;
 const wharfToe=tryWharfToe&&!!basin;
 const priorCover=foundation||basin!==cover.basin||wharfToe?
  new Cover(cover.width,cover.height,cover.bytes,cover.harbour,cover.sourceSha,basin,foundation?.water,cover.sourceDecodedSha,wharfToe):cover;
 const terrain=new Terrain(elevation.spec,new Int16Array(elevation.data),foundation?[...installed,foundation.ground]:installed,inland);
 const requested=baywalkRequested&&supportedBaywalkCourt(priorCover.sourceSha,elevation.spec.sha256,priorCover.sourceDecodedSha)?await baywalkRequested:undefined;
 const maybeCourt=requested?new BaywalkNative(requested.court):undefined;
 const court=maybeCourt&&requested&&verifiedBaywalkDeckClearance(requested.deck,priorCover,terrain,maybeCourt)&&verifiedBaywalkRoadSupport(requested.road,priorCover,terrain,maybeCourt)?maybeCourt:undefined;
 const committedCover=court?new Cover(priorCover.width,priorCover.height,priorCover.bytes,priorCover.harbour,priorCover.sourceSha,
  priorCover.basin,priorCover.montague,priorCover.sourceDecodedSha,priorCover.wharfToe,court):priorCover;
 const bowley=bowleyRequested&&bowleyAtlasMatches(elevation.spec.sha256,committedCover.sourceSha,committedCover.sourceDecodedSha)?await bowleyRequested:undefined;
 return {terrain,terrainSha:elevation.spec.sha256,img,cover:committedCover,sky,certifiedSky,bankGround,bowley,
   basinSand:await localSand,bench:installed.some(s=>!!s.cliff)?await bench:undefined,southLake:await southLake,sourisLighting:sourisLightingForTerrain(base,elevation.spec.sha256)};
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
async function loadCover(tryBasin=false,verifyOptionalGeography=false){
 const land=fetch(base+'cover.json'),bytes=fetch(base+'cover.bin.gz');
 const [cmeta,coverData,harbour,basin]=await Promise.all([land,bytes,loadHarbourCover(base),tryBasin?loadBasinChannel(base):undefined]);
 if(!cmeta.ok||!coverData.ok)throw Error('The coastline and forest atlas could not be loaded.');
 const cs=await cmeta.json();const cb=await unpackGzip(await coverData.arrayBuffer());
 let checkedBasin:WaterInset|undefined,decodedSha:string|undefined;
 // Authenticate decoded data once for either optional geography. CDN
 // decompression cannot bypass a source pin.
 if((basin?.plan.pinCoverSha256===cs.compressedSha256||verifyOptionalGeography)&&globalThis.crypto?.subtle){
  const hash=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',cb));
  decodedSha=Array.from(hash,x=>x.toString(16).padStart(2,'0')).join('');
  if(basin?.plan.pinCoverSha256===cs.compressedSha256&&decodedSha===BASIN_CHANNEL.pinCoverDecodedSha256)checkedBasin=basin;
 }
 return new Cover(cs.width,cs.height,new Uint8Array(cb),harbour?.plan.pinCoverSha256===cs.compressedSha256?harbour:undefined,
   cs.compressedSha256,checkedBasin,undefined,decodedSha);
}
type ActiveRelief={mesh:ReturnType<typeof adaptiveGround>;base:THREE.BufferGeometry};
const KINGS_CROWN_TILE=KINGS_DRY_CROWN.tileX+'-'+KINGS_DRY_CROWN.tileZ;
type KingsCrownStage={owner:Patch;stock:THREE.Mesh;measured:THREE.Mesh;morph:KingsCrownMorph};
type StMarysProposedGround=Readonly<{mesh:THREE.Mesh;gradeId:string;bounds:readonly [number,number,number,number];inChangedSupport:(x:number,z:number)=>boolean}>;
interface Patch { relief?:ActiveRelief; id:string;i:number;j:number;lod:number;seams?:string;local:THREE.ShaderMaterial;status:'idle'|'loading'|'ready'|'missing'|'uncovered';retryAt?:number;failures?:number;detail?:THREE.Texture;detailSince?:number;coarse:THREE.Mesh;fine?:THREE.Mesh; x0:number;z0:number;w:number;d:number; }
export class World {
 private shoreFaces:THREE.Mesh[]=[];
 private legacyShore?:LegacyShoreCurtains;
 get legacyShoreState(){return this.legacyShore?.state??null;}
 private northCourt?:BaywalkGround;
 private pondMeshes:BowleyWaterMesh[]=[];
 hasFreshwaterSource(id:string){return this.pondMeshes.some(v=>v.pond.spec.id===id);}
 get bowleyPond(){return this.pondMeshes.find(p=>p.pond.spec.id.startsWith('bowley-'))?.pond.spec.id??null;}
 private freshwaterAt(x:number,z:number){
  for(const {pond} of this.pondMeshes)if(pond.water(x,z))return pond;
 }
 freshwaterContains(x:number,z:number){return this.freshwaterAt(x,z)!==undefined;}
 // The historical browser QA probes distinguish this study from other water.
 bowleyContains(x:number,z:number){return this.pondMeshes.find(p=>p.pond.spec.id.startsWith('bowley-'))?.pond.water(x,z)??false;}
 private northCurtain?:{mesh:THREE.Mesh;segments:readonly ShoreSegment[];signature?:string};
 get baywalkActive(){return !!this.northCourt;}
 get baywalkBounds(){return this.northCourt?.signatureBounds;}
 private montagueReviewShore?:{mesh:THREE.Mesh;segments:readonly ShoreSegment[];bounds:ReviewBounds;revision?:string};
 private readonly bankGround?:NativeBank;
 private bank?:{material?:THREE.ShaderMaterial;batches:{mesh:THREE.Mesh;full:THREE.BufferGeometry;near:THREE.BufferGeometry}[];
   close?:THREE.Mesh;segments:ShoreSegment[];joins:ReturnType<typeof basinBankJoins>};private tiles:Patch[]=[];private byId=new Map<string,Patch>();private mat:THREE.ShaderMaterial;private sky:THREE.Mesh;
 /** Install a small, signed local light receiver without replacing terrain or its masks. */
 mountGeorgetownGroundSun(mask:ChurchGroundSun){
  const [m,n]=mask.tile;
  if(m!==24||n!==17||this.buildingShadows)return false;
  const target=this.byId.get(m+'-'+n);
  if(!target||target.lod!==112||target.relief)return false;
  const material=target.local,stock=material.fragmentShader;
  const head='void main(){',receive='col*=.90+.31*light;';
  if(stock.includes('churchDirectOcclusion(')||stock.split(head).length!==2||stock.split(receive).length!==2)return false;
  material.fragmentShader=stock.replace(head,churchSunGLSL+'\n'+head).replace(receive,`
   float georgetownSun=churchDirectOcclusion(p,d,coast);
   col*=(.90+.31*light*(1.-.96*georgetownSun))*mix(vec3(1.),vec3(.94,.97,1.),georgetownSun*light);
  `);
  Object.assign(material.uniforms,mask.uniforms);
  material.needsUpdate=true;return true;
 }
 private groundVersion=0;
 private reliefPacks?:ReliefPacks;
 private reliefSeed=new Map<string,ReliefSeed>();
 private reliefPending=new Set<string>();
 private reliefFailed=new Set<string>();
 private reliefEmpty=new Set<string>();
 private reliefActive=new Set<Patch>();
 private reliefRefresh=-Infinity;
 private reliefX=Infinity;private reliefZ=Infinity;
 private t={value:0};private detailClock={value:0};private recent=0;private readonly details:DetailImagery;private loading=0;private lastX=0;private lastZ=0;
 readonly coastalBenches:readonly string[]; readonly shelteredWater:readonly string[];
 readonly buildingShadows?:BuildingShadows;
 private readonly floor?:ForestFloor;
 readonly shoreToneGain={value:1};
 readonly nearshoreFoamMode={value:0};
 readonly nearshoreFoamArmed:boolean;
 readonly meadowStrength={value:1};
 readonly gravelStrength={value:0};
 readonly trailStrength={value:0};
 readonly rusticoSoilStrength={value:0};
 private readonly grades?:ReadonlyMap<string,BoundedGrade>;
 private readonly kingsGrade?:BoundedGrade;
 private kingsStage?:KingsCrownStage;
 private kingsStageFailed=false;
 private stagedChurch?:{owner:Patch;grade:BoundedGrade;stock:THREE.Mesh;candidate:THREE.Mesh;seams?:string;source:StMarysProposedGround};
 private readonly grassStudy?:ProvinceGrassStudy;
 readonly capeShadow?:NorthCapeShadow;
 readonly sun=new THREE.Vector3(-.60,.74,-.31).normalize();
 constructor(readonly scene:THREE.Scene,readonly terrain:Terrain, img:THREE.Texture,readonly renderer:THREE.WebGLRenderer,readonly cover:Cover,sky:THREE.Texture,bench?:EastBenchMask,southLake?:SouthLakeMask,sourisLighting?:SourisLighting,castBuildings=false,showFloor=false,showBasinBank=false,basinSand?:BasinSand,bankGround?:NativeBankSource,montagueOptics=false,legacyShore=false,wharfFacade=false,foamDetail=false,northCapeWind=false,bowley?:BowleyPond,meadow=false,readonly fieldPilot?:FieldPilot,readonly provinceFields?:ProvinceFieldStudy,additionalPonds:readonly BowleyPond[]=[],localGrade?:BoundedGrade|readonly BoundedGrade[],gablesGravel=false,fairway?:GablesFairway,trail=false,rusticoSoil?:BoundedGrade,grassStudy?:ProvinceGrassStudy,churchGroundSun?:ChurchGroundSun,readonly hogPhoto?:HogPhoto,readonly westDuneOptics?:WestDuneOptics,duneSand?:DuneSand,grassCoast?:DuneGrassSurface,aerial?:AerialWorldOptics,orbyClosure=false,readonly orthoSeams?:OrthophotoSeams,shoreTone=false,nearshoreFoam=false){
  this.details=new DetailImagery(orthoSeams?.verifiedDetail);
  const air=aerial?.accepts(sky)?aerial:undefined;
  const sceneShader=(opt:THREE.ShaderMaterialParameters)=>{
   const m=new THREE.ShaderMaterial(opt);return air?air.bind(m):m;
  };
  this.grassStudy=grassStudy;
  if(localGrade)this.grades=boundedGradeTiles('grid' in localGrade?[localGrade]:localGrade);
  const king=this.grades?.get(KINGS_CROWN_TILE);
  if(king?.grid.spec===KINGS_DRY_CROWN)this.kingsGrade=king;
  this.capeShadow=northCapeWind?new NorthCapeShadow():undefined;
   if(bankGround&&cover.basin)this.bankGround=new NativeBank(terrain,bankGround);
   if(showFloor)this.floor=new ForestFloor(import.meta.env.BASE_URL);
   if(castBuildings)this.buildingShadows=new BuildingShadows(renderer,this.sun);
   const T=terrain,east=T.coastalGrids.find(g=>g.cliff);
   const montagueGround=T.coastalGrids.find(g=>g.spec.id===MONTAGUE_GROUND_ID);
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
   const uniforms={...(air?{atmosphericLabGain:air.gain}:{}),detailClock:this.detailClock,detailReady:{value:DETAIL_NOT_READY},detailSize:{value:new THREE.Vector2(1,1)},
       detailCardinal:{value:new THREE.Vector4().setScalar(DETAIL_NOT_READY)},detailDiagonal:{value:new THREE.Vector4().setScalar(DETAIL_NOT_READY)},eastRockBounds,rippleMap:{value:ripple},sun:{value:this.sun},clock:this.t,imageMap:{value:img},skyMap:{value:sky},coverMap:{value:cm},detailMap:{value:img},hasDetail:{value:0},detailBox:{value:new THREE.Vector4(0,0,1,1)},paintMap:{value:paint.map},airport:{value:paint.orig},stripSize:{value:paint.size},extent:{value:new THREE.Vector4(T.left,T.top,T.right-T.left,T.bottom-T.top)}};
   const make=(fragmentShader:string,side:THREE.Side=THREE.FrontSide)=>sceneShader({uniforms,vertexShader:vertex,fragmentShader,side});
   const skyInverseProjection={value:new THREE.Matrix4()},skyEyeToWorld={value:new THREE.Matrix4()};
   const ponds=admitPondTiles(bowley?[bowley,...additionalPonds]:additionalPonds,{
    left:T.left,top:T.top,right:T.right,bottom:T.bottom,columns:WORLD_COLS,rows:WORLD_ROWS,
   });
   const bowleyViewport=ponds.length?{value:new THREE.Vector4(0,0,1,1)}:undefined;
   const skyMaterial=sceneShader({vertexShader:screenSkyV,fragmentShader:skyFrag,
     uniforms:{skyMap:{value:sky},skyInverseProjection,skyEyeToWorld,skyDiagnostic:{value:0}},
     depthTest:false,depthWrite:false});
   this.sky=new THREE.Mesh(new THREE.PlaneGeometry(2,2),skyMaterial);this.sky.renderOrder=-10;
   this.sky.onBeforeRender=(_renderer,_s,view)=>{
    skyInverseProjection.value.copy(view.projectionMatrixInverse);skyEyeToWorld.value.copy(view.matrixWorld);
    if(bowleyViewport)_renderer.getCurrentViewport(bowleyViewport.value);
   };
   this.sky.frustumCulled=false;scene.add(this.sky);
   const harbour=cover.harbour,basin=cover.basin,montague=cover.montague;
   const insetUniforms=(local:WaterInset|undefined,prefix:string):Record<string,THREE.IUniform>=>{
    if(!local)return {};
    const {width,height,boundsXZ}=local.plan;
    const map=new THREE.DataTexture(local.bytes,width,height,THREE.RGFormat);
    map.magFilter=map.minFilter=THREE.LinearFilter;map.needsUpdate=true;
    return {[prefix+'Mask']:{value:map},[prefix+'Bounds']:{value:new THREE.Vector4(...boundsXZ)},
      [prefix+'Size']:{value:new THREE.Vector2(width,height)}};
   };
   const harbourUniforms=insetUniforms(harbour,'harbour'),basinUniforms=insetUniforms(basin,'basinChannel');
   const montagueUniforms=insetUniforms(montague,'montagueWater');
   const northCourtUniforms=cover.baywalk?baywalkUniforms(cover.baywalk):{};
   const pondsWithUniforms=ponds.map(pond=>({pond,surfaceUniforms:{...bowleyUniforms(pond),
     bowleyInverseProjection:skyInverseProjection,bowleyEyeToWorld:skyEyeToWorld,bowleyViewport:bowleyViewport!}}));
   this.nearshoreFoamArmed=nearshoreFoam&&nearshoreFoamMatches(cover)&&[-64.47,45.94,-61.93,47.1].every((n,i)=>T.spec.bounds[i]===n);
   this.nearshoreFoamMode.value=this.nearshoreFoamArmed?2:foamDetail?1:0;
   const oceanMaterial=make(waterFrag(!!southLake,!!harbour,!!basin,!!montague,!!montague&&montagueOptics,foamDetail,!!cover.baywalk,this.nearshoreFoamArmed));
   if(cover.wharfToe)oceanMaterial.defines.BASIN_WHARF_TOE=1;
   if(harbour||basin||montague||cover.baywalk)oceanMaterial.uniforms={...uniforms,...harbourUniforms,...basinUniforms,...montagueUniforms,...northCourtUniforms};
   if(this.nearshoreFoamArmed)oceanMaterial.uniforms={...oceanMaterial.uniforms,nearshoreFoamMode:this.nearshoreFoamMode};
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
   let inletBank:THREE.ShaderMaterial|undefined;
   if(basin){
    inletBank=make(cliffFrag(false,true),THREE.DoubleSide);inletBank.uniforms={...uniforms,...basinUniforms};
    if(cover.wharfToe)inletBank.defines.BASIN_WHARF_TOE=1;if(wharfFacade)inletBank.defines.BASIN_WHARF_FACADE=1;
   }
   let northBank:THREE.ShaderMaterial|undefined;
   if(cover.baywalk){
    northBank=make(cliffFrag(false,false,true),THREE.DoubleSide);
    northBank.uniforms={...uniforms,...northCourtUniforms};
   }
   this.addShoreFaces(make(cliffFrag(false),THREE.DoubleSide),east?make(cliffFrag(true),THREE.DoubleSide):undefined,showBasinBank,inletBank,legacyShore,northBank,orbyClosure);
   const nx=WORLD_COLS,nz=WORLD_ROWS,w=(T.right-T.left)/nx,d=(T.bottom-T.top)/nz;
   const protectsFloor=(i:number,j:number)=>{
    if(i<0||i>=nx||j<0||j>=nz)return true;
    if(T.surveyGrids.some(g=>g.spec.id!==MONTAGUE_GROUND_ID&&g.spec.tileX===i&&g.spec.tileZ===j))return true;
    const x=T.left+i*w,z=T.top+j*d;
    return !!(harbour?.intersects(x,z,x+w,z+d)||sourisLighting?.intersects(x,z,x+w,z+d));
   };
   const coastSoilUniforms=rusticoSoil?{...makeDrySoilUniforms(rusticoSoil),drySoilMix:this.rusticoSoilStrength}:undefined;
   const neighbours=[[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]] as const;
   const protectsMeadow=(i:number,j:number)=>{
    if(protectsFloor(i,j))return true;
    const x=T.left+i*w,z=T.top+j*d;
    // Preserve the historical Bowley review guard without disabling a whole
    // tile of independent dry meadow around a tightly surveyed new pond.
    // The land shader already clips its exact water replacement footprint.
    return !!(basin?.intersects(x,z,x+w,z+d)||montague?.intersects(x,z,x+w,z+d)||bowley?.intersects(x,z,x+w,z+d));
   };

   for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x0=T.left+i*w,z0=T.top+j*d;
    const sx=Math.floor(i*T.spec.width/nx),ex=Math.ceil((i+1)*T.spec.width/nx);
    const sy=Math.floor(j*T.spec.height/nz),ey=Math.ceil((j+1)*T.spec.height/nz);
    let any=false;outer:for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++)if(T.samples[y*T.spec.width+x]!==-32768){any=true;break outer;}
    if(!any)continue;
    const surveyedBank=this.bankGround?.grid.spec.tileX===i&&this.bankGround.grid.spec.tileZ===j;
    const survey=surveyedBank||T.coastalGrids.some(g=>g.spec.tileX===i&&g.spec.tileZ===j);
    const rock=i===east?.spec.tileX&&j===east.spec.tileZ;
    const localRusticoSoil=!!coastSoilUniforms&&i===DRY_FRAME.tile[0]&&j===DRY_FRAME.tile[1];
    const useBench=rock&&!!benchMap;
    const localBasin=basin?.intersects(x0,z0,x0+w,z0+d)??false;
    const localHarbour=harbour?.intersects(x0,z0,x0+w,z0+d)??false;
    const localMontague=montague?.intersects(x0,z0,x0+w,z0+d)??false;
    const sourisLocal=!!sourisLighting?.intersects(x0,z0,x0+w,z0+d);
    const localFairway=fairway?.intersects(x0,z0,x0+w,z0+d)?fairway:undefined;
    const localTrail=trail&&gablesTrailIntersects(x0,z0,x0+w,z0+d);
    const localGravel=gablesGravel&&gablesGravelIntersects(x0,z0,x0+w,z0+d);
    const localPond=pondsWithUniforms.find(v=>v.pond.intersects(x0,z0,x0+w,z0+d));
    const bowleyLocal=!!localPond;
    const localSand=basinSand&&basinSandIntersects(x0,z0,x0+w,z0+d)?basinSand:undefined;
    const showLocalFloor=!!this.floor&&!protectsFloor(i,j);
    const guard=showLocalFloor?neighbours.reduce((m,[x,z],bit)=>protectsFloor(i+x,j+z)?m|(1<<bit):m,0):0;
    const floorUniforms=showLocalFloor?{...this.floor!.uniforms,floorTileGuard:{value:guard},
       floorTileBounds:{value:new THREE.Vector4(x0,z0,x0+w,z0+d)},
       ...(localMontague&&montagueGround?{montagueGroundBounds:{value:new THREE.Vector4(
          montagueGround.x0,montagueGround.z0,montagueGround.x1,montagueGround.z1)}}:{})}:{};
    const hasCape=this.capeShadow?.intersects(x0,z0,x0+w,z0+d)??false;
    const showMeadow=meadow&&!protectsMeadow(i,j);
    const meadowGuard=showMeadow?neighbours.reduce((m,[x,z],bit)=>protectsMeadow(i+x,j+z)?m|(1<<bit):m,0):0;
    const meadowUniforms:Record<string,THREE.IUniform>=showMeadow?{meadowStrength:this.meadowStrength,meadowTileGuard:{value:meadowGuard},
      meadowTileBounds:{value:new THREE.Vector4(x0,z0,x0+w,z0+d)}}:{};
    const benchUniforms:Record<string,THREE.IUniform>=useBench?{eastBenchMask:{value:benchMap},eastBenchBounds:{value:benchBounds}}:{};
    const useField=fieldPilot&&fieldPilot.covers(x0,z0,x0+w,z0+d);
    const localField:Record<string,THREE.IUniform>=useField?{cropPilotMap:fieldPilot.map,farmlandScan:fieldPilot.scan,cropPilotStrength:fieldPilot.strength,cropPilotBoxes:fieldPilot.boxes}:{};
    const provinceHere=provinceFields&&!survey&&!localHarbour&&!localBasin&&!localMontague&&!sourisLocal&&!bowleyLocal&&!useBench&&!hasCape&&provinceFields.stream.intersects(x0,z0,x0+w,z0+d);
    const grassHere=grassStudy&&!localRusticoSoil&&!survey&&!localHarbour&&!localBasin&&!localMontague&&!sourisLocal&&!bowleyLocal&&!useBench&&!hasCape&&grassStudy.stream.intersects(x0,z0,x0+w,z0+d);
    const grassUniforms:Record<string,THREE.IUniform>=grassHere?grassStudy.uniforms:{};
    const churchHere=churchGroundSun&&i===churchGroundSun.tile[0]&&j===churchGroundSun.tile[1]?churchGroundSun:undefined;
    const hogHere=hogPhoto?.pieces.find(piece=>piece.tile[0]===i&&piece.tile[1]===j);
    const duneSandHere=!survey&&!useBench?duneSand?.uniforms(i,j):undefined;
    const grassCoastHere=!survey&&!useBench?grassCoast?.uniforms(i,j):undefined;
    const duneHere=westDuneOptics&&i===westDuneOptics.tile[0]&&j===westDuneOptics.tile[1]?westDuneOptics:undefined;
    const provinceUniforms:Record<string,THREE.IUniform>=provinceHere?{...provinceFields.stream.uniforms,
       provinceFurrowScan:provinceFields.scan,provinceFieldStrength:provinceFields.toggle}:{};
    // Preserve the independently reviewed site materials as a whole.
    const tone=shoreTone&&!survey&&!rock&&!localHarbour&&!localBasin&&!localMontague&&
       !bowleyLocal&&!sourisLocal&&!hasCape&&!localSand&&!localRusticoSoil&&!duneSandHere&&!grassCoastHere&&!showLocalFloor;
    const landFragment=landFrag(rock,useBench,localHarbour,sourisLocal,!!this.buildingShadows,showLocalFloor,!!localSand,localBasin,surveyedBank,localMontague,false,hasCape,bowleyLocal,showMeadow,!!useField,!!provinceHere,localGravel,!!localFairway,localTrail,localRusticoSoil,!!grassHere,!!churchHere,!!hogHere,!!grassHere&&!!grassStudy.nap,!!duneHere,duneSandHere?duneSand?.shader:'',grassCoastHere?grassCoast?.shader:'');
    const local=sceneShader({defines:{...(grassHere&&grassStudy.nap?{SOURCE_GRASS_NAP_METRIC:1}:{}),...(survey?{SURVEY_LIGHT:1}:{}),...(localBasin&&cover.wharfToe?{BASIN_WHARF_TOE:1}:{})},uniforms:{...uniforms,...(tone?{shoreToneGain:this.shoreToneGain}:{}),...churchHere?.uniforms,...hogHere?.uniforms,...duneHere?.uniforms,...duneSandHere,...grassCoastHere,...(localRusticoSoil?coastSoilUniforms:{}),...this.buildingShadows?.uniforms,...(hasCape?this.capeShadow?.uniforms:{}),...meadowUniforms,...localField,...provinceUniforms,...grassUniforms,...localFairway?.uniforms(),...floorUniforms,...benchUniforms,...localSand,...(localHarbour?harbourUniforms:{}),...(localBasin?basinUniforms:{}),...(localMontague?montagueUniforms:{}),...localPond?.surfaceUniforms,...(localGravel?{localGravelStrength:this.gravelStrength}:{}),...(localTrail?{gablesTrailStrength:this.trailStrength}:{}),...(sourisLocal?sourisLighting?.uniforms:{}),hasDetail:{value:0},detailMap:{value:img},detailBox:{value:new THREE.Vector4(i/nx,j/nz,nx,nz)},
     detailReady:{value:DETAIL_NOT_READY},detailSize:{value:new THREE.Vector2(w,d)},
     detailCardinal:{value:new THREE.Vector4().setScalar(DETAIL_NOT_READY)},detailDiagonal:{value:new THREE.Vector4().setScalar(DETAIL_NOT_READY)}},vertexShader:vertex,fragmentShader:smoothShoreTone(landFragment,tone)});
    orthoSeams?.bind(i+'-'+j,local);
    const coarse=this.patch(x0,z0,w,d,8);
    // The opt-in window has no dry mesh or survey normal pass at n8.
    // Share the same live uniform object for ortho handoffs and local water.
    coarse.material=montagueGround?.spec.tileX===i&&montagueGround.spec.tileZ===j?
      sceneShader({uniforms:local.uniforms,vertexShader:vertex,fragmentShader:local.fragmentShader}):local;
    scene.add(coarse);const tile:Patch={id:i+'-'+j,i,j,lod:8,local,status:'idle',coarse,x0,z0,w,d};this.tiles.push(tile);this.byId.set(tile.id,tile);
   }
   if(cover.baywalk){
    const b=cover.baywalk,[uu,vv]=T.uv((b.x0+b.x1)*.5,(b.z0+b.z1)*.5);
    const tile=this.byId.get(Math.floor(uu*nx)+'-'+Math.floor(vv*nz));
    const m=sceneShader({vertexShader:vertex,
     fragmentShader:landFrag(false,false,false,false,!!this.buildingShadows,false,false,false,false,false,true),
     uniforms:{...(tile?.local.uniforms??uniforms),...this.buildingShadows?.uniforms,...northCourtUniforms}});
    this.northCourt=new BaywalkGround(b,cover,T,m,(x,z)=>this.provinceVisualGroundHeight(x,z));
    scene.add(this.northCourt.mesh);
    this.refreshNorthCourt();
   }
   for(const {pond,surfaceUniforms} of pondsWithUniforms){
    const water=sceneShader({vertexShader:vertex,fragmentShader:fp+skyFn+bowleyClipGLSL+bowleyWaterGLSL+out,
      uniforms:{...uniforms,...surfaceUniforms},side:THREE.DoubleSide});
    const shore=sceneShader({vertexShader:vertex,fragmentShader:fp+bowleyShoreGLSL+out,
      uniforms:{...uniforms,...surfaceUniforms},side:THREE.DoubleSide});
    const mesh=new BowleyWaterMesh(pond,T,water,shore);
    this.pondMeshes.push(mesh);scene.add(mesh.surface,mesh.rim);
    const [left,top,right,bottom]=pond.bounds;
    mesh.update((left+right)*.5,(top+bottom)*.5,b=>this.visualGroundSignature(b),(x,z)=>this.provinceVisualGroundHeight(x,z));
   }
   const hemi=new THREE.HemisphereLight(0xe3eeff,0x78654c,1.48);scene.add(hemi);
   const light=new THREE.DirectionalLight(0xffedda,2.2);light.position.copy(this.sun).multiplyScalar(40000);scene.add(light);
   const env=sky.clone();env.mapping=THREE.EquirectangularReflectionMapping;env.needsUpdate=true;scene.environment=env;scene.environmentIntensity=.77;
   scene.environmentRotation.y=-.512*Math.PI*2;
   
 }
 private addShoreFaces(material:THREE.ShaderMaterial,eastMaterial?:THREE.ShaderMaterial,showBank=false,inletBank?:THREE.ShaderMaterial,legacyShore=false,northBank?:THREE.ShaderMaterial,orbyClosure=false) {
  const groups=new Map<string,number[]>(),rockGroups=new Set<string>();
  const segments:ShoreSegment[]=[],outside:ShoreSegment[]=[],reviewed:ShoreSegment[]=[],courtShore:ShoreSegment[]=[];
  const review=montagueShoreReview(this.cover,this.terrain);
  const cuts=new Map<string,[number,number][]>();
  const batches:NonNullable<World['bank']>['batches']=[];
  const t=this.terrain,east=eastMaterial?t.coastalGrids.find(g=>g.cliff):undefined;
  const legacy:ShoreSegment[]=[],legacySeen=new Set<ShoreSegment>(),legacyStock=new Map<string,number[]>();
  const legacyCulling=new Map<string,THREE.Sphere>();
  const terrainTx=(t.right-t.left)/WORLD_COLS,terrainTz=(t.bottom-t.top)/WORLD_ROWS;
  const protectedOwners=[...COASTAL_SPECS,...this.terrain.coastalGrids.map(g=>g.spec)];
  const forbidden=(x0:number,z0:number,x1:number,z1:number)=>intersectsBasinLegacyBank(x0,z0,x1,z1)||this.cover.waterInsets.some(i=>i.intersects(x0,z0,x1,z1))
   ||protectedOwners.some(g=>{
    const l=t.left+g.tileX*terrainTx,n=t.top+g.tileZ*terrainTz;
    return x1>=l&&x0<=l+terrainTx&&z1>=n&&z0<=n+terrainTz;
   });
  // Shoulders are a height-only handoff for the same supported topology.
  // Do not recruit zero-tie or saddle contours through a shared endpoint:
  // the old saddle wall can visually cover a separate neighboring opening.
  const supportedShoulder=(s:ShoreSegment)=>{
   const {width:w,height:h,bytes}=this.cover;
   const x=((s.ax+s.bx)*.5-t.left)/(t.right-t.left)*w-.5;
   const z=((s.az+s.bz)*.5-t.top)/(t.bottom-t.top)*h-.5;
   if(Math.abs(x-Math.round(x))<1e-7||Math.abs(z-Math.round(z))<1e-7)return false;
   const i=Math.floor(x),j=Math.floor(z);
   if(i<0||j<0||i>=w-1||j>=h-1)return false;
   const k=(j*w+i)*2+1, values=[bytes[k]-128,bytes[k+2]-128,bytes[k+2*w+2]-128,bytes[k+2*w]-128];
   if(values.includes(0))return false;
   const mask=values.reduce((m,v,j)=>m|(v>0?1<<j:0),0);
   return mask!==5&&mask!==10&&mask!==0&&mask!==15;
  };
  const orby=orbyClosure&&!legacyShore&&this.cover.sourceSha===ORBY_COVER_SHA;
  const cfg=coastSegments(this.cover,t,legacyShore||orby?(x0,z0,x1,z1,i,j,q)=>{
   if(orby&&allowOrbyZeroArc(i,j,this.cover.width,this.cover.height,this.cover.sourceSha,q)&&!forbidden(x0,z0,x1,z1))return 'pinned-zero';
   return legacyShore&&!forbidden(x0,z0,x1,z1);
  }:undefined);
  const joins=new Set<string>(),keyOf=(x:number,z:number)=>x.toFixed(4)+','+z.toFixed(4);
  if(legacyShore)for(const s of cfg){
   const a=s.seatedLegacyArc;if(!a)continue;
   joins.add(keyOf(a.ax,a.az));joins.add(keyOf(a.bx,a.bz));
  }
  for(let segment of cfg){
   if(segment.baywalk){courtShore.push(segment);continue;}
   if(review?.includes(segment)){reviewed.push(segment);continue;}
   if(joins.size&&!segment.seatedLegacyArc){
    const {ax,az,bx,bz}=segment,head=joins.has(keyOf(ax,az)),tail=joins.has(keyOf(bx,bz));
    if((head||tail)&&supportedShoulder(segment)&&!forbidden(Math.min(ax,bx),Math.min(az,bz),Math.max(ax,bx),Math.max(az,bz)))
     segment={...segment,seatedLegacyArc:segment,seatJoin:[head,tail]};
   }
   if(segment.seatedLegacyArc){
    const stock=segment.seatedLegacyArc;
    if(!legacySeen.has(stock)){
     const key=stockShoreKey(stock),v=legacyStock.get(key)??[];
     appendStockCurtain(stock,t,v);legacyStock.set(key,v);legacySeen.add(stock);
    }
    legacy.push(segment);continue;
   }
   const {ax,az,bx,bz}=segment;
   const bank=showBank&&inBasinBank(segment,this.cover.basin);if(bank)segments.push(segment);else if(showBank)outside.push(segment);
   const key=Math.floor(ax/12000)+','+Math.floor(az/12000);
   if(east&&Math.max(ax,bx)>=east.x0&&Math.min(ax,bx)<=east.x1&&Math.max(az,bz)>=east.z0&&Math.min(az,bz)<=east.z1)rockGroups.add(key);
   let vertices=groups.get(key);if(!vertices){vertices=[];groups.set(key,vertices);}
   const start=vertices.length;
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
   if(bank){
    const list=cuts.get(key)??[];list.push([start,vertices.length]);cuts.set(key,list);
   }
  }
  if(courtShore.length&&northBank){
   const mesh=new THREE.Mesh(new THREE.BufferGeometry(),northBank);
   mesh.name='Summerside measured court shoreline';this.northCurtain={mesh,segments:courtShore};
   this.scene.add(mesh);
  }
  const shore=(v:number[])=>{
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
   g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(v.length/3*2),2));
   g.computeBoundingSphere();return g;
  };
  for(const [key,verts] of legacyStock){
   legacyCulling.set(key,stockShoreSphere(groups.get(key)??[],verts));
   // Unlike the old general arc trial, the isolated Orby closure adds only
   // coverage: keep the exact old curtain to avoid uncovering mixed samples.
   if(orby){const stock=groups.get(key)??[];stock.push(...verts);groups.set(key,stock);}
  }
  for(const [key,vertices] of groups){
   const g=shore(vertices),m=new THREE.Mesh(g,rockGroups.has(key)?eastMaterial:material);
   m.name='shore-to-sea surface';if(legacyCulling.has(key))m.userData.stockCull=legacyCulling.get(key);
   this.shoreFaces.push(m);this.scene.add(m);
   const remove=cuts.get(key);
   if(remove){
    const trimmed:number[]=[];let cursor=0;
    for(const [start,end] of remove){
     while(cursor<start)trimmed.push(vertices[cursor++]);
     cursor=end;
    }
    while(cursor<vertices.length)trimmed.push(vertices[cursor++]);
    batches.push({mesh:m,full:g,near:shore(trimmed)});
   }
  }
  if(batches.length)this.bank={material:inletBank,batches,segments,joins:basinBankJoins(segments,outside,this.cover.basin)};
  if(legacy.length)this.legacyShore=new LegacyShoreCurtains(this.scene,material,eastMaterial,rockGroups,t,legacy,legacyCulling,orby);
  if(review&&reviewed.length){
   const geom=new THREE.BufferGeometry(),mesh=new THREE.Mesh(geom,material);
   mesh.name='reviewed Montague shoreline support';mesh.visible=false;
   this.montagueReviewShore={mesh,segments:reviewed,bounds:review.bounds};
   this.shoreFaces.push(mesh);this.scene.add(mesh);this.refreshMontagueReviewShore();
  }
 }
 private refreshMontagueReviewShore(){
  const q=this.montagueReviewShore;if(!q||!this.byId.size)return;
  const revision=this.visualGroundSignature(q.bounds);
  if(q.revision===revision)return;
  const p=seatedMontagueCurtain(q.segments,(x,z)=>this.visualGroundHeight(x,z));
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(p,3));
  g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(p.length/3*2),2));
  g.computeBoundingSphere();q.mesh.geometry.dispose();q.mesh.geometry=g;q.mesh.visible=true;q.revision=revision;
 }
 private refreshNorthCourt(){
  const q=this.northCourt;if(!q)return;
  const signature=this.visualGroundSignature(q.signatureBounds);
  q.update(signature,(x,z)=>this.provinceVisualGroundHeight(x,z));
  const wall=this.northCurtain;
  if(wall&&wall.signature!==signature){
   const pos=seatedMontagueCurtain(wall.segments,(x,z)=>{
    if(q.source.inside(x,z)&&q.source.signed(x,z)>-.64&&this.cover.beforeBaywalk(this.terrain,x,z)<0)return q.height(x,z);
    return this.provinceVisualGroundHeight(x,z);
   });
   const next=new THREE.BufferGeometry();
   next.setAttribute('position',new THREE.BufferAttribute(pos,3));
   next.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(pos.length/3*2),2));
   next.computeBoundingSphere();
   wall.mesh.geometry.dispose();wall.mesh.geometry=next;wall.signature=signature;
  }
 }
 private patch(x0:number,z0:number,w:number,d:number,n:number,proposed?:BoundedGrade,skipKings=false){
  let g:THREE.BufferGeometry=new THREE.PlaneGeometry(w,d,n,n);g.rotateX(-Math.PI/2);
  const pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)+x0+w/2,z=pos.getZ(i)+z0+d/2;
    pos.setY(i,this.terrain.atlasElevation(x,z)+GROUND_LIFT);
    const [u,v]=this.terrain.uv(x,z);uv.setXY(i,u,v);
  }
  const meets=(g:NonNullable<World['bankGround']>['grid'])=>g.x0>x0&&g.x1<x0+w&&g.z0>z0&&g.z1<z0+d;
  const localBank=this.bankGround?.grid;
  const planned=n===112?(proposed??this.grades?.get(Math.round((x0-this.terrain.left)/w)+'-'+Math.round((z0-this.terrain.top)/d)))?.grid:undefined;
  const localGrade=skipKings&&planned?.spec===KINGS_DRY_CROWN?undefined:planned;
  const site=this.terrain.surveyGrids.find(g=>(g.spec.kind!=='inland'||n===112)&&
    (n!==8||g.spec.id!==MONTAGUE_GROUND_ID)&&meets(g))??
   (localBank&&n===112&&meets(localBank)?localBank:undefined)??(localGrade&&meets(localGrade)?localGrade:undefined);
  if(site&&this.bankGround&&site===localBank){
   const original=g;g=nativeBankMesh(g,this.bankGround,this.terrain,x0,z0,w,d);original.dispose();
  }else if(site)insertCoastalGrid(g,n,{x:x0,z:z0,w,d},this.terrain,site);
  else if(localBank&&meets(localBank))g.setAttribute('surveyWeight',new THREE.BufferAttribute(new Uint8Array(pos.count),1,true));
  g.computeBoundingSphere();const m=new THREE.Mesh(g,this.mat);m.position.set(x0+w/2,0,z0+d/2);
  m.userData.subdiv=n;
  if(site&&site===localGrade)m.userData.localGrade=site.spec.id;
  else if(site)m.userData.coastalSurvey=site.spec.id;
  if(site?.cliff)m.userData.coastalRefinement=site.cliff.id;
  return m;
 }
 /** Prepare one reversible near mesh before live receiver seating; do not
  * change the scene, collision sampler or installed flag until a commit. */
 stageStMarysNear(grade:BoundedGrade){
  const {spec,x0,z0,x1,z1}=grade.grid,key=spec.tileX+'-'+spec.tileZ,t=this.byId.get(key);
  if(!t?.fine||t.lod!==112||t.relief||this.grades?.has(key))return;
  let q=this.stagedChurch;
  if(q?.owner!==t||q.grade!==grade){
   this.dropStMarysStage();
   const candidate=this.patch(t.x0,t.z0,t.w,t.d,112,grade);
   if(candidate.userData.localGrade!==spec.id){candidate.geometry.dispose();return;}
   candidate.material=t.local;
   const source:StMarysProposedGround={mesh:candidate,gradeId:spec.id,bounds:[x0,z0,x1,z1],
    inChangedSupport:(x:number,z:number)=>grade.weight(x,z)>0};
   q=this.stagedChurch={owner:t,grade,stock:t.fine,candidate,source};
   this.copyNearEdge(q.stock,q.candidate);q.seams=t.seams;
  }
  if(t.fine===q.stock&&q.seams!==t.seams){this.copyNearEdge(q.stock,q.candidate);q.seams=t.seams;}
  return q.source;
 }
 setStMarysGround(show:boolean){
  const q=this.stagedChurch,t=q?.owner;
  if(!q||!t||t.lod!==112||(t.fine!==q.stock&&t.fine!==q.candidate))return false;
  const before=t.fine,after=show?q.candidate:q.stock;
  if(before!==after){
   this.copyNearEdge(before,after);q.seams=t.seams;
   this.scene.remove(before);this.scene.add(after);t.fine=after;this.groundVersion++;
  }
  return show;
 }
 private copyNearEdge(a:THREE.Mesh,b:THREE.Mesh){
  const src=a.geometry.getAttribute('position'),dest=b.geometry.getAttribute('position'),n=112;
  let changed=false;
  for(let k=0;k<=n;k++)for(const j of [k,n*(n+1)+k,k*(n+1),k*(n+1)+n]){
   const y=src.getY(j);
   if(dest.getY(j)!==y){dest.setY(j,y);changed=true;}
  }
  if(changed){if(dest instanceof THREE.BufferAttribute)dest.clearUpdateRanges();dest.needsUpdate=true;}
 }
 get kingsDryCrownBlend(){
  const q=this.kingsStage;
  return q&&q.owner.fine===q.measured?q.morph.strength.value:0;
 }
 private updateKingsCrown(tile:Patch,gain:number){
  const source=this.kingsGrade,fine=tile.fine;
  if(!source||!fine||tile.lod!==112||tile.relief)return false;
  let q=this.kingsStage;
  if(gain>0&&!q&&!this.kingsStageFailed){
   let measured:THREE.Mesh|undefined,morph:KingsCrownMorph;
   try{
    measured=this.patch(tile.x0,tile.z0,tile.w,tile.d,112,source);
    if(measured.userData.localGrade!==KINGS_DRY_CROWN.id)throw Error('Near owner no longer admits Kings dry crown');
    const positions=measured.geometry.getAttribute('position') as THREE.BufferAttribute;
    positions.setUsage(THREE.DynamicDrawUsage);morph=new KingsCrownMorph(positions,source.grid);
   }catch{measured?.geometry.dispose();this.kingsStageFailed=true;return false;}
   // The two endpoint shapes bound every linear morph vertex.
   if(measured.geometry.boundingSphere)measured.geometry.boundingSphere.radius+=KINGS_DRY_CROWN.maxRelativeDeltaCm*.01;
   const m=tile.local.clone();m.uniforms={...tile.local.uniforms,kingsCrownGain:morph.strength};m.defines={...tile.local.defines,SURVEY_LIGHT:1};
   m.vertexShader='uniform float kingsCrownGain;\n'+m.vertexShader.replace('vSurveyWeight=surveyWeight;','vSurveyWeight=surveyWeight*kingsCrownGain;');
   const term='n=normalize(mix(n,normalize(vSurveyNormal),vSurveyWeight));';
   m.fragmentShader=m.fragmentShader.replace(term,'if(vSurveyWeight>0.)'+term);
   measured.material=m;
   q=this.kingsStage={owner:tile,stock:fine,measured,morph};
  }
  if(!q||q.owner!==tile)return false;
  if(gain>0)q.morph.set(gain);
  const wanted=gain>0?q.measured:q.stock;
  if(fine===wanted)return false;
  this.copyNearEdge(fine,wanted);this.scene.remove(fine);this.scene.add(wanted);tile.fine=wanted;
  // Only the topology swap increments the broad seating epoch. The moving
  // influence has no shipped actor/receiver within the measured guard.
  return true;
 }
 private dropKingsCrown(){
  const q=this.kingsStage;if(!q)return;
  this.updateKingsCrown(q.owner,0);
  this.scene.remove(q.measured);q.measured.geometry.dispose();(q.measured.material as THREE.Material).dispose();
  this.kingsStage=undefined;
 }
 private dropStMarysStage(){
  const q=this.stagedChurch;if(!q)return;
  this.setStMarysGround(false);
  this.scene.remove(q.candidate);q.candidate.geometry.dispose();this.stagedChurch=undefined;
 }
 enableAdaptiveTerrain(stream:ReliefPacks){
  this.reliefPacks=stream;
 }
 get floorState(){return this.floor?.state??null;}
 get adaptiveState(){return this.reliefPacks?{
  active:Array.from(this.reliefActive,t=>t.id),ready:this.reliefSeed.size,inflight:this.reliefPending.size,failed:this.reliefFailed.size,
  refined:Array.from(this.reliefActive,t=>t.relief!.mesh.relief.refinedCells).reduce((a,b)=>a+b,0),
 }:null;}
 private reliefTileSafe(t:Patch){
  // On this exact sidewalk generation, the independently measured
  // mitered paths intersect admission masks only in terrain tile 8-13.
  if(t.id==='8-13'||(this.bankGround&&t.id===BANK_TILE)||this.grades?.has(t.id))return false;
  return !this.terrain.surveyGrids.some(g=>g.spec.tileX===t.i&&g.spec.tileZ===t.j);
 }
 /** Promote a coherent mesh and contact revision before this frame runs physics.
  * The Promise callbacks only stage verified samples; they cannot move scenery. */
 prepareAdaptiveTerrain(x:number,z:number,altitude:number,now:number){
  const data=this.reliefPacks;if(!data)return;
  this.reliefX=x;this.reliefZ=z;
  const range=(t:Patch)=>Math.hypot(x-t.x0-t.w/2,z-t.z0-t.d/2);
  for(const t of this.reliefActive)if(range(t)>6600)this.withdrawAdaptive(t);
  if(now-this.reliefRefresh>420){
   this.reliefRefresh=now;
   const wanted=this.tiles.filter(t=>this.reliefTileSafe(t)&&data.has(t.id)&&!this.reliefEmpty.has(t.id)&&range(t)<7600).sort((a,b)=>range(a)-range(b)).slice(0,5);
   const keep=new Set(wanted.map(t=>t.id));
   for(const id of this.reliefSeed.keys())if(!keep.has(id)&&!this.byId.get(id)?.relief)this.reliefSeed.delete(id);
   for(const t of wanted){
    if(this.reliefPending.size>=2)break;
    if(this.reliefPending.has(t.id)||this.reliefSeed.has(t.id)||t.relief||this.reliefFailed.has(t.id))continue;
    this.reliefPending.add(t.id);
    void data.load(t.id).then(seed=>{
     if(seed&&Math.hypot(this.reliefX-t.x0-t.w/2,this.reliefZ-t.z0-t.d/2)<8100)this.reliefSeed.set(t.id,seed);
    }).catch(()=>{this.reliefFailed.add(t.id);}).finally(()=>{this.reliefPending.delete(t.id);});
   }
  }
  // Avoid moving the ground beneath an existing low pass, touchdown or
  // restart. Already installed local geometry stays stable through descent.
  if(this.reliefActive.size>=2||altitude-(this.terrain.contactHeight(x,z,this.cover.distance(this.terrain,x,z)>=0))<175)return;
  const ready=this.tiles.filter(t=>t.lod===112&&t.fine&&!t.relief&&this.reliefSeed.has(t.id)&&range(t)<5300)
   .sort((a,b)=>range(a)-range(b));
  const t=ready[0];if(!t?.fine)return;
  const seed=this.reliefSeed.get(t.id)!;this.reliefSeed.delete(t.id);
  try{
   const base=t.fine.geometry,mesh=adaptiveGround(base,seed,this.terrain,t.x0,t.z0,t.w,t.d);
   if(!mesh.relief.refinedCells){mesh.geometry.dispose();this.reliefEmpty.add(t.id);return;}
   t.relief={base,mesh};t.fine.geometry=mesh.geometry;
   this.reliefActive.add(t);this.groundVersion++;
  }catch{this.reliefFailed.add(t.id);}
 }
 private withdrawAdaptive(t:Patch){
  const q=t.relief;if(!q)return;
  q.mesh.geometry.dispose();if(t.fine)t.fine.geometry=q.base;
  t.relief=undefined;this.reliefActive.delete(t);this.groundVersion++;
 }
 /** Decorations fitted to terrain faces only refit when a relevant LOD changes. */
 get visualGroundEpoch(){return this.groundVersion;}
 visualGroundSignature(b:readonly [number,number,number,number]){
  const [a,c]=this.terrain.uv(b[0],b[1]),[d,e]=this.terrain.uv(b[2],b[3]);
  const j0=Math.max(0,Math.floor(c*WORLD_ROWS)),j1=Math.min(WORLD_ROWS-1,Math.floor(e*WORLD_ROWS));
  const i0=Math.max(0,Math.floor(a*WORLD_COLS)),i1=Math.min(WORLD_COLS-1,Math.floor(d*WORLD_COLS));
  let out='';
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
   const key=i+'-'+j,q=this.byId.get(key);
   const grade=this.installedGrade(key,q)?.affectsBounds(b);
   out+=q?q.lod+'/'+(q.seams??'')+(grade?'g;':q.relief?'*;':';'):'-;';
  }
  return out;
 }
 private installedGrade(key:string,patch=this.byId.get(key)){
  const revision=patch?.lod===112&&patch.fine?.userData.localGrade;
  if(!revision)return;
  const proposed=this.stagedChurch;
  const source=proposed&&patch?.fine===proposed.candidate?proposed.grade:this.grades?.get(key);
  return source?.grid.spec.id===revision?source:undefined;
 }
 groundGradeInstalled(id:string){
  const church=this.stagedChurch;
  if(church?.grade.grid.spec.id===id)return church.owner.fine===church.candidate&&church.owner.lod===112;
  if(this.grades)for(const [key,g] of this.grades)if(g.grid.spec.id===id)return !!this.installedGrade(key);
  return false;
 }
 get activeGroundGrades():readonly string[]{
  const result:string[]=[];
  if(this.grades)for(const [key] of this.grades){const g=this.installedGrade(key);if(g)result.push(g.grid.spec.id);}
  const church=this.stagedChurch;if(church&&this.groundGradeInstalled(church.grade.grid.spec.id))result.push(church.grade.grid.spec.id);
  return result;
 }
 get activeGroundGrade(){
  if(this.grades)for(const [key] of this.grades){const g=this.installedGrade(key);if(g)return g.grid.spec.id;}
  const church=this.stagedChurch;return church&&this.groundGradeInstalled(church.grade.grid.spec.id)?church.grade.grid.spec.id:null;
 }
 /** A footprint must occupy one *current* unaltered N112 tile strictly
  * inside its outer stitched parent cell. Stage/commit rechecks identity. */
 rollingCanopyOwner(b:readonly [number,number,number,number]){
  const basilica=BASILICA_RECEIVER_GUARD;
  if(Math.max(0,b[0]-basilica.x,basilica.x-b[2])**2+Math.max(0,b[1]-basilica.z,basilica.z-b[3])**2<160**2)return;
  const [u,v]=this.terrain.uv(b[0],b[1]),i=Math.floor(u*WORLD_COLS),j=Math.floor(v*WORLD_ROWS);
  const key=i+'-'+j,q=this.byId.get(key),m=q?.fine;
  if(!q||!m||!this.rollingCanopyStill(key,m.geometry))return;
  const marginX=q.w/112+.02,marginZ=q.d/112+.02;
  if(b[0]<q.x0+marginX||b[1]<q.z0+marginZ||
     b[2]>q.x0+q.w-marginX||b[3]>q.z0+q.d-marginZ)return;
  if(this.cover.waterInsets.some(a=>a.intersects(...b)))return;
  return {key,geometry:m.geometry};
 }
 rollingCanopyStill(key:string,g:THREE.BufferGeometry){
  const q=this.byId.get(key),m=q?.fine;
  return key!=='10-11'&&!!q&&q.lod===112&&!!m&&m.geometry===g&&!q.relief&&!m.userData.localGrade&&
    !m.userData.coastalSurvey&&m.userData.subdiv===112&&!this.grades?.has(key)&&
    !(this.bankGround&&key===BANK_TILE)&&!this.terrain.surveyGrids.some(a=>a.spec.tileX===q.i&&a.spec.tileZ===q.j);
 }
 /** Height of the submitted regular grid (including sewn tile-edge vertices).
  * Decorative roots use this, not the map or aerodynamic contact sampler. */
 visualGroundHeight(x:number,z:number){
  return this.restoredBaywalkY(x,z)??this.provinceVisualGroundHeight(x,z);
 }
 restoredBaywalkY(x:number,z:number){
  const q=this.northCourt;
  if(q?.source.inside(x,z)&&q.source.restored(this.cover.beforeBaywalk(this.terrain,x,z),x,z))return q.height(x,z);
 }
 private provinceVisualGroundHeight(x:number,z:number){
  const [u,v]=this.terrain.uv(x,z),i=Math.floor(u*WORLD_COLS),j=Math.floor(v*WORLD_ROWS);
  const key=i+'-'+j,tile=this.byId.get(key);
  if(!tile)return this.terrain.meshElevation(x,z)+GROUND_LIFT;
  const grade=this.installedGrade(key,tile);
  if(grade?.weight(x,z)){
   const y=grade.visualY(x,z)!;
   if(grade===this.kingsGrade){const gain=this.kingsDryCrownBlend;if(gain<1){
    const legacy=grade.grid.parentHeight(x,z)+GROUND_LIFT;return legacy+(y-legacy)*gain;
   }}
   return y;
  }
  if(tile.relief){
   const m=tile.relief.mesh.relief,u=(x-tile.x0)/tile.w,v=(z-tile.z0)/tile.d;
   if(m.supportDistance(u,v)===0)return m.height(u,v);
  }
  const g=(tile.lod>8&&tile.fine?tile.fine:tile.coarse);
  const n=g.userData.subdiv as number,step=n+1;
  const grid=this.terrain.coastalGrids.find(a=>a.spec.tileX===i&&a.spec.tileZ===j);
  if(grid?.spec.id===MONTAGUE_GROUND_ID){
   // Use the submitted replacement *and its stitches* at the current LOD.
   // Everywhere else in tile 22-17 retain the actual regular facet below.
   const surveyed=alteredPatchHeight(g.geometry,x-g.position.x,z-g.position.z);
   if(surveyed!==undefined)return surveyed;
  }else if(grid)return this.terrain.meshElevation(x,z)+GROUND_LIFT;
  const inland=this.terrain.inlandGrids.find(q=>q.spec.tileX===i&&q.spec.tileZ===j&&q.inside(x,z));
  if(inland&&n===112)return inland.height(x,z)!+GROUND_LIFT;
  const bank=this.bankGround?.grid;
  if(bank&&n===112&&bank.inside(x,z))return bank.height(x,z)!+GROUND_LIFT;
  const sx=Math.max(0,Math.min(n,(x-tile.x0)/tile.w*n)),sz=Math.max(0,Math.min(n,(z-tile.z0)/tile.d*n));
  const p=Math.min(n-1,Math.floor(sx)),q=Math.min(n-1,Math.floor(sz)),k=q*step+p;
  const xyz=g.geometry.getAttribute('position');
  return facet(sx-p,sz-q,xyz.getY(k),xyz.getY(k+1),xyz.getY(k+step),xyz.getY(k+step+1));
 }
 basinCrossingGround(x:number,z:number){
  const bank=this.bankGround?.grid;
  return bank?.inside(x,z)?bank.height(x,z)!+GROUND_LIFT:this.terrain.contactHeight(x,z,this.cover.distance(this.terrain,x,z)>=0);
 }
 basinPlantedGround(x:number,z:number){
  if(this.byId.get(BANK_TILE)?.lod!==112||!this.bankGround?.authority(x,z))return undefined;
  return this.bankGround.grid.height(x,z);
 }
 bankGroundTouches(x0:number,z0:number,x1:number,z1:number){
  return this.byId.get(BANK_TILE)?.lod===112&&(this.bankGround?.touches(x0,z0,x1,z1)??false);
 }
 nearInlandGrids(){
  return this.terrain.inlandGrids.filter(g=>this.byId.get(g.spec.tileX+'-'+g.spec.tileZ)?.lod===112);
 }
 groundHeight(x:number,z:number,land?:boolean){
  const pond=this.freshwaterAt(x,z);if(pond)return pond.spec.waterY;
  // Both shaders use the continuous Cover mask. A missing province DEM cell
  // cannot revoke visible land, and even positive offshore survey samples
  // must not raise water contact above the rendered ocean.
  const covered=land??(this.cover.distance(this.terrain,x,z)>=0);
  const baywalk=covered?this.restoredBaywalkY(x,z):undefined;
  if(baywalk!==undefined){
   // Rendering joins the active stock triangle. Flight joins stock
   // contact (which may use a different elevation interpolation) at the
   // same sign-zero. Ease their inherited difference on restored land
   // only; far enough inside, both use the same submitted survey cap.
   const prior=this.cover.beforeBaywalk(this.terrain,x,z),u=Math.max(0,Math.min(1,-prior/4.8));
   const f=1-u*u*(3-2*u);
   return f?baywalk+f*(this.provinceFlightHeight(x,z,true)-this.provinceVisualGroundHeight(x,z)):baywalk;
  }
  return this.provinceFlightHeight(x,z,covered);
 }
 private provinceFlightHeight(x:number,z:number,covered:boolean){
  let baseline=this.terrain.contactHeight(x,z,covered);
  if(covered&&this.bankGround&&this.byId.get(BANK_TILE)?.lod===112)baseline=this.bankGround.height(x,z,baseline);
  if(covered&&(this.grades||this.stagedChurch)){
   const [u,v]=this.terrain.uv(x,z),grade=this.installedGrade(Math.floor(u*WORLD_COLS)+'-'+Math.floor(v*WORLD_ROWS));
   if(grade?.weight(x,z)){
    const y=grade.contactY(x,z,baseline);
    if(grade===this.kingsGrade){const gain=this.kingsDryCrownBlend;if(gain<1)return baseline+(y-baseline)*gain;}
    return y;
   }
  }
  if(!covered||!this.reliefActive.size||runwayAt(x,z))return baseline;
  const [u,v]=this.terrain.uv(x,z);
  const t=this.byId.get(Math.floor(u*WORLD_COLS)+'-'+Math.floor(v*WORLD_ROWS));
  if(!t?.relief)return baseline;
  const mesh=t.relief.mesh.relief,localX=(x-t.x0)/t.w,localZ=(z-t.z0)/t.d;
  const depth=mesh.supportDistance(localX,localZ);
  // Outside the contact envelope, leave the pre-existing atlas interpolation
  // intact. Within measured triangles, visual and physical Y share one field.
  if(depth>=1)return baseline;
  const amount=1-depth*depth*(3-2*depth);
  return baseline+amount*(mesh.height(localX,localZ)-baseline);
 }
 surface(x:number,z:number):Surface{
  const pond=this.freshwaterAt(x,z);if(pond)return {height:pond.spec.waterY,land:false,runway:false};
  const land=this.cover.distance(this.terrain,x,z)>=0;
  return {height:this.groundHeight(x,z,land),land,runway:!!runwayAt(x,z)};
 }
 update(pos:THREE.Vector3,clock:number){
  this.t.value=clock;this.detailClock.value=clock;this.lastX=pos.x;this.lastZ=pos.z;
  this.orthoSeams?.advance(clock);
  const grass=this.grassStudy;
  if(grass?.admitted){
   grass.stream.update(pos.x,pos.z,pos.y-this.terrain.atlasElevation(pos.x,pos.z));
   if(grass.nap){
    const [u,v]=this.terrain.uv(pos.x,pos.z);
    const tile=this.byId.get(Math.floor(u*WORLD_COLS)+'-'+Math.floor(v*WORLD_ROWS)),g=tile?.fine;
    const regular=tile?.lod===112&&g?.visible&&!tile.relief&&!g.userData.localGrade&&!g.userData.coastalSurvey&&
      !!tile.local.uniforms.shortGrassNapMap;
    const fade=regular?shortGrassHeightFade(pos.y-this.visualGroundHeight(pos.x,pos.z)):0.;
    const nap=grass.nap;nap.wanted=fade>.001&&grass.stream.state.ready>0;
    if(nap.wanted&&!nap.map.value)grass.prepareNap();
    const t=nap.map.value?Math.min(1,Math.max(0,(performance.now()-nap.readyAt)/430)):0.;
    nap.mix.value=nap.wanted?fade*t*t*(3-2*t):0.;
   }
  }
  if(this.provinceFields?.admitted)this.provinceFields.stream.update(pos.x,pos.z,pos.y-this.terrain.atlasElevation(pos.x,pos.z));
  const art=this.floor;
  if(art){
   let near=false;
   if(art.state==='idle'&&pos.y-this.terrain.atlasElevation(pos.x,pos.z)<122){
    for(const x of [-55,0,55])for(const z of [-55,0,55]){
     if(this.cover.sample(this.terrain,pos.x+x,pos.z+z)===10&&this.cover.distance(this.terrain,pos.x+x,pos.z+z)>122)near=true;
    }
   }
   art.update(near);
  }
  // A camera cut can cross the zero side before the regular terrain sweep.
  // Restore the cached stock mesh before this paint without doing any new
  // terrain construction or partial Y-buffer work on the ordinary frame path.
  const crown=this.kingsStage;
  if(crown&&crown.owner.fine===crown.measured){
   const t=crown.owner,dx=pos.x-t.x0-t.w/2,dz=pos.z-t.z0-t.d/2;
   if(dx*dx+dz*dz>=KINGS_CROWN_ZERO_M**2&&this.updateKingsCrown(t,0))this.groundVersion++;
  }
  if(Math.abs(clock-this.recent)<.25&&this.recent>0)return;
  this.recent=clock;let changedGround=false;
  // The visible curtain fills close headlands. Beyond the horizon detail load
  // radius it has negligible screen height, so do not send those meshes to GL.
  for(const face of this.shoreFaces){
   if(face===this.montagueReviewShore?.mesh)continue;
   const b=(face.userData.stockCull as THREE.Sphere|undefined)??face.geometry.boundingSphere!;
   face.visible=Math.hypot(b.center.x-pos.x,b.center.z-pos.z)<17000+b.radius;
  }
  for(const tile of this.tiles){
   const dx=pos.x-(tile.x0+tile.w/2),dz=pos.z-(tile.z0+tile.d/2);
   const d2=dx*dx+dz*dz,old=tile.lod;
   const proposedLOD=d2<(old===112?6200:5300)**2?112:d2<(old>=56?11700:10500)**2?56:8;
   const measuredKings=!!this.kingsGrade&&tile.id===KINGS_CROWN_TILE;
   if(proposedLOD!==112&&this.kingsStage?.owner===tile)this.dropKingsCrown();
   if(proposedLOD!==112&&this.stagedChurch?.owner===tile)this.dropStMarysStage();
   tile.lod=proposedLOD;
   if(tile.lod!==old){changedGround=true;if(tile.lod<112)this.withdrawAdaptive(tile);}
   const fine=tile.lod>8;
   if(fine&&tile.fine?.userData.subdiv!==tile.lod){
     if(tile.fine){this.scene.remove(tile.fine);tile.fine.geometry.dispose();}
     tile.fine=this.patch(tile.x0,tile.z0,tile.w,tile.d,tile.lod,undefined,measuredKings);
     tile.fine.material=tile.local;this.scene.add(tile.fine);tile.seams=undefined;
   }
   if(measuredKings&&proposedLOD===112&&this.updateKingsCrown(tile,kingsCrownBlendForDistance(Math.sqrt(d2))))changedGround=true;
   if(tile.detail&&d2>19000**2){this.orthoSeams?.evict(tile.id,tile.detail);tile.detail.dispose();(tile.detail.image as ImageBitmap)?.close?.();tile.detail=undefined;tile.status='idle';tile.local.uniforms.hasDetail.value=0;tile.local.uniforms.detailMap.value=tile.local.uniforms.imageMap.value;this.refreshDetailOwner(tile,undefined);}
   tile.coarse.visible=!fine;if(tile.fine){tile.fine.visible=fine;if(!fine&&d2>15000**2){this.scene.remove(tile.fine);tile.fine.geometry.dispose();tile.fine=undefined;tile.seams=undefined;}}
  }
  if(this.westDuneOptics)this.westDuneOptics.gain.value=Number(this.groundGradeInstalled(HOG_WEST_GRADE.id));
  // On each LOD transition, conform the fine boundary vertices to the adjacent
  // coarser edge. This preserves the DEM's unsimplified edge when equally fine tiles
  // meet and avoids vertical skirts appearing along coastline/harbour tiles.
  for(const tile of this.tiles)if(tile.lod>8&&tile.fine){
    const n=tile.lod,levels=[[0,-1],[1,0],[0,1],[-1,0]].map(([ox,oz])=>Math.min(n,this.byId.get((tile.i+ox)+'-'+(tile.j+oz))?.lod??n));
    const key=n+':'+levels.join(',');if(tile.seams===key)continue;tile.seams=key;changedGround=true;
    const pos=tile.fine.geometry.getAttribute('position');
    for(let side=0;side<4;side++){
      const m=levels[side],ratio=n/m;let a=0,b=0;
      const height=(t:number)=>this.terrain.atlasElevation(tile.x0+tile.w*(side%2===0?t:side===1?1:0),tile.z0+tile.d*(side%2===1?t:side===2?1:0))+.12;
      for(let k=0;k<=n;k++){
        if(k%ratio===0){a=height(k/n);b=height(Math.min(1,(k+ratio)/n));}
        const j=side===0?k:side===1?k*(n+1)+n:side===2?n*(n+1)+k:k*(n+1);
        const y=a+(b-a)*(k%ratio)/ratio;
        pos.setY(j,y);tile.relief?.base.getAttribute('position').setY(j,y);
      }
    }
    if(this.kingsStage?.measured===tile.fine&&pos instanceof THREE.BufferAttribute)pos.clearUpdateRanges();
    pos.needsUpdate=true;
    if(tile.relief)tile.relief.base.getAttribute('position').needsUpdate=true;
  }
  const bank=this.bank;
  if(bank){
   const near=this.byId.get(BANK_TILE)?.lod===112;
   if(near&&!bank.close){
    const p=basinBankGeometry(this.cover,this.terrain,bank.segments,(x,z)=>this.visualGroundHeight(x,z),bank.joins);
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(p,3));
    g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(p.length/3*2),2));
    g.computeBoundingSphere();const m=new THREE.Mesh(g,bank.material??bank.batches[0].mesh.material);
    m.name='seated Basin Head shore';bank.close=m;this.scene.add(m);
   }
   if(bank.close)bank.close.visible=near;
   for(const b of bank.batches)b.mesh.geometry=near?b.near:b.full;
  }
  this.refreshMontagueReviewShore();
  if(this.northCourt)this.refreshNorthCourt();
  for(const m of this.pondMeshes)m.update(pos.x,pos.z,b=>this.visualGroundSignature(b),(a,c)=>this.provinceVisualGroundHeight(a,c));
  this.legacyShore?.update(pos.x,pos.z,b=>this.visualGroundSignature(b),(x,z)=>this.visualGroundHeight(x,z));
  if(changedGround)this.groundVersion++;
  this.orthoSeams?.update(clock,id=>this.byId.get(id));
  const now=performance.now();
  const near=this.tiles.filter(q=>q.status==='idle'&&(q.retryAt??0)<=now&&Math.hypot(pos.x-q.x0-q.w/2,pos.z-q.z0-q.d/2)<14500)
   .sort((a,b)=>Math.hypot(pos.x-a.x0-a.w/2,pos.z-a.z0-a.d/2)-Math.hypot(pos.x-b.x0-b.w/2,pos.z-b.z0-b.d/2));
  for(const q of near){if(this.loading>=3)break;this.request(q);}

 }
 detailState(){return {ready:this.tiles.filter(t=>t.status==='ready').length,loading:this.loading,
  missing:this.tiles.filter(t=>t.status==='missing').length,uncovered:this.tiles.filter(t=>t.status==='uncovered').length,
  retrying:this.tiles.filter(t=>t.status==='idle'&&t.retryAt!==undefined).length};}
 private refreshDetailOwner(tile:Patch,ready:number|undefined){
  tile.detailSince=ready;tile.local.uniforms.detailReady.value=ready??DETAIL_NOT_READY;
  const neighbour=(t:Patch,i:number,j:number)=>this.byId.get((t.i+i)+'-'+(t.j+j));
  const refresh=(t:Patch)=>{
   for(let k=0;k<DETAIL_NEIGHBOURS.length;k++){
    const [i,j]=DETAIL_NEIGHBOURS[k];
    const v=t.local.uniforms[k<4?'detailCardinal':'detailDiagonal'].value as THREE.Vector4;
    v.setComponent(k%4,neighbour(t,i,j)?.detailSince??DETAIL_NOT_READY);
   }
  };
  refresh(tile);
  for(const [i,j] of DETAIL_NEIGHBOURS){const other=neighbour(tile,i,j);if(other)refresh(other);}
 }
 private request(tile:Patch){
  this.loading++;tile.status='loading';tile.retryAt=undefined;
  void this.details.load(tile.id).then(tex=>{if(!tex){tile.status='uncovered';return;}
   tile.failures=undefined;
   const dx=this.lastX-(tile.x0+tile.w/2),dz=this.lastZ-(tile.z0+tile.d/2);
   if(dx*dx+dz*dz>19000**2){tex.dispose();(tex.image as ImageBitmap)?.close?.();tile.status='idle';return;}
   tile.detail=tex;tile.status='ready';tile.local.uniforms.detailMap.value=tex;tile.local.uniforms.hasDetail.value=1;this.refreshDetailOwner(tile,this.detailClock.value);
  }).catch(e=>{
   tile.failures=(tile.failures??0)+1;
   tile.retryAt=detailRetryAt(e,tile.failures,performance.now());
   tile.status=tile.retryAt===undefined?'missing':'idle';
   if(tile.status==='missing')console.warn('Base atlas retained; detail tile unavailable',tile.id,e);
  }).finally(()=>this.loading--);
 }
}
