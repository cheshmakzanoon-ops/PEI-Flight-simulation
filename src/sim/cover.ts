import {clamp} from './geo.ts';
import {mergeWharfToe} from './basin-wharf-toe.ts';
import type {HarbourCover,WaterInset} from './harbour-cover.ts';
import type {Terrain} from './terrain.ts';
export class Cover {
 readonly sourceSha?:string;readonly wharfToe:boolean;
 readonly width:number;readonly height:number;readonly bytes:Uint8Array;readonly harbour:HarbourCover|undefined;readonly basin?:WaterInset;readonly montague?:WaterInset;readonly sourceDecodedSha?:string;readonly waterInsets:readonly WaterInset[];
 constructor(width:number,height:number,data:Uint8Array,harbour?:HarbourCover,sourceSha?:string,basin?:WaterInset,montague?:WaterInset,sourceDecodedSha?:string,wharfToe=false){
  if(data.length!==width*height*2||width<2||height<2)throw Error('Invalid province ground-cover raster.');
  this.width=width;this.height=height;this.bytes=data;this.harbour=harbour;this.sourceSha=sourceSha;this.basin=basin;this.montague=montague;this.sourceDecodedSha=sourceDecodedSha;this.wharfToe=wharfToe;
  this.waterInsets=[...(harbour?[harbour]:[]),...(basin?[basin]:[]),...(montague?[montague]:[])];
 }
 sample(t:Terrain,x:number,z:number){
  const [u,v]=t.uv(x,z);if(u<0||v<0||u>=1||v>=1)return 0;
  const i=Math.floor(u*this.width),j=Math.floor(v*this.height);return this.bytes[(j*this.width+i)*2];
 }
 distance(t:Terrain,x:number,z:number){
  const old=this.legacyDistance(t,x,z);
  const prior=this.harbour?.distance(old,x,z)??old;
  const next=this.basin?.distance(prior,x,z)??prior;
  // An inlet can admit a wet hit but cannot recolor the dry surroundings
  // or shift distance-based yard, hedge and forest material cutoffs.
  const basinBase=next<0?next:prior;
  const fromBasin=this.wharfToe?mergeWharfToe(basinBase,x,z):basinBase;
  const fromMontague=this.montague?.distance(fromBasin,x,z)??fromBasin;
  // Match the land shader: only wet samples may adopt the replacement
  // scalar. A still-dry sample keeps its old material and planting rules.
  return fromMontague<0?fromMontague:fromBasin;
 }
 legacyDistance(t:Terrain,x:number,z:number){
  const [u,v]=t.uv(x,z);if(u<0||v<0||u>=1||v>=1)return -254;
  const a=clamp(u*this.width-.5,0,this.width-1),b=clamp(v*this.height-.5,0,this.height-1),ix=Math.floor(a),iy=Math.floor(b);
  const k=(dx:number,dy:number)=>this.bytes[(Math.min(this.height-1,iy+dy)*this.width+Math.min(this.width-1,ix+dx))*2+1];
  const fx=a-ix,fy=b-iy;return 2*((k(0,0)*(1-fx)+k(1,0)*fx)*(1-fy)+(k(0,1)*(1-fx)+k(1,1)*fx)*fy-128);
 }
}
