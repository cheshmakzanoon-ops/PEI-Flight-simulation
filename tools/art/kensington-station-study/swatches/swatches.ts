import * as THREE from 'three';
import {stationSurface} from './surfaces.ts';
import {originalFieldstoneAtlas} from './fieldstone-atlas.ts';
const W=900,H=600,scene=new THREE.Scene();scene.background=new THREE.Color(0xa0b1c3);
const cam=new THREE.PerspectiveCamera(46,W/H,.06,4000),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xfff5e0,0x9ea9ad,1.72));
const sun=new THREE.DirectionalLight(0xfff4de,2.05);sun.position.set(-3.3,5.8,3.2);scene.add(sun);
const m=(name:Parameters<typeof stationSurface>[0],w:number,h:number,x:number,y:number,z:number,rotate=0)=>{
 const g=new THREE.PlaneGeometry(w,h),u=g.getAttribute('uv');
 for(let i=0;i<u.count;i++)u.setXY(i,u.getX(i)*w,u.getY(i)*h);
 const body=new THREE.Mesh(g,stationSurface(name));body.position.set(x,y,z);body.rotation.x=rotate;scene.add(body);return body;
};
// These unregistered rectangles are deliberately not a building model.
const ext=m('fieldstone',2.38,1.47,-1.44,.74,.0);
m('wallace',2.38,.118,-1.44,.43,.038);m('aged-copper',2.38,.071,-1.44,.02,.031);
m('wallace',2.16,1.47,1.48,.74,0);
const slope=m('weathered-shingle',2.38,1.35,-1.44,-.91,0,-.22);m('painted-verge',2.16,1.35,1.48,-.91,0,-.22);
(window as any).readSwatches=(x:number,y:number,z:number,jitter=0)=>{
 cam.position.set(x+jitter,y,z);cam.lookAt(jitter,0,0);cam.updateMatrixWorld();renderer.render(scene,cam);
 return {png:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls,fieldstone:originalFieldstoneAtlas().recipe};
};(window as any).readSwatches(0,.42,6.7);

(window as any).probeSwatchMotion=(depth:number, shifts:number[])=>shifts.map(value=>{
 const frame=(window as any).readSwatches(0,.42,depth,value),samples:{stone:number[][];shingle:number[][]}={stone:[],shingle:[]};
 const verts=new THREE.Vector3();
 for(const [key,mesh] of [['stone',ext],['shingle',slope]] as const){
  for(let y=0;y<29;y++)for(let x=0;x<47;x++){
   verts.set((x/46-.5)*1.94,key==='stone'?.003+y/28*.64:(y/28-.5)*.96,0);
   mesh.localToWorld(verts);verts.project(cam);
   samples[key].push([W*(verts.x+1)*.5-.5,H*(1-verts.y)*.5-.5]);
  }
 }
 return {...frame,samples};
});
