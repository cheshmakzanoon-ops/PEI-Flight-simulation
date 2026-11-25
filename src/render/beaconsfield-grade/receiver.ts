/** Physical delta reseat of original finite canopy projection. Old source shade survives, in its
 * original draw, everywhere the actual corrected triangle is absent, including inside the
 * outer rectangular yard. There is at most one auxiliary transparent draw. */
import * as T from 'three';
import {BEACON_GRADE as S,BEACON_RECEIVERS as B} from '../../sim/beaconsfield-grade.generated.ts';
import type {BoundedGrade} from '../../sim/bounded-grade.ts';
import {clipStockShadowBox,stockShadowFootprint} from '../indian-river/st-marys-shadows.ts';
import type {Vegetation} from '../vegetation.ts';
import {facet} from '../../sim/coastal-terrain.ts';
import {positiveGround} from './positive-topology.ts';
type Roster=ReturnType<Vegetation['beaconsfieldShadowRoster']>;
export type MuseumGround={mesh:T.Mesh;regular:T.Mesh;grade:BoundedGrade};
const maskName='museumShadowMoved';
const origVertex='vec2 off=vec2(.43,.21)*shape.x;',origProjection='gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);';
const raisedV=`varying vec2 vUV;varying vec3 param;
attribute float museumVariant;attribute vec2 museumDepth;varying vec2 museumDepthV;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUV=uv;museumDepthV=museumDepth;param=vec3(museumVariant,0.,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`;
const oldDiscard=`
  if(bmMarked>.5){
   vec2 at=bmXZ; // coordinates relative to the actual inset's southwest-to-southeast x/z grid
   if(all(greaterThanEqual(at,vec2(0.)))&&all(lessThan(at,vec2(128.)))){
    vec2 base=floor(at),f=fract(at);
    float m=floor(texture2D(bmMask,(base+.5)/128.).r*255.+.5);
    if(m>2.5||(m>.5&&m<1.5&&f.x+f.y<=1.)||(m>1.5&&f.x+f.y>1.))discard;
   }
  }`;
export function fragmentSamplerBudget(src:string,max:number,extra:number){
 if(!Number.isInteger(max)||max<16||!Number.isSafeInteger(extra)||extra<0)return false;
 const text=src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');let total=extra;
 for(const hit of text.matchAll(/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?[iu]?sampler\w*\s+([^;]+);/g)){
  for(const id of hit[1].split(',')){const m=/^\s*[A-Za-z_]\w*(?:\s*\[\s*(\d+)\s*\])?\s*$/.exec(id);if(!m)return false;total+=m[1]?Number(m[1]):1;}
 }
 return total<=max;
}
function groundVariant(m:T.ShaderMaterial,tex:T.DataTexture,origin:T.Vector4,maxTextures:number){
 const v='vec4 w=modelMatrix*vec4(position,1.);',f='#include <tonemapping_fragment>';
 if(!m?.isShaderMaterial||!fragmentSamplerBudget(m.fragmentShader,maxTextures,1)||!m.vertexShader.includes(v)||!m.fragmentShader.includes('uniform sampler2D imageMap,coverMap,detailMap,paintMap;')||m.fragmentShader.split(f).length!==2||!m.uniforms.detailMap)return;
 const exact=m.clone();exact.uniforms={...m.uniforms,bmMask:{value:tex},bmBounds:{value:origin}};
 exact.vertexShader='varying float bmStock;\n'+m.vertexShader.replace(v,'bmStock=gl_VertexID<12769?1.:0.;'+v);
 // Evaluate the ordinary phototexture and its derivatives first, unchanged.
 exact.fragmentShader='varying float bmStock;uniform vec4 bmBounds;uniform sampler2D bmMask;\n'+m.fragmentShader.replace(f,`
  vec2 at=(p.xz-bmBounds.xy)*bmBounds.zw;
  // Per-fragment decisions cover multiple hardware AA samples. Leave original
  // depth beneath the subpixel edge, so no sample can see through the opaque lawn.
  vec2 guard=1.5*fwidth(at)+vec2(.0015);
  if(bmStock>.5){
    if(all(greaterThanEqual(at,vec2(0.)))&&all(lessThan(at,vec2(128.)))){
     vec2 c=floor(at),uv=fract(at);
     float bits=floor(texture2D(bmMask,(c+.5)/128.).r*255.+.5);
     if(all(greaterThan(uv,guard))&&all(lessThan(uv,vec2(1.)-guard))){
      float slope=guard.x+guard.y,side=uv.x+uv.y-1.;
      if(bits>2.5||(bits>.5&&bits<1.5&&side < -slope)||(bits>1.5&&side>slope))discard;
     }
    }
  }\n`+f);return exact;
}
function variants(m:T.ShaderMaterial,tex:T.DataTexture,origin:T.Vector4){
 if(!m.vertexShader.includes(origVertex)||!m.vertexShader.includes(origProjection)||!m.fragmentShader.includes('smoothstep(.21,.98,r);if(ramp<.009)discard;')||
 !m.fragmentShader.includes('ramp*(.10+.18*mask)')||!m.uniforms.canopy?.value||!m.transparent||m.depthWrite||m.blending!==T.NormalBlending)return;
 const cut=m.clone();cut.uniforms={...m.uniforms,bmMask:{value:tex},bmBounds:{value:origin}};
 cut.vertexShader='attribute float '+maskName+';varying vec2 bmXZ;varying float bmMarked;uniform vec4 bmBounds;\n'+m.vertexShader.replace(origProjection,'bmMarked='+maskName+';bmXZ=(p.xz-bmBounds.xy)*bmBounds.zw;'+origProjection);
 cut.fragmentShader='varying vec2 bmXZ;varying float bmMarked;uniform sampler2D bmMask;\n'+m.fragmentShader.replace('#include <logdepthbuf_fragment>','#include <logdepthbuf_fragment>\n'+oldDiscard);
 const raised=m.clone();raised.vertexShader=raisedV;raised.uniforms=m.uniforms;
 // A previously buried projected canopy should not pop at its new depth intersection.
 // Full measured seating and every formerly visible fragment preserve the stock atlas alpha.
 raised.fragmentShader='varying vec2 museumDepthV;\n'+m.fragmentShader.replace('ramp*(.10+.18*mask)',
  'ramp*(.10+.18*mask)*(museumDepthV.x < -.000005?smoothstep(0.,min(.027,-museumDepthV.x),museumDepthV.y):1.)');
 return {cut,raised};
}
const expected=new Map<string,number>(B.roster.map((s,i)=>[s[0]+':'+s[2],i]));
const br=B.bounds;
function overlaps(a:{x0:number;x1:number;z0:number;z1:number},b:readonly number[]){return a.x0<b[2]&&a.x1>b[0]&&a.z0<b[3]&&a.z1>b[1];}
function slots(r:Roster){
 if(r.total<r.original||r.total>45000||r.stems.length<3*r.total||r.shapes.length<4*r.total)return;
 const hits=new Int32Array(expected.size).fill(-1);
 for(let i=0;i<r.total;i++){
  const k=3*i,j=4*i,x=r.stems[k],z=r.stems[k+2];
  if(x<br[0]-65||x>br[2]+65||z<br[1]-65||z>br[3]+65)continue;
  const h=r.shapes[j],w=r.shapes[j+1];if(!Number.isFinite(h)||!Number.isFinite(w)||h<0||w<0||w>54||h>40)return;
  if(!overlaps(stockShadowFootprint({x,z,h,w}),br))continue;
  const idx=expected.get(x+':'+z);if(idx===undefined||hits[idx]!==-1||i>=r.original)return;
  const q=B.roster[idx];if(!q.every((v,jj)=>v===(jj<3?r.stems[k+jj]:r.shapes[j+jj-3])))return;hits[idx]=i;
 }
 return hits.some(k=>k<0)?undefined:hits;
}
/** Raster-safe authoritative delta at unchanged and inserted vertices, using the *actual* original terrain geometry. */
function originalSampler(mesh:T.Mesh){
 const p=mesh.geometry.getAttribute('position');if(!p||p.count!==113*113||mesh.userData.subdiv!==112)return;
 const X=mesh.position.x,Z=mesh.position.z,left=X+p.getX(0),top=Z+p.getZ(0);
 const dx=(p.getX(112)-p.getX(0))/112,dz=(p.getZ(112*113)-p.getZ(0))/112;
 return (x:number,z:number)=>{
  const i=Math.min(111,Math.max(0,Math.floor((x-left)/dx))),j=Math.min(111,Math.max(0,Math.floor((z-top)/dz))),k=i+113*j;
  return mesh.position.y+facet((x-X-p.getX(i))/(p.getX(i+1)-p.getX(i)),(z-Z-p.getZ(j*113))/(p.getZ((j+1)*113)-p.getZ(j*113)),
   p.getY(k),p.getY(k+1),p.getY(k+113),p.getY(k+114));
 };
}
type P={x:number;y:number;z:number}; // y is positive displacement, not ground height
const FULL_RISE=.12,SURFACE_CLEARANCE=.028;
/** Split a convex polygon once at a linear scalar's zero; no duplicate coplanar face. */
function splitAt(p:P[],signed:(q:P)=>number):P[][]{
 if(p.length<3)return [];
 const a=p.map(signed);if(a.every(v=>v>=0)||a.every(v=>v<=0))return [p];
 const plus:P[]=[],minus:P[]=[];
 for(let i=0,j=p.length-1;i<p.length;j=i++){
  const q=p[j],r=p[i],v=a[j],w=a[i];
  if(v*w<0){const t=v/(v-w),m={x:q.x+(r.x-q.x)*t,y:q.y+(r.y-q.y)*t,z:q.z+(r.z-q.z)*t};plus.push(m);minus.push(m);}
  if(w>=0)plus.push(r);if(w<=0)minus.push(r);
 }
 return [plus,minus].filter(a=>a.length>=3);
}
export function measureShadowChange(source:MuseumGround){
 const {mesh,regular,grade}=source,gr=grade.grid,g=mesh.geometry,index=g.index,p=g.getAttribute('position'),raw=gr.relativeSamples;
 if(gr.spec!==S||mesh.userData.localGrade!==S.id||!raw||gr.nx!==129||gr.nz!==129||!index||mesh.userData.subdiv!==112||
    !p||mesh.rotation.x||mesh.rotation.y||mesh.rotation.z||!mesh.scale.equals(new T.Vector3(1,1,1)))return;
 const old=originalSampler(regular);if(!old)return;
 const expectedMask=new Uint8Array(128*128),mask=new Uint8Array(128*128);
 for(let j=0;j<128;j++)for(let i=0;i<128;i++){
  const k=j*129+i;expectedMask[j*128+i]=Number(!!(raw[k]||raw[k+1]||raw[k+129]))+2*Number(!!(raw[k+1]||raw[k+129]||raw[k+130]));
 }
 const P:number[]=[],U:number[]=[],V:number[]=[],limits:number[]=[],used=new Set<number>(),origin=mesh.position;
 const domain=B.roster.map(s=>stockShadowFootprint({x:s[0],z:s[2],h:s[3],w:s[4]}));
 const domainNear=domain.map(d=>[d.x0,d.z0,d.x1,d.z1]);
 let moved=0;
 // The only moved faces are in single 0.85m cells of the actual submitted index.
 for(let k=0;k<index.count;k+=3){
  const ids=[index.getX(k),index.getX(k+1),index.getX(k+2)];
  const x=ids.map(i=>p.getX(i)+origin.x),z=ids.map(i=>p.getZ(i)+origin.z);const box={x0:Math.min(...x),x1:Math.max(...x),z0:Math.min(...z),z1:Math.max(...z)};
  if(!overlaps(box,br))continue;
  const y=ids.map((id,i)=>Math.max(0,p.getY(id)+origin.y-old(x[i],z[i])));if(Math.max(...y)<.004)continue;
  if(box.x1-box.x0>gr.stepX+.003||box.z1-box.z0>gr.stepZ+.003)return;
  const cx=((x[0]+x[1]+x[2])/3-gr.x0)/gr.stepX,cz=((z[0]+z[1]+z[2])/3-gr.z0)/gr.stepZ;
  const i=Math.floor(cx),j=Math.floor(cz),bit=(cx-i)+(cz-j)<=1?1:2;
  if(i<0||j<0||i>=128||j>=128||!(expectedMask[128*j+i]&bit)||(mask[128*j+i]&bit))return;
  mask[128*j+i]|=bit;
  moved++;const tr=x.map((a,n)=>({x:a,y:y[n]<.004?0:y[n],z:z[n]}));
  for(let t=0;t<domain.length;t++){if(!overlaps(box,domainNear[t]))continue;
   const d=domain[t],part=clipStockShadowBox(tr,d),s=B.roster[t];
   if(part.length<3)continue;
   const oldPlane=Math.fround(s[1]+Math.fround(.46));
   // The correction interpolates *clearance* only on raised faces. Subdivide at
   // full rise, so the interior follows the actual submitted plane exactly.
   // Split the shoulder once where old ground crosses the old flat silhouette;
   // no previously visible fragment can sink below the new terrain in the blend.
   const bands=splitAt(part,q=>q.y-FULL_RISE);
   const pieces=bands.flatMap(v=>v.some(q=>q.y<FULL_RISE-1e-9)?splitAt(v,q=>old(q.x,q.z)-oldPlane):[v]);
   for(const pts of pieces)for(let h=1;h+1<pts.length;h++){
    const vs=[pts[0],pts[h],pts[h+1]],ar=(vs[1].x-vs[0].x)*(vs[2].z-vs[0].z)-(vs[1].z-vs[0].z)*(vs[2].x-vs[0].x);if(Math.abs(ar)<1e-8)continue;
    used.add(t);for(const q of ar<0?vs:[vs[0],vs[2],vs[1]]){
     const source=old(q.x,q.z),fade=Math.min(1,Math.max(0,q.y/FULL_RISE));
     const absolute=q.y===0?oldPlane:q.y>=FULL_RISE-1e-9?source+q.y+SURFACE_CLEARANCE:oldPlane+q.y+fade*(source+SURFACE_CLEARANCE-oldPlane);
     P.push(q.x-origin.x,absolute-origin.y,q.z-origin.z);
     U.push((q.x-d.x0)/(d.x1-d.x0),(q.z-d.z0)/(d.z1-d.z0));V.push(s[5]);limits.push(oldPlane-source,absolute-(source+q.y));
    }
   }
  }
 }
 if(moved<100||moved>6500||used.size<2||P.length/9>18000||!mask.every((v,i)=>v===expectedMask[i]))return;
 const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(P,3));geom.setAttribute('uv',new T.Float32BufferAttribute(U,2));geom.setAttribute('museumVariant',new T.Float32BufferAttribute(V,1));geom.setAttribute('museumDepth',new T.Float32BufferAttribute(limits,2));geom.computeBoundingSphere();
 return {geom,mask,used:[...used],origin:new T.Vector4(gr.x0,gr.z0,1/gr.stepX,1/gr.stepZ),moved};
}
export class MuseumShadowDelta{
 readonly positiveGround=positiveGround;
 private prepared?:ReturnType<typeof measureShadowChange>;private stage?:MuseumGround;private version=-1;private matched?:Int32Array;
 // A rejected immutable combination must not reconstruct thousands of draft triangles per animation frame.
 private refused?:{mesh:T.BufferGeometry;regular:T.BufferGeometry;grade:BoundedGrade;land:T.Material|T.Material[];canopy:T.Material|T.Material[]};
 private oldGround?:T.ShaderMaterial;private newGround?:T.ShaderMaterial;private old?:T.ShaderMaterial;private effect?:NonNullable<ReturnType<typeof variants>>;private texture?:T.DataTexture;
 private marks?:T.InstancedBufferAttribute;private replacement?:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 private marked:number[]=[];live=false;count=0;triangles=0;
 constructor(private scene:T.Scene,private maxTextures:number){}
 update(r:Roster,s:MuseumGround|undefined){
  if(!s||!r.stock.visible){if(this.stage||this.refused)this.clear(r,true);return false;}
  const no=this.refused;
  if(no&&no.mesh===s.mesh.geometry&&no.regular===s.regular.geometry&&no.grade===s.grade&&no.land===s.mesh.material&&no.canopy===r.stock.material)return false;
  if(this.stage?.mesh.geometry!==s.mesh.geometry||this.stage?.regular.geometry!==s.regular.geometry){
   this.clear(r,true);
   const reject=()=>{this.refused={mesh:s.mesh.geometry,regular:s.regular.geometry,grade:s.grade,land:s.mesh.material,canopy:r.stock.material};return false;};
   const d=measureShadowChange(s);if(!d)return reject();
   const tex=new T.DataTexture(d.mask,128,128,T.RedFormat,T.UnsignedByteType);tex.generateMipmaps=false;tex.minFilter=tex.magFilter=T.NearestFilter;tex.needsUpdate=true;
   const old=r.stock.material as T.ShaderMaterial,e=variants(old,tex,d.origin);
   const originalGround=s.mesh.material as T.ShaderMaterial,changed=groundVariant(originalGround,tex,d.origin,this.maxTextures);
   if(!e||!changed){tex.dispose();d.geom.dispose();e?.cut.dispose();e?.raised.dispose();changed?.dispose();return reject();}
   this.oldGround=originalGround;this.newGround=changed;
   this.prepared=d;this.stage=s;this.old=old;this.effect=e;this.texture=tex;this.version=-1;
   this.replacement=new T.Mesh(d.geom,e.raised);this.replacement.position.copy(s.mesh.position);this.replacement.frustumCulled=false;
   this.replacement.renderOrder=r.stock.renderOrder;this.replacement.name='Beaconsfield original canopy mask on raised ground only';this.replacement.visible=false;
   this.scene.add(this.replacement);this.marks=new T.InstancedBufferAttribute(new Float32Array(r.stems.length/3),1).setUsage(T.DynamicDrawUsage);
  }
  if(!this.newGround||!this.oldGround||!this.old||!this.effect||!this.replacement||!this.marks||!this.prepared)return false;
  if((s.mesh.material!==this.oldGround&&s.mesh.material!==this.newGround)||(r.stock.material!==this.old&&r.stock.material!==this.effect.cut)){this.clear(r,true);return false;}
  if(this.live&&s.mesh.material===this.newGround&&this.version===r.revision&&r.stock.material===this.effect.cut&&r.stock.geometry.getAttribute(maskName)===this.marks&&this.replacement.visible)return true;
  if(this.version!==r.revision){this.matched=slots(r);this.version=r.revision;}
  if(!this.matched){this.clear(r);return false;}
  const current=this.prepared.used.map(i=>this.matched![i]);
  if(!this.live||this.marked.length!==current.length||this.marked.some((x,i)=>x!==current[i])){
   for(const i of this.marked)this.marks.setX(i,0);for(const i of current)this.marks.setX(i,1);this.marks.needsUpdate=true;this.marked=current;
  }
  s.mesh.material=this.newGround;r.stock.geometry.setAttribute(maskName,this.marks);r.stock.material=this.effect.cut;this.replacement.visible=true;this.live=true;
  this.count=current.length;this.triangles=this.prepared.geom.getAttribute('position').count/3;return true;
 }
 clear(r:Roster,dispose=false){
  this.live=false;this.count=this.triangles=0;
  if(this.stage&&this.oldGround&&this.stage.mesh.material===this.newGround)this.stage.mesh.material=this.oldGround;
  if(this.old&&r.stock.material===this.effect?.cut)r.stock.material=this.old;
  if(this.marks&&r.stock.geometry.getAttribute(maskName)===this.marks)r.stock.geometry.deleteAttribute(maskName);
  if(this.replacement)this.replacement.visible=false;
  if(dispose){this.refused=undefined;if(this.replacement)this.scene.remove(this.replacement);this.prepared?.geom.dispose();this.texture?.dispose();this.effect?.cut.dispose();this.effect?.raised.dispose();this.newGround?.dispose();this.newGround=undefined;this.oldGround=undefined;
   this.stage=undefined;this.prepared=undefined;this.effect=undefined;this.replacement=undefined;this.texture=undefined;this.old=undefined;this.marks=undefined;this.marked=[];this.version=-1;this.matched=undefined;}
 }
}
