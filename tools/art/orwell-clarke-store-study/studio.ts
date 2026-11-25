import * as T from 'three';
import {makeClarkeFront} from './front.ts';
import {makeLeafScreen, makeSurface, scalar} from './surfaces.ts';
const W=1180,H=780;const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(W,H,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.07;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.querySelector('#stage')!.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color(0xb4bfad);scene.fog=new T.Fog(0xb4bfad,18,80);
const cam=new T.PerspectiveCamera(38.8,W/H,.08,80);
const rng=(x:number,y:number)=>scalar(x,y,227);
function makeSky(){
 const xN=512,yN=256,buf=new Float32Array(xN*yN*4);
 for(let y=0;y<yN;y++)for(let x=0;x<xN;x++){
  const u=(x+.5)/xN,v=(y+.5)/yN;
  const sm=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp,n=.475+.021*Math.sin(u*52)+.013*Math.sin(81*u+Math.cos(u*32))+.009*Math.sin(u*147)+.004*Math.cos(u*403);
  const sky=sm(v,n-.007,n+.013),high=sm(v,.455,.83),sun=.54+.46*Math.max(0,Math.cos((u-.915)*Math.PI*2));
  const layers=Math.cos(u*38+10*v)*Math.sin(26*v+.93*Math.sin(u*41))+.32*Math.sin(u*91+71*v)+.20*Math.cos(u*162+95*v);
  const white=sm(layers,.03,.50)*(1-sm(v,.57,.84))*sun;
  const patch=(.70+.30*Math.sin(u*99))*sm(v,.22,n), splotch=rng(x>>1,y>>1)*.08;
  const gr=[.038+.040*patch,.046+.058*patch,.032+.036*patch];
  const sk=[lerp(.41,.43,high)+white*.53,lerp(.58,.61,high)+white*.51,lerp(.67,.78,high)+white*.48];
  for(let k=0;k<3;k++)buf[4*(x+y*xN)+k]=lerp(gr[k]+(k===2?.31:.56)*splotch,sk[k]*sun,sky);
  buf[4*(x+y*xN)+3]=1;
 }
 const image=new T.DataTexture(buf,xN,yN,T.RGBAFormat,T.FloatType);image.minFilter=image.magFilter=T.LinearFilter;image.mapping=T.EquirectangularReflectionMapping;image.needsUpdate=true;
 const pmrem=new T.PMREMGenerator(renderer),cube=pmrem.fromEquirectangular(image);pmrem.dispose();return {cube,image};
}
const daylight=makeSky();scene.environment=daylight.cube.texture;scene.environmentIntensity=.77;
const hemi=new T.HemisphereLight(0xdceaf8,0x8a6752,1.42);scene.add(hemi);
const sun=new T.DirectionalLight(0xffe6c3,2.34);sun.position.set(-5.28,7.91,5.89);sun.target.position.set(-.25,1.66,.2);sun.castShadow=true;
Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-5,near:.1,far:31});sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=2.6;sun.shadow.bias=-.00021;sun.shadow.normalBias=.008;
scene.add(sun,sun.target);
const grassTint=new T.MeshStandardMaterial({color:0x947055,...makeSurface('earth'),roughness:.98,normalScale:new T.Vector2(.45,.45)});
for(const t of [grassTint.map,grassTint.roughnessMap,grassTint.normalMap])t!.repeat.set(17.0,17.0);
const ground=new T.Mesh(new T.PlaneGeometry(76,76),grassTint);ground.rotation.x=-Math.PI/2;ground.position.y=-.012;ground.receiveShadow=true;scene.add(ground);
// A coarse artistic canopy conveys shadow from a nearby tree without inventing its trunk, surveyed position or appearance.
// Visibility is shadow-only; it is deliberately weaker than full afternoon sun to keep the geometry readable.
const mask=makeLeafScreen(), shadow=new T.Mesh(new T.PlaneGeometry(11.9,7.0),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,side:T.DoubleSide}));
shadow.material.alphaMap=mask;shadow.material.alphaTest=.61;
shadow.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,alphaMap:mask,alphaTest:.61,side:T.DoubleSide});shadow.position.set(-4.40,6.20,3.77);shadow.rotation.set(-.55,-.19,-.31);shadow.castShadow=true;scene.add(shadow);
const studio=makeClarkeFront();scene.add(studio);
const glass=studio.getObjectByName('glazing') as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
// Add a directional reflection lobe from the same original studio sky. The ray changes
// with the camera across the pane and the facade. No artistic picture or reflection decal.
glass.material.onBeforeCompile=shader=>{
 shader.uniforms.orwellGlassPanorama={value:daylight.image};
 shader.vertexShader='varying vec3 vOrwellGlassWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOrwellGlassWorld=(modelMatrix*vec4(position,1.0)).xyz;');
 shader.fragmentShader='uniform sampler2D orwellGlassPanorama;\nvarying vec3 vOrwellGlassWorld;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 orwellEye=normalize(cameraPosition-vOrwellGlassWorld);
   vec3 orwellN=inverseTransformDirection(normal,viewMatrix);
   vec3 orwellDirection=reflect(-orwellEye,orwellN);
   vec2 orwellUv=vec2(fract(atan(orwellDirection.z,orwellDirection.x)*0.159154943+.50),asin(clamp(orwellDirection.y,-1.0,1.0))*.318309886+.50);
   vec3 orwellSky=texture2D(orwellGlassPanorama,orwellUv).rgb;
   float orwellLobe=.115+.18*pow(1.-clamp(dot(orwellN,orwellEye),0.,1.),2.0);
   outgoingLight=mix(outgoingLight,orwellSky,orwellLobe*.87);
   #include <opaque_fragment>
 `);
};
glass.material.customProgramCacheKey=()=> 'Orwell separated glass directional studio lobe V2';

const rc=new T.Raycaster();
const views={
 record:{eye:[7.87,2.30,13.10],look:[.41,2.25,-.12],dapple:true,fov:35.4},
 elevation:{eye:[.35,2.42,11.79],look:[0,2.0,.05],dapple:false,fov:39.1},
 entrance:{eye:[1.05,1.89,3.96],look:[-.07,1.60,.009],dapple:false,fov:41.},
 sash:{eye:[3.79,2.48,3.26],look:[3.05,2.37,.02],dapple:false,fov:39.4},
 foundation:{eye:[5.17,.612,3.92],look:[3.01,.64,.025],dapple:false,fov:39.8},
 return:{eye:[10.73,2.11,5.26],look:[2.61,2.05,-.26],dapple:false,fov:37.6},
};
function trace(x:number,y:number,z=2.5){
 rc.set(new T.Vector3(x,y,z),new T.Vector3(0,0,-1));
 const hit=rc.intersectObject(studio,true)[0];return hit?{name:hit.object.name,z:+hit.point.z.toFixed(6)}:null;
}
function draw(which:keyof typeof views){
 const q=views[which];cam.fov=q.fov;cam.updateProjectionMatrix();cam.position.fromArray(q.eye);cam.lookAt(new T.Vector3().fromArray(q.look));cam.updateMatrixWorld(true);shadow.castShadow=q.dapple;renderer.render(scene,cam);
}
function evidence(which:keyof typeof views){
 draw(which);const panes=studio.userData.panes as {tag:string;x:number;y:number;z:number;}[];
 const results:Record<string,number>={};for(const p of panes){const hit=trace(p.x,p.y);if(hit?.name==='glazing'&&Math.abs(hit.z-p.z)<.0001)results[p.tag]=(results[p.tag]??0)+1;}
 return{png:renderer.domElement.toDataURL('image/png'),view:views[which],paneResults:results,probes:{door:trace(-1.25,1.13),plinth:trace(2.34,.126),cream:trace(2.17,2.04),molding:trace(2.782,2.67),threshold:trace(-1.045,.311)},meshes:studio.children.map(m=>[m.name,(m as T.Mesh).geometry.getAttribute('position').count/3]),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
(window as any).clarkeStudio=evidence;
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.onclick=()=>{draw(b.dataset.view as keyof typeof views);document.querySelectorAll('[data-view]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)))};
draw('record');
