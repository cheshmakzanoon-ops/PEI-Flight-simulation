import * as T from 'three';
import {marshBladeGeometry,marshHash} from './blades.ts';
import {marshMaterials,type MarshLight} from './marsh-material.ts';

export type MarshRoot=Readonly<{
 id:number;x:number;y:number;z:number;
 permittedRadius:number;height:number;spread:number;damp:number;age:number;
}>;
export type MarshSeatGuard=(x:number,z:number,radius:number,rootId:number)=>boolean;

export const MARSH_INPUT_LIMIT=360,MARSH_NEAR_LIMIT=104,MARSH_MID_LIMIT=242;
export const MARSH_VISUAL_RADIUS=45,MARSH_MAX_AGL=88;
const CLOSE_CENTRE=16.9, MOMENT_STRETCH=.92, SUN_GUST_MAX=.094;
type Sample=Readonly<MarshRoot&{scale:number;radial:number;yaw:number;rank:number;weather:number;seed:number}>;
type Meshed=Readonly<{
 mesh:T.InstancedMesh; optics:T.InstancedBufferAttribute;triangles:number;
}>;
type Clip='near'|'mid';
type State={
 accepted:number;rejected:number;near:number;mid:number;draws:number;triangles:number;
};
export function marshReach(baseRadius:number,maxVertical:number,spread:number,scaleY:number){
 // Base radius covers every yaw. 5 mm safety pad allows local float32 matrices.
 // Maximum shader gust is < .094m per squared authoring metre.
 return baseRadius*spread+SUN_GUST_MAX*maxVertical**2+.005+scaleY*.004;
}

/** The module consumes positioned, reviewed roots, never invents a fallback or
 * moves height/position. Complete swept envelopes are checked in caller space.
 * A candidate can be made narrower without leaving its approved envelope. */
export class MarshPatch{
 readonly group=new T.Group();
 readonly guard:MarshSeatGuard;
 private readonly material;
 private readonly batch:Readonly<Record<Clip,Meshed>>;
 private readonly frame:T.Vector3;
 private readonly baseRadius:number;
 private readonly maxVertical:number;
 private roots:Sample[]=[];
 private lastX=Infinity;private lastY=Infinity;private lastZ=Infinity;
 private lastAgl=Infinity;
 private accepted=0;private rejected=0;private closed=false;
 private readonly pivot=new T.Object3D();
 private readonly box=new T.Box3();
 constructor(frame:T.Vector3,guard:MarshSeatGuard,light:MarshLight,cast=false){
  if (![frame.x,frame.y,frame.z].every(Number.isFinite)||typeof guard!=='function')throw Error('Marsh frame requires authorization');
  this.guard=guard;this.frame=frame.clone();
  this.material=marshMaterials(light,cast);
  const near=marshBladeGeometry(true),mid=marshBladeGeometry(false);
  this.baseRadius=Math.max(near.maxRadius,mid.maxRadius);
  this.maxVertical=Math.max(near.maxY,mid.maxY);
  const make=(name:string,g:typeof near,max:number):Meshed=>{
   const a=new T.InstancedBufferAttribute(new Float32Array(max*4),4).setUsage(T.DynamicDrawUsage);
   g.geometry.setAttribute('marshLook',a);
   const mesh=new T.InstancedMesh(g.geometry,this.material.forward,max);
   mesh.count=0;mesh.name=name;mesh.position.copy(frame);
   mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   mesh.castShadow=cast;mesh.customDepthMaterial=this.material.depth;
   mesh.visible=false;this.group.add(mesh);
   return{mesh,optics:a,triangles:g.triangles};
  };
  this.batch={near:make('Marsh plants: close curved blades',near,MARSH_NEAR_LIMIT),mid:make('Marsh plants: distant curved blades',mid,MARSH_MID_LIMIT)};
  this.group.name='Marsh vegetation / original geometry';this.group.visible=false;
 }
 admission(rows:readonly MarshRoot[]){
  if(this.closed)throw Error('Marsh patch was released');
  if(rows.length>MARSH_INPUT_LIMIT)throw Error('Marsh candidate cap exceeded');
  const known=new Set<number>(),result:Sample[]=[];
  const approach=this.material.uniforms.marshWind.value;
  const prevailing=Math.atan2(-approach.y,approach.x);
  for(const q of rows){
   if(!Number.isSafeInteger(q.id)||known.has(q.id)||![q.x,q.y,q.z,q.permittedRadius,q.height,q.spread,q.damp,q.age].every(Number.isFinite)||
    Math.abs(q.x-this.frame.x)>256||Math.abs(q.z-this.frame.z)>256||Math.abs(q.y-this.frame.y)>128||
    q.height<.24||q.height>1.40||q.spread<.40||q.spread>1.34||
    q.damp<0||q.damp>1||q.age<0||q.age>1||q.permittedRadius<.34||q.permittedRadius>1.35)continue;
   known.add(q.id);
   const room=marshReach(0,this.maxVertical,0,q.height),scale=Math.min(q.spread,(q.permittedRadius-room)/this.baseRadius);
   if(scale<.36)continue;
   const radial=marshReach(this.baseRadius,this.maxVertical,scale,q.height);
   let allowed=false;
   try{allowed=radial<=q.permittedRadius+1e-8&&this.guard(q.x,q.z,radial,q.id);}catch{/* Exit stays stock. */}
   if(!allowed)continue;
   const swirl=.29*Math.sin(.091*q.x+.12*q.z)+.18*Math.sin(.173*q.x-.132*q.z);
   const align=(marshHash(q.id,96)-.5)*(marshHash(q.id,812)>.79?2.43:1.39);
   result.push({...q,scale,radial,yaw:prevailing+swirl+align,rank:marshHash(q.id,213),weather:marshHash(q.id,71),seed:marshHash(q.id,199)});
  }
  this.roots=result;
  this.accepted=result.length;this.rejected=rows.length-result.length;
  this.lastX=this.lastY=this.lastZ=Infinity;
  // A changed permission list must revoke old mats before the next camera update.
  this.fill('near',[]);this.fill('mid',[]);this.group.visible=false;
  // Tight fixed bounds around the accepted root subset, conservative for both
  // levels, wind and all permitted orientations. No per-frame bound update.
  this.box.makeEmpty();
  for(const q of result){
   this.box.expandByPoint(new T.Vector3(q.x-this.frame.x-q.radial,q.y-this.frame.y-.017,q.z-this.frame.z-q.radial));
   this.box.expandByPoint(new T.Vector3(q.x-this.frame.x+q.radial,q.y-this.frame.y+q.height*this.maxVertical+.012,q.z-this.frame.z+q.radial));
  }
  for(const {mesh}of Object.values(this.batch)){
   mesh.boundingBox=this.box.clone();
   mesh.boundingSphere=this.box.isEmpty()?new T.Sphere(new T.Vector3(),0):this.box.getBoundingSphere(new T.Sphere());
  }
  return {accepted:this.accepted,rejected:this.rejected};
 }
 observe(eye:T.Vector3,agl:number,time:number,strength=.56,enabled=true){
  if(this.closed)return;
  const good=enabled&&[eye.x,eye.y,eye.z,agl,time,strength].every(Number.isFinite)&&agl>=0&&agl<MARSH_MAX_AGL;
  this.group.visible=good&&this.roots.length>0;
  if(!this.group.visible){this.lastX=Infinity;return;}
  const u=this.material.uniforms;u.marshTime.value=time;u.marshAGL.value=agl;u.marshWindStrength.value=T.MathUtils.clamp(strength,0,1);
  if(Math.hypot(eye.x-this.lastX,eye.y-this.lastY,eye.z-this.lastZ)<MOMENT_STRETCH&&Math.abs(this.lastAgl-agl)<.85)return;
  this.lastX=eye.x;this.lastY=eye.y;this.lastZ=eye.z;this.lastAgl=agl;
  const pool=this.roots.map(q=>({q,d:Math.hypot(eye.x-q.x,eye.y-q.y,eye.z-q.z),horizontal:Math.hypot(eye.x-q.x,eye.z-q.z)}))
    .filter(o=>o.horizontal<MARSH_VISUAL_RADIUS).sort((a,b)=>a.d-b.d||a.q.id-b.q.id);
  const high:Sample[]=[],middle:Sample[]=[];
  for(const {q,d}of pool){
   // The threshold is fixed per root, not a dither refreshed with the view.
   if(high.length<MARSH_NEAR_LIMIT&&d<CLOSE_CENTRE+(q.rank-.5)*7.4)high.push(q);
   else if(middle.length<MARSH_MID_LIMIT)middle.push(q);
  }
  this.fill('near',high);this.fill('mid',middle);
 }
 private fill(key:Clip,rows:Sample[]){
  const {mesh,optics}=this.batch[key],v=this.pivot;
  for(let i=0;i<rows.length;i++){
   const q=rows[i];v.position.set(q.x-this.frame.x,q.y-this.frame.y,q.z-this.frame.z);
   v.rotation.set(0,q.yaw,0);v.scale.set(q.scale,q.height,q.scale);v.updateMatrix();
   mesh.setMatrixAt(i,v.matrix);optics.setXYZW(i,q.seed,q.age,q.damp,q.weather);
  }
  mesh.count=rows.length;mesh.visible=!!rows.length;
  mesh.instanceMatrix.needsUpdate=true;optics.needsUpdate=true;
 }
 get state():State{
  const {near,mid}=this.batch;
  const q=this.group.visible?near.mesh.count:0,r=this.group.visible?mid.mesh.count:0;
  return {accepted:this.accepted,rejected:this.rejected,near:q,mid:r,draws:Number(q>0)+Number(r>0),triangles:q*near.triangles+r*mid.triangles};
 }
 get maximum(){
  return {inputs:MARSH_INPUT_LIMIT,close:MARSH_NEAR_LIMIT,mid:MARSH_MID_LIMIT,draws:2,triangles:MARSH_NEAR_LIMIT*this.batch.near.triangles+MARSH_MID_LIMIT*this.batch.mid.triangles};
 }
 dispose(){
  if(this.closed)return;
  this.closed=true;this.group.removeFromParent();
  for(const {mesh}of Object.values(this.batch)){mesh.geometry.dispose();mesh.dispose();}
  this.material.forward.dispose();this.material.depth?.dispose();
  this.group.clear();
 }
}
