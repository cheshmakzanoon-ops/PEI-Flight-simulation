import type { Cover } from '../sim/cover.ts';
import type { Terrain } from '../sim/terrain.ts';
import { verifyDecodedCover } from '../sim/cover-proof.ts';
import { CANOPY_FENCE } from './canopy-fence.generated.ts';
import { MEADOW_TILES } from './meadow-tiles.generated.ts';

export function meadowStandardAtlas(terrain: Terrain, terrainSha: string | undefined, cover: Cover) {
  const { width, height, bounds } = terrain.spec;
  return terrainSha === CANOPY_FENCE.pins.terrain && cover.sourceSha === CANOPY_FENCE.pins.cover &&
    width === 4096 && height === 2720 && cover.width === width && cover.height === height &&
    bounds.length === 4 && [-64.47, 45.94, -61.93, 47.1].every((x, i) => x === bounds[i]) &&
    !!globalThis.crypto?.subtle;
}
export class StandardMeadow {
  readonly tiles = MEADOW_TILES;
  private proof: 'cold' | 'checking' | 'ready' | 'stock' = 'cold';
  private nextCheck = 0;
  private strength = 0;
  private fadeFrom: number | undefined;
  private readonly readCover: () => Promise<string | undefined>;
  constructor(cover: Cover, readCover = () => verifyDecodedCover(cover)) { this.readCover = readCover; }
  get state() { return { proof: this.proof, strength: this.strength }; }
  /** No network or geometry involved. Do not digest the whole Cover on boot.
   * Only the real low camera may request proof. An existing file read kicked
   * off by another local feature is reused without another digest. */
  update(clock: number, lowFlight: boolean, nearby: () => boolean) {
    if (!lowFlight) { this.strength = 0; this.fadeFrom = undefined; return 0; }
    if (this.proof === 'ready') {
      this.fadeFrom ??= clock;
      this.strength = Math.min(1, Math.max(0, (clock - this.fadeFrom) / .33));
    } else if (this.proof === 'cold' && clock >= this.nextCheck) {
      this.nextCheck = clock + .25;
      if (nearby()) {
        this.proof = 'checking';
        void Promise.resolve().then(this.readCover).then(
          id => { this.proof = id === CANOPY_FENCE.pins.coverDecoded ? 'ready' : 'stock'; },
          () => { this.proof = 'stock'; });
      }
    }
    return this.strength;
  }
}
