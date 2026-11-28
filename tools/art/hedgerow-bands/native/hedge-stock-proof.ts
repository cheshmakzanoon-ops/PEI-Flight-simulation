import type * as T from 'three';
import type {Vegetation} from './vegetation.ts';
const qaKey='ordinary-hedge-stock-q476';
type Profile={site:string, mode:string, view:number, x:number,z:number};
const windows:Record<string,readonly number[]>={'private-prince-field-edge':[440,580],
 'private-queens-field-edge':[250,340],'private-kings-field-edge':[340,440]};
function need(x:unknown,s:string):asserts x{if(!x)throw Error(s);}
function encode(v:ArrayBufferLike){
 const b=new Uint8Array(v);let t='';
 for(let j=0;j<b.length;j+=0x4000)t+=String.fromCharCode(...b.subarray(j,j+0x4000));
 return btoa(t);
}
export function hedgeStockProof(r:T.WebGLRenderer,s:T.Scene,c:T.PerspectiveCamera,v:Vegetation,
 frame:()=>Profile) {
 const g=r.getContext() as WebGL2RenderingContext;
 const samples:Record<string, unknown>[]=[];
 let error='',start:Profile|undefined,previousMode='',covered=0;
 const key=(window as unknown as {__hedgeStockKey?:string}).__hedgeStockKey;
 if(key!==qaKey)return (draw:()=>void)=>{draw();};
 Object.defineProperty(window,'__hedgeStockProof',{value:{
  status:()=>({error,covered,queued:samples.length}), take:()=>samples.shift(),}});
 function getWords(p:WebGLProgram,name:string,n:number,a:number,z:number):Float32Array{
  const l=g.getAttribLocation(p,name);need(l>=0,name+' missing');
  need(g.getVertexAttrib(l,g.VERTEX_ATTRIB_ARRAY_ENABLED)&&
    g.getVertexAttrib(l,g.VERTEX_ATTRIB_ARRAY_SIZE)===n&&g.getVertexAttrib(l,g.VERTEX_ATTRIB_ARRAY_TYPE)===g.FLOAT&&
    g.getVertexAttrib(l,g.VERTEX_ATTRIB_ARRAY_STRIDE)===n*4&&!g.getVertexAttrib(l,g.VERTEX_ATTRIB_ARRAY_NORMALIZED)&&g.getVertexAttrib(l,g.VERTEX_ATTRIB_ARRAY_DIVISOR)===1&&
    g.getVertexAttribOffset(l,g.VERTEX_ATTRIB_ARRAY_POINTER)===0,name+' changed tuple');
  const h=g.getVertexAttrib(l,g.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING); need(g.isBuffer(h),name+' unbound');
  const raw=g.getParameter(g.COPY_READ_BUFFER_BINDING);
  try{
   g.bindBuffer(g.COPY_READ_BUFFER,h);
   const q=new Float32Array((z-a)*n);need(g.getBufferParameter(g.COPY_READ_BUFFER,g.BUFFER_SIZE)>=z*n*4,'short instance buffer');
   g.getBufferSubData(g.COPY_READ_BUFFER,a*n*4,q);return q;
  }finally{g.bindBuffer(g.COPY_READ_BUFFER,raw);}
 }
 function uniform(p:WebGLProgram,n:string){
  const q=g.getUniformLocation(p,n);need(q,n+' not linked');
  const a=g.getUniform(p,q);need(a instanceof Float32Array,a+' unexpected uniform profile');
  return Array.from(a);
 }
 return (draw:()=>void)=>{
  const f=frame(),list=windows[f.site];
  if(f.mode==='dispatch'){start=f;covered=0;}
  const prev=previousMode;previousMode=f.mode;
  if(!list||f.mode!=='flight'||f.view!==0||error||covered>=list.length||start?.site!==f.site){
   draw();return;
  }
  const d=Math.hypot(f.x-start.x,f.z-start.z);
  if(d<list[covered]){draw();return;}
  if(d>list[covered]+35){error='missed physical station '+d;draw();return;}
  const own=v.stockBordenCanopyOwners(), info=v.beaconsfieldShadowRoster();
  if(!own||info.total<=info.original||info.total-info.original!==v.hedgeCount){draw();return;}
  const raw=r.renderBufferDirect,native=g.drawElementsInstanced;
  let data:Record<string, unknown>|undefined, shadow:Record<string, unknown>|undefined;
  const wrapper:typeof raw=(...a)=>{
   if(a[4]===own.shadow){
    g.drawElementsInstanced=(mode,count,type,offset,instances)=>{
     try{
      const p=g.getParameter(g.CURRENT_PROGRAM) as WebGLProgram;
      need(!shadow&&p&&g.isProgram(p)&&a[0]===c&&a[1]===s&&a[2]===own.shadow.geometry&&
        a[3]===own.shadow.material&&a[5]===null&&mode===g.TRIANGLES&&count===6&&type===g.UNSIGNED_SHORT&&
        offset===0&&instances===info.total,'original shadow owner or count drift');
      const floor=getWords(p,'hedgeGround',4,info.original,instances);
      const cpu=own.shadow.geometry.getAttribute('hedgeGround').array;
      need(floor.every((x,i)=>Object.is(x,cpu[info.original*4+i])),'shadow ground upload drift');
      shadow={instances,count,ground:encode(floor.buffer)};
     }catch(e){error=String(e);}
     native.call(g,mode,count,type,offset,instances);
    };
    try{return raw.call(r,...a);}
    finally{g.drawElementsInstanced=native;}
   }
   if(a[4]!==own.crown)return raw.call(r,...a);
   if(data){error='duplicate original crown draw';return raw.call(r,...a);}
   g.drawElementsInstanced=(mode,count,type,offset,instances)=>{
    try{
     const p=g.getParameter(g.CURRENT_PROGRAM) as WebGLProgram;
     need(p&&g.isProgram(p)&&count===6&&mode===g.TRIANGLES&&type===g.UNSIGNED_SHORT&&offset===0&&instances===info.total,'linked original crown draw drift');
     need(a[0]===c&&a[1]===s&&a[2]===own.crown.geometry&&a[3]===own.crown.material&&a[5]===null,'wrong sorted native owner');
     need(g.getParameter(g.SAMPLES)===4&&g.getParameter(g.DEPTH_BITS)===24,'original raster profile changed');
     const stem=getWords(p,'stem',3,info.original,instances),shape=getWords(p,'shape',4,info.original,instances);
     need(stem.every((k,i)=>Object.is(k,info.stems[info.original*3+i]))&&
          shape.every((k,i)=>Object.is(k,info.shapes[info.original*4+i])),'CPU lane does not match stock GPU');
     const code=g.getAttachedShaders(p);need(code?.length===2,'missing linked source');
     data={covered,d,site:f.site,view:f.view,oldMode:prev,
       originalPrefix:info.original,instances:info.total,hedgeCount:instances-info.original,elementCount:count,
       viewMatrix:uniform(p,'viewMatrix'),projection:uniform(p,'projectionMatrix'),eye:uniform(p,'cameraPosition'),
       viewport:Array.from(g.getParameter(g.VIEWPORT)),samples:g.getParameter(g.SAMPLES),
       fullStem:encode(stem.buffer),fullShape:encode(shape.buffer),glsl:code.map(q=>g.getShaderSource(q))};
    }catch(e){error=String(e);}
    native.call(g,mode,count,type,offset,instances);
   };
   try{raw.call(r,...a);}
   finally{g.drawElementsInstanced=native;}
  };
  r.renderBufferDirect=wrapper;
  try{draw();}
  finally{if(r.renderBufferDirect===wrapper)r.renderBufferDirect=raw;}
  if(data&&!error){
   if(!shadow){error='stock hedge shadow not submitted';return;}
   samples.push({...data,shadow});covered++;
  }
 };
}
