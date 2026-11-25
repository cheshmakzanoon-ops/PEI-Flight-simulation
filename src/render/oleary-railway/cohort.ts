import {BufferAttribute,type BufferGeometry,type Group,type Mesh,type Scene} from 'three';
import {authenticatedOwnerCohort} from '../authenticated-owner-cohort.ts';
import {OLEARY,OLEARY_INDUSTRIAL,olearyDrawCenter,olearyNativeGrade,olearySourceDraw,type OlearySeat} from './authority.ts';
import {olearyIndustrialSeat} from './industrial-seat.ts';
import type {OlearyLink,OlearyProgramProof} from './program-gate.ts';

type Model={group:Group;intact:()=>boolean;dispose:()=>void};
type Open=(signal:AbortSignal,ground:Mesh)=>Promise<Model|undefined>;
type Source=typeof OLEARY|typeof OLEARY_INDUSTRIAL;
type Cohort=NonNullable<ReturnType<typeof authenticatedOwnerCohort>>;
type Lane=NonNullable<ReturnType<Cohort['add']>>;
type Grade={mesh:Mesh;seams:string;geo:BufferGeometry;p:BufferAttribute;i:BufferAttribute;pv:number;iv:number;intact?:()=>boolean};
type Attempt={ctl:AbortController;grade:Grade};
type Actor={source:Source;row:unknown;span:()=>unknown;link:OlearyLink;open:Open;tried:boolean;pending?:Attempt;
 active?:{model:Model;proof:OlearyProgramProof;lane:Lane}};
type Alternate={index:BufferAttribute;storage:Uint16Array;version:number};
export type OlearyCohortStudy={station:boolean;industrialLink:OlearyLink};
type Override={station?:Open;industrial?:Open};
const drawCenter=olearyDrawCenter();
const loadStation:Open=async signal=>(await import('./packet.ts')).loadOleary((import.meta.env?.BASE_URL??'/')+'art/',signal);
const loadIndustrial:Open=async (signal,ground)=>{
 const mod=await import('./industrial-envelope.ts');
 const height=!signal.aborted&&olearyIndustrialSeat(ground);
 if(!height)return;
 return mod.buildDetachedIndustrial192(height);
};
const unsegmented=(g:BufferGeometry)=>
 !g.groups.length&&g.drawRange.start===0&&g.drawRange.count===Infinity&&Object.keys(g.attributes).length===6&&!Object.keys(g.morphAttributes).length;

/** Only the explicit q192 QA comparison uses the shared draw; the ordinary
 * q431 preview still runs #240's original independent, unchanged socket. */
export class OlearyCohortSocket{
 private readonly stock:BufferGeometry;
 private readonly material:Mesh['material'];
 private readonly attributes:{key:string;attribute:BufferAttribute;array:BufferAttribute['array'];version:number}[];
 private readonly mask: Cohort|undefined;
 private readonly actors:Actor[];
 private readonly owned=new WeakMap<BufferGeometry,Alternate>();
 private applied:BufferGeometry;
 private grade?:Grade;
 private dead=false;
 readonly owner:Mesh;
 private readonly scene:Scene;private readonly raw:ArrayBuffer;private readonly rows:number;private readonly seat:OlearySeat;
 private readonly currentOwner:()=>boolean;
 constructor(scene:Scene,owner:Mesh,raw:ArrayBuffer,rows:number,
   stationRow:unknown,industrialRow:unknown,seat:OlearySeat,study:OlearyCohortStudy,currentOwner:()=>boolean,open:Override={}){
  this.scene=scene;this.owner=owner;this.raw=raw;this.rows=rows;this.seat=seat;this.currentOwner=currentOwner;
  this.stock=this.applied=owner.geometry;
  this.material=owner.material;
  this.attributes=Object.entries(this.stock.attributes).map(([key,a])=>{
   const attribute=a as BufferAttribute;return {key,attribute,array:attribute.array,version:attribute.version};
  });
  this.mask=authenticatedOwnerCohort(owner,this.stock);
  this.actors=[
   {source:OLEARY_INDUSTRIAL,span:()=>owner.userData.olearyIndustrialTriangles,row:industrialRow,
    open:open.industrial??loadIndustrial,link:study.industrialLink,tried:false}
  ];
  if(study.station)this.actors.push({source:OLEARY,span:()=>owner.userData.beaconTriangles,row:stationRow,
   open:open.station??loadStation,link:seat.link,tried:false});
 }
 get active(){return this.actors.some(a=>a.source===OLEARY&&a.active?.lane.visible===true);}
 get industrialActive(){return this.actors.some(a=>a.source===OLEARY_INDUSTRIAL&&a.active?.lane.visible===true);}
 private exactBase(){
  const {owner:o,stock:g,mask}=this,q=o.quaternion,p=o.position,s=o.scale,m=this.material;
  return !this.dead&&!!mask&&this.currentOwner()&&mask.stockForProof()===g&&o.parent===this.scene&&o.visible&&o.matrixAutoUpdate&&o.layers.mask===1&&!this.scene.overrideMaterial&&
   o.material===m&&!Array.isArray(m)&&m.visible&&p.x===drawCenter.x&&p.y===0&&p.z===drawCenter.z&&
   q.x===0&&q.y===0&&q.z===0&&q.w===1&&s.x===1&&s.y===1&&s.z===1&&
   !g.index&&unsegmented(g)&&this.attributes.length===6&&this.attributes.every(({key,attribute,array,version})=>
    g.getAttribute(key)===attribute&&attribute.array===array&&attribute.version===version);
 }
 private exactSpan(a:Actor){
  const v=a.span(),p=a.source.proof;
  return Array.isArray(v)&&v.length===2&&v[0]===p.start&&v[1]===p.end;
 }
 private checkAlternate(establish=false){
  const g=this.owner.geometry;
  const a=this.actors[0].active?.lane.visible?this.actors[0].source.proof:undefined;
  const b=this.actors[1]?.active?.lane.visible?this.actors[1].source.proof:undefined;
  if(!a&&!b)return g===this.stock;
  if(g===this.stock||(!establish&&g!==this.applied)||!unsegmented(g)||
   g.boundingBox!==this.stock.boundingBox||g.boundingSphere!==this.stock.boundingSphere||
   !this.attributes.every(({key,attribute})=>g.getAttribute(key)===attribute))return false;
  const i=g.index,v=i?.array;
  if(!i||!(v instanceof Uint16Array)||i.itemSize!==1||i.normalized||i.version!==0||
   v.length!==32049-(a?a.end-a.start:0)-(b?b.end-b.start:0)||i.count!==v.length)return false;
  const old=this.owned.get(g);
  if(old&&(old.index!==i||old.storage!==v||old.version!==i.version))return false;
  if(!old&&!establish)return false;
  // QA-only: an approximately 64 KiB linear scan is deliberate. Even
  // unversioned index writes cannot permanently keep a sibling hidden.
  for(let j=0,k=0;j<32049;j++){
   if(a&&j===a.start)j=a.end;
   if(b&&j===b.start)j=b.end;
   if(v[k++]!==j)return false;
  }
  if(!old)this.owned.set(g,{index:i,storage:v,version:i.version});
  return true;
 }
 private ground(){try{return this.seat.ground();}catch{return undefined;}}
 private liveGrade(g:Grade|undefined){
  const live=g&&this.ground();
  return !!g&&!!live&&this.grade===g&&live.fine===g.mesh&&live.seams===g.seams&&
   g.mesh.parent===this.scene&&g.mesh.visible&&g.intact?.()===true;
 }
 private updateGrade(){
  const l=this.ground(),mesh=l?.fine,seams=l?.seams,geo=mesh?.geometry,p=geo?.getAttribute('position'),i=geo?.index;
  if(!mesh||mesh.parent!==this.scene||!mesh.visible||!seams||!geo||!(p instanceof BufferAttribute)||!i){this.grade=undefined;return;}
  const old=this.grade;
  if(old&&old.mesh===mesh&&old.seams===seams&&old.geo===geo&&old.p===p&&old.i===i&&old.pv===p.version&&old.iv===i.version)return;
  const g=this.grade={mesh,seams,geo,p,i,pv:p.version,iv:i.version} as Grade;
  void olearyNativeGrade(mesh,this.seat.center,seams).then(pinned=>{
   if(this.dead||this.grade!==g)return;
   g.intact=pinned;this.sync();
  });
 }
 private cancel(a:Actor){
  if(!a.pending)return;
  // A later residence may begin immediately. A late callback owns only
  // its own model/controller and may not clear or commit the new attempt.
  const pending=a.pending;a.pending=undefined;a.tried=false;pending.ctl.abort();
 }
 sync(){
  if(this.dead)return;
  try{this.syncDraw();}catch{this.dispose();}
 }
 private syncDraw(){
  if(!this.exactBase()||this.owner.geometry!==this.applied||!this.checkAlternate()){
   this.dispose();return;
  }
  this.updateGrade();
  const g=this.grade,approved=this.liveGrade(g);
  for(const a of this.actors){
   const valid=approved&&this.exactSpan(a);
   if(a.pending&&(!valid||a.pending.grade!==g))this.cancel(a);
   const q=a.active;
   if(q){
    try{q.lane.sync(valid&&q.model.group.parent===this.scene&&q.model.intact()&&q.proof());}
    catch{q.lane.sync(false);}
   }
  }
  if(this.owner.geometry!==this.applied){
   if(!this.checkAlternate(true)){this.dispose();return;}
   this.applied=this.owner.geometry;
  }
  if(g&&approved)for(const a of this.actors)if(!a.active&&!a.pending&&!a.tried&&this.exactSpan(a)){
   a.tried=true;
   const attempt=a.pending={ctl:new AbortController(),grade:g};void this.prepare(a,attempt);
  }
 }
 private async prepare(a:Actor,attempt:Attempt){
  const {ctl,grade}=attempt,signal=ctl.signal,timeout=setTimeout(()=>ctl.abort(),5200);
  let model:Model|undefined;
  const isCurrent=()=>!signal.aborted&&a.pending===attempt&&this.exactBase()&&this.owner.geometry===this.applied&&
   this.checkAlternate()&&this.liveGrade(grade)&&this.exactSpan(a);
  const source=()=>olearySourceDraw(this.raw,this.rows,a.row,this.mask!.stockForProof()!,a.span(),a.source);
  try{
   if(!isCurrent()||!await source()||!isCurrent()||!await this.seat.verifiedCover()||!isCurrent())return;
   model=await a.open(signal,grade.mesh);
   if(!isCurrent()||!model?.intact()||model.group.parent)return;
   const proof=await a.link(model.group,signal);
   if(!isCurrent()||!proof||!model.intact()||!await source()||!isCurrent()||!await this.seat.verifiedCover()||
    !isCurrent()||!model.intact()||!proof()||model.group.parent)return;
   const p=a.source.proof,lane=this.mask!.add(model.group,[p.start,p.end],p);
   if(!lane)return;
   try{this.scene.add(model.group);}catch{lane.dispose();return;}
   a.active={model,proof,lane};model=undefined;
   this.sync();
  }catch{/** Failure of this actor by itself never hides it or retires a valid sibling. */}
  finally{
   try{model?.dispose();}catch{model?.group.removeFromParent();}
   clearTimeout(timeout);if(a.pending===attempt)a.pending=undefined;
  }
 }
 dispose(){
  if(this.dead)return;
  this.dead=true;
  // Restore a known owned alternate; preserve an unrelated external draw
  // identity (including all its attributes and index) untouched.
  if(this.owned.has(this.owner.geometry))this.owner.geometry=this.stock;
  this.mask?.dispose();
  for(const a of this.actors){
   this.cancel(a);
   try{a.active?.model.dispose();}catch{a.active?.model.group.removeFromParent();}
   a.active=undefined;
  }
 }
}
