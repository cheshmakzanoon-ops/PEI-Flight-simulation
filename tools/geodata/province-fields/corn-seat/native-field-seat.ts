/** Index-exact sampler for a signed regular near ground tile, not a DEM or collision surface. */
export function nativeFieldSeat(position:Float32Array,index:Uint16Array,N:number){
 const stride=N+1;
 if(!Number.isSafeInteger(N)||N<2||N>254||position.length!==3*stride*stride||index.length!==6*N*N)
  throw RangeError('wrong typed stock ground dimensions');
 const axisX=Array.from({length:stride},(_,i)=>position[3*i]);
 const axisZ=Array.from({length:stride},(_,i)=>position[3*i*stride+2]);
 const Y=new Float32Array(stride*stride);
 for(let j=0;j<=N;j++){
  if(!Number.isFinite(axisZ[j])||(j!==0&&!(axisZ[j]>axisZ[j-1])))
   throw RangeError('stock Z coordinates must be finite and increasing');
  for(let i=0;i<=N;i++){
   if(j===0&&(!Number.isFinite(axisX[i])||(i!==0&&!(axisX[i]>axisX[i-1]))))
    throw RangeError('stock X coordinates must be finite and increasing');
   const k=j*stride+i;
   if(position[3*k]!==axisX[i]||position[3*k+2]!==axisZ[j]||!Number.isFinite(position[3*k+1]))
    throw RangeError('stock geometry grid mismatch');
   Y[k]=position[3*k+1];
   if(i<N&&j<N){
    const m=6*(j*N+i),a=k,b=k+stride,c=k+1,d=b+1;
    if(index[m]!==a||index[m+1]!==b||index[m+2]!==c||index[m+3]!==b||index[m+4]!==d||index[m+5]!==c)
     throw RangeError('stock ground diagonal or winding changed');
   }
  }
 }
 function lower(axis:number[],q:number){
  if(!Number.isFinite(q)||q<axis[0]||q>axis[N])return -1;
  let lo=0,hi=N;
  while(hi-lo>1){const mid=(hi+lo)>>>1;if(q<axis[mid])hi=mid;else lo=mid;}
  return lo;
 }
 return(x:number,z:number)=>{
  const ix=lower(axisX,x),iz=lower(axisZ,z);
  if(ix<0||iz<0)return undefined;
  const u=(x-axisX[ix])/(axisX[ix+1]-axisX[ix]), v=(z-axisZ[iz])/(axisZ[iz+1]-axisZ[iz]);
  const key=iz*stride+ix,h0=Y[key],h1=Y[key+stride],h2=Y[key+1],h3=Y[key+stride+1];
  return u+v<=1?h0*(1-u-v)+h1*v+h2*u:h1*(1-u)+h2*(1-v)+h3*(u+v-1);
 };
}

/** The single signed World tile must use a pure native XYZ translation. */
export function translatedFieldSeat(local:ReturnType<typeof nativeFieldSeat>,modelColumnMajor:ArrayLike<number>){
 const I=[1,0,0,0,0,1,0,0,0,0,1,0];
 if(modelColumnMajor.length!==16||!I.every((x,i)=>modelColumnMajor[i]===x)||modelColumnMajor[15]!==1)
  throw RangeError('stock tile model matrix is not a pure translation');
 const x0=modelColumnMajor[12],y0=modelColumnMajor[13],z0=modelColumnMajor[14];
 if(![x0,y0,z0].every(Number.isFinite))throw RangeError('stock tile model translation is not finite');
 return(x:number,z:number)=>{
  const y=local(x-x0,z-z0);
  return y===undefined?undefined:y+y0;
 };
}
