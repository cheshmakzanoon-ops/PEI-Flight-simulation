import { Group, Mesh, ShaderMaterial, type Camera, type Scene, type WebGLRenderer } from 'three';
import { foundersOwnerCustody, foundersWestWire } from './authority.ts';
import type { OlearyLink, OlearyProgramProof } from '../oleary-railway/program-gate.ts';

type ShaderPatch={vertexShader:string;fragmentShader:string};
export type FoundersPainter=(v:string,f:string)=>Promise<ShaderPatch|undefined>;
type Seed={
 owner:Mesh;scene:Scene;stock:ShaderMaterial;wire:ArrayBuffer;rows:readonly unknown[];
 render:WebGLRenderer;camera:Camera;eligible:()=>boolean;local:()=>boolean;owned:()=>boolean;
 preflight:OlearyLink;paint:FoundersPainter;
};
/** Authenticate once; while ineligible keep the original draw/material attached.
 * A cold result, a dead renderer, or unrelated owner must never hide that draw. */
export class FoundersWestLease {
 private phase:'untried'|'waiting'|'ready'|'failed'='untried';
 private proof?:OlearyProgramProof;
 private material?:ShaderMaterial;
 private activeView=false;
 private controller?:AbortController;
 private gone=false;
 private readonly seal;
 private readonly stockBefore;
 private readonly before;
 private readonly s:Seed;
 constructor(s:Seed){
  this.s=s;
  this.seal=foundersOwnerCustody({owner:s.owner,scene:s.scene,geometry:s.owner.geometry,stock:s.stock});
  this.stockBefore=s.owner.onBeforeRender;
  this.before=(...args:Parameters<Mesh['onBeforeRender']>)=>{
   this.stockBefore.apply(s.owner,args);
   const [render,scene,camera,geometry,material]=args,p=this.material;
   if(!p||material!==p)return;
   p.uniforms.foundersWestGain.value=Number(render===s.render&&scene===s.scene&&camera===s.camera&&
    geometry===s.owner.geometry&&s.eligible()&&s.local()&&s.owned()&&render.getRenderTarget()===null&&
    !render.xr.isPresenting&&this.seal?.live(p)===true&&this.proof?.()===true);
   p.uniformsNeedUpdate=true;
  };
 }
 get active(){return this.activeView;}
 private get mayAttach(){
  const {s}=this;
  return !this.gone&&s.eligible()&&s.owned()&&this.seal?.live(s.stock)===true&&
   s.owner.onBeforeRender===this.stockBefore;
 }
 private async prepare(ac:AbortController){
  const {s,seal}=this;
  let m:ShaderMaterial|undefined;
  let retained=false,denied=false;
  const enter=()=>this.controller===ac&&!ac.signal.aborted&&this.mayAttach;
  try{
   if(!await foundersWestWire(s.wire,s.rows)||!enter()||!await seal?.authenticate()){denied=enter();return;}
   if(!enter())return;
   const p=await s.paint(seal!.vertex,seal!.fragment);
   if(!p){denied=true;return;}
   if(!enter())return;
   // The stock sampler is borrowed below. A regular ShaderMaterial clone
   // first clones its texture and invalidates the shared Texture.Source,
   // even though that temporary sampler is never used by this material.
   m=new ShaderMaterial().copy(Object.create(s.stock,{uniforms:{value:{}}}));
   m.vertexShader=p.vertexShader;m.fragmentShader=p.fragmentShader;
   m.uniforms={...seal!.content,foundersWestGain:{value:0}};
   const g=new Group();
   g.add(new Mesh(s.owner.geometry,m));
   const link=await s.preflight(g,ac.signal);
   if(!enter())return;
   if(!link||!link()){denied=true;return;}
   this.material=m;this.proof=link;this.phase='ready';retained=true;
  }catch{denied=true;}
  finally{
   if(!retained)m?.dispose();
   if(this.controller===ac&&this.phase==='waiting'){
    this.controller=undefined;
    this.phase=denied?'failed':'untried';
   }
  }
 }
 sync(){
  const {s}=this;
  if(this.phase==='untried'&&this.mayAttach){
   this.phase='waiting';const ac=this.controller=new AbortController();void this.prepare(ac);
   return;
  }
  if(this.phase==='waiting'&&(!s.eligible()||!s.owned())){
   this.controller?.abort();
   // Let the old await drain before a new request or program uses this owner.
   return;
  }
  const p=this.material;
  if(this.phase!=='ready'||!p)return;
  if(this.activeView){
   if(!this.gone&&s.eligible()&&s.owned()&&this.seal?.live(p)===true&&
      s.owner.onBeforeRender===this.before&&this.proof?.()===true)return;
   this.restore();
  }else if(this.mayAttach&&this.proof?.()===true){
   s.owner.material=p;
   s.owner.onBeforeRender=this.before;
   this.activeView=true;
  }
 }
 private restore(){
  const {s}=this,p=this.material;
  if(p&&s.owner.material===p)s.owner.material=s.stock;
  if(s.owner.onBeforeRender===this.before)s.owner.onBeforeRender=this.stockBefore;
  this.activeView=false;
 }
 dispose(){
  if(this.gone)return;
  this.gone=true;this.controller?.abort();this.restore();this.material?.dispose();
 }
}
