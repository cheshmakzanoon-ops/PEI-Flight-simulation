import {Group,type BufferGeometry,type Camera,type Mesh,type ShaderMaterial,type Scene,type WebGLRenderer} from 'three';
import {FieldShardSource} from '../sim/field-shards.ts';
import {FIELD_DIRECTORY_PIN,FIELD_SITE_PINS} from './province-fields.generated.ts';
import {provinceFieldOpticsGLSL,provinceFields,type ProvinceFieldStudy} from './province-fields.ts';
import {loadFieldRelief} from './fields-pilot.ts';
import {olearyLinkPrograms,type OlearyProgramProof} from './oleary-railway/program-gate.ts';

export const KINGS_FIELD_TILE='23-13';
export const KINGS_FIELD_CELLS=['41:10','41:11','41:12','42:11'] as const;
export type FieldOwner={id:string;mesh:Mesh;stock:ShaderMaterial};
type Position={x:number;y:number;z:number};
export function withinKingsFieldPass(p:Position,agl:number){
 return Number.isFinite(p.y)&&Number.isFinite(agl)&&agl>=0&&agl<415&&
   Math.hypot(p.x-43194.39622103769,p.z-11510.405016114737)<1120;
}
/** Preserve the complete Standard surface; introduce relief immediately before its original lighting. */
export function kingsFieldShader(stock:string){
 const declaration=' void main(){',light=' float light=clamp(dot(n,sun),0.,1.);';
 if(stock.includes('paintProvinceFields')||stock.includes('shadeSourceGrass')||stock.includes('paintDatedFields')||
    stock.split(declaration).length!==2||stock.split(light).length!==2)return;
 return stock.replace(declaration,provinceFieldOpticsGLSL+declaration)
  .replace(light,' paintProvinceFields(col,n,p,d,coast);\n'+light);
}
type Loaded={study:ProvinceFieldStudy;dispose():void};
type Lease={owner:FieldOwner;authored:ShaderMaterial;source:string;geometry:BufferGeometry};
async function load(base:string,signal:AbortSignal):Promise<Loaded|undefined>{
 const [source,asset,owners]=await Promise.all([
  FieldShardSource.open(base+'fields-province/v2/',FIELD_DIRECTORY_PIN,fetch,signal),
  loadFieldRelief(base,signal),import('./province-field-owners.ts').then(m=>m.checkedFieldOwners(FIELD_SITE_PINS.owners)).catch(()=>false),
 ]);
 if(!source||!asset||!owners||signal.aborted){asset?.discard();return;}
 const study=provinceFields(source,asset,new Set(KINGS_FIELD_CELLS));
 return {study,dispose(){study.stream.dispose();asset.discard();}};
}
export class KingsFieldPass {
 private controller?:AbortController;
 private art?:Loaded;
 private leases:Lease[]=[];
 readonly materials=new Map<string,ShaderMaterial>();
 private program?:AbortController;
 private proof?:OlearyProgramProof;
 private serial=0;
 private phase='stock';
 private blocked=false;
 private readonly base:string;private readonly renderer:WebGLRenderer;
 private readonly scene:Scene;private readonly camera:Camera;
 constructor(base:string,renderer:WebGLRenderer,scene:Scene,camera:Camera){
  this.base=base;this.renderer=renderer;this.scene=scene;this.camera=camera;
 }
 get state(){return {phase:this.phase,receivers:this.leases.filter(q=>q.owner.mesh.material===q.authored).map(q=>q.owner.id),
  stream:this.art?.study.stream.state};}
 get gain(){return this.art?.study.toggle;}
 leave(){
  if(!this.controller&&!this.art&&!this.leases.length&&!this.blocked)return;
  ++this.serial;this.controller?.abort();this.controller=undefined;this.retire();
  this.art?.dispose();this.art=undefined;this.blocked=false;this.phase='stock';
 }
 private retire(){
  this.program?.abort();this.program=undefined;this.proof=undefined;
  for(const q of this.leases){
   if(q.owner.mesh.material===q.authored)q.owner.mesh.material=q.owner.stock;
   q.authored.dispose();
  }
  this.leases=[];this.materials.clear();
 }
 update(flightContext:boolean,airborne:boolean,allowed:()=>Promise<boolean>,eye:Position,agl:number,owners:()=>FieldOwner[]|undefined){
  if(!withinKingsFieldPass(eye,agl)){this.leave();return;}
  if(!this.controller&&!this.art&&!this.blocked){
   const generation=++this.serial,control=new AbortController();this.controller=control;this.phase='loading';
   let timer:ReturnType<typeof setTimeout>|undefined;
   void allowed().then(ok=>{
    if(!ok||control.signal.aborted)return;
    timer=setTimeout(()=>control.abort(),3300);
    return load(this.base,control.signal);
   })
    .then(result=>{
     if(this.serial!==generation||control.signal.aborted){result?.dispose();return;}
     this.art=result;
    }).catch(()=>{}).finally(()=>{
     if(timer!==undefined)clearTimeout(timer);
     if(this.serial!==generation)return;
     this.controller=undefined;this.blocked=!this.art;this.phase=this.art?'ready':'unavailable';
    });
  }
  if(!this.art)return;
  this.art.study.stream.update(eye.x,eye.z,agl);
  if(!flightContext&&this.leases.length){this.retire();this.phase='ready';}
  if(!airborne&&!this.leases.length)return;
  const matching=owners();
  if(this.leases.length&&(!matching||matching.length!==this.leases.length||matching.some((q,i)=>
      q.mesh!==this.leases[i].owner.mesh||q.mesh.geometry!==this.leases[i].geometry||
      q.stock!==this.leases[i].owner.stock||q.stock.fragmentShader!==this.leases[i].source)))this.retire();
  if(this.proof&&!this.proof()){this.retire();this.blocked=true;this.phase='unavailable';return;}
  if(!matching||!airborne||!this.art.study.stream.state.ready||this.blocked)return;
  if(!this.leases.length)this.prepare(matching);
  if(this.proof){
   for(const q of this.leases)q.owner.mesh.material=q.authored;
   this.phase='live';
  }
 }
 private prepare(owners:FieldOwner[]){
  const art=this.art;if(!art)return;
  const group=new Group(),leases:Lease[]=[];
  for(const owner of owners){
   const source=owner.stock.fragmentShader,fragment=kingsFieldShader(source);
   if(!fragment){for(const q of leases)q.authored.dispose();this.blocked=true;this.phase='unavailable';return;}
   const authored=owner.stock.clone();authored.fragmentShader=fragment;
   authored.onBeforeCompile=owner.stock.onBeforeCompile;
   authored.customProgramCacheKey=owner.stock.customProgramCacheKey;
   authored.uniforms={...owner.stock.uniforms,...art.study.stream.uniforms,
    provinceFurrowScan:art.study.scan,provinceFieldStrength:art.study.toggle};
   const trial=owner.mesh.clone(false);trial.material=authored;group.add(trial);
   leases.push({owner,authored,source,geometry:owner.mesh.geometry});
  }
  this.leases=leases;for(const q of leases)this.materials.set(q.owner.id,q.authored);
  const program=new AbortController();this.program=program;this.phase='linking';
  void olearyLinkPrograms(this.renderer,this.camera,this.scene,1,false,3800)(group,program.signal).then(proof=>{
   if(this.program!==program||program.signal.aborted)return;
   if(proof){this.proof=proof;return;}
   this.retire();this.blocked=true;this.phase='unavailable';
  });
 }
}
