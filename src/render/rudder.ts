import * as THREE from 'three';
import {clamp,RAD} from '../sim/geo.ts';
import {deflectionAt} from './flight-surfaces.ts';

type Section = readonly [height:number, aft:number];
const OUTLINE:readonly Section[]=[[.11,3.30],[.68,3.93],[1.94,4.66],[2,5.07],[1.79,5.34],[.18,5.43]];
const PAINT:readonly (readonly Section[])[]=[
 [[1.15,4.20],[1.45,4.36],[1.46,5.36],[1.19,5.38]],
 [[1.69,4.51],[1.94,4.66],[2,5.07],[1.75,5.32]]
];
const hinge=(y:number)=>5.12+(y-.25)*.036;
const GAP=.007;
export const rudderDeflection=(yaw:number)=>clamp(yaw,-1,1)*22*RAD;

function clip(points:readonly Section[],signed:(p:Section)=>number){
  const result:Section[]=[];
  let last=points.at(-1)!, dLast=signed(last);
  for(const p of points){
    const d=signed(p);
    if((d>=0)!==(dLast>=0)){
      const f=dLast/(dLast-d);
      result.push([last[0]+(p[0]-last[0])*f,last[1]+(p[1]-last[1])*f]);
    }
    if(d>=0)result.push(p);
    last=p;dLast=d;
  }
  return result;
}

/** Closed original stabilizer shells. Only the aft shell is animated. */
export function createRudder(root:THREE.Group,teal:THREE.Material,ochre:THREE.Material,ivory:THREE.Material){
  const pivot=new THREE.Vector3(0,.25,hinge(.25));
  const axis=new THREE.Vector3(0,1,.036).normalize();
  const moving=new THREE.Group();moving.name='Survey aircraft rudder';moving.position.copy(pivot);root.add(moving);
  function part(points:readonly Section[],parent:THREE.Group,origin:THREE.Vector3,material:THREE.Material,
      sides:readonly number[],cap:boolean){
    if(points.length<3)return;
    const verts:number[]=[],indices:number[]=[];
    const n=points.length;
    for(const side of sides){
      const k=verts.length/3;
      for(const [y,z] of points)verts.push(side*(.09-.026*y+(cap?0:.001))-origin.x,y-origin.y,z-origin.z);
      for(let i=1;i<n-1;i++)indices.push(k,side>0?k+i:k+i+1,side>0?k+i+1:k+i);
    }
    if(cap)for(let i=0;i<n;i++){
      const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    g.setIndex(indices);g.computeVertexNormals();
    const m=new THREE.Mesh(g,material);m.castShadow=cap;m.receiveShadow=true;parent.add(m);return m;
  }
  const casters:THREE.Mesh[]=[];
  for(const [aft,parent,origin] of [[false,root,new THREE.Vector3()],[true,moving,pivot]] as const){
    const onSide=(p:Section)=>(aft?1:-1)*(p[1]-hinge(p[0]))-GAP;
    const shape=clip(OUTLINE,onSide);
    const m=part(shape,parent,origin,teal,[-1,1],true);if(m)casters.push(m);
    for(const [index,raw] of PAINT.entries()){
      // Constrain paint to the six established tail edges before opening the hinge.
      let paint=clip(raw,onSide);
      for(let i=0;i<OUTLINE.length&&paint.length;i++){
        const a=OUTLINE[i],b=OUTLINE[(i+1)%OUTLINE.length];
        paint=clip(paint,p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
      }
      part(paint,parent,origin,index===0?ochre:ivory,[-1,1],false);
    }
  }
  let angle=0;
  return {
    angle:()=>angle,casters,
    update(yaw:number,dt:number){
      angle=deflectionAt(angle,rudderDeflection(yaw),dt);
      moving.quaternion.setFromAxisAngle(axis,angle);
    }
  };
}
