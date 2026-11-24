/** Admission for a hand-authored exterior that cannot be seated on stock DEM.
 * Expected heights come from the independently validated source surface, in
 * simulator metres. This check never reforms ground or moves the asset. */
export type LandmarkSeatProbe=Readonly<{
 x:number;z:number;low:number;high:number;minDryDistance:number;
}>;
export type LandmarkSeatSurface=Readonly<{
 gradeInstalled(id:string):boolean;
 dryDistance(x:number,z:number):number;
 visualY(x:number,z:number):number;
 contactY(x:number,z:number):number;
}>;
export type LandmarkSeatFailure='grade'|'empty'|'surface'|'seat'|'contact';
export function landmarkSeatFailure(id:string,probes:readonly LandmarkSeatProbe[],s:LandmarkSeatSurface):LandmarkSeatFailure|undefined{
 if(!id||!s.gradeInstalled(id))return 'grade';
 if(!probes.length)return 'empty';
 for(const p of probes){
  const dry=s.dryDistance(p.x,p.z),y=s.visualY(p.x,p.z),h=s.contactY(p.x,p.z);
  if(![p.x,p.z,p.low,p.high,p.minDryDistance,dry,y,h].every(Number.isFinite)||
    p.high<p.low||p.minDryDistance<=0||dry<p.minDryDistance)return 'surface';
  if(y<p.low||y>p.high)return 'seat';
  if(Math.abs(h-y)>.03)return 'contact';
 }
}
