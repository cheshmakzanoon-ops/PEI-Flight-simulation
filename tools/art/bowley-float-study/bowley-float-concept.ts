import * as T from 'three';

/** Original detached period-reference study; local +Y up, +Z along,
 * deck datum Y=0. Only the two nominal section dimensions are dated. */
export const BOWLEY_SECTION = Object.freeze({
  nominal2015ClearWidthM:1.830, nominal2015RailTopM:1.070,
  authoredLengthM:6.6, authoredDeckHalfWidthM:1.052,
  authoredPostCentresM:Object.freeze([-3.112,-2.06,-1.05,.015,1.09,2.095,3.110] as const),
  grainSize:Object.freeze([256,64] as const),
  triangleLimit:3400, geometryLimitBytes:290000, gpuTextureLimitBytes:87500,
});
type P=[number,number,number];
type Role=0|1|2|3|4; // tread, handrail/post, frame, illustrative cassette, cable
type Solid=Readonly<{name:string;role:Role;start:number;end:number;lo:P;hi:P;bevel:number}>;
const {nominal2015ClearWidthM:SPAN,nominal2015RailTopM:RAIL,authoredLengthM:L,
  authoredDeckHalfWidthM:EXT,authoredPostCentresM:POSTS,grainSize:[GW,GH]}=BOWLEY_SECTION;
const sub=(a:P,b:P):P=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(n:number,l:number,h:number)=>Math.max(l,Math.min(h,n));
function hash(x:number,y:number,seed=0){
  let n=(Math.imul(x+7235,0x1e35a7bd)^Math.imul(y+93821,0x85ebca6b)^Math.imul(seed+7,0xc2b2ae35))|0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return ((n^(n>>>16))>>>0)/4294967295;
}
const mod=(x:number,n:number)=>((x%n)+n)%n;
function noise(u:number,v:number,nx:number,ny:number,seed:number){
  const x=u*nx,y=v*ny,a=Math.floor(x),b=Math.floor(y),d=x-a,e=y-b;
  const fx=d*d*(3-2*d),fy=e*e*(3-2*e);
  const at=(i:number,j:number)=>hash(mod(a+i,nx),mod(b+j,ny),seed);
  return (1-fy)*((1-fx)*at(0,0)+fx*at(1,0))+fy*((1-fx)*at(0,1)+fx*at(1,1));
}
/** Original oriented microtexture; per-member phase avoids a repeated board.
 * Red is linear albedo modulation, green is restrained roughness variation. */
function timberGrain(){
  const data=new Uint8Array(GW*GH*4);
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){
    const u=(x+.5)/GW,v=(y+.5)/GH,shiver=.018*(noise(u,v,6,5,5)-.5);
    const fibre=noise(u,v+shiver,9,35,6),rift=noise(u,v+shiver,14,53,11);
    const wash=noise(u,v,6,7,3),mottling=noise(u,v,29,18,15);
    const split=Math.pow(clamp((rift-.52)*2.18,0,1),2.2);
    const lum=clamp(.932+.105*(fibre-.5)+.075*(wash-.5)+.052*(mottling-.5)-.105*split,.72,1);
    const rough=clamp(.76+.23*(fibre-.5)+.16*(wash-.5)+.10*split,.55,.98);
    const k=(y*GW+x)*4;
    data[k]=Math.round(lum*255);data[k+1]=Math.round(rough*255);data[k+2]=data[k];data[k+3]=255;
  }
  const t=new T.DataTexture(data,GW,GH,T.RGBAFormat,T.UnsignedByteType);
  Object.assign(t,{wrapS:T.RepeatWrapping,wrapT:T.RepeatWrapping,generateMipmaps:true,
    magFilter:T.LinearFilter,minFilter:T.LinearMipmapLinearFilter,colorSpace:T.NoColorSpace});
  t.name='Original local timber grain (one linear mipmapped RGBA8)';
  t.needsUpdate=true;
  return t;
}
const colors={
  tread:['#aaa69e','#a4a198','#a6a095','#b1aaa0','#a29e94','#a8a699','#ada599'],
  rail:['#b5ae9f','#ada89e','#a9a296','#b0aa9c','#aba495'],
  beam:['#888279','#817e73','#8e897d','#827d72'],
  cassette:['#3e413f','#373c3d'],
  cable:['#555b5b','#656867'],
} as const;
const tint=(set:readonly string[],id:number):P=>{
  const c=new T.Color(set[Math.min(set.length-1,Math.floor(hash(id,10,17)*set.length))])
    .multiplyScalar(.965+.069*hash(id,65,19));
  return [c.r,c.g,c.b];
};
class Parts{
  positions:number[]=[]; normals:number[]=[]; colors:number[]=[]; uv:number[]=[];
  roles:number[]=[]; indices:number[]=[]; members:Solid[]=[];
  face(ps:P[],direction:P,role:Role,albedo:P,axis:number,id:number){
    const v=Math.sign(dot(cross(sub(ps[1],ps[0]),sub(ps[2],ps[0])),direction));
    if(!v)throw Error('Undefined face winding');
    if(v<0)ps.reverse();
    const base=this.positions.length/3,k0=(axis+1)%3,k1=(axis+2)%3;
    const n=direction.map(q=>q/Math.hypot(...direction));
    const end=role<=2&&Math.abs(n[axis])>.95;
    const u0=hash(id,80,1),v0=hash(id,83,2);
    for(const p of ps){
      this.positions.push(...p);this.normals.push(...n);this.roles.push(role);
      this.colors.push(albedo[0]*(end ? .94:1),albedo[1]*(end ? .913:1),albedo[2]*(end ? .876:1));
      this.uv.push(p[axis]/3.7+u0,(p[k0]+.41*p[k1])/.267+v0);
    }
    for(let k=1;k+1<ps.length;k++)this.indices.push(base,base+k,base+k+1);
  }
  /** True closed solid: six flats, twelve side bevels, eight corner caps. */
  box(name:string,lo:P,hi:P,r:number,role:Role,c:P,axis:number){
    if(!Number.isFinite(r)||r<=0||hi.some((x,i)=>x-lo[i]<=2*r))throw Error('Illegal bevel');
    const begin=this.indices.length,id=this.members.length;
    const v=(a:number,s:number,b=0)=>s<0?lo[a]+b:hi[a]-b;
    const F=(ps:P[],n:P)=>this.face(ps,n,role,c,axis,id);
    const P=(j:number,a:number,k:number,b:number,l:number,d:number):P=>{
      const p:P=[0,0,0];p[j]=a;p[k]=b;p[l]=d;return p;
    };
    for(let a=0;a<3;a++)for(const s of [-1,1]){
      const b=(a+1)%3,d=(a+2)%3;
      F([[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>P(a,v(a,s),b,v(b,x,r),d,v(d,y,r))),P(a,s,b,0,d,0));
    }
    for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const s of [-1,1])for(const t of [-1,1]){
      const d=3-a-b;
      F([P(a,v(a,s),b,v(b,t,r),d,v(d,-1,r)),P(a,v(a,s,r),b,v(b,t),d,v(d,-1,r)),
        P(a,v(a,s,r),b,v(b,t),d,v(d,1,r)),P(a,v(a,s),b,v(b,t,r),d,v(d,1,r))],P(a,s,b,t,d,0));
    }
    for(const a of [-1,1])for(const b of [-1,1])for(const d of [-1,1]){
      F([[v(0,a),v(1,b,r),v(2,d,r)],[v(0,a,r),v(1,b),v(2,d,r)],
        [v(0,a,r),v(1,b,r),v(2,d)]],[a,b,d]);
    }
    this.members.push({name,role,start:begin,end:this.indices.length,lo,hi,bevel:r});
  }
  tube(name:string,cx:number,cy:number,z0:number,z1:number,r:number,albedo:P){
    const begin=this.indices.length,id=this.members.length,points=8;
    const point=(j:number,z:number):P=>{
      const a=(j%points)*Math.PI*2/points;
      return [cx+Math.cos(a)*r,cy+Math.sin(a)*r,z];
    };
    for(let j=0;j<points;j++){
      const a=(j+.5)*Math.PI*2/points;
      this.face([point(j,z0),point(j+1,z0),point(j+1,z1),point(j,z1)],
        [Math.cos(a),Math.sin(a),0],4,albedo,2,id);
    }
    for(const [z,d] of [[z0,-1],[z1,1]])
      this.face(Array.from({length:points},(_,j)=>point(j,z)),[0,0,d],4,albedo,2,id);
    this.members.push({name,role:4,start:begin,end:this.indices.length,lo:[cx-r,cy-r,z0],hi:[cx+r,cy+r,z1],bevel:0});
  }
  finish(){
    const g=new T.BufferGeometry();
    if(this.positions.length/3>=65536)throw Error('Concept requires U16 indexes');
    g.setIndex(new T.Uint16BufferAttribute(this.indices,1));
    for(const [name,words,n] of [['position',this.positions,3],['normal',this.normals,3],
      ['uv',this.uv,2]] as const){
      g.setAttribute(name,new T.Float32BufferAttribute(words,n));
    }

    // Linear per-member colour quantization < .002 per channel; role is exact U8.
    g.setAttribute('color',new T.Uint8BufferAttribute(this.colors.map(x=>Math.round(clamp(x,0,1)*255)),3,true));
    g.setAttribute('sectionRole',new T.Uint8BufferAttribute(this.roles,1));
    const bytes=g.index!.array.byteLength+Object.values(g.attributes).reduce((n,a)=>n+(a as T.BufferAttribute).array.byteLength,0);
    if(bytes>BOWLEY_SECTION.geometryLimitBytes||this.indices.length/3>BOWLEY_SECTION.triangleLimit)
      throw Error('Concept budget exceeded');
    g.computeBoundingBox();g.computeBoundingSphere();return g;

  }
}
function authorGeometry(){
  const p=new Parts(),n=38,step=L/n;
  const z=(i:number)=>i===0?-L*.5:i===n?L*.5:-L*.5+step*i+.029*(hash(i,1,8)-.5);
  const gap=(i:number)=>i===0||i===n?0:.0047+.0018*hash(i,2,7);
  for(let i=0;i<n;i++)
    p.box('tread:'+i,[-EXT,-.044,z(i)+.5*gap(i)],[EXT,0,z(i+1)-.5*gap(i+1)],.0030,0,tint(colors.tread,i),0);
  for(const i of [-1,1]){
    const side=i===-1?'left':'right',px=i*(SPAN*.5+.056),hx=i*(SPAN*.5+.063),rim=i*.986,cast=i*.49;
    for(const [j,z] of POSTS.entries())
      p.box(side+':post:'+j,[px-.056,-.176,z-.055],[px+.056,1.025,z+.055],
        .0045,1,tint(colors.rail,j+i*12),1);
    p.box(side+':handrail',[hx-.063,RAIL-.090,-3.276],[hx+.063,RAIL,3.276],.008,1,tint(colors.rail,35+i),2);
    p.box(side+':fascia',[rim-.062,-.231,-3.281],[rim+.062,-.031,3.281],.006,2,tint(colors.beam,303+i),2);
    p.box(side+':illustrative-shallow-cassette',[cast-.242,-.400,-2.68],[cast+.242,-.222,2.68],.019,3,tint(colors.cassette,73+i),2);
    // Continuous capped cable runs through the posts, no claimed fittings.
    for(const [j,y] of [.255,.441,.626,.807].entries())
      p.tube(side+':cable:'+j,px,y,POSTS[0],POSTS[6],.0035,tint(colors.cable,j+i*18));
  }
  for(const [j,x] of [-.792,-.266,.266,.792].entries())
    p.box('joist:'+j,[x-.036,-.180,-3.25],[x+.036,-.031,3.25],.004,2,tint(colors.beam,90+j),2);
  for(const [j,z] of [-2.54,-.98,.98,2.54].entries())
    p.box('underslung-sill:'+j,[-1,-.239,z-.061],[1,-.151,z+.061],.006,2,tint(colors.beam,98+j),0);
  for(const i of [-1,1]){
    const z=i*3.248;
    p.box('end-block:'+i,[-.997,-.161,z-.051],[.997,-.031,z+.051],.004,2,tint(colors.beam,60+i),0);
  }
  return {g:p.finish(),members:p.members};
}

const VERTEX=`
attribute vec3 color;
attribute float sectionRole;
uniform vec3 bStudioSun;
varying vec3 bLocalSun;
varying vec3 bCol;
varying vec3 bPos;
varying vec3 bWorld;
varying vec3 bNor;
varying vec2 bUV;
varying float bRole;
void main(){
 bCol=color;bPos=position;bUV=uv;bRole=sectionRole;
 bNor=normalize(transpose(mat3(viewMatrix))*normalMatrix*normal);
 bLocalSun=normalize(inverse(mat3(modelMatrix))*bStudioSun);
 bWorld=(modelMatrix*vec4(position,1.0)).xyz;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const postDist=POSTS.map(z=>'abs(s-('+z.toFixed(3)+'))').reduce((a,b)=>'min('+a+','+b+')');
const glvec=(n:readonly number[])=>'vec3('+n.map(x=>x.toFixed(5)).join(',')+')';
const castRects=(members:readonly Solid[])=>members.filter(m=>m.role===1).map(m=>{
 const lo=m.lo.map(x=>x+m.bevel), hi=m.hi.map(x=>x-m.bevel);
 return 't=max(t,timberBlock(p,inv,'+glvec(lo)+','+glvec(hi)+'));';
}).join('\n');
const fragment=(members:readonly Solid[])=>`
uniform sampler2D bGrain;
uniform vec3 bStudioSun;
uniform float bCastWeight;
varying vec3 bLocalSun;
varying vec3 bCol;
varying vec3 bPos;
varying vec3 bWorld;
varying vec3 bNor;
varying vec2 bUV;
varying float bRole;
float postAlong(float s){return `+postDist+`;}
float timberBlock(vec3 p,vec3 inv,vec3 a,vec3 b){
 vec3 A=(a-p)*inv,B=(b-p)*inv,low=min(A,B),high=max(A,B);
 float before=max(0.,max(low.x,max(low.y,low.z))),after=min(high.x,min(high.y,high.z));
 return smoothstep(.006,.049,after-before);
}
float deckCast(vec3 p,vec3 s){
 vec3 inv=mix(vec3(-1.),vec3(1.),greaterThanEqual(s,vec3(0.)))/max(abs(s),vec3(1e-6));
 float t=0.;
 `+castRects(members)+`
 return t;
}
void main(){
 vec3 n=normalize(bNor),l=normalize(bStudioSun),v=normalize(cameraPosition-bWorld);
 vec3 hl=l+v,h=hl*inversesqrt(max(dot(hl,hl),1e-7));
 float noL=max(0.,dot(n,l)),noV=max(.002,dot(n,v)),noH=max(0.,dot(n,h)),voH=max(0.,dot(v,h));
 bool wood=bRole<2.5;
 vec2 tx=texture2D(bGrain,bUV).rg;
 float m=bRole>3.5?.62:0.;
 float rough=wood?mix(.68,.93,tx.g):(m>0.?.37:.83);
 vec3 base=bCol*(wood?tx.r:1.);
 float sky=.5+.5*n.y;
 // Original local join-depth cues, not a baked or replaced shadow receiver.
 float oc=1.;
 if(bRole<.5){
   vec2 d=max(vec2(0.),vec2(abs(abs(bPos.x)-.971)-.052,postAlong(bPos.z)-.051));
   oc-=.11*exp(-length(d)*19.)*smoothstep(-.027,-.003,bPos.y);
 }else if(bRole<1.5){
   oc-=.13*(1.-smoothstep(-.08,.115,bPos.y));
 }else if(bRole<2.5){
   oc-=.09*smoothstep(-.14,-.045,bPos.y);
 }
 // Each authored inset post/rail box is strictly inside its real convex
 // chamfered shell. Receive their local studio shadow on the upper tread only.
 // No water/terrain/collision/world shadows; omit subpixel cables.
 float direct=1.;
 if(bCastWeight>0.&&bRole<.5&&bPos.y>-.008&&n.y>.28&&bLocalSun.y>.06)
   direct-=.83*bCastWeight*deckCast(bPos,normalize(bLocalSun));
 // Restrained broad diffuse and rough specular; no site/environment inputs.
 float alpha=rough*rough,a2=alpha*alpha,t=noH*noH*(a2-1.)+1.;
 float D=a2/max(.0001,3.14159265*t*t);
 float g=(rough+1.)*(rough+1.)*.125;
 vec3 f0=mix(vec3(.039),base,m),F=f0+(1.-f0)*pow(1.-voH,5.);
 float vis=1./max(.014,4.*(noL*(1.-g)+g)*(noV*(1.-g)+g));
 vec3 skyFill=vec3(.394,.427,.464)*(.48+.52*sky);
 vec3 light=direct*(base*(1.-m)*(.64*noL)+D*vis*F*noL*.72)*vec3(1.06,1.02,.955)
            +base*skyFill*oc+f0*(.067+.070*sky);
 gl_FragColor=vec4(light,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export function makeBowleyFloatConcept(){
  const {g,members}=authorGeometry(),grain=timberGrain();
  const material=new T.ShaderMaterial({
    name:'Original muted timber and cable, detached',
    uniforms:{bGrain:{value:grain},bStudioSun:{value:new T.Vector3(-.39,.79,-.48).normalize()},bCastWeight:{value:1}},
    vertexShader:VERTEX,fragmentShader:fragment(members),transparent:false,side:T.FrontSide,
    depthTest:true,depthWrite:true,blending:T.NoBlending,toneMapped:true,
  });
  const mesh=new T.Mesh(g,material);
  mesh.name='Bowley-inspired original timber float (2015 nominal section, no fit)';
  mesh.castShadow=false;mesh.receiveShadow=false;
  let disposed=false;
  return {mesh,geometry:g,material,members,grain,dispose(){
    if(disposed)return;disposed=true;g.dispose();material.dispose();grain.dispose();
  }};
}
