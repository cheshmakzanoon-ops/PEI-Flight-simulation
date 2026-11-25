import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
import type {WindFarmId} from './regional-wind-stream.ts';
export type WindLod=0|1|2;
export interface TurbineProfile{
 model:string;hub:number;radius:number;bladeLength:number;rpm:number;towerBase:number;towerTop:number; nacelle:[number,number,number];
 noseX:number;fairingFront:number;hubRadius:number;shaftTilt:number;cone:number;maxChord:number;endChord:number;twistDeg:number;sectionFractions:readonly number[];
}
/** Heights/diameters are the installed NRCan roster. See the source record for
 * independent engineering dimensions and the separately identified artwork. */
export const WIND_PROFILE:Record<WindFarmId,TurbineProfile>={
 'west-cape':{model:'Vestas V80-1.8',hub:80,radius:40,bladeLength:39,rpm:15.5,towerBase:2.08,towerTop:1.15,nacelle:[9.7,3.4,3.64],noseX:3.82,fairingFront:3.04,hubRadius:1.54,shaftTilt:6,cone:2,maxChord:3.52,endChord:.48,twistDeg:13,sectionFractions:[.28,.61]},
 'east-point-i':{model:'Vestas V90-3.0',hub:81,radius:45,bladeLength:44,rpm:16.1,towerBase:1.99,towerTop:1.15,nacelle:[9.65,3.6,4.05],noseX:4.04,fairingFront:2.68,hubRadius:1.57,shaftTilt:6,cone:4,maxChord:3.512,endChord:.391,twistDeg:17.5,sectionFractions:[.31,.64]},
 'hermanville':{model:'Acciona AW116/3000',hub:92,radius:58,bladeLength:56.7,rpm:12.3,towerBase:2.26,towerTop:1.53,nacelle:[10.9,4.09,4.15],noseX:5.04,fairingFront:3.64,hubRadius:1.95,shaftTilt:5,cone:2.5,maxChord:4.45,endChord:.22,twistDeg:15.5,sectionFractions:[12.2/92,.34,.57,.77]},
};
type Vec=[number,number,number]; type Loop=Vec[];
const TAU=Math.PI*2,RAD=Math.PI/180,paint=new Color();
const SHELL=0xe4e3dc,TOWER=0xdce0dd,BLADE=0xe5e7e2,JOINT=0xc0c4c1,SOCKET=0x969489,VENT=0x667278;
class Skin{
 p:number[]=[]; c:number[]=[]; i:number[]=[];
 readonly kind:WindLod;constructor(kind:WindLod){this.kind=kind;}
 /** Closed loft with independent cap normals, smooth continuous side normals. */
 loft(rows:Loop[],tone:number,gain:(n:number,j:number)=>number=()=>1){
  if(rows.length<2)return;
  const stride=rows[0].length,base=this.p.length/3;
  paint.setHex(tone);
  const add=(v:Vec,g:number)=>{this.p.push(...v);this.c.push(paint.r*g,paint.g*g,paint.b*g);};
  for(let j=0;j<rows.length;j++)for(let n=0;n<stride;n++)add(rows[j][n],gain(n,j));
  for(let j=0;j<rows.length-1;j++)for(let n=0;n<stride;n++){
   const a=base+j*stride+n,b=base+j*stride+(n+1)%stride;
   this.i.push(a,b,a+stride,b,b+stride,a+stride);
  }
  for(const end of [0,rows.length-1]){
   const start=this.p.length/3,v=rows[end]; for(let n=0;n<stride;n++)add(v[n],gain(n,end));
   for(let j=1;j<stride-1;j++){if(end===0)this.i.push(start,start+j+1,start+j);else this.i.push(start,start+j,start+j+1);}
  }
 }
 geometry(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.p,3));g.setAttribute('color',new Float32BufferAttribute(this.c,3));g.setIndex(this.i);g.computeVertexNormals();g.computeBoundingSphere();return g;}
}
const loop=(n:number,vertex:(a:number)=>Vec):Loop=>Array.from({length:n},(_,i)=>vertex(TAU*i/n));
const signPow=(x:number,k:number)=>Math.sign(x)*Math.pow(Math.abs(x),k);
const alongY=(n:number,r:number,y:number):Loop=>loop(n,a=>[Math.cos(a)*r,y,Math.sin(a)*-r]);
const alongX=(n:number,x:number,h:number,w:number,cy:number,exponent:number):Loop=>loop(n,a=>[x,cy+h*signPow(Math.cos(a),exponent),w*signPow(Math.sin(a),exponent)]);
function mastShape(s:Skin,f:TurbineProfile,id:WindFarmId){
 const level=s.kind,n=[28,14,7][level],a=f.towerBase,b=f.towerTop,h=f.hub-2.11;
 const fl=(y:number)=>a+(b-a)*Math.max(0,Math.min(1,y/h));
 // Rounded bottom socket goes below the surveyed game's visible slope. No soil
 // decal or flat shadow sheet, since the surrounding mesh isn't ours.
 s.loft([alongY(n,a*1.16,-1.05),alongY(n,a*1.16,.07),alongY(n,a*1.04,.14)],SOCKET);
 const ys=level===0?[-.76,.14,.37,2.2,...f.sectionFractions.map(k=>k*h),h-.42,h]:[-.76,.16,h];
 s.loft(ys.map(y=>alongY(n,fl(y),y)),TOWER,(_,j)=>j>2||level!==0?1:j===0?.59:j===1?.79:.95);
 if(level===0){
  for(const ratio of f.sectionFractions){const y=h*ratio,r=fl(y);s.loft([alongY(n,r+.009,y-.042),alongY(n,r+.012,y+.038)],JOINT);}
 }
 const [length,width,height]=f.nacelle,front=f.fairingFront,back=front-length; const A=id==='hermanville',V=id==='east-point-i';
 // The three closed fairings retain different noses, soffits and aft shoulders.
 // Station radii are hand-authored fraction profiles, not copied meshes.
 const p=A?[[0,.76,.77,.19],[.035,.91,.92,.15],[.12,1,1,.13],[.65,1,1,.12],[.82,.94,.91,.09],[.95,.78,.79,.04],[1,.52,.56,-.01]]:
  V?[[0,.74,.74,.04],[.065,.92,.91,.06],[.17,1,1,.04],[.38,1,1,.02],[.7,.92,.94,0],[.9,.75,.80,-.03],[1,.50,.57,-.08]]:
    [[0,.50,.55,.03],[.065,.80,.82,.11],[.20,.99,.99,.10],[.56,1,1,.08],[.85,.87,.87,.04],[1,.61,.62,-.01]];
 const profile=level===2?p.filter((_,i)=>i===0||i===2||i===p.length-1):p;
 s.loft(profile.map(([k,zw,yh,dy])=>alongX(n,back+length*k,height*yh*.5,width*zw*.5,f.hub+dy,A?.53:V?.71:.83)),SHELL,
      (i,j)=>.87+.13*Math.max(0,Math.min(1,.58+Math.cos(i/n*TAU)*.46))+(j===0?-.025:0));
 if(level===0){
  // Local small-scale read: shadowed, rounded equipment fairing and shell edge.
  // No logos, windows or lamps invented at the specific sites.
  if(!A){
   const x=back+length*.25,w=width*.30,y=f.hub+height*.453;
   s.loft([alongX(12,x-1,.12,w*.85,y,.54),alongX(12,x-.83,.21,w,y+.05,.54),alongX(12,x+.80,.21,w,y+.05,.54),alongX(12,x+1,.11,w*.84,y,.54)],JOINT);
  }
  const x=back+length*(A?.25:.21),z=width/2;
  // Dark paint marks are authored, not attributions of site-dependent openings.
  for(let side=-1;side<=1;side+=2)for(let k=0;k<4;k++){
   const u=f.hub+.03+k*.073,ww=A?.85:.56;
   const rectangular:Loop[]=[x-ww,x+ww].map(px=>[[px,u-.012,side*(z-.08)],[px,u+.012,side*(z-.08)],[px,u+.012,side*(z+.010)],[px,u-.012,side*(z+.010)]] as Loop);
   if(side<0)rectangular.forEach(r=>r.reverse());
   s.loft(rectangular,VENT);
  }
 }
 return s.geometry();
}
function rotorShape(s:Skin,f:TurbineProfile,id:WindFarmId){
 const level=s.kind,n=[24,12,7][level],aw=id==='hermanville',v90=id==='east-point-i';
 const hub=f.hubRadius;
 const nose=v90?2.24:aw?2.46:2.04;
 s.loft([[-1.44,.68],[-1.16,.91],[-.62,.995],[0,1],[.61,.92],[nose*.61,.68],[nose*.92,.29],[nose,.055]].filter((_,i)=>level!==2||[0,3,5,7].includes(i)).map(([x,r])=>alongX(n,x,hub*r,hub*r,0,.98)),SHELL);
 // Separate radial stations describe a thick root and torsion fading towards
 // the swept thin tip. The actual swept radius is fixed at *every* level.
 const u=[0,.025,.06,.105,.16,.225,.30,.40,.51,.63,.74,.84,.91,.965,.994,1],
       envelope=[.34,.35,.39,.63,.83,.981,1,.93,.79,.65,.51,.395,.302,.197,.079,.01],
       airfoil=[.75,.82,.70,.50,.38,.31,.265,.222,.196,.174,.157,.143,.125,.107,.088,.065];
 const station=level===0?u.map((_,i)=>i):level===1?[0,2,4,6,8,10,12,14,15]:[0,4,6,9,12,15];
 const airN=[12,8,6][level],r0=f.radius-f.bladeLength,cone=Math.tan(f.cone*RAD);
 for(let vane=0;vane<3;vane++){
  const spin=TAU*vane/3,cs=Math.cos(spin),sn=Math.sin(spin);
  const rows:Loop[]=station.map(k=>{const t=u[k],rad=r0+(f.radius-r0)*t,twist=f.twistDeg*RAD*(1-t)**1.8+.036;
   const chord=Math.max(f.endChord,f.maxChord*envelope[k]),sweep=-(aw?1.03:v90?.80:.50)*t**2;
   return loop(airN,a=>{
    // Finite airfoil thickness with camber and a broad leading edge, then
    // a tapered trailing edge. Open tips are capped by the common loft.
    const ca=Math.cos(a),sa=Math.sin(a),l=chord*(.5*ca-.055),w=chord*airfoil[k]*(.48+.17*ca)*sa+chord*.025*(1-ca*ca);
    const z=sweep+l*Math.cos(twist)-w*Math.sin(twist);
    const y=Math.min(rad,Math.sqrt(Math.max(0,f.radius*f.radius-z*z)));
    const x=rad*cone+l*Math.sin(twist)+w*Math.cos(twist);
    return [x,y*cs-z*sn,y*sn+z*cs];
   });
  });
  s.loft(rows,BLADE,(i,j)=>.95+.04*Math.cos(i/airN*TAU)-.05*(j===0?1:0));
 }
 return s.geometry();
}
export function turbineGeometry(id:WindFarmId,lod:WindLod){const f=WIND_PROFILE[id];return {mast:mastShape(new Skin(lod),f,id),rotor:rotorShape(new Skin(lod),f,id)};}
