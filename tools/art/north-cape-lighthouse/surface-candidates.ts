/** Offline only. A raster component is not an identified or surveyed building. */
export type MetricWindow = {
 width:number; height:number; easting:number; northing:number;
 groundMetres:ArrayLike<number>; surfaceMetres:ArrayLike<number>;
}
export type SurfaceComponent = {
 cells:number; centre:readonly [easting:number,northing:number]; closestToReferenceMetres:number;
 maxAboveGroundMetres:number; touchesWindowEdge:boolean;
}
const MAX_CELLS = 1024*1024;

/** Four-connected height excess on a north-up 1 m grid, evaluated at pixel centres. */
export function surfaceComponents(window:MetricWindow, atLeastMetres:number,
 reference:readonly [number,number]):SurfaceComponent[]{
 const {width:w,height:h,easting:x,northing:y,surfaceMetres:surface,groundMetres:ground}=window;
 const n=w*h;
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||n>MAX_CELLS||
    ground.length!==n||surface.length!==n||![x,y,...reference,atLeastMetres].every(Number.isFinite)||atLeastMetres<=0)
  throw new RangeError('invalid metric surface window');
 const remaining=new Uint8Array(n);
 for(let i=0;i<n;i++){
  const a=surface[i],b=ground[i];
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<=-32767||b<=-32767)
   throw new RangeError('unresolved no-data in aligned surface window');
  if(a-b>=atLeastMetres)remaining[i]=1;
 }
 const stack=new Int32Array(n),result:SurfaceComponent[]=[];
 for(let first=0;first<n;first++){
  if(!remaining[first])continue;
  let length=1,cells=0,sumC=0,sumR=0,peak=-Infinity,touchesWindowEdge=false;
  let near=Infinity;
  stack[0]=first;remaining[first]=0;
  function queue(i:number){if(remaining[i]){remaining[i]=0;stack[length++]=i;}}
  while(length){
   const i=stack[--length],r=Math.floor(i/w),c=i%w;
   cells++;sumC+=c;sumR+=r;
   peak=Math.max(peak,surface[i]-ground[i]);
   near=Math.min(near,Math.hypot(x+c+.5-reference[0],y-r-.5-reference[1]));
   if(c===0||c===w-1||r===0||r===h-1)touchesWindowEdge=true;
   if(c>0)queue(i-1);if(c<w-1)queue(i+1);if(r>0)queue(i-w);if(r<h-1)queue(i+w);
  }
  result.push({cells,centre:[x+.5+sumC/cells,y-.5-sumR/cells],closestToReferenceMetres:near,
   maxAboveGroundMetres:peak,touchesWindowEdge});
 }
 return result.sort((a,b)=>a.closestToReferenceMetres-b.closestToReferenceMetres||b.cells-a.cells||
  a.centre[0]-b.centre[0]||a.centre[1]-b.centre[1]);
}
