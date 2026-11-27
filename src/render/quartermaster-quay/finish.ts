import {project} from '../../sim/geo.ts';

export const QUAY_ROUTE='harbour-low';
export const QUAY_SOURCE=Object.freeze({
 count:16230,position:'6ace51bc62629d5451fc332ef5c7515dafbae746a5024326bf7138885f550f34',
 uv:'80b169d9b9d9365ba421fbbd30ad56fb7f54709837e442d5b4029935f874597a',
 vertex:'a71f9476607f8cb5313693f8558281963fdffa6ec6cbc0c8591010505eba9496',
 fragment:'0e92b2fc24304ed5f47942b9581459391582224ee0dc96400a2caa1d98b92c66',
 coast:'61e9d52c4e2a24985c77c412a31621e19070e7ac6620ebdc80ef6edbd933226e',
 harbour:'f26ba03ce1d4d5a40ef24ce87c903074bf5a7f5f8354816c1f609d8c8621ea8d',
 cover:'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
 selected:'20a22fc87e5b9aa88d4c1d1b17e529f42a6edc98a5cdc108b8451e7431a9fdc7',
});
// Original directed ODbL way 251166158 v30. Only entire old curtain
// sextuples sampled inside these conservative intervals are eligible.
// These boundaries are author review reserves, not surveyed wall ends.
const roles=[
 {nodes:[110,111],a:[-63.1225438,46.2319966],b:[-63.1223241,46.2321367],cut:[.12,.90],
  spans:[[12660,12804]]},
 {nodes:[112,113],a:[-63.1223049,46.232149],b:[-63.1221496,46.2322122],cut:[.10,.88],
  spans:[[12528,12594],[12600,12606],[13038,13044]]},
 {nodes:[113,114],a:[-63.1221496,46.2322122],b:[-63.1220965,46.2322442],cut:[.18,.74],
  spans:[[12930,12942],[12954,12966]]},
] as const;
const definitions=roles.map(({a,b,cut,spans})=>{
 const o=project(a[0],a[1]),e=project(b[0],b[1]),x=e.x-o.x,z=e.z-o.z,L=Math.hypot(x,z);
 return {o,x:x/L,z:z/L,L,cut,spans};
});
const starts=Object.freeze(roles.flatMap((r,role)=>r.spans.flatMap(([a,b])=>
 Array.from({length:(b-a)/6},(_,i)=>Object.freeze([a+6*i,role+1] as const)))).sort(([a],[b])=>a-b));

/** Isolated private trial. No unrelated option is interpreted or swallowed. */
export function quartermasterQuayRequested(q:URLSearchParams){
 if(q.getAll('quartermasterQuayStudy').length!==1||q.get('quartermasterQuayStudy')!==''||
    q.getAll('diagnostics').length>1||q.getAll('departure').length>1||
    (q.has('departure')&&q.get('departure')!==QUAY_ROUTE))return false;
 for(const k of q.keys())if(k!=='quartermasterQuayStudy'&&k!=='diagnostics'&&k!=='departure')return false;
 return true;
}

/** Return independent selected-byte custody, only for the exact role order
 * and same recorded vertical triangles. No inferred world coverage. */
export function selectQuayPositions(position:Float32Array){
 if(position.length!==QUAY_SOURCE.count*3)return;
 const result=new Float32Array(starts.length*18);
 let n=0;
 for(let j=0;j<position.length;j+=18){
  const a=position[j],b=position[j+2],c=position[j+3],d=position[j+5];
  const x=c-a,z=d-b,L=Math.hypot(x,z);
  if(!Number.isFinite(L)||!L)return;
  let role=0;
  for(const [i,e] of definitions.entries()){
   const dx=a-e.o.x,dz=b-e.o.z,xx=c-e.o.x,zz=d-e.o.z;
   const u0=(dx*e.x+dz*e.z)/e.L,u1=(xx*e.x+zz*e.z)/e.L;
   const s0=dx*e.z-dz*e.x,s1=xx*e.z-zz*e.x;
   if(u0>=e.cut[0]&&u1>=e.cut[0]&&u0<=e.cut[1]&&u1<=e.cut[1]&&
      s0>=-1.65&&s1>=-1.65&&s0<=-.98&&s1<=-.98&&Math.abs(x*e.x+z*e.z)/L>=.86){
    if(role)return;
    role=i+1;
   }
  }
  const e=starts[n];
  if(!role){if(e&&e[0]===j/3)return;continue;}
  if(!e||e[0]!==j/3||e[1]!==role)return;
  const y=position[j+1],ha=position[j+7],hb=position[j+16];
  if(![y,ha,hb].every(Number.isFinite)||!(ha>y&&hb>y)||y!==position[j+4]||
     a!==position[j+6]||b!==position[j+8]||a!==position[j+9]||ha!==position[j+10]||b!==position[j+11]||
     c!==position[j+12]||y!==position[j+13]||d!==position[j+14]||c!==position[j+15]||d!==position[j+17])return;
  result.set(position.subarray(j,j+18),n*18);n++;
 }
 return n===starts.length?result:undefined;
}

const qualifier='flat varying highp int qmqRole;\ncentroid varying highp vec3 qmqPosition;\ncentroid varying highp float qmqUp;\n';
const projected=(expr:number)=>expr.toFixed(9);
const optics=`
 uniform highp float qmqGain;
 // Restrained discontinuous wear and low-value damp timber/concrete.
 // The observed landing is mixed; no pile or repeating seam claims.
 vec3 qmqFinish(vec3 old,vec3 w,vec3 dx,vec3 dy,float yfrac,float dist,int role,float lowReserve){
  if(role<1||role>3)return old;
  vec2 o,t;float len,lo,hi;
`+definitions.map((e,i)=>`
  ${i===0?'if':'else if'}(role==${i+1}){o=vec2(${projected(e.o.x)},${projected(e.o.z)});t=vec2(${projected(e.x)},${projected(e.z)});
   len=${projected(e.L)};lo=${projected(e.cut[0])};hi=${projected(e.cut[1])};}
`).join('')+`
  else return old;
  float u=dot(w.xz-o,t);
  float span=(hi-lo)*len;
  float inward=min(u-lo*len,hi*len-u);
  float fade=smoothstep(0.,min(2.1,span*.23),inward)*(1.-smoothstep(450.,635.,dist));
  // Keep the uppermost old edge; cannot brighten or draw a cap, parapet,
  // pile, opening, rock apron, damp line, or new silhouette.
  fade*=(1.-smoothstep(.76,.98,yfrac))*smoothstep(0.,.24,lowReserve);
  if(fade<=0.)return old;
  float dry=smoothstep(.06,1.12,w.y);
  float pw=abs(dot(dx.xz,t))+abs(dot(dy.xz,t));
  float broad=noise(vec2(u*.18+float(role)*8.3,w.y*.29))-.5;
  float grain=(1.-smoothstep(.38,1.65,pw))*(noise(vec2(u*.68,w.y*.53))-.5);
  vec3 col=mix(vec3(.078,.079,.071),vec3(.160,.150,.130),dry);
  col*=1.+.20*broad+.14*grain;
  return mix(old,min(old,col),fade*.86);
 }
`;
const vIn='p=w.xyz;vuv=uv;';
const fMain='void main(){';
const fOut='gl_FragColor=vec4(peiairSurface(mist(col,d,p.y),col,p,cameraPosition,d),1.);';
const only=(s:string,a:string)=>s.split(a).length===2;
export function quartermasterQuayShaders(vertex:string,fragment:string){
 if(vertex.includes('qmq')||fragment.includes('qmq')||!only(vertex,vIn)||!only(fragment,fMain)||
    !only(fragment,fOut)||!only(fragment,'#include <colorspace_fragment>'))return;
 const selector=roles.map((q,i)=>`if(${q.spans.map(([a,b])=>`(i>=${a}&&i<${b})`).join('||')})return ${i+1};`).join('\n ');
 const lhs=qualifier+`int qmqPrimitive(int i){\n ${selector}\n return 0;\n}\n`;
 return {
  vertexShader:lhs+vertex.replace(vIn,vIn+`
   qmqRole=qmqPrimitive(gl_VertexID);
   qmqPosition=p;
   int qmqCorner=gl_VertexID%6;
   qmqUp=(qmqCorner==2||qmqCorner==3||qmqCorner==5)?1.:0.;
`),
  fragmentShader:qualifier+fragment.replace(fMain,optics+'\n'+fMain).replace(fOut,`
   if(qmqGain==1.){
    vec3 qmqDX=dFdx(qmqPosition),qmqDY=dFdy(qmqPosition);
    // The original perspective-correct height numerator is affine in
    // screen space. Protect OCEAN_Y + .12m with a further .035m inward reserve.
    float qmqH=(p.y-.10)*gl_FragCoord.w;
    float qmqLow=qmqH-.75*(abs(dFdx(qmqH))+abs(dFdy(qmqH)))-1.e-7;
    if(qmqLow>0.&&gl_FragCoord.w>0.)
     col=qmqFinish(col,qmqPosition,qmqDX,qmqDY,qmqUp,d,qmqRole,qmqLow/gl_FragCoord.w);
   }
   `+fOut),
 };
}
