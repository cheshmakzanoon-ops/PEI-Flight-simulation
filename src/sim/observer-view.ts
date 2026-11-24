/** A dash-free, roll-stabilized camera for looking down at the virtual scenery.
 * Vehicle position, controls and the world/contact solver are never written. */
export function observerView(f:Readonly<{x:number;y:number;z:number;heading:number}>,aspect:number){
 const fx=Math.sin(f.heading),fz=-Math.cos(f.heading);
 const distance=16.8*Math.max(1,1.05/Math.max(.1,aspect));
 return {eye:[f.x-distance*fx,f.y+4.2,f.z-distance*fz] as const,
  target:[f.x+22.8*fx,f.y-21,f.z+22.8*fz] as const};
}
