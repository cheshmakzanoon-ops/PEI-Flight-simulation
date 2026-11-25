import { BufferGeometry,Color,Float32BufferAttribute,Group,Mesh,ShapeUtils,Vector2 } from 'three';
import { courthouseMaterial,ROLES,type Role } from './materials.ts';
import { annexReturn,areaXZ,COURTHOUSE_RING,evalPlane,outset,planeAt,roofCells,span,splitEdge,ud,type Point } from './roof.ts';
import { GEORGETOWN_COURTHOUSE as M } from './source.generated.ts';

type UV=readonly [number,number];
type Vert=readonly [number,number,number,number,number]; // xyz + metre texture coordinate
const stone=new Color(0x88695b), mutedStone=new Color(0x83685e), cut=new Color(0xaa9f87), baseStone=new Color(0xa0957d),
 reveal=new Color(0x6b5b48), shell=new Color(0x4a4b49), join=new Color(0x6b2623), darkJoin=new Color(0x472423),
 glass=new Color(0x486669), gutter=new Color(0x5d5247);
const jitter=(i:number)=>Math.abs(Math.sin((i+11)*127.1)*43758.55)%1;

const ring=COURTHOUSE_RING;
const bodySign=Math.sign(ring.reduce((a,p,i)=>a+p.x*ring[(i+1)%ring.length].z-ring[(i+1)%ring.length].x*p.z,0));
/** Original western/south-facing architectural interpretation on the retained owner,
 * using dated exterior form and measured absolute roofs. No modeled interior. */
export function createCourthouseExterior(){
 const group=new Group();group.name='Kings County Courthouse · visible exterior';group.position.set(M.originXZ[0],0,M.originXZ[1]);
 const batches=new Map(ROLES.map(k=>[k,{xyz:[] as number[],uv:[] as number[],rgb:[] as number[]} ]));
 const hit=(v:Vert,q:Color,k:Role)=>{const b=batches.get(k)!;b.xyz.push(v[0],v[1],v[2]);b.uv.push(v[3],v[4]);b.rgb.push(q.r,q.g,q.b);};
 const t=(a:Vert,b:Vert,c:Vert,q:Color,k:Role)=>{hit(a,q,k);hit(b,q,k);hit(c,q,k);};
 const square=(a:Vert,b:Vert,c:Vert,d:Vert,q:Color,k:Role)=>{t(a,b,c,q,k);t(a,c,d,q,k);};
 const put=(p:Point,y:number,u:number,v:number):Vert=>[p.x,y,p.z,u,v];
 for(const cell of roofCells()){
  const [a,...r]=cell.points;
  if(r.length<2)continue;
  for(let i=1;i<r.length;i++){
   const b=r[i-1],c=r[i],area=areaXZ(a,b,c);
   if(Math.abs(area)<1e-7)continue;
   const tile=[a,...(area<0?[b,c]:[c,b])].map(k=>{
    const [u,d]=ud(k);return put(k,evalPlane(k,cell.plane),u,d);
   });
   t(tile[0],tile[1],tile[2],shell,'roof');
  }
 }
 for(const row of annexReturn()){
  if(row.top[0]<=row.low[0]&&row.top[1]<=row.low[1])continue;
  const a=row.a,b=row.b,d=span(a,b);
  square(put(a,row.low[0],0,row.low[0]),put(a,row.top[0],0,row.top[0]),put(b,row.top[1],d,row.top[1]),put(b,row.low[1],d,row.low[1]),mutedStone,'rubble');
 }
 type Opening={u:number,w:number,lo:number,high:number,cap:number,kind:'arch'|'sash'|'door'};
 const arch=(c:number,w:number,lo:number,high:number,cap:number,kind:Opening['kind']='arch'):Opening=>({u:c,w,lo,high,cap,kind});
 const casing=(o:Opening)=>o.kind==='sash'?.071:.16;
 const curve=(a:Opening,pad=0):UV[]=>{
  const x=a.u,r=a.w*.5+pad,lo=a.lo-pad,h=a.high+pad;
  if(!a.cap)return [[x-r,lo],[x+r,lo],[x+r,h],[x-r,h]];
  const pts:UV[]=[[x-r,lo],[x+r,lo]];const floor=a.high-a.cap;
  for(let i=0;i<=14;i++){
   const s=i*Math.PI/14;
   pts.push([x+r*Math.cos(s),floor+(a.cap+pad)*Math.sin(s)]);
  }return pts;
 };
 const footing=9.18, plinth=10.62;
 const signedRows=[5,6,7,9];
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],L=span(a,b);
  const ux=(b.x-a.x)/L,uz=(b.z-a.z)/L;
  const at=(u:number,d=0):Point=>({x:a.x+ux*u-bodySign*uz*d,z:a.z+uz*u+bodySign*ux*d});
  const place=(u:number,y:number,d=0)=>put(at(u,d),y,u,y-9.7);
  const rows=splitEdge(a,b).map(v=>v*L);
  // Keep the west and south street elevations explicit; no invented rear apertures.
  let apertures:Opening[]=[];
  if(i===5){
   apertures=[...([.227,.501,.778].map(v=>arch(L*v,1.40,11.28,14.98,.80))),
    ...([.397,.500,.603].map(v=>arch(L*v,.54,17.61,18.91,0,'sash')))];
  }else if(i===6){
   apertures=[arch(2.63,1.82,10.43,14.18,1.03,'door'),...([6.32,9.32,12.31].map(v=>arch(v,1.08,11.31,13.98,.52)))];
  }else if(i===7){
   apertures=[arch(1.13,.96,10.58,13.21,.48,'door'),arch(2.78,.98,10.58,13.22,.49,'door'),
    ...([.62,1.43,2.24,3.07].map(v=>arch(v,.53,14.62,16.72,0,'sash'))),
    ...([2.07,2.64,3.21].map(v=>arch(v,.37,17.76,18.89,0,'sash')))];
  }
  const rect=(u:number,v:number,lo:number,hi:number,d:number,q:Color,k:Role)=>{
   if(v-u<.001||hi-lo<.001)return;
   square(place(u,lo,d),place(u,hi,d),place(v,hi,d),place(v,lo,d),q,k);
  };
  const fill=(outer:UV[],holes:UV[][],d:number,q:Color,k:Role)=>{
   const p=[...outer,...holes.flat()];const vector=(v:UV)=>new Vector2(...v);
   for(const face of ShapeUtils.triangulateShape(outer.map(vector),holes.map(a=>a.map(vector)))){
    const [a,b,c]=face.map(i=>place(...p[i],d));
    // Cull microscopic triangles introduced by geometric splits.
    const twice=(b[3]-a[3])*(c[4]-a[4])-(b[4]-a[4])*(c[3]-a[3]);
    if(Math.abs(twice)>1e-8)t(a,b,c,q,k);
   }
  };
  const bands:{a:number;b:number;hi0:number;hi1:number}[]=[];
  for(let k=1;k<rows.length;k++){
   const lower=rows[k-1],upper=rows[k], f=planeAt(at((lower+upper)/2));
   bands.push({a:lower,b:upper,hi0:evalPlane(at(lower),f),hi1:evalPlane(at(upper),f)});
  }
  const discontinuities=bands.flatMap((v,k)=>k&&Math.abs(v.hi0-bands[k-1].hi1)>.06?[v.a]:[]);
  const walls=[0,...discontinuities,L].slice(1).map((end,j)=>{
   const start=j?discontinuities[j-1]:0;return {start,end,values:bands.filter(x=>x.a>=start-1e-8&&x.b<=end+1e-8)};
  });
  const thickness=.017, inset=signedRows.includes(i)?.047:0;
  for(const w of walls){
   const top=(u:number)=>{const d=w.values.find(j=>u>=j.a-1e-7&&u<=j.b+1e-7)??w.values[0];return d.hi0+(d.hi1-d.hi0)*(u-d.a)/(d.b-d.a);};
   const safe=apertures.filter(o=>{
    const pad=casing(o)+.06,lo=o.u-o.w*.5-pad,hi=o.u+o.w*.5+pad;
    return lo>w.start+.08&&hi<w.end-.08&&(o.kind==='door'||o.lo-pad>plinth)&&o.high+pad+.02<
     Math.min(top(lo),top(hi),...w.values.filter(v=>v.a>lo&&v.a<hi).map(v=>v.hi0));
   }).filter((o,k,all)=>{
    const p=casing(o)+.003, left=o.u-o.w*.5-p,right=o.u+o.w*.5+p;
    // Earcut's holes must be disjoint. Guard the molded stone margins as well
    // as the glass openings, including close-spaced grouped gable sashes.
    return !all.slice(0,k).some(q=>{
     const a=casing(q)+.003;
     return q.u+q.w*.5+a>left&&q.u-q.w*.5-a<right&&q.high+a>o.lo-p&&q.lo-a<o.high+p;
    });
   });
   const notches=safe.filter(o=>o.kind==='door'&&o.lo-.16<plinth).sort((a,b)=>a.u-b.u);
   const rim:UV[]=[[w.start,plinth]];
   const baseRun=(a:number,b:number)=>{
    if(b<=a)return;
    rect(a,b,footing,plinth,0,baseStone,'foundation');
    if(inset)square(place(a,plinth,0),place(a,plinth,inset),place(b,plinth,inset),place(b,plinth,0),baseStone,'foundation');
   };
   let from=w.start;
   for(const o of notches){
    const q=curve(o,.16),left=q[0][0],right=q[1][0];
    rim.push([left,plinth],...q.slice(2).reverse(),[right,plinth]);
    baseRun(from,left);
    rect(left,right,footing,o.lo-.16,0,baseStone,'foundation');
    from=right;
   }
   rim.push([w.end,plinth],[w.end,top(w.end)]);
   for(const row of [...w.values].reverse())rim.push([row.a,row.hi0]);
   fill(rim,safe.filter(o=>!notches.includes(o)).map(o=>curve(o,casing(o))),inset,signedRows.includes(i)?stone:mutedStone,'rubble');
   baseRun(from,w.end);
   if(inset){
    const quay=(start:number,end:number)=>{
     for(let c=0;c<24;c++){
      const lo=10.62+c*.294,high=lo+.266;
      const wd=(c%2?.245:.422)+jitter(i*13+c)*.06;
      const [from,to]=start<end?[start,Math.min(start+wd,end)]:[Math.max(start-wd,end),start];
      if(to-from<.015||high>Math.min(top(from),top(to))-.14)continue;
      if(safe.some(o=>o.u+o.w/2+.18>from&&o.u-o.w/2-.18<to&&o.high+.18>lo&&o.lo-.18<high))continue;
      const h=cut.clone().multiplyScalar(.92+.15*jitter(i*31+c));
      const a=from+.012,b=to-.012;
      rect(a,b,lo,high,.006,h,'cut');
      for(const x of [a,b])square(place(x,lo,.006),place(x,lo,inset),place(x,high,inset),place(x,high,.006),h,'cut');
     }
    };
    if(w.start===0)quay(.01,Math.min(.58,w.end));
    if(w.end===L)quay(L-.011,Math.max(w.start,L-.58));
   }
   // The dated street view shows a shallow pale course directly above the
   // north projection's twin arches; the main front has a quieter upper band.
   const belt=i===7?[14.22,14.49]:i===6?[15.04,15.25]:undefined;
   if(belt&&inset&&safe.every(o=>o.lo-casing(o)>belt[1]||o.high+casing(o)<belt[0])){
    const [lo,hi]=belt;
    const start=w.start+.08,end=w.end-.08;
    if(end>start&&hi+.055<Math.min(top(start),top(end),...w.values.map(r=>r.hi0))){
     const dark=cut.clone().multiplyScalar(.88),mid=cut.clone().multiplyScalar(.96);
     rect(start,end,lo,lo+.036,.010,dark,'cut');
     rect(start,end,lo+.036,hi-.039,.008,mid,'cut');
     rect(start,end,hi-.039,hi,.004,cut,'cut');
     for(const y of [lo,hi])square(place(start,y,.006),place(start,y,inset),place(end,y,inset),place(end,y,.006),mid,'cut');
    }
   }
   for(const z of w.values){
    if(inset&&z.b-z.a>.001)square(place(z.a,z.hi0,0),place(z.a,z.hi0,inset),place(z.b,z.hi1,inset),place(z.b,z.hi1,0),gutter,'metal');
    // Narrow roof-edge trim with no architectural overhang unknown to the survey.
    if(z.b-z.a>.001)square(place(z.a,z.hi0-.092,thickness),place(z.a,z.hi0,thickness),place(z.b,z.hi1,thickness),place(z.b,z.hi1-.092,thickness),gutter,'metal');
   }
   for(const o of safe){
    const cutDepth=o.kind==='door'?.49:.279;
    const out=curve(o), inside=curve(o,o.kind==='sash'?-.062:-.12), outside=curve(o,casing(o));
    const sill=o.lo-.13;
    for(let j=0;j<out.length;j++){
     const n=(j+1)%out.length;
     const c=cut.clone().multiplyScalar(.92+.18*jitter(i*43+j*7+Math.round(o.u*83)));
     square(place(...outside[j],inset),place(...outside[n],inset),place(...out[n],.005),place(...out[j],.005),c,'cut');
     square(place(...out[j],.005),place(...out[n],.005),place(...inside[n],.099),place(...inside[j],.099),c,'cut');
     square(place(...inside[j],.099),place(...inside[n],.099),place(...inside[n],cutDepth),place(...inside[j],cutDepth),reveal,'recess');
    }
    const [left,right]=[o.u-o.w*.5,o.u+o.w*.5];
    if(o.kind==='door'){
     fill(inside,[],cutDepth,join,'red');
     rect(o.u-.028,o.u+.028,o.lo+.13,o.high-.11,cutDepth-.026,darkJoin,'red');
     rect(left+.17,right-.17,o.lo+.32,o.lo+.39,cutDepth-.022,darkJoin,'red');
     if(right-left>1)rect(o.u+.045,o.u+.137,o.lo+.92,o.lo+1.00,cutDepth-.040,gutter,'metal');
    }else{
     fill(inside,[],cutDepth,glass,'glass');
     const w=.027;
     rect(o.u-w,o.u+w,o.lo+.12,o.high-.135,cutDepth-.023,join,'red');
     rect(left+.14,right-.14,o.lo+(o.high-o.lo)*.57-.024,o.lo+(o.high-o.lo)*.57+.024,cutDepth-.023,join,'red');
     for(const j of [-1,1])rect(o.u+j*(o.w*.5-.15)-.024,o.u+j*(o.w*.5-.15)+.024,o.lo+.12,o.high-Math.max(o.cap*.82,.14),cutDepth-.024,join,'red');
     rect(left+.13,right-.13,o.lo+.12,o.lo+.173,cutDepth-.024,join,'red');
    }
    if(o.kind!=='door')rect(left-.18,right+.18,sill-.036,sill+.038,.006,cut,'cut');
   }
  }
 }
 for(const role of ROLES){
  const b=batches.get(role)!;if(!b.xyz.length)continue;
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(b.xyz,3));
  g.setAttribute('uv',new Float32BufferAttribute(b.uv,2));g.setAttribute('color',new Float32BufferAttribute(b.rgb,3));
  g.computeVertexNormals();g.computeBoundingSphere();
  const m=new Mesh(g,courthouseMaterial(role));m.name=`Courthouse ${role}`;group.add(m);
 }
 return group;
}
