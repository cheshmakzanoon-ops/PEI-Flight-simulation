import * as THREE from 'three';
import { Terrain, type TerrainSpec } from '../sim/terrain.ts';
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
const skyFrag=fp+`
 void main(){
 #include <logdepthbuf_fragment>
 vec3 rd=normalize(p-cameraPosition); float y=max(rd.y,.001),mus=max(dot(rd,sun),0.);
 vec3 sky=mix(vec3(.63,.77,.82),vec3(.105,.285,.52),pow(y,.52));
 sky+=vec3(.42,.30,.165)*pow(mus,12.)+vec3(3.4,2.63,1.46)*smoothstep(.99988,.99998,mus);
 if(rd.y>.011){
  vec2 u=rd.xz/(rd.y+.085)*1.65+vec2(clock*.00043,0.);
  float body=fbm(u+fbm(u*.36)*1.6), cover=smoothstep(.53,.66,body)*smoothstep(.012,.2,rd.y);
  float rim=clamp((body-fbm(u+sun.xz*.10))*3.1+.48,0.,1.);
  vec3 cloud=mix(vec3(.48,.55,.61),vec3(1.48,1.38,1.19),rim+.25);
  sky=mix(sky,cloud,cover*.85);
 }
 gl_FragColor=vec4(sky,1.);`+out;
const waterFrag=fp+`
 uniform sampler2D imageMap; uniform vec4 extent;
 void main(){
 #include <logdepthbuf_fragment>
 vec3 eye=cameraPosition-p;float dist=length(eye);vec3 view=eye/max(dist,.01);
 vec2 xy=p.xz*.10;float t=clock*.55;
 float fade=1.-smoothstep(220.,4700.,dist);
 vec2 d=vec2(.78,.43)*cos(dot(xy,vec2(.78,.43))+.65*t)*.042+vec2(-.17,.91)*cos(dot(xy,vec2(-.17,.91))*1.63-t)*.025;
 d+=fade*vec2(noise(xy*.7+vec2(t,.0))-.5,noise(xy*.8-vec2(t,0.))-.5)*.115;
 d+=vec2(sin(p.z*.0016+sin(p.x*.001)),cos(p.x*.0011-p.z*.0012))*.027;
 vec3 norm=normalize(vec3(-d.x,1.,-d.y)),halfV=normalize(view+sun);
 float fres=pow(1.-max(dot(norm,view),0.),3.7);
 vec3 deep=vec3(.035,.135,.16),skyRefl=vec3(.42,.57,.65);
 vec2 uv=(p.xz-extent.xy)/extent.zw;
 if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){
   vec3 sat=texture2D(imageMap,vec2(uv.x,1.-uv.y)).rgb;
   vec3 atlasSea=clamp(sat*.65+vec3(.007,.035,.043),vec3(.012,.055,.068),vec3(.095,.25,.26));
   deep=mix(deep,atlasSea,.48);
 }
 vec3 col=mix(deep,skyRefl,clamp(.09+fres*.83+noise(p.xz*.00034)*.051,0.,1.));
 col+=vec3(1.3,.99,.66)*pow(max(dot(norm,halfV),0.),mix(120.,330.,fade))*.9;
 gl_FragColor=vec4(mist(col,dist,p.y),1.);`+out;
const landFrag=fp+`
 uniform sampler2D imageMap;uniform sampler2D maskMap;uniform vec2 maskPixel;
 void main(){
 #include <logdepthbuf_fragment>
 vec2 uv=vec2(vuv.x,1.-vuv.y);
 if(texture2D(maskMap,vuv).r<.5)discard;
 vec3 col=texture2D(imageMap,uv).rgb;
 // Preserve the seasonal satellite palette; directional detail is subtle because the image is already lit.
 vec3 n=normalize(cross(dFdx(p),dFdy(p)));if(n.y<0.)n=-n;
 float ndl=clamp(dot(n,sun),0.,1.);
 col*=.83+.32*ndl;
 float detailFade=1.-smoothstep(230.,2600.,distance(cameraPosition,p));
 col*=1.+detailFade*.08*(noise(p.xz*.19)-.5);
 float d=distance(cameraPosition,p);gl_FragColor=vec4(mist(col,d,p.y),1.);`+out;
export async function loadAtlas(progress:(s:string)=>void){
 const json=await fetch(base+'terrain.json');if(!json.ok)throw Error('The terrain manifest could not be loaded.');
 const spec:TerrainSpec&{file:string;sha256:string}=await json.json();
 progress('Reading surveyed elevations…');
 const [response,img]=await Promise.all([fetch(base+spec.file),new THREE.TextureLoader().loadAsync(base+'color.webp')]);
 if(!response.ok||!response.body)throw Error('The elevation archive could not be downloaded.');
 // Some static servers send Content-Encoding: gzip even for .gz assets and the browser has already decoded them.
 let data=await response.arrayBuffer();
 const bytes=new Uint8Array(data);
 if(bytes[0]===0x1f&&bytes[1]===0x8b){
  data=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 }
 if(data.byteLength!==2*spec.width*spec.height)throw Error('The terrain download is incomplete. Please reload.');
 if(globalThis.crypto?.subtle && spec.sha256){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  if(Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')!==spec.sha256)throw Error('The terrain checksum does not match the manifest.');
 }
 img.colorSpace=THREE.SRGBColorSpace;img.anisotropy=4;
 return {terrain:new Terrain(spec,new Int16Array(data)),img};
}
interface Patch { coarse:THREE.Mesh;fine?:THREE.Mesh; x0:number;z0:number;w:number;d:number; }
export class World {
 private tiles:Patch[]=[];private mat:THREE.ShaderMaterial;private sky:THREE.Mesh;
 private t={value:0};private recent=0;
 readonly sun=new THREE.Vector3(-.72,.63,-.44).normalize();
 constructor(readonly scene:THREE.Scene,readonly terrain:Terrain, img:THREE.Texture,readonly renderer:THREE.WebGLRenderer){
   const T=terrain;const mask=new THREE.DataTexture(Uint8Array.from(T.samples,n=>n===-32768?0:255),T.spec.width,T.spec.height,THREE.RedFormat);
   mask.magFilter=mask.minFilter=THREE.NearestFilter;mask.generateMipmaps=false;mask.needsUpdate=true;
   const uniforms={sun:{value:this.sun},clock:this.t,imageMap:{value:img},maskMap:{value:mask},maskPixel:{value:new THREE.Vector2(1/T.spec.width,1/T.spec.height)},extent:{value:new THREE.Vector4(T.left,T.top,T.right-T.left,T.bottom-T.top)}};
   const make=(fragmentShader:string,side:THREE.Side=THREE.FrontSide)=>new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader,side});
   this.sky=new THREE.Mesh(new THREE.SphereGeometry(290000,32,20),make(skyFrag,THREE.BackSide));this.sky.renderOrder=-10;this.sky.material && ((this.sky.material as THREE.Material).depthWrite=false);this.sky.frustumCulled=false;scene.add(this.sky);
   const ocean=new THREE.Mesh(new THREE.PlaneGeometry(650000,650000),make(waterFrag));ocean.rotation.x=-Math.PI/2;ocean.position.y=-.22;scene.add(ocean);
   this.mat=make(landFrag);
   const nx=32,nz=22,w=(T.right-T.left)/nx,d=(T.bottom-T.top)/nz;
   for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x0=T.left+i*w,z0=T.top+j*d;
    const sx=Math.floor(i*T.spec.width/nx),ex=Math.ceil((i+1)*T.spec.width/nx);
    const sy=Math.floor(j*T.spec.height/nz),ey=Math.ceil((j+1)*T.spec.height/nz);
    let any=false;outer:for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++)if(T.samples[y*T.spec.width+x]!==-32768){any=true;break outer;}
    if(!any)continue;
    const coarse=this.patch(x0,z0,w,d,8);scene.add(coarse);this.tiles.push({coarse,x0,z0,w,d});
   }
   const hemi=new THREE.HemisphereLight(0xe6f5ff,0x7c8065,2.0);scene.add(hemi);
   const light=new THREE.DirectionalLight(0xffe7c2,2.6);light.position.copy(this.sun).multiplyScalar(40000);scene.add(light);
   // An analytical sky/ground reflection environment makes varnish, glazing and bare metal readable.
   const colors=new Uint8Array(256*128*4);
   for(let j=0;j<128;j++)for(let i=0;i<256;i++){
    const a=(i/256-.5)*Math.PI*2,b=(j/128-.5)*Math.PI, y=Math.sin(b);
    const sparkle=Math.pow(Math.max(0,Math.cos(a)*Math.cos(b)*this.sun.x+y*this.sun.y+Math.sin(a)*Math.cos(b)*this.sun.z),65);
    const c=y>0?[154-78*y,184-56*y,202-30*y]:[105+22*y,111+25*y,99+26*y];
    const k=4*(j*256+i);for(let n=0;n<3;n++)colors[k+n]=Math.min(255,c[n]+sparkle*115);colors[k+3]=255;
   }
   const env=new THREE.DataTexture(colors,256,128);env.mapping=THREE.EquirectangularReflectionMapping;env.colorSpace=THREE.SRGBColorSpace;env.needsUpdate=true;scene.environment=env;scene.environmentIntensity=.55;
   this.buildRunways();
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
  return {height:this.terrain.elevation(x,z)+.12,land:this.terrain.isLand(x,z),runway:RUNWAYS.some(r=>{const dx=x-r.p.x,dz=z-r.p.z,a=dx*r.dx+dz*r.dz;return a>=0&&a<=r.length&&Math.abs(dx*r.dz-dz*r.dx)<r.width/2;})};
 }
 update(pos:THREE.Vector3,clock:number){
  this.sky.position.copy(pos);this.t.value=clock;
  if(Math.abs(clock-this.recent)<.25&&this.recent>0)return;
  this.recent=clock;
  for(const tile of this.tiles){
   const dx=pos.x-(tile.x0+tile.w/2),dz=pos.z-(tile.z0+tile.d/2);
   const fine=dx*dx+dz*dz<10500**2;
   if(fine&&!tile.fine){tile.fine=this.patch(tile.x0,tile.z0,tile.w,tile.d,56);this.scene.add(tile.fine);}
   tile.coarse.visible=!fine;if(tile.fine){tile.fine.visible=fine;if(!fine&&dx*dx+dz*dz>15000**2){this.scene.remove(tile.fine);tile.fine.geometry.dispose();tile.fine=undefined;}}
  }
 }
 private buildRunways(){
  // Draw subdivided true-coordinate strips and markings draped over the same terrain as physics.
  const asphalt=new THREE.MeshStandardMaterial({color:0x454b4a,roughness:1,polygonOffset:true,polygonOffsetFactor:-3});
  const ink=new THREE.MeshBasicMaterial({color:0xe1e0d2,polygonOffset:true,polygonOffsetFactor:-6});
  for(const r of RUNWAYS){
   const draw=(a:number,b:number,x0:number,x1:number,material:THREE.Material)=>{
    const vs:number[]=[],ix:number[]=[],steps=Math.max(1,Math.ceil((b-a)/30));
    for(let i=0;i<=steps;i++){
     const s=a+(b-a)*i/steps;
     for(const off of [x0,x1]){
      const x=r.p.x+r.dx*s-r.dz*off,z=r.p.z+r.dz*s+r.dx*off;
      vs.push(x,this.terrain.meshElevation(x,z)+(material===ink?.40:.32),z);
     }
     if(i){const k=2*i;ix.push(k-2,k-1,k,k-1,k+1,k);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();
    material.side=THREE.DoubleSide;this.scene.add(new THREE.Mesh(g,material));
   };
   draw(0,r.length,-r.width/2,r.width/2,asphalt);
   draw(0,r.length,-r.width/2+1,-r.width/2+1.6,ink);draw(0,r.length,r.width/2-1.6,r.width/2-1,ink);
   for(let s=60;s<r.length-60;s+=65)draw(s,Math.min(r.length-45,s+31),-.48,.48,ink);
   for(const s of [12,r.length-38])for(let j=-4;j<=4;j++){if(j)draw(s,s+23,j*3.4-.85,j*3.4+.85,ink);}
  }
 }
}
