import {clamp} from '../sim/geo.ts';
import type {Controls} from '../sim/flight.ts';
function stick(v:number){const a=Math.abs(v);return a<.11?0:Math.sign(v)*((a-.11)/.89)**1.45;}
export class Input {
 keys=new Set<string>();touch={pitch:0,roll:0,power:0,yaw:0};gamepad='';private previous=false;
 constructor(onCommand:(c:string)=>void){
  const used=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyA','KeyD','KeyS','KeyW','KeyQ','KeyE','KeyB','Minus','Equal','BracketRight','BracketLeft','ShiftLeft','ControlLeft','KeyM','KeyV','KeyH','KeyP','Escape','Space','KeyR']);
  window.addEventListener('keydown',e=>{
   if(e.metaKey||e.altKey||!used.has(e.code))return;
   const t=e.target as HTMLElement;
   if(['INPUT','SELECT','TEXTAREA'].includes(t.tagName))return;
   if(t.tagName==='BUTTON'&&e.code==='Space')return;
   e.preventDefault();this.keys.add(e.code);
   if(!e.repeat)onCommand(e.code);
  });
  window.addEventListener('keyup',e=>this.keys.delete(e.code));
  window.addEventListener('blur',()=>this.clear());
 }
 clear(){this.keys.clear();this.touch={pitch:0,roll:0,power:0,yaw:0};}
 poll(toggled:()=>void):Controls{
  const k=(...a:string[])=>+a.some(v=>this.keys.has(v));let pad:Gamepad|null=null;
  try{pad=Array.from(navigator.getGamepads?.()??[]).find((p)=>p?.connected&&p.mapping==='standard')??null;}catch{/* Browser may deny gamepad in an embedded frame. */}
  this.gamepad=pad?.id??'';
  const a=(i:number)=>stick(pad?.axes[i]??0),b=(i:number)=>pad?.buttons[i]?.value??0;
  const pause=b(9)>.5;if(pause&&!this.previous)toggled();this.previous=pause;
  return {
    pitch:clamp(k('ArrowDown','KeyS')-k('ArrowUp','KeyW')+a(1)+this.touch.pitch,-1,1),
    roll:clamp(k('ArrowRight','KeyD')-k('ArrowLeft','KeyA')+a(0)+this.touch.roll,-1,1),
    yaw:clamp(k('KeyE')-k('KeyQ')+a(2)+this.touch.yaw,-1,1),
    power:clamp(k('Equal','BracketRight','ShiftLeft')-k('Minus','BracketLeft','ControlLeft')+b(7)-b(6)+this.touch.power,-1,1),
    brake:!!k('KeyB')||b(0)>.5
  };
 }
}
