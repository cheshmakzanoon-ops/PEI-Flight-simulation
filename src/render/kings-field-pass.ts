import {Group,ShaderMaterial,type BufferGeometry,type Camera,type Mesh,type Scene,type WebGLRenderer} from 'three';
import {FieldShardSource} from '../sim/field-shards.ts';
import {FIELD_DIRECTORY_PIN,FIELD_SITE_PINS} from './province-fields.generated.ts';
import {provinceFieldOpticsGLSL,provinceFields,type ProvinceFieldStudy} from './province-fields.ts';
import {loadFieldRelief} from './fields-pilot.ts';
import {olearyLinkPrograms,type OlearyProgramProof} from './oleary-railway/program-gate.ts';

export const KINGS_FIELD_TILE='23-13';
export const KINGS_FIELD_CELLS=['41:10','41:11','41:12','42:11'] as const;
export type MappedPass={id:string;tile:string;center:readonly [number,number];cells:readonly string[];scoped?:true};
export const KINGS_MAPPED_PASS:MappedPass={id:'kings-mapped-farmland-pass',tile:KINGS_FIELD_TILE,
 center:[43194.39622103769,11510.405016114737],cells:KINGS_FIELD_CELLS};
export const QUEENS_MAPPED_PASS:MappedPass={id:'queens-fields',tile:'12-13',
 center:[-23643.075210807714,15291.056341026648],cells:['-24:14','-23:14','-23:13']};
export const PRINCE_MAPPED_PASS:MappedPass={id:'prince-mapped-farmland-pass',tile:'9-13',
 center:[-37143.999999999716,13016.000000000342],cells:['-37:12','-36:12','-37:13','-36:13']};
/** Prospective ordinary terrain owner south of the independently dated dune.
 * Warm only on the actual route, before the genuine t68–72 camera aperture. */
export const KINGS_DUNES_MAPPED_PASS:MappedPass={id:'kings-sand-dunes',tile:'30-12',
 center:[87995.72779680874,6745.449283850126],cells:['85:6','86:6'],scoped:true};
type SortRow={groupOrder:number;renderOrder:number;material:{id:number};materialVariant:number;z:number;id:number};
function fieldOpaqueOrder(stock:number,authored:number){
 return (a:SortRow,b:SortRow)=>{
  if(a.groupOrder!==b.groupOrder)return a.groupOrder-b.groupOrder;
  if(a.renderOrder!==b.renderOrder)return a.renderOrder-b.renderOrder;
  const m=a.material.id===authored?stock:a.material.id,n=b.material.id===authored?stock:b.material.id;
  if(m!==n)return m-n;
  if(a.materialVariant!==b.materialVariant)return a.materialVariant-b.materialVariant;
  if(a.z!==b.z)return a.z-b.z;
  return a.id-b.id;
 };
}
export type FieldOwner={id:string;mesh:Mesh;stock:ShaderMaterial};
type Position={x:number;y:number;z:number};
export function withinMappedPass(p:Position,agl:number,route:MappedPass){
 return Number.isFinite(p.y)&&Number.isFinite(agl)&&agl>=0&&agl<415&&
   Math.hypot(p.x-route.center[0],p.z-route.center[1])<1120;
}
export function withinKingsFieldPass(p:Position,agl:number){return withinMappedPass(p,agl,KINGS_MAPPED_PASS);}
/** Preserve the complete Standard surface; introduce relief immediately before its original lighting. */
export function kingsFieldShader(stock:string,scopedWind=false){
 const usual=' void main(){',light=' float light=clamp(dot(n,sun),0.,1.);';
 if(stock.includes('paintProvinceFields')||stock.includes('shadeSourceGrass')||stock.includes('paintDatedFields')||
    stock.split(light).length!==2)return;
 // The actual regional static-light owner inserts globals before the
 // original bare 'void main', legitimately removing its indentation.
 // Only the scoped role accepts that second exact compatible shape.
 const wind=stock.includes('uniform sampler2D regionalStaticDepth;')&&
  stock.includes('float regionalCut=windStaticDirect(p,d,max(length(terrainDx.xz),length(terrainDy.xz)));');
 const declaration=stock.split(usual).length===2?usual:
  scopedWind&&wind&&stock.split('\nvoid main(){').length===2?'\nvoid main(){':undefined;
 if(!declaration||stock.split('void main(){').length!==2)return;
 return stock.replace(declaration,provinceFieldOpticsGLSL+declaration)
  .replace(light,' paintProvinceFields(col,n,p,d,coast);\n'+light);
}
/** Borrow the existing physical scene inputs; never clone their Texture Source.
 * Three r187's uniform cloning increments shared texture Source revisions,
 * even if the throwaway uniform set is immediately replaced. */
export function mappedFieldMaterial(stock:ShaderMaterial,fragment:string,extra:ShaderMaterial['uniforms']){
 const authored=new ShaderMaterial().copy(Object.create(stock,{uniforms:{value:{}}}) as ShaderMaterial);
 authored.fragmentShader=fragment;
 authored.onBeforeCompile=stock.onBeforeCompile;
 authored.customProgramCacheKey=stock.customProgramCacheKey;
 authored.uniforms={...stock.uniforms,...extra};
 return authored;
}
type Loaded={study:ProvinceFieldStudy;dispose():void};
type Lease={owner:FieldOwner;authored:ShaderMaterial;source:string;geometry:BufferGeometry;stockId?:number;authoredId?:number;sorter?:ReturnType<typeof fieldOpaqueOrder>;
 version:number;vertex:string;uniforms:ShaderMaterial['uniforms'];keys:[string,ShaderMaterial['uniforms'][string]][]};
const stockMaterialStill=(q:Lease)=>{
 const m=q.owner.stock;
 return m.version===q.version&&m.vertexShader===q.vertex&&m.fragmentShader===q.source&&m.uniforms===q.uniforms&&
  Object.keys(m.uniforms).length===q.keys.length&&q.keys.every(([k,v])=>m.uniforms[k]===v&&q.authored.uniforms[k]===v);
};
async function load(base:string,signal:AbortSignal,route:MappedPass):Promise<Loaded|undefined>{
 const [source,asset,owners]=await Promise.all([
  FieldShardSource.open(base+'fields-province/v2/',FIELD_DIRECTORY_PIN,fetch,signal),
  loadFieldRelief(base,signal),import('./province-field-owners.ts').then(m=>m.checkedFieldOwners(FIELD_SITE_PINS.owners)).catch(()=>false),
 ]);
 if(!source||!asset||!owners||signal.aborted){asset?.discard();return;}
 const study=provinceFields(source,asset,new Set(route.cells));
 return {study,dispose(){study.stream.dispose();asset.discard();}};
}
export class MappedFieldPass {
 private controller?:AbortController;
 private art?:Loaded;
 private leases:Lease[]=[];
 readonly materials=new Map<string,ShaderMaterial>();
 private program?:AbortController;
 private proof?:OlearyProgramProof;
 private serial=0;
 private phase='stock';
 private blocked=false;
 private linkAttempts=0;
 private retryAt=0;
 private scopedPaint=false;
 private scopedSource?:string;
 private scopedVariants=new Map<string,number>();
 private readonly base:string;private readonly renderer:WebGLRenderer;
 private readonly scene:Scene;private readonly camera:Camera;
  readonly route:MappedPass;
 constructor(base:string,renderer:WebGLRenderer,scene:Scene,camera:Camera,route:MappedPass=KINGS_MAPPED_PASS){
  this.base=base;this.renderer=renderer;this.scene=scene;this.camera=camera;this.route=route;
 }
 get state(){return {phase:this.phase,receivers:this.leases.filter(q=>q.owner.mesh.material===q.authored||this.scopedPaint).map(q=>q.owner.id),
  stream:this.art?.study.stream.state};}
 get gain(){return this.art?.study.toggle;}
 leave(){
  if(!this.controller&&!this.art&&!this.leases.length&&!this.blocked)return;
  ++this.serial;this.controller?.abort();this.controller=undefined;this.retire();
  this.art?.dispose();this.art=undefined;this.scopedSource=undefined;this.scopedVariants.clear();this.blocked=false;this.linkAttempts=0;this.retryAt=0;this.phase='stock';
 }
 private retire(){
  this.scopedPaint=false;
  this.program?.abort();this.program=undefined;this.proof=undefined;
  for(const q of this.leases){
   if(q.owner.mesh.material===q.authored)q.owner.mesh.material=q.owner.stock;
   q.authored.dispose();
  }
  this.leases=[];this.materials.clear();
 }
 update(flightContext:boolean,airborne:boolean,allowed:()=>Promise<boolean>,eye:Position,agl:number,owners:()=>FieldOwner[]|undefined){
  if(!withinMappedPass(eye,agl,this.route)){this.leave();return;}
  if(!this.controller&&!this.art&&!this.blocked){
   const generation=++this.serial,control=new AbortController();this.controller=control;this.phase='loading';
   let timer:ReturnType<typeof setTimeout>|undefined;
   void allowed().then(ok=>{
    if(!ok||control.signal.aborted)return;
    timer=setTimeout(()=>control.abort(),3300);
    return load(this.base,control.signal,this.route);
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
  if(!flightContext)this.scopedPaint=false;
  this.art.study.stream.update(eye.x,eye.z,agl);
  // A detached shader can link while a valid, selected Dispatch terrain
  // owner is visible. Putting it on the actor still requires actual flight.
  if(!flightContext&&this.leases.some(q=>q.owner.mesh.material===q.authored)){
   this.retire();this.phase='ready';this.linkAttempts=0;this.retryAt=0;
  }
  if(flightContext&&!airborne&&!this.leases.length)return;
  const matching=owners();
  if(this.route.scoped&&matching?.length===1){
   const fragment=matching[0].stock.fragmentShader;
   if(this.scopedSource!==fragment){
    if(this.scopedSource!==undefined)this.scopedVariants.set(this.scopedSource,this.linkAttempts);
    if(!this.scopedVariants.has(fragment)&&this.scopedVariants.size>=3){this.retire();this.blocked=true;this.phase='unavailable';return;}
    this.linkAttempts=this.scopedVariants.get(fragment)??0;this.scopedVariants.set(fragment,this.linkAttempts);
    this.scopedSource=fragment;this.blocked=false;this.retryAt=0;
   }
  }
  if(this.leases.length&&(!matching||matching.length!==this.leases.length||matching.some((q,i)=>
      q.mesh!==this.leases[i].owner.mesh||q.mesh.geometry!==this.leases[i].geometry||
      q.stock!==this.leases[i].owner.stock||q.stock.fragmentShader!==this.leases[i].source||
      this.route.scoped&&!stockMaterialStill(this.leases[i])))){
   this.retire();this.phase='ready';
  }
  if(this.proof&&!this.proof()){this.unlink();return;}
  if(!matching||!this.art.study.stream.state.ready||this.blocked){
   if(this.route.scoped){this.scopedPaint=false;if(this.phase==='live')this.phase='linked';}
   return;
  }
  if(!this.leases.length){
   if(this.linkAttempts>=2){this.blocked=true;this.phase='unavailable';return;}
   if(performance.now()>=this.retryAt)this.prepare(matching);
  }
  if(flightContext&&airborne&&this.proof){
   if(this.route.scoped)this.scopedPaint=this.leases.length===1;
   else for(const q of this.leases)q.owner.mesh.material=q.authored;
   this.phase='live';
  }
 }
 /** Bracket only the new role, after any other terrain leases are in place.
  * Its material clone sorts at the original owner's immutable r187 ID. */
 beginScopedDraw(owner:()=>FieldOwner[]|undefined){
  if(!this.route.scoped||!this.scopedPaint||!this.art?.study.stream.state.ready||this.leases.length!==1||!this.proof?.())return;
  const q=this.leases[0],{stock,mesh}=q.owner,now=owner()?.[0];
  if(!now||now.mesh!==mesh||now.stock!==stock||mesh.material!==stock||q.geometry!==mesh.geometry||
     !q.sorter||!stockMaterialStill(q))return;
  const restore=()=>{
   try{if(mesh.material===q.authored)mesh.material=stock;}
   finally{this.renderer.setOpaqueSort(null);}
  };
  try{mesh.material=q.authored;this.renderer.setOpaqueSort(q.sorter);return restore;}
  catch{restore();return;}
 }
 private unlink(){
  this.retire();
  // A cold software GL pipeline is allowed one later detached attempt.
  // Stock remains submitted between attempts; no link proof is bypassed.
  this.blocked=this.linkAttempts>=2;
  this.retryAt=performance.now()+360;
  this.phase=this.blocked?'unavailable':'retrying';
 }
 private prepare(owners:FieldOwner[]){
  const art=this.art;if(!art)return;
  const group=new Group(),leases:Lease[]=[];
  for(const owner of owners){
   const source=owner.stock.fragmentShader,fragment=kingsFieldShader(source,this.route.scoped);
   if(!fragment){for(const q of leases)q.authored.dispose();this.blocked=true;this.phase='unavailable';return;}
   const authored=mappedFieldMaterial(owner.stock,fragment,{...art.study.stream.uniforms,
    provinceFurrowScan:art.study.scan,provinceFieldStrength:art.study.toggle});
   const stockId=Object.getOwnPropertyDescriptor(owner.stock,'id')?.value as unknown;
   const authoredId=Object.getOwnPropertyDescriptor(authored,'id')?.value as unknown;
   const validIDs=typeof stockId==='number'&&typeof authoredId==='number'&&
    Number.isSafeInteger(stockId)&&Number.isSafeInteger(authoredId)&&stockId!==authoredId;
   if(this.route.scoped&&!validIDs){authored.dispose();for(const q of leases)q.authored.dispose();this.blocked=true;return;}
   const trial=owner.mesh.clone(false);trial.material=authored;group.add(trial);
   leases.push({owner,authored,source,geometry:owner.mesh.geometry,version:owner.stock.version,
    vertex:owner.stock.vertexShader,uniforms:owner.stock.uniforms,keys:Object.entries(owner.stock.uniforms),
    ...(validIDs?{stockId,authoredId,sorter:this.route.scoped?fieldOpaqueOrder(stockId,authoredId):undefined}:{})});
  }
  this.leases=leases;for(const q of leases)this.materials.set(q.owner.id,q.authored);
  const program=new AbortController();this.program=program;this.phase='linking';this.linkAttempts++;
  void olearyLinkPrograms(this.renderer,this.camera,this.scene,1,false,7400)(group,program.signal).then(proof=>{
   if(this.program!==program||program.signal.aborted)return;
   if(proof){this.proof=proof;this.phase='linked';return;}
   this.unlink();
  });
 }
}
