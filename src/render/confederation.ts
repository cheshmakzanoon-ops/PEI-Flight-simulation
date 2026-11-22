import * as THREE from 'three';
import { bridgeAt, BRIDGE_LENGTH, NAV_SPAN } from '../sim/confederation.ts';

const WIDTH = 11;
type Point = ReturnType<typeof bridgeAt>;

/** Original visual model, not a survey of the bridge's structural components. */
export function addConfederationBridge(scene: THREE.Scene) {
  const bridge = new THREE.Group();
  bridge.name = 'Confederation Bridge';
  const deck = new THREE.MeshStandardMaterial({color:0x586063,roughness:.92,side:THREE.DoubleSide});
  const concrete = new THREE.MeshStandardMaterial({color:0xa5a398,roughness:.82,side:THREE.DoubleSide});
  const line = new THREE.MeshStandardMaterial({color:0xbc9451,roughness:.85,side:THREE.DoubleSide});
  const dark = new THREE.MeshStandardMaterial({color:0x716f65,roughness:.94,side:THREE.DoubleSide});
  const verts=(a:Point,w:number,h:number)=>[a.x-a.dz*w,a.y+h,a.z+a.dx*w] as const;
  const push=(arr:number[], a:readonly number[],b:readonly number[],c:readonly number[],d:readonly number[])=>{
    arr.push(...a,...b,...c,...a,...c,...d);
  };
  function paint(arr:number[],mat:THREE.Material) {
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
    geom.computeVertexNormals();geom.computeBoundingSphere();
    const mesh=new THREE.Mesh(geom,mat);bridge.add(mesh);
  }
  const asphalt:number[]=[], edges:number[]=[], stripe:number[]=[], under:number[]=[];
  const n=Math.ceil(BRIDGE_LENGTH/22);
  const highSpanDepth=(distance:number)=> {
    const d=(distance-NAV_SPAN+125)/250;
    return 4.5+6.2*Math.pow(Math.abs(2*(d-Math.floor(d)) -1),2);
  };
  for(let i=0;i<n;i++){
    const s=i*BRIDGE_LENGTH/n,t=(i+1)*BRIDGE_LENGTH/n,a=bridgeAt(s),b=bridgeAt(t),half=WIDTH/2;
    push(asphalt,verts(a,-half,0),verts(b,-half,0),verts(b,half,0),verts(a,half,0));
    push(under,verts(a,-2.65,-highSpanDepth(s)),verts(a,2.65,-highSpanDepth(s)),verts(b,2.65,-highSpanDepth(t)),verts(b,-2.65,-highSpanDepth(t)));
    for(const sign of [-1,1]){
      push(edges,verts(a,sign*half,-.18),verts(b,sign*half,-.18),verts(b,sign*2.65,-highSpanDepth(t)),verts(a,sign*2.65,-highSpanDepth(s)));
      push(edges,verts(a,sign*(half+.16),.96),verts(b,sign*(half+.16),.96),verts(b,sign*(half+.16),-.18),verts(a,sign*(half+.16),-.18));
      push(edges,verts(a,sign*(half-.26),.96),verts(b,sign*(half-.26),.96),verts(b,sign*(half+.16),.96),verts(a,sign*(half+.16),.96));
      push(edges,verts(a,sign*(half-.26),.96),verts(a,sign*(half-.26),-.03),verts(b,sign*(half-.26),-.03),verts(b,sign*(half-.26),.96));
    }
  }
  for(let s=8;s<BRIDGE_LENGTH-8;s+=19){
    const a=bridgeAt(s),b=bridgeAt(s+8);
    push(stripe,verts(a,-.11,.045),verts(b,-.11,.045),verts(b,.11,.045),verts(a,.11,.045));
  }
  paint(asphalt,deck);paint(edges,concrete);paint(under,dark);paint(stripe,line);
  // Distinct approach spans graduate into regular main spans; deck has no collision in this development pass.
  const pierDistances:number[]=[];
  for(let d=56;d<NAV_SPAN-20*250-170;d+=96)pierDistances.push(d);
  for(let i=-21;i<23;i++) {
    const d=NAV_SPAN+(i+0.5)*250;
    if(d>90&&d<BRIDGE_LENGTH-85)pierDistances.push(d);
  }
  for(let d=NAV_SPAN+22.5*250+103;d<BRIDGE_LENGTH-45;d+=96)pierDistances.push(d);
  const shafts=new THREE.InstancedMesh(new THREE.CylinderGeometry(3.85,4.75,1,8),concrete,pierDistances.length);
  const collars=new THREE.InstancedMesh(new THREE.CylinderGeometry(4.75,7.7,1,8),dark,pierDistances.length);
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),scale=new THREE.Vector3();
  pierDistances.forEach((d,i)=>{
    const p=bridgeAt(d),top=p.y-highSpanDepth(d)+.7;
    v.set(p.x,(top-4)/2,p.z);scale.set(1,top+4,1);m.compose(v,q,scale);shafts.setMatrixAt(i,m);
    v.set(p.x,1.5,p.z);scale.set(1,7,1);m.compose(v,q,scale);collars.setMatrixAt(i,m);
  });
  shafts.computeBoundingSphere();collars.computeBoundingSphere();
  bridge.add(shafts,collars);scene.add(bridge);return bridge;
}
