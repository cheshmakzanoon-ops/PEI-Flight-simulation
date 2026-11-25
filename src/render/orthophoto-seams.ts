import * as T from 'three';
import {WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import {DETAIL_FADE_SECONDS} from './detail-blend.ts';

const P=640,HALO=2,STRIP_PIXELS=P*4,BLEND_SEC=.16;
const plans=[
 {first:'27-13',second:'27-14',axis:'z',edge:14,nsha:'4b1451500baea6ed936476e3dc39d7200ba281174ae7638dcf702b78745a13cb',ssha:'7503afe173dde2532289bcc8ec93dc375ce3207f49f29070427e619c30744829'},
 {first:'5-2',second:'5-3',axis:'z',edge:3,nsha:'0ad5621e0c876450d5f192b7f153631c02ea492a23a9a48ce91d70725ccbf751',ssha:'6b92f4c4e98f915b5636b1827e7ce9cf94abd5fea8656580916ccac7ba301e36'},
 {first:'10-12',second:'11-12',axis:'x',edge:11,nsha:'aec5292f13fd5424f9881eb174e484b92313a885ac415b444640f298f633f65e',ssha:'0872113e73cb6ca8a442ffc6b57c10c66e38e820f5b0e577bc6ecf3c78e55688'},
] as const;
const tracadie={first:'18-12',second:'18-13',axis:'z',edge:13,
 nsha:'c7d2837de536fcbfbe8cba81ce5117f82b7d94f14ba9e883662bb62b77db1615',
 ssha:'7bad9c6a684790d28c193a1e23d679d158b07fd090f4e18c019df5b77579c6ee'} as const;
type Plan=(typeof plans)[number]|typeof tracadie;
type LiveOwner={detail?:T.Texture;detailSince?:number;lod:number;status:string};
type Receipt={uploaded:boolean;id:string;sha:string};
type Pair={
 plan:Plan;gain:{value:number};map:{value:T.Texture};owners:Set<string>;
 live?:{n:T.Texture;s:T.Texture;strip:T.DataTexture;clock:number};
 failed?:readonly [n:T.Texture,s:T.Texture];uploads:number;errors:number;
};
export function seamOptions(q:URLSearchParams){
 return q.has('orthophotoSeamStudy')&&q.get('scenery')!=='detail'&&
  !['surveyRelief','inlandRelief','buildingShadows','aerialPerspectiveStudy','sourceGrassStudy',
    'sourceGrassNap','provinceFieldsReview','indianRiverReview','forestFloor'].some(x=>q.has(x));
}
const target='  col=textureGrad(detailMap,detailUV,du,dv).rgb;';
const globals='uniform highp sampler2D orthoSharedRows;\nuniform float orthoRowsGain;\n';
function sample(plan:Plan){
 const eastWest=plan.axis==='x',bound=eastWest?WORLD_COLS:WORLD_ROWS;
 const cross=eastWest?'x':'y',along=eastWest?'y':'x';
 const combined=eastWest?'vec2(.5+crossTexel*.25,detailUV.y)':'vec2(detailUV.x,.5-crossTexel*.25)';
 return `
  if(orthoRowsGain>0.){
   ${plan.first==='18-12'?'float localRange=1.-smoothstep(205.,330.,distance(cameraPosition,p));':'float localRange=1.;'}
   float crossTexel=(vuv.${cross}*${bound}. - ${plan.edge}.)*640.;
   float flank=640.*min(detailUV.${along},1.-detailUV.${along});
   if(localRange>0.&&abs(crossTexel)<1.25&&flank>3.){
    vec2 dx=du*640.,dy=dv*640.;
    float rho2=dot(dx,dx)+dot(dy,dy);
    if(rho2<.81){
     float w=localRange*(1.-smoothstep(.3025,.81,rho2))*(1.-smoothstep(.55,1.25,abs(crossTexel)))*smoothstep(3.,5.,flank);
     vec3 canonical=textureLod(orthoSharedRows,${combined},0.).rgb;
     col=mix(col,canonical,w*orthoRowsGain);
    }
   }
  }
 `;
}
export class OrthophotoSeams{
 private receipts=new WeakMap<T.Texture,Receipt>();
 private readonly pairs:Pair[];
 private readonly renderer:T.WebGLRenderer;
 private readonly base:T.Texture;
 constructor(renderer:T.WebGLRenderer,base:T.Texture,scope:'study'|'tracadie'='study'){
  this.renderer=renderer;this.base=base;
  const active=scope==='tracadie'?[tracadie]:plans;
  this.pairs=active.map(plan=>({plan,gain:{value:0},map:{value:base},owners:new Set(),uploads:0,errors:0}));
 }
 readonly verifiedDetail=(id:string,sha:string,texture:T.Texture)=>{
  if(!this.pairs.some(({plan:p})=>p.first===id&&p.nsha===sha||p.second===id&&p.ssha===sha))return;
  const img=texture.image as ImageBitmap|undefined;
  if(!img||img.width!==P||img.height!==P||texture.flipY||texture.premultiplyAlpha||texture.colorSpace!==T.NoColorSpace||
      texture.format!==T.RGBAFormat||texture.type!==T.UnsignedByteType)return;
  const receipt={id,sha,uploaded:false};this.receipts.set(texture,receipt);
  const prior=texture.onUpdate;
  texture.onUpdate=t=>{receipt.uploaded=true;prior?.call(texture,t);};
 };
 bind(id:string,material:T.ShaderMaterial){
  const pair=this.pairs.find(p=>p.plan.first===id||p.plan.second===id);
  if(!pair||!material.fragmentShader.includes(target)||material.fragmentShader.includes('orthoSharedRows'))return;
  material.fragmentShader=globals+material.fragmentShader.replace(target,target+sample(pair.plan));
  material.uniforms={...material.uniforms,orthoSharedRows:pair.map,orthoRowsGain:pair.gain};
  pair.owners.add(id);
 }
 private withdraw(p:Pair){
  p.gain.value=0;p.map.value=this.base;
  p.live?.strip.dispose();p.live=undefined;
 }
 /** Withdraw both resource bindings before the stock tile can be disposed. */
 evict(id:string,texture:T.Texture){
  for(const p of this.pairs){
   if(id!==p.plan.first&&id!==p.plan.second)continue;
   if(p.live&&(p.live.n===texture||p.live.s===texture))this.withdraw(p);
   if(p.failed&&(p.failed[0]===texture||p.failed[1]===texture))p.failed=undefined;
  }
  this.receipts.delete(texture);
 }
 private uploaded(owner:LiveOwner|undefined,id:string,sha:string,clock:number){
  if(!owner||owner.lod!==112||owner.status!=='ready'||owner.detailSince===undefined||
    clock-owner.detailSince<DETAIL_FADE_SECONDS||!owner.detail)return;
  const r=this.receipts.get(owner.detail);
  return r?.id===id&&r.sha===sha&&r.uploaded?owner.detail:undefined;
 }
 private create(plan:Plan,first:T.Texture,second:T.Texture){
  const gl=this.renderer.getContext();
  if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)return;
  const eastWest=plan.axis==='x';
  const strip=new T.DataTexture(new Uint8Array(STRIP_PIXELS*4),eastWest?4:P,eastWest?P:4,T.RGBAFormat,T.UnsignedByteType);
  strip.magFilter=strip.minFilter=T.LinearFilter;strip.colorSpace=T.NoColorSpace;strip.needsUpdate=true;
  try{
   this.renderer.initTexture(strip);
   const copy=(t:T.Texture,start:number,out:number)=>{
    const lo=eastWest?new T.Vector2(start,0):new T.Vector2(0,start);
    const hi=eastWest?new T.Vector2(start+HALO,P):new T.Vector2(P,start+HALO);
    const point=eastWest?new T.Vector2(out,0):new T.Vector2(0,out);
    this.renderer.copyTextureToTexture(t,strip,new T.Box2(lo,hi),point);
   };
   if(eastWest){copy(first,P-HALO,0);copy(second,0,HALO);}
   else{copy(second,P-HALO,0);copy(first,0,HALO);}
   if(!gl.isContextLost()&&gl.getError()===gl.NO_ERROR)return strip;
  }catch{/* This local preview never blocks the stock texture. */}
  strip.dispose();
 }
 update(clock:number,lookup:(id:string)=>LiveOwner|undefined){
  if(!Number.isFinite(clock))return;
  let started=false;
  for(const p of this.pairs){
   const {first,second,nsha,ssha}=p.plan;
   const n=this.uploaded(lookup(first),first,nsha,clock),s=this.uploaded(lookup(second),second,ssha,clock);
   if(p.live&&(p.live.n!==n||p.live.s!==s||this.renderer.getContext().isContextLost()))this.withdraw(p);
   if(!n||!s||p.owners.size!==2)continue;
   if(!p.live&&!started&&!(p.failed?.[0]===n&&p.failed?.[1]===s)){
    started=true;
    const strip=this.create(p.plan,n,s);
    if(!strip){p.failed=[n,s];p.errors++;continue;}
    p.map.value=strip;p.live={n,s,strip,clock};p.uploads++;
   }
  }
  this.advance(clock);
 }
 advance(clock:number){
  if(!Number.isFinite(clock))return;
  for(const p of this.pairs){
   if(!p.live)continue;
   const t=Math.max(0,Math.min(1,(clock-p.live.clock)/BLEND_SEC));
   p.gain.value=t*t*(3-2*t);
  }
 }
 diagnostics(){
  return this.pairs.map(p=>({edge:p.plan.first+' / '+p.plan.second,resident:!!p.live,gain:p.gain.value,
   bytes:p.live?STRIP_PIXELS*4:0,uploads:p.uploads,errors:p.errors}));
 }
}
