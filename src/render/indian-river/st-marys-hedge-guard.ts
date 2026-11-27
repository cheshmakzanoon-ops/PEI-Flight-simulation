export function stockShadowFootprint(s:Readonly<{x:number;z:number;h:number;w:number}>){
  // Same arithmetic order as the shipped instanced shadow vertex shader.
  const f=Math.fround,cx=f(f(.43)*s.h),cz=f(f(.21)*s.h),wx=f(f(s.w*.5)*f(1.42)),wz=f(f(s.w*.5)*f(1.19));
  const q=(a:number,b:number,c:number)=>f(a+f(b+c));
  return {x0:q(s.x,cx,-wx),x1:q(s.x,cx,wx),z0:q(s.z,cz,-wz),z1:q(s.z,cz,wz)};
}
/** The four reseated roles are ordinary trees. A mapped hedge uses real
 * corner heights in the stock shader and cannot inherit their receiver.
 * Conservatively reject any live appended footprint near the grade. */
export function mappedHedgeShadowsAvoidGrade(bounds:readonly [number,number,number,number],stems:Float32Array,shapes:Float32Array,
 first:number,total:number){
 const [x0,z0,x1,z1]=bounds;
 if(!bounds.every(Number.isFinite)||x0>=x1||z0>=z1||
   !Number.isInteger(first)||!Number.isInteger(total)||first<0||total<first||total>45000||
   stems.length<total*3||shapes.length<total*4)return false;
 const pad=.02;
 for(let i=first;i<total;i++){
  const x=stems[i*3],z=stems[i*3+2],h=shapes[i*4],w=shapes[i*4+1];
  if(!Number.isFinite(x)||!Number.isFinite(z)||!(h>0&&h<=40&&w>0&&w<=55))return false;
  const b=stockShadowFootprint({x,z,h,w});
  if(x>=x0-pad&&x<=x1+pad&&z>=z0-pad&&z<=z1+pad)return false;
  if(b.x1>=x0-pad&&b.x0<=x1+pad&&b.z1>=z0-pad&&b.z0<=z1+pad)return false;
 }
 return true;
}
