import {BufferAttribute,InterleavedBufferAttribute,LOD,Mesh,type BufferGeometry,type Group,type Scene} from 'three';

/** Hold the complete original rendered cohort, not just the two top
 * groups. Three LOD may change tier visibility, never any underlying part. */
export function pinChurchLensArt(root:Group,scene:Scene){
 const [lod,far]=root.children;
 if(!(lod instanceof LOD)||!far||root.children.length!==2)return;
 const levelMode=lod.autoUpdate,levels=lod.levels.slice(),levelParams=levels.map(l=>[l.distance,l.hysteresis,l.object] as const),dynamic=new Set([root,lod,far,...levels.map(l=>l.object)]);
 const pins:(()=>boolean)[]=[];
 root.traverse(n=>{
  const parent=n.parent,children=n.children.slice(),vis=n.visible,auto=n.matrixAutoUpdate,layers=n.layers.mask,order=n.renderOrder;
  const p=n.position.clone(),q=n.quaternion.clone(),s=n.scale.clone(),m=n.matrix.clone();
  pins.push(()=>n.parent===parent&&n.children.length===children.length&&children.every((a,i)=>n.children[i]===a)&&
   n.matrixAutoUpdate===auto&&n.layers.mask===layers&&n.renderOrder===order&&
   (dynamic.has(n)||n.visible===vis)&&n.position.equals(p)&&n.quaternion.equals(q)&&n.scale.equals(s)&&
   (auto||n.matrix.equals(m)));
  if(!(n instanceof Mesh))return;
  const g:BufferGeometry=n.geometry;
  const material=n.material,members=Array.isArray(material)?material.slice():[material],materialVisible=members.map(x=>x.visible),index=g.index,indexArray=index?.array,indexVersion=index?.version;
  const start=g.drawRange.start,count=g.drawRange.count,groups=g.groups.slice();
  const entries=Object.entries(g.attributes).map(([name,v])=>{
   const a=v as BufferAttribute|InterleavedBufferAttribute;
   return {name,a,array:a.array,version:a instanceof InterleavedBufferAttribute?a.data.version:a.version};
  });
  pins.push(()=>n.geometry===g&&n.material===material&&members.every((m,i)=>m.visible===materialVisible[i]&&(!Array.isArray(material)||material[i]===m))&&g.index===index&&index?.array===indexArray&&index?.version===indexVersion&&
   g.drawRange.start===start&&g.drawRange.count===count&&g.groups.length===groups.length&&groups.every((a,i)=>g.groups[i]===a)&&
   Object.keys(g.attributes).length===entries.length&&entries.every(({name,a,array,version})=>
    g.attributes[name]===a&&a.array===array&&(a instanceof InterleavedBufferAttribute?a.data.version:a.version)===version));
 });
 return ()=>root.parent===scene&&lod.autoUpdate===levelMode&&lod.visible!==far.visible&&(!lod.visible||levels.some(l=>l.object.visible))&&
  lod.levels.length===levels.length&&levels.every((l,i)=>lod.levels[i]===l&&l.distance===levelParams[i][0]&&l.hysteresis===levelParams[i][1]&&l.object===levelParams[i][2])&&pins.every(ok=>ok());
}
