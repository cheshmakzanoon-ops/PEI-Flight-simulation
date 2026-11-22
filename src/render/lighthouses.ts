import * as T from 'three';
import { project } from '../sim/geo.ts';
import { LIGHT_STATIONS } from '../sim/lighthouse-sites.ts';
import type { Terrain } from '../sim/terrain.ts';

/** These are original metric exterior models, not extracted imagery. See docs/landmarks/lighthouses.md. */
const PAINT = {
  white: 0xd0ccc0, trim: 0xede7da, salt: 0xa39b87, black: 0x26272a,
  red: 0x9b302a, roof: 0x474849, zinc: 0x768181, granite: 0x887e71,
  window: 0x3c5157, glint: 0xb9d1ca, brass: 0xc2a777, dark: 0x352e2c
};
const PI=Math.PI;
const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const identity=new T.Matrix4(), ones=v(1,1,1), up=v(0,1,0);
const colorCache = new Map<number,T.Color>();
function color(n:number){let c=colorCache.get(n);if(!c){c=new T.Color(n);colorCache.set(n,c);}return c;}

/** Static, per-station geometry; one opaque draw for every fascia, brace and roof.
 * Geometry is built in station-local metres so Thin window trim doesn't jitter. */
class Batch {
  pos:number[]=[]; norm:number[]=[]; col:number[]=[]; siding:number[]=[];
  parent=identity;
  at(x:number,y:number,z:number,yaw:number,fn:()=>void) {
    const old=this.parent,m=new T.Matrix4().makeRotationY(yaw);m.setPosition(x,y,z);
    this.parent=new T.Matrix4().multiplyMatrices(old,m);fn();this.parent=old;
  }
  face(points:T.Vector3[],n:number,siding=0){
    const [a,b,c,d]=points.map(p=>p.clone().applyMatrix4(this.parent));
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),rgb=color(n);
    for(const p of d?[a,b,c,a,c,d]:[a,b,c]){
      this.pos.push(p.x,p.y,p.z);this.norm.push(normal.x,normal.y,normal.z);
      this.col.push(rgb.r,rgb.g,rgb.b);this.siding.push(siding);
    }
  }
  geometry(shape:T.BufferGeometry,m:T.Matrix4,n:number,siding=0){
    const matrix=new T.Matrix4().multiplyMatrices(this.parent,m),normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
    const p=shape.attributes.position,norm=shape.attributes.normal,idx=shape.index,rgb=color(n);
    const q=new T.Vector3(),nn=new T.Vector3();
    for(let i=0;i<(idx?.count??p.count);i++){
      const j=idx?idx.getX(i):i;q.fromBufferAttribute(p,j).applyMatrix4(matrix);
      nn.fromBufferAttribute(norm,j).applyMatrix3(normalMatrix).normalize();
      this.pos.push(q.x,q.y,q.z);this.norm.push(nn.x,nn.y,nn.z);this.col.push(rgb.r,rgb.g,rgb.b);this.siding.push(siding);
    }
    shape.dispose();
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,n:number,siding=0){
    this.geometry(new T.BoxGeometry(w,h,d),new T.Matrix4().makeTranslation(x,y,z),n,siding);
  }
  beam(a:T.Vector3,b:T.Vector3,width:number,n:number){
    const delta=b.clone().sub(a),len=delta.length();if(len<.001)return;
    const rot=new T.Quaternion().setFromUnitVectors(up,delta.multiplyScalar(1/len));
    const m=new T.Matrix4().compose(a.clone().lerp(b,.5),rot,ones);
    this.geometry(new T.BoxGeometry(width,len,width),m,n);
  }
  finish(mat:T.Material){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.pos,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(this.norm,3));g.setAttribute('color',new T.Float32BufferAttribute(this.col,3));
    g.setAttribute('clad',new T.Float32BufferAttribute(this.siding,1));g.computeBoundingSphere();return new T.Mesh(g,mat);
  }
}

function ring(y:number,apothem:number,sides:number,spin=0) {
  const r=apothem/Math.cos(PI/sides);
  return Array.from({length:sides},(_,i)=>{const a=spin+(2*i-1)*PI/sides;return v(Math.sin(a)*r,y,Math.cos(a)*r);});
}
function frustum(b:Batch,y0:number,y1:number,r0:number,r1:number,sides:number,n:number,siding=0,cap=true) {
  const lo=ring(y0,r0,sides),hi=ring(y1,r1,sides);
  for(let i=0;i<sides;i++){
    const j=(i+1)%sides;b.face([lo[i],lo[j],hi[j],hi[i]],n,siding);
    if(cap)b.face([v(0,y1,0),hi[i],hi[j]],n);
  }
}
function rail(b:Batch,sides:number,apothem:number,y:number,h:number,detail:boolean){
  const corners=ring(y,apothem,sides);
  for(let i=0;i<sides;i++){
    const a=corners[i],c=corners[(i+1)%sides],a1=a.clone().addScaledVector(up,h),c1=c.clone().addScaledVector(up,h);
    b.beam(a,a1,.13,PAINT.trim);b.beam(a1,c1,.13,PAINT.trim);
    if(detail){
      b.beam(a.clone().addScaledVector(up,.13),c.clone().addScaledVector(up,.13),.085,PAINT.white);
      const sections=sides===4?3:1; // square gallery has three framed lattice panels per side
      for(let j=0;j<sections;j++){
        const p=a.clone().lerp(c,j/sections),q=a.clone().lerp(c,(j+1)/sections);
        b.beam(p.clone().addScaledVector(up,.15),q.clone().addScaledVector(up,h-.06),.072,PAINT.white);
        b.beam(q.clone().addScaledVector(up,.15),p.clone().addScaledVector(up,h-.06),.072,PAINT.white);
        if(j)b.beam(p,p.clone().addScaledVector(up,h),.105,PAINT.trim);
      }
    }
  }
}
/** Front (+Z) of a narrow peaked casement, projected a little proud of wall.
 * Bounding timber trim, head and separate mullions remain visible obliquely. */
function sash(b:Batch,x:number,y:number,z:number,w:number,h:number,frame:number,hood=false,door=false){
  b.box(x,y+h/2,z,w+.2,h+.2,.135,frame);
  b.box(x,y+h/2,z+.083,w,h,.09,door?PAINT.red:PAINT.window);
  b.box(x,y-.04,z+.075,w+.24,.12,.20,PAINT.trim);
  if(!door){
    b.box(x,y+h*.50,z+.145,w,.065,.06,PAINT.white);
    b.box(x,y+h*.50,z+.145,.042,h,.06,PAINT.white);
  }
  if(hood){
    const y1=y+h+.10,a=v(x-w*.63,y1,z+.02),c=v(x+w*.63,y1,z+.02),top=v(x,y1+w*.44,z+.02);
    b.face([a,c,top],PAINT.trim);
    b.beam(a,top,.13,frame);b.beam(top,c,.13,frame);
  }
}
function tower(b:Batch,panes:Batch,west:boolean,detail:boolean){
  const N=west?4:8, pl=west?3.8:3.50, shoulder=west?1.98:1.87, wall=west?15.18:14.84;
  frustum(b,-.6,.36,pl+.11,pl+.10,N,PAINT.granite);
  if(west) {
    // Four dark bands; the uppermost is beneath the projecting white gallery.
    const rises=[.36,1.60,3.56,5.22,7.48,9.15,11.60,13.42,wall];
    const a=(h:number)=>pl+(shoulder-pl)*((h-.36)/(wall-.36));
    for(let i=0;i<rises.length-1;i++)frustum(b,rises[i],rises[i+1],a(rises[i]),a(rises[i+1]),N,i%2?PAINT.white:PAINT.black,1,false);
  }else frustum(b,.36,wall,pl,shoulder,N,PAINT.white,1);
  const gallery=west?16.32:15.71, gRad=west?2.68:2.59;
  frustum(b,wall-.12,wall+.17,shoulder+.13,shoulder+.22,N,PAINT.salt);
  frustum(b,wall+.17,gallery-.27,shoulder+.22,gRad-.04,N,PAINT.white);
  frustum(b,gallery-.27,gallery-.11,gRad+.05,gRad+.05,N,PAINT.trim);
  frustum(b,gallery-.11,gallery,gRad+.12,gRad+.12,N,PAINT.white);
  rail(b,N,gRad-.05,gallery,west?.93:.90,detail);
  if(detail){
    for(let i=0;i<N;i++){
      b.at(0,0,0,i*PI*2/N,()=>{
        for(const dx of [-.54,.54])b.beam(v(dx,wall-.14,shoulder+.04),v(dx,gallery-.32,gRad-.05),.15,PAINT.salt);
        // Most of the octagon is unbroken shingle; no grid of invented windows.
        if((west&&(i===0||i===1))||(!west&&(i===0||i===3))){
          for(const [bottom,h] of (west?[[3.55,1.65],[7.40,1.68],[11.58,1.66]]:[[4.95,1.12],[10.3,1.16]])){
            const r=pl+(shoulder-pl)*(bottom/wall);sash(b,0,bottom,r+.025,west?.78:.63,h,west?PAINT.trim:PAINT.red,true);
          }
        }
        if(i===(west?0:5))sash(b,0,.34,pl+.01,1.00,1.88,west?PAINT.trim:PAINT.red,true,true);
      });
    }
  }
  const drum=west?1.44:1.36, sill=gallery+.69, lintel=west?18.76:17.99;
  frustum(b,gallery,sill,drum,drum,8,PAINT.red);
  const frame=ring(sill,drum-.08,8), upper=ring(lintel,drum-.08,8);
  if(detail){
    frustum(b,sill+.10,lintel-.20,.37,.32,12,PAINT.brass);
    for(const k of [.15,.35,.55,.75])frustum(b,sill+(lintel-sill)*k,sill+(lintel-sill)*k+.055,.41,.39,10,PAINT.glint);
    for(let i=0;i<8;i++){
      const j=(i+1)%8;panes.face([frame[i],frame[j],upper[j],upper[i]],0x7e9caa);
      b.beam(frame[i],upper[i],.091,PAINT.red);
      b.beam(frame[i].clone().lerp(upper[i],.51),frame[j].clone().lerp(upper[j],.51),.045,PAINT.zinc);
    }
  }else frustum(b,sill,lintel,drum-.07,drum-.07,8,PAINT.window);
  frustum(b,lintel-.09,lintel+.10,drum+.14,drum+.16,8,PAINT.red);
  const height=west?LIGHT_STATIONS.west.height:LIGHT_STATIONS.east.height;
  frustum(b,lintel+.10,height-.55,drum+.22,.23,8,PAINT.red);
  frustum(b,height-.56,height-.39,.23,.20,8,PAINT.red);
  frustum(b,height-.39,height,.1,.023,8,PAINT.dark);
}

/** A gable building: separate gable siding, eaves, fascia, flashing and roof planes. */
function house(b:Batch,w:number,len:number,eave:number,rise:number,roof:number,trim:number,detail:boolean) {
  const a=w/2,s=len/2;
  b.box(0,.10,0,w+.14,.48,len+.14,PAINT.granite);
  b.box(0,eave/2,0,w,eave,len,PAINT.white,1);
  for(const dir of [-1,1]){
    b.at(0,0,0,dir<0?PI:0,()=>{
      b.face([v(-a,eave,s),v(a,eave,s),v(0,eave+rise,s)],PAINT.white,1);
      if(detail){
        b.beam(v(-a-.18,eave-.05,s+.22),v(0,eave+rise+.11,s+.22),.16,trim);
        b.beam(v(0,eave+rise+.11,s+.22),v(a+.18,eave-.05,s+.22),.16,trim);
        for(const x of [-a+.08,a-.08])b.box(x,eave*.5,s+.035,.17,eave,.11,PAINT.trim);
      }
    });
  }
  for(const side of [-1,1]){
    const over=.24, X=(a+over)*side,low=eave-over*rise/a,top=eave+rise+.08;
    const back=v(X,low,-s-.24),front=v(X,low,s+.24),ra=v(0,top,-s-.24),rb=v(0,top,s+.24);
    b.face(side<0?[front,rb,ra,back]:[back,ra,rb,front],roof);
    b.box(X,low-.047,0,.13,.18,len+.58,trim);
  }
  b.box(0,eave+rise+.085,0,.14,.09,len+.51,trim);
}
function eastHouse(b:Batch,detail:boolean){
  // Ridge follows the long edge of the measured fog-alarm footprint, ENE/WSW.
  b.at(17.05,.08,-5.9,1.89,()=>{
    house(b,8.1,13.3,4.7,3.3,0x91392f,PAINT.red,detail);
    b.at(.20,0,8.7,0,()=>house(b,5.9,5.9,3.25,2.42,0x91392f,PAINT.red,detail));
    if(!detail)return;
    for(const d of [-1,1])b.at(0,0,0,d*PI*.5,()=>{
      for(const x of [-4.7,-2.4,.15,2.75,4.93])sash(b,x,1.0,4.12,.92,1.64,PAINT.red);
    });
    b.at(0,0,-6.75,PI,()=>{sash(b,-1.9,1.05,.02,.91,1.54,PAINT.red);sash(b,1.7,1.05,.02,.91,1.54,PAINT.red);});
    sash(b,.2,.25,11.69,1.10,2.13,PAINT.red,false,true);
    b.box(.2,.10,12.01,2.2,.3,.94,PAINT.granite);
    // Museum's paired historic foghorn exhibits. Geometry only, no photographs or lettering.
    b.at(3.95,0,4.8,.1,()=>{
      b.box(1.0,.65,0,.92,.16,2.35,PAINT.white);
      for(const z of [-.69,.69])b.beam(v(.85,.10,z),v(.85,.65,z),.09,PAINT.white);
      for(const offset of [-.48,.48]){
        b.geometry(new T.CylinderGeometry(.29,.087,.92,12),
          new T.Matrix4().makeRotationZ(offset>0?-1.27:1.27).setPosition(1.08,1.0,offset),PAINT.red);
      }
    });
  });
}
function westInn(b:Batch,detail:boolean){
  // Local Z follows the long NW wing. Both tower and inn are a single 2020 roof footprint.
  b.at(-5.45,0,12.0,0,()=>{
    house(b,10.55,28.0,5.65,2.54,PAINT.roof,PAINT.black,detail);
    if(detail){
      for(const side of [-1,1])b.at(0,0,0,side*PI*.5,()=>{
        for(const x of [-11.7,-8,-4.25,-.5,3.25,7,10.75]){
          sash(b,x,1.02,5.32,1.30,1.32,PAINT.trim);
          sash(b,x,3.55,5.32,1.22,1.55,PAINT.trim);
        }
      });
      for(const level of [.48,3.18]){
        // Long seaward balconies, roofed guest-room gallery, narrow white rails.
        b.box(6.05,level,0,1.85,.16,26.8,PAINT.salt);
        b.beam(v(6.89,level+1,-13.35),v(6.89,level+1,13.35),.10,PAINT.trim);
        for(let i=0;i<=50;i++){
          const z=-13.3+i*.532;b.box(6.89,level+.52,z,.065,.95,.065,PAINT.white);
        }
      }
      for(let i=0;i<=7;i++)b.box(6.88,2.68,-13.3+i*3.80,.15,4.7,.15,PAINT.trim);
    }
  });
  b.at(-6.4,0,27.2,0,()=>house(b,7.4,6.6,4.56,2.18,PAINT.roof,PAINT.black,detail));
  b.at(-11.7,0,9.5,PI/2,()=>house(b,4.55,8.3,3.0,1.8,PAINT.roof,PAINT.black,detail));
}
function paintedMaterial(){
  const mat=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.86,metalness:.025});
  // Receding courses and staggered shingle ends disappear smoothly below one pixel.
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float clad; varying float vClad; varying vec3 vLocal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLocal=position;vClad=clad;');
    shader.fragmentShader='varying float vClad; varying vec3 vLocal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float row=vLocal.y*7.4, horizontal=(vLocal.x*.91+vLocal.z*.68)*4.8+mod(floor(row),2.)*.48;
      float aa=max(fwidth(row),.002), bx=max(fwidth(horizontal),.003);
      float course=1.-smoothstep(.025,.07+aa,min(fract(row),1.-fract(row)));
      float seam=1.-smoothstep(.025,.055+bx,min(fract(horizontal),1.-fract(horizontal)));
      float nearCourse=(1.-smoothstep(.20,.80,aa))*clamp(vClad,0.,1.);
      float nearSeam=(1.-smoothstep(.15,.65,bx))*nearCourse;
      diffuseColor.rgb*=1.-.15*nearCourse*course-.065*nearSeam*seam;`);
  };
  return mat;
}

export function addLighthouseScenery(scene:T.Scene,terrain:Terrain){
  const paint=paintedMaterial();
  const glazing=new T.MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:.22,metalness:.12,
    transparent:true,opacity:.42,depthWrite:false,side:T.FrontSide});
  const stations:T.LOD[]=[];
  for(const key of ['east','west'] as const){
    const west=key==='west',s=LIGHT_STATIONS[key],p=project(s.lon,s.lat);
    const station=new T.LOD();station.name=s.name;station.position.set(p.x,terrain.meshElevation(p.x,p.z)+.12,p.z);
    for(const detail of [true,false]){
      const b=new Batch(),panes=new Batch(),group=new T.Group();
      const yaw=west?-2.635:.32;
      b.at(0,0,0,yaw,()=>{
        panes.at(0,0,0,yaw,()=>tower(b,panes,west,detail));
        if(west)westInn(b,detail);
      });
      if(!west)eastHouse(b,detail);
      const solids=b.finish(paint);solids.name=s.name+' · painted exterior';group.add(solids);
      if(panes.pos.length)group.add(panes.finish(glazing));
      station.addLevel(group,detail?0:750,detail?0:.08);
    }
    station.addLevel(new T.Group(),8500,.06);
    scene.add(station);stations.push(station);
  }
  return stations;
}
