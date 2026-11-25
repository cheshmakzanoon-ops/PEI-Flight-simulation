import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial,
  ShapeUtils, Vector2, Vector3,
} from 'three';
export type Uv=[number,number];
type Line=[number,number,number]; // a U + b V + c = 0
type Plane=Line;                // absolute Y = a U + b V + c
export type Role='main-track'|'main-rear'|'SW-track'|'SW-back'|'SW-tip'|'NE-track'|'NE-back';
type Hip={coefficients:number[];anchorU:number;inwardSign:number};
export type FitProof={
  atlasTile:string;atlasOrdinal:number;
  roofEnvelopeUV:Uv[];
  main:{coefficients:number[]};
  hips:{'hip-canopy-SW':Hip;'hip-canopy-NE':Hip};
  worldAdapter:{coefficientsFromUV1ToXZ:number[][];localOriginY:number};
  cutMasks:{bayQuarantine:{u:number[];vCeiling:number}};
};
const epsilon=2e-11;
const roleKeys:Role[]=['main-track','main-rear','SW-track','SW-back','SW-tip','NE-track','NE-back'];
const evalLine=(p:Line,q:Uv)=>p[0]*q[0]+p[1]*q[1]+p[2];
const negate=(p:Line):Line=>[-p[0],-p[1],-p[2]];
const diff=(p:Plane,q:Plane):Line=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]];
const near=(a:Uv,b:Uv)=>((a[0]-b[0])**2+(a[1]-b[1])**2)<1e-20;
function clip(poly:Uv[],line:Line){
  const out:Uv[]=[];
  if(poly.length===0)return out;
  function append(x:Uv){if(!out.length||!near(x,out[out.length-1]))out.push(x);}
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=evalLine(line,a),db=evalLine(line,b);
    if(da<=epsilon)append(a);
    if((da<-epsilon&&db>epsilon)||(da>epsilon&&db<-epsilon)){
      const w=da/(da-db);append([a[0]+w*(b[0]-a[0]),a[1]+w*(b[1]-a[1])]);
    }
  }
  if(out.length>1&&near(out[0],out[out.length-1]))out.pop();
  return out.length<3?[]:out;
}
const clipAll=(p:Uv[],...lines:Line[])=>lines.reduce((o,l)=>clip(o,l),p);
function edgeAlongV(a:Uv,b:Uv):Line{
  const slope=(b[0]-a[0])/(b[1]-a[1]);
  return [1,-slope,slope*a[1]-a[0]]; // negative to SW
}
const triangleArea=(p:[Uv,Uv,Uv])=>Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]))*.5;
const planeFamily=(r:Hip):Plane[]=>{
  const [h,v,a,b,end,slope]=r.coefficients;
  const sk=slope*r.inwardSign;
  return [[0,a,h-a*v],[0,-b,h+b*v],[sk,0,end-sk*r.anchorU]];
};
const studioColors:Record<Role,number>={
  'main-track':0x868078,'main-rear':0x7a7771,'SW-track':0x756f64,'SW-back':0x756f64,'SW-tip':0x756f64,
  'NE-track':0x756f64,'NE-back':0x756f64,
};
/**
 * Measured-datum, detached fit witness only. It emits no walls, accessibility,
 * precise roof finish, ground changes, entire envelope or release side effects.
 * Two incomplete areas remain deliberately cut open.
 */
export function makeRoofWitness(input:FitProof){
  if(input.atlasTile!=='q032122'||input.atlasOrdinal!==149||input.roofEnvelopeUV.length!==8)throw new Error('Bad Kensington witness identity');
  const r=input.roofEnvelopeUV;
  const swLimit=edgeAlongV(r[0],r[1]),neLimit=edgeAlongV(r[2],r[3]);
  const [[xx,zx],[xz,zz],[x0,z0]]=input.worldAdapter.coefficientsFromUV1ToXZ;
  const baseY=input.worldAdapter.localOriginY;
  const group=new Group();
  group.position.set(x0,baseY,z0);group.name='Kensington q149 (partial roof fit witness, not scenery)';
  const capNormals=new Map<Role,number>();
  const roleUv:Record<Role,Uv[][]>=Object.fromEntries(roleKeys.map(r=>[r,[]])) as unknown as Record<Role,Uv[][]>;
  const coordinates:Record<Role,number[]>=Object.fromEntries(roleKeys.map(r=>[r,[] as number[]])) as Record<Role,number[]>;
  const skipped:{bay:Uv[][];neTip:Uv[][]}={bay:[],neTip:[]};
  const pFrom=(uv:Uv,q:Plane)=>new Vector3(xx*uv[0]+xz*uv[1],evalLine(q,uv)-baseY,zx*uv[0]+zz*uv[1]);
  function add(poly:Uv[],eq:Plane,key:Role){
    for(let i=1;i+1<poly.length;i++){
      const uvs:[Uv,Uv,Uv]=[poly[0],poly[i],poly[i+1]];
      if(triangleArea(uvs)<epsilon)continue;
      const a=pFrom(uvs[0],eq),b=pFrom(uvs[1],eq),c=pFrom(uvs[2],eq);
      const nn=b.clone().sub(a).cross(c.clone().sub(a));
      if(nn.y<0){[uvs[1],uvs[2]]=[uvs[2],uvs[1]];[b.x,c.x]=[c.x,b.x];[b.y,c.y]=[c.y,b.y];[b.z,c.z]=[c.z,b.z];nn.negate();}
      capNormals.set(key,Math.min(capNormals.get(key)??1,nn.normalize().y));
      roleUv[key].push(uvs);
      coordinates[key].push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
    }
  }
  const [peak,dU,vRidge,rise,fall]=input.main.coefficients, [uBayMin,uBayMax]=input.cutMasks.bayQuarantine.u;
  const cutV=input.cutMasks.bayQuarantine.vCeiling;
  const tr:Plane=[dU,rise,peak-rise*vRidge],
        rear:Plane=[dU,-fall,peak+fall*vRidge],
        lV:Line=[0,1,-vRidge],bayL:Line=[1,0,-uBayMin], bayR:Line=[-1,0,uBayMax], bayV:Line=[0,-1,cutV];
  const mapS:Role[]=['SW-track','SW-back','SW-tip'],mapN:Role[]=['NE-track','NE-back'];
  const tris=ShapeUtils.triangulateShape(r.map(x=>new Vector2(...x)),[]);
  for(const ids of tris){
    const primitive=ids.map(i=>r[i]);
    const md=clipAll(primitive,negate(swLimit),neLimit);
    const t=clip(md,lV);
    add(clip(t,bayL),tr,'main-track');
    add(clip(t,bayR),tr,'main-track');
    const mid=clipAll(t,negate(bayL),negate(bayR));
    add(clip(mid,bayV),tr,'main-track');
    const hole=clip(mid,negate(bayV));if(hole.length)skipped.bay.push(hole);
    add(clip(md,negate(lV)),rear,'main-rear');
    for(const sw of [true,false]){
      const k=sw?'hip-canopy-SW':'hip-canopy-NE',meshPart=clip(primitive,sw?swLimit:negate(neLimit));
      const p=planeFamily(input.hips[k]);
      for(let i=0;i<3;i++){
        const face=clipAll(meshPart,...p.filter((_,j)=>j!==i).map(eq=>diff(p[i],eq)));
        if(!sw&&i===2){if(face.length)skipped.neTip.push(face);continue;}
        add(face,p[i],(sw?mapS:mapN)[i]);
      }
    }
  }
  for(const role of roleKeys){
    if(!coordinates[role].length)continue;
    const geo=new BufferGeometry();
    geo.setAttribute('position',new Float32BufferAttribute(coordinates[role],3));
    geo.setAttribute('uv',new Float32BufferAttribute(roleUv[role].flat(2),2));
    geo.computeVertexNormals();geo.computeBoundingSphere();
    const mat=new MeshStandardMaterial({name:role,color:studioColors[role],roughness:.94,side:DoubleSide});
    const m=new Mesh(geo,mat);m.name=role; group.add(m);
  }
  group.updateMatrixWorld(true);
  return {group,roleUv,skipped,minUpNormal:Object.fromEntries(capNormals)};
}
