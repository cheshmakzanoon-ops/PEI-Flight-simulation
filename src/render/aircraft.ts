import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {makePropeller} from './propeller.ts';
import {SURVEY_AIRFRAME} from '../sim/flight.ts';
import { DIALS, dialAngle, altimeterAngles } from './instruments.ts';
import { createRudder } from './rudder.ts';
import { surveyedCowlingFinish } from './cowling-finish.ts';
import { createCockpitTrim } from './cockpit-trim.ts';
import { addFlightSurface, deflectionTarget, type SurfaceInput } from './flight-surfaces.ts';

/** Original high-wing survey aircraft. Local +Y up, -Z forward. All dimensions in metres. */
export function createAircraft() {
 const root=new THREE.Group(); root.name='Island Air • Survey 01';
 const mat=(color:number,roughness=.55,metalness=.2)=>new THREE.MeshStandardMaterial({color,roughness,metalness,side:THREE.DoubleSide});
 const pearl=mat(0xe2dfcf,.39,.34), ivory=mat(0xf3efe3,.35,.26), teal=mat(0x17606a,.36,.37),
 ochre=mat(0xe0a65f,.43,.30),dark=mat(0x273638,.59,.22),rubber=mat(0x1b2427,.88,.04),
 glass=new THREE.MeshPhysicalMaterial({color:0x34545b,roughness:.14,metalness:.28,clearcoat:1,clearcoatRoughness:.07,side:THREE.DoubleSide});
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent=root)=>{
   const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
 };
 function bar(a:number[],b:number[],rad:number,m:THREE.Material,parent=root){
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
  const o=mesh(new THREE.CylinderGeometry(rad,rad,d.length(),8),m,parent);
  o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;
 }
 function poly(p:number[][],m:THREE.Material,parent=root) {
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));
   const indices:number[]=[];for(let i=1;i<p.length-1;i++)indices.push(0,i,i+1);g.setIndex(indices);g.computeVertexNormals();return mesh(g,m,parent);
 }
 function blob(px:number,py:number,pz:number,sx:number,sy:number,sz:number,m:THREE.Material){
   const o=mesh(new THREE.SphereGeometry(1,20,12),m);o.scale.set(sx,sy,sz);o.position.set(px,py,pz);return o;
 }
 // Model the tire as a wide tread and two sidewalls instead of an exposed torus.
 // Keep the contact radius independent of hub trim so it matches the sim datum.
 const alloy=mat(0xb9c0c0,.34,.65), brakeSteel=mat(0x535c5f,.50,.72), tread=mat(0x141719,.93,.03);
 function wheel(x:number,y:number,z:number,r:number,width:number,nose=false) {
   const group=new THREE.Group(); group.name=nose?'Nose wheel':'Main wheel';root.add(group);
   group.position.set(x,y,z);group.rotation.z=Math.PI/2;
   const profile=[[.49,-.46],[.63,-.49],[.79,-.49],[.91,-.44],[.974,-.34],[1,-.24],[1,.24],[.974,.34],[.91,.44],[.79,.49],[.63,.49],[.49,.46]]
     .map(([radius,offset])=>new THREE.Vector2(radius*r,offset*width));
   mesh(new THREE.LatheGeometry(profile,32),rubber,group);
   for(const offset of [-.18,0,.18]) {
    const groove=mesh(new THREE.TorusGeometry(r*.99,.002,5,32),tread,group);
    groove.rotation.x=Math.PI/2;groove.position.y=offset*width;
   }
   mesh(new THREE.CylinderGeometry(r*.57,r*.57,width*.86,24),brakeSteel,group);
   for(const sign of [-1,1]){
    const face=mesh(new THREE.CylinderGeometry(r*.51,r*.56,width*.12,24),alloy,group);
    face.position.y=sign*width*.46;
    const cap=mesh(new THREE.CylinderGeometry(r*.22,r*.25,width*.14,16),dark,group);
    cap.position.y=sign*width*.54;
    for(let i=0;i<5;i++){
     const a=i*Math.PI*2/5,bolt=mesh(new THREE.CylinderGeometry(r*.041,r*.041,width*.055,6),brakeSteel,group);
     bolt.position.set(Math.cos(a)*r*.36,sign*width*.535,Math.sin(a)*r*.36);
    }
   }
   // The assembly is rigid. Collapse trim/fasteners to one draw per material.
   const pieces=new Map<THREE.Material,THREE.BufferGeometry[]>();
   for(const o of [...group.children] as THREE.Mesh<THREE.BufferGeometry,THREE.Material>[]) {
    o.updateMatrix();o.geometry.applyMatrix4(o.matrix);
    const list=pieces.get(o.material)??[];list.push(o.geometry);pieces.set(o.material,list);
    group.remove(o);
   }
   for(const [material,list] of pieces){
    const merged=mergeGeometries(list);
    if(merged){mesh(merged,material,group);if(merged!==list[0])for(const g of list)g.dispose();}
    else for(const g of list)mesh(g,material,group);
   }
   return group;
 }
 function navLens(x:number,y:number,z:number,color:number) {
   const shell=new THREE.MeshPhysicalMaterial({color,emissive:color,emissiveIntensity:.55,roughness:.22,clearcoat:1});
   const lens=blob(x,y,z,.065,.038,.092,shell);
   lens.castShadow=false;lens.receiveShadow=false;
 }
 // [longitudinal station, half-width, centre height, half-height].
 const rings=[[-3.98,.35,-.06,.30],[-3.66,.55,-.01,.45],[-3.1,.62,.00,.58],[-2.0,.67,.08,.66],[-1.34,.72,.16,.74],[-.76,.74,.29,.90],[.34,.74,.29,.91],[1.28,.67,.23,.78],[2.04,.53,.17,.62],[3,.35,.12,.44],[4.4,.16,.09,.23],[5.32,.079,.10,.13],[5.55,.017,.12,.04]];
 const sides=32;const arr:number[]=[],ind:number[]=[];
 for(const [z,w,cy,h] of rings){for(let j=0;j<sides;j++){const a=j*2*Math.PI/sides,cs=Math.cos(a),sn=Math.sin(a);
 arr.push(w*Math.sign(cs)*Math.pow(Math.abs(cs),.80),cy+h*Math.sign(sn)*Math.pow(Math.abs(sn),.82),z);}}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;ind.push(a,b,a+sides,b,b+sides,a+sides);}
 // The smaller measured spinner no longer covers the whole first hull ring.
 // Close the cowling with its own face normals instead of exposing an open shell.
 const rim=arr.length/3;arr.push(...arr.slice(0,sides*3));
 const noseCentre=arr.length/3;arr.push(0,rings[0][2],rings[0][0]);
 for(let j=0;j<sides;j++)ind.push(noseCentre,rim+(j+1)%sides,rim+j);
 const hullG=new THREE.BufferGeometry();hullG.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));hullG.setIndex(ind);hullG.computeVertexNormals();mesh(hullG,pearl);
 // Follow the same hull cross sections used by the renderer so glazing does not cut through
 // exterior paint. A short standoff represents the thickness of the window frame.
 function skin(z:number){let i=0;while(i<rings.length-2&&z>rings[i+1][0])i++;
  const a=rings[i],b=rings[i+1],t=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
  return [THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t),THREE.MathUtils.lerp(a[3],b[3],t)];
 }
 const sideSkin=(s:number,y:number,z:number,lift=.014)=>{const [w,cy,h]=skin(z);
  const fraction=Math.min(1,Math.abs((y-cy)/h));
  return [s*(w*(1-fraction**(2/.82))**.40+lift),y,z];
 };
 const topSkin=(s:number,u:number,z:number,lift=.014)=>{const [w,cy,h]=skin(z);
  return [s*w*u,cy+h*(1-u**(2/.80))**.41+lift,z];
 };
 function windowPatch(point:(u:number,v:number,lift?:number)=>number[],omitEdge=-1) {
  const n=12,pos:number[]=[],indices:number[]=[];
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++)pos.push(...point(i/n,j/n));
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();
  const glazed=mesh(g,glass);glazed.castShadow=false;
  // Batch the four curved frame segments into one opaque trim mesh.
  const parts:THREE.BufferGeometry[]=[];
  const path=(u:number,v:number)=>new THREE.Vector3(...point(u,v,.019));
  for(let edge=0;edge<4;edge++){
   if(edge===omitEdge)continue;
   const ps:THREE.Vector3[]=[];
   for(let i=0;i<=n;i++){const t=i/n;ps.push(edge===0?path(t,0):edge===1?path(1,t):edge===2?path(t,1):path(0,t));}
   parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps),n,.012,5,false));
  }
  const frame=mergeGeometries(parts);
  if(frame){mesh(frame,ivory);for(const g of parts)g.dispose();}
 }
 // Side livery bands hug the actual fuselage cross section.
 for(const side of [-1,1]){
   for(const [lo,hi,color] of [[-.065,.09,teal],[.11,.14,ochre]] as const){
    let last:number[][]|undefined;
    for(const [z,w,cy,h] of rings.slice(1,-1)){
     const q=(y:number)=>[side*(w*Math.pow(Math.max(0,1-Math.pow(Math.abs((y-cy)/h),2/.82)),.4)+.006),y,z];
     const base=.044+.012*z,cur=[q(base+lo*Math.min(1,w/.38)), q(base+hi*Math.min(1,w/.38))];
     if(last)poly([last[0],cur[0],cur[1],last[1]],color);last=cur;
    }
   }
   // Side glazing is parameterized on the cabin cross section, not flat plates.
   const panels=[
    [[.39,-1.50],[1.00,-.76],[1.01,-.13],[.39,-.15]],
    [[.39,-.065],[1.01,-.05],[.99,.59],[.39,.57]],
    [[.40,.67],[.97,.66],[.89,1.18],[.41,1.40]]
   ];
   for(const a of panels){
    windowPatch((u,v,lift)=>{
     const q=(i:number)=>THREE.MathUtils.lerp(THREE.MathUtils.lerp(a[0][i],a[3][i],u),THREE.MathUtils.lerp(a[1][i],a[2][i],u),v);
     return sideSkin(side,q(0),q(1),lift);
    });
   }
   bar([side*.735,.23,-.17],[side*.734,.24,-.40],.019,dark);
   // Windshield follows the rising cowling stations; this avoids light-colored
   // hull patches cutting through the glass in close outside camera views.
   windowPatch((u,v,lift)=>topSkin(side,u*THREE.MathUtils.lerp(.89,.64,v),THREE.MathUtils.lerp(-1.82,-.78,v),lift),side===1?3:-1);
 }
 // NACA-like closed airfoil sections with washout, taper and swept tips.
 function wing(side:number,sections:number[][],material:THREE.Material) {
   const vs:number[]=[],ix:number[]=[];const samples=20,pointCount=2*samples;
   for(const [span,y,leading,chord,thick,twist] of sections){
    for(let k=0;k<pointCount;k++){const front=k<=samples,t=front?k/samples:(pointCount-k)/samples;
     const alpha=.5-.5*Math.cos(t*Math.PI),th=5*thick*(.2969*Math.sqrt(alpha)-.126*alpha-.3516*alpha**2+.2843*alpha**3-.1036*alpha**4);
     vs.push(span*side,y+chord*((front?th:-th)+.02*Math.sin(Math.PI*alpha)+twist*alpha),leading+chord*alpha);}
   }
   for(let s=0;s<sections.length-1;s++)for(let k=0;k<pointCount;k++){const a=s*pointCount+k,b=s*pointCount+(k+1)%pointCount;ix.push(a,a+pointCount,b,b,a+pointCount,b+pointCount);}
   const last=(sections.length-1)*pointCount;for(let k=1;k<pointCount-1;k++)ix.push(last,last+k,last+k+1);
   if(side>0){for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();mesh(g,material);
 }
 const outlines=[[.03,1.17,-1.22,1.98,.095,-.025],[.80,1.17,-1.25,2.00,.095,-.025],[2.5,1.21,-1.22,1.93,.093,-.025],[4.35,1.28,-1.13,1.70,.085,-.040],[5.64,1.34,-.98,1.32,.083,-.055],[5.97,1.37,-.79,.97,.078,-.06]];
 const controls:{side:number;aileron:ReturnType<typeof addFlightSurface>;elevator:ReturnType<typeof addFlightSurface>}[]=[];
 for(const side of [-1,1]){
  wing(side,outlines.slice(0,4),ivory);
  wing(side,[[5.97,1.37,-.79,.97,.078,-.06],[6.13,1.39,-.52,.5,.06,-.06],[6.17,1.405,-.39,.2,.05,-.06]],teal);
  const aileron=addFlightSurface(root,side,outlines.slice(3),ivory,.73,side<0?'Port aileron':'Starboard aileron');
  const elevator=addFlightSurface(root,side,[[.06,.17,3.75,1.32,.08,-.01],[1.28,.20,4.00,1.13,.075,-.01],[2.22,.26,4.27,.75,.07,-.015],[2.33,.27,4.42,.48,.065,-.015]],ivory,.68,side<0?'Port elevator':'Starboard elevator');
  controls.push({side,aileron,elevator});
  bar([side*.58,-.31,-.80],[side*3.74,1.26,-.50],.058,pearl);
  bar([side*.55,-.30,.34],[side*3.74,1.26,-.46],.043,pearl);
  // Spring-steel main gear, axle mount and hydraulic line.
  const mainTop=[side*.53,-.30,.53],mainBend=[side*.95,-.82,.57],axleEnd=[side*1.25,-1.09,.55];
  bar(mainTop,mainBend,.072,pearl);bar(mainBend,axleEnd,.051,pearl);
  bar([side*.58,-.34,.65],[side*.94,-.81,.66],.013,dark);
  bar([side*.94,-.81,.66],[side*1.13,-1.08,.65],.012,dark);
  wheel(...([side*1.25,-1.09,.55,.31,.155] as const));
  blob(side*.57,-.03,-3.15,.08,.12,.26,dark);
  // Aircraft left is red; aircraft right is green, viewed in the direction of flight.
  navLens(side*6.14,1.407,-.51,side<0?0xb92326:0x21985e);
 }
 // Exposed steering strut, bright oleo piston and two-sided wheel fork.
 bar([0,-.24,-2.92],[0,-.79,-2.63],.069,pearl);
 bar([0,-.74,-2.65],[0,-.99,-2.54],.043,alloy);
 for(const side of [-1,1]){
  bar([0,-.94,-2.55],[side*.084,-1.01,-2.57],.034,brakeSteel);
  bar([side*.084,-1.01,-2.57],[side*.084,-1.15,-2.53],.032,pearl);
 }
 wheel(0,-1.15,-2.53,.25,.123,true);
 // Separate closed tail and aft control. Colors stay attached across the hinge.
 const rudder=createRudder(root,teal,ochre,pearl);
 navLens(0,.18,5.52,0xffecd1);
 const {prop,propDisc,spinner,setProp}=makePropeller(SURVEY_AIRFRAME.gearHeightM);
 root.add(spinner,prop,propDisc);
 // Original cockpit framing and analog gauge deck used in the pilot camera.
 const cockpit=new THREE.Group();root.add(cockpit);
 createCockpitTrim(cockpit);
 for(const s of [-1,1]){bar([.59*s,.39,-1.35],[.46*s,1.01,-.80],.031,dark,cockpit);}
 const needles:THREE.Group[]=[];
 let altitudeHands:THREE.Group[]=[];
 const bezelMat=mat(0x232628,.44,.62),screwMat=mat(0x93999a,.39,.78);
 const makeGauge=(i:number)=>{
  const dial=DIALS[i],c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d')!;ctx.translate(128,128);
  const fill=ctx.createRadialGradient(-24,-29,5,0,0,126);
  fill.addColorStop(0,'#222626');fill.addColorStop(.82,'#101313');fill.addColorStop(1,'#060708');
  ctx.fillStyle=fill;ctx.fillRect(-128,-128,256,256);
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(let v=dial.min;v<=dial.max;v+=dial.minor){
   if(dial.cyclic&&v===dial.max)break;
   const a=dialAngle(dial,v),x=Math.sin(a),y=-Math.cos(a),major=(v-dial.min)%dial.major===0;
   ctx.strokeStyle=major?'#f4efdb':'#9a9f95';ctx.lineWidth=major?3:1.5;
   ctx.beginPath();ctx.moveTo(x*110,y*110);ctx.lineTo(x*(major?94:103),y*(major?94:103));ctx.stroke();
   if(major){ctx.fillStyle='#ece6d4';ctx.font='600 18px sans-serif';ctx.fillText(dial.display?.(v)??String(v),x*80,y*80);}
  }
  ctx.fillStyle='#dfd9c5';ctx.font='600 14px sans-serif';ctx.fillText(dial.title,0,-27);
  ctx.fillStyle='#a8afa4';ctx.font='11px sans-serif';ctx.fillText(dial.unit,0,32);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const o=mesh(new THREE.CircleGeometry(.076,48),new THREE.MeshBasicMaterial({map:tex}),cockpit);
  o.position.set((i-1.5)*.175,.416,-1.185);
  const bezel=mesh(new THREE.TorusGeometry(.076,.006,10,48),bezelMat,cockpit);
  bezel.position.copy(o.position);bezel.position.z+=.002;
  const needle=new THREE.Group();needle.position.copy(o.position);needle.position.z+=.007;cockpit.add(needle);
  poly([[-.005,-.018,0],[.005,-.018,0],[.0014,.063,0],[-.0014,.063,0]],new THREE.MeshBasicMaterial({color:0xffdfaa,side:THREE.DoubleSide}),needle);
  const hub=mesh(new THREE.SphereGeometry(.007,10,6),bezelMat,needle);hub.position.z=.002;
  if(i===1){
   const thousands=new THREE.Group(),tenThousands=new THREE.Group();
   for(const [alt,z] of [[thousands,.005],[tenThousands,.0035]] as const){
    alt.position.copy(o.position);alt.position.z+=z;cockpit.add(alt);
   }
   const white=new THREE.MeshBasicMaterial({color:0xf2e6cd,side:THREE.DoubleSide});
   const pale=new THREE.MeshBasicMaterial({color:0xcac4b4,side:THREE.DoubleSide});
   // The narrow outer pointer identifies decades without hiding numerals;
   // the short, broad thousands pointer stays inside the long hundreds hand.
   poly([[-.007,-.008,0],[.007,-.008,0],[.006,.027,0],[0,.046,0],[-.006,.027,0]],white,thousands);
   poly([[-.001,-.01,0],[.001,-.01,0],[.001,.058,0],[-.001,.058,0]],pale,tenThousands);
   poly([[-.006,.063,0],[.006,.063,0],[0,.054,0]],pale,tenThousands);
   altitudeHands=[needle,thousands,tenThousands];
  }
  needles.push(needle);
 };
 for(let i=0;i<DIALS.length;i++)makeGauge(i);
 for(const x of [-.49,.49])for(const y of [.30,.46]){
  const screw=mesh(new THREE.SphereGeometry(.006,8,5),screwMat,cockpit);
  screw.position.set(x,y,-1.187);screw.scale.z=.45;
 }
 const cockpitOnly=new THREE.Group();cockpit.add(cockpitOnly);
 // The visible pilot dome follows the original transforms and collision
 // clearances. Only the lookup coordinates are mapped into the outer body.
 const noseDatum={scale:new THREE.Vector3(.62,.56,1.40),offset:new THREE.Vector3(0,-.01,-2.65)};
 const nose=mesh(new THREE.SphereGeometry(1,20,12),surveyedCowlingFinish(pearl,noseDatum),cockpitOnly);
 nose.position.copy(noseDatum.offset);nose.scale.copy(noseDatum.scale);
 for(const k of [-1,1]){bar([k*.62,.35,-1.30],[k*.51,1.06,-.74],.031,pearl,cockpitOnly);}
 let previousInside:boolean|undefined;
 function setControls(input:SurfaceInput & {yaw?:number},dt:number){
  rudder.update(input.yaw??0,dt);
  for(const c of controls){
   const a=deflectionTarget(input,c.side);
   c.aileron.update(a.aileron,dt);c.elevator.update(a.elevator,dt);
  }
 }
 function setAltitude(feet:number){
  const angles=altimeterAngles(feet);
  altitudeHands.forEach((p,i)=>{p.rotation.z=angles[i];});
 }
 return {root,prop,cockpit,needles,setControls,setAltitude,altitudeAngles:()=>altitudeHands.map(p=>p.rotation.z),rudderAngle:rudder.angle,controlAngles:()=>controls.map(c=>[c.aileron.angle(),c.elevator.angle()]),setInterior(on:boolean){if(on===previousInside)return;previousInside=on;for(const child of root.children)child.visible=!on||child===cockpit||child===prop||child===propDisc;cockpit.visible=on;},
 setProp};
}
