/** Detached rectified +V front section of Matthew House, not a closed site asset.
 * Position and limit come from the signed NRCan q130331/0 plan and native source
 * witness. All window/joinery dimensions are authored. Numeric eave/peak
 * choices are an INDICATIVE 2020 source-bounded illustration, not a surveyed
 * wall/roof. No /130, /34, /60, world instance, collision or other face.
 */
import type {Vector3} from 'three';
import {createMatthewSouthCraftStudy,type MatthewArtQuality} from './matthew-house-south-craft.ts';

export const MATTHEW_REGISTERED_FRONT = Object.freeze({
 owner:'q130331/0',
 ownerAtlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 ownerWire:'a7ee1263f0c19b2b570f24cf1874c0e882b895d778ad63ab3939d8adcaca7d55',
 record:'8fcf6b9e2eeace29c568e1f4f61d08a20f0a9f63bc4d97da885bc000cbc61ee6',
 centerXZ:[72874.27174846144,16351.049052919892] as const,
 U:[0.6534267223687705,0.7569897743658137] as const,
 V:[-0.7569897743658137,0.6534267223687705] as const,
 signedOwnerUV:[
  [-5.843677297243206,-1.7847610128646387],[-2.9569117105160463,-1.7266525144814882],
  [-0.7304584245914525,-3.4553803331088293], [0.9897862495097324,-0.8550250433606508],
  [7.153038919093447,-4.762821539547287],[7.155344627059455,6.292320222006893],
  [-5.767122361778422,6.292320222006892]
 ] as const,
 Ucentral:[-3.5,5.8] as const,
 stageBackV:5.12,
 stageDepthLimit:.93,
 receiverNominalDisplayY:14.520851285631124,
 // Same-survey observed ranges, not a closed model. Choose the midpoint of
 // the source-reported near-eave band, representative peak U bracket mid.
 observedIndicativeEaveAbs:[21.85,22.10] as const,
 observedRidgeU:[1.0,1.50] as const,
 observedC6TopAbsY:26.548,
 minWholeStudyRectangleToOriginalBoundary:.24232022200689332,
 authoritativeNorthOrRoofClosure:false,
 stockPreserve:[130,34,60] as const
});
type XZ=readonly [number,number];
const cr=(a:XZ,b:XZ,c:XZ)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function segmentNear(a:XZ,b:XZ,c:XZ,d:XZ){
 // A false-negative boundary would be an unsafe art spill. Treat even
 // exact touch as a conflict when axis boxes overlap, no epsilon expansion.
 if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||
    Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))return false;
 return cr(a,b,c)*cr(a,b,d)<=0&&cr(c,d,a)*cr(c,d,b)<=0;
}
function inside(q:XZ,ring:readonly XZ[]){
 let crossings=0;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  if((a[1]>q[1])===(b[1]>q[1]))continue;
  if(a[0]+(q[1]-a[1])*(b[0]-a[0])/(b[1]-a[1])>q[0])crossings++;
 }
 return !!(crossings%2);
}
function register(){
 const c=MATTHEW_REGISTERED_FRONT,[u0,u1]=c.Ucentral,v0=c.stageBackV-.0041,v1=c.stageBackV+c.stageDepthLimit;
 const Q:XZ[]=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
 if(Q.some(q=>!inside(q,c.signedOwnerUV)))throw new Error('No source-bound +V section rectangle');
 for(let i=0;i<Q.length;i++)for(let j=0;j<c.signedOwnerUV.length;j++)if(segmentNear(Q[i],Q[(i+1)%Q.length],c.signedOwnerUV[j],c.signedOwnerUV[(j+1)%c.signedOwnerUV.length]))
  throw new Error('Detached +V section crosses original signed outline');
 return {uCenter:(u0+u1)*.5,width:u1-u0};
}
export function createMatthewRegisteredFrontStudy(sun:Vector3,quality:MatthewArtQuality='near',fretwork=true){
 const site=MATTHEW_REGISTERED_FRONT;
 const {uCenter,width}=register(),base=site.receiverNominalDisplayY;
 const E=(site.observedIndicativeEaveAbs[0]+site.observedIndicativeEaveAbs[1])*.5-base;
 const R=(site.observedRidgeU[0]+site.observedRidgeU[1])*.5-uCenter;
 const c=createMatthewSouthCraftStudy({width,bottom:0,eave:E,depthLimit:site.stageDepthLimit,
   ...(fretwork?{measuredGableEnd:{left:-width*.5,right:width*.5,peakX:R,peakY:site.observedC6TopAbsY-base}}:{})},sun,quality);
 const box=c.mesh.geometry.boundingBox!;
 if(box.min.x<-width*.5-.000001||box.max.x>width*.5+.000001||box.min.z<-.0041||box.max.z>site.stageDepthLimit||
    box.min.y<-.000001||box.max.y>Math.fround(site.observedC6TopAbsY-base)+.000001){c.dispose();throw new Error('Out-of-plan renderer bounds');}
 c.mesh.name='Matthew House · registered southwest façade fragment';
 c.mesh.userData=Object.freeze({...c.mesh.userData,owner:site.owner,footprintLimitOnly:true,
   roofClosed:false,assumedSiteSeat:false,partsNotSurveyed:true,fretworkInterpretive:fretwork});
 // Evidence metadata, not a builder for an actual world transform. The mesh
 // remains at its local origin and parentless. No reference pixels retained.
 const at=(x:number,z:number)=>[site.centerXZ[0]+(uCenter+x)*site.U[0]+(site.stageBackV+z)*site.V[0],
  site.centerXZ[1]+(uCenter+x)*site.U[1]+(site.stageBackV+z)*site.V[1]] as const;
 return {mesh:c.mesh,dispose:c.dispose,triangles:c.triangles,
   sourceRelation:Object.freeze({footprintOriginXZ:at(0,0),axisU:site.U,axisOutV:site.V,
     datumLabel:'display reference; not a finished real site seat',eaves:'indicative',fullRoof:false})};
}
