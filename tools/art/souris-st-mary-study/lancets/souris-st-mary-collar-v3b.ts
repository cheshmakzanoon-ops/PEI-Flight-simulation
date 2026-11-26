import * as T from 'three';
import { makeDetachedMaryGeometry as sealedMary, type MaryRole } from '../souris-saint-mary-forms.ts';
/** Standalone documented-form refinement, no stationing, reference assets or shader edits. */
type Point = [number,number];
const Z=25.6;
const windows=[[-4.37,7.47,13.26,1.85,1.02],[-.13,7.1,14.8,2.32,1.32],[4.11,7.52,13.26,1.85,.99]] as const;
const shapes=([x,base,s,r,d]:typeof windows[number], edge:number):Point[]=>{
  const w=d+edge,h=r+edge*.84;
  const k=(h*h-w*w)/(2*w),rad=w+k,last=Math.acos(k/rad);
  const a=Array.from({length:6},(_,i)=> {
    const t=last*i/5;
    return [i===5?0:-k+rad*Math.cos(t),s+rad*Math.sin(t)] as const;
  });
  return [[x-w,base-edge],[x+w,base-edge],...a.map(([u,v])=>[x+u,v] as Point),
           ...a.slice(0,-1).reverse().map(([u,v])=>[x-u,v] as Point)];
};
export const MARY_COLLAR_V3B=Object.freeze({
  approximateOnly:true, existingOutside:.230, outerToe:.405, shoulder:.317, projection:.114,nominalStudioFaceZ:Z,
});
export function makeDetachedMaryGeometryV3B(){
  const base=sealedMary();
  const stone=base.get('freestone')!;
  const points:number[]=[], normals:number[]=[], uv:number[]=[], targets:[number,number][]=[];
  const start=stone.attributes.position.count;
  const at=(a:Point,offset:number)=>new T.Vector3(a[0],a[1],Z+offset);
  const tri=(a:T.Vector3,b:T.Vector3,c:T.Vector3)=>{
    let n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if(n.z<0){const tmp=c;c=b;b=tmp;n=n.negate();}
    if(!(n.lengthSq()>.999999&&n.z>.002))throw Error('Invalid trim study wedge');
    for(const p of [a,b,c]){points.push(...p.toArray());normals.push(...n.toArray());uv.push(p.x,p.y);}
  };
  const quad=(p:Point[],q:Point[],a:number,b:number)=>{
    for(let j=0;j<p.length;j++){
      const k=(j+1)%p.length, A=at(p[j],a), B=at(p[k],a), C=at(q[k],b), D=at(q[j],b);
      tri(A,B,C);tri(A,C,D);
    }
  };
  for (const v of windows){
    const l=start+points.length/3;
    const outer=shapes(v,MARY_COLLAR_V3B.outerToe),mid=shapes(v,MARY_COLLAR_V3B.shoulder),inner=shapes(v,MARY_COLLAR_V3B.existingOutside);
    quad(outer,mid,0,MARY_COLLAR_V3B.projection);quad(mid,inner,MARY_COLLAR_V3B.projection,0);
    targets.push([l,start+points.length/3]);
  }
  const prep=(key:string,more:number[],stride:number)=>{
    const raw=stone.attributes[key].array, all=new Float32Array(raw.length+more.length);
    all.set(raw);all.set(more,raw.length);stone.setAttribute(key,new T.BufferAttribute(all,stride));
  };
  prep('position',points,3);prep('normal',normals,3);prep('uv',uv,2);
  stone.computeBoundingBox();stone.computeBoundingSphere();stone.userData.lancetRanges=targets;
  return base;
}
export function makeDetachedSaintMaryV3B(finish:(role:MaryRole)=>T.Material){
  const group=new T.Group();group.name='Souris.StMary.studio-only-three-collar-study';
  group.userData.role='author-observed-form-not-survey-or-game-seat';
  for(const [role,g] of makeDetachedMaryGeometryV3B()){
    const mesh=new T.Mesh(g,finish(role));mesh.name=g.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
