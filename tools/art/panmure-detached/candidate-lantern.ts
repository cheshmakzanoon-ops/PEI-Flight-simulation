/** Working shape variants of a non-operational lantern. Compass heading,
 * glazing order, fittings and skirt detail are interpreted, not surveyed. */
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PANMURE_DRAFT as proof} from './envelope.ts';
const deck=proof.deck-proof.datum;
// Gallery and pyramid are different roles in the train-only 2020 returns.
 // Work to the fitted main cap up to ~27.436 m, not the silhouette of its tip.
 const Y=[deck+.052,deck+.60,26.47-proof.datum,26.77-proof.datum,27.435-proof.datum] as const;
const radius=1.77,phase=Math.PI/12;
const up=new T.Vector3(0,1,0);
type XYZ=T.Vector3;

export function candidateLantern(sides:8|12, refined=false) {
 const group=new T.Group();group.name='Panmure · working '+sides+'-face lantern';
 const glaze=new T.MeshPhysicalMaterial({color:0xb2c4c9,roughness:.126,metalness:0,transmission:.63,thickness:.011,ior:1.49,
  clearcoat:.78,clearcoatRoughness:.12,side:T.DoubleSide});
 const iron=new T.MeshStandardMaterial({color:0x96382f,roughness:.53,metalness:.24});
 const rib=new T.MeshStandardMaterial({color:0xab4237,roughness:.57,metalness:.22});
 const edge=new T.MeshStandardMaterial({color:0x69271f,roughness:.64,metalness:.2});
 const lining=new T.MeshStandardMaterial({color:0xc5c2ad,roughness:.55,metalness:.17});
 const bumpCanvas=document.createElement('canvas');bumpCanvas.width=bumpCanvas.height=64;
 const ctx=bumpCanvas.getContext('2d')!,data=ctx.createImageData(64,64);
 let seed=10883;for(let k=0;k<data.data.length;k+=4){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const v=116+seed%24;data.data[k]=v;data.data[k+1]=v;data.data[k+2]=v;data.data[k+3]=255;
 }
 ctx.putImageData(data,0,0);
 const finish=new T.CanvasTexture(bumpCanvas);finish.wrapS=finish.wrapT=T.RepeatWrapping;
 finish.repeat.set(5,5);
 iron.bumpMap=rib.bumpMap=edge.bumpMap=finish;iron.bumpScale=.0032;rib.bumpScale=.0021;edge.bumpScale=.0021;
 const seal=new T.MeshStandardMaterial({color:0x343732,roughness:.8});
 const leafPaint=new T.MeshStandardMaterial({color:0xf0ebe0,roughness:.68});
 const at=(i:number,y:number,r=radius)=>new T.Vector3(Math.cos(i/sides*Math.PI*2+phase)*r,y,Math.sin(i/sides*Math.PI*2+phase)*r);
 const panel=(mat:T.Material,a:XYZ,b:XYZ,c:XYZ,d?:XYZ)=>{
  const p=(d?[a,b,c,a,c,d]:[a,b,c]).flatMap(v=>v.toArray());
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(d?[1,0,0,0,0,1,1,0,0,1,1,1]:[1,0,0,0,.5,1],2));
  g.computeVertexNormals();group.add(new T.Mesh(g,mat));
 };
 const bar=(a:XYZ,b:XYZ,r:number,material=rib,n=6)=>{
  const u=b.clone().sub(a);const o=new T.Mesh(new T.CylinderGeometry(r,r,u.length(),n),material);
  o.position.copy(a).addScaledVector(u,.5);o.quaternion.setFromUnitVectors(up,u.normalize());
  group.add(o);
 };
 const face=(i:number,s:number,y:number,r=radius)=>at(i,y,r).lerp(at(i+1,y,r),s);
 const decal=(i:number)=>{
  // Drawn as its own silhouette. No paint surface or graphic from the photo.
  const half=[[0,.5],[.067,.34],[.137,.368],[.116,.172],[.215,.235],[.245,.159],[.331,.176],[.312,.062],[.355,.023],[.192,-.123],[.22,-.201],[.066,-.176],[.023,-.316]];
  const contour=[...half,...half.slice(1).reverse().map(([x,y])=>[-x,y])].map(([x,y])=>new T.Vector2(x*.84,y*.73));
  const points=contour.map(v=>face(i,.5+v.x,Y[1]+.91+v.y,radius+.006));
  const triangles=T.ShapeUtils.triangulateShape(contour,[]);
  for(const [a,b,c] of triangles)panel(leafPaint,points[c],points[b],points[a]);
 };
 for(let i=0;i<sides;i++){
  const n=i+1,opaque=i===0||i===sides/2;
  panel(iron,at(n,Y[0]),at(i,Y[0]),at(i,Y[1]),at(n,Y[1]));
  panel(opaque?iron:glaze,at(n,Y[1]),at(i,Y[1]),at(i,Y[2]),at(n,Y[2]));
  panel(iron,at(n,Y[2]),at(i,Y[2]),at(i,Y[3],radius+.142),at(n,Y[3],radius+.142));
  const peak=new T.Vector3(0,Y[4],0);
  panel(iron,at(n,Y[3],radius+.142),at(i,Y[3],radius+.142),peak);
  bar(at(i,Y[1]-.018,radius+.022),at(i,Y[2]+.104,radius+.038),.026);
  if(i%2===0)bar(at(i,Y[2]+.11,radius+.042),at(i,deck+.97,2.98),.017);
  if(!refined)continue;
  // Two proud rolls make the fascia read as cast, not painted glass.
  bar(at(i,Y[3]-.014,radius+.151),at(n,Y[3]-.014,radius+.151),.034,edge);
  bar(at(i,Y[2]-.013,radius+.022),at(n,Y[2]-.013,radius+.022),.023);
  bar(at(i,Y[1]-.015,radius+.021),at(n,Y[1]-.015,radius+.021),.023);
  bar(at(i,Y[0]+.095,radius+.017),at(n,Y[0]+.095,radius+.017),.018,edge);
  // Slim pale interior glazing liner and seated gasket read through glass.
  if(opaque)decal(i);
  else for(const side of [.037,.963]){
   bar(face(i,side,Y[1]+.018,radius-.024),face(i,side,Y[2]-.018,radius-.024),.013,lining);
   bar(face(i,side,Y[1]+.007,radius+.006),face(i,side,Y[2]-.007,radius+.006),.008,seal);
  }
  for(const t of [.19,.81])bar(face(i,t,Y[2]-.041,radius+.029),face(i,t,Y[2]+.012,radius+.031),.010,edge);
  // Raised roof seam with separate cap reveal.
  bar(at(i,Y[3]+.008,radius+.148),new T.Vector3(0,Y[4]+.019,0),.011,rib);
 }
 if(refined){
  const dish=new T.Mesh(new T.CylinderGeometry(1.47,1.28,.115,sides),lining);
  dish.position.y=Y[2]-.26;group.add(dish);
  const innerFixture=new T.Mesh(new T.CylinderGeometry(.064,.080,.041,12),seal);
  innerFixture.position.y=Y[2]-.337;group.add(innerFixture);
  for(let i=0;i<sides;i+=2)bar(at(i,Y[2]-.253,1.40),at(i,Y[2]-.019,1.72),.012,lining);
  const ventBase=new T.Mesh(new T.CylinderGeometry(.124,.167,.23,14),rib);
  ventBase.position.y=Y[4]+.10;group.add(ventBase);
  const ventPoints=[[.015,-.31],[.072,-.25],[.106,-.15],[.142,.012],[.203,.20],[.227,.276],[.222,.288],[.203,.275],[.183,.16],[.128,-.014],[.097,-.17],[.002,-.26]];
  const vent=new T.Mesh(new T.LatheGeometry(ventPoints.map(([r,y])=>new T.Vector2(r,y)),20),rib);
  const direction=new T.Vector3(.82,.18,.32).normalize();
  vent.position.set(0,Y[4]+.275,0);vent.quaternion.setFromUnitVectors(up,direction);group.add(vent);
  const throat=new T.Mesh(new T.CircleGeometry(.107,16),seal);
  throat.position.copy(vent.position).addScaledVector(direction,.035);
  throat.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction);group.add(throat);
  const rod=new T.Vector3(.17,Y[4]+.71,.065);
  bar(new T.Vector3(.05,Y[4]+.32,.04),rod,.008,edge);
  bar(new T.Vector3(.222,Y[4]+.39,.13),rod,.007,edge);
 }
 const byMaterial=new Map<T.Material,T.Mesh[]>();
 for(const child of group.children){
  if(!(child instanceof T.Mesh)||child.material===glaze)continue;
  const pieces=byMaterial.get(child.material)??[];pieces.push(child);byMaterial.set(child.material,pieces);
 }
 for(const [material,pieces] of byMaterial){
  if(pieces.length<2)continue;
  const buffers=pieces.map(piece=>{
   piece.updateMatrix();
   return (piece.geometry.index?piece.geometry.toNonIndexed():piece.geometry.clone()).applyMatrix4(piece.matrix);
  });
  const merged=mergeGeometries(buffers);
  for(const b of buffers)b.dispose();
  if(!merged)throw new Error('Detached lantern geometry cannot be batched');
  merged.computeBoundingBox();merged.computeBoundingSphere();
  group.remove(...pieces);
  for(const piece of pieces)piece.geometry.dispose();
  group.add(new T.Mesh(merged,material));
 }
 group.userData.unverifiedFacetCount=sides;group.userData.operationalLight=false;
 return group;
}
