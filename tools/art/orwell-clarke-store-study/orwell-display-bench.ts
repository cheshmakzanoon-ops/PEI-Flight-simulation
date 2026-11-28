import {
  BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial,
  ShapeUtils, Vector2,
} from 'three';
import {makeClarkeFront} from './front.ts';

type Section = readonly [z:number,y:number];
type Point = readonly [x:number,y:number,z:number];
type Role = 'bench-ends'|'bench-boards';
const rootY = -.012;
const endX = [.451,2.003] as const;
const endHalf = .027;

/**
 * Qualitative, dated study of the bench beside the entry in IMG_3905
 * (Larry Muffin At Home, published Aug. 1, 2018). Not an exhibit-era
 * inventory, survey or current fixture. Do not place this in the world.
 */
export const CLARKE_DISPLAY_BENCH = Object.freeze({
  evidence:'2018 front view, dark shaped ends and open-backed boards under the right display',
  host:'q1030/130 remains untouched',
  studioBottomY:rootY,
  studioFootX:endX,
  studioFootZ:Object.freeze([.274,.725]),
  widthX:Object.freeze([endX[0]-endHalf,endX[1]+endHalf]),
  shelf:'geometry and dimensions are normalized art, not stock grade/seating',
  placement:false,
});

const cheek:readonly Section[] = [
  [.241,rootY],[.307,rootY],[.339,.032],[.360,.140],[.421,.259],[.536,.271],
  [.596,.153],[.619,.069],[.674,.024],[.690,rootY],[.760,rootY],[.777,.003],
  [.739,.102],[.718,.204],[.728,.294],[.744,.365],[.724,.416],[.674,.443],
  [.600,.447],[.482,.432],[.432,.440],[.386,.466],[.351,.523],[.328,.611],
  [.313,.692],[.304,.752],[.291,.770],[.253,.773],[.237,.761],[.246,.693],
  [.266,.495],[.243,.260],[.220,.068],[.224,.010],
];

/** A real closed batch of separate cross-section sweeps, with no copied profile or texture. */
class BoardBatch {
  point:number[]=[];
  uv:number[]=[];
  color:number[]=[];
  sections:{name:string,firstVertex:number,count:number}[]=[];
  readonly role:Role;
  constructor(role:Role){this.role=role;}
  face(v:readonly [Point,Point,Point], aim:Point, ink:Color, edgeTone:number, u:(p:Point)=>number) {
    const [a,b,c]=v, A=b.map((v,i)=>v-a[i]), B=c.map((v,i)=>v-a[i]);
    const dot=([A[1]*B[2]-A[2]*B[1],A[2]*B[0]-A[0]*B[2],A[0]*B[1]-A[1]*B[0]])
      .reduce((n,q,i)=>n+q*aim[i],0);
    if(!Number.isFinite(dot)||Math.abs(dot)<1e-11)throw Error('bench degenerate surface: '+this.role);
    for(const p of dot>0?[a,b,c]:[a,c,b]) {
      this.point.push(...p);this.uv.push(p[0],u(p));
      const h=edgeTone*(1+.045*(p[1]-.32) + .023*Math.sin(5.4*p[0]+1.7*p[1]+p[2]));
      this.color.push(ink.r*h,ink.g*h,ink.b*h);
    }
  }
  sweep(name:string,l:number,r:number,q:readonly Section[],hex:number,axis:'y'|'z') {
    const s=q.reduce((a,p,i)=>{const k=q[(i+1)%q.length];return a+p[0]*k[1]-p[1]*k[0];},0);
    const faces=ShapeUtils.triangulateShape(q.map(([z,y])=>new Vector2(z,y)),[]);
    if(faces.length!==q.length-2||!(l<r)||Math.abs(s)<1e-9)throw Error('invalid enclosed section '+name);
    const firstVertex=this.point.length/3;
    const at=(x:number,i:number):Point=>[x,q[i][1],q[i][0]];
    const ink=new Color(hex), u=(p:Point)=>p[axis==='y'?1:2];
    for(const [i,j,k] of faces) {
      this.face([at(l,i),at(l,j),at(l,k)],[-1,0,0],ink,.93,u);
      this.face([at(r,i),at(r,j),at(r,k)],[1,0,0],ink,.93,u);
    }
    for(let i=0;i<q.length;i++) {
      const j=(i+1)%q.length, n:Point=[0,Math.sign(s)*(q[i][0]-q[j][0]),Math.sign(s)*(q[j][1]-q[i][1])];
      const v=n[1]>0?1.018:n[1]<0?.942:1.;
      this.face([at(l,i),at(r,i),at(r,j)],n,ink,v,u);
      this.face([at(l,i),at(r,j),at(l,j)],n,ink,v,u);
    }
    this.sections.push({name,firstVertex,count:this.point.length/3-firstVertex});
  }
  object() {
    const g=new BufferGeometry();
    g.setAttribute('position',new Float32BufferAttribute(this.point,3));
    g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));
    g.setAttribute('color',new Float32BufferAttribute(this.color,3));
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const wood=this.role==='bench-boards';
    const m=new MeshStandardMaterial({vertexColors:true,roughness:wood?.76:.83,metalness:0});
    if(wood){
      m.customProgramCacheKey=()=> 'orwell-dark-painted-across-board-v1';
      m.onBeforeCompile=s=>{
        const tokenV='#include <uv_vertex>',tokenF='#include <color_fragment>';
        if(s.vertexShader.split(tokenV).length!==2||s.fragmentShader.split(tokenF).length!==2)return;
        s.vertexShader='varying vec2 vOrwellBench;\n'+s.vertexShader.replace(tokenV,tokenV+'\nvOrwellBench = uv;');
        s.fragmentShader='varying vec2 vOrwellBench;\n'+s.fragmentShader.replace(tokenF,`${tokenF}
          float longRipple = 2.8 * vOrwellBench.x + 25.0 * vOrwellBench.y;
          float microRipple = 4.3 * vOrwellBench.x + 74.0 * vOrwellBench.y;
          float form = (1.0 - smoothstep(.32, 1.45, fwidth(longRipple))) *
            sin(longRipple + .72 * sin(2.9 * vOrwellBench.x + 12.1 * vOrwellBench.y));
          float hair = (1.0 - smoothstep(.28, 1.30, fwidth(microRipple))) *
            sin(microRipple + .64 * sin(1.7 * vOrwellBench.x));
          diffuseColor.rgb *= 1.0 + (.034 * form + .021 * hair);
        `);
      };
    }
    const o=new Mesh(g,m);o.name=this.role;o.userData={role:this.role,sections:this.sections};
    // This prop belongs to the isolated comparison. Its shadow must not
    // claim actual shade across the existing yard, shop, or entry.
    o.receiveShadow=true;o.castShadow=false;
    return o;
  }
}

const boardX=[endX[0]-.012,endX[1]+.012] as const;
// A small closed arris, not a screen-facing slat decal.
function eased(z0:number,z1:number,b:number,thick:number,grade:(z:number)=>number):Section[]{
  const k=.004,v=(z:number)=>b+grade(z);
  return [[z0+k,v(z0+k)],[z1-k,v(z1-k)],[z1,v(z1)+k],[z1,v(z1)+thick-k],
    [z1-k,v(z1-k)+thick],[z0+k,v(z0+k)+thick],[z0,v(z0)+thick-k],[z0,v(z0)+k]];
}
function backboard(y0:number,y1:number):Section[]{
  const k=.004,p=(y:number)=>.322-(y-.460)*.145,d=.040;
  return [[p(y0)+k,y0],[p(y0)+d-k,y0],[p(y0+k)+d,y0+k],[p(y1-k)+d,y1-k],
    [p(y1)+d-k,y1],[p(y1)+k,y1],[p(y1-k),y1-k],[p(y0+k),y0+k]];
}
export function makeClarkeDisplayBench(){
  const b=new Group();b.name='Orwell / 2018 right-display bench study';
  b.userData={...CLARKE_DISPLAY_BENCH};
  const ends=new BoardBatch('bench-ends'), boards=new BoardBatch('bench-boards');
  for(const [i,x] of endX.entries()) ends.sweep('shaped cheek '+i,x-endHalf,x+endHalf,cheek,0x2b2b28,'y');
  for(const [i,z] of [.318,.450,.582].entries())
    boards.sweep('seat '+i,...boardX,eased(z,z+.122,.374,.025,q=>.054*(q-.318)),[0x373530,0x393630,0x403a33][i],'z');
  boards.sweep('lower open back board',...boardX,backboard(.471,.568),0x383531,'y');
  boards.sweep('upper open back board',...boardX,backboard(.628,.725),0x393630,'y');
  b.add(ends.object(),boards.object());return b;
}

/** Separate composition. The original storefront factory and viewer are untouched. */
export function makeClarkeFrontWithDisplayBench(){
  const d=new Group();d.name='Clarke storefront / dated bench composition';d.userData.placement=false;
  d.add(makeClarkeFront(),makeClarkeDisplayBench());return d;
}
