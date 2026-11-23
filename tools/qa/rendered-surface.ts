/** Triangle interpolation used by a Three PlaneGeometry rotated into X/Z.
 * Vertex order: North-west, north-east, south-west, south-east. The
 * index buffer's diagonal joins north-east and south-west.
 */
export function planeCellHeight(u:number,v:number,nw:number,ne:number,sw:number,se:number){
 return u+v<=1?nw+(ne-nw)*u+(sw-nw)*v:se+(sw-se)*(1-u)+(ne-se)*(1-v);
}
type Heights=(x:number,z:number)=>number;
type Geometry={x0:number;z0:number;w:number;d:number;n:number;neighborSegments?:readonly [number,number,number,number]};
/**
 * Reference calculator for exactly one existing terrain mesh patch. Unlike
 * a bilinear DEM read, interpolate the two actual plane triangles. Optional
 * neighbors follow the runtime's N/E/S/W edge conformity.
 */
export function makeTerrainPatchHeight(shape:Geometry,heightAt:Heights){
 const {x0,z0,w,d,n,neighborSegments}=shape;
 const meshX=(i:number)=>x0+w/2+Math.fround(w*(i/n-.5));
 const meshZ=(j:number)=>z0+d/2+Math.fround(d*(j/n-.5));
 const extX=(i:number)=>x0+w*i/n,extZ=(j:number)=>z0+d*j/n;
 const edge=(side:number,i:number)=>{
  const m=neighborSegments?.[side]??n,k=(i/n)*m,a=Math.floor(k),b=Math.min(a+1,m);
  const c=(x:number)=>heightAt(side%2===0?x0+w*x/m:side===1?x0+w:x0,
      side%2===1?z0+d*x/m:side===2?z0+d:z0);
  return c(a)+(c(b)-c(a))*(k-a);
 };
 const y=(i:number,j:number)=>{
  if(neighborSegments){if(i===0&&j===0||i===n&&j===0||i===0&&j===n||i===n&&j===n)return Math.fround(heightAt(extX(i),extZ(j)));
   if(j===0)return Math.fround(edge(0,i));if(i===n)return Math.fround(edge(1,j));
   if(j===n)return Math.fround(edge(2,i));if(i===0)return Math.fround(edge(3,j));}
  return Math.fround(heightAt(meshX(i),meshZ(j)));
 };
 return (x:number,z:number)=>{
  if(x<x0||x>x0+w||z<z0||z>z0+d)return undefined;
  const i=Math.min(n-1,Math.floor((x-x0)*n/w)),j=Math.min(n-1,Math.floor((z-z0)*n/d));
  const u=(x-meshX(i))/(meshX(i+1)-meshX(i)),v=(z-meshZ(j))/(meshZ(j+1)-meshZ(j));
  return planeCellHeight(u,v,y(i,j),y(i+1,j),y(i,j+1),y(i+1,j+1));
 };
}
