import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stoneSpan } from './masonry';
import { stoneMaterials } from './stone-material';

/** Detached original study of a lower rusticated arcade, smooth Ionic columns and slate.
 * Nominal metres; no floor plan, geographic registration, or source imagery. */
type P = [number,number,number];
type Window = {x:number,y:number,w:number,h:number,pediment?:boolean,attic?:boolean};
const clip = (x:number,a:number,b:number) => Math.min(b,Math.max(a,x));
const π = Math.PI;

export function porticoStudy() {
  const plain = (color:number,roughness=.83)=>new T.MeshStandardMaterial({color,roughness});
  const stone=stoneMaterials();
  const wall=stone.create('ashlar',.87), lower=stone.create('rustic',1.15), cut=stone.create('cut',.76);
  const slate=stone.create('slate',.7), apron=stone.create('apron',.72);
  const bark=plain(0x53372b), windowTrim=plain(0x9a9686), windowEdge=plain(0x594f40), recess=plain(0x2e2721), lead=plain(0x423e3b,.56);
  const copper=plain(0x3b352e,.76), hall=plain(0x68554a), pewter=plain(0x554b44,.62), pipe=plain(0x4a443d,.61);
  const glass=new T.ShaderMaterial({
    vertexShader:`varying vec3 p;varying vec3 n;
    void main(){ vec4 v=modelMatrix*vec4(position,1.);p=v.xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*v; }`,
    fragmentShader:`varying vec3 p;varying vec3 n;
    void main(){vec3 v=normalize(cameraPosition-p);vec3 r=reflect(-v,normalize(n));
     float t=smoothstep(-.23,.53,r.y);float f=.044+.956*pow(1.-max(0.,dot(v,normalize(n))),5.);
     float clouds=smoothstep(.035,.72,.52+.29*sin(r.x*5.1+r.z*3.1)+.13*sin(r.x*10.9-r.y*4.3));
     vec3 env=mix(vec3(.075,.082,.074),vec3(.48,.61,.71)*( .65+.35*clouds),t);
     float shade=.86+.14*sin(p.x*13.47+p.y*.33);vec3 aperture=vec3(.028,.022,.018)*shade;
     gl_FragColor=vec4(aperture+env*(.166+f*.65),1.);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`
  });
  const rawBody=plain(0xa99c84), rawRoof=plain(0x706b68), rawOpening=plain(0x504a44);
  const libs = [wall,lower,cut,slate,apron,bark,windowTrim,windowEdge,recess,lead,copper,hall,pewter,pipe,glass,rawBody,rawRoof,rawOpening];
  let pots=new Map<T.Material,T.BufferGeometry[]>();
  const finite: Record<string,number>={};
  let activePart='massing';
  const counters=(g:T.BufferGeometry)=>{finite[activePart]=(finite[activePart]??0)+(g.index?.count??g.getAttribute('position').count)/3;};
  // Maps are metrically consistent on orthogonal faces; coarse grain offset stays aligned within a stone course.
  const deposit=(input:T.BufferGeometry,mat:T.Material,tint:[number,number,number]=[1,1,1],phase=0,useUnwrap=false,seamlessCircumference=false)=>{
    const g=input.index?input.toNonIndexed():input;
    if(g!==input) input.dispose();
    const p=g.getAttribute('position'), n=g.getAttribute('normal');
    const uv=new Float32Array(p.count*2), c=new Float32Array(p.count*3);
    for (let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
      const parametric=useUnwrap&&g.hasAttribute('uv'),source=g.getAttribute('uv');
      uv[i*2]=seamlessCircumference?source.getX(i)+phase:(parametric?source.getX(i)*3.3:ny>=Math.max(nx,nz)||nz>nx?x:z)/stoneSpan[0]+phase;
      uv[i*2+1]=(parametric&&!seamlessCircumference?source.getY(i)*6.0:ny>Math.max(nx,nz)&&!seamlessCircumference?z:y)/stoneSpan[1];
      c.set(tint,i*3);
    }
    g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setAttribute('color',new T.BufferAttribute(c,3));
    if (!pots.has(mat)) pots.set(mat,[]);pots.get(mat)!.push(g);counters(g);
  };
  const box=(mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,tint?:[number,number,number])=>{
    if(Math.min(w,h,d)<=.0005) throw new Error(`Degenerate box for ${activePart}: ${w},${h},${d}`);
    deposit(new T.BoxGeometry(w,h,d).translate(x,y,z),mat,tint);
  };
  const quad=(a:P,b:P,c:P,d:P,mat:T.Material)=> poly([a,b,c,a,c,d],mat);
  function poly(points:P[],mat:T.Material,tint?:[number,number,number]){
    const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));
    g.computeVertexNormals();deposit(g,mat,tint);
  }
  const lathe=(x:number,y:number,z:number,radii:number[][],mat:T.Material,segments=36,tint?:[number,number,number])=> {
    const g=new T.LatheGeometry(radii.map(([r,y])=>new T.Vector2(r,y)),segments).translate(x,y,z);deposit(g,mat,tint,x*.071+z*.013,true,true);
  };
  const oval=(x:number,y:number,z:number,rx:number,ry:number,rz:number,mat:T.Material,segments=12,rings=8)=>{
    deposit(new T.SphereGeometry(1,segments,rings).scale(rx,ry,rz).translate(x,y,z),mat,undefined,0,true);
  };
  const baton=(x:P,y:P,r0:number,r1:number,mat:T.Material,segments=10)=>{
    const a=new T.Vector3(...x), b=new T.Vector3(...y), dir=new T.Vector3().subVectors(b,a);
    const cylinder=new T.CylinderGeometry(r1,r0,dir.length(),segments);
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
    deposit(cylinder.applyQuaternion(q).translate(...a.add(b).multiplyScalar(.5).toArray() as P),mat,undefined,0,true);
  };
  function trimRun(a:P,b:P,theFace:number,d:number,h:number,mat:T.Material) {
    const dx=b[0]-a[0], dy=b[1]-a[1], n=Math.hypot(dx,dy), px=-dy/n*h*.5, py=dx/n*h*.5;
    const A=[a[0]+px,a[1]+py,theFace] as P, B=[a[0]-px,a[1]-py,theFace] as P;
    const C=[b[0]-px,b[1]-py,theFace] as P, D=[b[0]+px,b[1]+py,theFace] as P;
    const back=(v:P):P=>[v[0],v[1],theFace-d];
    quad(A,B,C,D,mat);quad(A,D,back(D),back(A),mat);quad(B,back(B),back(C),C,mat);
    quad(A,back(A),back(B),B,mat);quad(D,C,back(C),back(D),mat);
  }
  function masonryPanel(x0:number,x1:number,y0:number,y1:number,z:number,openings:Window[],mat:T.Material){
    const x=[x0,x1], y=[y0,y1];
    for(const o of openings){x.push(o.x-o.w/2,o.x+o.w/2);y.push(o.y,o.y+o.h);}
    const xx=[...new Set(x)].sort((a,b)=>a-b),yy=[...new Set(y)].sort((a,b)=>a-b);
    for(let i=1;i<xx.length;i++) for(let j=1;j<yy.length;j++) {
      const l=xx[i-1], r=xx[i], b=yy[j-1], t=yy[j], mx=(l+r)/2, my=(b+t)/2;
      if(openings.some(f=>mx>f.x-f.w/2&&mx<f.x+f.w/2&&my>f.y&&my<f.y+f.h)) continue;
      quad([l,b,z],[r,b,z],[r,t,z],[l,t,z],mat);
    }
  }
  function glazed(o:Window,z:number) {
    const {x,y,w,h}=o,l=x-w/2,r=x+w/2,t=y+h, inner=z-.245;
    // Solid, visible reveal surfaces. Glass sits behind the sash rather than coplanar with the facade.
    quad([l,y,z],[l,y,inner],[l,t,inner],[l,t,z],cut);
    quad([r,y,inner],[r,y,z],[r,t,z],[r,t,inner],cut);
    quad([l,y,z],[r,y,z],[r,y,inner],[l,y,inner],cut);
    quad([l,t,inner],[r,t,inner],[r,t,z],[l,t,z],cut);
    const frame=o.attic?.053:.069;
    for (const side of [-1,1]) box(windowTrim,x+side*(w-frame)/2,y+h*.5,inner,frame,h,.055);
    for (const shift of [frame/2,h-frame/2]) box(windowTrim,x,y+shift,inner,w-frame*2,frame,.055);
    const l2=l+frame,r2=r-frame,b2=y+frame,t2=t-frame;
    quad([l2,b2,inner-.025],[r2,b2,inner-.025],[r2,t2,inner-.025],[l2,t2,inner-.025],glass);
    const rowCount=o.attic?2:4,cols=o.attic?3:3;
    for(let i=1;i<cols;i++) box(windowTrim,l2+(r2-l2)*i/cols,(b2+t2)*.5,inner-.008,.026,h-2*frame,.039);
    for(let j=1;j<rowCount;j++) box(windowTrim,x,b2+(t2-b2)*j/rowCount,inner-.001,w-2*frame,j===2?.053:.024,.042);
    if (!o.attic) {
      box(cut,x,y-.058,z-.034,w+.28,.126,.42);
      box(cut,x,y-.124,z-.006,w+.34,.060,.36);
    }
    if(o.pediment){
      const w2=w*.5+.21;
      box(cut,x,t+.135,z+.06,w+.45,.139,.22);
      const crest:[P,P,P]=[[x-w2-.06,t+.208,z+.24],[x+w2+.06,t+.208,z+.24],[x,t+.445,z+.24]];
      poly(crest,wall);
      trimRun(crest[0],crest[2],z+.274,.16,.074,cut);
      trimRun(crest[2],crest[1],z+.274,.16,.074,cut);
    } else {
      box(cut,x,t+.035,z-.02,w+.17,o.attic?.085:.136,.25);
    }
  }

  // Understated original envelope mass; not registered in the shared simulator.
  activePart='wing/bay shell';
  const zFace=0, wing=20.92, end=18.15, roofEave=10.71, roofRidge=13.05, rear=-16.35;
  const wingWindows:Window[]=[];
  for (const side of [-1,1]) for(const x of [8.21,11.88,15.71,19.98]){
    const wide=x===19.98?.78:.95;
    wingWindows.push({x:side*x,y:.87,w:wide,h:x===19.98?2.24:1.76},{x:side*x,y:4.79,w:wide,h:2.12,pediment:x<18},{x:side*x,y:8.25,w:wide,h:.91,attic:true});
  }
  // Break the lower masonry at the heavy stringcourse. Outer return is distinctly inset.
  [ [-end,-6.12,0],[6.12,end,0],[-wing,-end,-.49],[end,wing,-.49] ].forEach(([l,r,z])=>{
     const windows=wingWindows.filter(w=>w.x>l&&w.x<r);
     masonryPanel(l,r,-.065,3.78,z,windows.filter(w=>w.y<3.78),lower);
     masonryPanel(l,r,3.78,roofEave,z,windows.filter(w=>w.y>=3.78),wall);
     windows.forEach(w=>glazed(w,z));
     box(cut,(l+r)/2,3.77,z+.022,r-l,.135,.21);
     box(cut,(l+r)/2,3.876,z+.032,r-l,.082,.18);
     box(cut,(l+r)/2,.226,z-.012,r-l,.44,.22);
     box(cut,(l+r)/2,10.30,z+.11,r-l,.19,.43);
     box(cut,(l+r)/2,10.51,z+.21,r-l,.13,.54);
     box(copper,(l+r)/2,10.65,z+.22,r-l,.081,.56);
  });
  for (const s of [-1,1]) {
    const x=s*wing;
    box(wall,x-s*.02,5.36,-8.07,.11,10.72,15.60);
    box(lower,x-s*.001,1.89,-8.07,.15,3.78,15.59);
    for(const xx of [end-.17,wing-.21]){
      box(wall,s*xx,7.02,zFace-(xx>end?.48:0)+.064,.43,6.35,.193);
      box(cut,s*xx,4.00,zFace-(xx>end?.48:0)+.04,.57,.18,.26);
      box(cut,s*xx,9.98,zFace-(xx>end?.48:0)+.06,.55,.168,.27);
    }
    box(wall,s*end,5.32,-.26,.102,10.69,.54);
    box(cut,s*wing,10.43,-8.11,.43,.18,16.06);
    box(copper,s*wing,10.68,-8.11,.49,.090,16.32);
  }
  box(wall,0,5.35,rear,41.8,10.72,.20);
  const a:[P,P,P,P]=[[-21.21,roofEave,.29],[21.21,roofEave,.29],[14.65,roofRidge,-7.95],[-14.65,roofRidge,-7.95]];
  quad(...a,slate);
  quad([-14.65,roofRidge,-7.95],[14.65,roofRidge,-7.95],[21.21,roofEave,rear-.27],[-21.21,roofEave,rear-.27],slate);
  poly([[21.21,roofEave,.29],[21.21,roofEave,rear-.27],[14.65,roofRidge,-7.95]],slate);
  poly([[-21.21,roofEave,rear-.27],[-21.21,roofEave,.29],[-14.65,roofRidge,-7.95]],slate);
  for(const [x,z,h] of [[-8.77,-3.46,2.06],[9.21,-3.17,2.29],[-17.51,-10.10,.79],[17.93,-9.77,1.08]]){
    const r=roofEave+(roofRidge-roofEave)*clip(Math.min(Math.abs(z+.16),Math.abs(z-rear))/7.8,0,1);
    box(wall,x,r+h*.40,z,.66,h, .69);box(cut,x,r+h*.88,z,.79,.15,.82);box(cut,x,r+h*.95,z,.87,.106,.89);
    box(copper,x,r+h,z,.78,.048,.80);
  }

  // Load-bearing, recessed triple front arcade. Side run closes solely in this detached sketch.
  activePart='three segmental arcade bays';
  const outZ=3.24, backZ=1.82, xMin=-6.12, xMax=6.12, arcadeTop=3.83, threshold=.465;
  const spans=[{x:-4.18,h:1.00,s:2.46,rise:.53},{x:0,h:1.95,s:2.43,rise:.62},{x:4.18,h:1.00,s:2.46,rise:.53}];
  let prev=-6.12;
  for (const {x,h,s,rise} of spans) {
    const rho=(h*h+rise*rise)/(2*rise), yc=s+rise-rho, alpha=Math.asin(h/rho), n=24;
    const crown=(i:number,offset=0):P=>{const theta=-alpha+2*alpha*i/n;return [x+(rho+offset)*Math.sin(theta),yc+(rho+offset)*Math.cos(theta),0];};
    box(lower,(prev+x-h)/2,(arcadeTop-.05)/2,(outZ+backZ)*.5,x-h-prev,arcadeTop+.05,outZ-backZ);
    for(let i=0;i<n;i++){
      const [a,ya]=crown(i),[b,yb]=crown(i+1);
      // The void stops on the arch, not on a decorative transparent plane.
      const l=i===0?x-h:a, r=i===n-1?x+h:b;
      quad([l,ya,outZ],[r,yb,outZ],[r,arcadeTop,outZ],[l,arcadeTop,outZ],lower);
      quad([r,yb,backZ],[l,ya,backZ],[l,arcadeTop,backZ],[r,arcadeTop,backZ],lower);
      quad([l,ya,backZ],[r,yb,backZ],[r,yb,outZ],[l,ya,outZ],cut);
    }
    quad([x-h,threshold,outZ],[x-h,threshold,backZ],[x-h,s,backZ],[x-h,s,outZ],cut);
    quad([x+h,threshold,backZ],[x+h,threshold,outZ],[x+h,s,outZ],[x+h,s,backZ],cut);
    // Bonded ring of separate voussoirs subtly frames the opening, without a black tracked line.
    const m=h>1.5?11:9;
    for (let j=0;j<m;j++) {
      const aa=(-alpha+2*alpha*j/m)+.003/rho, bb=(-alpha+2*alpha*(j+1)/m)-.003/rho;
      const r0=rho-.009,r1=rho+.205+(j===m>>1?.037:0);
      const q=(r:number,t:number,z:number):P=>[x+r*Math.sin(t),yc+r*Math.cos(t),z];
      const z0=outZ+.018+(j===m>>1?.013:0), z1=outZ-.004;
      quad(q(r0,aa,z0),q(r0,bb,z0),q(r1,bb,z0),q(r1,aa,z0),cut);
      quad(q(r0,aa,z1),q(r0,bb,z1),q(r0,bb,z0),q(r0,aa,z0),cut);
      quad(q(r1,bb,z1),q(r1,aa,z1),q(r1,aa,z0),q(r1,bb,z0),cut);
    }
    // Lit vestibule floor and independently legible wood leaf in the deep inner opening.
    box(cut,x,threshold-.035,(outZ+.10)*.5,h*2,.07,outZ+.10);
    const w=h>1.5?2.55:1.07;
    // The shaded vestibule has solid masonry behind the set-back door leaves, not an open cut through the model.
    box(lower,x,1.55,-.105,h*2+.12,3.12,.195,[.78,.75,.71]);
    box(recess,x,threshold+1.19,-.065,w+.22,2.38,.105);
    box(hall,x,threshold+1.14,.073,w,2.27,.20);
    for (const dx of h>1.5?[-.62,.62]:[0]){
      box(bark,x+dx,threshold+1.108,.201,w/(h>1.5?2:1)-.08,2.215,.074);
      for (const yy of [.81,1.83,2.33])box(hall,x+dx,yy,.245,w/(h>1.5?2:1)-.30,yy===1.83?.60:.31,.042);
      box(lead,x+dx+(dx>0?-.35:.33),1.28,.285,.035,.109,.032);
    }
    box(cut,x,2.79,.090,w+.19,.113,.22);
    prev=x+h;
  }
  box(lower,(prev+6.12)/2,(arcadeTop-.05)*.5,(outZ+backZ)*.5,6.12-prev,arcadeTop+.05,outZ-backZ);
  for(const side of [-1,1]){
    box(lower,side*6.057,1.9,1.66,.144,3.80,3.36);
    box(cut,side*5.97,.13,1.76,.30,.24,3.57);
  }
  box(cut,0,3.50,3.307,12.47,.119,.33);
  box(cut,0,3.68,3.30,12.40,.22,.30);
  box(cut,0,3.826,3.28,12.62,.09,.56);
  box(cut,0,3.97,1.597,12.63,.19,3.95);
  box(copper,0,4.075,3.275,12.67,.026,.59);
  // Nominal art grade only. The third riser and the vestibule slab share the exact threshold.
  // Separate nonoverlapping runs across the step nosing keep the slab seam finite without z-fight.
  for(let i=0;i<3;i++){
    const d=.443,w=12.50-i*.041,z=outZ+1.397-(i+.5)*d;
    const top=(i+1)*threshold/3,bottom=-.015;
    box(cut,0,(top+bottom)*.5,z,w,top-bottom,d);
  }

  // Recessed principal windows and small upper lights behind the free-standing order.
  activePart='portico upper windows';
  const central:Window[]=[];
  for(const x of [-4.10,-1.42,1.42,4.10]){
    central.push({x,y:4.82,w:1.09,h:2.20,pediment:true},{x,y:8.42,w:.95,h:.86,attic:true});
  }
  masonryPanel(xMin,xMax,3.78,roofEave,zFace,central,wall);
  central.forEach(w=>glazed(w,zFace));
  // Portico ceiling has thickness and a distinctly sheltered warm stone tone.
  box(hall,0,9.95,1.56,12.29,.114,3.46);
  for(const x of [-4.35,-1.45,1.45,4.35]){
    box(cut,x,9.857,1.499,2.78,.06,.072);
    box(cut,x,9.855,2.98,2.78,.07,.079);
  }
  const shellPool=pots; pots=new Map();
  activePart='four smooth Ionic orders';
  for (const [k,x] of [-5.33,-2.40,2.40,5.33].entries()) {
    const z=3.14, base=4.085, cap=9.541, y0=4.445, height=cap-y0;
    box(cut,x,base+.066,z,1.31,.132,1.21);
    lathe(x,base+.13,z,[[.61,0],[.62,.033],[.611,.065],[.57,.097],[.536,.108],[.53,.16],[.568,.18],[.58,.207],[.570,.236],[.532,.254],[.515,.277],[.515,.361]],cut,32);
    const rr=(t:number)=>.506-.113*t+.021*Math.sin(π*t);
    const drums=[0,.119,.248,.380,.516,.656,.813,1];
    for(let i=1;i<drums.length;i++){
      const a=drums[i-1],b=drums[i], eps=.0017/height;
      const radii:number[][]=[[rr(a)-.0033,0],[rr(a+eps),eps*height],[rr((2*a+b)/3),(b-a)/3*height],[rr((a+2*b)/3),(b-a)*2/3*height],[rr(b-eps),(b-a-eps)*height],[rr(b)-.003,(b-a)*height]];
      const tone=.957+.069*(.5+.5*Math.sin(k*3.81+i*3.55));
      lathe(x,y0+a*height,z,radii,cut,32,[tone,tone*.996,tone*.983]);
    }
    lathe(x,cap-.038,z,[[.395,0],[.409,.015],[.427,.048],[.425,.084],[.453,.105],[.49,.147],[.512,.196],[.52,.234],[.554,.275],[.563,.326]],cut,32);
    // Rounded egg fillet and actual pilaster scroll shoulders. Art, not scanned ornament.
    for(let i=0;i<11;i++){
      const a=2*π*i/11;
      oval(x+.503*Math.cos(a),cap+.166,z+.496*Math.sin(a),.030,.049,.028,cut,9,6);
    }
    box(cut,x,cap+.321,z,1.195,.135,1.05);
    box(cut,x,cap+.412,z,1.235,.063,1.11);
    for(const s of [-1,1]){
      const xc=x+s*.417,yc=cap+.209;
      baton([xc,yc,z-.472],[xc,yc,z+.472],.180,.180,cut,20);
      for(const side of [-1,1]){
        const outer=z+side*.478;
        oval(xc,yc,outer,.173,.173,.038,cut,16);
        const curves=[];
        for(let j=0;j<30;j++) {
          const t=j/29, angle=1.13+s*(.59-t*π*3.0), r=.152-.131*t;
          curves.push(new T.Vector3(xc+r*Math.cos(angle),yc+r*Math.sin(angle),outer+side*(.032+.012*t)));
        }
        deposit(new T.TubeGeometry(new T.CatmullRomCurve3(curves),29,.0135,6,false),cut,undefined,0,true);
        oval(xc,yc,outer+side*.041,.036,.036,.022,cut);
      }
    }
  }

  const nearOrders=group('Hero flared and carved smooth Ionic orders',new Set([cut]),true);
  activePart='flight approach Ionic orders';
  for(const [k,x] of [-5.33,-2.40,2.4,5.33].entries()){
    const z=3.14,base=4.085,cap=9.541,y0=4.445,height=cap-y0;
    box(cut,x,base+.066,z,1.31,.132,1.21);
    lathe(x,base+.13,z,[[.61,0],[.62,.037],[.60,.077],[.533,.112],[.53,.16],[.58,.205],[.57,.24],[.516,.267],[.515,.361]],cut,24);
    const tone=.979+.013*Math.sin(k*3.81);
    lathe(x,y0,z,[0,.166,.33,.50,.66,.83,1].map(t=>[.506-.113*t+.021*Math.sin(π*t),height*t]),cut,24,[tone,tone*.996,tone*.983]);
    lathe(x,cap-.038,z,[[.396,0],[.428,.060],[.458,.117],[.506,.187],[.544,.267],[.563,.326]],cut,20);
    box(cut,x,cap+.321,z,1.195,.135,1.05);
    box(cut,x,cap+.412,z,1.235,.063,1.11);
    for(const s of [-1,1]){
      const xc=x+s*.417,yc=cap+.209;
      baton([xc,yc,z-.476],[xc,yc,z+.476],.177,.177,cut,16);
      for(const side of [-1,1]){
        const outer=z+side*.475;
        oval(xc,yc,outer,.166,.166,.028,cut,12,4);
      }
    }
  }
  const approachOrders=group('Approach smooth orders and volute silhouette',new Set([cut]),true);
  pots=shellPool;
  activePart='entablature and pediment';
  for(const [y,h,d,dx,mat] of [
    [9.995,.16,.53,.11,cut],[10.15,.124,.637,.15,cut],[10.45,.48,.62,.13,wall],[10.712,.119,.711,.29,cut],[10.843,.133,.824,.365,cut],[10.926,.056,.840,.37,copper],
  ] as const) {
    const w=12.15+dx*2;
    box(mat,0,y,3.24,w,h,d);
    box(mat,-w*.5+d*.5,y,1.50,d,h,3.60);
    box(mat,w*.5-d*.5,y,1.50,d,h,3.60);
  }
  // The stratified trim projects in front of a continuous stone frieze.
  box(cut,0,10.43,3.136,12.28,.96,.334);
  const faceZ=3.556, apex=13.26, bY=10.913, ped=6.43;
  poly([[-ped,bY,faceZ],[ped,bY,faceZ],[0,apex,faceZ]],wall);
  trimRun([-ped-.11,bY,faceZ],[0,apex+.099,faceZ],faceZ+.156,.177,.195,cut);
  trimRun([0,apex+.099,faceZ],[ped+.11,bY,faceZ],faceZ+.156,.177,.195,cut);
  trimRun([-ped-.07,bY+.025,faceZ],[0,apex-.027,faceZ],faceZ+.041,.129,.088,cut);
  trimRun([0,apex-.027,faceZ],[ped+.07,bY+.025,faceZ],faceZ+.041,.129,.088,cut);
  quad([-ped-.15,bY+.12,faceZ+.105],[0,apex+.184,faceZ+.105],[0,apex+.119,-1.78],[-ped-.15,bY+.082,-1.78],slate);
  quad([0,apex+.184,faceZ+.105],[ped+.15,bY+.12,faceZ+.105],[ped+.15,bY+.082,-1.78],[0,apex+.119,-1.78],slate);
  // Decorative historic metalwork is intentionally reduced, not inferred from the unseen rear.
  activePart='exterior edgework';
  for(const x of [-6.42,6.42]){
    const z=.18;
    baton([x,10.51,z],[x,3.49,z],.047,.047,pipe);
    baton([x,3.49,z],[x-.12*Math.sign(x),3.33,z+.127],.047,.046,pipe);
    baton([x-.12*Math.sign(x),3.33,z+.127],[x-.12*Math.sign(x),.24,z+.127],.046,.041,pipe);
    for(const y of [2.21,5.12,8.68]) box(copper,x,y,z,.103,.052,.117);
  }
  const stagedGeometry=group('Ionic sandstone',new Set(libs.slice(0,15)),true);
  stagedGeometry.add(nearOrders,approachOrders);
  approachOrders.visible=false;

  activePart='unworked compare';
  const massW=41.84;
  box(rawBody,0,5.25,-7.95,massW,10.5,16.35);
  box(rawBody,0,5.26,1.65,12.45,10.5,3.68);
  quad([-21.21,roofEave,.29],[21.21,roofEave,.29],[14.65,roofRidge,-7.95],[-14.65,roofRidge,-7.95],rawRoof);
  quad([-14.65,roofRidge,-7.95],[14.65,roofRidge,-7.95],[21.21,roofEave,rear-.27],[-21.21,roofEave,rear-.27],rawRoof);
  poly([[21.21,roofEave,.29],[21.21,roofEave,rear-.27],[14.65,roofRidge,-7.95],[-21.21,roofEave,rear-.27],[-21.21,roofEave,.29],[-14.65,roofRidge,-7.95]],rawRoof);
  poly([[-6.37,10.49,3.5],[6.37,10.49,3.5],[0,13.29,3.5]],rawBody);
  for(const w of wingWindows){box(rawOpening,w.x,w.y+w.h/2,.25,w.w,w.h,.03);}
  for(const w of central){box(rawOpening,w.x,w.y+w.h/2,3.50,w.w,w.h,.03);}
  const unworked=group('Unworked massing control',new Set([rawBody,rawRoof,rawOpening]),true);
  activePart='neutral display apron';
  quad([-140,-.010,94],[140,-.010,94],[140,-.010,-98],[-140,-.010,-98],apron);
  const neutral=group('Neutral apron',new Set([apron]),false);
  function group(name:string,mats:Set<T.Material>,cast:boolean){
    const g=new T.Group();g.name=name;
    for (const [mat,parts] of pots) {
      if (!mats.has(mat)||parts.length===0) continue;
      const pooled=mergeGeometries(parts);if(!pooled) throw new Error('Failed to join typed detail surfaces');
      const s=new T.Mesh(pooled,mat);s.name=name;s.castShadow=cast;s.receiveShadow=true;g.add(s);
      for(const p of parts)p.dispose();pots.delete(mat);
    }
    return g;
  }
  return {stagedGeometry,nearOrders,approachOrders,unworked,neutral,finite,layStone:stone.start};
}
