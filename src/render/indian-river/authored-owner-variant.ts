import {BufferAttribute,BufferGeometry,Group,Mesh} from 'three';
/** Stock and alternate views keep the very same submitted attributes. The
 * signed and independently recorded owner span is the only exclusion. */
export function authenticatedOwnerVariant(mesh:Mesh,authored:Group,span:readonly [number,number],
  proof:{vertices:number;start:number;end:number}){
 const stock=mesh.geometry,n=stock.getAttribute('position').count,[lo,hi]=span;
 if(stock.index||n!==proof.vertices||lo!==proof.start||hi!==proof.end||
   ![lo,hi,n].every(q=>Number.isSafeInteger(q)&&q%3===0)||lo<0||hi<=lo||hi>n||n-(hi-lo)<3)return;
 const idx=n<=65536?new Uint16Array(n-hi+lo):new Uint32Array(n-hi+lo);
 for(let i=0;i<idx.length;i++)idx[i]=i<lo?i:i+hi-lo;
 const alternate=new BufferGeometry();
 for(const [k,a] of Object.entries(stock.attributes))alternate.setAttribute(k,a);
 alternate.boundingBox=stock.boundingBox;alternate.boundingSphere=stock.boundingSphere;
 alternate.setIndex(new BufferAttribute(idx,1));
 let closed=false,show=false;
 authored.visible=false;
 return {
  get visible(){return show;},
  sync(admission:boolean){
   if(closed)return;
   // A sibling rendering system that replaces the owner never inherits an
   // active omission. Restore the authored fallback, not the other owner.
   if(mesh.geometry!==stock&&mesh.geometry!==alternate){show=authored.visible=false;return;}
   show=authored.visible=admission&&!!mesh.parent&&!!authored.parent;
   mesh.geometry=show?alternate:stock;
  },
  dispose(){
   if(closed)return;
   closed=true;show=authored.visible=false;
   if(mesh.geometry===alternate)mesh.geometry=stock;
   alternate.dispose();
  },
 };
}
