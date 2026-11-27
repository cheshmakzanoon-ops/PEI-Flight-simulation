import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PROPELLER} from '../sim/propeller-spec.ts';

const R=PROPELLER.diameterM*.5;
// Radius fraction, local chord (m), tangential sweep (m), pitch angle (deg), thickness/chord.
// An original swept blade, not a traced manufacturer section.
const stations=[
  [.17,.063,-.004,43,.18],[.25,.087,0,36,.16],[.34,.122,.004,31,.135],
  [.51,.16,.012,24,.105],[.69,.155,.016,19,.088],[.80,.143,.015,17,.08],
  [.865,.126,.010,15,.072],[.884,.123,.008,15,.070],[.90,.115,.007,15,.070],
  [.921,.109,.004,14,.069],[.932,.104,.001,14,.069],[.962,.081,-.009,13,.070],
  [.984,.047,-.019,13,.08],[1,.006,-.026,12,.12],
];
const segments=10, ring=segments*2;
const graphite=new THREE.Color(0x2c3336), leadingMetal=new THREE.Color(0x9a9e9c),
  ivory=new THREE.Color(0xe2d8b7), ochre=new THREE.Color(0xde9a46);

/** All three closed, twisted airfoils share one indexed geometry and one vertex-coloured draw. */
export function propellerBlades():THREE.BufferGeometry {
  const vertices:number[]=[], colors:number[]=[], indices:number[]=[];
  for(let blade=0;blade<PROPELLER.bladeCount;blade++){
    const base=vertices.length/3, offset=blade*2*Math.PI/PROPELLER.bladeCount;
    for(const [fraction,chord,sweep,beta,thickness] of stations) {
      const radius=fraction*R, pitch=beta*Math.PI/180;
      for(let j=0;j<ring;j++) {
        const upper=j<=segments;
        const t=(1-Math.cos(Math.PI*(upper?j:ring-j)/segments))*.5;
        const h=5*thickness*chord*(.2969*Math.sqrt(t)-.126*t-.3516*t*t+.2843*t**3-.1036*t**4);
        const ordinate=(upper?-h:h)-.018*chord*Math.sin(Math.PI*t);
        const along=(t-.40)*chord;
        const tangent=sweep+along*Math.cos(pitch)-ordinate*Math.sin(pitch);
        // Radius is measured from the shaft, not along the outside of a flat rectangle.
        const az=offset+tangent/radius;
        vertices.push(radius*Math.sin(az),radius*Math.cos(az),along*Math.sin(pitch)+ordinate*Math.cos(pitch));
        const paint=fraction>=.932?ivory:fraction>=.90&&fraction<=.921?ochre:t<.06?leadingMetal:graphite;
        colors.push(paint.r,paint.g,paint.b);
      }
    }
    for(let i=0;i<stations.length-1;i++)for(let k=0;k<ring;k++){
      const a=base+i*ring+k,b=base+i*ring+(k+1)%ring;
      indices.push(a,a+ring,b,b,a+ring,b+ring);
    }
    const end=base+(stations.length-1)*ring;
    for(let k=1;k<ring-1;k++)indices.push(base,base+k,base+k+1,end,end+k+1,end+k);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);
  g.computeVertexNormals();g.computeBoundingSphere();return g;
}

/** A procedurally painted shutter sweep, bounded by the same radius as the working blades. */
function motionTexture() {
  const size=192,c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d')!,im=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const dx=2*(x+.5)/size-1,dy=2*(y+.5)/size-1,r=Math.hypot(dx,dy);
    if(r<.17||r>=1)continue;
    const ix=(y*size+x)*4;
    const sweep=Math.pow(.5+.5*Math.cos(PROPELLER.bladeCount*(Math.atan2(dy,dx)+.20*r)),3);
    const edge=Math.min(1,(1-r)*72,(r-.17)*24);
    const opacity=(.023+.14*sweep)*edge*Math.min(1,.67/r);
    const tip=r>.93,band=r>.90&&r<.923;
    im.data[ix]=tip?214:band?215:35;im.data[ix+1]=tip?205:band?154:44;
    im.data[ix+2]=tip?178:band?71:46;im.data[ix+3]=Math.round(opacity*255);
  }
  ctx.putImageData(im,0,0);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

export function makePropeller(gearHeightM:number) {
  // Match the handbook normal, level ground attitude rather than letting the old sweep graze the runway.
  const hubY=R+PROPELLER.groundClearanceM-gearHeightM;
  const z=-4.035;
  const prop=new THREE.Group();prop.name='Survey propeller • blades';prop.position.set(0,hubY,z);
  const bladeMat=new THREE.MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:.47,metalness:.35,
    transparent:true,side:THREE.FrontSide});
  const blades=new THREE.Mesh(propellerBlades(),bladeMat);blades.name='Three twisted blades';blades.castShadow=true;
  blades.receiveShadow=true;prop.add(blades);
  const discMat=new THREE.MeshBasicMaterial({color:0xffffff,map:motionTexture(),transparent:true,
    depthWrite:false,side:THREE.DoubleSide});
  const propDisc=new THREE.Mesh(new THREE.CircleGeometry(R,96),discMat);
  propDisc.name='Survey propeller • shutter sweep';propDisc.position.copy(prop.position);

  const spinner=new THREE.Group();spinner.name='Survey propeller • spinner and backplate';spinner.position.copy(prop.position);
  const enamel=new THREE.MeshStandardMaterial({color:0x27707a,roughness:.30,metalness:.53});
  const brushed=new THREE.MeshStandardMaterial({color:0x9ba3a1,roughness:.39,metalness:.7});
  const lathe=(points:number[][],material:THREE.Material):THREE.Mesh<THREE.BufferGeometry,THREE.Material>=>{
    const g=new THREE.LatheGeometry(points.map(([r,v])=>new THREE.Vector2(r,v)),32);
    g.rotateX(Math.PI/2);
    const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;
    spinner.add(m);return m;
  };
  // Rounded ogive, narrow brushed backplate and a taper into the cowling.
  const ogive=lathe([[.001,-.475],[.034,-.464],[.086,-.426],[.148,-.361],[.21,-.26],
    [.25,-.16],[.27,-.07],[.274,-.021],[.274,.017],[.259,.028]],enamel);
  const rim=lathe([[.269,.001],[.278,.005],[.279,.016],[.272,.024],[.261,.029]],brushed);
  // Flush fastening heads and the backplate are rigid, one shared material draw.
  const fittings:THREE.BufferGeometry[]=[rim.geometry];
  const up=new THREE.Vector3(0,1,0);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,axis=new THREE.Vector3(Math.sin(a),Math.cos(a),-.05).normalize();
    const screw=new THREE.CylinderGeometry(.0085,.0095,.0026,8);
    screw.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,axis));
    screw.translate(.271*Math.sin(a),.271*Math.cos(a),-.059);fittings.push(screw);
  }
  const packed=mergeGeometries(fittings);
  if(packed){rim.geometry=packed;for(const g of fittings)g.dispose();}
  function setProp(amount:number) {
    const t=THREE.MathUtils.smoothstep(amount,.10,.23);
    bladeMat.opacity=1-t;bladeMat.depthWrite=t===0;prop.visible=t<1;
    discMat.opacity=t;propDisc.visible=t>0;propDisc.rotation.z=prop.rotation.z*.32;
  }
  setProp(0);
  return {prop,propDisc,spinner,setProp,spinnerCasters:[ogive,rim] as const};
}
