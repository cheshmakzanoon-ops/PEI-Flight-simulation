import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Original panel enclosure for the fictional survey aircraft. Positive Z faces
 * the pilot. Dimensions align the stationary analog gauges with the face.
 */
export function createCockpitTrim(parent:THREE.Group){
  const powder=new THREE.MeshStandardMaterial({color:0x353735,roughness:.86,metalness:.12,emissive:0x323833,emissiveIntensity:.27});
  const vinyl=new THREE.MeshStandardMaterial({color:0x202423,roughness:.88,metalness:.01,emissive:0x282c29,emissiveIntensity:.19});
  const rail=new THREE.MeshStandardMaterial({color:0x797a6f,roughness:.58,metalness:.53});
  const side=new THREE.MeshStandardMaterial({color:0x4c4940,roughness:.89,emissive:0x2b2c28,emissiveIntensity:.21});
  // A small approximation of diffuse cabin bounce on shaded interior trim.
  // This is not an illuminated face or a change to face textures and needles.
  const group=new THREE.Group();group.name='Survey cockpit · instrument enclosure';parent.add(group);
  const pieces = new Map<THREE.Material,THREE.BufferGeometry[]>();
  const add=(g:THREE.BufferGeometry,m:THREE.Material)=>{
    const ge=g.index?g.toNonIndexed():g;
    if(ge!==g)g.dispose();
    const list=pieces.get(m)??[];list.push(ge);pieces.set(m,list);
  };
  function slab(outline:readonly (readonly [number,number])[],z:number,depth:number,bevel:number,material:THREE.Material){
    const shape=new THREE.Shape();
    outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
    shape.closePath();
    const geom=new THREE.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:4,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3});
    geom.translate(0,0,z);add(geom,material);
  }
  function strip(points:readonly (readonly [number,number,number])[], radius:number, material:THREE.Material){
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(path,20,radius,8,false),material);
  }
  // Recessed metal face stays behind all four instrument cards (z=-1.185).
  slab([[-.58,.25],[.58,.25],[.59,.43],[.51,.512],[-.51,.512],[-.59,.43]],-1.27,.073,.008,powder);
  // Rounded antiglare coaming. Wrapped ends surround the ends of the fascia.
  strip([[-.60,.37,-1.217],[-.54,.489,-1.193],[-.43,.53,-1.174],[0,.548,-1.161],
    [.43,.53,-1.174],[.54,.489,-1.193],[.60,.37,-1.217]],.023,vinyl);
  slab([[-.55,.33],[.55,.33],[.51,.52],[-.51,.52]],-1.43,.19,.014,vinyl);
  strip([[-.53,.257,-1.184],[0,.249,-1.177],[.53,.257,-1.184]],.006,rail);
  // Interior side panels cover the old see-through voids down to the sill.
  for(const s of [-1,1]){
    const x=.66*s;
    const a=[x,.18,-1.46],b=[x,.37,-1.46],c=[x,.48,-.62],d=[x,.18,-.55];
    const pts=s>0?[a,c,b,a,d,c]:[a,b,c,a,c,d];
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pts.flat(),3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(pts.length*2),2));
    g.computeVertexNormals();add(g,side);
    strip([[.58*s,.41,-1.46],[.625*s,.451,-1.15],[.66*s,.48,-.68]],.019,vinyl);
  }
  for(const [material,list] of pieces){
    const g=mergeGeometries(list);
    if(!g)throw new Error('Incompatible cockpit enclosure geometry');
    for(const part of list)part.dispose();
    const mesh=new THREE.Mesh(g,material);
    mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
