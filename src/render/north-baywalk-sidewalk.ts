import * as THREE from 'three';
import { NORTH_CONCRETE as spec } from './north-baywalk-sidewalk.generated.ts';
import { BAYWALK_ANCHOR } from '../sim/baywalk-native.ts';
import { project } from '../sim/geo.ts';
import { splitWalkCap,sidewalkGrid } from './sidewalks.ts';
import type { World } from './world.ts';

type XZ={x:number;z:number};
type WalkVertex=XZ&{u:number;v:number};
export const NORTH_WALK_LIFT=.023;
const root=BAYWALK_ANCHOR;
const unit=(x:number,z:number)=>{const l=Math.hypot(x,z);return {x:x/l,z:z/l};};
const normal=(a:XZ,b:XZ)=>unit(b.z-a.z,a.x-b.x);
const span=(a:XZ,b:XZ)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(x:number)=>Math.min(1,Math.max(0,x));
export function surveyedConcretePlan(){
 const P=spec.points.map(p=>project(p[0],p[1]));
 const inlet=P[1],east=P[0],a=spec.eastThroatM/span(inlet,east);
 P[0]={x:inlet.x+(east.x-inlet.x)*a,z:inlet.z+(east.z-inlet.z)*a};
 const stations=[0],left:WalkVertex[]=[],right:WalkVertex[]=[];
 for(let i=0;i<P.length;i++){
  const a=i?normal(P[i-1],P[i]):normal(P[i],P[i+1]);
  const b=i===P.length-1?a:normal(P[i],P[i+1]);
  const m=unit(a.x+b.x,a.z+b.z),factor=Math.min(1.12,1/Math.max(.1,m.x*a.x+m.z*a.z));
  if(i)stations.push(stations[i-1]+span(P[i-1],P[i]));
  const edge=(side:number):WalkVertex=>({x:P[i].x+side*spec.halfWidthM*factor*m.x,
    z:P[i].z+side*spec.halfWidthM*factor*m.z,u:stations[i],v:side});
  left.push(edge(1));right.push(edge(-1));
 }
 return {centres:P,left,right,stations};
}

function weatheredConcrete(){
 const m=new THREE.MeshStandardMaterial({color:0xa39e8d,roughness:.94,metalness:0,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 m.customProgramCacheKey=()=> 'pei-concrete-short-sidewalk-v1';
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   varying vec2 vWalk;`).replace('#include <begin_vertex>',`#include <begin_vertex>
   vWalk=uv;`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec2 vWalk;
   float walkHash(vec2 p){vec3 a=fract(vec3(p.xyx)*vec3(.101,.113,.129));a+=dot(a,a.yxz+23.42);return fract((a.x+a.y)*a.z);}
   float walkNoise(vec2 xy){
    vec2 p=floor(xy),f=fract(xy);f*=f*(3.-2.*f);
    return mix(mix(walkHash(p),walkHash(p+vec2(1.,0.)),f.x),mix(walkHash(p+vec2(0.,1.)),walkHash(p+1.),f.x),f.y);
   }`).replace('#include <color_fragment>',`#include <color_fragment>
    // Thin expansion recesses and subtle broom texture are original artwork;
    // the map does not specify panel offsets or physical surface wear.
    vec2 q=vec2(vWalk.x,vWalk.y*.78);
    float d=max(length(dFdx(q)),length(dFdy(q)));
    float along=(q.x+.42)/2.58,phase=fract(along);
    float outline=min(phase,1.-phase);
    float edgeWidth=max(.002,fwidth(along));
    float kerf=(1.-smoothstep(.003,.017+edgeWidth*.65,outline))*(1.-smoothstep(.025,.15,d));
    float weather=walkNoise(q*vec2(.37,.83))-.5;
    float weatherB=walkNoise(q*vec2(1.9,3.8)+19.96)-.5;
    float pebbles=(walkNoise(q*26.)-.5)*(1.-smoothstep(.013,.081,d));
    float broom=(walkNoise(q*vec2(3.9,186.))-.5)*(1.-smoothstep(.003,.033,d));
    float edge=smoothstep(.82,.99,abs(vWalk.y));
    float tonal=.95+.15*weather+.10*weatherB+.090*pebbles+.094*broom-.20*kerf-.13*edge;
    diffuseColor.rgb*=vec3(tonal*1.013,tonal,tonal*.965);
   `);
 };
 return m;
}

export type NorthConcrete={mesh:THREE.Mesh;sync:()=>void};
export function buildNorthConcrete(world:World):NorthConcrete|undefined {
 if(!world.baywalkActive||!world.baywalkBounds)return;
 const {left,right,centres,stations}=surveyedConcretePlan(),parts:WalkVertex[]=[];
 const g={x0:world.baywalkBounds[0],z0:world.baywalkBounds[1],dx:.5,dz:.5},ordinary=sidewalkGrid(world.terrain);
 const land=(x:number,z:number)=>world.cover.distance(world.terrain,x,z)>=0;
 for(let i=1;i<centres.length;i++){
  const a=left[i-1],b=right[i-1],c=left[i],d=right[i];
  const t=Math.ceil((stations[i]-stations[i-1])/.13);
  for(let j=0;j<=t;j++){
   const u=j/t,px=a.x+(c.x-a.x)*u,pz=a.z+(c.z-a.z)*u;
   const qx=b.x+(d.x-b.x)*u,qz=b.z+(d.z-b.z)*u;
   for(let k=0;k<=8;k++)if(!land(px+(qx-px)*k/8,pz+(qz-pz)*k/8))return;
  }
  const emit=(A:WalkVertex,B:WalkVertex,C:WalkVertex)=>{
   for(const parentFace of splitWalkCap([A,B,C],ordinary))for(const shape of splitWalkCap(parentFace,g)){
    for(let q=1;q+1<shape.length;q++){
     const a=shape[0],b=shape[q],c=shape[q+1],area=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
     if(Math.abs(area)<1e-8)continue;
     parts.push(...(area>0?[a,c,b]:[a,b,c]));
    }
   }
  };
  emit(a,b,c);emit(c,b,d);
 }
 const xz=parts.flatMap(q=>[q.x-root.x,0,q.z-root.z]),tex=parts.flatMap(q=>[q.u,q.v]);
 const positions=new THREE.Float32BufferAttribute(xz,3).setUsage(THREE.DynamicDrawUsage),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',positions);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));
 const mesh=new THREE.Mesh(geometry,weatheredConcrete());
 mesh.name='Registered concrete sidewalk west from the Baywalk junction';
 const b:readonly [number,number,number,number]=[
   Math.min(...parts.map(q=>q.x)),Math.min(...parts.map(q=>q.z)),
   Math.max(...parts.map(q=>q.x)),Math.max(...parts.map(q=>q.z))];
 let stamp:string|undefined;
 function sync(){
  const s=world.visualGroundSignature(b);if(s===stamp)return;
  for(let i=0;i<parts.length;i++){
   const q=parts[i],v=clamp((Math.abs(q.v)-.84)/.16);
   positions.setY(i,world.visualGroundHeight(q.x,q.z)+NORTH_WALK_LIFT-.008*v*v);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();stamp=s;
 }
 sync();return {mesh,sync};
}
