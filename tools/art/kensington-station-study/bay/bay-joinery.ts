import {
  BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute,
  Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Path, Shape, ShapeGeometry,
  Vector2,
} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {stationSurface} from '../swatches/surfaces';

const cY=1.60, r=.536, bottom=.50, face=.32, woodFace=.29, panes=.229;
const fg='#ddd5c1';
const semicircle=(x:number,y:number,a:number,start=0,end=Math.PI,n=32)=>{
  return Array.from({length:n+1},(_,i)=>{
    const k=start+(end-start)*i/n;
    return new Vector2(x+a*Math.cos(k),y+a*Math.sin(k));
  });
};
const sidePath=(x:number,y:number,r:number,b:number)=>[
  new Vector2(x-r,b),new Vector2(x+r,b),...semicircle(x,y,r),
];
const rect=(x0:number,y0:number,x1:number,y1:number)=>[
  new Vector2(x0,y0),new Vector2(x1,y0),new Vector2(x1,y1),new Vector2(x0,y1),
];
const shadeMortar=new MeshStandardMaterial({name:'dark joint and frame rebate',color:0x514839,roughness:.97});
const painted=stationSurface('painted-verge');painted.color.set(fg);
const jamb=stationSurface('wallace');jamb.color.set(0x9e896b);jamb.vertexColors=true;
const masonry=stationSurface('fieldstone');
const stoneSill=stationSurface('wallace');stoneSill.color.set(0x9a8c71);
const glass=new MeshPhysicalMaterial({name:'dark inset glass',color:0x1c2424,roughness:.25,metalness:.27,
  clearcoat:1,clearcoatRoughness:.19,envMapIntensity:.67});
const glassEdge=new MeshStandardMaterial({name:'recess black painted bead',color:0x363737,roughness:.66});
const items=new Map<MeshStandardMaterial,BufferGeometry[]>();
function add(g:BufferGeometry,m:MeshStandardMaterial,id=0){
  const raw=g.index?g.toNonIndexed():g.clone();g.dispose();
  const pos=raw.getAttribute('position');
  const uv= new Float32Array(pos.count*2), rgb=m.vertexColors?new Float32Array(pos.count*3):null;
  const tint=.82+.33*(Math.sin(id*45.67+.22)*.5+.5);
  for(let i=0;i<pos.count;i++){
    uv[i*2]=pos.getX(i);uv[i*2+1]=pos.getY(i);
    if(rgb){rgb[i*3]=tint;rgb[i*3+1]=tint*(.984+.016*Math.sin(id));rgb[i*3+2]=tint*(.968+.025*Math.sin(id+.75));}
  }
  raw.deleteAttribute('uv');
  raw.setAttribute('uv',new Float32BufferAttribute(uv,2));
  if(rgb)raw.setAttribute('color',new Float32BufferAttribute(rgb,3));
  const list=items.get(m)??[];list.push(raw);items.set(m,list);
}
function extrude(poly:Vector2[],holes:Vector2[][],z:number,depth:number,bevel=.0){
  const s=new Shape(poly);
  for(const h of holes)s.holes.push(new Path(h.slice().reverse()));
  return new ExtrudeGeometry(s,{
    depth,steps:1,curveSegments:8,bevelEnabled:bevel>0,
    bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,
  }).translate(0,0,z);
}
function box(x:number,y:number,z:number,w:number,h:number,d:number,mat:MeshStandardMaterial,id=0){
  add(new BoxGeometry(w,h,d).translate(x,y,z),mat,id);
}
function arcRing(start:number,end:number,r0:number,r1:number,y:number,n=4){
  return [...semicircle(0,y,r1,start,end,n),...semicircle(0,y,r0,start,end,n).reverse()];
}
function pane(points:Vector2[],z=panes){
  add(new ShapeGeometry(new Shape(points)).translate(0,0,z),glass);
}

/**
 * Detached development coupon. Origin, proportions and openings are artist-local,
 * not survey units, station vertices, a facade trace, or an installable building.
 */
export function makeKensingtonBayStudy(){
  items.clear();
  // The opening is actually cut through the wall, not a pasted dark arch.
  add(extrude(rect(-2.20,.08,2.20,3.26),[sidePath(0,cY,r,bottom)],-.013,face),masonry);
  // A shallow, cooled painted inner rebate at the jambs and head is deliberately
  // distinct from the dark joints between the dressed stones.
  add(extrude(sidePath(0,cY,r+.012,bottom-.022),[sidePath(0,cY,r-.021,bottom+.011)],.13,.117,.002),shadeMortar);
  // True masonry voussoir wedges with separated joints; varied coarse lengths
  // accommodate a distinctive, darker warm sandstone surround.
  const outer=r+.130;
  add(extrude(arcRing(0,Math.PI,r-.007,outer+.010,cY,40),[],face-.006,.019),shadeMortar);
  const slices=[.00,.229,.468,.716,.955,1.212,1.457,1.681,1.923,2.171,2.381,2.64,2.901,Math.PI];
  for(let i=0;i<slices.length-1;i++){
    const o=outer+(i===6?.023:0)+.008*Math.sin(i*1.938);
    const d=.034+.007*Math.sin(i*2.14);
    const w=arcRing(slices[i]+.0088,slices[i+1]-.0088,r-.007,o,cY,5);
    add(extrude(w,[],face-.016,d,.0038),jamb,i+3);
  }
  // Only subtle rough dressed jamb units, not pale blocks wider than the arch.
  const levels=[bottom+.003,.773,1.052,1.328,cY];
  for(const side of [-1,1])for(let i=0;i<levels.length-1;i++){
    const y0=levels[i],y1=levels[i+1],oth=r+(.100+.015*Math.sin(i*1.992+side*.5));
    add(extrude(rect(Math.min(side*(r-.003),side*oth),y0+.0025,
      Math.max(side*(r-.003),side*oth),y1-.0025),[],face-.017,.045,.004),jamb,side*7+i+11);
  }
  // Sloping, recessed underside and projected sill rather than a flat white decal.
  const sill=extrude(rect(-r-.158,bottom-.103,r+.158,bottom-.012),[],face-.087,.154,.009);
  const v=sill.getAttribute('position');
  for(let i=0;i<v.count;i++)if(v.getY(i)>bottom-.044)v.setY(i,v.getY(i)-.014*Math.max(0,(v.getZ(i)-.23)/.175));
  sill.computeVertexNormals();add(sill,stoneSill);
  box(0,bottom-.100,face+.03,2*(r+.112),.010,.087,shadeMortar);
  // Two levels of joinery. Lower raised frame plus distinct narrow beads at
  // the glass, continuous curved upper band and separate spring rail.
  add(extrude(sidePath(0,cY,r-.018,bottom+.015),[sidePath(0,cY,r-.078,bottom+.072)],woodFace-.065,.056,.004),painted);
  add(extrude(sidePath(0,cY,r-.074,bottom+.067),[sidePath(0,cY,r-.088,bottom+.081)],woodFace-.064,.022,.002),glassEdge);
  const inside=r-.079, spring=cY-.018;
  box(0,spring,woodFace-.039,inside*2+.007,.075,.065,painted);
  box(0,(bottom+.074+spring)/2,woodFace-.043,.056,spring-bottom-.058,.065,painted);
  box(0,spring+.216,woodFace-.046,.038,.452,.060,painted);
  const y0=bottom+.075,y1=spring-.021;
  pane(rect(-inside,y0,-.021,y1));pane(rect(.021,y0,inside,y1));
  const swing=inside-.003, theta=.023;
  pane([new Vector2(-swing,spring+.022),...semicircle(0,cY,swing,Math.PI-theta,Math.PI*.5+theta,32),new Vector2(-.012,spring+.022)]);
  pane([new Vector2(.012,spring+.022),...semicircle(0,cY,swing,Math.PI*.5-theta,theta,32),new Vector2(swing,spring+.022)]);
  box(0,1.30,-.028,1.38,1.82,.007,new MeshStandardMaterial({name:'unlit interior recess',color:0x27231d,roughness:.92}));
  const output=new Group();output.name='Kensington telegrapher joinery — detached artist coupon';
  for(const [mat,geometries] of items){
    const merged=mergeGeometries(geometries,false);
    if(!merged)throw new Error('Kensington arch coupon geometry attributes are inconsistent');
    for(const g of geometries)g.dispose();
    merged.computeBoundingSphere();
    const mesh=new Mesh(merged,mat);mesh.name=mat.name;
    mesh.castShadow=mesh.receiveShadow=true;output.add(mesh);
  }
  items.clear();
  return output;
}
