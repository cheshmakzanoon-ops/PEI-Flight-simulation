/** Private constrained East Point preview lifecycle, no global hook and no mesh mutation. */
export const eastHouseScope=Object.freeze({
 route:'east-light',tile:'q1333',offset:3260377,length:9073,vertices:11988,marked:426,
 wire:'bcc9434d46fb77c23f15b94c02f0a7758f3dcfcf61cfa96f6336055347f83279',
});
export type EastWallPhase='idle'|'waiting'|'ready'|'active'|'held';
type Lease<A>=Readonly<{
 object:A;wire:ArrayBuffer;
 position:Float32Array;fit:Int16Array;roof:Float32Array;
 versions:readonly [number,number,number];
}>;
type Signature=Readonly<{position:string;fit:string;roof:string}>;
type Control={gain:{value:number}};
type Read<A>=()=>Lease<A>|undefined;
const digest=async(b:ArrayBufferView|ArrayBuffer)=>{
 const data=b instanceof ArrayBuffer?b:new Uint8Array(b.buffer,b.byteOffset,b.byteLength);
 const h=await crypto.subtle.digest('SHA-256',data as BufferSource);
 return Array.from(new Uint8Array(h),x=>x.toString(16).padStart(2,'0')).join('');
};
const hash=(s:string)=>/^[a-f0-9]{64}$/.test(s);
const same=<A>(a:Lease<A>,b:Lease<A>|undefined)=>!!b&&a.object===b.object&&a.wire===b.wire&&
 a.position===b.position&&a.fit===b.fit&&a.roof===b.roof&&a.versions.every((x,i)=>x===b.versions[i]);
function qualified<A>(a:Lease<A>){
 if(a.wire.byteLength!==eastHouseScope.length||a.position.length!==eastHouseScope.vertices*3||
  a.roof.length!==eastHouseScope.vertices||a.fit.length!==eastHouseScope.vertices*3)return false;
 let n=0;
 // A real signed fit must never mark a roof or introduce an unpaired triangle.
 for(let i=0;i<a.roof.length;i+=3){
  let m=0;
  for(let j=0;j<3;j++)if(Math.abs(a.fit[(i+j)*3])>15){if(a.roof[i+j]!==0)return false;m++;}
  if(m!==0&&m!==3)return false;
  n+=m;
 }
 return n===eastHouseScope.marked;
}
const ACTIVE='eastPointWallPreview',STOCK='stockEastPointWalls';
const ownKeys=new Set(['departure','scenery','diagnostics',ACTIVE,STOCK]);
/** A private material option must not change eligibility of unrelated Standard layers. */
export function eastPointWallOption(query:string){
 const p=new URLSearchParams(query);
 if(!p.has(ACTIVE)&&!p.has(STOCK))return {requested:false,stockSearch:query};
 const profile=p.getAll('scenery'),d=p.getAll('departure'),flag=p.getAll(ACTIVE);
 const requested=d.length===1&&d[0]===eastHouseScope.route&&flag.length===1&&flag[0]==='1'&&
  !p.has(STOCK)&&[...p.keys()].every(k=>ownKeys.has(k))&&p.getAll('diagnostics').length<=1&&
  profile.length<=1&&profile.every(v=>v===''||v==='standard');
 p.delete(ACTIVE);p.delete(STOCK);
 return {requested,stockSearch:p.toString()};
}
export const eastPointWallConsent=(query:string)=>eastPointWallOption(query).requested;
/** Dispatch validates byte identity before trusted Begin. Late input is ignored even if it becomes valid. */
export function makeEastPointWallPreview<A>(allowed:boolean,read:Read<A>,pins:Signature,control:Control){
 if(![pins.position,pins.fit,pins.roof].every(hash))throw Error('Unpinned East Point preview');
 let phase:EastWallPhase=allowed?'waiting':'idle',resident:Lease<A>|undefined,selection=0;
 let pending=false,blocked=false,lastUnsupported=false;
 const off=()=>{control.gain.value=0;};
 let basis:Lease<A>|undefined;
 const deny=()=>{phase=allowed?'held':'idle';basis=undefined;resident=undefined;blocked=allowed;selection++;pending=false;off();};
 off();
 return {
  get phase(){return phase;},
  get available(){return !!read();},
  get owner(){return phase==='active'&&control.gain.value===1&&basis&&same(basis,read())?basis.object:undefined;},
  freshDispatch(){
   selection++;pending=false;resident=undefined;basis=undefined;blocked=false;lastUnsupported=false;off();
   phase=allowed?'waiting':'idle';
  },
  dispatch(route:string,supported:boolean){
   off();
   if(!allowed||route!==eastHouseScope.route){phase='idle';resident=undefined;basis=undefined;
    selection++;pending=false;blocked=false;lastUnsupported=false;return;}
   if(blocked)return;
   if(phase==='active'){deny();return;}
   const stamp=supported?read():undefined;
   if(!stamp){
    if(!lastUnsupported){selection++;resident=undefined;basis=undefined;pending=false;lastUnsupported=true;}
    phase='waiting';return;
   }
   lastUnsupported=false;
   if(resident&&!same(resident,stamp)){selection++;resident=undefined;basis=undefined;pending=false;}
   if(phase==='ready'&&basis&&same(basis,stamp)||pending&&resident&&same(resident,stamp))return;
   if(!qualified(stamp)){deny();return;}
   resident=stamp;pending=true;phase='waiting';const epoch=++selection;
   void Promise.all([digest(stamp.wire),digest(stamp.position),digest(stamp.fit),digest(stamp.roof)]).then(([w,p,f,z])=>{
    if(epoch!==selection||blocked||!same(stamp,read()))return;
    if(w!==eastHouseScope.wire||p!==pins.position||f!==pins.fit||z!==pins.roof){deny();return;}
    basis=stamp;phase='ready';
   }).catch(()=>{if(epoch===selection&&!blocked)deny();})
    .finally(()=>{if(epoch===selection)pending=false;});
  },
  begin(route:string,trustedDispatch:boolean,supported:boolean){
   off();if(!allowed)return;
   if(route!==eastHouseScope.route||!trustedDispatch||!supported||phase!=='ready'||!basis||!same(basis,read())){deny();return;}
   phase='active';
  },
  frame(route:string,visibleFlight:boolean,supported:boolean){
   off();if(phase!=='active')return;
   if(route!==eastHouseScope.route||!supported||!basis||!same(basis,read())){deny();return;}
   if(visibleFlight)control.gain.value=1;
  },
  release:deny,
 };
}
