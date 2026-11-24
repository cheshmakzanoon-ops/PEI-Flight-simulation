import {makeStoneTile} from './materials.ts';
import {STONE_ROLES,type RecipeReply,type TextureSize} from './texture-contract.ts';

// Only local procedural textures. One structured response and all arrays are
// transferred, never copied back to the renderer's JavaScript thread.
const send=self.postMessage.bind(self) as (value:RecipeReply,transfer:Transferable[])=>void;
self.onmessage=(e:MessageEvent<unknown>)=>{
 const input=e.data;
 if(input!==256&&input!==512){send({kind:'bad-request'},[]);return;}
 const size:TextureSize=input;
 try{
  const entries=STONE_ROLES.map(role=>{
   const result=makeStoneTile(role,size);
   if(!result)throw Error('unknown stone recipe');
   return {role,...result,size};
  });
  send({kind:'souris-masonry-v1',entries},entries.flatMap(q=>[q.maps.buffer,q.norm.buffer]));
 }catch{send({kind:'recipe-failed'},[]);}
};
