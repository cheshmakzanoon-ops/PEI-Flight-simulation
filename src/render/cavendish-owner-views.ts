import {BufferAttribute,BufferGeometry} from 'three';

/**
 * q72 (Barn) and q101 (House) reuse one immutable set of stock vertex buffers.
 * Barn views are separate geometries because a single Three geometry can
 * dispose only its currently bound index. On eviction each view is freed.
 * The ordinary / House geometry and index are never modified here.
 */
export class CavendishBarnViews {
 readonly stock:BufferGeometry;
 private readonly range:readonly [number,number];
 private solo?:BufferGeometry;
 private both?:{house:BufferAttribute;geometry:BufferGeometry};
 constructor(stock:BufferGeometry,range:readonly [number,number]){
  this.stock=stock;this.range=range;
 }
 withBarn(house:BufferAttribute|null):BufferGeometry|undefined{
  if(!house&&this.solo)return this.solo;
  if(house===this.both?.house)return this.both.geometry;
  // In one residency the separately verified Green Gables House's index
  // is immutable. An unknown sibling cannot hide either original row.
  if(house&&this.both)return;
  const [lo,hi]=this.range,n=this.stock.getAttribute('position').count,rows=house?.array;
  const len=rows?.length??n,k=len-(hi-lo);
  if(!Number.isInteger(lo)||!Number.isInteger(hi)||lo<0||hi<=lo||hi>n||lo%3||hi%3||len%3||k<3)return;
  const idx=n<=65536?new Uint16Array(k):new Uint32Array(k);let j=0,excluded=0;
  for(let i=0;i<len;i++){
   const p=rows?.[i]??i;
   if(!Number.isInteger(p)||p<0||p>=n||(i>0&&rows&&rows[i-1]>=p))return;
   if(rows&&(i%3===0?p%3!==0:p!==rows[i-1]+1))return;
   if(p>=lo&&p<hi){excluded++;continue;}
   if(j===k)return;
   idx[j++]=p;
  }
  if(j!==k||excluded!==hi-lo)return;
  const g=new BufferGeometry();
  for(const [name,constituent] of Object.entries(this.stock.attributes))g.setAttribute(name,constituent);
  g.boundingSphere=this.stock.boundingSphere;g.boundingBox=this.stock.boundingBox;
  g.setIndex(new BufferAttribute(idx,1));
  if(house)this.both={house,geometry:g};else this.solo=g;
  return g;
 }
 dispose(){
  this.solo?.dispose();this.both?.geometry.dispose();
  this.solo=undefined;this.both=undefined;
 }
}
