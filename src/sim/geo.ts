/** WGS84 local tangent approximation. X east, Y up, Z south; one scene unit is one metre. */
export const ORIGIN = { lon: -63.2, lat: 46.5 };
export const RAD = Math.PI / 180;
export const DEG = 1 / RAD;
const a = 6378137, e2 = 6.69437999014e-3, phi = ORIGIN.lat * RAD;
const t = 1 - e2 * Math.sin(phi) ** 2;
export const METRES_PER_LON = a * RAD * Math.cos(phi) / Math.sqrt(t);
export const METRES_PER_LAT = a * (1 - e2) * RAD / t ** 1.5;
export function project(lon: number, lat: number) {
  return { x: (lon - ORIGIN.lon) * METRES_PER_LON, z: (ORIGIN.lat - lat) * METRES_PER_LAT };
}
export function geographic(x: number, z: number) {
  return { lon: ORIGIN.lon + x / METRES_PER_LON, lat: ORIGIN.lat - z / METRES_PER_LAT };
}
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
export const wrap = (r: number) => ((r % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
