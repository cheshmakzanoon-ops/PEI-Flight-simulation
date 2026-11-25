import {BufferAttribute,type Scene,type Mesh,type BufferGeometry}from'three';
import {authenticatedOwnerVariant} from '../indian-river/authored-owner-variant.ts';
import {OLEARY,olearyOriginalSource,olearyNativeGrade,olearyDrawCenter,type OlearySeat} from './authority.ts';
import type {OlearyProgramProof} from './program-gate.ts';
type Model=NonNullable<Awaited<ReturnType<typeof import('./packet.ts')['loadOleary']>>>;
type Open=(signal:AbortSignal)=>Promise<Model|undefined>;
type GradeRevision={mesh:Mesh;seams:string;geometry:BufferGeometry;pos:BufferAttribute;idx:BufferAttribute;pv:number;iv:number;test?:()=>boolean};
const drawCenter=olearyDrawCenter(), withdrew=Symbol('O’Leary close ground lease withdrawn');
const load:Open=async signal=>(await import('./packet.ts')).loadOleary((import.meta.env?.BASE_URL??'/')+'art/',signal);
export class OlearySocket{
 private readonly original;private readonly material;private readonly attributes;
 private helper?:NonNullable<ReturnType<typeof authenticatedOwnerVariant>>;private alt?:BufferGeometry;private altIndex?:BufferAttribute;private art?:Model;private programs?:OlearyProgramProof;
 private grade?:GradeRevision;private tried=false;private dead=false;private fetch?:AbortController;
 readonly owner:Mesh;private readonly scene:Scene;private readonly raw:ArrayBuffer;private readonly rows:number;
 private readonly row:unknown;private readonly seat:OlearySeat;private readonly open:Open;
 constructor(scene:Scene,owner:Mesh,raw:ArrayBuffer,rows:number,row:unknown,seat:OlearySeat,open:Open=load){
  this.scene=scene;this.owner=owner;this.raw=raw;this.rows=rows;this.row=row;this.seat=seat;this.open=open;
  this.original=owner.geometry;this.material=owner.material;
  this.attributes=Object.entries(this.original.attributes).map(([k,v])=>{const n=v as BufferAttribute;return {k,n,a:n.array,v:n.version};});
 }
 get active(){return this.helper?.visible===true;}
 private exact(){
  const o=this.owner,m=o.material,g=this.original,x=o.position,q=o.quaternion,s=o.scale;
  return !this.dead&&o.parent===this.scene&&o.visible&&o.matrixAutoUpdate&&o.layers.mask===1&&m===this.material&&!Array.isArray(m)&&m.visible&&
   !this.scene.overrideMaterial&&x.x===drawCenter.x&&x.y===0&&x.z===drawCenter.z&&q.x===0&&q.y===0&&q.z===0&&q.w===1&&s.x===1&&s.y===1&&s.z===1&&
   !g.index&&!g.groups.length&&g.drawRange.start===0&&g.drawRange.count===Infinity&&this.attributes.length===6&&Object.keys(g.attributes).length===6&&
   (!this.alt||this.alt.index===this.altIndex&&this.altIndex?.version===0&&Object.keys(this.alt.attributes).length===6&&!this.alt.groups.length&&this.alt.drawRange.start===0&&this.alt.drawRange.count===Infinity)&&
   this.attributes.every(({k,n,a,v})=>g.getAttribute(k)===n&&n.array===a&&n.version===v&&(!this.alt||this.alt.getAttribute(k)===n));
 }
 private gradeStill(){
  const x=this.grade,lease=x&&this.seat.ground();
  return !!x&&!!lease&&lease.fine===x.mesh&&lease.seams===x.seams&&x.test?.()===true;
 }
 private updateGrade(){
  const lease=this.exact()?this.seat.ground():undefined,mesh=lease?.fine,seams=lease?.seams,
   geometry=mesh?.geometry,pos=geometry?.getAttribute('position'),idx=geometry?.index;
  if(!mesh||!seams||!geometry||!(pos instanceof BufferAttribute)||!idx){this.grade=undefined;return;}
  const old=this.grade;
  if(old&&old.mesh===mesh&&old.seams===seams&&old.geometry===geometry&&old.pos===pos&&old.idx===idx&&old.pv===pos.version&&old.iv===idx.version)return;
  const next=this.grade={mesh,seams,geometry,pos,idx,pv:pos.version,iv:idx.version} as GradeRevision;
  void olearyNativeGrade(mesh,this.seat.center,seams).then(v=>{if(this.grade===next&&!this.dead){next.test=v;this.sync();}});
 }
 sync(){
  if(this.dead)return;
  this.updateGrade();
  const approved=this.gradeStill();
  if(!approved)this.fetch?.abort(withdrew);
  if(this.helper){
   this.helper.sync(approved&&this.art?.group.parent===this.scene&&this.art.intact()&&this.programs?.()===true);
   if(this.helper.visible&&!this.alt){this.alt=this.owner.geometry;this.altIndex=this.alt.index!;}
   return;
  }
  if(!approved||this.tried||this.fetch||this.owner.geometry!==this.original)return;
  this.tried=true;void this.prepare();
 }
 private async prepare(){
  const c=this.fetch=new AbortController(),signal=c.signal,timer=setTimeout(()=>c.abort(),5200);
  let left=false,candidate:Model|undefined;
  const stillEligible=()=>this.exact()&&this.owner.geometry===this.original&&this.gradeStill();
  const live=()=>{const eligible=stillEligible();if(!eligible)left=true;return eligible&&!signal.aborted;};
  const source=()=>olearyOriginalSource(this.raw,this.rows,this.row,this.owner);
  try{
   if(!await source()||!live()||!await this.seat.verifiedCover()||!live())return;
   candidate=await this.open(signal);
   if(!live()||!candidate?.intact())return;
   // No alternate index, scene attachment or visible mask until all five
   // actual materials have linked against the same renderer/scene/camera.
   const programs=await this.seat.link(candidate.group,signal);
   if(!live()||!programs||!candidate.intact()||!await source()||!live()||
      !await this.seat.verifiedCover()||!live()||!candidate.intact()||!programs()||candidate.group.parent)return;
   const helper=authenticatedOwnerVariant(this.owner,candidate.group,this.owner.userData.beaconTriangles,OLEARY.proof);
   if(!helper)return;
   try{this.scene.add(candidate.group);}catch{helper.dispose();return;}
   this.art=candidate;this.helper=helper;this.programs=programs;candidate=undefined;this.sync();
  }catch{/** All unavailable/altered local art stays on stock. */}
  finally{
   candidate?.dispose();
   clearTimeout(timer);if(this.fetch===c)this.fetch=undefined;
   // A request canceled by loss of the scene/grade residence is not an
   // unavailable asset. The still-cached owner may reacquire an exact lease.
   if(!this.dead&&(left||signal.reason===withdrew)){this.tried=false;this.sync();}
  }
 }
 dispose(){
  if(this.dead)return;this.dead=true;this.fetch?.abort();this.helper?.dispose();this.art?.dispose();
 }
}
