/** Detached plan coordinate frame: +u near UTM east; +v along nave (local north). */
export type P=readonly [u:number,absoluteCGVD2013:number,v:number];
export const DATUM=23.40,FRAME_UTM2961=[448604.5161,5147221.1689] as const;
export const FRAME_ANGLE=Math.atan(.094);
export const TOWER_CENTRE:[number,number]=[-.13551060297402462,-.2875797724187862];
export const TOWER_RADIAL_SURVEY={baseY:42,topControlY:51.4,radiusAt46:1.268,dropPerMetre:.1212,tipReturn:[55.941,56.117]} as const;
export const FIRST_ART_FOOTING=23.32; // detached nominal, never make a claim about actual current grading
