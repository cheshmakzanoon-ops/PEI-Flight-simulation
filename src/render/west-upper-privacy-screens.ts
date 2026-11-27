/** Original detached opaque boards only, shared old station material. Coordinates
 * refer to the already rendered model, not the physical inn or its floor plan. */
import * as T from 'three';
export type Box = readonly [readonly [number,number],readonly [number,number],readonly [number,number]];
export type Role = Readonly<{id:string;centerZ:number;box:Box}>;
export type ModelBasis = Readonly<{yaw:number;innOffset:readonly [number,number,number]}>;
type Vec3 = [number,number,number];
const profile:readonly (readonly [u:number,rise:number])[] = [
 [0,0],[1,0],[1,.95],[.91,.95],[.85,.975],[.795,1.044],[.746,1.160],
 [.683,1.366],[.634,1.409],[.560,1.409],[.518,1.444],[.438,1.587],[.361,1.657],[.231,1.70],[0,1.70]
];
const fails=(x:unknown,m:string)=>{if(!x)throw new Error(m);};
const safe=1e-5; // inward only to conserve ink in the certified F32 virtual clearance volume
const rgb=new T.Color(0xede7da); // exact canonical stock trim neutral, no source palette
const same=(a:number,b:number)=>Math.abs(a-b)<1e-9;
export function makeWestUpperPrivacyScreens(rows:readonly Role[], basis:ModelBasis) {
 fails(rows.length===5&&basis.yaw===-2.635&&basis.innOffset.every((k,i)=>same(k,[-5.45,0,12][i])), 'unexpected geometric/count authority');
 const [ox,oy,oz]=basis.innOffset,c=Math.cos(basis.yaw),s=Math.sin(basis.yaw);
 const pos:number[]=[],nor:number[]=[],color:number[]=[],clad:number[]=[];
 const role:Array<{id:string;first:number;end:number;boundsInnLocal:Box}>=[];
 function point(x:number,y:number,z:number):Vec3 {
  const u=x+ox,v=z+oz;
  return [Math.fround(c*u+s*v),Math.fround(y+oy),Math.fround(-s*u+c*v)];
 }
 function face(a:Vec3,b:Vec3,d:Vec3){
  const n=new T.Vector3(...b).sub(new T.Vector3(...a)).cross(new T.Vector3(...d).sub(new T.Vector3(...a)));
  fails(n.lengthSq()>1e-10,'degenerate authored plate');n.normalize();
  for(const p of [a,b,d]){pos.push(...p);nor.push(n.x,n.y,n.z);color.push(rgb.r,rgb.g,rgb.b);clad.push(0);}
 }
 for(const [i,raw] of rows.entries()){
  const {id,centerZ,box}=raw,[X,Y,Z]=box,first=pos.length/3;
  fails(raw.id==='upper-divider-'+(i+1)&&box.flat().every(Number.isFinite)&&Math.fround(Y[0])===Y[0], 'unqualified box, order or floor');
  fails(rows.slice(0,i).every(p=>p.box[2][1]<Z[0])&&same(centerZ,(Z[0]+Z[1])/2), 'distinct receipt-native gap order');
  fails(same(X[0],5.288)&&same(X[1],6.756)&&same(Y[1]-Y[0],1.70)&&same(Z[1]-Z[0],.090), 'unapproved projection, rise or thickness');
  const a=X[0]+safe,b=X[1]-safe,lo=Y[0],hi=Y[1]-safe,far=Z[0]+safe,near=Z[1]-safe;
  const points=profile.map(([u,y])=>new T.Vector2(a+(b-a)*u,lo+(hi-lo)*y/1.70));
  const A=points.map(p=>point(p.x,p.y,far)),B=points.map(p=>point(p.x,p.y,near));
  const faces=T.ShapeUtils.triangulateShape(points,[]);
  fails(faces.length===profile.length-2,'not a complete simple panel');
  for(const [i,j,k] of faces){
   const p=points[i],q=points[j],r=points[k],w=(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);fails(Math.abs(w)>1e-10,'zero front triangle');
   if(w>0){face(B[i],B[j],B[k]);face(A[k],A[j],A[i]);}
   else {face(B[i],B[k],B[j]);face(A[j],A[k],A[i]);}
  }
  for(let i=0;i<points.length;i++){
   const j=(i+1)%points.length;
   face(A[i],A[j],B[j]);face(A[i],B[j],B[i]);
  }
  role.push({id,first,end:pos.length/3,boundsInnLocal:box});
 }
 const out=new T.BufferGeometry();
 out.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 out.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
 out.setAttribute('color',new T.Float32BufferAttribute(color,3));
 out.setAttribute('clad',new T.Float32BufferAttribute(clad,1));
 out.computeBoundingBox();out.computeBoundingSphere();
 return {mesh:out,role};
}

const DECK_TOP=Math.fround(3.26);
const INN_FRAME={yaw:-2.635,innOffset:[-5.45,0,12] as const};
// Full-precision centers are from the float geometry of the existing virtual sash gaps.
const UPPER_GAP_CENTERS=[
  -5.1249999196109339,
  -1.3750001013680686,
  2.3750000432099529,
  6.1249997207037108,
  9.8499994331357694
] as const;
const NEW_SCREEN_PLAN:readonly Role[]=UPPER_GAP_CENTERS.map((centerZ,i)=>({
  id:'upper-divider-'+(i+1), centerZ,
  box:[[5.288,6.756],[DECK_TOP,DECK_TOP+1.70],[centerZ-.045,centerZ+.045]]
}));

const unique=(source:string,anchor:string)=>source.split(anchor).length===2;
const registeredShader=()=>T.REVISION==='187'&&
 unique(T.ShaderLib.standard.vertexShader,'#include <begin_vertex>')&&
 unique(T.ShaderLib.standard.fragmentShader,'#include <dithering_fragment>');

/** Add the five upper privacy boards to the existing close draw.
 * The floor belongs to the existing inn mesh; never attach to unrelated geometry. */
export function appendWestUpperPrivacyScreens(stock:T.BufferGeometry):T.BufferGeometry{
 if(!registeredShader()||stock.index||stock.groups.length||stock.attributes.position.count!==15963)return stock;
 const a=stock.attributes.position;
 for(let i=12807;i<12813;i++)if(a.getY(i)!==DECK_TOP)return stock;
 const {mesh}=makeWestUpperPrivacyScreens(NEW_SCREEN_PLAN,INN_FRAME);
 const next=new T.BufferGeometry();
 try{
  for(const [key,itemSize] of [['position',3],['normal',3],['color',3],['clad',1]] as const){
   const a=stock.attributes[key],b=mesh.attributes[key];
   if(!(a.array instanceof Float32Array)||!(b.array instanceof Float32Array)||a.itemSize!==itemSize||b.itemSize!==itemSize){
    next.dispose();return stock;
   }
   const out=new Float32Array(a.array.length+b.array.length);
   out.set(a.array);out.set(b.array,a.array.length);
   // The stock paint treats negative cladding as unshingled, like these boards.
   // The sign is a semantic tag, so the shader need not depend on emitter offsets.
   if(key==='clad')out.fill(-1,a.array.length);
   next.setAttribute(key,new T.BufferAttribute(out,itemSize));
  }
  next.computeBoundingSphere();return next;
 }finally{mesh.dispose();}
}

/**
 * Fade only the five new screens before the existing station mesh changes LOD.
 * Keep it deterministic on both multisampled and single-sampled render targets.
 * The simulator's perspective zoom is 1; use the existing station origin.
 */
export function westUpperScreenPaint(stock:T.MeshStandardMaterial){
 const paint=stock.clone(),before=stock.onBeforeCompile;
 paint.customProgramCacheKey=()=> 'west-privacy-ordered-coverage-v1';
 paint.onBeforeCompile=(s,renderer)=>{
  before.call(stock,s,renderer);
  s.vertexShader='flat varying float vWestScreenGain;\n'+s.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\n vWestScreenGain=1.-smoothstep(320.,650.,length(modelViewMatrix[3].xyz));');
  // Discard happens after the stock color and normal derivatives have run.
  s.fragmentShader='flat varying float vWestScreenGain;\n'+s.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
    if(vClad<-.5&&vWestScreenGain<1.){
      if(vWestScreenGain<=0.)discard;
      ivec2 q=ivec2(mod(floor(gl_FragCoord.xy),4.));
      const mat4 ranks=mat4(0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
      if(vWestScreenGain<=(ranks[q.y][q.x]+.5)/16.)discard;
    }`);
 };
 return paint;
}
