import * as THREE from 'three';
import {clamp, damp, RAD} from '../sim/geo.ts';

export interface SurfaceInput {pitch:number;roll:number;}
export const deflectionTarget=(input:SurfaceInput,side:number)=>{
  // Local Z trails aft. Positive rotation about +span (+X) lowers a surface.
  const roll=clamp(input.roll,-1,1),pitch=clamp(input.pitch,-1,1);
  const aileron=-side*roll;
  return {aileron:aileron*(aileron<0?21:16)*RAD,elevator:-pitch*19*RAD};
};
export function deflectionAt(current:number,target:number,dt:number){
  return damp(current,target,11,clamp(dt,0,.1));
}

export type AeroSection=readonly number[];
type Pos=readonly [number,number,number];

const GAP=.004;
/** Same section function as the closed original wings, restricted to a chord interval. */
function position(side:number,section:AeroSection,t:number,surface:number):Pos{
  const [span,y,leading,chord,thick,twist]=section;
  const h=5*thick*(.2969*Math.sqrt(t)-.126*t-.3516*t**2+.2843*t**3-.1036*t**4);
  return [span*side,y+chord*(surface*h+.02*Math.sin(Math.PI*t)+twist*t),leading+chord*t];
}

function panel(side:number,sections:readonly AeroSection[],min:number,max:number,pivot?:THREE.Vector3){
  const positions:number[]=[],indices:number[]=[];
  const count=16;
  for(const sec of sections){
    const ring:Pos[]=[];
    for(let i=0;i<=count;i++){
      const f=(1-Math.cos(Math.PI*i/count))/2;
      ring.push(position(side,sec,min+(max-min)*f,1));
    }
    for(let i=count;i>=0;i--){
      const f=(1-Math.cos(Math.PI*i/count))/2;
      const t=min+(max-min)*f;
      if(t>1-1e-8||t<1e-8)continue;
      ring.push(position(side,sec,t,-1));
    }
    for(const [x,y,z] of ring)positions.push(x-(pivot?.x??0),y-(pivot?.y??0),z-(pivot?.z??0));
  }
  const ring=positions.length/3/sections.length;
  for(let j=0;j<sections.length-1;j++)for(let i=0;i<ring;i++){
    const a=j*ring+i,b=j*ring+(i+1)%ring;
    indices.push(a,a+ring,b,b,a+ring,b+ring);
  }
  const end=(sections.length-1)*ring;
  for(let i=1;i<ring-1;i++)indices.push(0,i+1,i,end,end+i,end+i+1);
  if(side>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
function part(root:THREE.Group,g:THREE.BufferGeometry,m:THREE.Material){
  const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
/** Produce a cut-front skin and articulated rear skin. Purely visual, not a flight-force model. */
export function addFlightSurface(root:THREE.Group,side:number,sections:readonly AeroSection[],
  material:THREE.Material,cut:number,name:string){
  const fixed=part(root,panel(side,sections,0,cut-GAP),material);
  const pivot=new THREE.Vector3(...position(side,sections[0],cut,0));
  const tip=new THREE.Vector3(...position(side,sections.at(-1)!,cut,0));
  // Orient both hinges consistently from port to starboard, including sweep
  // and washout. The mesh uses its own local hinge origin to avoid sliding.
  const hinge=tip.sub(pivot).normalize().multiplyScalar(side);
  const moving=part(root,panel(side,sections,cut+GAP,1,pivot),material);
  moving.position.copy(pivot);moving.name=name;
  let angle=0;
  return {
    update(target:number,dt:number){angle=deflectionAt(angle,target,dt);moving.quaternion.setFromAxisAngle(hinge,angle);},
    angle:()=>angle,casters:[fixed,moving] as const
  };
}
