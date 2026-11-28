import {REGIONAL_STANDS,type CanopyBox} from './regional-canopy/spec.ts';
import type {SignedHeightView} from './dispatch-stand-height.ts';

/** One low manual Standard route only; not the regional above-canopy departure. */
export const QUEENS_DISPATCH_STAND=Object.freeze({
 route:'queens-woodland-view',owner:'13-13',
 sha256:'ff1d9badde7c036815956fedd778820f7647399baff8afac3f59a7bc46d74c26',
 lon:-63.37650018484735,lat:46.400959210988596,heading:120,aboveSurface:29,
});

/** Leave named optics/comparator profiles exactly as they were for this new
 * cohort. No changes to the shared Standard predicate or its old routes. */
export function queensDispatchStandProfile(q:URLSearchParams){
 const mode=q.getAll('scenery');
 return q.getAll('departure').length<=1&&q.getAll('diagnostics').length<=1&&
  mode.length<=1&&mode.every(v=>v===''||v==='standard')&&
  [...q.keys()].every(k=>k==='departure'||k==='scenery'||k==='diagnostics');
}

export const QUEENS_REGIONAL_ROSTER=1081;
export const QUEENS_REGIONAL_BOX:CanopyBox=Object.freeze([-13778.2306,10714.335,-13470.7545,11240.3819]);
const regionalCanopyBox:CanopyBox=Object.freeze([-13772,10720,-13477,11237]);
const tile:CanopyBox=Object.freeze([-18279.092500314044,9499.219884423117,-12186.061666875947,15360.440664173511]);
// The stock opaque crown has ≤25.032m horizontal radius (H≤30m,
// W≤35.4m); the signed stock ground shade reaches +38.034 X, +27.363 Z,
// and has smaller negative reach than the crown. Opposing maximum reach
// for the protected and candidate actors is <63.066m X /52.395m Z. Use
// a rounded ≥.05m margin. The existing addon fits inside its inner box.
const dx=63.125,dz=52.475;
export const QUEENS_DISPATCH_QUIET_BOX:CanopyBox=Object.freeze([
 QUEENS_REGIONAL_BOX[0]-dx,QUEENS_REGIONAL_BOX[1]-dz,
 QUEENS_REGIONAL_BOX[2]+dx,QUEENS_REGIONAL_BOX[3]+dz,
]);

function currentPeer(){
 const r=REGIONAL_STANDS[0];
 return !!r&&Array.isArray(r.bounds)&&r.bounds.length===4&&Array.isArray(r.canopyBounds)&&r.canopyBounds.length===4&&
  r.id==='0911576'&&r.owner===QUEENS_DISPATCH_STAND.owner&&r.efiSha===QUEENS_DISPATCH_STAND.sha256&&
  r.stockCount===QUEENS_REGIONAL_ROSTER&&r.stockSha==='3cf79412600fa645d0fe1cb861ea248243e464a1a0b6003258c097abb0670b7b'&&
  r.count===364&&r.decodedSha==='c5db92407762a3d205cb2891a4af8722d83c8936679cf5c11ca6756a1397b70a'&&
  r.bounds.every((v,i)=>v===QUEENS_REGIONAL_BOX[i])&&r.canopyBounds.every((v,i)=>v===regionalCanopyBox[i]);
}

/** The exact Queens peer is inside its closed quiet box. Any other
 * registered observer must be positively separated from this whole tile
 * before a Queens-only H/W write may remain invisible to its revision. */
export function queensRegionalObserverDisjoint(){
 if(!currentPeer())return false;
 const [west,north,east,south]=tile;
 for(let i=1;i<REGIONAL_STANDS.length;i++){
  const a=REGIONAL_STANDS[i]?.bounds;
  if(!Array.isArray(a)||a.length!==4||!a.every(Number.isFinite))return false;
  const [w,n,e,s]=a;
  if(w>=e||n>=s||!(e<west||w>east||s<north||n>south))return false;
 }
 return true;
}

/** Close the old roster plus its two-actor horizontal cover on both packed
 * and recovered source roots, through the original prepare call's two
 * contains() checks. A changed rectangular tile owner never inherits it. */
export function queensDispatchAdmits(x:number,z:number){
 const [w,n,e,s]=tile;
 return Number.isFinite(x)&&Number.isFinite(z)&&x>=w&&x<e&&z>=n&&z<s&&
  (x<QUEENS_DISPATCH_QUIET_BOX[0]||z<QUEENS_DISPATCH_QUIET_BOX[1]||
   x>QUEENS_DISPATCH_QUIET_BOX[2]||z>QUEENS_DISPATCH_QUIET_BOX[3]);
}

export function queensDispatchHeightView(view:SignedHeightView):SignedHeightView|undefined{
 if(view.id!==QUEENS_DISPATCH_STAND.owner||view.sha256!==QUEENS_DISPATCH_STAND.sha256||!queensRegionalObserverDisjoint())return;
 const admitted=(x:number,z:number)=>queensDispatchAdmits(x,z)&&view.contains(x,z);
 return Object.freeze({id:view.id,sha256:view.sha256,contains:admitted,
  height:(x:number,z:number,vary:number)=>admitted(x,z)?view.height(x,z,vary):0});
}

/** Exact small CPU snapshot, not an authority for or request to the
 * existing independent regional renderer. */
export function sameQueensRegionalWords(a:ArrayBuffer|undefined,b:ArrayBuffer|undefined){
 const bytes=QUEENS_REGIONAL_ROSTER*5*4;
 if(!a||!b||a.byteLength!==bytes||b.byteLength!==bytes)return false;
 const x=new Uint32Array(a),y=new Uint32Array(b);
 for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;
 return true;
}
