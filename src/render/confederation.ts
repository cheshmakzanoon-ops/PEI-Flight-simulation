import * as THREE from 'three';
import { addBridgeConcrete } from './bridge-concrete.ts';
import { mainBridgeShaftGeometry } from './confederation-shaft.ts';
import { bridgeAt, BRIDGE_LENGTH, BRIDGE_SUPPORTS, BRIDGE_DECK_CONTROLS, bridgeGirderDepth } from '../sim/confederation.ts';

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
  const shaftConcrete=concrete.clone();
  const shieldConcrete=dark.clone();
  addBridgeConcrete(concrete,'deck');
  addBridgeConcrete(dark,'deck');
  addBridgeConcrete(shaftConcrete,'shaft');
  addBridgeConcrete(shieldConcrete,'shield');
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
  // Include every support in the panel boundaries: a fixed interval can skip
  // the deepest part of the girder and leave an above-water pier poking through.
  const stations=[...new Set([...Array.from({length:n+1},(_,i)=>i*BRIDGE_LENGTH/n),
    ...BRIDGE_SUPPORTS.map(p=>p.station),BRIDGE_DECK_CONTROLS.crest])].sort((a,b)=>a-b);
  for(let i=1;i<stations.length;i++){
    const s=stations[i-1],t=stations[i],a=bridgeAt(s),b=bridgeAt(t),half=WIDTH/2;
    push(asphalt,verts(a,-half,0),verts(b,-half,0),verts(b,half,0),verts(a,half,0));
    push(under,verts(a,-2.65,-bridgeGirderDepth(s)),verts(a,2.65,-bridgeGirderDepth(s)),verts(b,2.65,-bridgeGirderDepth(t)),verts(b,-2.65,-bridgeGirderDepth(t)));
    for(const sign of [-1,1]){
      push(edges,verts(a,sign*half,-.18),verts(b,sign*half,-.18),verts(b,sign*2.65,-bridgeGirderDepth(t)),verts(a,sign*2.65,-bridgeGirderDepth(s)));
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
  // Original visible shapes. No underwater footing survey or bridge collision.
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),scale=new THREE.Vector3();
  const up=new THREE.Vector3(0,1,0);
  for(const section of ['main','approach'] as const){
    const supports=BRIDGE_SUPPORTS.filter(p=>p.section===section);
    const main=section==='main';
    const shaft=main?mainBridgeShaftGeometry():new THREE.BoxGeometry(3.5,1,5.1);
    const shield=new THREE.CylinderGeometry(main?4.35:3.2,main?9.8:5.8,1,main?12:8);
    const shafts=new THREE.InstancedMesh(shaft,shaftConcrete,supports.length);
    const collars=new THREE.InstancedMesh(shield,shieldConcrete,supports.length);
    shafts.name=section+' bridge shafts';collars.name=section+' bridge shields';
    supports.forEach(({station},i)=>{
      const p=bridgeAt(station),top=p.y-bridgeGirderDepth(station)+.35;
      const shoulder=main?3.6:2.1;
      q.setFromAxisAngle(up,-Math.atan2(p.dz,p.dx));
      v.set(p.x,(top+shoulder)/2,p.z);scale.set(1,top-shoulder,1);m.compose(v,q,scale);shafts.setMatrixAt(i,m);
      v.set(p.x,(shoulder-4)/2,p.z);scale.set(1,shoulder+4,1);m.compose(v,q,scale);collars.setMatrixAt(i,m);
    });
    shafts.computeBoundingSphere();collars.computeBoundingSphere();
    bridge.add(shafts,collars);
  }
  scene.add(bridge);return bridge;
}
