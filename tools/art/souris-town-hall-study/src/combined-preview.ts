import {combinedHallOptions, COMBINED_HALL_STUDY} from './combined-options.ts';

const opts=combinedHallOptions(new URLSearchParams(location.search));
const status=document.querySelector('#status')!;
if(!opts){
 status.textContent='No scene started. The combined preview requires its own explicit study option.';
 const a=document.createElement('a');
 a.href='?study='+COMBINED_HALL_STUDY;a.textContent='Open detached combined study';
 status.after(a);
}else{
 for(const shot of ['entry','rear'] as const){
  const p=new URLSearchParams(location.search);p.set('shot',shot);
  const a=document.querySelector<HTMLAnchorElement>('#show-'+shot)!;
  a.href='?'+p.toString();
  if(shot===opts.shot)a.setAttribute('aria-current','page');
 }
 document.querySelector<HTMLElement>('#angles')!.hidden=false;
 document.querySelector('#scope')!.textContent='Two interpreted front stair flights and a measured local rear roof. The upper-east feature, actual rear enclosure and site placement are not resolved.';
 status.textContent='Preparing the detached scene…';
 void import('./combined-preview-runtime.ts').then(({startCombinedHallPreview})=>startCombinedHallPreview(opts,status))
  .catch(()=>{status.textContent='The detached preview could not be started. The original study is unchanged.';});
}
