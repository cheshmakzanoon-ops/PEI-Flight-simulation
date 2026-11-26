import type { BufferAttribute, BufferGeometry, Mesh, Scene, ShaderMaterial } from 'three';

export const FOUNDERS_WEST=Object.freeze({
 id:'q120010',atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 offset:2315907,bytes:31680,rows:669,bounds:[-63.121014,46.229939,-63.081134,46.248197] as const,
 ordinal:313,vertices:41007,first:23004,last:23010,xz:[6071.882739,29628.37504] as const,
 wire:'d06f88504309e7251d901e1ae2213cf2bb42fb57fd3a82e29ac5e9e1793c1e34',
 row:'8d1316262a304ad84eea4bde610a9d10a3c4d3373f0bdba08510924104ba08e0',
});
const StandardPanel=Object.freeze({
 vertex:'83fc669d8164768e4dc1af5c2e75386baf6805d44a30ae52ccc55695112603f4',
 fragment:'347e309397214ca9e59bc504acc0dd55e8fbdb694fb4593dd1815025c311fe9b',
 buffers:{
  position:['7d6990e664e0eb1519c58ebbb2a4562e367e0936206e9048d112bd3b3270cc17',3,'Float32Array'],
  uv:['92108c7e856f2f5e3c25df9dda1c50f91529d3cb8c0b8f13fa3c3057ed05f798',2,'Float32Array'],
  color:['8aa3d6f47db10b29887deafdd1bebde160dc948a8d9379575da407551c0594b6',3,'Float32Array'],
  topFlag:['6870352cb7c7b206b250704f985bbf290e0da077631077c714cfce89b0c44e19',1,'Float32Array'],
  facadeStyle:['00ffb54e73f828115e946bf3ea01eca6767caa4d38a11a471013f556cd3f2c93',1,'Uint8Array'],
  normal:['9b6e2cb3beeced2c7689d9a85b4e096d02e75f978cfbd44f62d3a19dec328d87',3,'Float32Array'],
  townWallFit:['5711d7a061136473b2fbc294722b444963f230e78daf4da63e3bc35cadb494f5',3,'Int16Array'],
 } as const,
});
type Tile={id:string;offset:number;bytes:number;count:number;bounds:readonly number[]};
export function foundersWestTile(atlas:string|undefined,tile:Tile){
 const f=FOUNDERS_WEST;
 return !!globalThis.crypto?.subtle&&atlas===f.atlas&&tile.id===f.id&&tile.offset===f.offset&&tile.bytes===f.bytes&&
  tile.count===f.rows&&tile.bounds.length===4&&tile.bounds.every((n,i)=>n===f.bounds[i]);
}
export function exactBytes(a:ArrayBufferView<ArrayBufferLike>){
 return new Uint8Array(a.buffer,a.byteOffset,a.byteLength).slice().buffer;
}
export async function foundersHash(a:ArrayBuffer){
 const v=new Uint8Array(await crypto.subtle.digest('SHA-256',a));
 return Array.from(v,c=>c.toString(16).padStart(2,'0')).join('');
}
const full=(g:BufferGeometry)=>!g.index&&!g.indirect&&g.groups.length===0&&g.drawRange.start===0&&g.drawRange.count===Infinity&&
 g.attributes.position?.count===FOUNDERS_WEST.vertices;
type DrawSeed={owner:Mesh;scene:Scene;stock:ShaderMaterial;geometry:BufferGeometry};
/** A proof ticket binds the actual submitted nonindexed drawing, not a scene name. */
export function foundersOwnerCustody({owner,scene,stock,geometry}:DrawSeed){
 if(owner.geometry!==geometry||owner.material!==stock||!stock.isShaderMaterial||!full(geometry)||
  stock.transparent||!stock.depthWrite||!stock.depthTest||!owner.matrixAutoUpdate)return;
 if(Math.abs(owner.position.x-7593.816292645196)>1e-8||owner.position.y!==0||Math.abs(owner.position.z-29005.483906069145)>1e-8||
  owner.quaternion.x||owner.quaternion.y||owner.quaternion.z||owner.quaternion.w!==1||
  owner.scale.x!==1||owner.scale.y!==1||owner.scale.z!==1||owner.renderOrder!==0||
  Object.keys(stock.uniforms).sort().join(',')!=='townWallGain,townWallSky')return;
 const uniformGain=stock.uniforms.townWallGain,uniformSky=stock.uniforms.townWallSky,sky=uniformSky.value;
 if(!sky?.isTexture)return;
 const stream=Object.entries(geometry.attributes).map(([name,v])=>{
  const a=v as BufferAttribute;
  return {name,a,array:a.array,itemSize:a.itemSize,count:a.count,normalized:a.normalized,version:a.version};
 });
 if(stream.some(v=>v.itemSize<=0||v.count!==FOUNDERS_WEST.vertices||!ArrayBuffer.isView(v.array)))return;
 const position=owner.position.clone(),rotation=owner.quaternion.clone(),scale=owner.scale.clone();
 const layer=owner.layers.mask,order=owner.renderOrder;
 const vertex=stock.vertexShader,fragment=stock.fragmentShader,content=stock.uniforms;
 const stockVersion=stock.version;
 const live=(expected=stock)=>
  owner.parent===scene&&!scene.overrideMaterial&&owner.visible&&owner.geometry===geometry&&owner.material===expected&&
  owner.matrixAutoUpdate&&owner.layers.mask===layer&&owner.renderOrder===order&&
  owner.position.equals(position)&&owner.quaternion.equals(rotation)&&owner.scale.equals(scale)&&
  stock.uniforms.townWallGain===uniformGain&&stock.uniforms.townWallSky===uniformSky&&uniformSky.value===sky&&
  stock.version===stockVersion&&stock.vertexShader===vertex&&stock.fragmentShader===fragment&&stock.uniforms===content&&full(geometry)&&
  Object.keys(geometry.attributes).length===stream.length&&stream.every(v=>geometry.attributes[v.name]===v.a&&
   v.a.version===v.version&&v.a.array===v.array&&v.a.itemSize===v.itemSize&&v.a.count===v.count&&v.a.normalized===v.normalized);
 const authenticate=async()=>{
  const expected=Object.entries(StandardPanel.buffers);
  if(expected.length!==stream.length)return false;
  const text=new TextEncoder();
  const [v,f,...attrs]=await Promise.all([
   foundersHash(text.encode(vertex).buffer),foundersHash(text.encode(fragment).buffer),
   ...expected.map(async([name,[sha,size,type]])=>{
    const value=stream.find(a=>a.name===name);
    return !!value&&value.itemSize===size&&value.array.constructor.name===type&&
     await foundersHash(exactBytes(value.array))===sha;
   })
  ]);
  return v===StandardPanel.vertex&&f===StandardPanel.fragment&&attrs.every(q=>q===true);
 };
 return {live,vertex,fragment,content,authenticate};
}
export async function foundersWestWire(raw:ArrayBuffer,rows:readonly unknown[]){
 const f=FOUNDERS_WEST;
 if(raw.byteLength!==f.bytes||rows.length!==f.rows||rows[f.ordinal]===undefined)return false;
 const row=new TextEncoder().encode(JSON.stringify(rows[f.ordinal]));
 const [w,r]=await Promise.all([foundersHash(raw),foundersHash(row.buffer)]);
 return w===f.wire&&r===f.row;
}
