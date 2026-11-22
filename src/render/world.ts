import * as THREE from 'three';
import { Terrain, type TerrainSpec } from '../sim/terrain.ts';
import {unpackGzip} from '../sim/compression.ts';
import { Cover } from '../sim/cover.ts';
import { DetailImagery } from './detail.ts';
import { runwayAtlas } from './runway-paint.ts';
import { RUNWAYS } from '../sim/places.ts';
import type { Surface } from '../sim/flight.ts';
const base = import.meta.env.BASE_URL + 'world/';
const vertex=`
 varying vec3 p; varying vec2 vuv;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;vuv=uv;gl_Position=projectionMatrix*viewMatrix*w;
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
const waterFrag=fp+skyFn+`
 uniform sampler2D imageMap,coverMap; uniform vec4 extent;
 float filteredWave(vec2 xy,vec2 k,float phase){float arg=dot(xy,k)+phase;return cos(arg)*(1.-smoothstep(.27,2.55,fwidth(arg)));}
 void main(){
 #include <logdepthbuf_fragment>
 vec3 eye=cameraPosition-p;float dist=length(eye);vec3 view=eye/max(dist,.01);
 vec2 q=p.xz;float t=clock*.72;
 float fade=1.-smoothstep(260.,5200.,dist);
 vec2 n=vec2(.69,.36)*filteredWave(q,vec2(.056,.026),t*.7)*.051+vec2(-.17,.91)*filteredWave(q,vec2(-.019,.082),-t)*.034;
 n+=vec2(.51,-.62)*filteredWave(q,vec2(.19,-.16),t*1.30)*.020*fade;
 n+=vec2(.31,.57)*filteredWave(q,vec2(.013,.009),-t*.248)*.027;
 n*=1.-smoothstep(1000.,18500.,dist);
 vec3 normal=normalize(vec3(-n.x,1.,-n.y));vec3 refl=reflect(-view,normal);
 float fres=.024+.91*pow(1.-max(dot(normal,view),0.),4.1);
 vec2 uv=(p.xz-extent.xy)/extent.zw;
 float shore=-254.;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){shore=(texture2D(coverMap,uv).g*255.-128.)*2.;}
 float shallows=smoothstep(-175.,-7.,shore);
 vec3 deep=mix(vec3(.015,.070,.096),vec3(.094,.258,.228),shallows*.74);
 vec3 c=mix(deep,skyAt(normalize(vec3(refl.x,max(refl.y,.025),refl.z)))*.95,fres);
 float glitter=pow(clamp(dot(normal,normalize(view+sun)),0.,1.),130.);
 c+=vec3(1.5,1.05,.53)*glitter*(.65+.35*fade);
 float phase=shore*.51+t*1.4+3.*noise(q*.041);
 float foam=smoothstep(-37.,-4.,shore)*(1.-smoothstep(-4.,1.,shore))*(.25+.75*smoothstep(.30,.82,sin(phase)))*(1.-smoothstep(.9,4.,fwidth(phase)));
 c=mix(c,vec3(.55,.65,.58),foam*.69);
 gl_FragColor=vec4(mist(c,dist,p.y),1.);`+out;
const landFrag=fp+`
 uniform sampler2D imageMap,coverMap,detailMap,paintMap; uniform float hasDetail;uniform vec4 detailBox;
 uniform vec4 airport[3];uniform vec2 stripSize[3];
 void main(){
 #include <logdepthbuf_fragment>
 vec2 cover=texture2D(coverMap,vuv).rg;float coast=(cover.g*255.-128.)*2.;if(coast<0.)discard;
 vec2 uv=vec2(vuv.x,1.-vuv.y);
 vec3 col=texture2D(imageMap,uv).rgb;
 if(hasDetail>.5){vec2 q=(vuv-detailBox.xy)*detailBox.zw;col=texture2D(detailMap,vec2(q.x,1.-q.y)).rgb;}
 vec3 n=normalize(cross(dFdx(p),dFdy(p)));if(n.y<0.)n=-n;
 float d=distance(cameraPosition,p),light=clamp(dot(n,sun),0.,1.);
 // Inferred low beach substrate vs higher headlands; not a survey of coastal geology.
 float beach=(1.-smoothstep(4.,25.,coast))*(1.-smoothstep(4.,14.,p.y));
 float cliff=(1.-smoothstep(3.,15.,coast))*smoothstep(3.,16.,p.y);
 col=mix(col,vec3(.47,.34,.20)*(.89+.16*noise(p.xz*.057)),beach*.79);
 col=mix(col,vec3(.23,.091,.054),cliff*.7);
 float detailFade=1.-smoothstep(290.,1900.,d);
 float crop=(1.-smoothstep(2.,10.,abs(cover.r*255.-40.)));
 float angle=floor(noise(floor(p.xz/245.))*7.)*.45;
 float phase=dot(p.xz,vec2(cos(angle),sin(angle)))*2.2;
 float rows=cos(phase)*(1.-smoothstep(.35,2.6,fwidth(phase)));
 col*=1.+detailFade*(.13*(noise(p.xz*.46)-.5)+.055*crop*rows);
 col*=.90+.31*light;
 for(int i=0;i<3;i++){
  vec2 delta=p.xz-airport[i].xy,axis=airport[i].zw;float along=dot(delta,axis)/stripSize[i].x;
  float across=dot(delta,vec2(-axis.y,axis.x))/stripSize[i].y+.5;
  if(along>=0.&&along<=1.&&across>=0.&&across<=1.){vec2 u=vec2((float(i)+clamp(across,.005,.995))/3.,1.-along);col=texture2D(paintMap,u).rgb*(.90+.17*light);break;}
 }
 gl_FragColor=vec4(mist(col,d,p.y),1.);`+out;
export async function loadAtlas(progress:(s:string)=>void){
 const json=await fetch(base+'terrain.json');if(!json.ok)throw Error('The terrain manifest could not be loaded.');
 const spec:TerrainSpec&{file:string;sha256:string}=await json.json();
 progress('Reading surveyed elevations…');
 const [response,img]=await Promise.all([fetch(base+spec.file),new THREE.TextureLoader().loadAsync(base+'color.webp')]);
 if(!response.ok||!response.body)throw Error('The elevation archive could not be downloaded.');
 // Some static servers send Content-Encoding: gzip even for .gz assets and the browser has already decoded them.
 const data=await unpackGzip(await response.arrayBuffer());
 if(data.byteLength!==2*spec.width*spec.height)throw Error('The terrain download is incomplete. Please reload.');
 if(globalThis.crypto?.subtle && spec.sha256){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  if(Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')!==spec.sha256)throw Error('The terrain checksum does not match the manifest.');
 }
 img.colorSpace=THREE.SRGBColorSpace;img.anisotropy=4;
 const [cmeta,coverData,sky]=await Promise.all([fetch(base+'cover.json'),fetch(base+'cover.bin.gz'),new THREE.TextureLoader().loadAsync(base+'maritime-sky.webp')]);
 if(!cmeta.ok||!coverData.ok)throw Error('The coastline and forest atlas could not be loaded.');
 const cs=await cmeta.json();const cb=await unpackGzip(await coverData.arrayBuffer());
 sky.colorSpace=THREE.SRGBColorSpace;sky.wrapS=THREE.RepeatWrapping;
 return {terrain:new Terrain(spec,new Int16Array(data)),img,cover:new Cover(cs.width,cs.height,new Uint8Array(cb)),sky};
}
interface Patch { id:string;local:THREE.ShaderMaterial;status:'idle'|'loading'|'ready'|'missing';detail?:THREE.Texture;coarse:THREE.Mesh;fine?:THREE.Mesh; x0:number;z0:number;w:number;d:number; }
export class World {
 private tiles:Patch[]=[];private mat:THREE.ShaderMaterial;private sky:THREE.Mesh;
 private t={value:0};private recent=0;private details=new DetailImagery();private loading=0;private lastX=0;private lastZ=0;
 readonly sun=new THREE.Vector3(-.60,.74,-.31).normalize();
 constructor(readonly scene:THREE.Scene,readonly terrain:Terrain, img:THREE.Texture,readonly renderer:THREE.WebGLRenderer,readonly cover:Cover,sky:THREE.Texture){
   const T=terrain;const cm=new THREE.DataTexture(cover.bytes,cover.width,cover.height,THREE.RGFormat);
   cm.magFilter=cm.minFilter=THREE.LinearFilter;cm.needsUpdate=true;
   const paint=runwayAtlas();
   const uniforms={sun:{value:this.sun},clock:this.t,imageMap:{value:img},skyMap:{value:sky},coverMap:{value:cm},detailMap:{value:img},hasDetail:{value:0},detailBox:{value:new THREE.Vector4(0,0,1,1)},paintMap:{value:paint.map},airport:{value:paint.orig},stripSize:{value:paint.size},extent:{value:new THREE.Vector4(T.left,T.top,T.right-T.left,T.bottom-T.top)}};
   const make=(fragmentShader:string,side:THREE.Side=THREE.FrontSide)=>new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader,side});
   this.sky=new THREE.Mesh(new THREE.SphereGeometry(290000,32,20),make(skyFrag,THREE.BackSide));this.sky.renderOrder=-10;this.sky.material && ((this.sky.material as THREE.Material).depthWrite=false);this.sky.frustumCulled=false;scene.add(this.sky);
   const ocean=new THREE.Mesh(new THREE.PlaneGeometry(650000,650000),make(waterFrag));ocean.rotation.x=-Math.PI/2;ocean.position.y=-.055;scene.add(ocean);
   this.mat=make(landFrag);
   const nx=32,nz=22,w=(T.right-T.left)/nx,d=(T.bottom-T.top)/nz;
   for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x0=T.left+i*w,z0=T.top+j*d;
    const sx=Math.floor(i*T.spec.width/nx),ex=Math.ceil((i+1)*T.spec.width/nx);
    const sy=Math.floor(j*T.spec.height/nz),ey=Math.ceil((j+1)*T.spec.height/nz);
    let any=false;outer:for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++)if(T.samples[y*T.spec.width+x]!==-32768){any=true;break outer;}
    if(!any)continue;
    const local=new THREE.ShaderMaterial({uniforms:{...uniforms,hasDetail:{value:0},detailMap:{value:img},detailBox:{value:new THREE.Vector4(i/nx,j/nz,nx,nz)}},vertexShader:vertex,fragmentShader:landFrag});
    const coarse=this.patch(x0,z0,w,d,8);coarse.material=local;scene.add(coarse);this.tiles.push({id:i+'-'+j,local,status:'idle',coarse,x0,z0,w,d});
   }
   const hemi=new THREE.HemisphereLight(0xe3eeff,0x78654c,1.48);scene.add(hemi);
   const light=new THREE.DirectionalLight(0xffedda,2.2);light.position.copy(this.sun).multiplyScalar(40000);scene.add(light);
   const env=sky.clone();env.mapping=THREE.EquirectangularReflectionMapping;env.needsUpdate=true;scene.environment=env;scene.environmentIntensity=.77;
   scene.environmentRotation.y=-.512*Math.PI*2;
   
 }
 private patch(x0:number,z0:number,w:number,d:number,n:number){
  const g=new THREE.PlaneGeometry(w,d,n,n);g.rotateX(-Math.PI/2);
  const pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i)+x0+w/2,z=pos.getZ(i)+z0+d/2;
    pos.setY(i,this.terrain.meshElevation(x,z)+.12);
    const [u,v]=this.terrain.uv(x,z);uv.setXY(i,u,v);
  }
  g.computeBoundingSphere();const m=new THREE.Mesh(g,this.mat);m.position.set(x0+w/2,0,z0+d/2);return m;
 }
 surface(x:number,z:number):Surface{
  return {height:this.terrain.elevation(x,z)+.12,land:this.cover.distance(this.terrain,x,z)>=0,runway:RUNWAYS.some(r=>{const dx=x-r.p.x,dz=z-r.p.z,a=dx*r.dx+dz*r.dz;return a>=0&&a<=r.length&&Math.abs(dx*r.dz-dz*r.dx)<r.width/2;})};
 }
 update(pos:THREE.Vector3,clock:number){
  this.sky.position.copy(pos);this.t.value=clock;this.lastX=pos.x;this.lastZ=pos.z;
  if(Math.abs(clock-this.recent)<.25&&this.recent>0)return;
  this.recent=clock;
  for(const tile of this.tiles){
   const dx=pos.x-(tile.x0+tile.w/2),dz=pos.z-(tile.z0+tile.d/2);
   const fine=dx*dx+dz*dz<10500**2;
   if(fine&&!tile.fine){tile.fine=this.patch(tile.x0,tile.z0,tile.w,tile.d,56);tile.fine.material=tile.local;this.scene.add(tile.fine);}
   if(tile.detail&&dx*dx+dz*dz>19000**2){tile.detail.dispose();(tile.detail.image as ImageBitmap)?.close?.();tile.detail=undefined;tile.status='idle';tile.local.uniforms.hasDetail.value=0;tile.local.uniforms.detailMap.value=tile.local.uniforms.imageMap.value;}
   tile.coarse.visible=!fine;if(tile.fine){tile.fine.visible=fine;if(!fine&&dx*dx+dz*dz>15000**2){this.scene.remove(tile.fine);tile.fine.geometry.dispose();tile.fine=undefined;}}
  }
  const near=this.tiles.filter(q=>q.status==='idle'&&Math.hypot(pos.x-q.x0-q.w/2,pos.z-q.z0-q.d/2)<14500)
   .sort((a,b)=>Math.hypot(pos.x-a.x0-a.w/2,pos.z-a.z0-a.d/2)-Math.hypot(pos.x-b.x0-b.w/2,pos.z-b.z0-b.d/2));
  for(const q of near){if(this.loading>=3)break;this.request(q);}

 }
 detailState(){return {ready:this.tiles.filter(t=>t.status==='ready').length,loading:this.loading,missing:this.tiles.filter(t=>t.status==='missing').length};}
 private request(tile:Patch){
  this.loading++;tile.status='loading';
  void this.details.load(tile.id).then(tex=>{if(!tex){tile.status='missing';return;}
   const dx=this.lastX-(tile.x0+tile.w/2),dz=this.lastZ-(tile.z0+tile.d/2);
   if(dx*dx+dz*dz>19000**2){tex.dispose();(tex.image as ImageBitmap)?.close?.();tile.status='idle';return;}
   tile.detail=tex;tile.status='ready';tile.local.uniforms.detailMap.value=tex;tile.local.uniforms.hasDetail.value=1;
  }).catch(e=>{tile.status='missing';console.warn('Base atlas retained; detail tile unavailable',tile.id,e);}).finally(()=>this.loading--);
 }
}
