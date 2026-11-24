// Source datum: EPSG:2961 plan, CGVD2013 vertical. Only architectural art uses this frame.
// x=u (NE), height=y−DATUM, z=−v (v increases NW).
export const DATUM=2.75;
export const DATUM_FRAME={east:477578.49,north:5144677.26,angleDegrees:42.45,vertical:'CGVD2013',horizontal:'EPSG:2961'} as const;
export type P=readonly [u:number,y:number,v:number]; // absolute orthometric y, local metric plan
export const WALL0=2.99;
export const RING_FLOOR=11.084;
export const RAIL_TOP=12.159;
export const GALLERY={u0:-1.953,u1:2.906,v0:-2.394,v1:2.608} as const;
export const CAP={u:.4656,v:.1289,normalDegrees:-3.8436,apothem:1.205,peak:13.556,slope:.3042,sides:6} as const;
export const HOUSE_PLANES={neg:[9.60905,.01388,.87173],pos:[9.89965,-.01101,-.93062]} as const;
export type Side='neg'|'pos';
export const roofY=(side:Side,u:number,v:number)=>{const [a,b,c]=HOUSE_PLANES[side];return a+b*u+c*v;};
export const ridgeV=(u:number)=>(HOUSE_PLANES.pos[0]-HOUSE_PLANES.neg[0]+(HOUSE_PLANES.pos[1]-HOUSE_PLANES.neg[1])*u)/(HOUSE_PLANES.neg[2]-HOUSE_PLANES.pos[2]);
// Outer walls and glazing are photo-informed nominal (not inferred architectural survey).
const ratio=(y:number)=> (y-WALL0)/(RING_FLOOR-.145-WALL0);
export const nearU=(y:number)=>-2.225+(ratio(y)*.988);
export const farU=(y:number)=>2.849-ratio(y)*.864;
export const negV=(y:number)=>-2.292+ratio(y)*.985;
export const posV=(y:number)=>2.506-ratio(y)*.855;
export const rearU=(y:number)=>-6.197+ratio(y)*.362;
export const roofNearU=(side:Side,v:number)=>{
  const [a,b,c]=HOUSE_PLANES[side],s=.988/(RING_FLOOR-.145-WALL0);
  return (-2.225+s*(a+c*v-WALL0))/(1-s*b);
};
export const HOUSE_EAVE={u0:-6.405,neg:-1.899,pos:2.269} as const;
export function fromNative(east:number,north:number,y:number):P{
  const t=DATUM_FRAME.angleDegrees*Math.PI/180, x=east-DATUM_FRAME.east,z=north-DATUM_FRAME.north;
  return [x*Math.cos(t)+z*Math.sin(t),y,-x*Math.sin(t)+z*Math.cos(t)];
}
// Detached, dated-reference nominal three treads. Local plan guard keeps the far toe ≤0.89 m outside
// the door-side wall at its base; elevations are authored against the separately verified V33 preview grade.
export const ENTRY={u:-3.831,left:-4.401,right:-3.261,back:posV(3.035)-.127,front:posV(WALL0)+.886,low:2.486,
    top:3.025,middle:2.894,foot:2.762,noseMiddle:posV(WALL0)+.624,noseTop:posV(WALL0)+.352} as const;
