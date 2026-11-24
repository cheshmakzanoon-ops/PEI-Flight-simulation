import * as THREE from 'three';
import type {CanopyFence,ReceiverBox} from './canopy-fence.ts';
import type {World} from './world.ts';
import {regularRoadGround} from './road-contact.ts';
import {groundedShadow} from './grounded-tree-shadow.ts';
import {sidewalkGrid} from './sidewalks.ts';
import type {ShadowSlotRoster} from './tree-shadow-roster.ts';

type OldShade=THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
type Tile={key:string;geometry:THREE.BufferGeometry};
type Crown={x:number;y:number;z:number;height:number;width:number;variant:number};
const FADE_FROM=49,FADE_TO=72,WARM_RADIUS=101,RENEW=6,REQUEST_DRIFT=138,LOOK_AHEAD_STEPS=10,LOOK_AHEAD_CAP=54,
  CEIL=46,START_FADE=30,MAX_TRIS=3200,MAX_SLOTS=350,SLICE_MS=1.50,
  SCAN_ATOMS=144,GEOMETRY_ATOMS=29,ADMISSION_ATOMS=27;
const SLOT_ATTR='rollingForestReceiver', varying='rollingForestWeight';
const BANDS=Array.from({length:7},(_,i)=>(i+.5)/7);
const weights=BANDS.flatMap(v=>BANDS.map(u=>{
 const rr=2*Math.hypot(u-.5,v-.5),k=1-THREE.MathUtils.smoothstep(rr,.21,.98);
 return k>.18?k:0;
}));
const f=Math.fround;
export function stockCanopyFootprint(tree:Crown){
 const x=f(.43*1)*tree.height,z=f(.21*1)*tree.height;
 const p=(a:number,b:number,u:number,v:number)=>({
    x:f(tree.x+f(f(x)+f(f(a*tree.width)*f(1.42)))),
    z:f(tree.z+f(f(z)+f(f(b*tree.width)*f(1.19)))),u,v,
 });
 return [p(-.5,-.5,0,0),p(.5,-.5,1,0),p(.5,.5,1,1),p(-.5,.5,0,1)];
}
const cacheBudget=1350;
type Bank={g:THREE.BufferGeometry;pos:THREE.BufferAttribute;uv:THREE.BufferAttribute;attrs:THREE.BufferAttribute;
 slots:Uint16Array;ids:Float32Array;count:number;vertices:number};
function allocate():Bank{
 const b=(width:number)=>new THREE.BufferAttribute(new Float32Array(MAX_TRIS*3*width),width).setUsage(THREE.DynamicDrawUsage);
 const g=new THREE.BufferGeometry(),pos=b(3),uv=b(2),attrs=b(3);
 g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),WARM_RADIUS+55);
 g.setAttribute('position',pos);g.setAttribute('uv',uv);g.setAttribute('shadeSupport',attrs);g.setDrawRange(0,0);
 return {g,pos,uv,attrs,slots:new Uint16Array(MAX_SLOTS),ids:new Float32Array(MAX_SLOTS*6),count:0,vertices:0};
}
const patchVertex=`
 attribute vec3 shadeSupport;
 uniform vec3 receiverFade;
 varying vec2 shadeUV,shadeValue;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
  gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);
  shadeUV=uv;
  shadeValue=vec2(shadeSupport.z,receiverFade.z*(1.-smoothstep(receiverFade.x,receiverFade.y,
      length(shadeSupport.xy-cameraPosition.xz))));
  #include <logdepthbuf_vertex>
 }`;
const patchFragment=`
 uniform sampler2D canopy;
 varying vec2 shadeUV,shadeValue;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
  #include <logdepthbuf_fragment>
  if(shadeValue.y<.00001)discard;
  float r=length((shadeUV-.5)*2.);float ramp=1.-smoothstep(.21,.98,r);if(ramp<.009)discard;
  float mask=texture2D(canopy,vec2((shadeValue.x+shadeUV.x)*.25,.5*shadeUV.y)).a;
  gl_FragColor=vec4(.015,.021,.012,ramp*(.10+.18*mask)*shadeValue.y);
 }`;
type Stamp={x:number;z:number;revision:number;bank:Bank;tiles:Tile[]};
type Draft=Stamp&{pairs:number;pair:number;cursor:number;emptyOwner:boolean;overflow:boolean};
const shadowArgs={side:THREE.DoubleSide,depthWrite:false,transparent:true,blending:THREE.NormalBlending,
 polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2};
export class RollingTreeShadows{
 readonly mask:THREE.InstancedBufferAttribute;
 readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private readonly fade={value:new THREE.Vector3(FADE_FROM,FADE_TO,0)};
 private readonly banks=[allocate(),allocate()] as const;
 private readonly pairs=new Int32Array(32);
 private readonly rebound=new Uint16Array(MAX_SLOTS);
 private readonly stockMaterial:THREE.ShaderMaterial;
 private readonly stockNew:THREE.ShaderMaterial;
 private readonly ground:ReturnType<typeof regularRoadGround>;
 private readonly grid:ReturnType<typeof sidewalkGrid>;
 private readonly eligibility=new Map<string,boolean>();
 private ready?:Stamp;
 private draft?:Draft;
 private dirtyMin:number;private dirtyMax=-1;
 private lastMS=0;private maxMS=0;private built=0;private rejected=0;private late=0;private overBudget=0;private reboundCount=0;private rebindRejected=0;
 private blocked=false;
 private pendingRetryAt=0;
 private primedAt=0;
 private cameraX=NaN;private cameraZ=NaN;private stepX=0;private stepZ=0;
 private readonly scene:THREE.Scene;
 private readonly world:World;
 private readonly fence:CanopyFence;
 private readonly stock:OldShade;
 private constructor(scene:THREE.Scene,world:World,fence:CanopyFence,stock:OldShade,capacity:number){
  this.scene=scene;this.world=world;this.fence=fence;this.stock=stock;
  this.dirtyMin=capacity;
  this.mask=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);
  this.ground=regularRoadGround(world.terrain);this.grid=sidewalkGrid(world.terrain);
  this.stockMaterial=stock.material;
  const m=this.stockMaterial;
  this.stockNew=new THREE.ShaderMaterial({vertexShader:`attribute float ${SLOT_ATTR};uniform vec3 receiverFade;varying float ${varying};\n`+
    m.vertexShader.replace('void main(){',`void main(){ ${varying}=${SLOT_ATTR}*receiverFade.z*
    (1.-smoothstep(receiverFade.x,receiverFade.y,length(stem.xz-cameraPosition.xz)));`),
    fragmentShader:`varying float ${varying};\n`+
     m.fragmentShader.replace('ramp*(.10+.18*mask)',`ramp*(.10+.18*mask)*(1.-${varying})`),
    uniforms:{...m.uniforms,receiverFade:this.fade},...shadowArgs});
  this.mesh=new THREE.Mesh(this.banks[0].g,new THREE.ShaderMaterial({
    uniforms:{canopy:{value:m.uniforms.canopy.value},receiverFade:this.fade},vertexShader:patchVertex,fragmentShader:patchFragment,...shadowArgs}));
  this.mesh.visible=false;this.mesh.frustumCulled=false;this.mesh.renderOrder=stock.renderOrder;
  this.mesh.name='Regular forest shadows reseated on existing near terrain';
  stock.geometry.setAttribute(SLOT_ATTR,this.mask);stock.material=this.stockNew;scene.add(this.mesh);
 }
 static mount(scene:THREE.Scene,world:World,fence:CanopyFence,stock:THREE.Mesh,capacity:number){
  if(!(stock.material instanceof THREE.ShaderMaterial)||!(stock.geometry instanceof THREE.InstancedBufferGeometry)||
     stock.geometry.getAttribute(SLOT_ATTR)||!stock.material.uniforms.canopy?.value||
     !stock.material.vertexShader.includes('vec2 off=vec2(.43,.21)*shape.x;')||
     !stock.material.vertexShader.includes('void main(){')||
     !stock.material.fragmentShader.includes('ramp*(.10+.18*mask)')||
     !Number.isInteger(capacity)||capacity<1||capacity>45000)return;
  return new RollingTreeShadows(scene,world,fence,stock as OldShade,capacity);
 }
 private alive(d:Stamp,roster:ShadowSlotRoster){
  return d.revision===roster.revision&&d.tiles.every(q=>this.world.rollingCanopyStill(q.key,q.geometry));
 }
 private keep(d:Stamp,roster:ShadowSlotRoster,stems:Float32Array,shapes:Float32Array){
  if(d.revision===roster.revision)return this.alive(d,roster);
  if(!d.tiles.every(q=>this.world.rollingCanopyStill(q.key,q.geometry)))return false;
  const b=d.bank,ids=b.ids;
  for(let i=0;i<b.count;i++){
   const k=i*6,s=roster.slotAt(ids[k],ids[k+2]),a=s*3,c=s*4;
   if(s<0||s>=this.mask.count||stems[a]!==ids[k]||stems[a+1]!==ids[k+1]||stems[a+2]!==ids[k+2]||
      shapes[c]!==ids[k+3]||shapes[c+1]!==ids[k+4]||shapes[c+2]!==ids[k+5]){
    this.rebindRejected++;return false;
   }
   this.rebound[i]=s;
  }
  // Atomically remap stock opacity only after every original root, height,
  // width, variant and live terrain geometry is still exactly equal.
  for(let i=0;i<b.count;i++)this.flag(b.slots[i],0);
  for(let i=0;i<b.count;i++){const s=this.rebound[i];b.slots[i]=s;this.flag(s,1);}
  this.commitMask();d.revision=roster.revision;this.reboundCount++;
  return true;
 }
 private flag(i:number,value:number){
  if(this.mask.getX(i)===value)return;
  this.mask.setX(i,value);this.dirtyMin=Math.min(this.dirtyMin,i);this.dirtyMax=Math.max(this.dirtyMax,i);
 }
 private commitMask(){
  if(this.dirtyMax<this.dirtyMin)return;
  this.mask.clearUpdateRanges();this.mask.addUpdateRange(this.dirtyMin,this.dirtyMax-this.dirtyMin+1);this.mask.needsUpdate=true;
  this.dirtyMin=this.mask.count;this.dirtyMax=-1;
 }
 private hide(){
  this.fade.value.z=0;this.mesh.visible=false;
  // Active weights are physically zero. Do not spend an upload clearing
  // them on altitude exit; the next coherent commit clears exact prior slots.
 }
 private track(x:number,z:number){
  const dx=x-this.cameraX,dz=z-this.cameraZ;
  this.cameraX=x;this.cameraZ=z;
  // Estimate streaming lookahead only. It never moves scenery or lets a
  // root beyond the real shader's eye-distance fade become visible.
  if(Number.isFinite(dx+dz)&&Math.hypot(dx,dz)<=24){
   this.stepX=this.stepX*.64+dx*.36;this.stepZ=this.stepZ*.64+dz*.36;
  }else{this.stepX=0;this.stepZ=0;}
 }
 private make(roster:ShadowSlotRoster,x:number,z:number):Draft|undefined{
  const scale=Math.min(LOOK_AHEAD_STEPS,LOOK_AHEAD_CAP/Math.max(.001,Math.hypot(this.stepX,this.stepZ)));
  const aheadX=x+scale*this.stepX,aheadZ=z+scale*this.stepZ;
  if(roster.contains(aheadX,aheadZ,WARM_RADIUS)){x=aheadX;z=aheadZ;}
  const pairs=roster.nearby(x,z,WARM_RADIUS,this.pairs);
  if(pairs<0)return;
  const bank=this.mesh.geometry===this.banks[0].g?this.banks[1]:this.banks[0];
  bank.count=bank.vertices=0;
  return {x,z,revision:roster.revision,bank,pairs,pair:0,cursor:this.pairs[0],tiles:[],emptyOwner:false,overflow:false};
 }
 private land(b:ReceiverBox){
  const t=this.world.terrain,cover=this.world.cover,dx=(t.right-t.left)/t.spec.width,dz=(t.bottom-t.top)/t.spec.height;
  const xr=[b[0],b[2]],zr=[b[1],b[3]];
  for(let i=Math.ceil((b[0]-t.left)/dx-.5);t.left+dx*(i+.5)<b[2];i++)xr.push(t.left+dx*(i+.5));
  for(let j=Math.ceil((b[1]-t.top)/dz-.5);t.top+dz*(j+.5)<b[3];j++)zr.push(t.top+dz*(j+.5));
  for(const x of xr)for(const z of zr)if(cover.distance(t,x,z)<=55)return false;
  return true;
 }
 private issue(tree:Crown,b:ReceiverBox,owner:Tile){
  const key=tree.x+'/'+tree.y+'/'+tree.z+'/'+tree.height+'/'+tree.width+'/'+owner.geometry.id;
  const got=this.eligibility.get(key);if(got!==undefined)return got;
  let result=false;
  if(this.fence.allows(b)&&this.land(b)){
   let broad=0,below=0,above=0,c=0;
   const flat=f(tree.y+f(.46));
   for(const v of BANDS)for(const u of BANDS){
    const w=weights[c++];if(w===0)continue;
    const d=flat-this.ground(b[0]+(b[2]-b[0])*u,b[1]+(b[3]-b[1])*v);
    broad+=w;if(d<-.046)below+=w;if(d>.452)above+=w;
   }
   result=below/broad>=.20||above/broad>=.34;
  }
  if(this.eligibility.size>=cacheBudget)this.eligibility.delete(this.eligibility.keys().next().value!);
  this.eligibility.set(key,result);return result;
 }
 private prepare(d:Draft,roster:ShadowSlotRoster,stems:Float32Array,shapes:Float32Array,start:number){
  let tested=0,emitted=0,scanned=0;
  const active=d.bank;
  while(d.pair<d.pairs){
   if(d.cursor>=this.pairs[d.pair+1]){
    d.pair+=2;
    if(d.pair<d.pairs)d.cursor=this.pairs[d.pair];
    continue;
   }
   if(scanned>=SCAN_ATOMS||tested>=ADMISSION_ATOMS||emitted>=GEOMETRY_ATOMS||
      ((scanned&3)===0&&performance.now()-start>=SLICE_MS))return false;
   scanned++;
   const i=roster.slots[d.cursor++],a=i*3,q=i*4,x=stems[a],z=stems[a+2];
   if((x-d.x)**2+(z-d.z)**2>WARM_RADIUS**2)continue;
   tested++;
   const tree={x,y:stems[a+1],z,height:shapes[q],width:shapes[q+1],variant:shapes[q+2]};
   if(!Number.isFinite(x+z+tree.y+tree.height+tree.width)||tree.height<1||tree.height>30||
      tree.width<1||tree.width>35.41||!Number.isInteger(tree.variant)||tree.variant<0||tree.variant>3)continue;
   const p=stockCanopyFootprint(tree),[s,,t]=p,b:ReceiverBox=[s.x,s.z,t.x,t.z];
   const owner=this.world.rollingCanopyOwner(b);if(!owner){d.emptyOwner=true;continue;}
   if(!this.issue(tree,b,owner))continue;
   if(active.count>=MAX_SLOTS){d.overflow=true;return true;}
   const begin=active.vertices;
   groundedShadow(tree,this.grid,this.ground,(X,Y,Z,u,v,k)=>{
    if(active.vertices>=MAX_TRIS*3){d.overflow=true;return;}
    const n=active.vertices++;
    active.pos.setXYZ(n,X,Y,Z);active.uv.setXY(n,u,v);active.attrs.setXYZ(n,x,z,k);
   },p);
   if(d.overflow)return true;
   if(active.vertices===begin)continue;
   emitted++;
   const k=active.count*6;
   active.ids[k]=x;active.ids[k+1]=tree.y;active.ids[k+2]=z;
   active.ids[k+3]=tree.height;active.ids[k+4]=tree.width;active.ids[k+5]=tree.variant;
   active.slots[active.count++]=i;
   if(!d.tiles.some(q=>q.geometry===owner.geometry))d.tiles.push(owner);
  }
  return true;
 }
 private publish(d:Draft,now:number){
  const old=this.ready?.bank,bank=d.bank;
  if(old)for(let k=0;k<old.count;k++)this.flag(old.slots[k],0);
  for(let k=0;k<bank.count;k++)this.flag(bank.slots[k],1);
  this.commitMask();
  if(bank.vertices)for(const a of [bank.pos,bank.uv,bank.attrs]){
   a.clearUpdateRanges();a.addUpdateRange(0,bank.vertices*a.itemSize);a.needsUpdate=true;
  }
  bank.g.setDrawRange(0,bank.vertices);bank.g.boundingSphere!.center.set(d.x,this.ground(d.x,d.z),d.z);this.mesh.geometry=bank.g;
  if(!this.ready||this.fade.value.z===0)this.primedAt=now;
  this.ready=d;this.built++;
 }
 update(roster:ShadowSlotRoster,stems:Float32Array,shapes:Float32Array,x:number,z:number,agl:number){
  const start=performance.now(),strength=1-THREE.MathUtils.smoothstep(agl,START_FADE,CEIL);
  this.lastMS=0;
  if(!Number.isFinite(x+z+agl)||this.blocked||strength<=0||!roster.contains(x,z,WARM_RADIUS)||!this.stock.visible||
     this.stock.material!==this.stockNew||this.stock.geometry.getAttribute(SLOT_ATTR)!==this.mask){
   this.hide();this.draft=undefined;return;
  }
  this.track(x,z);
  // Motion cannot invalidate a still-authenticated seat. Its per-stem
  // world-distance fade already protects the optical exit; newly approached
  // trees temporarily keep stock while a closer bank is prepared.
  let live=!!this.ready&&this.keep(this.ready,roster,stems,shapes);
  if(!live)this.hide();
  if(this.draft&&(this.draft.revision!==roster.revision||Math.hypot(x-this.draft.x,z-this.draft.z)>REQUEST_DRIFT)){
   this.draft=undefined;this.late++;
  }
  if(!this.draft&&start>=this.pendingRetryAt&&(!live||Math.hypot(x-this.ready!.x,z-this.ready!.z)>RENEW))
   this.draft=this.make(roster,x,z);
  const d=this.draft,done=d&&this.prepare(d,roster,stems,shapes,start);
  let elapsed=performance.now()-start;
  if(elapsed>8){
   // A detected long pause keeps this optional layer stock for the session.
   this.overBudget++;this.blocked=true;this.hide();this.draft=undefined;
  }else if(d&&done){
   this.draft=undefined;
   if(!d.overflow&&d.bank.count&&this.alive(d,roster)){
    this.publish(d,start);live=true;
   }else if(!d.overflow&&!d.emptyOwner&&this.alive(d,roster)){
    this.publish(d,start);live=true;
   }else {
    this.rejected++;this.pendingRetryAt=start+140;
   }
   elapsed=performance.now()-start;
   if(elapsed>8){this.overBudget++;this.blocked=true;this.hide();}
  }
  if(!this.blocked&&live){
   this.fade.value.z=strength*THREE.MathUtils.smoothstep(start-this.primedAt,0,130);
   const q=this.ready!.bank;
   this.mesh.visible=false;
   if(this.fade.value.z>0)for(let i=0;i<q.count;i++){
    const k=q.slots[i]*3;
    if((x-stems[k])**2+(z-stems[k+2])**2<FADE_TO**2){this.mesh.visible=true;break;}
   }
  }
  this.lastMS=elapsed;this.maxMS=Math.max(elapsed,this.maxMS);
 }
 get state(){return {active:this.mesh.visible,pending:!!this.draft,ready:!!this.ready,
   strength:this.fade.value.z,receivers:this.mesh.visible?this.ready?.bank.count??0:0,
   tris:this.mesh.visible?(this.ready?.bank.vertices??0)/3:0,lastSliceMS:this.lastMS,
   worstSliceMS:this.maxMS,overBudget:this.overBudget,blocked:this.blocked,builds:this.built,late:this.late,rejected:this.rejected,slotRebinds:this.reboundCount,slotRebindDeclines:this.rebindRejected};}
 dispose(){
  this.hide();this.scene.remove(this.mesh);this.banks.forEach(a=>a.g.dispose());this.mesh.material.dispose();
  if(this.stock.material===this.stockNew)this.stock.material=this.stockMaterial;
  if(this.stock.geometry.getAttribute(SLOT_ATTR)===this.mask)this.stock.geometry.deleteAttribute(SLOT_ATTR);
  this.stockNew.dispose();
 }
}
export {loadCanopyFence,canopyFenceMatches} from './canopy-fence.ts';
export {ShadowSlotRoster} from './tree-shadow-roster.ts';
