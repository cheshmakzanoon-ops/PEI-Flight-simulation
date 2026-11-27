/** Detached two-pair raster-closure study. No mesh/terrain/collider mutation.
 * Build the exact shader for an owned south tile only. Enable its scalar for
 * paint only with an admitted CURRENT equal-N112 original pair.
 */
export const PINNED_TERRAIN='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';
export const STOCK_TERRAIN_VERTEX=`
 varying vec3 p; varying vec2 vuv;
 #ifdef SOURCE_GRASS_NAP_METRIC
 varying vec3 shortGrassMetric;
 #endif
 #ifdef SURVEY_LIGHT
 attribute float surveyWeight; varying float vSurveyWeight; varying vec3 vSurveyNormal;
 #endif
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
 #ifdef SURVEY_LIGHT
 vSurveyWeight=surveyWeight;vSurveyNormal=mat3(modelMatrix)*normal;
 #endif
 #ifdef SOURCE_GRASS_NAP_METRIC
 shortGrassMetric=mat3(modelMatrix)*position;
 #endif
 vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;vuv=uv;gl_Position=projectionMatrix*viewMatrix*w;
 #include <logdepthbuf_vertex>
 }`;
export const RIM_UNIFORM='peiRegularNorthRimZ';
const anchor='gl_Position=projectionMatrix*viewMatrix*w;';
export const RIM_VERTEX='uniform highp float '+RIM_UNIFORM+';\n'+STOCK_TERRAIN_VERTEX.replace(anchor,
 `// Existing world/atlas varyings are already assigned. Only raster Z closes.
 if(peiRegularNorthRimZ > 0.0 && gl_VertexID > 0 && gl_VertexID < 112 && position.z == -2930.6103515625)
   w.z=peiRegularNorthRimZ;
 `+anchor);

const n=112, step=n+1, rimZ=2930.6103515625, rimX=3046.515380859375;
const F=Math.fround, atlasFootprint=[-64.47,45.94,-61.93,47.1];
const pairs=Object.freeze({
 '20-17':Object.freeze({south:'20-17',north:'20-16',j:17,canonical:32944.1015625,oldSouth:32944.10546875}),
 '20-19':Object.freeze({south:'20-19',north:'20-18',j:19,canonical:44666.54296875,oldSouth:44666.546875}),
});
type Pair=typeof pairs[keyof typeof pairs];
type AtlasFrame=Readonly<{left:number;top:number;right:number;bottom:number;
 spec:{bounds:readonly number[];width:number;height:number}}>;
type Attribute={
 readonly array:Float32Array|Uint16Array;count:number;itemSize:number;
 version:number;normalized:boolean;getX(i:number):number;getY(i:number):number;getZ(i:number):number;
};
type Shader={vertexShader:string;fragmentShader:string;isShaderMaterial:boolean;visible:boolean;depthTest:boolean;depthWrite:boolean;
 transparent:boolean;side:number;defines?:Record<string,unknown>};
type Geometry={type:string;index:Attribute|null;indirect?:unknown;groups:readonly unknown[];drawRange:{start:number;count:number};
 attributes:Record<string,Attribute>;parameters?:{width:number;height:number;widthSegments:number;heightSegments:number}};
type Mesh={userData:Record<string,unknown>;geometry:Geometry;material:unknown;visible:boolean;parent:unknown;
 matrixWorld:{elements:readonly number[]};position:{x:number;y:number;z:number};
 quaternion:{x:number;y:number;z:number;w:number};scale:{x:number;y:number;z:number}};
type RootScene={matrixWorld:{elements:readonly number[]};overrideMaterial?:unknown};
export type StockTile={id:string;i:number;j:number;lod:number;seams?:string;relief?:unknown;
 readonly local:Shader;fine?:Mesh;coarse:Mesh;x0:number;z0:number;w:number;d:number};
type Print={tile:StockTile;mesh:Mesh;shape:Geometry;pos:Attribute;index:Attribute;uv:Attribute;normal:Attribute;
 /** Stock owner must bump attribute versions on actual writes. */
 versions:readonly number[];arrays:readonly (Float32Array|Uint16Array)[];seams:string;
 readonly shader:Shader;readonly fragment:string;readonly defines:Readonly<Record<string,unknown>>|undefined};

function bySouth(id:string):Pair|undefined {
 return Object.prototype.hasOwnProperty.call(pairs,id)?pairs[id as keyof typeof pairs]:undefined;
}
function framing(T:AtlasFrame,sourceSha:string,p:Pair){
 if(sourceSha!==PINNED_TERRAIN||T.spec.width!==4096||T.spec.height!==2720||
    T.spec.bounds.length!==4||T.spec.bounds.some((v,k)=>v!==atlasFootprint[k]))return;
 const w=(T.right-T.left)/32,d=(T.bottom-T.top)/22;
 if(F(w/2)!==rimX||F(d/2)!==rimZ||F(T.top+p.j*d)!==p.canonical)return;
 return {w,d,x0:T.left+20*w};
}
/** Return a patch only in the production-style initial shader construction for
 * those two IDs and this exact original source program. All other materials,
 * including the north owners, use the identical source as before.
 */
export function patchRegularNorthRimVertex(source:string,id:string,T:AtlasFrame,terrainSha:string){
 const p=bySouth(id);
 return p&&source===STOCK_TERRAIN_VERTEX&&framing(T,terrainSha,p)?RIM_VERTEX:undefined;
}
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as const;
function exactMatrix(a:readonly number[],x=0,z=0){
 return a.length===16&&a.every((e,k)=>e===(k===12?x:k===14?z:identity[k]));
}
function readOwner(t:StockTile,scene:RootScene,T:AtlasFrame,f:{w:number;d:number;x0:number},id:string,j:number,
 edge:0|2,reuse?:Print):Print|undefined {
 // Proof acquisition only reads submitted geometry. Freshness check below
 // keeps references and versions; it will never read whole buffers per frame.
 if(t.id!==id||t.i!==20||t.j!==j||t.w!==f.w||t.d!==f.d||t.x0!==f.x0||
    t.z0!==T.top+j*f.d||t.lod!==n||t.relief||t.coarse.visible||!t.fine||!t.seams||
    !/^112:(?:8|56|112),(?:8|56|112),(?:8|56|112),(?:8|56|112)$/.test(t.seams)||
    Number(t.seams.slice(4).split(',')[edge])!==n||scene.overrideMaterial!=null||!exactMatrix(scene.matrixWorld.elements))return;
 const g=t.fine;
 const centerX=t.x0+t.w/2,centerZ=t.z0+t.d/2;
 if(!g.visible||g.parent!==scene||g.material!==t.local||g.position.x!==centerX||g.position.y!==0||g.position.z!==centerZ||
    g.quaternion.x!==0||g.quaternion.y!==0||g.quaternion.z!==0||g.quaternion.w!==1||
    g.scale.x!==1||g.scale.y!==1||g.scale.z!==1||
    !exactMatrix(g.matrixWorld.elements,centerX,centerZ)||g.userData.subdiv!==n||Object.keys(g.userData).length!==1)return;
 const mat=t.local;
 if(!mat.isShaderMaterial||!mat.visible||!mat.depthTest||!mat.depthWrite||mat.transparent||mat.side!==0||
    mat.defines?.SURVEY_LIGHT!==undefined||mat.defines?.SOURCE_GRASS_NAP_METRIC!==undefined||
    !(mat.vertexShader===STOCK_TERRAIN_VERTEX||(edge===0&&mat.vertexShader===RIM_VERTEX)))return;
 const s=g.geometry, p=s.attributes.position, i=s.index, uv=s.attributes.uv, norm=s.attributes.normal;
 const arg=s.parameters;
 if(s.type!=='PlaneGeometry'||!arg||arg.width!==f.w||arg.height!==f.d||arg.widthSegments!==n||arg.heightSegments!==n||
    s.indirect!=null||s.groups.length!==0||s.drawRange.start!==0||s.drawRange.count!==Infinity||Object.keys(s.attributes).length!==3||
    !p||!i||!uv||!norm||
    !(i.array instanceof Uint16Array)||i.itemSize!==1||i.count!==n*n*6||i.array.length!==i.count||i.normalized||i.version!==0)return;
 if([p,uv,norm].some((a,k)=>!(a.array instanceof Float32Array)||a.count!==step*step||
    a.itemSize!==(k===1?2:3)||a.array.length!==a.count*a.itemSize||a.normalized))return;
 const versions=[p.version,i.version,uv.version,norm.version], arrays=[p.array,i.array,uv.array,norm.array];
 if(reuse){
  if(t!==reuse.tile||g!==reuse.mesh||s!==reuse.shape||p!==reuse.pos||i!==reuse.index||
     uv!==reuse.uv||norm!==reuse.normal||t.seams!==reuse.seams||
     mat!==reuse.shader||mat.fragmentShader!==reuse.fragment||mat.defines!==reuse.defines||
     versions.some((q,k)=>q!==reuse.versions[k]||arrays[k]!==reuse.arrays[k]))return;
  return reuse;
 }
 // Compare exact untouched rim EBO spans on entry for trusted regular owner.
 // Other writes require the renderer's normal version/pointer ownership above.
 const row=edge===0?0:n-1, idx=i.array;
 for(let k=0;k<n;k++){
   const a=row*step+k,b=a+step,c=b+1,d=a+1,id=(row*n+k)*6;
   if(idx[id]!==a||idx[id+1]!==b||idx[id+2]!==d||idx[id+3]!==b||idx[id+4]!==c||idx[id+5]!==d)return;
 }
 return {tile:t,mesh:g,shape:s,pos:p,index:i,uv,normal:norm,versions,arrays,seams:t.seams,shader:mat,
         fragment:mat.fragmentShader,defines:mat.defines};
}
/** This returns the canonical Z or 0 for exact stock. Call acquire only
 * when geometry/seam custody changed, after normal LOD sewing and matrices
 * update. In the lab the caller holds the same actual camera/frame. Current
 * checks are no scan and no mutation; inactive/different LOD is always stock.
 */
export function acquireRegularNorthRimClip(T:AtlasFrame,terrainSha:string,scene:RootScene,north:StockTile,south:StockTile){
 const p=bySouth(south.id), f=p&&framing(T,terrainSha,p);
 if(!p||!f)return;
 const a=readOwner(north,scene,T,f,p.north,p.j-1,2);
 const b=readOwner(south,scene,T,f,p.south,p.j,0);
 if(!a||!b)return;
 // North is already the shared canonical bank of the raster edge. Never
 // edit it. The extreme endpoint IDs 0/112 on south deliberately stay stock
 // so its unrelated east/west shared corners have their exact old position.
 const idealLocalX=(k:number)=>F(k*(f.w/n)-f.w/2);
 const i0=n*step,near=F(a.mesh.position.z),far=F(b.mesh.position.z);
 for(let k=0;k<=n;k++){
    const x=a.pos.getX(i0+k),xx=b.pos.getX(k),y=a.pos.getY(i0+k),yy=b.pos.getY(k);
    const z=a.pos.getZ(i0+k),zz=b.pos.getZ(k);
    if(x!==xx||x!==idealLocalX(k)||!Number.isFinite(y)||!Number.isFinite(yy)||y!==yy||
       z!==rimZ||zz!==-rimZ||F(near+z)!==p.canonical||F(far+zz)!==p.oldSouth)return;
 }
 return Object.freeze({
   target:p, mesh:b.mesh, canonicalClippedVertices:111, protectedCorners:[0,112] as const,
   value():number{
     return framing(T,terrainSha,p)&&readOwner(north,scene,T,f,p.north,p.j-1,2,a)&&
         readOwner(south,scene,T,f,p.south,p.j,0,b)?p.canonical:0;
   },
 });
}
/** CPU mirror for exact-gain tests; this is not the physics or ground sampler. */
export function clipWorldZOnOwnedRim(posZ:number,glVertexID:number,oldZ:number,activeSnapValue:number){
 return activeSnapValue>0&&glVertexID>0&&glVertexID<112&&posZ===-rimZ?activeSnapValue:oldZ;
}
