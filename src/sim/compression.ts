/** Static hosts may serve an explicit .gz verbatim, or mark it Content-Encoding:gzip so fetch already decodes it. */
export async function unpackGzip(bytes:ArrayBuffer):Promise<ArrayBuffer>{
 const header=new Uint8Array(bytes,0,Math.min(bytes.byteLength,2));
 if(header[0]!==0x1f||header[1]!==0x8b)return bytes;
 return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
