import {BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute} from 'three';

const roles = ['south', 'north', 'unverifiedCollar', 'walls', 'proofFloor'] as const;
type Role = typeof roles[number];
interface Exhibit {
  schema: number;
  origin: readonly number[];
  points: readonly number[];
  groups: Readonly<Record<Role, readonly number[]>>;
}
const faces = [32,32,18,48,82];

/** Detached workbench geometry. The unverified collar cannot enter the fitted-cores view. */
export function georgetownRoofStudy(data: Exhibit, mode: 'cores' | 'context' | 'closure-proof' = 'cores') {
  const {points, groups, origin} = data;
  if (data.schema !== 1 || origin.length !== 3 || !origin.every(Number.isFinite) ||
      points.length !== 324 || !points.every(v => Number.isFinite(v) && Math.fround(v) === v)) {
    throw new Error('Invalid Georgetown study positions');
  }
  for (const [i, role] of roles.entries()) {
    const row = groups[role];
    if (!Array.isArray(row) || row.length !== faces[i] * 3 ||
        row.some(v => !Number.isInteger(v) || v < 0 || v >= 108) ||
        row.some((v,j) => j % 3 === 0 && (v === row[j+1] || v === row[j+2] || row[j+1] === row[j+2]))) {
      throw new Error('Invalid Georgetown study indices: ' + role);
    }
  }
  const selection = roles.slice(0,mode === 'cores' ? 2 : mode === 'context' ? 4 : 5);
  const geo = new BufferGeometry(), index: number[] = [];
  for (const [i, role] of selection.entries()) {
    geo.addGroup(index.length,groups[role].length,i);
    index.push(...groups[role]);
  }
  geo.setAttribute('position',new Float32BufferAttribute(points,3));
  geo.setIndex(new Uint16BufferAttribute(index,1));
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  flat.computeBoundingSphere();
  return {origin:[...origin],geometry:flat,roles:selection};
}
