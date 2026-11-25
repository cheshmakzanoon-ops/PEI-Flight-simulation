import {BufferAttribute,BufferGeometry,type Group,type Mesh} from 'three';

type Span=readonly [number,number];
type DrawProof=Readonly<{vertices:number;start:number;end:number}>;
type Lane={span:Span;group:Group;admitted:boolean;visible:boolean;closed:boolean};

/** At most two independently authenticated complete-feature replacements
 * in a single stock draw. No original BufferAttribute or index is mutated.
 * Incompatible geometry transfers ownership to the external system. */
export function authenticatedOwnerCohort(mesh:Mesh,stock:BufferGeometry=mesh.geometry){
 const vertexCount=stock.getAttribute('position')?.count??0;
 if(mesh.geometry!==stock||stock.index||stock.groups.length||stock.drawRange.start!==0||
    stock.drawRange.count!==Infinity||vertexCount<6||vertexCount%3!==0)return;
 const byMask=new Map<string,BufferGeometry>();
 const lanes:Lane[]=[];
 let applied=stock,stopped=false,revision=0;
 const disposeMask=(masked:BufferGeometry)=>{
  // Three's geometry disposal deletes GPU buffers for attached attributes.
  // They belong to the immutable stock, even when a sibling draw uses them.
  for(const name of Object.keys(masked.attributes))masked.deleteAttribute(name);
  masked.dispose(); // The alternate's own index and binding state are released.
 };
 const recognises=()=>mesh.geometry===stock||mesh.geometry===applied;
 const same=(a:Span,b:Span)=>a[0]===b[0]&&a[1]===b[1];
 const valid=(a:Span,proof:DrawProof)=>
  proof.vertices===vertexCount&&same(a,[proof.start,proof.end])&&
  a.every(v=>Number.isSafeInteger(v)&&v%3===0)&&a[0]>=0&&a[1]>a[0]&&a[1]<=vertexCount;
 const eligible=(lane:Lane)=>lane.admitted&&!!mesh.parent&&lane.group.parent===mesh.parent;
 const refresh=(force=false)=>{
  if(stopped)return;
  if(!recognises()){
   for(const lane of lanes)lane.group.visible=lane.visible=false;
   return;
  }
  if(!force&&mesh.geometry===applied&&!lanes.some(lane=>eligible(lane)!==lane.visible||lane.group.visible!==lane.visible))return;
  const active=lanes.filter(eligible);
  const key=active.map(lane=>lane.span.join(',')).join(';');
  let geometry=key?byMask.get(key):stock;
  if(!geometry){
   const remainder=vertexCount-active.reduce((n,q)=>n+q.span[1]-q.span[0],0);
   if(remainder<3)throw Error('Authenticated owners must retain stock content');
   const Index=vertexCount<=65536?Uint16Array:Uint32Array;
   const index=new Index(remainder);
   let j=0,skip=0;
   for(let i=0;i<vertexCount;){
    const hole=active[skip]?.span;
    if(hole&&i===hole[0]){i=hole[1];skip++;}else index[j++]=i++;
   }
   geometry=new BufferGeometry();
   for(const [name,a] of Object.entries(stock.attributes))geometry.setAttribute(name,a);
   geometry.boundingBox=stock.boundingBox;geometry.boundingSphere=stock.boundingSphere;
   geometry.setIndex(new BufferAttribute(index,1));
   byMask.set(key,geometry);
  }
  if(geometry!==applied||mesh.geometry!==geometry)revision++;
  mesh.geometry=applied=geometry;
  for(const lane of lanes){
   lane.visible=active.includes(lane);
   lane.group.visible=lane.visible;
  }
 };
 return {
  get revision(){return revision;},
  /** Only use this to authenticate byte-for-byte while the group still owns
   * this registered, live tile. Callers must also recheck their own lease. */
  stockForProof(){return !stopped&&recognises()?stock:undefined;},
  add(group:Group,span:Span,proof:DrawProof){
   if(stopped||!recognises()||lanes.length>=2||!valid(span,proof)||
      lanes.some(q=>q.group===group||q.span[0]<span[1]&&span[0]<q.span[1])||
      vertexCount-(span[1]-span[0])-lanes.reduce((n,q)=>n+q.span[1]-q.span[0],0)<3)return;
   const lane:Lane={group,span:[...span],admitted:false,visible:false,closed:false};
   lanes.push(lane);lanes.sort((a,b)=>a.span[0]-b.span[0]);group.visible=false;
   return {
    get visible(){return lane.visible;},
    sync(value:boolean){if(!lane.closed){lane.admitted=value;refresh();}},
    dispose(){
     if(lane.closed)return;
     lane.closed=true;lane.visible=group.visible=false;
     lanes.splice(lanes.indexOf(lane),1);
     refresh(true);
     // Retain active masks belonging to still-live sites; there are at most 3.
     const token=lane.span.join(',');
     for(const [key,cached] of byMask)if(key.split(';').includes(token)){
      disposeMask(cached);byMask.delete(key);
     }
    },
   };
  },
  dispose(){
   if(stopped)return;
   stopped=true;
   if(recognises())mesh.geometry=stock;
   for(const lane of lanes){lane.closed=true;lane.visible=lane.group.visible=false;}
   for(const q of byMask.values())disposeMask(q);
   byMask.clear();lanes.length=0;
  }
 };
}
