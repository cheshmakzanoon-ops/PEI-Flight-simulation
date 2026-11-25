import type { Mesh, Scene, Vector3 } from 'three';
import { planSourisWetCurtainCut } from './souris-wet-curtain-geometry.ts';
import { SOURIS_WET_CURTAIN } from './souris-wet-curtain-pins.ts';

type Curtain = NonNullable<ReturnType<typeof planSourisWetCurtainCut>>;

/** A visual repair to a false stock wall, never a harbour or collision model. */
export class SourisWetCurtain {
  private proof:'cold'|'pending'|'ready'|'rejected'='cold';
  private variant?:Curtain;
  private active=false;
  private disposed=false;
  private readonly scene:Scene;
  private readonly decodedCover:()=>Promise<string|undefined>;
  constructor(scene:Scene,decodedCover:()=>Promise<string|undefined>){
    this.scene=scene;
    this.decodedCover=decodedCover;
  }
  isActive(){return this.active;}
  get state(){
    return {
      proof:this.proof,active:this.active,
      stockQuadsAffected:this.active?this.variant?.count??0:0,
      stockTrianglesRemoved:this.active?this.variant?.removedTriangles??0:0,
    };
  }
  update(eye:Pick<Vector3,'x'|'y'|'z'>){
    if(this.disposed||this.proof==='rejected')return;
    // The obsolete stroke is less than a pixel from cruise. Keep the distant
    // coast and all unapproved/alternate profiles on the original side.
    const nearby=Number.isFinite(eye.y)&&eye.y<(this.active?380:350)&&
      (eye.x-72721.0)**2+(eye.z-16952.88)**2<(this.active?3300:3020)**2;
    if(!nearby){
      if(this.active){this.variant?.stock();this.active=false;}
      return;
    }
    if(this.proof==='cold'){
      this.proof='pending';
      void this.prepare();
      return;
    }
    if(!this.variant)return;
    // World may return this shared coast-object geometry to its stock bank
    // batch at update. Reassert only the authenticated geometry, never a
    // different scenery owner’s mesh. A guard miss fails closed.
    if(!this.variant.show()){this.variant.stock();this.proof='rejected';this.active=false;}
    else this.active=true;
  }
  private async prepare(){
    try{
      const decoded=await this.decodedCover();
      if(this.disposed)return;
      const faces:Mesh[]=[];
      this.scene.traverse(o=>{if(o.type==='Mesh'&&o.name==='shore-to-sea surface')faces.push(o as Mesh);});
      this.variant=planSourisWetCurtainCut(faces,decoded,SOURIS_WET_CURTAIN);
      this.proof=this.variant?'ready':'rejected';
    }catch{if(!this.disposed)this.proof='rejected';}
  }
  dispose(){
    this.disposed=true;
    this.variant?.dispose();this.variant=undefined;
    this.active=false;this.proof='rejected';
  }
}
