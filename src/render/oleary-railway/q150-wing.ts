/** O'Leary q150: detached, bounded low side mass. No current fittings,
 * material pattern or joinery inference. All positions use old N112. */
import * as T from 'three';
import {Q150} from './q150-plan.generated.ts';
import {Q150_WING} from './q150-wing-plan.generated.ts';
import {buildDetachedQ150Warehouse,type Q150NativeSeat} from './q150-warehouse.ts';

type P=readonly[number,number];
type V=readonly[number,number,number];
const [X,Z]=Q150.frame.gameOrigin, U=Q150.frame.gameU,W=Q150.frame.gameV;
const xy=([a,b]:P):P=>[a*U[0]+b*W[0],a*U[1]+b*W[1]];
const at=(p:P):P=>{const [x,z]=xy(p);return [x+X,z+Z];};
const datum=32;
export function buildDetachedQ150LowWing(ground:Q150NativeSeat){
 const q=Q150_WING.rimUV.map(p=>{
  const world=at(p),[x,z]=xy(p),Y=ground.height(...world);if(!Number.isFinite(Y)||Y<30.5||Y>33)throw Error('Unqualified q150 wing seat');
  const F=Q150_WING.plane,h=F.usedGameFitBaseY+F.hRiseMPerCrossM*(p[1]-F.referenceV);
  if(h-Y<3.81||h-Y>6.12)throw Error('Changed q150 wing datum');
  return {p,world,lower:[x,Y-.083-datum,z]as V,upper:[x,h-datum,z]as V};
 });
 for(let i=0;i<4;i++)if(ground.knots(q[i].world,q[(i+1)%4].world).some(s=>s>1e-8&&s<1-1e-8))throw Error('q150 wing left its pinned old planar facet');
 const positions:number[]=[],colors:number[]=[];
 const c={upper:new T.Color(0x898f8b),wall:new T.Color(0x969a93),underside:new T.Color(0x777c75)};
 const tri=(a:V,b:V,d:V,n:V,color:T.Color)=>{
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
  const sign=(u[1]*w[2]-u[2]*w[1])*n[0]+(u[2]*w[0]-u[0]*w[2])*n[1]+(u[0]*w[1]-u[1]*w[0])*n[2];
  if(Math.abs(sign)<1e-8)throw Error('Collapsed q150 wing face');
  for(const v of sign>0?[a,b,d]:[a,d,b]){positions.push(...v);colors.push(color.r,color.g,color.b);}
 };
 const quad=(a:V,b:V,d:V,e:V,n:V,color:T.Color)=>{tri(a,b,d,n,color);tri(a,d,e,n,color);};
 const [a,b,p,d]=q;
 quad(a.upper,b.upper,p.upper,d.upper,[0,1,0],c.upper);
 quad(a.lower,b.lower,p.lower,d.lower,[0,-1,0],c.underside);
 for(let j=0;j<q.length;j++){
  const o=q[j],p=q[(j+1)%q.length],n=xy([p.p[1]-o.p[1],o.p[0]-p.p[0]]);
  quad(o.lower,p.lower,p.upper,o.upper,[n[0],0,n[1]],c.wall);
 }
 const geo=new T.BufferGeometry(),pos=new T.Float32BufferAttribute(positions,3),col=new T.Float32BufferAttribute(colors,3);
 geo.setAttribute('position',pos);geo.setAttribute('color',col);geo.computeVertexNormals();geo.computeBoundingSphere();
 const nor=geo.getAttribute('normal') as T.BufferAttribute,v=nor.version;
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.07,side:T.FrontSide});
 material.name='q150 plain low mass';const group=new T.Group();group.name='O’Leary q150 verified closed low projection';
 group.position.set(X,datum,Z);const mesh=new T.Mesh(geo,material);mesh.name='q150 low supplemental core';group.add(mesh);
 let disposed=false;
 return {group,nativeSupportEdges:q.map((a,i)=>[a.world,q[(i+1)%q.length].world]as const),
  intact(){return !disposed&&group.children.length===1&&group.children[0]===mesh&&mesh.parent===group&&
   group.position.x===X&&group.position.y===datum&&group.position.z===Z&&mesh.geometry===geo&&mesh.material===material&&
   !geo.index&&geo.drawRange.start===0&&geo.drawRange.count===Infinity&&!geo.groups.length&&
   geo.getAttribute('position')===pos&&pos.version===0&&pos.count===36&&
   geo.getAttribute('color')===col&&col.version===0&&geo.getAttribute('normal')===nor&&nor.version===v&&
   !material.map&&!material.envMap&&material.opacity===1&&!material.transparent&&material.side===T.FrontSide&&
   !mesh.castShadow&&!mesh.receiveShadow&&mesh.visible;},
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();geo.dispose();material.dispose();}};
}

/** Private fixture only, not a runtime admission API. The three main draws
 * are attached unchanged and the closed low body is a fourth additive draw. */
export function buildDetachedQ150WholeStudy(ground:Q150NativeSeat){
 const model=buildDetachedQ150Warehouse(ground);
 try{
  const wing=buildDetachedQ150LowWing(ground),group=new T.Group();group.name='O’Leary q150 complete evidenced masses trial';
  group.add(model.group,wing.group);
  let dead=false;
  return {group,main:model,wing,scope:model.exactOwner,
   intact(){return !dead&&group.children.length===2&&group.children[0]===model.group&&group.children[1]===wing.group&&
    model.group.parent===group&&wing.group.parent===group&&model.intact()&&wing.intact();},
   dispose(){if(dead)return;dead=true;model.dispose();wing.dispose();group.removeFromParent();}};
 }catch(err){model.dispose();throw err;}
}
