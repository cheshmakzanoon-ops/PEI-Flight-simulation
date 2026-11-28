/** Detached two-side roof closure for one surveyed nave gap. No grade/site install. */
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,Vector3} from 'three';
import type {Plane,RoofRecipe} from './roof.ts';

type Side='north'|'south';
type Cell=[u:number,v:number,surface:number,predicted:number,residual:number];
type Strip={verticesUVH:[number,number,number][];cellsUVSurfacePredictionResidual:Cell[];
 gatePassed:boolean;containedWholeMosaicCells:number};
type NativeStrip={gatePassed:boolean;distinct:number;evidenceRows:Cell[]};
export type NaveSideEvidence={
 basis:{digestOfFrozenRoof:string;surfaceGrid:string;registeredMosaicFitBiasM:number};
 strips:Record<Side,Strip>;
 nativeReturns:{sourceSHA256:string;prelockSHA256:string;tighteningSHA256:string;results:Record<Side,NativeStrip>};
};
const oldDigest='4c61681c63bd89cbc611e15ccf15c6c7c1e92cfcf3a05a5d7405e0d96ea2f81c';
const left=3.36,right=5.20;
const frame=[-64153.759504797854,-50450.358425659266,0.9918788373397547,-0.18062023782840697,
 -0.18215613483334891,-0.9835161549563054] as const;
const sides=['north','south'] as const;
const exactOutline=[[-7.760971624422975,17.80187507692869],[-7.919616439622272,13.988187438456004],[-6.606736020882288,13.973126344445305],[-6.604742866360867,11.034131391961012],[-7.937703486179861,10.939855887594135],[-7.941162663118661,7.5497654333441835],[17.907426072575465,7.549765433344184],[22.516133857578147,8.624811824547752],[26.128936406169377,-7.5229532555800285],[21.985765403314343,-7.327208421797884],[21.75256964283623,-15.7611887826457],[17.214981986690994,-15.606033809375713],[17.236781342383257,-13.801651795513859],[-16.17884491262833,-12.864082261204338],[-16.067542029242496,-11.415208391893229],[-18.37376948448829,-11.330742088256688],[-18.11472496321976,-6.97037141710339],[-16.27777617505424,-7.081679095564149],[-14.959004046409246,18.219600486792444]] as const;
const exactRoofSides={
 north: [{"u":[-6.86,3.36],"v":[-0.92,5.28],"plane":[39.12669418785539,-0.03805231799690472,-1.2226619700522368]},{"u":[5.2,15.28],"v":[-0.92,5.28],"plane":[39.1243078408873,-0.04123367022794459,-1.2189010972493326]}],
 south: [{"u":[-6.86,3.36],"v":[-10.54,-4.91],"plane":[46.43057781769609,0.042659712859885957,1.2102053889269226]},{"u":[5.2,15.28],"v":[-10.54,-4.91],"plane":[46.39692815559933,0.03484578409246756,1.1990223464406167]}]
} as const;
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const read=(q:Plane,u:number,v:number)=>q[0]+q[1]*u+q[2]*v;
function reject():never{throw new RangeError('outside the checked Tignish side-join scope');}

export function sideJoinHeight(heights:readonly number[],s:number,t:number){
 if(heights.length!==4||![...heights,s,t].every(Number.isFinite)||s<0||s>1||t<0||t>1)
  return undefined;
 return heights[0]*(1-Math.max(s,t))+heights[2]*Math.min(s,t)
  +heights[1]*Math.max(0,s-t)+heights[3]*Math.max(0,t-s);
}
function quantile(v:readonly number[],p:number){
 const q=Array.from(v).sort((a,b)=>a-b),t=p*(q.length-1),n=Math.floor(t),f=t-n;
 return q[n]*(1-f)+q[Math.min(n+1,q.length-1)]*f;
}

export function makeTignishNaveSideJoins(roof:RoofRecipe,evidence:NaveSideEvidence){
 const bias=evidence.basis.registeredMosaicFitBiasM,N=evidence.nativeReturns;
 if(N?.sourceSHA256!=='09eda22dfaf066c630c39d268007f97fbc5ba6e962c93e35b71c800d7590b686'||
    N.prelockSHA256!=='c10e908497b1a04e2fc50eef33f9ea2fa3e82434b6ee0bf5e27365652d18e634'||N.tighteningSHA256!=='fb2cc8913e70d764c3bc73e37f14bfd28b7817e78e95305c8f729e6cecb1e2cb')reject();
 if(roof.owner!=='q221232/98'||roof.schema!==1||roof.patches.length!==11||
    evidence.basis.digestOfFrozenRoof!==oldDigest||
    evidence.basis.surfaceGrid!=='adf6c6d114d87b75a53d790ee0d00297639f485a01f60d8cd20a953afcd56e94'||
    !Number.isFinite(bias)||bias<.28||bias>.38)reject();
 const {world,localYOrigin}=roof,positions:number[]=[],roles:{side:Side;start:number;end:number}[]=[];
 const requested=[...world.worldXZAtUV00,...world.worldXZPerU,...world.worldXZPerV];
 if(localYOrigin!==30||roof.outlineUV.length!==19||roof.outlineUV.some((q,i)=>!same(q,exactOutline[i]))||requested.length!==frame.length||frame.some((v,i)=>v!==requested[i]))reject();
 for(const side of sides){
  const W=roof.patches.find(p=>p.id===`nave-${side}-west-segment`);
  const E=roof.patches.find(p=>p.id===`nave-${side}-east-segment`);
  if(!W||!E||W.u[1]!==left||E.u[0]!==right||W.planes.length!==1||E.planes.length!==1||
     W.v[0]!==E.v[0]||W.v[1]!==E.v[1])reject();
  const exact=exactRoofSides[side];
  if([W,E].some((p,i)=>!same(p.u,exact[i].u)||!same(p.v,exact[i].v)||!same(p.planes[0],exact[i].plane)))reject();
  const S=evidence.strips[side],[lo,hi]=W.v;
  const anchors=[[left,lo],[right,lo],[right,hi],[left,hi]];
  const heights=anchors.map(([u,v],i)=>read(i===1||i===2?E.planes[0]:W.planes[0],u,v));
  if(!S.gatePassed||S.containedWholeMosaicCells!==2||S.verticesUVH.length!==4||S.verticesUVH.some(([u,v,h],i)=>
   u!==anchors[i][0]||v!==anchors[i][1]||!Number.isFinite(h)||Math.abs(h-heights[i])>1e-11)||
   anchors.some(([u,v])=>Math.abs(read(W.planes[0],u,v)-read(E.planes[0],u,v))>.13))reject();
  const bands=new Set<number>(),keys=new Set<string>(),residual:number[]=[];
  for(const [u,v,s,provided,recorded] of S.cellsUVSurfacePredictionResidual){
   if(u<=left||u>=right||v<=lo||v>=hi||keys.has(u+':'+v))reject();
   const ex=sideJoinHeight(heights,(u-left)/(right-left),(v-lo)/(hi-lo));
   if(ex===undefined||![s,provided,recorded].every(Number.isFinite)||
      Math.abs(provided-ex)>1e-10||Math.abs(recorded-(s-ex-bias))>1e-10)reject();
   bands.add(Math.floor(v));keys.add(u+':'+v);residual.push(s-ex-bias);
  }
  const records=S.cellsUVSurfacePredictionResidual,abs=residual.map(Math.abs);
  if(records.length<8||records.length>20||bands.size<4||Math.abs(quantile(residual,.5))>.125||
   quantile(abs,.9)>.30||Math.max(...abs)>.60)reject();
  // Two full 1 m cells are not sufficient. Require the separately
  // frozen native building first-return test as well as the raster check.
  const Nras=N.results[side],rawErrors:number[]=[],slots=new Set<string>(),
   cross=new Set<number>(),bandsRaw=new Set<number>(),pointKeys=new Set<string>();
  if(!Nras.gatePassed||Nras.evidenceRows.length!==Nras.distinct||Nras.distinct<24||Nras.distinct>180)reject();
  for(const [u,v,hit,pred,raw] of Nras.evidenceRows){
   if(u<=left||u>=right||v<=lo||v>=hi||pointKeys.has(u+':'+v))reject();
   const r=(u-left)/(right-left),c=(v-lo)/(hi-lo);
   const control=sideJoinHeight(heights,r,c);
   if(control===undefined||![hit,pred,raw].every(Number.isFinite)||
     Math.abs(pred-control)>1e-10||Math.abs(raw-(hit-control))>1e-10)reject();
   const side=Math.floor((u-left)*2),band=Math.floor((v-lo)*2);
   cross.add(Math.floor(r*3));bandsRaw.add(band);slots.add(side+':'+band);pointKeys.add(u+':'+v);
   rawErrors.push(raw);
  }
  const rawAbs=rawErrors.map(Math.abs);
  if(slots.size<12||cross.size!==3||bandsRaw.size<6||Math.abs(quantile(rawErrors,.5))>.10||
     quantile(rawAbs,.9)>.27||Math.max(...rawAbs)>.45)reject();
  const corners=anchors.map(([u,v],i)=>new Vector3(
   world.worldXZPerU[0]*u+world.worldXZPerV[0]*v,
   heights[i]-localYOrigin,
   world.worldXZPerU[1]*u+world.worldXZPerV[1]*v));
  const start=positions.length/3;
  for(const [i,j,k] of [[0,1,2],[0,2,3]]){
   const [a,b,c]=[corners[i],corners[j],corners[k]];
   const cross=b.clone().sub(a).cross(c.clone().sub(a));
   if(Math.abs(cross.y)<1)reject();
   for(const p of cross.y>0?[a,b,c]:[a,c,b])positions.push(...p.toArray());
  }
  roles.push({side,start,end:positions.length/3});
 }
 const geo=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));
 geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
 const material=new MeshStandardMaterial({color:0x797b73,flatShading:true,roughness:.87});
 const mesh=new Mesh(geo,material),group=new Group();
 group.position.set(world.worldXZAtUV00[0],localYOrigin,world.worldXZAtUV00[1]);
 group.name='Tignish q221232/98 · paired side roof strips only';
 group.add(mesh);group.updateMatrixWorld(true);
 return {group,mesh,roles,dispose(){group.removeFromParent();geo.dispose();material.dispose();}};
}
