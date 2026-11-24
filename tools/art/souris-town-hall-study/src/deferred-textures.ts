import * as T from 'three';
import {STONE_ROLES,validateMasonry,type StoneRole,type TextureSize} from './texture-contract.ts';

// Same matte colours and normal gains as the reviewed synchronous artist recipe.
const plain:Record<StoneRole,number>={wall:0x7f563d,trim:0xac9975,roofSide:0x48433c,roofCrown:0x4f5251};
const normalGain:Record<StoneRole,number>={wall:.83,trim:.53,roofSide:.45,roofCrown:.45};
export type Result={state:'ready'|'fallback'|'cancelled';bytes:number;size:TextureSize};
type Sender=Pick<Worker,'postMessage'|'terminate'|'onmessage'|'onerror'|'onmessageerror'>;

function makeTexture(input:Uint8Array<ArrayBuffer>,size:TextureSize,repeated:[number,number],color:boolean){
 const t=new T.DataTexture(input,size,size,T.RGBAFormat);
 t.wrapS=t.wrapT=T.RepeatWrapping;
 t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=4;
 t.generateMipmaps=true;t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
 t.repeat.set(repeated[0],repeated[1]);t.needsUpdate=true;
 return t;
}

/** This is a detached viewer's lifetime only, not code run by the simulator. */
export function deferHallTextures(
 hall:T.Group,size:TextureSize,
 create:()=>Sender=()=>new Worker(new URL('./masonry.worker.ts',import.meta.url),{type:'module'}),
 timeout=8000,
){
 const targets=new Map<StoneRole,T.MeshPhysicalMaterial>();
 for(const role of STONE_ROLES){
  const mesh=hall.children.find(x=>x.name===role);
  const m=(mesh as T.Mesh|undefined)?.material;
  if(m instanceof T.MeshPhysicalMaterial&&!m.map&&!m.normalMap){
   m.color.setHex(plain[role]);
   targets.set(role,m);
  }
 }
 let resolve!:(result:Result)=>void,worker:Sender|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 let completed=false,pairs:[T.DataTexture,T.DataTexture][]=[];
 const ready=new Promise<Result>(r=>{resolve=r;});
 function finish(state:Result['state'],bytes=0){
  if(completed)return;
  completed=true;
  if(timer!==undefined)clearTimeout(timer);
  if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();worker=undefined;}
  resolve({state,bytes,size});
 }
 function discard(){
  for(const [x,y] of pairs){x.dispose();y.dispose();}
  pairs=[];
 }
 try{
  if(targets.size!==STONE_ROLES.length)finish('fallback');
  else{
   worker=create();timer=setTimeout(()=>finish('fallback'),timeout);
   worker.onerror=e=>{e.preventDefault();finish('fallback');};
   worker.onmessageerror=()=>finish('fallback');
   worker.onmessage=e=>{
    if(completed)return;
    const valid=validateMasonry(e.data,size);
    if(!valid){finish('fallback');return;}
    try{
     for(const role of STONE_ROLES){
      const v=valid.get(role)!;
      const map=makeTexture(v.maps,size,v.repeat,true);
      try{pairs.push([map,makeTexture(v.norm,size,v.repeat,false)]);}
      catch(err){map.dispose();throw err;}
     }
    }catch{discard();finish('fallback');return;}
    STONE_ROLES.forEach((role,i)=>{
     const m=targets.get(role)!;
     const pair=pairs[i];m.map=pair[0];m.normalMap=pair[1];
     m.color.setHex(0xffffff);
     m.normalScale.setScalar(normalGain[role]);
     m.needsUpdate=true;
    });
    finish('ready',8*size*size*4);
   };
   worker.postMessage(size);
  }
 }catch{finish('fallback');}
 return {ready,release(){
  finish('cancelled');
  if(pairs.length){
   for(const [role,m] of targets){m.map=m.normalMap=null;m.color.setHex(plain[role]);m.needsUpdate=true;}
   discard();
  }
 }};
}
