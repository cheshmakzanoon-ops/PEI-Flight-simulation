import * as THREE from 'three';

type LegacyShade=THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
type Point={x:number;y:number;z:number};
type Box={x0:number;x1:number;z0:number;z1:number};
type Stem={i:number;x:number;y:number;z:number;h:number;w:number;variant:number;param:number};
export type StMarysShadowGround=Readonly<{
  // Borrowed exact submitted N112 World.patch, not a reconstructed terrain.
  mesh:THREE.Mesh;
  gradeId:string;
  bounds:readonly [x0:number,z0:number,x1:number,z1:number];
  // Used only to reject an unknown live stock caster over changed ground.
  inChangedSupport:(x:number,z:number)=>boolean;
}>;
export const ST_MARYS_STEM_XZ:ReadonlyArray<readonly [number,number]>=Object.freeze([
  [-36050.9765625,2554.396484375],[-36044.0078125,2549.137939453125],
  [-36065.1875,2563.276611328125],[-36056.33984375,2559.67724609375],
]);
const KEY='stMarysReceiverReplaced',VARY='stMarysShadowReplaced',LIFT=.028;
const xzKey=(x:number,z:number)=>x+':'+z;
const STEMS=new Map(ST_MARYS_STEM_XZ.map(([x,z],i)=>[xzKey(x,z),i]));
const intersects=(a:Box,b:Box)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.z1,b.z1)>Math.max(a.z0,b.z0);
export function stockShadowFootprint(s:Pick<Stem,'x'|'z'|'h'|'w'>):Box{
  // Same arithmetic order as the shipped instanced shadow vertex shader.
  const f=Math.fround,cx=f(f(.43)*s.h),cz=f(f(.21)*s.h),wx=f(f(s.w*.5)*f(1.42)),wz=f(f(s.w*.5)*f(1.19));
  const q=(a:number,b:number,c:number)=>f(a+f(b+c));
  return {x0:q(s.x,cx,-wx),x1:q(s.x,cx,wx),z0:q(s.z,cz,-wz),z1:q(s.z,cz,wz)};
}
function halfPlane(p:readonly Point[],key:'x'|'y'|'z',b:number,sign:1|-1):Point[]{
  const r:Point[]=[];
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const q=p[j],s=p[i],a=(q[key]-b)*sign,c=(s[key]-b)*sign;
    if((a<0)!==(c<0)){
      const t=a/(a-c),point={x:q.x+(s.x-q.x)*t,y:q.y+(s.y-q.y)*t,z:q.z+(s.z-q.z)*t};
      point[key]=b;r.push(point);
    }
    if(c>=0)r.push(s);
  }
  return r;
}
export function clipStockShadowBox(p:readonly Point[],b:Box){
  return halfPlane(halfPlane(halfPlane(halfPlane(p,'x',b.x0,1),'x',b.x1,-1),'z',b.z0,1),'z',b.z1,-1);
}
const area2=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.z-p.z)-(r.x-p.x)*(q.z-p.z);
function reachesOriginalShade(p:readonly Point[],b:Box){
  if(p.length<3)return false;
  const wx=b.x1-b.x0,wz=b.z1-b.z0;
  const q=p.map(a=>[2*(a.x-b.x0)/wx-1,2*(a.z-b.z0)/wz-1]);
  // The legacy alpha test drops at r < .94 (outer .98 smoothstep;
  // ramp at .94 is already < .009). An extra .001 conservatively covers
  // f32/interpolation; an AABB corner can therefore overlap harmlessly.
  let pos=false,neg=false,minimum=Infinity;
  for(let i=0,j=q.length-1;i<q.length;j=i++){
    const [x,z]=q[j],[u,v]=q[i],dx=u-x,dz=v-z,d=dx*dx+dz*dz;
    const cross=x*v-u*z;pos=pos||cross>1e-12;neg=neg||cross< -1e-12;
    const t=d>1e-18?Math.max(0,Math.min(1,-(x*dx+z*dz)/d)):0;
    minimum=Math.min(minimum,(x+t*dx)**2+(z+t*dz)**2);
  }
  return !(pos&&neg)||minimum<.941**2;
}
function valid(s:Stem){
  return [s.x,s.y,s.z,s.h,s.w,s.variant,s.param].every(Number.isFinite)&&
    s.h>1&&s.h<40&&s.w>1&&s.w<55&&Number.isInteger(s.variant)&&s.variant>=0&&s.variant<=3;
}
const receiverVertex=`
  varying vec2 vUV;
  varying vec3 param;
  attribute float stMarysShadowVariant;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    vUV=uv;param=vec3(stMarysShadowVariant,0.,1.);
   #include <logdepthbuf_vertex>
  }
`;
function patchShaders(m:THREE.ShaderMaterial){
  const v=m.vertexShader,f=m.fragmentShader;
  if(!v.includes('vec2 off=vec2(.43,.21)*shape.x;')||
     !v.includes('position.x*shape.y*1.42,.46,off.y+position.y*shape.y*1.19')||
     !v.includes('void main(){')||!f.includes('void main(){')||
     !f.includes('ramp*(.10+.18*mask)')||!f.includes('smoothstep(.21,.98,r);if(ramp<.009)discard;')||
     !f.includes('#include <logdepthbuf_fragment>')||
     !m.uniforms.canopy?.value||v.includes(KEY)||f.includes(VARY))return;
  return {
    vertexShader:v.replace('void main(){','attribute float '+KEY+';varying float '+VARY+';void main(){'+VARY+'='+KEY+';'),
    fragmentShader:f.replace('void main(){','varying float '+VARY+';void main(){')
      .replace('#include <logdepthbuf_fragment>','#include <logdepthbuf_fragment>\n if('+VARY+'>.5)discard;'),
  };
}
export type ReceiverDraft=Readonly<{geometry:THREE.BufferGeometry; slots:number[]; triangleCount:number}>;
/** Use the live canopy flight height/shape, not detached fallback heights. */
export function buildStMarysReceivers(source:StMarysShadowGround,gradeId:string,stems:Float32Array,shapes:Float32Array,count:number,total=count):ReceiverDraft|undefined{
  const {mesh}=source,g=mesh.geometry;
  if(source.gradeId!==gradeId||mesh.userData.localGrade!==gradeId||mesh.userData.subdiv!==112||
    !g.index||!g.getAttribute('position')||!Number.isInteger(count)||count<4||count>45000||
    !Number.isInteger(total)||total<count||total>45000||
    stems.length<total*3||shapes.length<total*4||mesh.rotation.x!==0||mesh.rotation.y!==0||mesh.rotation.z!==0||
    mesh.scale.x!==1||mesh.scale.y!==1||mesh.scale.z!==1)return;
  const canonical=new Map<number,Stem>(),nearby:Stem[]=[];
  const b=source.bounds;
  if(b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3]||b[2]-b[0]>180||b[3]-b[1]>180||
    typeof source.inChangedSupport!=='function')return;
  // Maximum admitted live footprint reach is 57m. The crop also includes
  // one full tessellated guard cell beyond the actual fine grade rectangle.
  const operating={x0:b[0]-4,z0:b[1]-4,x1:b[2]+4,z1:b[3]+4};
  const siteBox={x0:b[0]-64,x1:b[2]+64,z0:b[1]-64,z1:b[3]+64};
  const vessel:Point={x:mesh.position.x,y:mesh.position.y,z:mesh.position.z};
  for(let i=0;i<total;i++){
    const x=stems[3*i],z=stems[3*i+2];
    if(x<siteBox.x0||x>siteBox.x1||z<siteBox.z0||z>siteBox.z1)continue;
    const s={i,x,y:stems[3*i+1],z,h:shapes[4*i],w:shapes[4*i+1],variant:shapes[4*i+2],param:shapes[4*i+3]};
    if(!valid(s))return;
    const owner=STEMS.get(xzKey(x,z));
    if(owner!==undefined&&i<count){
      if(canonical.has(owner))return;
      canonical.set(owner,s);
    }else nearby.push(s);
  }
  if(canonical.size!==4)return;
  const active=ST_MARYS_STEM_XZ.map((_,i)=>canonical.get(i)!);
  const domains=active.map(stockShadowFootprint);
  const limits={x0:Math.min(...domains.map(d=>d.x0)),x1:Math.max(...domains.map(d=>d.x1)),
    z0:Math.min(...domains.map(d=>d.z0)),z1:Math.max(...domains.map(d=>d.z1))};
  const nearbyBoxes=nearby.map(caster=>({box:stockShadowFootprint(caster),oldY:Math.fround(caster.y+Math.fround(.46))}));
  const P:number[]=[],UV:number[]=[],V:number[]=[],area=[0,0,0,0],num=[0,0,0,0];
  const a=g.getAttribute('position'),index=g.getIndex()!;
  for(let i=0;i<index.count;i+=3){
    const i0=index.getX(i),i1=index.getX(i+1),i2=index.getX(i+2);
    const x0=a.getX(i0)+vessel.x,x1=a.getX(i1)+vessel.x,x2=a.getX(i2)+vessel.x;
    const z0=a.getZ(i0)+vessel.z,z1=a.getZ(i1)+vessel.z,z2=a.getZ(i2)+vessel.z;
    const range={x0:Math.min(x0,x1,x2),x1:Math.max(x0,x1,x2),z0:Math.min(z0,z1,z2),z1:Math.max(z0,z1,z2)};
    const seats=intersects(limits,range),guard=nearbyBoxes.length>0&&intersects(range,operating);
    if(!seats&&!guard)continue;
    const p=[
      {x:x0,y:a.getY(i0)+vessel.y,z:z0},
      {x:x1,y:a.getY(i1)+vessel.y,z:z1},
      {x:x2,y:a.getY(i2)+vessel.y,z:z2},
    ];
    // Keep all unrelated legacy shade unless its opaque depth would
    // actually be threatened. A covered floor which stays strictly beneath
    // the original flat receiver does not require seating a fifth caster.
    if(guard&&p.some(q=>source.inChangedSupport(q.x,q.z))){
      for(const {box:b,oldY} of nearbyBoxes){
        if(!intersects(range,b)||Math.max(...p.map(q=>q.y))<oldY-.008)continue;
        const part=halfPlane(clipStockShadowBox(p,b),'y',oldY-.008,1);
        if(reachesOriginalShade(part,b))return;
      }
    }
    if(!seats)continue;
    for(let n=0;n<4;n++){
      const d=domains[n];if(!intersects(range,d))continue;
      const r=clipStockShadowBox(p,d);
      for(let k=1;k+1<r.length;k++){
        const w=area2(r[0],r[k],r[k+1]);
        if(!Number.isFinite(w)||Math.abs(w)<1e-8)continue;
        area[n]+=Math.abs(w)*.5;num[n]++;
        if(num[n]>4096)return;
        const seq=w<0?[r[0],r[k],r[k+1]]:[r[0],r[k+1],r[k]];
        for(const q of seq){
          P.push(q.x-vessel.x,q.y-vessel.y+LIFT,q.z-vessel.z);
          UV.push((q.x-d.x0)/(d.x1-d.x0),(q.z-d.z0)/(d.z1-d.z0));
          V.push(active[n].variant);
        }
      }
    }
  }
  if(num.some((a,i)=>!a||Math.abs(area[i]-(domains[i].x1-domains[i].x0)*(domains[i].z1-domains[i].z0))>3e-4))return;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));
  geometry.setAttribute('stMarysShadowVariant',new THREE.Float32BufferAttribute(V,1));
  geometry.computeBoundingSphere();
  return {geometry,slots:active.map(a=>a.i),triangleCount:P.length/9};
}
export class StMarysShadows{
  readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
  private readonly slotsAttribute:THREE.InstancedBufferAttribute;
  private readonly oldMaterial:THREE.ShaderMaterial;
  private readonly patched:THREE.ShaderMaterial;
  private committed:number[]=[];
  private previous?:THREE.BufferGeometry;
  private revision=-1;
  private ready=false;
  private dead=false;
  private constructor(private scene:THREE.Scene,private stock:LegacyShade,private gradeId:string,capacity:number,patch:NonNullable<ReturnType<typeof patchShaders>>){
    this.oldMaterial=stock.material;
    this.patched=stock.material.clone();
    this.patched.vertexShader=patch.vertexShader;
    this.patched.fragmentShader=patch.fragmentShader;
    this.patched.uniforms=stock.material.uniforms;
    this.slotsAttribute=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);
    stock.geometry.setAttribute(KEY,this.slotsAttribute);
    stock.material=this.patched;
    const material=this.oldMaterial.clone();
    material.vertexShader=receiverVertex;material.uniforms=this.oldMaterial.uniforms;
    this.mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);
    this.mesh.name='St Mary’s four re-seated canonical woodland receivers';
    this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=stock.renderOrder;
    scene.add(this.mesh);
  }
  static mount(scene:THREE.Scene,stock:THREE.Mesh,gradeId:string,capacity:number){
    if(!(stock.geometry instanceof THREE.InstancedBufferGeometry)||!(stock.material instanceof THREE.ShaderMaterial))return;
    if(stock.geometry.getAttribute(KEY)||!gradeId||!Number.isInteger(capacity)||capacity<4||capacity>45000)return;
    const p=patchShaders(stock.material);if(!p)return;
    return new StMarysShadows(scene,stock as LegacyShade,gradeId,capacity,p);
  }
  private replaceSlots(next:number[]){
    const set=new Set(next);
    for(const i of this.committed)if(!set.has(i)){
      this.slotsAttribute.setX(i,0);this.slotsAttribute.addUpdateRange(i,1);
    }
    const old=new Set(this.committed);
    for(const i of next)if(!old.has(i)){
      this.slotsAttribute.setX(i,1);this.slotsAttribute.addUpdateRange(i,1);
    }
    this.committed=next;this.slotsAttribute.needsUpdate=true;
  }
  clear(){
    if(this.mesh.visible){
      const g=this.mesh.geometry;this.mesh.geometry=new THREE.BufferGeometry();g.dispose();
    }
    this.mesh.visible=false;
    if(this.committed.length)this.replaceSlots([]);
    this.previous=undefined;this.revision=-1;this.ready=false;
  }
  /** Call after World and the original instance roster have finalized the
   * same frame. Do not skip a clear on owner withdrawal or partial stream. */
  update(source:StMarysShadowGround|undefined,stems:Float32Array,shapes:Float32Array,originalCount:number,rosterRevision:number){
    if(this.dead)return false;
    if(this.stock.material!==this.patched||this.stock.geometry.getAttribute(KEY)!==this.slotsAttribute){this.clear();return false;}
    if(!source||!this.stock.visible||!Number.isSafeInteger(rosterRevision)||rosterRevision<0||
      originalCount>this.slotsAttribute.count||source.gradeId!==this.gradeId||
      source.mesh.userData.localGrade!==this.gradeId||source.mesh.userData.subdiv!==112){
      this.clear();return false;
    }
    if(this.previous===source.mesh.geometry&&this.revision===rosterRevision)return this.ready;
    let result:ReceiverDraft|undefined;
    try{result=buildStMarysReceivers(source,this.gradeId,stems,shapes,originalCount,this.stock.geometry.instanceCount);}catch{result=undefined;}
    if(!result){
      this.clear();this.previous=source.mesh.geometry;this.revision=rosterRevision;return false;
    }
    const old=this.mesh.geometry;
    this.mesh.geometry=result.geometry;this.mesh.position.copy(source.mesh.position);
    this.mesh.visible=true;
    this.replaceSlots(result.slots);
    this.previous=source.mesh.geometry;this.revision=rosterRevision;this.ready=true;old.dispose();
    return true;
  }
  dispose(){
    if(this.dead)return;
    this.clear();this.dead=true;
    this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();
    if(this.stock.material===this.patched)this.stock.material=this.oldMaterial;
    if(this.stock.geometry.getAttribute(KEY)===this.slotsAttribute)this.stock.geometry.deleteAttribute(KEY);
    this.patched.dispose();
  }
  get count(){return this.ready?4:0;}
}
