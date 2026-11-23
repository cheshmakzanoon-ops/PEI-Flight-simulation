import {ShapeUtils,Vector2,Color} from 'three';
import {HANGAR4} from './hangar4.generated.ts';
type Pair=readonly [number,number];
type Pt={x:number;z:number};
type Send=(p:Pt,y:number,c:Color,u:number,v:number,isRoof:number,style:number)=>void;

export function matchesHangar4(atlas:string|undefined,tile:string,row:number,plan:readonly Pair[],holes?:readonly (readonly Pair[])[]){
 return atlas===HANGAR4.atlasSha&&tile===HANGAR4.tile&&row===HANGAR4.row&&!holes?.length&&
  plan.length===HANGAR4.footprint.length&&HANGAR4.footprint.every((p,i)=>p[0]===plan[i][0]&&p[1]===plan[i][1]);
}
const wallGray=new Color(0xaab8bb),lowGray=new Color(0x969fa4),fascia=new Color(0x247173);
const roofWhite=new Color(0xb5b7b5);
const world=(p:Pair):Pt=>({x:HANGAR4.anchor[0]+p[0],z:HANGAR4.anchor[1]+p[1]});
type ColorVal=readonly [number,number,number];

export function emitHangar4(ground:(x:number,z:number)=>number,tone:ColorVal|undefined,draw:Send){
 const roof=tone?new Color().setRGB(...tone):roofWhite;
 for(const form of HANGAR4.forms){
  const points=form.ring.map(p=>new Vector2(p[0],p[1]));
  for(const face of ShapeUtils.triangulateShape(points,[])){
   const [u,v,w]=face.map(i=>form.ring[i]);
   const sign=(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);
   if(Math.abs(sign)<1e-6)continue;
   for(const p of sign<0?[u,v,w]:[u,w,v])draw(world([p[0],p[1]]),p[2],roof,p[0],p[1],1,0);
  }
 }
 function wall(a:Pt,b:Pt,lo:Pair,hi:Pair,style:number,c:Color,seat:Pair){
  const along=Math.hypot(a.x-b.x,a.z-b.z);
  for(const [p,y,u,g] of [[a,lo[0],0,seat[0]],[a,hi[0],0,seat[0]],[b,hi[1],along,seat[1]],
                            [a,lo[0],0,seat[0]],[b,hi[1],along,seat[1]],[b,lo[1],along,seat[1]]]as const)
    draw(p,y,c,u,y-g,0,style);
 }
 for(const span of HANGAR4.border){
  const p=world(span.a),q=world(span.b);
  const lo:Pair=[ground(p.x,p.z)-.65,ground(q.x,q.z)-.65];
  if(span.skin==='publicFront'&&Math.min(...span.roof)>27.75){
   const fasciaStart=[27.4,27.4]as const;
   wall(p,q,lo,fasciaStart,72,wallGray,lo);
   wall(p,q,fasciaStart,span.roof,73,fascia,lo);
  }else wall(p,q,lo,span.roof,74,span.skin==='appendage'?lowGray:wallGray,lo);
 }
 for(const step of HANGAR4.risers){
  wall(world(step.a),world(step.b),step.low,step.roof,step.skin==='tealHood'?73:74,
    step.skin==='tealHood'?fascia:lowGray,step.low);
 }
}

export const hangar4GLSL=`
void shadeHangar4(inout vec3 c,vec3 p,vec2 uv,float style,float dist){
 float closeUp=1.-smoothstep(38.,185.,dist);
 float fascia=1.-step(.45,abs(style-73.));
 float axis=p.x*.987-p.z*.161;
 float join=band(axis/(1.72+fascia*.19),.045,.061);
 float rib=band(axis/.27,.035,.122);
 float tone=warmWindowHash(vec2(floor(axis/1.79),11.0));
 float weather=sin(p.x*.073+p.z*.107)*sin(p.z*.18-p.x*.06);
 float base=(1.-smoothstep(.2,1.35,uv.y))*(1.-fascia);
 c*=.97+.048*weather-.21*base+closeUp*(.037*(tone-.5)-.18*join-.075*rib);
}
`;
