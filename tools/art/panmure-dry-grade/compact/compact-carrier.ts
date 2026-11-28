import { PACKET } from './packet-pins.generated.ts';

type StockCPUInput = Readonly<{
  tile: string;
  n: number;
  matrixWorld: readonly number[];
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint16Array;
}>;

type PacketFile = keyof typeof PACKET.packetLeaves;
type PacketInput = Readonly<Record<PacketFile, Uint8Array>>;
type DetachedArrays = Readonly<{
  // All buffers are owned by this one verifier result. The first 4 IDs are
  // copies of old bytes and must map to the original IDs for any future QA.
  neutral: Float32Array; positions: Float32Array; uv: Float32Array;
  normals: Float32Array; localIndex: Uint16Array; replacementIndex: Uint16Array;
  originalIndexRun: Uint16Array; rolePerTriangle: Uint8Array;
  originalBorrowedIndices: readonly number[]; oldRun: readonly [number, number];
  cpuArchiveBasis: true;
  canMount: false;
}>;

function sameWords(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

function bytes(x: ArrayBufferView): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new Uint8Array(x.buffer, x.byteOffset, x.byteLength));
}

function cpuLittleEndian() {
  return new Uint8Array(new Uint16Array([0x0201]).buffer)[0] === 1;
}

async function sha(x: Uint8Array<ArrayBuffer>): Promise<string> {
  const answer = new Uint8Array(await crypto.subtle.digest('SHA-256', x));
  return [...answer].map(y => y.toString(16).padStart(2, '0')).join('');
}

/** No material, scene, fetch, mutable aliases, or live-world fields accepted.
 * This exactly verifies the CPU source replay. It is deliberately not a
 * renderer/pre-link lease and any distinct browser basis remains refused. */
export async function verifyCompactCarrier(old: StockCPUInput, src: PacketInput): Promise<DetachedArrays | null> {
  if (!globalThis.crypto?.subtle || !cpuLittleEndian() ||
      old.tile !== PACKET.stockTile || old.n !== 112 || !sameWords(old.matrixWorld, PACKET.modelMatrixColumnMajorOriginalF64)) return null;
  if (!(old.position instanceof Float32Array && old.normal instanceof Float32Array &&
        old.uv instanceof Float32Array && old.index instanceof Uint16Array) ||
      old.position.length !== 38307 || old.normal.length !== 38307 || old.uv.length !== 25538 || old.index.length !== 75264) return null;
  const stock = {position: bytes(old.position), normal: bytes(old.normal), uv: bytes(old.uv), index: bytes(old.index)};
  const leaves = Object.keys(PACKET.packetLeaves) as PacketFile[];
  const get = {} as Record<PacketFile, Uint8Array<ArrayBuffer>>;
  for (const key of leaves) {
    if (!(src[key] instanceof Uint8Array) || src[key].length !== PACKET.packetLeaves[key].bytes) return null;
    get[key] = bytes(src[key]);
  }
  for (const key of Object.keys(stock) as (keyof typeof stock)[]) {
    if (await sha(stock[key]) !== PACKET.oldWholeAssetSHA256[key]) return null;
  }
  for (const key of leaves) if (await sha(get[key]) !== PACKET.packetLeaves[key].sha256) return null;

  const oldI = new Uint16Array(stock.index.buffer);
  const neutral = new Float32Array(get['neutral.p.f32le'].buffer);
  const positions = new Float32Array(get['active.p.f32le'].buffer);
  const normals = new Float32Array(get['normal.f32le'].buffer);
  const uv = new Float32Array(get['uv.f32le'].buffer);
  const localIndex = new Uint16Array(get['replacement.local.i.u16le'].buffer);
  const replacementIndex = new Uint16Array(get['replacement.rebased.i.u16le'].buffer);
  const originalIndexRun = new Uint16Array(get['old-9552-9558.i.u16le'].buffer);
  const [from, to] = PACKET.oldIndexRangeHalfOpen;
  if (!sameWords(originalIndexRun, oldI.subarray(from, to)) ||
      !sameWords(originalIndexRun, PACKET.oldLiteralRemovedTriples.flat())) return null;
  const borrow = PACKET.borrowOriginalVertexIDsInLocalOrder;
  const nOldP = new Uint32Array(stock.position.buffer);
  const nOldN = new Uint32Array(stock.normal.buffer);
  const nOldUV = new Uint32Array(stock.uv.buffer);
  for (const [newP, oldP, k] of [[neutral,nOldP,3],[positions,nOldP,3],[normals,nOldN,3],[uv,nOldUV,2]] as const) {
    const p = new Uint32Array(newP.buffer);
    for (let i = 0; i < borrow.length; i++) if (!sameWords(p.subarray(i*k, (i+1)*k), oldP.subarray(borrow[i]*k, (borrow[i]+1)*k))) return null;
  }
  for (let i = 0; i < localIndex.length; i++) {
    const k = localIndex[i];
    if (k >= 229 || replacementIndex[i] !== (k<4 ? borrow[k] : 12769+k-4)) return null;
  }
  const rolePerTriangle = get['active-triangle-role.u8'];
  for (let i=0; i<localIndex.length; i+=3) {
    const ids = localIndex.subarray(i,i+3);
    const changed = ids.some(k => neutral[k*3+1] !== positions[k*3+1]);
    if (rolePerTriangle[i/3] !== Number(changed)) return null;
  }
  return Object.freeze({neutral, positions, normals, uv, localIndex, replacementIndex, originalIndexRun,
    originalBorrowedIndices: Object.freeze([...borrow]), oldRun: Object.freeze([from, to] as const),
    rolePerTriangle, cpuArchiveBasis: true, canMount: false});
}
