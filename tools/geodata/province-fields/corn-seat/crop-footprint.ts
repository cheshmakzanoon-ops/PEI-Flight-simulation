/** Exact axis-aligned lower bound over a texel-centred, linearly filtered U8 coverage field. */
export type Rect=readonly [left:number,front:number,right:number,back:number];
export type Coverage={readonly width:number;readonly height:number;readonly step:number;
 readonly x0:number;readonly z0:number;readonly bytes:Uint8Array};
const positiveInt=(x:number)=>Number.isSafeInteger(x)&&x>0;
export function cropFootprint(c:Coverage){
 const {width:w,height:h,x0,z0,step}=c;
 if(!positiveInt(w)||!positiveInt(h)||w>4096||h>4096||c.bytes.length!==w*h||
    !Number.isFinite(x0)||!Number.isFinite(z0)||!Number.isFinite(step)||step<=0||
    x0+step===x0||z0+step===z0||!Number.isFinite(x0+step*w)||!Number.isFinite(z0+step*h))
  throw RangeError('invalid crop coverage grid');
 // Freeze byte identity after caller's independently authenticated digest/geometry checks.
 const data=c.bytes.slice();
 const tex=(u:number,v:number)=>u>=0&&u<w&&v>=0&&v<h?data[v*w+u]:0;
 function sample(u:number,v:number){
  const iu=Math.floor(u),iv=Math.floor(v),fu=u-iu,fv=v-iv;
  const l0=tex(iu,iv)*(1-fu)+tex(iu+1,iv)*fu;
  const l1=tex(iu,iv+1)*(1-fu)+tex(iu+1,iv+1)*fu;
  return l0*(1-fv)+l1*fv;
 }
 // The local polynomial is bilinear, so every subrectangle's minimum is
 // attained at a vertex. Check each integer texel-centre crossing as well.
 function breaks(low:number,high:number){
  const out=[low];
  for(let k=Math.floor(low)+1;k<high;k++)out.push(k);
  if(high!==low)out.push(high);
  return out;
 }
 return (box:Rect):number=>{
  const [x,z,X,Z]=box;
  if(!box.every(Number.isFinite)||x>X||z>Z||x<x0||z<z0||X>x0+w*step||Z>z0+h*step)return 0;
  const us=breaks((x-x0)/step-.5,(X-x0)/step-.5);
  const vs=breaks((z-z0)/step-.5,(Z-z0)/step-.5);
  let lo=255;
  for(const v of vs)for(const u of us){
   const s=sample(u,v);if(s===0)return 0;lo=Math.min(lo,s);
  }
  return lo;
 };
}
/** This tests the swept horizontal box, not just the root. Allow for Float32 world transforms. */
export function signedSweptCanopy(lower:(box:Rect)=>number,rootX:number,rootZ:number,left:number,front:number,right:number,back:number,
 padding=.05,strong=64){
 if(![rootX,rootZ,left,front,right,back,padding,strong].every(Number.isFinite)||
    padding<.05||padding>16||left>right||front>back||strong<64||strong>255)return false;
 return lower([rootX+left-padding,rootZ+front-padding,rootX+right+padding,rootZ+back+padding])>=strong;
}
