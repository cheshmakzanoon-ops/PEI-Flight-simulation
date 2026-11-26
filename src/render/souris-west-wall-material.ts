/** Detached documentary colour study for one current native Signed wall only. */
import { BufferAttribute, Color, type BufferGeometry } from 'three';
export const SRS_FACE_MARKER = 87;
export const SRS_WEST_WALL = Object.freeze({
  atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
  tile:'q130333', wire:'c8024e0feff5779754c8ba4268c0f95b11e2a371a11dd3877a3f65d6d8e3c393',
  row:'1260aa3b7d49508d9320a909c9772f3c7cb3e8659706fbc6e37cdbe9ba6c4f89',ordinal:32,
  emittedVertices:13953, first:1989,last:1995,edge:26, metricUVEnd:45.15851593017578,
  artULow:5.871,artUHigh:36.126,fullULow:9.12,fullUHigh:32.92,
});
const marker=SRS_FACE_MARKER;
const worldPrefs={oxide:0xaa684e,base:0xb4957e,lightBand:0xbc9f84, darker:0x9f5d47} as const;
const gl=(paint:number)=>(new Color(paint).toArray().map(x=>x.toFixed(9))).join(',');
const finish=`
 uniform float srsWestLive;
 float srsWestWeight(float m){
   return smoothstep(${SRS_WEST_WALL.artULow},${SRS_WEST_WALL.fullULow},m)*(1.-smoothstep(${SRS_WEST_WALL.fullUHigh},${SRS_WEST_WALL.artUHigh},m));
 }
 float srsWestSoft(vec2 v){
  vec2 p=floor(v),f=fract(v);f=f*f*(3.-2.*f);
  return mix(mix(warmWindowHash(p),warmWindowHash(p+vec2(1,0)),f.x),
  mix(warmWindowHash(p+vec2(0,1)),warmWindowHash(p+vec2(1)),f.x),f.y);
 }
 float srsWestBand(float p,float a,float b,float w){
   float W=max(w,.001);
   return clamp((area(p+W*.5,a,b)-area(p-W*.5,a,b))/W,0.,1.);
 }
 vec3 srsWestMasonry(vec2 u,vec2 gradient,float d){
  const vec3 oxide=vec3(${gl(worldPrefs.oxide)}), fired=vec3(${gl(worldPrefs.darker)});
  const vec3 plinth=vec3(${gl(worldPrefs.base)}),buff=vec3(${gl(worldPrefs.lightBand)});
  // Approximate family rather than false measured openings, positions, or materials.
  float y=u.y, x=u.x;
  float grain=(srsWestSoft(u*vec2(.48,.29))-.5)*.07;
  float low=1.-smoothstep(2.18,2.81,y);
  float seamSpec=x/11.29;
  float dxPier=gradient.x/11.29;
  float rib=clamp(srsWestBand(seamSpec,0.,.016,dxPier)+srsWestBand(seamSpec,.982,1.,dxPier),0.,1.);
  float pier=rib*(.63+.10*smoothstep(3.,11.,y));
  float orth=1.-smoothstep(175.,410.,d);
  float cal=(srsWestSoft(u*vec2(8.,10.7))-.5)*orth;
  float bed=y/.082,dx=x/.26+.5*mod(floor(bed),2.),dd=gradient.y/.082;
  float agedBed=srsWestBand(bed,.012,.086,dd),head=srsWestBand(dx,.021,.056,gradient.x/.26)*smoothstep(.15,.3,fract(bed))*(1.-smoothstep(.85,.98,fract(bed)));
  float distant=(1.-smoothstep(.18,.83,dd))*(1.-smoothstep(24.,118.,d));
  vec3 body=mix(oxide,fired,.26+.18*sin(.18*x-.07*y));
  vec3 wall=mix(body,plinth,low);
  wall=mix(wall,buff,pier*(1.-.66*low));
  return wall*(1.+grain+.064*cal-.103*(agedBed+.57*head)*distant)*(.83+.17*smoothstep(0.,1.2,y));
 }
`;
const M='\n void main(){\n #include <logdepthbuf_fragment>';
const MAIN='vec3 c=tint,n=normalize(normalW);';
const LIGHT=' c*=.61+.51*k;';
const TONE=' #include <tonemapping_fragment>';
const single=(s:string,n:string)=>s.indexOf(n)>=0&&s.indexOf(n)===s.lastIndexOf(n);
export function patchSourisSchoolWestFragment(fragment:string):string|undefined {
  // Never try to attach against two main bodies, alternate code, or an already
  // wrapped source; scope includes only original existing stock renderer shader.
  if(fragment.includes('srsWestLive')||fragment.includes('schoolWestOriginalFacade')||
     ![M,MAIN,LIGHT,TONE,' float warmWindowHash(vec2 p){'].every(k=>single(fragment,k)))return;
  const i=fragment.indexOf(M);
  const base=fragment.slice(i).replace(/\bfacade\b/g,'schoolWestOriginalFacade');
  const alias=`\n bool schoolWestMark=roof<.5&&facade>${marker-.5}&&facade<${marker+.5};\n float schoolWestOriginalFacade=schoolWestMark?0.:facade;`;
  const after=`\n if(srsWestLive==1.){
   // The flag is uniform; capture the pixel derivatives before the per-lane
   // owner and u support tests diverge even along a fade/raster edge.
   vec2 schoolWestFootprint=fwidth(uv2d);
   if(schoolWestMark){
     float srsGain=srsWestWeight(uv2d.x);
     if(srsGain>0.)c=mix(c,srsWestMasonry(uv2d,schoolWestFootprint,d),srsGain);
   }
 }\n`;
  return fragment.slice(0,i)+finish+base.replace(MAIN,MAIN+alias).replace(LIGHT,after+LIGHT);
}
/** No weak byte allowances or mutable original applied to the QA clone. All input identities
 * have to be authenticated by the shell issuer; this is not itself a runtime mount. */
export type SrsOwnerToken=Readonly<{atlas:string;tile:string;wire:string;row:string;ordinal:number}>;
export function detachedSchoolWestMark(geometry:BufferGeometry,token:SrsOwnerToken,phase:readonly[number,number]):BufferAttribute|undefined {
 const w=SRS_WEST_WALL;
 if(![token.atlas===w.atlas,token.tile===w.tile,token.wire===w.wire,token.row===w.row,token.ordinal===w.ordinal].every(Boolean)||
    phase[0]!==w.first||phase[1]!==w.last||geometry.index!==null||geometry.groups.length!==0||
    geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity)return;
 const style=geometry.getAttribute('facadeStyle'),pos=geometry.getAttribute('position'),top=geometry.getAttribute('topFlag'),uv=geometry.getAttribute('uv');
 if(!style||!pos||!top||!uv||style.itemSize!==1||style.normalized||style.array.constructor!==Uint8Array||
   top.count!==w.emittedVertices||style.count!==w.emittedVertices||pos.count!==w.emittedVertices||uv.count!==w.emittedVertices||
   pos.itemSize!==3||top.itemSize!==1||uv.itemSize!==2||style.array.includes(marker))return;
 const u=[0,0,w.metricUVEnd,0,w.metricUVEnd,w.metricUVEnd];
 const v=[0,13.724505424499512,13.684453964233398,0,13.684453964233398,0];
 for(let k=0;k<6;k++){
  const j=w.first+k;
  if(style.getX(j)!==0||top.getX(j)!==0||uv.getX(j)!==u[k]||uv.getY(j)!==v[k]||!Number.isFinite(pos.getY(j)))return;
 }
 const exactBytesCopy=new Uint8Array(style.array);
 exactBytesCopy.fill(marker,w.first,w.last);
 return new BufferAttribute(exactBytesCopy,1,false);
}
