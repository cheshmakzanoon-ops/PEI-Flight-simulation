import { bakeStones } from './masonry';

// This module only runs when the detached study requests its first shaded scene.
const baked=bakeStones();
(self as unknown as {postMessage:(message:unknown, transfers:ArrayBuffer[])=>void})
  .postMessage(baked,baked.planes.map(p=>p.pixels.buffer as ArrayBuffer));
