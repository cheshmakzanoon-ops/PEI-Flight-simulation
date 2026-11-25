import type {BufferGeometry,Scene,ShaderMaterial,Vector3} from 'three';
import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import {regionalForestSeat} from './ground.ts';
import {REGIONAL_DRAW_M,REGIONAL_RELEASE_M,REGIONAL_SOURCE,regionalDigest,type RegionalStand,type CanopyBox} from './spec.ts';
import type {World} from '../world.ts';
import type {CanopyRow} from './assets.ts';
import type {createRegionalCanopy} from './mesh.ts';

export type RegionalStock={
 readonly stockCanopyRevision:number;
 captureStockCanopy(bounds:CanopyBox,count:number):ArrayBuffer|undefined;
 crownFillMaterial():ShaderMaterial;
};
export type RegionalEFI={hasHeightPlan(id:string,sha:string):boolean};
type XYZ=Pick<Vector3,'x'|'z'|'y'>;
type Shape=NonNullable<ReturnType<typeof createRegionalCanopy>>;
export type CanopyPrepared={rows:readonly CanopyRow[];create:typeof createRegionalCanopy};
type Status='idle'|'checking'|'ready'|'failed';
type Stage={
 spec:RegionalStand;rosterRevision:number;rosterGood:boolean;hashing:boolean;signedRoster?:ArrayBuffer;
 pack:Status;requests:number;prepared?:CanopyPrepared;model?:Shape;contact?:BufferGeometry;seatFailed:boolean;
 since:number;
};
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const horizontal2=(p:XYZ,s:RegionalStand)=>(p.x-s.center[0])**2+(p.z-s.center[1])**2;
const finite=(p:XYZ)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
function equalBytes(a:ArrayBuffer,b:ArrayBuffer){
 const p=new Uint32Array(a),q=new Uint32Array(b);
 for(let i=0;i<p.length;i++)if(p[i]!==q[i])return false;
 return p.length===q.length;
}
async function lazyRegionalCanopy(worldBase:string,spec:RegionalStand){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const modules=await Promise.race([Promise.all([import('./assets.ts'),import('./mesh.ts')]),
   new Promise<undefined>(r=>timer=setTimeout(()=>r(undefined),1100))]);
  if(!modules)return;
  const rows=await modules[0].readRegionalCanopy(worldBase,spec);
  if(rows)return {rows,create:modules[1].createRegionalCanopy};
 }catch{return;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
/** Never edits a stock roster, terrain, collider, texture or shadow receiver.
 * Async work stages data only. The renderer can submit one new local mesh in
 * the same frame as the verified stock forest, or submit absolutely nothing. */
export class RegionalCanopies {
 private readonly entries:Stage[];
 private layers:Status='idle';
 private cover:Status='idle';
 private active?:Stage;
 private readonly world:Pick<World,'terrain'|'cover'|'visualGroundHeight'|'rollingCanopyOwner'>;
 private readonly scene:Scene;
 private readonly vegetation:RegionalStock;
 private readonly forest:RegionalEFI;
 private readonly worldBase:string;
 private readonly load:(base:string,s:RegionalStand)=>Promise<CanopyPrepared|undefined>;
 constructor(world:RegionalCanopies['world'],scene:Scene,vegetation:RegionalStock,forest:RegionalEFI,worldBase:string,stands:readonly RegionalStand[],
  load:RegionalCanopies['load']=lazyRegionalCanopy){
  this.world=world;this.scene=scene;this.vegetation=vegetation;this.forest=forest;this.worldBase=worldBase;this.load=load;
  this.entries=stands.map(spec=>({spec,rosterRevision:-1,rosterGood:false,hashing:false,pack:'idle',requests:0,seatFailed:false,since:Infinity}));
 }
 interested(aircraft:XYZ,eye:XYZ){
  const cutoff=REGIONAL_RELEASE_M**2;
  return this.entries.some(({spec})=>horizontal2(aircraft,spec)<cutoff&&horizontal2(eye,spec)<cutoff);
 }
 qualifyLayers(match:boolean){this.layers=match?'ready':'failed';}
 get state(){
  return {layers:this.layers,cover:this.cover,active:this.active?.spec.id??null,draw:this.active?.model?.total??0,
   gain:this.active?.model?.gain??0,stands:this.entries.map(e=>({id:e.spec.id,efi:this.forest.hasHeightPlan(e.spec.owner,e.spec.efiSha),
    roster:e.rosterGood?'ready':e.hashing?'checking':e.rosterRevision<0?'idle':'waiting',pack:e.pack,
    requests:e.requests,seat:e.seatFailed?'failed':e.contact?'ready':'idle'}))};
 }
 clear(){
  this.active=undefined;
  for(const e of this.entries)this.hide(e);
 }
 private hide(e:Stage,release=false){
  e.since=Infinity;
  if(release&&e.model){e.model.dispose();e.model=undefined;e.contact=undefined;}
  else e.model?.gainTo(0);
 }
 private verifyRoster(e:Stage){
  const revision=this.vegetation.stockCanopyRevision;
  if(e.rosterRevision===revision)return e.rosterGood;
  if(e.hashing)return false;
  e.rosterRevision=revision;e.rosterGood=false;
  const a=this.vegetation.captureStockCanopy(e.spec.bounds,e.spec.stockCount);
  if(!a||a.byteLength!==e.spec.stockCount*20)return false;
  if(e.signedRoster){e.rosterGood=equalBytes(a,e.signedRoster);return e.rosterGood;}
  e.hashing=true;
  void regionalDigest(a).then(hash=>{
   if(hash===e.spec.stockSha){e.signedRoster=a;
    // Stale asynchronous work is never an authority for a later draw.
    e.rosterGood=revision===this.vegetation.stockCanopyRevision;
   }
  }).finally(()=>{e.hashing=false;});
  return false;
 }
 private contact(e:Stage,geometry:BufferGeometry){
  if(e.contact!==geometry){
   e.model?.dispose();e.model=undefined;e.contact=geometry;e.seatFailed=false;e.since=Infinity;
  }
  if(!e.model&&!e.seatFailed&&e.prepared){
   try{const {cover,terrain}=this.world;e.model=e.prepared.create(this.scene,this.vegetation.crownFillMaterial(),e.spec,e.prepared.rows,
    (x,z,h,w)=>regionalForestSeat(terrain,cover,x,z,h,w)?this.world.visualGroundHeight(x,z):undefined);}
   catch{/** A descriptor, material or seat mismatch leaves the stock forest live. */}
   if(!e.model)e.seatFailed=true;
  }
  return e.model;
 }
 update(aircraft:XYZ,eye:XYZ,agl:number,eyeAGL:number,begin:boolean,retain:boolean,now:number){
  this.active=undefined;
  const good=retain&&finite(aircraft)&&finite(eye)&&Number.isFinite(agl)&&Number.isFinite(eyeAGL)&&Number.isFinite(now);
  const altitude=Math.max(agl,eyeAGL);
  for(const e of this.entries){
   const {spec:s}=e;
   const range=Math.max(horizontal2(aircraft,s),horizontal2(eye,s));
   if(!good||!Number.isFinite(range)||range>=REGIONAL_RELEASE_M**2||altitude>=445){this.hide(e,true);continue;}
   if(this.active||range>=REGIONAL_DRAW_M**2||altitude>=390||agl<8||eye.y<s.seats[1]+14||
      this.layers!=='ready'||!this.forest.hasHeightPlan(s.owner,s.efiSha)){
    this.hide(e);continue;
   }
   const owner=this.world.rollingCanopyOwner(s.canopyBounds);
   if(owner?.key!==s.owner||!this.verifyRoster(e)){this.hide(e);continue;}
   if(this.cover==='idle'&&begin){
    this.cover='checking';
    void verifyDecodedCover(this.world.cover).then(hash=>this.cover=hash===REGIONAL_SOURCE.decoded?'ready':'failed');
   }
   if(this.cover!=='ready'){this.hide(e);continue;}
   if(e.pack==='idle'&&begin){
    e.pack='checking';e.requests++;
    void Promise.resolve().then(()=>this.load(this.worldBase,s)).then(p=>{
     e.prepared=p;e.pack=p?'ready':'failed';
    },()=>{e.pack='failed';});
   }
   if(!e.prepared||(!begin&&e.since===Infinity)){this.hide(e);continue;}
   const model=this.contact(e,owner.geometry);
   if(!model){this.hide(e);continue;}
   if(e.since===Infinity)e.since=now;
   const alpha=smooth((now-e.since)/420)*smooth((REGIONAL_DRAW_M-Math.sqrt(range))/122)*smooth((eye.y-model.highest-2)/11)*smooth((390-altitude)/110);
   model.gainTo(alpha);
   if(model.mesh.visible)this.active=e;
  }
 }
}
