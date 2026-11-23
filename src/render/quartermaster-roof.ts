import {QUARTERMASTER_ROOF as model} from './quartermaster-roof.generated.ts';
import {emitSurveyRoof,matchesSurveyRoof,type Pair,type RoofPoint} from './survey-roof.ts';

type Caller=Readonly<{
 roof:(a:RoofPoint,b:RoofPoint,c:RoofPoint,y:number,level:number)=>void;
 riser:(a:RoofPoint,b:RoofPoint,below:number|undefined,y:number,level:number)=>void;
}>;

/** The Quartermaster planes are flat. Preserve the existing callback and data contract. */
export function supportedQuartermasterRoof(atlas:string|undefined,tile:string,outline:readonly Pair[],holes?:readonly (readonly Pair[])[]){
 return matchesSurveyRoof(model,atlas,tile,outline,holes);
}

export function emitQuartermasterRoof(draw:Caller){
 emitSurveyRoof(model,{
  roof:(a,b,c,y,i)=>draw.roof(a,b,c,y[0],i),
  riser:(a,b,below,y,i)=>draw.riser(a,b,below?.[0],y[0],i),
 });
}
