import * as T from 'three';
import {ResidentAttributeProbe} from './resident-attribute-probe.ts';
const roles=['position','stem','shape','hedgeGround'] as const;

/** Exact renderer-birth registered source. No scene-wide name lookup and no
 * permission for a similarly styled or later rebuilt transparent material. */
export class BordenCanopyResident{
 private readonly gl:WebGL2RenderingContext;
 private readonly renderer:T.WebGLRenderer;
 private readonly mesh:T.Mesh<T.InstancedBufferGeometry,T.ShaderMaterial>;
 private readonly geometry:T.InstancedBufferGeometry;
 private readonly material:T.ShaderMaterial;
 private readonly attrs:T.BufferAttribute[];
 private readonly coverage:ResidentAttributeProbe[];
 private dead=false;
 constructor(renderer:T.WebGLRenderer,mesh:T.Mesh<T.InstancedBufferGeometry,T.ShaderMaterial>,
  private readonly crown:T.Mesh<T.InstancedBufferGeometry,T.ShaderMaterial>,active:()=>boolean){
  const gl=renderer.getContext() as WebGL2RenderingContext,g=mesh.geometry;
  if(T.REVISION!=='187'||!('getBufferSubData' in gl)||renderer.capabilities.precision!=='highp'||
     !(g instanceof T.InstancedBufferGeometry)||!(mesh.material instanceof T.ShaderMaterial)||
     !g.index)throw new TypeError('unsupported resident canopy source');
  const attrs=[...roles.map(n=>g.getAttribute(n)),g.index];
  if(attrs.some(a=>!(a instanceof T.BufferAttribute)))throw new TypeError('invalid canopy buffer type');
  if(crown.geometry!==g)throw new TypeError('different canopy sources');
  this.gl=gl;this.renderer=renderer;this.mesh=mesh;this.geometry=g;this.material=mesh.material;
  this.attrs=attrs as T.BufferAttribute[];
  const items:ResidentAttributeProbe[]=[];
  try{
   for(let i=0;i<this.attrs.length;i++){
    items.push(new ResidentAttributeProbe(gl,this.attrs[i],i===4?gl.ELEMENT_ARRAY_BUFFER_BINDING:gl.ARRAY_BUFFER_BINDING,
     i===0||i===4?undefined:active));
   }
  }catch(e){
   for(const item of items)item.dispose();
   throw e;
  }
  this.coverage=items;
 }
 get sources(){return {mesh:this.mesh,geo:this.geometry,material:this.material};}
 matches(o:T.Object3D,g:T.BufferGeometry,m:T.Material,count:number){
  if(this.dead||o!==this.mesh||g!==this.geometry||m!==this.material||this.mesh.geometry!==g||
     this.mesh.material!==m||g.index!==this.attrs[4]||
     roles.some((k,i)=>g.getAttribute(k)!==this.attrs[i])||
     count!==this.geometry.instanceCount||!Number.isInteger(count)||count<0||count>512||
     this.renderer.getContext()!==this.gl||this.gl.isContextLost()||
     this.renderer.getRenderTarget()!==null)return false;
  const sizes=[12,count*3,count*4,count*4,6];
  let match=true;
  for(let i=0;i<this.coverage.length;i++)if(!this.coverage[i].matches(sizes[i]))match=false;
  return match;
 }
 opaqueCrownDepth(o:T.Object3D,g:T.BufferGeometry,m:T.Material,camera:T.PerspectiveCamera){
  if(o!==this.crown||g!==this.geometry||m!==this.crown.material||g!==this.crown.geometry||
     !this.matches(this.mesh,g,this.material,this.geometry.instanceCount))return false;
  const p=camera.matrixWorldInverse.elements,n=Math.hypot(p[2],p[6],p[10]);
  const [,stems,shape]=this.attrs;
  for(let i=0;i<this.geometry.instanceCount;i++){
   const x=stems.getX(i),y=stems.getY(i),z=stems.getZ(i),h=shape.getX(i),w=shape.getY(i);
   if(![x,y,z,h,w].every(v=>Number.isFinite(v)&&Math.abs(v)<=250000)||h<0||h>200||w<=0||w>200)return false;
   // Exact stock crown uses two unit-facing axes, a .5 × .5 card and a
   // stem lift at most .65h. The sum bounds all top/side billboard vertices.
   const reach=.65*h+.5*w+.5*Math.max(h*1.04,w)+.1;
   if(-(p[2]*x+p[6]*y+p[10]*z+p[14])+n*reach>=320000)return false;
  }
  return true;
 }
 get state(){return this.coverage.map(p=>p.diagnostics);}
 dispose(){if(this.dead)return;this.dead=true;for(const p of this.coverage)p.dispose();}
}

/** The actual built-in shutter sweep is the only other ordinary later
 * colour source in this production candidate. A foreign mesh stays stock. */
export class BordenPropResident{
 private readonly mesh:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>;
 private readonly r:T.WebGLRenderer;
 private readonly gl:WebGL2RenderingContext;
 private readonly g:T.BufferGeometry;
 private readonly m:T.MeshBasicMaterial;
 private readonly p:T.BufferAttribute;
 private readonly i:T.BufferAttribute;
 private readonly probeP:ResidentAttributeProbe;
 private readonly probeI:ResidentAttributeProbe;
 constructor(r:T.WebGLRenderer,mesh:T.Mesh<T.BufferGeometry,T.MeshBasicMaterial>){
  const gl=r.getContext() as WebGL2RenderingContext;
  const g=mesh.geometry,p=g.getAttribute('position'),i=g.index;
  if(!(mesh.material instanceof T.MeshBasicMaterial)||!(p instanceof T.BufferAttribute)||!i||
     p.itemSize!==3||!('getBufferSubData' in gl)||r.capabilities.precision!=='highp')
   throw new TypeError('unsupported shutter source');
  this.mesh=mesh;this.r=r;this.gl=gl;this.g=g;this.p=p;this.i=i;this.m=mesh.material;
  const pp=new ResidentAttributeProbe(gl,p,gl.ARRAY_BUFFER_BINDING);
  try{this.probeI=new ResidentAttributeProbe(gl,i,gl.ELEMENT_ARRAY_BUFFER_BINDING);}
  catch(e){pp.dispose();throw e;}
  this.probeP=pp;
 }
 matches(o:T.Object3D,g:T.BufferGeometry,m:T.Material){
  return o===this.mesh&&g===this.g&&m===this.m&&this.mesh.geometry===g&&this.mesh.material===m&&
   g.getAttribute('position')===this.p&&g.index===this.i&&g.drawRange.start===0&&g.drawRange.count===Infinity&&
   this.r.getContext()===this.gl&&!this.gl.isContextLost()&&this.r.getRenderTarget()===null&&
   this.matchesBuffers();
 }
 private matchesBuffers(){
  const position=this.probeP.matches(this.p.count*3),index=this.probeI.matches(this.i.count);
  return position&&index;
 }
 dispose(){this.probeP.dispose();this.probeI.dispose();}
}
