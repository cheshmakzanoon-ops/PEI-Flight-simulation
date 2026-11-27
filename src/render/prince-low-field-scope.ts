import {withinMappedPass,type MappedPass} from './kings-field-pass.ts';
/** The old, already offered 62 m neutral course. No route or camera change. */
export const PRINCE_LOW_FIELD_ROUTE='prince-fields',PRINCE_LOW_FIELD_TILE='7-12';
export const PRINCE_LOW_FIELD_KEYS=['-51:5','-51:4'] as const;
const route:MappedPass={id:PRINCE_LOW_FIELD_ROUTE,tile:PRINCE_LOW_FIELD_TILE,cells:PRINCE_LOW_FIELD_KEYS,
 center:[-51495.481719926785,5357.409543129462]};
export const withinPrinceLowField=(p:{x:number;y:number;z:number},agl:number)=>withinMappedPass(p,agl,route);
