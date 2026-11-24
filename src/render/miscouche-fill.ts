import * as T from 'three';
import {MISCOUCHE_CROWNS,MISCOUCHE_PROOF as spec} from './miscouche-fill.generated.ts';
type Ground=(x:number,z:number)=>number|undefined;
const ease=(n:number)=>{const q=Math.min(1,Math.max(0,n));return q*q*(3-2*q);};
export function createMiscoucheFill(scene:T.Scene,base:T.ShaderMaterial,seat:Ground){
 const total=MISCOUCHE_CROWNS.length;
 const stems=new Float32Array(total*3),shapes=new Float32Array(total*4);
 const bound=new T.Box3();
 let farTop=-Infinity,lastEpoch=-1,seatsValid=true,readySince=Infinity;
 for(const [i,[x,z,h,w]] of MISCOUCHE_CROWNS.entries()){
  const y=seat(x,z);
  if(y===undefined||!Number.isFinite(y)||y<2||y>30)return;
  stems.set([x,y-.16,z],3*i);
  shapes.set([h,w,i%9<4?1:i%9<7?0:2,.86+.19*((i*2251)%997)/997],4*i);
  const R=.5*Math.hypot(w,Math.max(w,1.04*h));
  farTop=Math.max(farTop,y+.65*h+.5*Math.max(w,1.04*h));
  bound.expandByPoint(new T.Vector3(x-R,1.84,z-R));
  bound.expandByPoint(new T.Vector3(x+R,30+.65*h+.5*Math.max(w,1.04*h),z+R));
 }
 const anchor='clamp((a-.30)*3.8,0.,1.)';
 if(!base.fragmentShader.includes(anchor))return;
 const mat=base.clone();
 // Use the already owned atlas texture; clone() would give this material
 // a detached sampler object that could own a second upload.
 mat.uniforms={...base.uniforms,fillAlpha:{value:0}};
 mat.fragmentShader='uniform float fillAlpha;\n'+base.fragmentShader.replace(anchor,anchor+'*fillAlpha');
 const plane=new T.PlaneGeometry(),g=new T.InstancedBufferGeometry();
 g.index=plane.index;g.setAttribute('position',plane.getAttribute('position'));g.setAttribute('uv',plane.getAttribute('uv'));
 g.setAttribute('stem',new T.InstancedBufferAttribute(stems,3));
 g.setAttribute('shape',new T.InstancedBufferAttribute(shapes,4));
 g.boundingSphere=bound.getBoundingSphere(new T.Sphere());g.instanceCount=total;
 const mesh=new T.Mesh(g,mat);
 mesh.name='Miscouche dense canopy support';mesh.visible=false;scene.add(mesh);
 return {
  mesh,total,get gain(){return mat.uniforms.fillAlpha.value as number;},
  update(eye:T.Vector3,authorized:boolean,epoch:number,now:number){
   if(authorized&&lastEpoch!==epoch){
    lastEpoch=epoch;
    let invalid=false;
    for(const [i,[x,z,h,w]] of MISCOUCHE_CROWNS.entries()){
     const y=seat(x,z);if(y===undefined||!Number.isFinite(y)||y<2||y>30){invalid=true;continue;}
     stems[i*3+1]=y-.16;
     farTop=Math.max(farTop,y+.65*h+.5*Math.max(w,1.04*h));
    }
    g.getAttribute('stem').needsUpdate=true;
    seatsValid=!invalid;
   }
   const d=Math.hypot(eye.x-spec.center[0],eye.z-spec.center[1]);
   if(!authorized||!seatsValid||!Number.isFinite(now))readySince=Infinity;
   else if(readySince===Infinity)readySince=now;
   const alpha=Number.isFinite(readySince)?ease((now-readySince)/420)*ease((740-d)/210)*ease((eye.y-farTop-2)/10)*ease((970-eye.y)/280):0;
   mesh.visible=Number.isFinite(alpha)&&alpha>.001;
   mat.uniforms.fillAlpha.value=mesh.visible?alpha:0;
  },
  dispose(){mesh.removeFromParent();g.dispose();mat.dispose();}
 };
}
