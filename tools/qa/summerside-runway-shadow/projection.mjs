// Independent source/emitter-only CYSU shadow witness. Read-only: writes aggregate JSON to stdout.
import A from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const {T,world,terrain,cover}=await import('./stock-world.mjs');
const {createAircraft}=await import('../../../src/render/aircraft.ts');
const {RUNWAYS}=await import('../../../src/sim/places.ts');
const [dir,...ids]=process.argv.slice(2); A(dir&&ids.length);
const S=256, bias=.0014, castPad=1/16, lightPad=1/8, zPad=.00022, screenPad=.75;
const buf=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),sha=a=>createHash('sha256').update(a).digest('hex');
const same=(a,b,eps=0)=>a.length===b.length&&a.every((x,i)=>Math.abs(x-b[i])<=eps);
const M=a=>(A(Array.isArray(a)&&a.length===16&&a.every(Number.isFinite)),new T.Matrix4().fromArray(a)), F=Math.fround;
const mv=(m,[x,y,z])=>{const e=m.elements;
 return [0,1,2,3].map(i=>e[i]*x+e[i+4]*y+e[i+8]*z+e[i+12]);};
const pt=(p,fn)=>Array.from({length:p.count},(_,i)=>fn([p.getX(i),p.getY(i),p.getZ(i)]));
const minmax=(p,j)=>[Math.min(...p.map(q=>q[j])),Math.max(...p.map(q=>q[j]))];
function clip(P,f){if(!P.length)return P;const Q=[];let v=P.at(-1),a=f(v);
 for(const w of P){const b=f(w);
  if((a>=0)!==(b>=0))Q.push(v.map((x,i)=>x+(w[i]-x)*a/(a-b)));
  if(b>=0)Q.push(w);v=w;a=b;
 }return Q;}
const cuts=(p,...f)=>f.reduce((p,g)=>clip(p,g),p);
const rect=(p,x,y,X,Y)=>cuts(p,q=>q[0]-x,q=>X-q[0],q=>q[1]-y,q=>Y-q[1]);
const tix=(p,e,k)=>[p[e.getX(k)],p[e.getX(k+1)],p[e.getX(k+2)]];
const grad={addColorStop(){}},ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createRadialGradient:()=>grad,createLinearGradient:()=>grad},{get:(o,k)=>o[k]??(()=>{})});
globalThis.document={createElement(n){A.equal(n,'canvas');return {getContext:()=>ctx};}};
const rig=createAircraft();rig.setInterior(false);rig.root.updateMatrixWorld(true);
const moving=new Set('62 64 77 79 96.0'.split(' ')),md=createHash('sha256');
const owner='0 59 60 61 62 74 75 76 77 63 64 78 79 96.0 97 71.0 86.0 95.0 65 66 67 68 80 81 82 83 89 90 91 92 93 94 101.0 101.1'.split(' ').map(id=>{
 const o=id.split('.').reduce((o,k)=>o.children[+k],rig.root),p=o.geometry.attributes.position,e=o.geometry.index,m=moving.has(id);
 A(o.isMesh&&o.castShadow&&!o.material.transparent&&o.material.opacity===1&&!p.normalized&&!e.normalized&&p.array instanceof Float32Array&&e.array instanceof Uint16Array);
 md.update(JSON.stringify([id,m,p.count,e.count,sha(buf(p.array)),sha(buf(e.array))])+'\n');
 return {id,p,e,static:o.matrixWorld.clone(),m};});
const model=md.digest('hex'); A.equal(model,'5bda76cd5bffc4b1df54a7f9c1932b9fc48ef149bf42bd3bb9bbc953f2ff10aa');
const runway=RUNWAYS.find(r=>r.id==='CYSU05'),inRun=q=>{
 const x=q[3]-runway.p.x,z=q[5]-runway.p.z;
 return [x*runway.dx+z*runway.dz,x*runway.dz-z*runway.dx];};
function raster(P,e,D,U){
 for(let k=0;k<e.count;k+=3){
  const G=tix(P,e,k),[a,b,c]=G,[vl,vh]=minmax(G,0),[wl,wh]=minmax(G,1);
  const den=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(Math.abs(den)<1e-15)continue;
  for(let j=Math.max(0,Math.ceil(wl-.5-castPad));j<=Math.min(S-1,Math.floor(wh-.5+castPad));j++)
   for(let i=Math.max(0,Math.ceil(vl-.5-castPad));i<=Math.min(S-1,Math.floor(vh-.5+castPad));i++){
    const x=i+.5,y=j+.5,n=j*S+i,p=((x-a[0])*(c[1]-a[1])-(y-a[1])*(c[0]-a[0]))/den,q=((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]))/den;
    if(p>=0&&q>=0&&p+q<=1)D[n]=Math.min(D[n],a[2]+p*(b[2]-a[2])+q*(c[2]-a[2]));
    for(const z of rect(G,x-castPad,y-castPad,x+castPad,y+castPad))U[n]=Math.min(U[n],z[2]);
   }
 }
}
function mark(P,V,mask,w,h,pad=null){
 if(P.length<3)return;
 const L=P.map(p=>{const [x,y,z,a]=mv(V,p.slice(3));A(a>.08);return [(x/a*.5+.5)*w,(.5-y/a*.5)*h];});
 const [l,h0]=minmax(L,1),start=pad===null?.5:1+pad,end=pad===null?-.5:pad;
 for(let j=Math.max(0,Math.ceil(l-start));j<=Math.min(h-1,Math.floor(h0+end));j++){
  const y=j+.5,Q=pad===null?L.flatMap((a,i)=>{
    const b=L[(i+1)%L.length];return (a[1]>y)!==(b[1]>y)?[[a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1])]]:[];
   }):cuts(L,q=>q[1]-j+pad,q=>j+1+pad-q[1]);
  if(!Q.length)continue;
  const [m,n]=minmax(Q,0),a=Math.max(0,Math.ceil(m-start)),b=Math.min(w-1,Math.floor(n+end));
  if(a<=b)mask.fill(1,j*w+a,j*w+b+1);
 }
}
const n=a=>a.reduce((s,b)=>s+Number(!!b),0);
const png=(name,w,h)=>{
 const f=spawnSync('python',['-B','-c','from PIL import Image;import sys;i=Image.open(sys.argv[1]);assert i.size==(int(sys.argv[2]),int(sys.argv[3]));sys.stdout.buffer.write(i.convert("RGBA").tobytes())',name,String(w),String(h)],{maxBuffer:w*h*4+8192});
 A.equal(f.status,0,f.stderr.toString());return f.stdout;};
for(const id of ids){
 const file=s=>dir+'/'+id+'-'+s;
 const q=JSON.parse(read(file('geometry.json'))),cam=q.camera,[w,h]=cam.viewport;
 A(q.id===id&&q.view===0&&q.samples===4&&q.flightMode==='flight'&&same(q.sun,world.sun.toArray(),1e-12));
 const V=M(cam.projection).multiply(M(cam.view)),VF=M(cam.projection.map(F)).multiply(M(cam.view.map(F)));
 A(same(M(cam.view).invert().elements.slice(12,15),cam.position,1e-8));
 const O=new Uint8Array(w*h),E=O.slice(),C=O.slice(),D=new Float64Array(S*S).fill(1),U=D.slice(),faces=[];
 const box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
 let dry=null;
 if(q.state.active){
  A(q.state.gain>0&&q.state.gain<=1&&q.state.draws===1&&q.state.triangles===7184);
  const L=M(q.light.projection),LF=M(q.light.projection.map(F)),e=L.elements,lv=j=>[e[j],e[4+j],e[8+j]];
  A(same(new T.Vector3(...lv(2)).normalize().negate().toArray(),q.sun,1e-9)&&[16.5,16.5,47.875].every((d,k)=>Math.abs(Math.hypot(...lv(k))*d-2)<1e-8));
  const light=(p,L)=>mv(L,p.slice(0,3).map((v,k)=>v-q.light.origin[k])).slice(0,3).map((v,k)=>(v*.5+.5)*(k<2?S:1));
  const root=M(q.aircraft),iv=root.clone().invert(),mapping=new Map(q.caster.map(x=>[x.id,M(x.matrix)]));
  A(q.caster.length===34&&mapping.size===34);
  for(const x of owner){
   const r=iv.clone().multiply(mapping.get(x.id));
   if(!x.m)A(same(r.elements,x.static.elements,1e-8),x.id+' static pose');
   const P=pt(x.p,p=>light(mv(root,mv(x.m?r:x.static,p).slice(0,3).map(F)),L));
   A(P.every(a=>a[0]>0&&a[0]<S&&a[1]>0&&a[1]<S&&a[2]>0&&a[2]<1));
   raster(P,x.e,D,U);
  }
  const pix=Array.from(U.keys()).filter(k=>U[k]<1);
  const xe=pix.map(k=>k%S),ye=pix.map(k=>Math.floor(k/S)); A(pix.length);
  const lx=Math.min(...xe)-1,hx=Math.max(...xe)+2,ly=Math.min(...ye)-1,hy=Math.max(...ye)+2;
  world.update(new T.Vector3(...cam.position),0);
  A(new Set(q.receivers.map(v=>v.id)).size===q.receivers.length);
  for(const a of q.receivers){
   if(a.lod!==112||!a.visible)continue;
   A(/^(7|8)-12$/.test(a.id));const t=world.byId.get(a.id),o=t.fine; o.updateMatrixWorld();
   A(t.lod===112&&t.seams===a.seams&&o.visible&&!o.userData.localGrade&&!o.userData.coastalSurvey);
   A(same(a.matrix,o.matrixWorld.elements,1e-8)&&same(a.matrix.map(F),o.matrixWorld.elements.map(F)));
   const p=o.geometry.attributes.position,e=o.geometry.index;
   A(p.count===12769&&e.count===75264);
   for(const [k,v] of [['p',p],['i',e]]){
    A.equal(a[k+'Sha'],sha(buf(v.array)));A(read(file(a.id+'-'+k+'.bin')).equals(buf(v.array)));
   }
   const W=M(a.matrix.map(F)),G=pt(p,p=>{const v=mv(W,p).slice(0,3).map(F);return [...light(v,LF),...v];});
   let face=0;
   for(let k=0;k<e.count;k+=3){
    const B=tix(G,e,k),[x,X]=minmax(B,0),[y,Y]=minmax(B,1);
    if(X<lx||x>hx||Y<ly||y>hy)continue;
    const Q=cuts(B,p=>inRun(p)[0],p=>runway.length-inRun(p)[0],p=>runway.width*.5-inRun(p)[1],p=>runway.width*.5+inRun(p)[1]);
    if(Q.length<3)continue; let hit=false;
    for(let j=Math.max(0,Math.ceil(y-1.5-lightPad));j<=Math.min(S-1,Math.floor(Y+.5+lightPad));j++)
     for(let i=Math.max(0,Math.ceil(x-1.5-lightPad));i<=Math.min(S-1,Math.floor(X+.5+lightPad));i++){
      const k=j*S+i;if(U[k]>=1)continue;
      const shape=(d,b,z)=>clip(rect(Q,i-.5-b,j-.5-b,i+1.5+b,j+1.5+b),p=>p[2]-d-bias+z);
      const P=rect(shape(U[k],lightPad,zPad),.015*S,.015*S,.985*S,.985*S);
      if(P.length>=3){
       hit=true;
       for(const p of P){
        A(Math.hypot(...cam.position.map((v,k)=>v-p[3+k]))<129);
        for(let k=0;k<3;k++){box[k]=Math.min(box[k],p[k+3]);box[k+3]=Math.max(box[k+3],p[k+3]);}
       }
       mark(P,V,O,w,h,screenPad);mark(P,VF,O,w,h,screenPad);
      }
      if(D[k]<1){
       const P=shape(D[k],0,0);mark(P,V,C,w,h);mark(P,V,E,w,h,0);
      }
     }
    if(hit)face++;
   }
   faces.push([a.id,face,a.pSha,a.iSha]);
  }
  A(box.every(Number.isFinite)&&n(O)>100);
  const [u,v]=terrain.uv(box[0],box[2]),[U0,V0]=terrain.uv(box[3],box[5]);dry=Infinity;
  for(let j=Math.floor(v*cover.height-.5);j<=Math.floor(V0*cover.height-.5)+1;j++)
   for(let i=Math.floor(u*cover.width-.5);i<=Math.floor(U0*cover.width-.5)+1;i++){
    A(i>=0&&i<cover.width&&j>=0&&j<cover.height);
    dry=Math.min(dry,2*(cover.bytes[2*(j*cover.width+i)+1]-128));}
  A(dry>=64);
 }
 const a=png(file('stock.png'),w,h),b=png(file('active.png'),w,h),r=png(file('repeat.png'),w,h);A(a.equals(r));
 let changed=0,strong=0,alpha=0,brighter=0,out=0,centre=0,whole=0;const examples=[],edge=[];
 for(let i=0;i<w*h;i++){
  const k=4*i,d=[0,1,2].map(j=>a[k+j]-b[k+j]),mx=Math.max(...d.map(Math.abs));
  if(a[k+3]!==b[k+3])alpha++;if(!mx)continue;
  changed++;if(mx>2)strong++;if(Math.min(...d)<0)brighter++;
  if(!O[i]){out++;if(examples.length<8)examples.push([i%w,Math.floor(i/w),mx]);}
  if(!C[i])centre++;
  if(!E[i]){whole++;if(edge.length<8)edge.push([i%w,Math.floor(i/w),mx]);}
 }
 console.log(JSON.stringify({id,model,changed,strong,alpha,brighter,out,examples,centre,whole,edge,mask:[n(C),n(E),n(O)],dry,box,faces}));
 A(out===0&&alpha===0&&brighter===0&&(q.state.active?(id.startsWith('roll')?strong>=1000:true):changed===0));
}
