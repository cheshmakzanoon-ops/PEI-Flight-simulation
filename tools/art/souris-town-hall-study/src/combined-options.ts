/** Separate detached URL; this parser is never consulted by the old viewer. */
export const COMBINED_HALL_STUDY='lower-rear-and-steps';
export type CombinedHallPreview=Readonly<{shot:'entry'|'rear';size:256|512;light:'studio'|'sim'}>;
export function combinedHallOptions(params:URLSearchParams):CombinedHallPreview|undefined{
 const allowed=new Set(['study','shot','texture','light']);
 let bad=false;params.forEach((_v,k)=>{if(!allowed.has(k)||params.getAll(k).length!==1)bad=true;});
 if(bad)return;
 if(params.get('study')!==COMBINED_HALL_STUDY)return;
 const shot=params.get('shot')??'entry',texture=params.get('texture')??'studio',light=params.get('light')??'studio';
 if((shot!=='entry'&&shot!=='rear')||(texture!=='studio'&&texture!=='flight')||(light!=='studio'&&light!=='sim'))return;
 return Object.freeze({shot,size:texture==='flight'?256:512,light});
}
