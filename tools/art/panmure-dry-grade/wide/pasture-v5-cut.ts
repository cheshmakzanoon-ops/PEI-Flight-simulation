import {BufferAttribute,BufferGeometry,Mesh,MeshStandardMaterial} from 'three';
const status=Object.freeze({scope:'Panmure V5 topology offline inspection only',mayAttach:false,worldFloat32ArithmeticChecked:true,worldIntegrationHold:true,retainsContact:true});
const hashes={
  stock:'99a21d6e718c8cfe18faa873bda5c772d9dbad0985114b7e90b0a47b253e407d',
  dated:'8a0d71888e337159e2e9a762cc84f6e9044762a1b3550d3e6d7bebbf4e04512a',
  indices:'ecc94261dc2f59860349dc453a55fa3506a8d51b0030d2472324c51943d0808c',
} as const;
async function hash(a:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join('');}
export async function inspectPanmureV5LocalCut(role:'stock'|'dated',positions:ArrayBuffer,indices:ArrayBuffer){
  const p=positions.slice(0),i=indices.slice(0);
  if(p.byteLength!==7699*12||i.byteLength!==14754*12||await hash(p)!==hashes[role]||await hash(i)!==hashes.indices)
    throw Error('Detached Panmure cut failed asset custody');
  const P=new Float32Array(7699*3),I=new Uint16Array(14754*3),pv=new DataView(p),iv=new DataView(i);
  for(let k=0;k<P.length;k++)P[k]=pv.getFloat32(4*k,true);
  for(let k=0;k<I.length;k++){
    const a=iv.getUint32(4*k,true);if(a>=7699)throw Error('Detached Panmure cut index');I[k]=a;
  }
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(P,3));g.setIndex(new BufferAttribute(I,1));
  g.computeVertexNormals();g.computeBoundingSphere();
  const m=new Mesh(g,new MeshStandardMaterial({color:0x959775,roughness:.87,metalness:0}));
  m.name='Detached Panmure 20m / '+role;m.userData=status;
  return m;
}
