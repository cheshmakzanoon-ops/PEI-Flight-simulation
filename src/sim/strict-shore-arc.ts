export type UV=readonly [u:number,v:number];
export type Quad=readonly [topLeft:number,topRight:number,bottomRight:number,bottomLeft:number];
const opposite=(a:number,b:number)=>(a>0)!==(b>0);
type Arc={points:UV[];boundM:number;oldChordErrorM?:number;mode:'exact'|'unsupported'};
/** Nondegenerate two-crossing prototype for the exact legacy bilinear field.
 * Never change which points the signed atlas classifies as wet. Zero/saddle
 * cells intentionally keep their old code path until independently audited. */
export function strictArc(vals:Quad,width:number,height:number,errorM=.075,maxSegments=128,minimumErrorM=0):Arc{
 const [a,b,c,d]=vals;
 if(!vals.every(Number.isFinite)||vals.includes(0)||Math.min(width,height,errorM)<=0)return {points:[],boundM:Infinity,mode:'unsupported'};
 const cells:UV[]=[];
 if(opposite(a,b))cells.push([a/(a-b),0]);
 if(opposite(b,c))cells.push([1,b/(b-c)]);
 if(opposite(d,c))cells.push([d/(d-c),1]);
 if(opposite(a,d))cells.push([0,a/(a-d)]);
 if(cells.length!==2)return {points:[],boundM:Infinity,mode:'unsupported'};
 const [p,q]=cells;
 const B=b-a,C=d-a,D=a-b-d+c;
 const attempt=(transpose:boolean):Arc|undefined=>{
  const axis=transpose?1:0,other=1-axis,p1=p[axis],q1=q[axis];
  if(Math.abs(p1-q1)<1e-12)return;
  const [N0,N1,D0,D1]=transpose?[a,C,B,D]:[a,B,C,D];
  const den=(s:number)=>D0+D1*s;
  if(den(p1)*den(q1)<=0)return;
  const K=N0*D1-N1*D0,reverse=p1>q1,lo=reverse?q:p,hi=reverse?p:q;
  const start=lo[axis],end=hi[axis],rise=hi[other]-lo[other],dt=end-start,slope=rise/dt;
  let oldChordErrorM=0;
  if(D1!==0&&slope!==0&&K/slope>0){
   const critical=(Math.sign(den(start))*Math.sqrt(K/slope)-D0)/D1;
   if(critical>start&&critical<end){
    const actual=-(N0+N1*critical)/den(critical),linear=lo[other]+(critical-start)*slope;
    const along=transpose?height:width,cross=transpose?width:height;
    oldChordErrorM=Math.abs(actual-linear)*cross/Math.hypot(1,slope*cross/along);
   }
  }
  if(oldChordErrorM<minimumErrorM)return {points:[p,q],boundM:Infinity,oldChordErrorM,mode:'unsupported'};
  const points:UV[]=[lo];
  let max=0;
  const side=transpose?width:height;
  const check=(left:UV,right:UV):boolean=>{
   const t0=left[axis],t1=right[axis],duration=t1-t0;
   const m=Math.min(Math.abs(den(t0)),Math.abs(den(t1)));
   // |y''| bounds linear interpolation error by (t1-t0)^2/8.
   const upper=.25*Math.abs(D1*K)*duration*duration*side/(m*m*m);
   if(upper<=errorM){
    if(points.length>maxSegments)return false;
    points.push(right);max=Math.max(max,upper);return true;
   }
   if(duration<1e-10||points.length>maxSegments)return false;
   const mid=(t0+t1)*.5,y=-(N0+N1*mid)/den(mid);
   if(!Number.isFinite(y)||y< -1e-8||y>1+1e-8)return false;
   const split:UV=axis===0?[mid,y]:[y,mid];
   return check(left,split)&&check(split,right);
  };
  if(!check(lo,hi))return;
  if(reverse)points.reverse();
  return {points,boundM:max,oldChordErrorM,mode:'exact'};
 };
 const first=Math.abs(p[0]-q[0])*width<Math.abs(p[1]-q[1])*height;
 return attempt(first)??attempt(!first)??{points:cells,boundM:Infinity,mode:'unsupported'};
}
