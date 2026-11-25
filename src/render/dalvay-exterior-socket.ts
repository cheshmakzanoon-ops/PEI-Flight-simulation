import type {Mesh,Scene,BufferAttribute,BufferGeometry} from 'three';
import {authenticatedOwnerVariant} from './indian-river/authored-owner-variant.ts';
import {DALVAY,dalvaySource,type DalvaySeat} from './dalvay-exterior-seat.ts';
import {project} from '../sim/geo.ts';
/** Reproduce Buildings' signed atlas midpoint on this engine. A baked decimal falsely
 * rejects the real Chrome draw, one representable double from the offline Node build. */
export function dalvayDrawCenter(toWorld:typeof project=project){
 const [w,s,e,n]=DALVAY.bounds,a=toWorld(w,n),b=toWorld(e,s);
 return {x:(a.x+b.x)/2,z:(a.z+b.z)/2};
}
const stockCenter=dalvayDrawCenter();
type Art=NonNullable<Awaited<ReturnType<typeof import('./dalvay-art-packet.ts')['loadDalvay']>>>;
type Loader=(signal:AbortSignal)=>Promise<Art|undefined>;
const defaultLoad:Loader=async signal=>(await import('./dalvay-art-packet.ts')).loadDalvay((import.meta.env?.BASE_URL??'/')+'art/',signal);
/** An exact original streamed owner is always present before, during and on failed
 * admission. An asynchronous or foreign replacement never inherits its omission. */
export class DalvaySocket{
 readonly owner:Mesh;private readonly scene:Scene;private readonly seat:DalvaySeat;
 private readonly original;private readonly material;private readonly source:()=>Promise<boolean>;private readonly originalRows:()=>boolean;
 private variant?:BufferGeometry;private ownedIndex?:BufferAttribute;
 private readonly load:Loader;private helper?:NonNullable<ReturnType<typeof authenticatedOwnerVariant>>;
 private art?:Art;private tried=false;private retired=false;private request?:AbortController;
 constructor(scene:Scene,owner:Mesh,raw:ArrayBuffer,rows:number,row:unknown,seat:DalvaySeat,load:Loader=defaultLoad){
  this.scene=scene;this.owner=owner;this.seat=seat;this.original=owner.geometry;this.material=owner.material;this.load=load;
  const attrs=Object.entries(this.original.attributes).map(([name,val])=>{const a=val as BufferAttribute;return {name,a,array:a.array,version:a.version};});
  this.originalRows=()=>{
   if(attrs.length!==6||this.original.index||this.original.groups.length||this.original.drawRange.start!==0||this.original.drawRange.count!==Infinity)return false;
   if(this.variant&&(this.variant.index!==this.ownedIndex||this.ownedIndex?.version!==0||this.variant.groups.length||this.variant.drawRange.start!==0||this.variant.drawRange.count!==Infinity))return false;
   for(const {name,a,array,version}of attrs)if(this.original.getAttribute(name)!==a||a.array!==array||a.version!==version||(this.variant&&this.variant.getAttribute(name)!==a))return false;
   return true;
  };
  this.source=()=>dalvaySource(raw,rows,row,owner);
 }
 get active(){return this.helper?.visible===true;}
 private present(){const o=this.owner,p=o.position,q=o.quaternion,s=o.scale;
  return !this.retired&&o.parent===this.scene&&o.visible&&o.layers.mask===1&&o.matrixAutoUpdate&&p.x===stockCenter.x&&p.y===0&&p.z===stockCenter.z&&q.x===0&&q.y===0&&q.z===0&&q.w===1&&s.x===1&&s.y===1&&s.z===1&&
   o.material===this.material&&!Array.isArray(o.material)&&o.material.visible&&!this.scene.overrideMaterial&&this.originalRows();
 }
 sync(){
  if(this.retired)return;
  const ok=this.present()&&this.seat.resident();
  if(this.helper){this.helper.sync(ok&&this.art?.group.parent===this.scene&&this.art.intact());
   if(this.helper.visible&&!this.variant){this.variant=this.owner.geometry;this.ownedIndex=this.variant.index!;}return;}
  if(!ok||this.tried||this.owner.geometry!==this.original)return;
  this.tried=true;void this.prepare();
 }
 private async prepare(){
  const controller=this.request=new AbortController(),signal=controller.signal,timer=setTimeout(()=>controller.abort(),5400);
  const present=()=>!signal.aborted&&this.present()&&this.owner.geometry===this.original;
  try{
   if(!await this.source()||!present()||!await this.seat.verifiedCover()||!present())return;
   if(!this.seat.resident()){this.tried=false;return;} // The source can qualify again only on a later genuine close approach.
   const art=await this.load(signal);if(!art)return;
   if(!present()){art.dispose();return;}
   const helper=authenticatedOwnerVariant(this.owner,art.group,this.owner.userData.beaconTriangles,DALVAY.proof);
   if(!helper||!art.intact()){helper?.dispose();art.dispose();return;}
   this.art=art;this.helper=helper;this.scene.add(art.group);this.sync();
  }catch{/** Failed art is never a reason to omit the complete stock mesh. */}
  finally{clearTimeout(timer);if(this.request===controller)this.request=undefined;}
 }
 dispose(){
  if(this.retired)return;this.retired=true;this.request?.abort();this.helper?.dispose();this.art?.dispose();
 }
}
