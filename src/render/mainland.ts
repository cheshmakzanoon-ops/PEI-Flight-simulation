import * as THREE from 'three';
import {Terrain,type TerrainSpec} from '../sim/terrain.ts';
import {unpackGzip} from '../sim/compression.ts';
/** Non-playable NB/NS horizon context only. A separate land mask leaves PEI untouched. */
export async function addMainland(scene:THREE.Scene){
 const root=import.meta.env.BASE_URL+'world/mainland/';
 const mf=await fetch(root+'context.json');if(!mf.ok)throw Error('Mainland context manifest missing');
 const m=await mf.json() as TerrainSpec&{file:string;color:string;heightUncompressedSha256:string};
 const [response,img]=await Promise.all([fetch(root+m.file),new THREE.TextureLoader().loadAsync(root+m.color)]);
 if(!response.ok)throw Error('Mainland context elevations missing');
 const bytes=await unpackGzip(await response.arrayBuffer());
 if(globalThis.crypto?.subtle&&m.heightUncompressedSha256){const digest=await crypto.subtle.digest('SHA-256',bytes);const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');if(hex!==m.heightUncompressedSha256)throw Error('Mainland context checksum mismatch');}
 const t=new Terrain(m,new Int16Array(bytes));img.colorSpace=THREE.SRGBColorSpace;img.anisotropy=2;
 const g=new THREE.PlaneGeometry(t.right-t.left,t.bottom-t.top,192,128);g.rotateX(-Math.PI/2);
 const pos=g.getAttribute('position'),cx=(t.right+t.left)/2,cz=(t.top+t.bottom)/2;
 for(let i=0;i<pos.count;i++)pos.setY(i,t.meshElevation(pos.getX(i)+cx,pos.getZ(i)+cz)+.18);
 const material=new THREE.ShaderMaterial({uniforms:{colour:{value:img}},vertexShader:`
 varying vec3 wp;varying vec2 uvMap;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;uvMap=uv;gl_Position=projectionMatrix*viewMatrix*w;
 #include <logdepthbuf_vertex>
 }`,fragmentShader:`
 uniform sampler2D colour;varying vec3 wp;varying vec2 uvMap;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
 #include <logdepthbuf_fragment>
 vec4 c=texture2D(colour,uvMap);if(c.a<.18)discard;
 vec3 n=normalize(cross(dFdx(wp),dFdy(wp)));if(n.y<0.)n=-n;
 float l=.90+.31*max(dot(n,normalize(vec3(-.60,.74,-.31))),0.);
 float d=distance(wp,cameraPosition),haze=1.-exp(-d*.000022);
 gl_FragColor=vec4(mix(c.rgb*l,vec3(.56,.68,.72),min(haze,.91)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(g,material);mesh.name='Non-playable Maritime mainland context';mesh.position.set(cx,0,cz);g.computeBoundingSphere();scene.add(mesh);return t;
}
