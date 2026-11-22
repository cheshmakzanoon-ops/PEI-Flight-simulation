import * as THREE from 'three';

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
  bar([side*.52,-.24,.45],[side*1.24,-.99,.54],.082,pearl);
  bar([side*.52,-.31,.92],[side*1.24,-.99,.54],.051,teal);
  const tire=mesh(new THREE.TorusGeometry(.225,.084,10,24),rubber);tire.rotation.y=Math.PI/2;tire.position.set(side*1.25,-1.06,.54);
  const axle=mesh(new THREE.CylinderGeometry(.145,.145,.12,16),dark);axle.rotation.z=Math.PI/2;axle.position.copy(tire.position);
  blob(side*.57,-.03,-3.15,.08,.12,.26,dark);
 }
 bar([0,-.24,-2.9],[0,-1.02,-2.55],.061,pearl);
 const noseWheel=mesh(new THREE.TorusGeometry(.18,.067,9,20),rubber);noseWheel.rotation.y=Math.PI/2;noseWheel.position.set(0,-1.12,-2.55);
 // Swept vertical tail with two-sided enclosed shell and rudder paint.
 const tail=[[0,.11,3.30],[0,.68,3.93],[0,1.94,4.66],[0,2.0,5.07],[0,1.79,5.34],[0,.18,5.43]];
 for(const side of [-1,1]){const p=tail.map(([,y,z])=>[side*(.09-.026*y),y,z]);poly(p,teal);
 poly([[side*.069,1.15,4.20],[side*.060,1.45,4.36],[side*.059,1.46,5.36],[side*.067,1.19,5.38]],ochre);
 poly([[side*.055,1.69,4.51],[side*.047,1.94,4.66],[side*.048,2.0,5.07],[side*.052,1.75,5.34]],pearl);
 p.forEach((a,i)=>{const b=p[(i+1)%p.length];if(side===1)poly([a,b,[-b[0],b[1],b[2]],[-a[0],a[1],a[2]]],teal);});
 }
 const spinner=mesh(new THREE.ConeGeometry(.35,.64,24),teal);spinner.rotation.x=-Math.PI/2;spinner.position.set(0,-.06,-4.23);
 const prop=new THREE.Group();prop.position.set(0,-.06,-4.02);root.add(prop);
 for(let i=0;i<3;i++){const blade=new THREE.Group();blade.rotation.z=i*2*Math.PI/3;prop.add(blade);
   poly([[-.04,.25,0],[-.10,.68,.01],[-.15,1.16,.05],[-.02,1.26,.06],[.075,.92,.02],[.08,.45,0]],dark,blade);
   poly([[-.15,1.16,.054],[-.025,1.265,.065],[.01,1.20,.058],[-.135,1.10,.049]],ochre,blade);
 }
 // Original cockpit framing and analog gauge deck used in the pilot camera.
 const cockpit=new THREE.Group();root.add(cockpit);
 const dash=mesh(new THREE.BoxGeometry(1.13,.24,.26),dark,cockpit);dash.position.set(0,.37,-1.32);
 for(const s of [-1,1]){bar([.59*s,.39,-1.35],[.46*s,1.01,-.80],.031,dark,cockpit);}
 const needles:THREE.Group[]=[];
 const makeGauge=(i:number)=>{const c=document.createElement('canvas');c.width=c.height=160;
  const ctx=c.getContext('2d')!;ctx.translate(80,80);ctx.fillStyle='#122122';ctx.beginPath();ctx.arc(0,0,76,0,2*Math.PI);ctx.fill();
  ctx.strokeStyle='#809b92';ctx.lineWidth=6;ctx.stroke();ctx.lineWidth=2;for(let k=0;k<32;k++){const a=k*2*Math.PI/32;ctx.beginPath();ctx.moveTo(Math.sin(a)*64,Math.cos(a)*64);ctx.lineTo(Math.sin(a)*(k%4?60:53),Math.cos(a)*(k%4?60:53));ctx.stroke();}
  ctx.fillStyle='#d3d7c9';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText(['KNOTS','ALT','RPM','V/S'][i],0,29);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const o=mesh(new THREE.CircleGeometry(.079,32),new THREE.MeshBasicMaterial({map:tex}),cockpit);o.position.set((i-1.5)*.175,.39,-1.185);const needle=new THREE.Group();needle.position.copy(o.position);needle.position.z+=.002;cockpit.add(needle);const hand=mesh(new THREE.BoxGeometry(.004,.053,.003),new THREE.MeshBasicMaterial({color:0xf7bc70}),needle);hand.position.y=.023;needles.push(needle);};
 for(let i=0;i<4;i++)makeGauge(i);
 const cockpitOnly=new THREE.Group();cockpit.add(cockpitOnly);
 const nose=mesh(new THREE.SphereGeometry(1,20,12),pearl,cockpitOnly);nose.position.set(0,-.01,-2.65);nose.scale.set(.62,.56,1.40);
 for(const k of [-1,1]){bar([k*.62,.35,-1.30],[k*.51,1.06,-.74],.031,pearl,cockpitOnly);}
 return {root,prop,cockpit,needles,setInterior(on:boolean){for(const child of root.children)child.visible=!on||child===cockpit||child===prop;cockpit.visible=on;}};
}
