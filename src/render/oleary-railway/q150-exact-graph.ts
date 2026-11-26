/** Lock the exact four paint submissions before aggregate triangles may be omitted. */
import {BufferAttribute,Mesh,MeshStandardMaterial,type Scene} from 'three';
import type {buildDetachedQ150WholeStudy} from './q150-wing.ts';
import {Q150} from './q150-plan.generated.ts';

const [X,Z]=Q150.frame.gameOrigin;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as const;
const world=[1,0,0,0,0,1,0,0,0,0,1,0,X,32,Z,1] as const;
const exact=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
type Study=ReturnType<typeof buildDetachedQ150WholeStudy>;
function sealLeaf(node:unknown){
 if(!(node instanceof Mesh)||!(node.material instanceof MeshStandardMaterial))return;
 const g=node.geometry,m=node.material,sphere=g.boundingSphere,color=m.color;
 if(!sphere||g.boundingBox)return;
 const {radius,center:origin}=sphere,[cx,cy,cz]=origin.toArray();
 const [r,green,b]=color.toArray();
 const slots=['position','normal','color'].map(key=>{
  const a=g.getAttribute(key);
  if(!(a instanceof BufferAttribute)||!(a.array instanceof Float32Array)||a.itemSize!==3||a.normalized)return;
  const {array,version,count}=a;
  return ()=>g.getAttribute(key)===a&&a.array===array&&a.version===version&&a.count===count&&a.itemSize===3&&!a.normalized;
 });
 if(slots.some(s=>!s))return;
 const {version,side,metalness,roughness,onBeforeCompile,customProgramCacheKey}=m;
 const before=node.onBeforeRender,after=node.onAfterRender,paintHook=m.onBeforeRender;
 return ()=>node.geometry===g&&node.material===m&&node.visible&&node.layers.mask===1&&
  node.onBeforeRender===before&&node.onAfterRender===after&&m.onBeforeRender===paintHook&&
  node.frustumCulled&&node.renderOrder===0&&!node.castShadow&&!node.receiveShadow&&!node.children.length&&
  g.index===null&&g.groups.length===0&&g.drawRange.start===0&&g.drawRange.count===Infinity&&
  Object.keys(g.attributes).length===slots.length&&slots.every(s=>s?.())&&
  !g.boundingBox&&g.boundingSphere===sphere&&sphere.center===origin&&sphere.radius===radius&&origin.x===cx&&origin.y===cy&&origin.z===cz&&
  m.visible&&!m.transparent&&m.opacity===1&&m.colorWrite&&m.depthTest&&m.depthWrite&&m.vertexColors&&
  !m.wireframe&&!m.stencilWrite&&!m.polygonOffset&&!m.clippingPlanes&&m.alphaTest===0&&!m.alphaHash&&
  m.side===side&&m.version===version&&m.metalness===metalness&&m.roughness===roughness&&
  m.onBeforeCompile===onBeforeCompile&&m.customProgramCacheKey===customProgramCacheKey&&
  m.color===color&&color.r===r&&color.g===green&&color.b===b&&
  !m.map&&!m.envMap&&!m.normalMap&&!m.alphaMap&&!m.displacementMap;
}
export function exactWarehouseGraph(model:Study){
 const root=model.group,one=model.main.group,two=model.wing.group;
 const rows=[...one.children,...two.children],proofs=rows.map(sealLeaf);
 const shape=()=>{
  if(root.children.length!==2||root.children[0]!==one||root.children[1]!==two||rows.length!==4||
     one.children.length!==3||two.children.length!==1||!one.visible||!two.visible||
     root.matrixWorldAutoUpdate!==true||root.matrixAutoUpdate!==true||root.layers.mask!==1)return false;
  if(root.parent&&(!(root.parent as Scene).isScene||!root.parent.matrixWorldAutoUpdate||!root.parent.visible))return false;
  if(!proofs.every(p=>p?.()))return false;
  for(const [i,node] of rows.entries())if(node.parent!==(i<3?one:two))return false;
  if(![one,two,...rows].every(q=>q.matrixAutoUpdate&&q.matrixWorldAutoUpdate&&q.layers.mask===1))return false;
  root.updateWorldMatrix(true,true);
  // Only the root visibility is controlled by the cohort mask.
  return exact(root.matrix.elements,identity)&&exact(root.matrixWorld.elements,identity)&&
   [one,two].every(q=>exact(q.matrix.elements,world)&&exact(q.matrixWorld.elements,world))&&
   rows.every(q=>exact(q.matrix.elements,identity)&&exact(q.matrixWorld.elements,world));
 };
 if(!model.intact()||!shape()){model.dispose();return;}
 return {group:root,intact:()=>model.intact()&&shape(),dispose:model.dispose};
}
