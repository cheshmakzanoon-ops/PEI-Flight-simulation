/** Read the installed stock world only, with no asset requests to an external service. */
import * as T from 'three';
import {readFileSync as read} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
const src=new URL('../../../src/',import.meta.url),pub=fileURLToPath(new URL('../../../public',import.meta.url));
const register=registerHooks({load(url,context,next){
 const out=next(url,context);
 return url.startsWith(src.href)&&url.endsWith('.ts')&&out.source?
  {...out,source:"import.meta.env={BASE_URL:'/'};\n"+out.source}:out;
}});
const {loadAtlas,World}=await import('../../../src/render/world.ts');
register.deregister();
globalThis.fetch=async(url,options)=>{
 try{
  const body=read(pub+String(url)),raw=new Headers(options?.headers).get('Range');
  if(!raw)return new Response(body);
  const m=/^bytes=(\d+)-(\d+)$/.exec(raw);
  if(!m||+m[1]<0||+m[2]>=body.length||+m[1]>+m[2])return new Response(null,{status:416});
  return new Response(body.subarray(+m[1],+m[2]+1),{status:206,
   headers:{'Content-Range':`bytes ${m[1]}-${m[2]}/${body.length}`,'Accept-Ranges':'bytes'}});
 }catch{return new Response(null,{status:404});}
};
T.TextureLoader.prototype.load=()=>new T.Texture();
T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
const {terrain,img,cover,sky,bench,southLake,sourisLighting}=await loadAtlas(()=>{},false,false,false,undefined,false,undefined,undefined,true);
const world=new World(new T.Scene(),terrain,img,{capabilities:{maxTextureSize:4096}},cover,sky,bench,southLake,sourisLighting);
world.details.load=async()=>undefined;
export {T,terrain,cover,world};
