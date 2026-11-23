import {Color,ShapeUtils,Vector2} from 'three';
import {SOURIS_MCLEAN} from './souris-mclean.generated.ts';

type XY=readonly [number,number];
type Pt=Readonly<{x:number;z:number}>;
type XYD=readonly [number,number,number]; // along, above sea level, inset
type Writer=(p:Pt,y:number,color:Color,u:number,v:number,role:number,style:number)=>void;
type Plane=readonly [number,number,number];
const M=SOURIS_MCLEAN;
export const MCLEAN_STYLE=49;
export const MCLEAN_TILE=M.tile;
export const MCLEAN_ATLAS=M.atlasSha256;
export const MCLEAN_ROLES={board:62,roof:63,westRoof:64,annexRoof:65,trim:66,reveal:67,glass:68,foundation:69,blankSignBand:70} as const;
const r=MCLEAN_ROLES;
const slate=new Color(0x647f91),back=new Color(0x667985),roof=new Color(0x4c5052),westRoof=new Color(0x515453),
 annexRoof=new Color(0x585a58),cream=new Color(0xd1cbbb),creamShadow=new Color(0x969888),inner=new Color(0x424d4d),
 glass=new Color(0x475453),stone=new Color(0x76695d),kick=new Color(0x526b76),panel=new Color(0x4e6b7c);
const EPS=1e-9;
const dot=(p:Pt,q:Plane)=>{
 const x=p.x-M.originXZ[0],z=p.z-M.originXZ[1],b=M.worldToFace;
 return q[0]+q[1]*(b[0][0]*x+b[1][0]*z)+q[2]*(b[0][1]*x+b[1][1]*z);
};
const at=(a:Pt,b:Pt,t:number):Pt=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const distance=(a:Pt,b:Pt)=>Math.hypot(b.x-a.x,b.z-a.z);
const area=(a:Pt,b:Pt,c:Pt)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const roofSide=(p:Pt)=>M.cut.reduce((n,f)=>n+Number(dot(p,f)>=0),0);
export const sourisMcleanRoofHeight=(p:Pt)=>dot(p,M.planes[roofSide(p)]);
export function sourisMcleanModel(atlas:string|undefined,tile:string,ordinal:number,ring:readonly XY[],holes?:readonly (readonly XY[])[]){
 return atlas===M.atlasSha256&&tile===M.tile&&ordinal===M.ordinal&&!holes?.length&&ring.length===M.source.length&&
  ring.every((q,i)=>q[0]===M.source[i][0]&&q[1]===M.source[i][1])?M:undefined;
}
function clip(poly:Pt[],line:Plane,sign:number){
 const out:Pt[]=[];
 for(let n=0;n<poly.length;n++){
  const a=poly[n],b=poly[(n+1)%poly.length],s=dot(a,line)*sign,t=dot(b,line)*sign;
  if(s>=-EPS)out.push(a);
  if((s< -EPS&&t>EPS)||(s>EPS&&t< -EPS))out.push(at(a,b,s/(s-t)));
 }
 return out;
}
function splits(a:Pt,b:Pt){
 const out=[0,1];
 for(const f of M.cut){
  const x=dot(a,f),z=dot(b,f),d=x/(x-z);
  if(d>1e-7&&d<1-1e-7)out.push(d);
 }
 return out.sort((a,b)=>a-b);
}
export function emitSourisMclean(ring:readonly Pt[],ground:(x:number,z:number)=>number,vertex:Writer){
 const write=(p:Pt,y:number,c:Color,u:number,v:number,role:number)=>vertex(p,y,c,u,v,role,MCLEAN_STYLE);
 const baseVector=ring.map(p=>new Vector2(p.x-M.originXZ[0],p.z-M.originXZ[1]));
 // Each stock triangle is cut against the same three measured seams as the walls.
 // No new xz domain, no independent rounded rings, no duplicate vertical roof triangles.
 for(const [a,b,c] of ShapeUtils.triangulateShape(baseVector,[])){
  for(let tier=0;tier<4;tier++){
   let poly=[ring[a],ring[b],ring[c]];
   if(tier>0)poly=clip(poly,M.cut[tier-1],1);
   if(tier<3)poly=clip(poly,M.cut[tier],-1);
   if(poly.length<3)continue;
   const role=tier===0?r.westRoof:tier===3?r.annexRoof:r.roof,material=tier===0?westRoof:tier===3?annexRoof:roof;
   for(let j=1;j<poly.length-1;j++){
    const p=poly[0],q=poly[j],s=poly[j+1],w=area(p,q,s);
    if(Math.abs(w)<1e-7)continue;
    for(const k of w>0?[p,s,q]:[p,q,s])write(k,dot(k,M.planes[tier]),material,
     k.x-M.originXZ[0],k.z-M.originXZ[1],role);
   }
  }
 }
 const first=ring[15],last=ring[14],FL=distance(first,last),F=at(first,last,.5);
 const seat=ground(F.x,F.z)+.53;
 type Open={a:number;b:number;lo:number;hi:number;arch?:number;kind:'store'|'door'|'sash'|'attic'};
 const v=(x:number,y:number,d=0):XYD=>[x,y,d];
 const frontInterior=area(first,last,ring[0])>0?1:-1;
 for(let i=0;i<ring.length;i++){
  // The street face reverses the source edge so openings can be laid out west to east.
  const main=i===14,a=main?first:ring[i],b=main?last:ring[(i+1)%ring.length],L=distance(a,b);
  if(L<.03)continue;
  const dx=(b.x-a.x)/L,dz=(b.z-a.z)/L;
  const inward=main?frontInterior:-frontInterior;
  const point=(u:number,d=0):Pt=>({x:a.x+dx*u-inward*dz*d,z:a.z+dz*u+inward*dx*d});
  const y=(u:number,d=0)=>sourisMcleanRoofHeight(point(u,d));
  const lift=(u:number)=>{const p=point(u);return ground(p.x,p.z)-.31;};
  const segments=splits(a,b).map(t=>t*L);
  // The nearly level west cornice is an architectural facade cap above
  // the shallow measured roof. Continue it only to the supported gable.
  const junction=main?segments[1]+.205:0;
  const top=(u:number)=>(main&&u<junction)?y(junction)-.018*(junction-u):y(u);
  const faceSegments=main?[0,junction,...segments.slice(2)]:segments;
  const emit=(p:XYD,c:Color,role:number)=>write(point(p[0],p[2]),p[1],c,p[0],p[1]-seat,role);
  const tri=(a:XYD,b:XYD,c:XYD,col:Color,role:number)=>{emit(a,col,role);emit(b,col,role);emit(c,col,role);};
  const quad=(a:XYD,b:XYD,c:XYD,d:XYD,col:Color,role:number)=>{tri(a,b,c,col,role);tri(a,c,d,col,role);};
  const box=(a:number,b:number,lo:number,hi:number,d:number,col:Color,role:number)=>{
   if(b>a+1e-6&&hi>lo+1e-6)quad(v(a,lo,d),v(a,hi,d),v(b,hi,d),v(b,lo,d),col,role);
  };
  const returnPanel=(u:number,lo:number,hi:number,d1:number,d2:number,col:Color,role:number)=>
   quad(v(u,lo,d1),v(u,lo,d2),v(u,hi,d2),v(u,hi,d1),col,role);
  const shelf=(u:number,w:number,h:number,d1:number,d2:number,c:Color,role:number)=>
   quad(v(u,h,d1),v(w,h,d1),v(w,h,d2),v(u,h,d2),c,role);
  const geo2=(path:readonly XY[],holes:readonly (readonly XY[])[],d:number,c:Color,role:number)=>{
   const all=[...path,...holes.flat()],ring=path.map(q=>new Vector2(...q)),inner=holes.map(h=>h.map(p=>new Vector2(...p)));
   for(const face of ShapeUtils.triangulateShape(ring,inner)){
    const p=face.map(k=>v(all[k][0],all[k][1],d));
    tri(p[0],p[1],p[2],c,role);
   }
  };
  const windows:Open[]=[];
  const win=(a:number,b:number,lo:number,hi:number,kind:Open['kind'],arch=0)=>
   windows.push({a,b,lo:seat+lo,hi:seat+hi,kind,arch});
  const sidingDepth=main?.13:0,fascia=main?.184:.14,plinth=seat-.08;
  if(main){
   // Original two-storey interpretation from the publicly documented form;
   // no present signage, use, panes, or trim dimensions are asserted.
   win(.71,1.88,.03,3.11,'door');
   win(2.04,4.23,.77,3.11,'store');win(4.42,6.66,.77,3.11,'store');win(6.84,9.02,.77,3.11,'store');
   win(9.34,10.45,.03,3.11,'door');
   win(10.73,12.53,.79,3.11,'store');win(12.84,13.98,.03,3.12,'door');win(14.28,16.17,.79,3.11,'store');
   win(1.39,2.56,4.54,6.43,'sash');
   win(3.30,3.97,4.55,6.16,'sash');win(4.07,5.59,4.55,6.72,'sash',.59);win(5.70,6.37,4.55,6.16,'sash');
   win(7.60,8.79,4.54,6.39,'sash');
   win(10.48,11.59,4.57,6.39,'sash',.40);win(12.91,14.17,4.56,6.92,'sash',.51);
   win(15.08,16.05,4.54,6.37,'sash',.35);
   const gable=segments[2]??FL*.81;
   win(gable-.36,gable+.36,7.46,8.73,'attic',.30);
  }
  // Unpictured side/rear stays neutral. No exterior landing or steps outside the held outline.
  const opening=(o:Open,pad=0):XY[]=>{
   const {a,b,lo,hi}=o,w=b-a,mid=(a+b)*.5,arch=o.arch??0;
   if(!arch)return [[a+pad,lo+pad],[b-pad,lo+pad],[b-pad,hi-pad],[a+pad,hi-pad]];
   const arr:XY[]=[[a+pad,lo+pad],[b-pad,lo+pad]];
   for(let j=0;j<=12;j++){
    const t=j*Math.PI/12;
    arr.push([mid+(w*.5-pad)*Math.cos(t),hi-arch+(arch-pad)*Math.sin(t)]);
   }
   return arr;
  };
  const used=windows.filter(o=>o.a>.50&&o.b<L-.35&&o.lo>plinth&&o.hi+.22<
    Math.min(top(o.a),top(o.b),...faceSegments.filter(t=>t>o.a&&t<o.b).map(t=>top(t)))-fascia);
  const doors=used.filter(o=>o.kind==='door');
  const exterior:XY[]=[[0,plinth]];
  // Entries open to the fitted ground floor instead of hovering over
  // an exposed solid foundation band. The notches retain the exact plan.
  let foundationFrom=0;
  const foundation=(u:number,w:number)=>quad(v(u,lift(u)),v(u,plinth),v(w,plinth),v(w,lift(w)),stone,r.foundation);
  for(const o of doors){
   exterior.push([o.a,plinth],[o.a,o.hi],[o.b,o.hi],[o.b,plinth]);
   foundation(foundationFrom,o.a);foundationFrom=o.b;
  }
  exterior.push([L,plinth]);foundation(foundationFrom,L);
  for(const u of [...faceSegments].reverse())exterior.push([u,top(u)-fascia]);
  geo2(exterior,used.filter(o=>o.kind!=='door').map(o=>opening(o)),sidingDepth,main?slate:back,r.board);
  if(main){
   returnPanel(0,plinth,top(0)-fascia,0,sidingDepth,kick,r.reveal);
   returnPanel(L,plinth,top(L)-fascia,0,sidingDepth,kick,r.reveal);
   let u=0;
   for(const o of doors){shelf(u,o.a,plinth,0,sidingDepth,stone,r.foundation);u=o.b;}
   shelf(u,L,plinth,0,sidingDepth,stone,r.foundation);
  }
  for(const o of used){
   const d=sidingDepth,m=d+.061,dGlass=d+(o.kind==='door'?.86:.173),wedge=dGlass-.062;
   const outside=opening(o),inside=opening(o,.049);
   for(let j=0;j<outside.length;j++){
    const k=(j+1)%outside.length,[a,ay]=outside[j],[b,by]=outside[k],[c,cy]=inside[k],[e,ey]=inside[j];
    quad(v(a,ay,d),v(b,by,d),v(c,cy,m),v(e,ey,m),cream,r.trim);
    quad(v(e,ey,m),v(c,cy,m),v(c,cy,dGlass),v(e,ey,dGlass),j===0?creamShadow:inner,r.reveal);
   }
   geo2(inside,[],dGlass,glass,r.glass);
   const {a,b,lo,hi}=o,arch=o.arch??0,p=(a+b)*.5,bar=.030;
   const middle=lo+(hi-lo)*(o.kind==='door'?.72:o.kind==='store'?.68:.47);
   box(a+.056,b-.056,middle-bar,middle+bar,wedge,creamShadow,r.trim);
   if(o.kind==='door'){
    box(a+.064,b-.064,lo+.067,lo+(hi-lo)*.27,wedge,panel,r.board);
    box(p-bar,p+bar,lo+(hi-lo)*.25,hi-.089,wedge,creamShadow,r.trim);
    box(b-.22,b-.162,lo+.89,lo+.99,wedge-.032,creamShadow,r.trim);
    const doorPoint=point((a+b)*.5,.03);
    const grade=ground(doorPoint.x,doorPoint.z)+.120;
    const start=Math.min(grade,lo-.082),rise=(lo-start)/4;
    // Four modest, constant-riser stone seats tapering from rendered street grade.
    // These are original inboard approach details, not a current access survey.
    const noses=[.020,.231,.442,.653,.864];
    let prev=lift((a+b)*.5);
    for(let j=0;j<4;j++){
     const h=start+rise*(j+1);
     box(a,b,prev,h,noses[j],stone,r.foundation);shelf(a,b,h,noses[j],noses[j+1],stone,r.foundation);prev=h;
    }
    shelf(a,b,lo,noses[4],dGlass,stone,r.foundation);
    returnPanel(a,lift(a),lo,.014,dGlass,stone,r.foundation);
    returnPanel(b,lift(b),lo,.014,dGlass,stone,r.foundation);
   }else if(o.kind==='sash'||o.kind==='store'){
    box(p-bar,p+bar,lo+.057,hi-arch*.09-.073,wedge,cream,r.trim);
   }
   // Projected profiles, unmeasured but inboard of the surveyed wall line.
   if(o.kind!=='door'){
    box(a-.064,b+.064,lo-.058,lo-.017,d-.071,cream,r.trim);
    shelf(a-.064,b+.064,lo-.017,d-.070,d+.01,cream,r.trim);
   }
   if(o.arch&&o.kind!=='attic'){
    const profile=opening({...o,a:a-.042,b:b+.042,hi:hi+.078,arch:o.arch+.045});
    for(let j=2;j<profile.length-1;j++){
     const [x,l]=profile[j],[w,h]=profile[j+1],n=.034;
     const [c,cy]=outside[j],[e,ey]=outside[j+1];
     quad(v(x,l,n),v(w,h,n),v(e,ey,n),v(c,cy,n),cream,r.trim);
     quad(v(x,l,n),v(w,h,n),v(w,h,d),v(x,l,d),creamShadow,r.reveal);
    }
   }else if(o.kind==='sash'){
    box(a-.070,b+.070,hi+.021,hi+.113,d-.081,cream,r.trim);
    shelf(a-.07,b+.07,hi+.113,d-.079,d,cream,r.trim);
   }
  }
  for(let j=1;j<faceSegments.length;j++){
   const u=faceSegments[j-1],w=faceSegments[j],Y=top(u),H=top(w),d0=main&&u>=junction?.025:0;
   quad(v(u,Y-fascia,d0),v(w,H-fascia,d0),v(w,H-.038,d0),v(u,Y-.038,d0),cream,r.trim);
   quad(v(u,Y-.038,d0),v(w,H-.038,d0),v(w,H,0),v(u,Y,0),creamShadow,r.trim);
   if(main)quad(v(u,Y-fascia,d0),v(w,H-fascia,d0),v(w,H-fascia,sidingDepth),v(u,Y-fascia,sidingDepth),creamShadow,r.reveal);
  }
  if(!main)continue;
  const corbelNose=(u:number,Y:number):XY[]=>{
   const h=.245;
   return [[u-.051,Y],[u+.051,Y],[u+.051,Y-h*.23],[u+.045,Y-h*.53],
    [u+.035,Y-h*.82],[u+.022,Y-h],[u-.022,Y-h],[u-.035,Y-h*.82],
    [u-.045,Y-h*.53],[u-.051,Y-h*.23]];
  };
  const corbels:XY[][]=[];
  for(let u=.55;u<junction-.09;u+=.52)corbels.push(corbelNose(u,top(u)-fascia-.012));
  // Partition the front panel on its physical plane, replacing only the
  // footprints of the corbel faces. No stacked subpixel planes or decal.
  const side=(polygon:XY[],a:XY,b:XY,sign:number)=>{
   const out:XY[]=[];
   const field=(p:XY)=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
   for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],x=field(p),y=field(q);
    if(x>=-1e-12)out.push(p);
    if((x< -1e-12&&y>1e-12)||(x>1e-12&&y< -1e-12)){
     const t=x/(x-y);
     out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);
    }
   }
   return out;
  };
  const around=(panel:XY[],shape:XY[])=>{
   if(panel.every(q=>q[0]<shape[0][0])||panel.every(q=>q[0]>shape[1][0]))return [panel];
   let remainder=panel;const exposed:XY[][]=[];
   for(let i=0;i<shape.length&&remainder.length>2;i++){
    const a=shape[i],b=shape[(i+1)%shape.length];
    const outside=side(remainder,a,b,1);
    if(outside.length>2)exposed.push(outside);
    remainder=side(remainder,a,b,-1);
   }
   return exposed;
  };
  // Back and closure of the parapet. Its street face above is the same
  // continuous wall, so no second sloping decorative line is left below it.
  const ua=.007,ub=junction,dep=.189;
  quad(v(ua,top(ua),0),v(ub,top(ub),0),v(ub,top(ub),dep),v(ua,top(ua),dep),creamShadow,r.trim);
  const split=segments[1];
  for(const [A,B] of [[ua,split],[split,ub]]){
   quad(v(A,y(A,dep)-.010,dep),v(B,y(B,dep)-.010,dep),v(B,top(B),dep),v(A,top(A),dep),back,r.board);
   // Seat the visible face on the original eave line; otherwise the
   // measured shallow deck projects through the recessed joinery below.
   const low=(u:number)=>Math.min(y(u)-.065,top(u)-fascia-.026);
   let panels:XY[][]=[[[A,low(A)],[B,low(B)],[B,top(B)-fascia],[A,top(A)-fascia]]];
   for(const shape of corbels)panels=panels.flatMap(panel=>around(panel,shape));
   for(const panel of panels)geo2(panel,[],0,slate,r.board);
  }
  returnPanel(ua,y(ua)-.017,top(ua),0,dep,creamShadow,r.trim);
  // Front stringcourse and blank fascia are separate solid profiles, not a texture decal.
  const from=.19,to=L-.19;
  for(const [lo,hi,d,col,role] of [[3.23,3.57,.089,slate,r.blankSignBand],
    [3.16,3.23,.048,cream,r.trim],[3.57,3.64,.035,cream,r.trim],[3.70,3.83,.061,creamShadow,r.trim]] as const){
   box(from,to,seat+lo,seat+hi,d,col,role);
   shelf(from,to,seat+hi,d,sidingDepth,col,role);
  }
  // Carved jamb posts are offset from glazing, not painted lines.
  const post=(u:number,width:number,top:number)=>{
   const d=.062,w=width*.5;
   box(u-w,u+w,seat+.05,seat+top,d,cream,r.trim);
   returnPanel(u-w,seat+.05,seat+top,d,.131,creamShadow,r.reveal);
   returnPanel(u+w,seat+.05,seat+top,d,.131,creamShadow,r.reveal);
   box(u-w-.019,u+w+.019,seat+.078,seat+.244,d-.010,creamShadow,r.trim);
   box(u-w-.019,u+w+.019,seat+top-.104,seat+top,d-.010,cream,r.trim);
  };
  for(const u of [2.0,4.327,6.752,9.185,10.607,12.676,14.131])
   if(u<L-.55)post(u,.091,3.155);
  for(const u of [.184,L-.184]){
   const w=.076,d=.058,hi=top(u)-fascia;
   box(u-w,u+w,seat+.015,hi,d,cream,r.trim);
   returnPanel(u-w,seat+.015,hi,d,.13,creamShadow,r.reveal);
   returnPanel(u+w,seat+.015,hi,d,.13,creamShadow,r.reveal);
  }
  const bracket=(u:number,Y:number,height:number,d1:number,d2:number)=>{
   const half=.052,outline:XY[]=[[d1,Y],[d2,Y],[d2,Y-height],[d2-.037,Y-height*.78],[d1+.020,Y-height*.29]];
   const part=(a:number,b:number,c:number,offset:number)=>tri(v(offset,outline[a][1],outline[a][0]),
    v(offset,outline[b][1],outline[b][0]),v(offset,outline[c][1],outline[c][0]),creamShadow,r.trim);
   for(let i=1;i<outline.length-1;i++){part(0,i,i+1,u-half);part(0,i+1,i,u+half);}
   for(let i=0;i<outline.length;i++){
    const [d,y]=outline[i],[e,h]=outline[(i+1)%outline.length];
    quad(v(u-half,y,d),v(u+half,y,d),v(u+half,h,e),v(u-half,h,e),cream,r.trim);
   }
  };
  const westCorbelFace=(path:XY[])=>{
   // Front shares the cut panel boundary exactly; its shaped solid return
   // projects through the inboard wall construction, without leaving plan.
   const f=0,b=.041;
   geo2(path,[],f,cream,r.trim);
   for(let i=0;i<path.length;i++){
    const [a,y]=path[i],[c,h]=path[(i+1)%path.length];
    quad(v(a,y,f),v(c,h,f),v(c,h,b),v(a,y,b),creamShadow,r.trim);
   }
  };
  corbels.forEach(westCorbelFace);
  for(let u=.55;u<L-.40;u+=u<junction?.52:.71){
   const h=top(u)-fascia-.012;
   bracket(u,h,.245,.033,.131);
   if(u<junction-.2||u>junction+.2)bracket(u,seat+3.638,.101,.054,.133);
  }
 }
}
