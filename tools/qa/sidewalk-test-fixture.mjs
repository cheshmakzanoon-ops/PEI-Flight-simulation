import {fitSidewalk,WALK_TOP} from '../../src/render/sidewalks.ts';
export function floatGridAudit(model,tile,g){
 let error=0,wrongWinding=0;
 const edge=(i,j)=>5*Math.cos(i*.44)+3*Math.sin(j*.3)+2*Math.sin(i*.87-j*.94);
 for(const r of [1,2,14]){
  const ground=(x,z)=>{
   const u=(x-g.x0)/(r*g.dx),v=(z-g.z0)/(r*g.dz),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
   return a+b<1?
    edge(i,j)*(1-a-b)+edge(i+1,j)*a+edge(i,j+1)*b:
    edge(i+1,j+1)*(a+b-1)+edge(i,j+1)*(1-a)+edge(i+1,j)*(1-b);
  };
  fitSidewalk(model,tile,ground);
  const pos=model.geometry.getAttribute('position');
  const normal=model.geometry.getAttribute('normal');
  for(let i=0;i<model.top;i+=3){
   const x=tile.ox+(pos.getX(i)*.29+pos.getX(i+1)*.38+pos.getX(i+2)*.33);
   const z=tile.oz+(pos.getZ(i)*.29+pos.getZ(i+1)*.38+pos.getZ(i+2)*.33);
   const y=pos.getY(i)*.29+pos.getY(i+1)*.38+pos.getY(i+2)*.33;
   error=Math.max(error,Math.abs(y-ground(x,z)-WALK_TOP));
   if(normal.getY(i)<=0)wrongWinding++;
  }
 }
 return {error,wrongWinding};
}
