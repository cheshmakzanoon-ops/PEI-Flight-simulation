import {Group, ShaderMaterial, type BufferAttribute, type BufferGeometry, type Mesh} from 'three';
import {stDavidsDrawAllows, stDavidsOwnerBytes, stDavidsSha} from './st-davids/admit.ts';
import {ST_DAVIDS as ownerPin} from './st-davids/source.generated.ts';
import type {OlearyLink, OlearyProgramProof} from './oleary-railway/program-gate.ts';

const spans = {kent:[2127,2133], graftonSash:[2133,2139], graftonPlain:[2145,2151]} as const;
const vertexCount = 31179;
const sourceShader = 'b23a40d2185c452ed0f7e4b82357502ece17dbe31eb88128c17b3196502bc9fa';
const charBytes = new TextEncoder();
const wallAnchor = '\n else if(roof<.5){\n  vec2 grid=';
const derivativeAnchor = ' vec3 c=tint,n=normalize(normalW);';
const vertexAnchor = 'void main(){';
const role = 'flat varying float georgetownSchoolWall;\n';

// Gate ground sampling separately from the much farther Cavendish barn.
export function georgetownSchoolWallNear(x:number,z:number){
  return (x-51084)**2+(z-35228)**2<1050**2;
}
export type SchoolWall = keyof typeof spans;
export type SchoolFinishPlan = {
  readonly wallPrelude: string;
  readonly walls: Readonly<Partial<Record<SchoolWall,{readonly span:readonly [number,number];readonly rule:string}>>>;
};

/** Keep the original shader outside the positively identified source faces.
 * Geometry is never replaced and other owners keep their original vertex IDs. */
export function schoolFinishShader(vs:string,fs:string,plan:SchoolFinishPlan){
  const entries = Object.entries(plan.walls) as Array<[SchoolWall,NonNullable<SchoolFinishPlan['walls'][SchoolWall]>]>;
  if(!entries.length||entries.length>3||!plan.wallPrelude||
     [vs,fs].some(x=>x.includes('georgetownSchoolWall'))||
     vs.split(vertexAnchor).length!==2||fs.split(wallAnchor).length!==2||fs.split(derivativeAnchor).length!==2||
     entries.some(([name,p])=>!spans[name]||!p.rule||p.span[0]!==spans[name][0]||p.span[1]!==spans[name][1]))return;
  const selector=entries.map(([,p],i)=>'gl_VertexID>='+p.span[0]+'&&gl_VertexID<'+p.span[1]+'?'+(i+1)+'.:').join('')+'0.';
  const change=entries.map(([,p],i)=>'\n else if(roof<.5&&georgetownSchoolWall=='+(i+1)+'.){\n'+p.rule+'\n }').join('');
  return {
    vertexShader:role+vs.replace(vertexAnchor,vertexAnchor+'georgetownSchoolWall='+selector+';'),
    fragmentShader:role+fs.replace(derivativeAnchor,derivativeAnchor+'\n'+plan.wallPrelude).replace(wallAnchor,change+wallAnchor),
  };
}

type Scope = {owner:Mesh; live:()=>boolean; stock:BufferGeometry; wire:ArrayBuffer};
const normalDraw=(g:BufferGeometry)=>g.drawRange.start===0&&g.drawRange.count===Infinity&&!g.groups.length;

/** Preflight async so illumination never keeps a resident stock tile hidden. */
export class SchoolWallLease {
  stage = "created";
  private controller = new AbortController();
  private candidate?:ShaderMaterial;
  private proof?:OlearyProgramProof;
  private baseline?:ShaderMaterial;
  private pinnedVertex?:string;
  private pinnedFragment?:string;
  private checkedIndex?: {attribute:BufferAttribute;array:Uint16Array;version:number;valid:boolean};
  private readonly serialAttrs:Array<{name:string;attribute:BufferAttribute;array:BufferAttribute['array'];version:number;
    count:number;itemSize:number;normalized:boolean;}>;

  private readonly scope:Scope;

  constructor(scope:Scope){
    this.scope=scope;
    this.serialAttrs=Object.entries(scope.stock.attributes).flatMap(([name,a])=>{
      if('data' in a)return [];
      return [{name,attribute:a,array:a.array,version:a.version,count:a.count,itemSize:a.itemSize,normalized:a.normalized}];
    });
  }
  private valid(){
    const {owner,live,stock}=this.scope, g=owner.geometry;
    if(this.controller.signal.aborted||!live()||!owner.parent||!owner.visible||
       !normalDraw(stock)||!normalDraw(g)||stock.index!==null||
       this.serialAttrs.length!==6||Object.keys(stock.attributes).length!==6||Object.keys(g.attributes).length!==6||
       owner.material!==this.baseline&&owner.material!==this.candidate||
       this.baseline?.vertexShader!==this.pinnedVertex||this.baseline?.fragmentShader!==this.pinnedFragment||
       owner.renderOrder!==0||!owner.matrixAutoUpdate||
       ownerPin.position.some((v,i)=>!(Math.abs(v-owner.position.getComponent(i))<=1e-6))||
       owner.quaternion.x!==0||owner.quaternion.y!==0||owner.quaternion.z!==0||owner.quaternion.w!==1||
       owner.scale.x!==1||owner.scale.y!==1||owner.scale.z!==1||
       this.serialAttrs.some(({name,attribute,array,version,count,itemSize,normalized})=>
        stock.attributes[name]!==attribute||g.attributes[name]!==attribute||attribute.array!==array||
        attribute.version!==version||attribute.count!==count||attribute.itemSize!==itemSize||attribute.normalized!==normalized))return false;
    if(!g.index)return g===stock;
    const expected=ownerPin.end-ownerPin.start,arr=g.index.array;
    if(!(arr instanceof Uint16Array)||arr.length!==vertexCount-expected||
       g.index.count!==arr.length||g.index.itemSize!==1||g.index.normalized)return false;
    if(this.checkedIndex?.attribute===g.index&&this.checkedIndex.version===g.index.version&&this.checkedIndex.array===arr)
      return this.checkedIndex.valid;
    const valid=arr.every((v,i)=>v===(i<ownerPin.start?i:i+expected));
    this.checkedIndex={attribute:g.index,array:arr,version:g.index.version,valid};
    return valid;
  }
  async link(plan:SchoolFinishPlan,program:OlearyLink){
    const {owner,stock,wire}=this.scope;
    if(!(owner.material instanceof ShaderMaterial)||owner.material.transparent||stock.index||!normalDraw(stock)){this.stage="baseline";return;}
    this.baseline=owner.material;
    const base=this.baseline, v=this.pinnedVertex=base.vertexShader, f=this.pinnedFragment=base.fragmentShader;
    if(!this.valid()){this.stage="initial bounds";return;}
    try{
      // Anchors are an aid, not permission to compile arbitrary live material bytes.
      if(!await stDavidsOwnerBytes(wire)){this.stage="wire";return;}
      if(!await stDavidsDrawAllows(owner,[ownerPin.start,ownerPin.end],stock)){this.stage="draw";return;}
      const shaderSHA=await stDavidsSha(charBytes.encode(v+f));
      this.stage="shader:"+shaderSHA;
      if(shaderSHA!==sourceShader||!this.valid()){return;}
      const patch=schoolFinishShader(v,f,plan);
      if(!patch){this.stage="shader anchors";return;}
      const authored=base.clone();Object.assign(authored,patch);
      authored.uniforms={...base.uniforms};
      this.candidate=authored;
      const trial=owner.clone(false);trial.material=authored;const g=new Group();g.add(trial);
      this.stage="linking";
      const proof=await program(g,this.controller.signal);
      if(this.valid()&&proof?.()){this.proof=proof;this.stage="linked";}
      else {this.stage="link failure "+!!proof;this.dispose();}
    }catch{this.dispose();}
  }
  sync(active:boolean){
    if(!this.candidate||!this.proof)return;
    if(!this.valid()||!this.proof()){this.stage="retired";this.dispose();return;}
    if(active)this.scope.owner.material=this.candidate;
    else if(this.scope.owner.material===this.candidate&&this.baseline)this.scope.owner.material=this.baseline;
  }
  get active(){return !!this.candidate&&this.scope.owner.material===this.candidate;}
  dispose(){
    this.controller.abort();
    if(this.scope.owner.material===this.candidate&&this.baseline)this.scope.owner.material=this.baseline;
    this.candidate?.dispose();this.candidate=undefined;this.proof=undefined;
  }
}
