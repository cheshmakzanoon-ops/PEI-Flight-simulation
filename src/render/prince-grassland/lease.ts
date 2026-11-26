import {BufferAttribute,type BufferGeometry,type Material,type Mesh,type Scene} from 'three';
import {patchContactFromDraw} from './contact.ts';
import {stageIntactTerrainCells} from './terrain-draw.ts';
import type {verifiedPrinceOverview} from './source.ts';

type Draft=NonNullable<Awaited<ReturnType<typeof verifiedPrinceOverview>>>;
type Pin={name:string;old:BufferAttribute;new:BufferAttribute;stock:Float32Array;raised:Float32Array;
 oldArray:Float32Array;newArray:Float32Array;count:number;raisedCount:number;size:number};
const edge=(i:number)=>i<113*113&&(i<113||i>=112*113||i%113===0||i%113===112);
/** A half-frame draw lease and a separate persistent, exact-cell contact.
 * Neither one constructs scenery in the animation loop after admission. */
export class PrinceLandscapeLease {
 readonly stock:BufferGeometry;
 readonly raised:BufferGeometry;
 private readonly owner:Mesh;
 private readonly material:Material|Material[];
 private readonly oldIndex:BufferAttribute;
 private readonly newIndex:BufferAttribute;
 private readonly oldSequence:Uint16Array;
 private readonly newSequence:Uint16Array;
 private readonly oldIndices:Uint16Array;
 private readonly newIndices:Uint16Array;
 private readonly pins:Pin[];
 private readonly height:NonNullable<ReturnType<typeof patchContactFromDraw>>;
 private living=false;
 private released=false;
 private inDraw=false;
 constructor(owner:Mesh,draft:Draft){
  this.owner=owner;this.material=owner.material;this.stock=owner.geometry;
  const art=stageIntactTerrainCells(this.stock,draft.cells,4,draft.survey);
  this.raised=art.geometry;
  const height=patchContactFromDraw(this.raised,art.scopes);
  const a=this.stock.index,b=this.raised.index;
  if(!height||!a||!b||!(a.array instanceof Uint16Array)||!(b.array instanceof Uint16Array)||
     this.raised.index!.count/3-this.stock.index!.count/3!==624){
   this.raised.dispose();throw Error('Unverified field contact authority');
  }
  this.height=height;this.oldIndex=a;this.newIndex=b;
  this.oldIndices=a.array;this.newIndices=b.array;this.oldSequence=a.array.slice();this.newSequence=b.array.slice();
  this.pins=['position','normal','uv'].map(name=>{
   const old=this.stock.getAttribute(name) as BufferAttribute,fresh=this.raised.getAttribute(name) as BufferAttribute;
   const oldArray=old.array as Float32Array,newArray=fresh.array as Float32Array;
   return {name,old,new:fresh,oldArray,newArray,stock:oldArray.slice(),raised:newArray.slice(),count:old.count,raisedCount:fresh.count,size:old.itemSize};
  });
 }
 get installed(){return this.living;}
 synchronizeRim(rim:readonly (readonly [number,number])[]){
  const g=this.raised.getAttribute('position');
  if(g!==this.pins[0].new)return;
  let dirty=false;for(const [i,y] of rim)if(edge(i)&&g.getY(i)!==y){g.setY(i,y);dirty=true;}
  if(dirty){this.pins[0].new.clearUpdateRanges();g.needsUpdate=true;}
 }
 valid(scene:Scene,rim:readonly (readonly [number,number])[]){
  const m=this.owner,a=this.stock,b=this.raised,i=this.oldIndex,j=this.newIndex;
  if(this.released||this.inDraw||m.geometry!==a||m.parent!==scene||!m.visible||!m.matrixAutoUpdate||
   m.material!==this.material||Array.isArray(m.material)||!m.material.visible||scene.overrideMaterial||
   a.index!==i||b.index!==j||i.array!==this.oldIndices||j.array!==this.newIndices||
   i.count!==this.oldSequence.length||j.count!==this.newSequence.length||i.itemSize!==1||j.itemSize!==1||i.normalized||j.normalized||
   a.groups.length||b.groups.length||a.drawRange.start!==0||b.drawRange.start!==0||
   a.drawRange.count!==Infinity||b.drawRange.count!==Infinity)return false;
  for(let k=0;k<this.oldSequence.length;k++)if(i.array[k]!==this.oldSequence[k])return false;
  for(let k=0;k<this.newSequence.length;k++)if(j.array[k]!==this.newSequence[k])return false;
  for(const p of this.pins){
   if(a.getAttribute(p.name)!==p.old||b.getAttribute(p.name)!==p.new||p.old.array!==p.oldArray||p.new.array!==p.newArray||
    p.old.count!==p.count||p.new.count!==p.raisedCount||p.old.itemSize!==p.size||p.new.itemSize!==p.size||
    p.old.normalized||p.new.normalized)return false;
   for(let k=0;k<p.raised.length;k++){
    if(p.name==='position'&&k%3===1&&edge((k-1)/3))continue;
    if(p.raised[k]!==p.new.array[k]||k<p.stock.length&&p.stock[k]!==p.old.array[k])return false;
   }
  }
  const pos=this.pins[0];
  for(const [i,y] of rim)if(!edge(i)||pos.old.getY(i)!==y||pos.new.getY(i)!==y)return false;
  return true;
 }
 arm(){if(!this.released)this.living=true;}
 contact(x:number,z:number,stock:number,dry:boolean,runway:boolean){
  return this.living?this.height(x-this.owner.position.x,z-this.owner.position.z,stock,dry,runway):stock;
 }
 begin(scene:Scene){
  if(!this.living||this.released||this.inDraw||this.owner.geometry!==this.stock||this.owner.parent!==scene||
    this.owner.material!==this.material||scene.overrideMaterial)return;
  const q=this;
  q.inDraw=true;q.owner.geometry=q.raised;
  return ()=>{
   if(q.owner.geometry===q.raised)q.owner.geometry=q.stock;
   q.inDraw=false;
  };
 }
 close(){
  if(this.released)return;
  if(this.owner.geometry===this.raised)this.owner.geometry=this.stock;
  this.inDraw=false;this.released=true;this.living=false;this.raised.dispose();
 }
}
