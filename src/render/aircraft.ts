import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIALS, dialAngle } from './instruments.ts';

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
 const hullG=new THREE.BufferGeometry();hullG.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));hullG.setIndex(ind);hullG.computeVertexNormals();mesh(hullG,pearl);
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
   const panels=[
    [[.685,.37,-1.65],[.505,1.00,-.78],[.658,1.00,-.13],[.745,.37,-.15]],
    [[.75,.37,-.065],[.66,1.01,-.05],[.643,.99,.59],[.74,.38,.57]],
    [[.737,.39,.67],[.636,.97,.66],[.59,.89,1.18],[.675,.40,1.42]]
   ];
   for(const pp of panels){const p=pp.map(([x,y,z])=>[side*(x+.013),y,z]);poly(p,glass);p.forEach((a,i)=>bar(a,p[(i+1)%p.length],.022,ivory));}
   bar([side*.735,.23,-.17],[side*.734,.24,-.40],.019,dark);
   // Windshield comes down to the cowl; split panes share a centre post.
   const wind=[[side*.68,.37,-1.65],[side*.505,1,-.78],[0,1.19,-.73],[0,.79,-1.82]];
   poly(wind,glass);
   for(let i=0;i<wind.length;i++)bar(wind[i],wind[(i+1)%wind.length],.018,pearl);
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
 for(const side of [-1,1]){
  wing(side,outlines,ivory);wing(side,[[5.97,1.37,-.79,.97,.078,-.06],[6.13,1.39,-.52,.5,.06,-.06],[6.17,1.405,-.39,.2,.05,-.06]],teal);
  wing(side,[[.06,.17,3.75,1.32,.08,-.01],[1.28,.20,4.00,1.13,.075,-.01],[2.22,.26,4.27,.75,.07,-.015],[2.33,.27,4.42,.48,.065,-.015]],ivory);
  bar([side*.58,-.31,-.80],[side*3.74,1.26,-.50],.058,pearl);
  bar([side*.55,-.30,.34],[side*3.74,1.26,-.46],.043,pearl);
  bar([side*2.72,1.30,.33],[side*5.40,1.34,.15],.014,dark);
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
 // Swept vertical tail with two-sided enclosed shell and rudder paint.
 const tail=[[0,.11,3.30],[0,.68,3.93],[0,1.94,4.66],[0,2.0,5.07],[0,1.79,5.34],[0,.18,5.43]];
 for(const side of [-1,1]){const p=tail.map(([,y,z])=>[side*(.09-.026*y),y,z]);poly(p,teal);
 poly([[side*.069,1.15,4.20],[side*.060,1.45,4.36],[side*.059,1.46,5.36],[side*.067,1.19,5.38]],ochre);
 poly([[side*.055,1.69,4.51],[side*.047,1.94,4.66],[side*.048,2.0,5.07],[side*.052,1.75,5.34]],pearl);
 p.forEach((a,i)=>{const b=p[(i+1)%p.length];if(side===1)poly([a,b,[-b[0],b[1],b[2]],[-a[0],a[1],a[2]]],teal);});
 }
 navLens(0,.18,5.52,0xffecd1);
 const spinner=mesh(new THREE.ConeGeometry(.35,.64,24),teal);spinner.rotation.x=-Math.PI/2;spinner.position.set(0,-.06,-4.23);
 const prop=new THREE.Group();prop.position.set(0,-.06,-4.02);root.add(prop);
 for(let i=0;i<3;i++){const blade=new THREE.Group();blade.rotation.z=i*2*Math.PI/3;prop.add(blade);
   poly([[-.04,.25,0],[-.10,.68,.01],[-.15,1.16,.05],[-.02,1.26,.06],[.075,.92,.02],[.08,.45,0]],dark,blade);
   poly([[-.15,1.16,.054],[-.025,1.265,.065],[.01,1.20,.058],[-.135,1.10,.049]],ochre,blade);
 }
 const discCanvas=document.createElement('canvas');discCanvas.width=discCanvas.height=192;const ds=discCanvas.getContext('2d')!;
 ds.translate(96,96);for(let i=0;i<48;i++){const r=24+i*1.46;
 ds.strokeStyle='rgba(18,29,30,'+(.035+.026*(.5+.5*Math.sin(i*.65)))+')';ds.lineWidth=1.75;ds.beginPath();ds.arc(0,0,r,0,Math.PI*2);ds.stroke();}
 for(let b=0;b<3;b++)for(let j=0;j<35;j++){const a=b*Math.PI*2/3+j*.030;ds.strokeStyle='rgba(52,56,52,'+(Math.sin(j/35*Math.PI)*.028)+')';ds.lineWidth=2;
 ds.beginPath();ds.moveTo(Math.cos(a)*30,Math.sin(a)*30);ds.lineTo(Math.cos(a+.04)*89,Math.sin(a+.04)*89);ds.stroke();}
 const blurMap=new THREE.CanvasTexture(discCanvas);blurMap.colorSpace=THREE.SRGBColorSpace;
 const propDisc=mesh(new THREE.PlaneGeometry(2.6,2.6),new THREE.MeshBasicMaterial({map:blurMap,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
 propDisc.position.copy(prop.position);
 // Original cockpit framing and analog gauge deck used in the pilot camera.
 const cockpit=new THREE.Group();root.add(cockpit);
 const dash=mesh(new THREE.BoxGeometry(1.13,.24,.26),dark,cockpit);dash.position.set(0,.37,-1.32);
 for(const s of [-1,1]){bar([.59*s,.39,-1.35],[.46*s,1.01,-.80],.031,dark,cockpit);}
 const needles:THREE.Group[]=[];
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
  needles.push(needle);
 };
 for(let i=0;i<DIALS.length;i++)makeGauge(i);
 for(const x of [-.49,.49])for(const y of [.30,.46]){
  const screw=mesh(new THREE.SphereGeometry(.006,8,5),screwMat,cockpit);
  screw.position.set(x,y,-1.187);screw.scale.z=.45;
 }
 const cockpitOnly=new THREE.Group();cockpit.add(cockpitOnly);
 const nose=mesh(new THREE.SphereGeometry(1,20,12),pearl,cockpitOnly);nose.position.set(0,-.01,-2.65);nose.scale.set(.62,.56,1.40);
 for(const k of [-1,1]){bar([k*.62,.35,-1.30],[k*.51,1.06,-.74],.031,pearl,cockpitOnly);}
 let previousInside:boolean|undefined;
 return {root,prop,cockpit,needles,setInterior(on:boolean){if(on===previousInside)return;previousInside=on;for(const child of root.children)child.visible=!on||child===cockpit||child===prop||child===propDisc;cockpit.visible=on;},
 setProp(power:number){const blur=power>.15;prop.visible=!blur;propDisc.visible=blur;propDisc.rotation.z=prop.rotation.z*.32;}};
}
