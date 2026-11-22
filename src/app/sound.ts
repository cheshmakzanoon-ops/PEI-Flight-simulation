/** Original synthesized engine harmonics; audio is opt-in and starts only after a user gesture. */
export class EngineSound {
 private ctx?:AudioContext;private gain?:GainNode;private prop?:OscillatorNode;private harmonics?:OscillatorNode;
 enabled=false;
 async toggle(){
  if(!this.ctx){this.ctx=new AudioContext();this.gain=this.ctx.createGain();this.gain.gain.value=0;
   const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=450;lp.Q.value=.25;
   this.prop=this.ctx.createOscillator();this.prop.type='triangle';this.harmonics=this.ctx.createOscillator();this.harmonics.type='sawtooth';
   const hg=this.ctx.createGain();hg.gain.value=.10;this.harmonics.connect(hg).connect(lp);this.prop.connect(lp);lp.connect(this.gain).connect(this.ctx.destination);
   this.prop.start();this.harmonics.start();}
  await this.ctx.resume();this.enabled=!this.enabled;return this.enabled;
 }
 update(power:number,speed:number,active:boolean){
  if(!this.ctx||!this.gain||!this.prop||!this.harmonics)return;const t=this.ctx.currentTime;
  const hz=34+power*42+Math.min(speed,80)*.10;
  this.prop.frequency.setTargetAtTime(hz,t,.10);this.harmonics.frequency.setTargetAtTime(hz*2.02,t,.12);
  this.gain.gain.setTargetAtTime(this.enabled&&active?.038+.045*power:0,t,.12);
 }
}
