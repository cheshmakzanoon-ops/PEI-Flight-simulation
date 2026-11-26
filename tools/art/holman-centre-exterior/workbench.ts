import './studio.ts';
import cameras from './detached-lenses.json';

const modes=[['Plain materials','plain'],['Authored finish','photo'],['Detailed masonry and glass','combined']] as const;
const names=['Southeast aerial','South elevation','Northeast corner','Glass and stone close-up'];
const state=window as unknown as {holmanStudioQA:(q:string,m:string)=>{gl:number;calls:number;triangles:number}};
const status=document.querySelector<HTMLElement>('#review-status')!;
let pose=cameras.poses[0].id,finish='combined';
const nav=(id:string,items:readonly (readonly [string,string])[],select:(value:string)=>void)=>{
 const place=document.querySelector<HTMLElement>(id)!;
 return items.map(([label,value])=>{
  const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.value=value;
  b.addEventListener('click',()=>{select(value);paint();});place.append(b);return b;
 });
};
const poseButtons=nav('#poses',cameras.poses.map(({id},i)=>[names[i]??id,id]),v=>{pose=v;});
const materialButtons=nav('#looks',modes,v=>{finish=v;});
function paint(){
 try{
  const result=state.holmanStudioQA(pose,finish);
  if(result.gl!==0)throw Error('WebGL could not render this view');
  status.textContent=`${result.triangles.toLocaleString()} rendered triangles · ${result.calls} draws`;
  for(const b of poseButtons)b.setAttribute('aria-pressed',String(b.dataset.value===pose));
  for(const b of materialButtons)b.setAttribute('aria-pressed',String(b.dataset.value===finish));
 }catch{status.textContent='The exterior preview could not render on this device.';}
}
const canvas=document.querySelector('canvas');
if(canvas){canvas.setAttribute('aria-label','Three-dimensional Holman Centre exterior');document.querySelector('#review-view')?.append(canvas);}
paint();
